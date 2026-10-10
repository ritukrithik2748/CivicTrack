import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getDb, runInTransaction } from '../db/database.js';
import { nowISO, now } from '../engines/clock.js';
import { randomUUID } from 'crypto';
import { authMiddleware, AuthenticatedRequest, requireOfficerOrAdmin, requireAdmin } from '../middleware/auth.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validate.js';
import { findConflictsForProject, getConflictsForProject, getAllConflicts, resolveConflict } from '../engines/conflicts.js';

const router = Router();

const resolveConflictSchema = z.object({
  status: z.enum(['acknowledged', 'resolved', 'merged']),
});

// GET /api/conflicts - List all conflicts
router.get('/', authMiddleware, requireOfficerOrAdmin, validateQuery(z.object({ page: z.coerce.number().min(1).default(1), limit: z.coerce.number().min(1).max(100).default(50) })), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { page, limit } = req.query as any;
    const db = getDb();
    const offset = (page - 1) * limit;
    
    const conflicts = db.prepare(`
      SELECT c.*, p1.title as project_a_title, p1.road_name as project_a_road, p1.ward as project_a_ward,
             p2.title as project_b_title, p2.road_name as project_b_road, p2.ward as project_b_ward
      FROM conflicts c
      JOIN projects p1 ON p1.id = c.project_a
      JOIN projects p2 ON p2.id = c.project_b
      WHERE c.status = 'open'
      ORDER BY c.created_at DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset);
    
    res.json({ data: conflicts });
  } catch (error) {
    console.error('List conflicts error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to list conflicts' } });
  }
});

// GET /api/conflicts/:projectId - Get conflicts for a project
router.get('/:projectId', validateParams(z.object({ projectId: z.string().uuid() })), async (req: Request, res: Response) => {
  try {
    const conflicts = getConflictsForProject(req.params.projectId);
    res.json({ conflicts });
  } catch (error) {
    console.error('Get project conflicts error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to get project conflicts' } });
  }
});

// POST /api/conflicts/check - Check conflicts for a project (before save)
router.post('/check', authMiddleware, requireOfficerOrAdmin, validateBody(z.object({ project_id: z.string().uuid() })), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const conflicts = findConflictsForProject(req.body.project_id);
    res.json({ conflicts, has_conflicts: conflicts.length > 0 });
  } catch (error) {
    console.error('Check conflicts error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to check conflicts' } });
  }
});

// PATCH /api/conflicts/:id - Resolve conflict (admin)
router.patch('/:id', authMiddleware, requireAdmin, validateParams(z.object({ id: z.string().uuid() })), validateBody(resolveConflictSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    resolveConflict(req.params.id, req.body.status, req.user!.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Resolve conflict error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to resolve conflict' } });
  }
});

export default router;