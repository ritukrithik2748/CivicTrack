import { getDb, runInTransaction } from '../db/database.js';
import { nowISO, now, HOUR_MS, DAY_MS } from './clock.js';
import { randomUUID } from 'crypto';

const GRACE_PERIODS = {
  major: 24 * HOUR_MS,
  moderate: 72 * HOUR_MS,
  minor: 7 * DAY_MS,
};

const ESCALATION_GRACE_MULTIPLIER = {
  major: 2, // 2x grace for level 2
  moderate: 2,
  minor: 2,
};

export function getGracePeriod(severity: string): number {
  return GRACE_PERIODS[severity as keyof typeof GRACE_PERIODS] || GRACE_PERIODS.minor;
}

export function getEscalationGracePeriod(severity: string, level: number): number {
  const baseGrace = getGracePeriod(severity);
  if (level === 1) return baseGrace;
  if (level === 2) return baseGrace * ESCALATION_GRACE_MULTIPLIER[severity as keyof typeof ESCALATION_GRACE_MULTIPLIER];
  return 0;
}

export interface WorkOrderItemWithDetails {
  id: string;
  work_order_id: string;
  group_id: string;
  department_id: string;
  sequence_no: number;
  role: string;
  status: string;
  expected_complete_at: string | null;
  scheduled_start_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  escalation_level: number;
  delay_reason: string | null;
  severity: string;
}

export function getOverdueItems(): WorkOrderItemWithDetails[] {
  const db = getDb();
  const currentTime = now().toISOString();
  
  return db.prepare(`
    SELECT woi.*, pg.severity
    FROM work_order_items woi
    JOIN problem_groups pg ON pg.id = woi.group_id
    WHERE woi.status IN ('pending', 'scheduled', 'in_progress')
    AND woi.expected_complete_at IS NOT NULL
    AND woi.expected_complete_at < ?
    AND woi.escalation_level = 0
  `).all(currentTime) as WorkOrderItemWithDetails[];
}

export function getItemsNeedingEscalation(): WorkOrderItemWithDetails[] {
  const db = getDb();
  const currentTime = now().toISOString();
  
  return db.prepare(`
    SELECT woi.*, pg.severity
    FROM work_order_items woi
    JOIN problem_groups pg ON pg.id = woi.group_id
    WHERE woi.status IN ('pending', 'scheduled', 'in_progress', 'overdue')
    AND woi.expected_complete_at IS NOT NULL
    AND woi.escalation_level IN (0, 1)
    AND (
      (woi.escalation_level = 0 AND woi.expected_complete_at + ? < ?)  -- Level 1: past grace
      OR (woi.escalation_level = 1 AND woi.expected_complete_at + ? < ?)  -- Level 2: past 2x grace
    )
  `).all(
    getGracePeriod('major'), // Placeholder, actual check done in JS
    currentTime,
    getGracePeriod('major') * 2, // Placeholder
    currentTime
  ) as WorkOrderItemWithDetails[];
}

export function checkAndProcessEscalations(): { level1: number; level2: number } {
  const db = getDb();
  let level1Count = 0;
  let level2Count = 0;
  
  const items = db.prepare(`
    SELECT woi.*, pg.severity
    FROM work_order_items woi
    JOIN problem_groups pg ON pg.id = woi.group_id
    WHERE woi.status IN ('pending', 'scheduled', 'in_progress', 'overdue')
    AND woi.expected_complete_at IS NOT NULL
  `).all() as WorkOrderItemWithDetails[];
  
  const currentTime = now();
  
  for (const item of items) {
    const expectedComplete = new Date(item.expected_complete_at!).getTime();
    const gracePeriod = getGracePeriod(item.severity);
    const timeSinceExpected = currentTime.getTime() - expectedComplete;
    
    if (item.escalation_level === 0 && timeSinceExpected > 0) {
      // Mark as overdue
      db.prepare(`
        UPDATE work_order_items
        SET status = 'overdue', escalation_level = 0, updated_at = ?
        WHERE id = ?
      `).run(nowISO(), item.id);
    }
    
    if (item.escalation_level === 0 && timeSinceExpected >= gracePeriod) {
      // Level 1 escalation
      escalateItem(item, 1);
      level1Count++;
    } else if (item.escalation_level === 1 && timeSinceExpected >= gracePeriod * 2) {
      // Level 2 escalation
      escalateItem(item, 2);
      level2Count++;
    }
  }
  
  return { level1: level1Count, level2: level2Count };
}

