import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getDb, runInTransaction } from '../db/database.js';
import { nowISO } from '../engines/clock.js';
import { randomUUID } from 'crypto';
import { authMiddleware, AuthenticatedRequest, requireOfficerOrAdmin, canAccessDepartment } from '../middleware/auth.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validate.js';
import { updateGroupSeverity } from '../engines/severity.js';

const router = Router();

const groupListQuery = z.object({
  status: z.string().optional(),
  severity: z.string().optional(),
  department: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
});

const groupStatusSchema = z.object({
  status: z.enum(['open', 'acknowledged', 'in_progress', 'resolved', 'reopened']),
});

// GET /api/groups/public - Public endpoint for citizens to view groups on map
router.get('/public', validateQuery(groupListQuery), async (req: Request, res: Response) => {
  try {
    const { status, severity, department, page, limit } = req.query as any;
    const db = getDb();
    
    let where = 'WHERE pg.status IN (\'open\', \'acknowledged\', \'in_progress\')';
    const params: any[] = [];
    
    if (department) {
      where += ' AND pg.department_id = ?';
      params.push(department);
    }
    
    if (status) {
      where += ' AND pg.status = ?';
      params.push(status);
    }
    if (severity) {
      where += ' AND pg.severity = ?';
      params.push(severity);
    }
    
    // Order by severity, then weighted_count, then age
    const orderBy = 'ORDER BY CASE pg.severity WHEN \'major\' THEN 3 WHEN \'moderate\' THEN 2 ELSE 1 END DESC, pg.weighted_count DESC, pg.first_reported_at ASC';
    
    const countResult = db.prepare(`SELECT COUNT(*) as total FROM problem_groups pg ${where}`).get(...params) as { total: number };
    const offset = (page - 1) * limit;
    
    const groups = db.prepare(`
      SELECT pg.*, s.lat, s.lng, s.radius_m, d.name as department_name, d.code as department_code,
             (SELECT COUNT(*) FROM reports r WHERE r.group_id = pg.id AND r.status IN ('open', 'acknowledged', 'in_progress', 'reopened')) as active_reports
      FROM problem_groups pg
      JOIN spots s ON s.id = pg.spot_id
      JOIN departments d ON d.id = pg.department_id
      ${where}
      ${orderBy}
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);
    
    res.json({ data: groups, pagination: { page, limit, total: countResult.total, totalPages: Math.ceil(countResult.total / limit) } });
  } catch (error) {
    console.error('List public groups error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to list problem groups' } });
  }
});

// GET /api/groups - Officer queue with severity ordering
router.get('/', authMiddleware, requireOfficerOrAdmin, validateQuery(groupListQuery), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { status, severity, department, page, limit } = req.query as any;
    const db = getDb();
    
    let where = 'WHERE pg.status IN (\'open\', \'acknowledged\', \'in_progress\')';
    const params: any[] = [];
    
    // Officers only see their department's groups
    if (user.role === 'officer') {
      where += ' AND pg.department_id = ?';
      params.push(user.department_id);
    } else if (department) {
      where += ' AND pg.department_id = ?';
      params.push(department);
    }
    
    if (status) {
      where += ' AND pg.status = ?';
      params.push(status);
    }
    if (severity) {
      where += ' AND pg.severity = ?';
      params.push(severity);
    }
    
    // Order by severity, then weighted_count, then age
    const orderBy = 'ORDER BY CASE pg.severity WHEN \'major\' THEN 3 WHEN \'moderate\' THEN 2 ELSE 1 END DESC, pg.weighted_count DESC, pg.first_reported_at ASC';
    
    const countResult = db.prepare(`SELECT COUNT(*) as total FROM problem_groups pg ${where}`).get(...params) as { total: number };
    const offset = (page - 1) * limit;
    
    const groups = db.prepare(`
      SELECT pg.*, s.lat, s.lng, s.radius_m, d.name as department_name, d.code as department_code,
             (SELECT COUNT(*) FROM reports r WHERE r.group_id = pg.id AND r.status IN ('open', 'acknowledged', 'in_progress', 'reopened')) as active_reports
      FROM problem_groups pg
      JOIN spots s ON s.id = pg.spot_id
      JOIN departments d ON d.id = pg.department_id
      ${where}
      ${orderBy}
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);
    
    res.json({ data: groups, pagination: { page, limit, total: countResult.total, totalPages: Math.ceil(countResult.total / limit) } });
  } catch (error) {
    console.error('List groups error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to list problem groups' } });
  }
});

// GET /api/groups/:id - Get group detail
router.get('/:id', authMiddleware, validateParams(z.object({ id: z.string().uuid() })), async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const group = db.prepare(`
      SELECT pg.*, s.lat, s.lng, s.radius_m, s.label, d.name as department_name, d.code as department_code
      FROM problem_groups pg
      JOIN spots s ON s.id = pg.spot_id
      JOIN departments d ON d.id = pg.department_id
      WHERE pg.id = ?
    `).get(req.params.id);
    
    if (!group) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Problem group not found' } });
    }
    
    // Get reports in this group
    const reports = db.prepare(`
      SELECT r.*, u.name as user_name, r.location_source, r.location_trust, r.location_flag
      FROM reports r
      JOIN users u ON u.id = r.user_id
      WHERE r.group_id = ?
      ORDER BY r.created_at ASC
    `).all(req.params.id);
    
    // Get photos for all reports
    const reportIds = reports.map((r: any) => r.id);
    let photos: any[] = [];
    if (reportIds.length > 0) {
      const placeholders = reportIds.map(() => '?').join(',');
      photos = db.prepare(`SELECT * FROM report_photos WHERE report_id IN (${placeholders})`).all(...reportIds);
    }
    
    // Get work order item if exists
    const workOrderItem = db.prepare(`
      SELECT woi.*, wo.spot_id, wo.status as work_order_status
      FROM work_order_items woi
      JOIN work_orders wo ON wo.id = woi.work_order_id
      WHERE woi.group_id = ?
    `).get(req.params.id);
    
    res.json({ group, reports, photos, work_order_item: workOrderItem });
  } catch (error) {
    console.error('Get group error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to get problem group' } });
  }
});

// PATCH /api/groups/:id/status - Update group status (officer)
router.patch('/:id/status', authMiddleware, requireOfficerOrAdmin, validateParams(z.object({ id: z.string().uuid() })), validateBody(groupStatusSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const groupId = req.params.id;
    const db = getDb();
    
    const group = db.prepare('SELECT * FROM problem_groups WHERE id = ?').get(groupId) as any;
    if (!group) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Problem group not found' } });
    }
    
    // Check department access
    if (user.role === 'officer' && user.department_id !== group.department_id) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Cannot update group from another department' } });
    }
    
    const createdAt = nowISO();
    
    runInTransaction((tx) => {
      tx.prepare('UPDATE problem_groups SET status = ?, updated_at = ? WHERE id = ?').run(req.body.status, createdAt, groupId);
      
      // Update all reports in this group
      tx.prepare('UPDATE reports SET status = ?, updated_at = ? WHERE group_id = ?').run(req.body.status, createdAt, groupId);
      
      // Audit log
      tx.prepare(`
        INSERT INTO audit_log (id, actor_id, action, entity, entity_id, detail_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(randomUUID(), user.id, 'update_status', 'problem_group', groupId, JSON.stringify({ status: req.body.status }), createdAt);
    });
    
    // Update severity
    updateGroupSeverity(groupId);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Update group status error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to update group status' } });
  }
});

export default router;