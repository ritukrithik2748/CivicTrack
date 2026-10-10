import { getDb, runInTransaction } from '../db/database.js';
import { nowISO, now, HOUR_MS } from './clock.js';
import { randomUUID } from 'crypto';
import { computeSeverity } from './severity.js';

const SECONDARY_GAP_MINUTES = 60;

interface Department {
  id: string;
  code: string;
  name: string;
  dependency_level: number;
}

interface ProblemGroup {
  id: string;
  spot_id: string;
  category: string;
  department_id: string;
  severity: string;
  weighted_count: number;
  first_reported_at: string;
  status: string;
}

interface WorkOrderItemInput {
  group_id: string;
  department_id: string;
  sequence_no: number;
  role: 'primary' | 'secondary' | 'parallel';
  tie_break_reason: string;
  expected_complete_at: string | null;
}

export function getDepartmentsOrderedByDependency(): Department[] {
  const db = getDb();
  return db.prepare('SELECT id, code, name, dependency_level FROM departments ORDER BY dependency_level ASC, id ASC').all() as Department[];
}

export function getGroupsForSpot(spotId: string): ProblemGroup[] {
  const db = getDb();
  return db.prepare(`
    SELECT pg.id, pg.spot_id, pg.category, pg.department_id, pg.severity, pg.weighted_count, pg.first_reported_at, pg.status
    FROM problem_groups pg
    WHERE pg.spot_id = ? AND pg.status IN ('open', 'acknowledged', 'in_progress')
    ORDER BY pg.first_reported_at ASC
  `).all(spotId) as ProblemGroup[];
}

export function hasMultipleDepartments(spotId: string): boolean {
  const db = getDb();
  const count = db.prepare(`
    SELECT COUNT(DISTINCT department_id) as cnt
    FROM problem_groups
    WHERE spot_id = ? AND status IN ('open', 'acknowledged', 'in_progress')
  `).get(spotId) as { cnt: number };
  return count.cnt >= 2;
}

function getSeverityRank(severity: string): number {
  switch (severity) {
    case 'major': return 3;
    case 'moderate': return 2;
    case 'minor': return 1;
    default: return 0;
  }
}

function hasDepartmentStartedOnSpot(departmentId: string, spotId: string): boolean {
  const db = getDb();
  const item = db.prepare(`
    SELECT woi.id FROM work_order_items woi
    JOIN work_orders wo ON wo.id = woi.work_order_id
    WHERE woi.department_id = ? AND wo.spot_id = ? AND woi.status IN ('in_progress', 'complete')
  `).get(departmentId, spotId);
  return !!item;
}

