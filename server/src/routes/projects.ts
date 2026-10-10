import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getDb, runInTransaction } from '../db/database.js';
import { nowISO, now, haversineDistance } from '../engines/clock.js';
import { randomUUID } from 'crypto';
import { authMiddleware, AuthenticatedRequest, requireOfficerOrAdmin, requireAdmin, canAccessProject } from '../middleware/auth.js';
import { validateBody, validateQuery, validateParams } from '../middleware/validate.js';

const router = Router();

const projectSchema = z.object({
  title: z.string().min(3).max(200),
  purpose: z.string().optional(),
  department_id: z.string().uuid(),
  contractor_id: z.string().uuid().optional().nullable(),
  road_name: z.string().optional().nullable(),
  ward: z.string().optional().nullable(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  status: z.enum(['planned', 'in_progress', 'completed', 'delayed', 'disputed']).default('planned'),
  start_date: z.string().datetime().optional().nullable(),
  planned_end: z.string().datetime().optional().nullable(),
  sanctioned_budget: z.number().min(0).default(0),
  maintenance_budget: z.number().min(0).default(0),
});

const projectUpdateSchema = projectSchema.partial().extend({
  reason: z.string().optional(), // Required for planned_end changes
});

const projectListQuery = z.object({
  ward: z.string().optional(),
  department: z.string().optional(),
  status: z.string().optional(),
  severity: z.string().optional(),
  q: z.string().optional(),
  bbox: z.string().optional(), // minLat,minLng,maxLat,maxLng
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

// GET /api/projects - List projects with filters
router.get('/', validateQuery(projectListQuery), async (req: Request, res: Response) => {
  try {
    const { ward, department, status, severity, q, bbox, page, limit } = req.query as any;
    const db = getDb();
    
    let where = 'WHERE 1=1';
    const params: any[] = [];
    
    if (ward) {
      where += ' AND p.ward = ?';
      params.push(ward);
    }
    if (department) {
      where += ' AND p.department_id = ?';
      params.push(department);
    }
    if (status) {
      where += ' AND p.status = ?';
      params.push(status);
    }
    if (q) {
      where += ' AND (p.title LIKE ? OR p.purpose LIKE ? OR p.road_name LIKE ?)';
      const searchTerm = `%${q}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }
    if (bbox) {
      const [minLat, minLng, maxLat, maxLng] = bbox.split(',').map(Number);
      where += ' AND p.lat BETWEEN ? AND ? AND p.lng BETWEEN ? AND ?';
      params.push(minLat, maxLat, minLng, maxLng);
    }
    
    // Get total count
    const countResult = db.prepare(`SELECT COUNT(*) as total FROM projects p ${where}`).get(...params) as { total: number };
    
    // Get paginated results
    const offset = (page - 1) * limit;
    const projects = db.prepare(`
      SELECT p.*, d.name as department_name, d.code as department_code, c.name as contractor_name
      FROM projects p
      JOIN departments d ON d.id = p.department_id
      LEFT JOIN contractors c ON c.id = p.contractor_id
      ${where}
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);
    
    res.json({
      data: projects,
      pagination: { page, limit, total: countResult.total, totalPages: Math.ceil(countResult.total / limit) },
    });
  } catch (error) {
    console.error('List projects error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to list projects' } });
  }
});

// GET /api/projects/:id - Get single project
router.get('/:id', validateParams(z.object({ id: z.string().uuid() })), async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const project = db.prepare(`
      SELECT p.*, d.name as department_name, d.code as department_code, c.name as contractor_name
      FROM projects p
      JOIN departments d ON d.id = p.department_id
      LEFT JOIN contractors c ON c.id = p.contractor_id
      WHERE p.id = ?
    `).get(req.params.id);
    
    if (!project) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Project not found' } });
    }
    
    res.json({ project });
  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to get project' } });
  }
});

