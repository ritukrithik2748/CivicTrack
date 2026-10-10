import { getDb, runInTransaction } from '../db/database.js';
import { nowISO } from './clock.js';
import { randomUUID } from 'crypto';

export const CLUSTER_RADIUS_M = 50;

interface ReportForClustering {
  id: string;
  lat: number;
  lng: number;
  category: string;
  department_id: string;
  status: string;
  weight: number;
  created_at: string;
}

interface Spot {
  id: string;
  lat: number;
  lng: number;
  radius_m: number;
  label: string | null;
  created_at: string;
}

interface ProblemGroup {
  id: string;
  spot_id: string;
  category: string;
  department_id: string;
  severity: string;
  report_count: number;
  weighted_count: number;
  status: string;
  first_reported_at: string;
  last_reported_at: string;
  stalled_since: string | null;
  severity_reason: string | null;
  created_at: string;
  updated_at: string;
}

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // Earth radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * Math.PI / 180;
}

function getBoundingBox(lat: number, lng: number, radiusM: number): { minLat: number; maxLat: number; minLng: number; maxLng: number } {
  const latDelta = radiusM / 111000; // ~111km per degree latitude
  const lngDelta = radiusM / (111000 * Math.cos(toRad(lat)));
  return {
    minLat: lat - latDelta,
    maxLat: lat + latDelta,
    minLng: lng - lngDelta,
    maxLng: lng + lngDelta,
  };
}

export function findNearbySpot(lat: number, lng: number, radiusM: number = CLUSTER_RADIUS_M): Spot | null {
  const db = getDb();
  const bbox = getBoundingBox(lat, lng, radiusM);
  
  const spots = db.prepare(`
    SELECT * FROM spots
    WHERE lat BETWEEN ? AND ? AND lng BETWEEN ? AND ?
  `).all(bbox.minLat, bbox.maxLat, bbox.minLng, bbox.maxLng) as Spot[];
  
  for (const spot of spots) {
    const distance = haversineDistance(lat, lng, spot.lat, spot.lng);
    if (distance <= radiusM) {
      return spot;
    }
  }
  
  return null;
}