export function computeWorkOrderSequence(spotId: string): WorkOrderItemInput[] {
  const groups = getGroupsForSpot(spotId);
  if (groups.length === 0) return [];
  
  // Group by department
  const deptGroups = new Map<string, ProblemGroup[]>();
  for (const group of groups) {
    if (!deptGroups.has(group.department_id)) {
      deptGroups.set(group.department_id, []);
    }
    deptGroups.get(group.department_id)!.push(group);
  }
  
  // Get department info
  const departments = getDepartmentsOrderedByDependency();
  const deptMap = new Map(departments.map(d => [d.id, d]));
  
  // Create department entries with their highest severity group
  const deptEntries = Array.from(deptGroups.entries()).map(([deptId, groups]) => {
    const dept = deptMap.get(deptId);
    const highestSeverityGroup = groups.reduce((max, g) => 
      getSeverityRank(g.severity) > getSeverityRank(max.severity) ? g : max
    );
    return {
      department_id: deptId,
      dependency_level: dept?.dependency_level || 999,
      highest_severity: highestSeverityGroup.severity,
      highest_severity_rank: getSeverityRank(highestSeverityGroup.severity),
      weighted_count: groups.reduce((sum, g) => sum + g.weighted_count, 0),
      first_reported_at: groups.reduce((earliest, g) => 
        g.first_reported_at < earliest.first_reported_at ? g : earliest
      ).first_reported_at,
      groups: groups,
      has_started: hasDepartmentStartedOnSpot(deptId, spotId),
    };
  });
  
  // Sort by dependency level first
  deptEntries.sort((a, b) => {
    if (a.dependency_level !== b.dependency_level) {
      return a.dependency_level - b.dependency_level;
    }
    
    // Same level - apply tie-break rules
    // 1. Higher severity group first
    if (a.highest_severity_rank !== b.highest_severity_rank) {
      return b.highest_severity_rank - a.highest_severity_rank;
    }
    
    // 2. Department already in_progress on site first
    if (a.has_started !== b.has_started) {
      return a.has_started ? -1 : 1;
    }
    
    // 3. Higher weighted_count first
    if (a.weighted_count !== b.weighted_count) {
      return b.weighted_count - a.weighted_count;
    }
    
    // 4. Older first_reported_at first
    if (a.first_reported_at !== b.first_reported_at) {
      return a.first_reported_at.localeCompare(b.first_reported_at);
    }
    
    // 5. Lower department_id (deterministic fallback)
    return a.department_id.localeCompare(b.department_id);
  });
  
  // Assign roles and sequence numbers
  const sequence: WorkOrderItemInput[] = [];
  for (let i = 0; i < deptEntries.length; i++) {
    const entry = deptEntries[i];
    let role: 'primary' | 'secondary' | 'parallel';
    let tieBreakReason = '';
    
    if (i === 0) {
      role = 'primary';
      tieBreakReason = `Primary: dependency level ${entry.dependency_level}`;
    } else {
      const prevEntry = deptEntries[i - 1];
      if (entry.dependency_level === prevEntry.dependency_level) {
        // Same level - check if admin set parallel
        // For now, use tie-break reason from sorting
        if (entry.highest_severity_rank > prevEntry.highest_severity_rank) {
          tieBreakReason = `Secondary: higher severity (${entry.highest_severity} vs ${prevEntry.highest_severity})`;
        } else if (entry.has_started && !prevEntry.has_started) {
          tieBreakReason = `Secondary: already in progress on site`;
        } else if (entry.weighted_count > prevEntry.weighted_count) {
          tieBreakReason = `Secondary: higher weighted count (${entry.weighted_count} vs ${prevEntry.weighted_count})`;
        } else if (entry.first_reported_at < prevEntry.first_reported_at) {
          tieBreakReason = `Secondary: older problem (${entry.first_reported_at} vs ${prevEntry.first_reported_at})`;
        } else {
          tieBreakReason = `Secondary: lower department ID (deterministic)`;
        }
      } else {
        tieBreakReason = `Secondary: dependency level ${entry.dependency_level} after ${prevEntry.dependency_level}`;
      }
      role = 'secondary';
    }
    
    // Determine expected completion based on severity
    const expectedDays = entry.highest_severity === 'major' ? 1 : entry.highest_severity === 'moderate' ? 3 : 7;
    const expectedCompleteAt = new Date(now().getTime() + expectedDays * 24 * HOUR_MS).toISOString();
    
    sequence.push({
      group_id: entry.groups[0].id, // Use first group's ID as representative
      department_id: entry.department_id,
      sequence_no: i + 1,
      role,
      tie_break_reason: tieBreakReason,
      expected_complete_at: expectedCompleteAt,
    });
  }
  
  return sequence;
}

export function createOrUpdateWorkOrder(spotId: string): { workOrderId: string; itemsCreated: number; itemsUpdated: number } {
  const db = getDb();
  
  if (!hasMultipleDepartments(spotId)) {
    // No work order needed for single department
    db.prepare('DELETE FROM work_orders WHERE spot_id = ?').run(spotId);
    return { workOrderId: '', itemsCreated: 0, itemsUpdated: 0 };
  }
  
  return runInTransaction((tx) => {
    let workOrder = tx.prepare('SELECT id FROM work_orders WHERE spot_id = ?').get(spotId) as { id: string } | undefined;
    let workOrderId: string;
    let itemsCreated = 0;
    let itemsUpdated = 0;
    
    if (!workOrder) {
      workOrderId = randomUUID();
      tx.prepare('INSERT INTO work_orders (id, spot_id, status, created_at) VALUES (?, ?, ?, ?)')
        .run(workOrderId, spotId, 'active', nowISO());
    } else {
      workOrderId = workOrder.id;
    }
    
    const sequence = computeWorkOrderSequence(spotId);
    
    // Get existing items
    const existingItems = tx.prepare('SELECT * FROM work_order_items WHERE work_order_id = ?').all(workOrderId) as any[];
    const existingMap = new Map(existingItems.map(item => [item.department_id, item]));
    
    for (const itemInput of sequence) {
      const existing = existingMap.get(itemInput.department_id);
      
      if (existing) {
        // Update existing
        tx.prepare(`
          UPDATE work_order_items
          SET sequence_no = ?, role = ?, tie_break_reason = ?, expected_complete_at = ?, updated_at = ?
          WHERE id = ?
        `).run(
          itemInput.sequence_no,
          itemInput.role,
          itemInput.tie_break_reason,
          itemInput.expected_complete_at,
          nowISO(),
          existing.id
        );
        itemsUpdated++;
      } else {
        // Create new
        const itemId = randomUUID();
        tx.prepare(`
          INSERT INTO work_order_items (id, work_order_id, group_id, department_id, sequence_no, role, tie_break_reason, status, expected_complete_at, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)
        `).run(
          itemId,
          workOrderId,
          itemInput.group_id,
          itemInput.department_id,
          itemInput.sequence_no,
          itemInput.role,
          itemInput.tie_break_reason,
          itemInput.expected_complete_at,
          nowISO(),
          nowISO()
        );
        itemsCreated++;
      }
    }
    
    // Remove items for departments no longer in sequence
    const currentDeptIds = new Set(sequence.map(s => s.department_id));
    for (const existing of existingItems) {
      if (!currentDeptIds.has(existing.department_id)) {
        tx.prepare('DELETE FROM work_order_items WHERE id = ?').run(existing.id);
      }
    }
    
    return { workOrderId, itemsCreated, itemsUpdated };
  });
}

