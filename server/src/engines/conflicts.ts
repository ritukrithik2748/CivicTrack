import { getDb, runInTransaction } from '../db/database.js';
import { nowISO, haversineDistance } from './clock.js';
import { randomUUID } from 'crypto';

const CONFLICT_RADIUS_M = 100;
const CONFLICT_MONTHS = 6;

interface ProjectForConflict {
  id: string;
  title: string;
  department_id: string;
  road_name: string | null;
  lat: number;
  lng: number;
  status: string;
  start_date: string | null;
  planned_end: string | null;
  actual_end: string | null;
}

export function findConflictsForProject(projectId: string, excludeCompleted: boolean = false): any[] {
  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId) as ProjectForConflict | undefined;
  if (!project) return [];
  
  let statusFilter = "status IN ('planned', 'in_progress')";
  if (!excludeCompleted) {
    const sixMonthsAgo = new Date(Date.now() - CONFLICT_MONTHS * 30 * 24 * 60 * 60 * 1000).toISOString();
    statusFilter += ` OR (status = 'completed' AND actual_end >= '${sixMonthsAgo}')`;
  }
  
  const otherProjects = db.prepare(`
    SELECT * FROM projects
    WHERE id != ? AND ${statusFilter}
  `).all(projectId) as ProjectForConflict[];
  
  const conflicts: any[] = [];
  
  for (const other of otherProjects) {
    let distanceM: number | null = null;
    let gapDays: number | null = null;
    let suggestion = '';
    let hasConflict = false;
    
    // Check road name match
    if (project.road_name && other.road_name && project.road_name === other.road_name) {
      hasConflict = true;
      suggestion = `Same road: ${project.road_name}. `;
    }
    
    // Check distance
    const distance = haversineDistance(project.lat, project.lng, other.lat, other.lng);
    if (distance <= CONFLICT_RADIUS_M) {
      hasConflict = true;
      distanceM = distance;
      suggestion += `Locations within ${Math.round(distance)}m. `;
    }
    
    // Check date overlap
    if (project.start_date && project.planned_end && other.start_date && other.planned_end) {
      const projectStart = new Date(project.start_date).getTime();
      const projectEnd = new Date(project.planned_end).getTime();
      const otherStart = new Date(other.start_date).getTime();
      const otherEnd = new Date(other.planned_end).getTime();
      
      // Check if windows overlap
      const overlap = projectStart <= otherEnd && otherStart <= projectEnd;
      
      if (overlap) {
        hasConflict = true;
        suggestion += 'Date windows overlap. ';
      } else {
        // Check gap
        const gap = Math.abs(projectStart - otherEnd) / (24 * 60 * 60 * 1000);
        if (gap < 30) { // Less than 30 days gap
          hasConflict = true;
          gapDays = Math.round(gap);
          suggestion += `Gap of ${gapDays} days between projects. `;
        }
      }
    }
    
    if (hasConflict) {
      suggestion += 'Consider merging or sequencing these jobs.';
      
      // Check if conflict already exists
      const existing = db.prepare(`
        SELECT * FROM conflicts 
        WHERE (project_a = ? AND project_b = ?) OR (project_a = ? AND project_b = ?)
      `).get(projectId, other.id, other.id, projectId);
      
      if (!existing) {
        const conflictId = randomUUID();
        db.prepare(`
          INSERT INTO conflicts (id, project_a, project_b, distance_m, gap_days, suggestion, status, created_at)
          VALUES (?, ?, ?, ?, ?, ?, 'open', ?)
        `).run(conflictId, projectId, other.id, distanceM, gapDays, suggestion, nowISO());
        
        conflicts.push({ id: conflictId, project_a: projectId, project_b: other.id, distance_m: distanceM, gap_days: gapDays, suggestion, status: 'open' });
      } else {
        conflicts.push(existing);
      }
    }
  }
  
  return conflicts;
}

export function getConflictsForProject(projectId: string): any[] {
  const db = getDb();
  return db.prepare(`
    SELECT c.*, p1.title as project_a_title, p2.title as project_b_title
    FROM conflicts c
    JOIN projects p1 ON p1.id = c.project_a
    JOIN projects p2 ON p2.id = c.project_b
    WHERE c.project_a = ? OR c.project_b = ?
  `).all(projectId, projectId);
}

export function getAllConflicts(): any[] {
  const db = getDb();
  return db.prepare(`
    SELECT c.*, p1.title as project_a_title, p1.road_name as project_a_road, p2.title as project_b_title, p2.road_name as project_b_road
    FROM conflicts c
    JOIN projects p1 ON p1.id = c.project_a
    JOIN projects p2 ON p2.id = c.project_b
    WHERE c.status = 'open'
    ORDER BY c.created_at DESC
  `).all();
}

export function resolveConflict(conflictId: string, status: 'acknowledged' | 'resolved' | 'merged', userId: string): void {
  const db = getDb();
  db.prepare('UPDATE conflicts SET status = ?, updated_at = datetime(\'now\') WHERE id = ?').run(status, conflictId);
  
  db.prepare(`
    INSERT INTO audit_log (id, actor_id, action, entity, entity_id, detail_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(randomUUID(), userId, 'resolve_conflict', 'conflict', conflictId, JSON.stringify({ status }), nowISO());
}

export function getConflictConfig(): { radiusM: number; months: number } {
  return { radiusM: CONFLICT_RADIUS_M, months: CONFLICT_MONTHS };
}