export function createSpot(lat: number, lng: number, radiusM: number = CLUSTER_RADIUS_M, label?: string): Spot {
  const db = getDb();
  const id = randomUUID();
  const now = nowISO();
  
  db.prepare(`
    INSERT INTO spots (id, lat, lng, radius_m, label, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, lat, lng, radiusM, label || null, now);
  
  return { id, lat, lng, radius_m: radiusM, label: label || null, created_at: now };
}

export function getOrCreateSpot(lat: number, lng: number, radiusM: number = CLUSTER_RADIUS_M): Spot {
  const existing = findNearbySpot(lat, lng, radiusM);
  if (existing) return existing;
  return createSpot(lat, lng, radiusM);
}

export function getReportsForClustering(departmentId?: string): ReportForClustering[] {
  const db = getDb();
  let query = `
    SELECT id, lat, lng, category, department_id, status, weight, created_at
    FROM reports
    WHERE status IN ('open', 'acknowledged', 'in_progress', 'reopened')
  `;
  const params: (string | number)[] = [];
  
  if (departmentId) {
    query += ' AND department_id = ?';
    params.push(departmentId);
  }
  
  query += ' ORDER BY created_at ASC';
  return db.prepare(query).all(...params) as ReportForClustering[];
}

export function getSpotReports(spotId: string): ReportForClustering[] {
  const db = getDb();
  return db.prepare(`
    SELECT r.id, r.lat, r.lng, r.category, r.department_id, r.status, r.weight, r.created_at
    FROM reports r
    WHERE r.group_id IN (SELECT id FROM problem_groups WHERE spot_id = ?)
    AND r.status IN ('open', 'acknowledged', 'in_progress', 'reopened')
    ORDER BY r.created_at ASC
  `).all(spotId) as ReportForClustering[];
}

export function clusterReports(): { spotsCreated: number; groupsCreated: number; groupsUpdated: number } {
  const db = getDb();
  let spotsCreated = 0;
  let groupsCreated = 0;
  let groupsUpdated = 0;
  
  // Get all open reports that need clustering
  const reports = getReportsForClustering();
  
  // Group reports by spot
  const spotMap = new Map<string, ReportForClustering[]>();
  
  for (const report of reports) {
    const spot = getOrCreateSpot(report.lat, report.lng);
    if (!spotMap.has(spot.id)) {
      spotMap.set(spot.id, []);
    }
    spotMap.get(spot.id)!.push(report);
    
    // Update report's group_id later
  }
  
  // For each spot, group by category
  for (const [spotId, spotReports] of spotMap) {
    const categoryMap = new Map<string, ReportForClustering[]>();
    
    for (const report of spotReports) {
      if (!categoryMap.has(report.category)) {
        categoryMap.set(report.category, []);
      }
      categoryMap.get(report.category)!.push(report);
    }
    
    for (const [category, catReports] of categoryMap) {
      const departmentId = catReports[0].department_id;
      const firstReported = catReports[0].created_at;
      const lastReported = catReports[catReports.length - 1].created_at;
      const reportCount = catReports.length;
      const weightedCount = catReports.reduce((sum, r) => sum + r.weight, 0);
      
      // Check if group already exists
      const existingGroup = db.prepare(`
        SELECT * FROM problem_groups WHERE spot_id = ? AND category = ?
      `).get(spotId, category) as ProblemGroup | undefined;
      
      if (existingGroup) {
        // Update existing group
        db.prepare(`
          UPDATE problem_groups
          SET report_count = ?, weighted_count = ?, last_reported_at = ?, updated_at = ?
          WHERE id = ?
        `).run(reportCount, weightedCount, lastReported, nowISO(), existingGroup.id);
        groupsUpdated++;
      } else {
        // Create new group
        const groupId = randomUUID();
        const now = nowISO();
        db.prepare(`
          INSERT INTO problem_groups (id, spot_id, category, department_id, severity, report_count, weighted_count, status, first_reported_at, last_reported_at, created_at, updated_at)
          VALUES (?, ?, ?, ?, 'minor', ?, ?, 'open', ?, ?, ?, ?)
        `).run(groupId, spotId, category, departmentId, reportCount, weightedCount, firstReported, lastReported, now, now);
        groupsCreated++;
      }
      
      // Update reports' group_id
      const group = db.prepare('SELECT id FROM problem_groups WHERE spot_id = ? AND category = ?').get(spotId, category) as { id: string } | undefined;
      if (group) {
        for (const report of catReports) {
          db.prepare('UPDATE reports SET group_id = ?, updated_at = ? WHERE id = ?').run(group.id, nowISO(), report.id);
        }
      }
    }
  }
  
  // Clean up empty spots and groups
  cleanupEmptySpotsAndGroups();
  
  return { spotsCreated, groupsCreated, groupsUpdated };
}

function cleanupEmptySpotsAndGroups(): void {
  const db = getDb();
  
  // Delete groups with no reports
  const emptyGroups = db.prepare(`
    SELECT pg.id FROM problem_groups pg
    LEFT JOIN reports r ON r.group_id = pg.id
    WHERE r.id IS NULL
  `).all() as { id: string }[];
  
  for (const g of emptyGroups) {
    db.prepare('DELETE FROM problem_groups WHERE id = ?').run(g.id);
  }
  
  // Delete spots with no groups
  const emptySpots = db.prepare(`
    SELECT s.id FROM spots s
    LEFT JOIN problem_groups pg ON pg.spot_id = s.id
    WHERE pg.id IS NULL
  `).all() as { id: string }[];
  
  for (const s of emptySpots) {
    db.prepare('DELETE FROM spots WHERE id = ?').run(s.id);
  }
}

export function reclusterOnReportChange(reportId: string): void {
  const db = getDb();
  const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(reportId) as ReportForClustering | undefined;
  if (!report) return;
  
  // Recluster the spot this report belongs to
  const spot = findNearbySpot(report.lat, report.lng);
  if (!spot) return;
  
  // Get all reports in this spot
  const spotReports = getSpotReports(spot.id);
  
  // Group by category
  const categoryMap = new Map<string, ReportForClustering[]>();
  for (const r of spotReports) {
    if (!categoryMap.has(r.category)) {
      categoryMap.set(r.category, []);
    }
    categoryMap.get(r.category)!.push(r);
  }
  
  // Update or create groups
  for (const [category, catReports] of categoryMap) {
    const departmentId = catReports[0].department_id;
    const firstReported = catReports[0].created_at;
    const lastReported = catReports[catReports.length - 1].created_at;
    const reportCount = catReports.length;
    const weightedCount = catReports.reduce((sum, r) => sum + r.weight, 0);
    
    const existingGroup = db.prepare(`
      SELECT * FROM problem_groups WHERE spot_id = ? AND category = ?
    `).get(spot.id, category) as ProblemGroup | undefined;
    
    if (existingGroup) {
      db.prepare(`
        UPDATE problem_groups
        SET report_count = ?, weighted_count = ?, last_reported_at = ?, updated_at = ?
        WHERE id = ?
      `).run(reportCount, weightedCount, lastReported, nowISO(), existingGroup.id);
    } else {
      const groupId = randomUUID();
      const now = nowISO();
      db.prepare(`
        INSERT INTO problem_groups (id, spot_id, category, department_id, severity, report_count, weighted_count, status, first_reported_at, last_reported_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'minor', ?, ?, 'open', ?, ?, ?, ?)
      `).run(groupId, spot.id, category, departmentId, reportCount, weightedCount, firstReported, lastReported, now, now);
    }
  }
  
  // Remove groups that no longer have reports
  const currentCategories = Array.from(categoryMap.keys());
  const allGroups = db.prepare('SELECT id, category FROM problem_groups WHERE spot_id = ?').all(spot.id) as { id: string; category: string }[];
  
  for (const g of allGroups) {
    if (!currentCategories.includes(g.category)) {
      db.prepare('DELETE FROM problem_groups WHERE id = ?').run(g.id);
    }
  }
  
  cleanupEmptySpotsAndGroups();
}

export function getClusterRadius(): number {
  return CLUSTER_RADIUS_M;
}