import { getDb } from '../db/database.js';
import { nowISO } from './clock.js';

const MAJOR_COUNT_THRESHOLD = 10;
const STALL_DAYS_MAJOR = 14;
const MODERATE_MIN_COUNT = 4;
const MODERATE_MAX_COUNT = 9;

const SAFETY_CRITICAL_CATEGORIES = new Set([
  'live_wire',
  'road_cave_in',
  'transformer_issue',
  'sewage_leak',
]);

const MODERATE_CATEGORIES = new Set([
  'drain_blockage',
  'waterlogging',
  'sewage_blockage',
  'water_pipe_leak',
  'cable_fault',
]);

export interface SeverityResult {
  severity: 'minor' | 'moderate' | 'major';
  reason: string;
}

export function computeSeverity(groupId: string): SeverityResult {
  const db = getDb();
  
  const group = db.prepare(`
    SELECT pg.*, 
           (SELECT COUNT(*) FROM reports r WHERE r.group_id = pg.id AND r.status IN ('open', 'acknowledged', 'in_progress', 'reopened')) as active_reports
    FROM problem_groups pg
    WHERE pg.id = ?
  `).get(groupId) as any;
  
  if (!group) {
    return { severity: 'minor', reason: 'Group not found' };
  }
  
  const weightedCount = group.weighted_count;
  const category = group.category;
  const stalledSince = group.stalled_since;
  
  // Check safety-critical categories
  if (SAFETY_CRITICAL_CATEGORIES.has(category)) {
    // For sewage_leak, check if it's "open or overflowing" - we'll treat all as critical for now
    return { severity: 'major', reason: `Major: safety-critical category (${category})` };
  }
  
  // Check weighted count threshold
  if (weightedCount >= MAJOR_COUNT_THRESHOLD) {
    return { severity: 'major', reason: `Major: ${weightedCount} weighted reports (>= ${MAJOR_COUNT_THRESHOLD})` };
  }
  
  // Check stalled days
  if (stalledSince) {
    const stalledDate = new Date(stalledSince);
    const now = new Date();
    const stalledDays = (now.getTime() - stalledDate.getTime()) / (1000 * 60 * 60 * 24);
    if (stalledDays >= STALL_DAYS_MAJOR) {
      return { severity: 'major', reason: `Major: stalled for ${Math.floor(stalledDays)} days (>= ${STALL_DAYS_MAJOR})` };
    }
  }
  
  // Check moderate categories
  if (MODERATE_CATEGORIES.has(category)) {
    return { severity: 'moderate', reason: `Moderate: category ${category}` };
  }
  
  // Check weighted count for moderate
  if (weightedCount >= MODERATE_MIN_COUNT && weightedCount <= MODERATE_MAX_COUNT) {
    return { severity: 'moderate', reason: `Moderate: ${weightedCount} weighted reports (${MODERATE_MIN_COUNT}-${MODERATE_MAX_COUNT})` };
  }
  
  // Default to minor
  return { severity: 'minor', reason: `Minor: ${weightedCount} weighted reports` };
}

export function updateGroupSeverity(groupId: string): void {
  const db = getDb();
  const { severity, reason } = computeSeverity(groupId);
  
  db.prepare(`
    UPDATE problem_groups
    SET severity = ?, severity_reason = ?, updated_at = ?
    WHERE id = ?
  `).run(severity, reason, nowISO(), groupId);
}

export function updateAllGroupSeverities(): { updated: number } {
  const db = getDb();
  const groups = db.prepare('SELECT id FROM problem_groups').all() as { id: string }[];
  let updated = 0;
  
  for (const group of groups) {
    const { severity, reason } = computeSeverity(group.id);
    const current = db.prepare('SELECT severity FROM problem_groups WHERE id = ?').get(group.id) as { severity: string } | undefined;
    
    if (current && current.severity !== severity) {
      db.prepare(`
        UPDATE problem_groups
        SET severity = ?, severity_reason = ?, updated_at = ?
        WHERE id = ?
      `).run(severity, reason, nowISO(), group.id);
      updated++;
    }
  }
  
  return { updated };
}

export function getSeverityConfig(): { majorCountThreshold: number; stallDaysMajor: number; moderateMinCount: number; moderateMaxCount: number } {
  return {
    majorCountThreshold: MAJOR_COUNT_THRESHOLD,
    stallDaysMajor: STALL_DAYS_MAJOR,
    moderateMinCount: MODERATE_MIN_COUNT,
    moderateMaxCount: MODERATE_MAX_COUNT,
  };
}