function escalateItem(item: WorkOrderItemWithDetails, level: 1 | 2): void {
  const db = getDb();
  
  // Check if already escalated at this level
  const existing = db.prepare('SELECT id FROM escalations WHERE work_order_item_id = ? AND level = ?').get(item.id, level);
  if (existing) return;
  
  const escalationId = randomUUID();
  let notifiedUserId: string;
  let reason: string;
  
  if (level === 1) {
    // Notify department head
    const head = db.prepare('SELECT head_user_id FROM departments WHERE id = ?').get(item.department_id) as { head_user_id: string | null } | undefined;
    notifiedUserId = head?.head_user_id || '';
    reason = `Work item overdue by ${formatDuration(getGracePeriod(item.severity))}. Expected completion: ${new Date(item.expected_complete_at!).toLocaleString()}`;
  } else {
    // Notify admin
    const admin = db.prepare('SELECT id FROM users WHERE role = \'admin\' LIMIT 1').get() as { id: string } | undefined;
    notifiedUserId = admin?.id || '';
    reason = `Work item overdue by ${formatDuration(getGracePeriod(item.severity) * 2)}. Level 1 escalation did not resolve. Expected completion: ${new Date(item.expected_complete_at!).toLocaleString()}`;
  }
  
  if (notifiedUserId) {
    db.prepare(`
      INSERT INTO escalations (id, work_order_item_id, level, notified_user_id, reason, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(escalationId, item.id, level, notifiedUserId, reason, nowISO());
    
    // Create notification
    db.prepare(`
      INSERT INTO notifications (id, user_id, type, title, body, link, read, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?)
    `).run(randomUUID(), notifiedUserId, 'escalation', `Escalation Level ${level}`, reason, `/workorders/${item.work_order_id}`, nowISO());
  }
  
  // Update item escalation level
  db.prepare(`
    UPDATE work_order_items
    SET escalation_level = ?, updated_at = ?
    WHERE id = ?
  `).run(level, nowISO(), item.id);
  
  // Notify secondary departments of delay
  if (level >= 1) {
    notifySecondariesOfDelay(item.work_order_id, item.sequence_no);
  }
}

export function notifySecondariesOfDelay(workOrderId: string, completedSequenceNo: number): void {
  const db = getDb();
  const secondaryItems = db.prepare(`
    SELECT * FROM work_order_items
    WHERE work_order_id = ? AND sequence_no > ? AND role IN ('secondary', 'parallel')
    AND status IN ('pending', 'scheduled')
  `).all(workOrderId, completedSequenceNo) as any[];
  
  for (const item of secondaryItems) {
    const officers = db.prepare('SELECT id FROM users WHERE department_id = ? AND role = \'officer\'').all(item.department_id) as { id: string }[];
    
    for (const officer of officers) {
      db.prepare(`
        INSERT INTO notifications (id, user_id, type, title, body, link, read, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 0, ?)
      `).run(randomUUID(), officer.id, 'delay', 'Primary Work Delayed', 
        `Primary department has not completed work. Your scheduled start is delayed.`, 
        `/workorders/${workOrderId}`, nowISO());
    }
  }
}

export function reassignWorkOrderItem(itemId: string, newDepartmentId: string, adminId: string): void {
  const db = getDb();
  
  const item = db.prepare('SELECT * FROM work_order_items WHERE id = ?').get(itemId) as any;
  if (!item) throw new Error('Work order item not found');
  
  const oldDepartmentId = item.department_id;
  
  runInTransaction((tx) => {
    // Update item
    tx.prepare(`
      UPDATE work_order_items
      SET department_id = ?, updated_at = ?
      WHERE id = ?
    `).run(newDepartmentId, nowISO(), itemId);
    
    // Log audit
    tx.prepare(`
      INSERT INTO audit_log (id, actor_id, action, entity, entity_id, detail_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(randomUUID(), adminId, 'reassign', 'work_order_item', itemId, JSON.stringify({ from: oldDepartmentId, to: newDepartmentId }), nowISO());
    
    // Notify new department
    const officers = tx.prepare('SELECT id FROM users WHERE department_id = ? AND role = \'officer\'').all(newDepartmentId) as { id: string }[];
    for (const officer of officers) {
      tx.prepare(`
        INSERT INTO notifications (id, user_id, type, title, body, link, read, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 0, ?)
      `).run(randomUUID(), officer.id, 'reassignment', 'Work Reassigned', 
        `You have been assigned to work order item ${itemId}.`, `/workorders/${item.work_order_id}`, nowISO());
    }
  });
}

export function releaseSecondaryToParallel(itemId: string, adminId: string): void {
  const db = getDb();
  
  const item = db.prepare('SELECT * FROM work_order_items WHERE id = ?').get(itemId) as any;
  if (!item) throw new Error('Work order item not found');
  
  if (item.role !== 'secondary') {
    throw new Error('Only secondary items can be released to parallel');
  }
  
  runInTransaction((tx) => {
    tx.prepare(`
      UPDATE work_order_items
      SET role = 'parallel', status = 'scheduled', scheduled_start_at = ?, updated_at = ?
      WHERE id = ?
    `).run(nowISO(), nowISO(), itemId);
    
    // Log audit
    tx.prepare(`
      INSERT INTO audit_log (id, actor_id, action, entity, entity_id, detail_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(randomUUID(), adminId, 'release_parallel', 'work_order_item', itemId, JSON.stringify({}), nowISO());
    
    // Notify department
    const officers = tx.prepare('SELECT id FROM users WHERE department_id = ? AND role = \'officer\'').all(item.department_id) as { id: string }[];
    for (const officer of officers) {
      tx.prepare(`
        INSERT INTO notifications (id, user_id, type, title, body, link, read, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 0, ?)
      `).run(randomUUID(), officer.id, 'released', 'Work Released for Parallel Execution', 
        `Admin has released your work to proceed in parallel.`, `/workorders/${item.work_order_id}`, nowISO());
    }
  });
}

function formatDuration(ms: number): string {
  const hours = Math.floor(ms / HOUR_MS);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days} day${days > 1 ? 's' : ''}`;
  return `${hours} hour${hours > 1 ? 's' : ''}`;
}

export function getEscalationConfig(): typeof GRACE_PERIODS {
  return { ...GRACE_PERIODS };
}