export function getWorkOrderForSpot(spotId: string) {
  const db = getDb();
  const workOrder = db.prepare('SELECT * FROM work_orders WHERE spot_id = ?').get(spotId) as { id: string; spot_id: string; status: string; created_at: string; updated_at: string } | undefined;
  if (!workOrder) return null;
  
  const items = db.prepare(`
    SELECT woi.*, d.name as department_name, d.code as department_code
    FROM work_order_items woi
    JOIN departments d ON d.id = woi.department_id
    WHERE woi.work_order_id = ?
    ORDER BY woi.sequence_no ASC
  `).all(workOrder.id);
  
  return { ...workOrder, items };
}

export function triggerSecondaryOnPrimaryComplete(workOrderId: string, completedItemId: string): void {
  const db = getDb();
  
  // Find the completed item
  const completedItem = db.prepare('SELECT * FROM work_order_items WHERE id = ?').get(completedItemId) as any;
  if (!completedItem || completedItem.role !== 'primary') return;
  
  const completedAt = nowISO();
  
  // Update completed item
  db.prepare(`
    UPDATE work_order_items
    SET status = 'complete', completed_at = ?, updated_at = ?
    WHERE id = ?
  `).run(completedAt, completedAt, completedItemId);
  
  // Find next secondary item
  const nextItem = db.prepare(`
    SELECT * FROM work_order_items
    WHERE work_order_id = ? AND sequence_no > ? AND role = 'secondary'
    ORDER BY sequence_no ASC
    LIMIT 1
  `).get(workOrderId, completedItem.sequence_no) as any;
  
  if (nextItem) {
    const scheduledStartAt = new Date(Date.now() + SECONDARY_GAP_MINUTES * 60 * 1000).toISOString();
    
    db.prepare(`
      UPDATE work_order_items
      SET status = 'scheduled', scheduled_start_at = ?, updated_at = ?
      WHERE id = ?
    `).run(scheduledStartAt, nowISO(), nextItem.id);
    
    // Notify the secondary department's officers
    notifyDepartmentOfficers(nextItem.department_id, {
      type: 'work_scheduled',
      title: 'Work Scheduled',
      body: `Primary work completed. Your work is scheduled to start in ${SECONDARY_GAP_MINUTES} minutes at ${new Date(scheduledStartAt).toLocaleTimeString()}.`,
      link: `/workorders/${workOrderId}`,
    });
  }
}

function notifyDepartmentOfficers(departmentId: string, notification: { type: string; title: string; body: string; link: string }): void {
  const db = getDb();
  const officers = db.prepare('SELECT id FROM users WHERE department_id = ? AND role = \'officer\'').all(departmentId) as { id: string }[];
  
  for (const officer of officers) {
    db.prepare(`
      INSERT INTO notifications (id, user_id, type, title, body, link, read, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?)
    `).run(randomUUID(), officer.id, notification.type, notification.title, notification.body, notification.link, nowISO());
  }
}

export function getSecondaryGapMinutes(): number {
  return SECONDARY_GAP_MINUTES;
}

export function setSecondaryGapMinutes(minutes: number): void {
  // This would be a setting in the database
  const db = getDb();
  db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, datetime(\'now\'))')
    .run('secondary_gap_minutes', String(minutes));
}