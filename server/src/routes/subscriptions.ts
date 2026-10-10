import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getDb, runInTransaction } from '../db/database.js';
import { nowISO, now } from '../engines/clock.js';
import { randomUUID } from 'crypto';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validate.js';

const router = Router();

const subscriptionSchema = z.object({
  kind: z.enum(['ward', 'circle', 'road']),
  ward: z.string().optional().nullable(),
  center_lat: z.number().min(-90).max(90).optional().nullable(),
  center_lng: z.number().min(-180).max(180).optional().nullable(),
  radius_m: z.number().min(100).max(50000).optional().nullable(),
  road_name: z.string().optional().nullable(),
}).refine(data => {
  if (data.kind === 'ward') return !!data.ward;
  if (data.kind === 'circle') return data.center_lat !== null && data.center_lng !== null && data.radius_m !== null;
  if (data.kind === 'road') return !!data.road_name;
  return false;
}, { message: 'Invalid subscription parameters for kind' });

const subscriptionListQuery = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

// GET /api/subscriptions - List user's subscriptions
router.get('/', authMiddleware, validateQuery(subscriptionListQuery), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { page, limit } = req.query as any;
    const db = getDb();
    
    const countResult = db.prepare('SELECT COUNT(*) as total FROM subscriptions WHERE user_id = ?').get(user.id) as { total: number };
    const offset = (page - 1) * limit;
    
    const subscriptions = db.prepare(`
      SELECT * FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?
    `).all(user.id, limit, offset);
    
    res.json({ data: subscriptions, pagination: { page, limit, total: countResult.total, totalPages: Math.ceil(countResult.total / limit) } });
  } catch (error) {
    console.error('List subscriptions error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to list subscriptions' } });
  }
});

// POST /api/subscriptions - Create subscription
router.post('/', authMiddleware, validateBody(subscriptionSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const db = getDb();
    
    // Check for duplicate
    const existing = db.prepare(`
      SELECT id FROM subscriptions 
      WHERE user_id = ? AND kind = ? 
      AND (ward = ? OR center_lat = ? OR road_name = ?)
    `).get(user.id, req.body.kind, req.body.ward || null, req.body.center_lat || null, req.body.road_name || null);
    
    if (existing) {
      return res.status(409).json({ error: { code: 'DUPLICATE', message: 'Subscription already exists' } });
    }
    
    const id = randomUUID();
    const createdAt = nowISO();
    
    runInTransaction((tx) => {
      tx.prepare(`
        INSERT INTO subscriptions (id, user_id, kind, ward, center_lat, center_lng, radius_m, road_name, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, user.id, req.body.kind, req.body.ward || null, req.body.center_lat || null, req.body.center_lng || null, req.body.radius_m || null, req.body.road_name || null, createdAt);
    });
    
    const subscription = db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(id);
    res.status(201).json({ subscription });
  } catch (error) {
    console.error('Create subscription error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to create subscription' } });
  }
});

// DELETE /api/subscriptions/:id - Delete subscription
router.delete('/:id', authMiddleware, validateParams(z.object({ id: z.string().uuid() })), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const db = getDb();
    
    const subscription = db.prepare('SELECT * FROM subscriptions WHERE id = ? AND user_id = ?').get(req.params.id, user.id);
    if (!subscription) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Subscription not found' } });
    }
    
    db.prepare('DELETE FROM subscriptions WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete subscription error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to delete subscription' } });
  }
});

// GET /api/disruptions - Roads with upcoming work (for Avoid This Road)
router.get('/disruptions', validateQuery(z.object({ days: z.coerce.number().min(1).max(90).default(7) })), async (req: Request, res: Response) => {
  try {
    const { days } = req.query as any;
    const db = getDb();
    const futureDate = new Date(now().getTime() + days * 24 * 60 * 60 * 1000).toISOString();
    
    const disruptions = db.prepare(`
      SELECT p.id, p.title, p.road_name, p.ward, p.lat, p.lng, p.status, p.start_date, p.planned_end,
             d.name as department_name, d.code as department_code
      FROM projects p
      JOIN departments d ON d.id = p.department_id
      WHERE p.road_name IS NOT NULL
      AND p.status IN ('planned', 'in_progress')
      AND p.planned_end >= datetime('now')
      AND p.planned_end <= ?
      ORDER BY p.planned_end ASC
    `).all(futureDate) as any[];
    
    // Group by road
    const byRoad = new Map<string, any[]>();
    for (const d of disruptions) {
      if (!byRoad.has(d.road_name)) byRoad.set(d.road_name, []);
      byRoad.get(d.road_name)!.push(d);
    }
    
    const roads = Array.from(byRoad.entries()).map(([road_name, projects]) => ({
      road_name,
      projects,
      earliest_start: projects.reduce((min, p) => p.start_date && p.start_date < min ? p.start_date : min, projects[0].start_date),
      latest_end: projects.reduce((max, p) => p.planned_end && p.planned_end > max ? p.planned_end : max, projects[0].planned_end),
    }));
    
    res.json({ disruptions: roads });
  } catch (error) {
    console.error('Get disruptions error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to get disruptions' } });
  }
});

export default router;