// POST /api/projects - Create project (officer/admin)
router.post('/', authMiddleware, requireOfficerOrAdmin, validateBody(projectSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDb();
    const user = req.user!;
    
    // Check department access
    if (user.role === 'officer' && user.department_id !== req.body.department_id) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Cannot create project for another department' } });
    }
    
    const id = randomUUID();
    const now = nowISO();
    
    runInTransaction((tx) => {
      tx.prepare(`
        INSERT INTO projects (id, title, purpose, department_id, contractor_id, road_name, ward, lat, lng, status, claimed_status, start_date, planned_end, sanctioned_budget, maintenance_budget, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'planned', ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, req.body.title, req.body.purpose || null, req.body.department_id, req.body.contractor_id || null,
        req.body.road_name || null, req.body.ward || null, req.body.lat, req.body.lng, req.body.status,
        req.body.start_date || null, req.body.planned_end || null, req.body.sanctioned_budget,
        req.body.maintenance_budget, user.id, now, now
      );
      
      // Audit log
      tx.prepare(`
        INSERT INTO audit_log (id, actor_id, action, entity, entity_id, detail_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(randomUUID(), user.id, 'create', 'project', id, JSON.stringify(req.body), now);
    });
    
    // Check for conflicts
    const { findConflictsForProject } = await import('../engines/conflicts.js');
    const conflicts = findConflictsForProject(id);
    
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    res.status(201).json({ project, conflicts, warning: conflicts.length > 0 ? 'Dig-once conflicts detected' : undefined });
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to create project' } });
  }
});

// PATCH /api/projects/:id - Update project (officer/admin)
router.patch('/:id', authMiddleware, requireOfficerOrAdmin, validateParams(z.object({ id: z.string().uuid() })), validateBody(projectUpdateSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDb();
    const user = req.user!;
    const projectId = req.params.id;
    
    const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId) as any;
    if (!existing) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Project not found' } });
    }
    
    // Check department access
    if (user.role === 'officer' && user.department_id !== existing.department_id) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Cannot update project from another department' } });
    }
    
    const updates: string[] = [];
    const params: any[] = [];
    
    const allowedFields = ['title', 'purpose', 'contractor_id', 'road_name', 'ward', 'lat', 'lng', 'status', 'start_date', 'planned_end', 'sanctioned_budget', 'maintenance_budget'];
    
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = ?`);
        params.push(req.body[field]);
      }
    }
    
    // Special handling for planned_end change - requires reason
    if (req.body.planned_end && req.body.planned_end !== existing.planned_end) {
      if (!req.body.reason) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Reason required for deadline change', fields: [{ field: 'reason', message: 'Delay reason is required when changing planned end date' }] } });
      }
      
      // Record delay
      const delayId = randomUUID();
      db.prepare(`
        INSERT INTO project_delays (id, project_id, old_end, new_end, reason, changed_by, changed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(delayId, projectId, existing.planned_end || '', req.body.planned_end, req.body.reason, user.id, nowISO());
      
      // Update project status to delayed if not already
      if (existing.status !== 'delayed' && existing.status !== 'completed') {
        updates.push('status = ?');
        params.push('delayed');
      }
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'No valid fields to update' } });
    }
    
    updates.push('updated_at = ?');
    params.push(nowISO());
    params.push(projectId);
    
    runInTransaction((tx) => {
      tx.prepare(`UPDATE projects SET ${updates.join(', ')} WHERE id = ?`).run(...params);
      
      // Audit log
      tx.prepare(`
        INSERT INTO audit_log (id, actor_id, action, entity, entity_id, detail_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(randomUUID(), user.id, 'update', 'project', projectId, JSON.stringify(req.body), nowISO());
    });
    
    // Re-check conflicts if dates or location changed
    if (req.body.planned_end || req.body.start_date || req.body.lat || req.body.lng || req.body.road_name) {
      const { findConflictsForProject } = await import('../engines/conflicts.js');
      const conflicts = findConflictsForProject(projectId);
      
      const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
      return res.json({ project, conflicts, warning: conflicts.length > 0 ? 'Dig-once conflicts detected' : undefined });
    }
    
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    res.json({ project });
  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to update project' } });
  }
});

// GET /api/projects/:id/timeline - Get project timeline
router.get('/:id/timeline', validateParams(z.object({ id: z.string().uuid() })), async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const updates = db.prepare(`
      SELECT pu.*, u.name as created_by_name
      FROM project_updates pu
      JOIN users u ON u.id = pu.created_by
      WHERE pu.project_id = ?
      ORDER BY pu.created_at ASC
    `).all(req.params.id);
    
    res.json({ timeline: updates });
  } catch (error) {
    console.error('Get timeline error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to get timeline' } });
  }
});

// GET /api/projects/:id/delays - Get project delay history
router.get('/:id/delays', validateParams(z.object({ id: z.string().uuid() })), async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const delays = db.prepare(`
      SELECT pd.*, u.name as changed_by_name
      FROM project_delays pd
      JOIN users u ON u.id = pd.changed_by
      WHERE pd.project_id = ?
      ORDER BY pd.changed_at DESC
    `).all(req.params.id);
    
    res.json({ delays });
  } catch (error) {
    console.error('Get delays error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to get delays' } });
  }
});

export default router;