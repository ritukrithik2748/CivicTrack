import { getDb, runInTransaction } from '../db/database.js';
import { nowISO, now, haversineDistance } from './clock.js';
import { randomUUID } from 'crypto';

const VERIFY_RADIUS_M = 200;
const MAX_ACCURACY_M = 50;
const QUORUM_THRESHOLD = 3;
const DAILY_VERIFICATION_CAP = 20;

export interface VerificationResult {
  success: boolean;
  message: string;
  verificationId?: string;
  quorumReached?: boolean;
  disputed?: boolean;
}

export function verifyProject(
  userId: string,
  projectId: string,
  statusType: 'in_progress' | 'completed',
  lat: number,
  lng: number,
  accuracyM: number,
  photoPath: string | null,
  photoSha256: string | null
): VerificationResult {
  // Check user is verified citizen
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
  if (!user) return { success: false, message: 'User not found' };
  if (user.role !== 'citizen') return { success: false, message: 'Only citizens can verify projects' };
  if (!user.verified) return { success: false, message: 'Account not verified' };
  
  // Check project exists
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId) as any;
  if (!project) return { success: false, message: 'Project not found' };
  
  // Check user is not from project's department
  if (user.department_id && user.department_id === project.department_id) {
    return { success: false, message: 'Department staff cannot verify their own department\'s projects' };
  }
  
  // Check daily cap
  const today = new Date().toISOString().split('T')[0];
  const todayCount = db.prepare(`
    SELECT COUNT(*) as cnt FROM verifications
    WHERE user_id = ? AND date(created_at) = ?
  `).get(userId, today) as { cnt: number };
  if (todayCount.cnt >= DAILY_VERIFICATION_CAP) {
    return { success: false, message: `Daily verification limit (${DAILY_VERIFICATION_CAP}) reached` };
  }
  
  // Check accuracy
  if (accuracyM > MAX_ACCURACY_M) {
    return { success: false, message: `GPS accuracy ${Math.round(accuracyM)}m exceeds maximum ${MAX_ACCURACY_M}m. Please move to a location with better signal.` };
  }
  
  // Check distance to project
  const distanceM = haversineDistance(lat, lng, project.lat, project.lng);
  if (distanceM > VERIFY_RADIUS_M) {
    return { success: false, message: `You are ${Math.round(distanceM)}m from the project site. Maximum allowed distance is ${VERIFY_RADIUS_M}m.` };
  }
  
  // Check photo provided
  if (!photoPath) {
    return { success: false, message: 'A geotagged photo is required for verification' };
  }
  
  // Check duplicate verification
  const existing = db.prepare(`
    SELECT * FROM verifications WHERE user_id = ? AND project_id = ? AND status_type = ?
  `).get(userId, projectId, statusType);
  if (existing) {
    return { success: false, message: `You have already verified this project as ${statusType}` };
  }
  
  // Create verification
  const verificationId = randomUUID();
  const createdAt = nowISO();
  
  runInTransaction((tx) => {
    tx.prepare(`
      INSERT INTO verifications (id, user_id, project_id, status_type, lat, lng, accuracy_m, distance_m, photo_path, sha256, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(verificationId, userId, projectId, statusType, lat, lng, accuracyM, distanceM, photoPath, photoSha256, createdAt);
    
    // Audit log
    tx.prepare(`
      INSERT INTO audit_log (id, actor_id, action, entity, entity_id, detail_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(randomUUID(), userId, 'verify', 'project', projectId, JSON.stringify({ status_type: statusType, distance_m: distanceM, accuracy_m: accuracyM }), createdAt);
  });
  
  // Check quorum
  const verificationCount = db.prepare(`
    SELECT COUNT(DISTINCT user_id) as cnt FROM verifications
    WHERE project_id = ? AND status_type = ?
  `).get(projectId, statusType) as { cnt: number };
  
  const quorumReached = verificationCount.cnt >= QUORUM_THRESHOLD;
  let disputed = false;
  
  if (quorumReached) {
    // Check if citizen verification disagrees with claimed_status
    const claimedStatus = project.claimed_status;
    const citizenStatus = statusType;
    
    if ((claimedStatus === 'completed' && citizenStatus === 'in_progress') ||
        (claimedStatus === 'in_progress' && citizenStatus === 'completed')) {
      disputed = true;
      
      // Update project to disputed
      db.prepare(`
        UPDATE projects SET status = 'disputed', updated_at = ? WHERE id = ?
      `).run(nowISO(), projectId);
      
      // Notify department officers
      const officers = db.prepare('SELECT id FROM users WHERE department_id = ? AND role = \'officer\'').all(project.department_id) as { id: string }[];
      for (const officer of officers) {
        db.prepare(`
          INSERT INTO notifications (id, user_id, type, title, body, link, read, created_at)
          VALUES (?, ?, ?, ?, ?, ?, 0, ?)
        `).run(randomUUID(), officer.id, 'dispute', 'Project Status Disputed',
          `Citizens have verified "${citizenStatus}" but contractor claims "${claimedStatus}".`, `/projects/${projectId}`, nowISO());
      }
    }
  }
  
  return { success: true, message: 'Verification submitted successfully', verificationId, quorumReached, disputed };
}

export function getProjectVerifications(projectId: string): any[] {
  const db = getDb();
  return db.prepare(`
    SELECT v.*, u.name as user_name
    FROM verifications v
    JOIN users u ON u.id = v.user_id
    WHERE v.project_id = ?
    ORDER BY v.created_at DESC
  `).all(projectId);
}

export function getVerificationStatus(projectId: string): { in_progress: { count: number; quorum: boolean }; completed: { count: number; quorum: boolean }; disputed: boolean } {
  const db = getDb();
  const project = db.prepare('SELECT claimed_status, status FROM projects WHERE id = ?').get(projectId) as any;
  
  const inProgressCount = db.prepare(`
    SELECT COUNT(DISTINCT user_id) as cnt FROM verifications WHERE project_id = ? AND status_type = 'in_progress'
  `).get(projectId) as { cnt: number };
  
  const completedCount = db.prepare(`
    SELECT COUNT(DISTINCT user_id) as cnt FROM verifications WHERE project_id = ? AND status_type = 'completed'
  `).get(projectId) as { cnt: number };
  
  return {
    in_progress: { count: inProgressCount.cnt, quorum: inProgressCount.cnt >= QUORUM_THRESHOLD },
    completed: { count: completedCount.cnt, quorum: completedCount.cnt >= QUORUM_THRESHOLD },
    disputed: project?.status === 'disputed',
  };
}

export function getVerificationConfig(): { radiusM: number; maxAccuracyM: number; quorumThreshold: number; dailyCap: number } {
  return { radiusM: VERIFY_RADIUS_M, maxAccuracyM: MAX_ACCURACY_M, quorumThreshold: QUORUM_THRESHOLD, dailyCap: DAILY_VERIFICATION_CAP };
}