import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getDb, runInTransaction } from '../db/database.js';
import { nowISO, now } from '../engines/clock.js';
import { randomUUID } from 'crypto';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validate.js';

const router = Router();

const notificationListQuery = z.object({
  read: z.coerce.boolean().optional(),
  type: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

// GET /api/notifications - List user's notifications
router.get('/', authMiddleware, validateQuery(notificationListQuery), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { read, type, page, limit } = req.query as any;
    const db = getDb();
    
    let where = 'WHERE user_id = ?';
    const params: any[] = [user.id];
    
    if (read !== undefined) {
      where += ' AND read = ?';
      params.push(read ? 1 : 0);
    }
    if (type) {
      where += ' AND type = ?';
      params.push(type);
    }
    
    const countResult = db.prepare(`SELECT COUNT(*) as total FROM notifications ${where}`).get(...params) as { total: number };
    const offset = (page - 1) * limit;
    
    const notifications = db.prepare(`
      SELECT * FROM notifications ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?
    `).all(...params, limit, offset);
    
    const unreadCount = db.prepare('SELECT COUNT(*) as cnt FROM notifications WHERE user_id = ? AND read = 0').get(user.id) as { cnt: number };
    
    res.json({ data: notifications, pagination: { page, limit, total: countResult.total, totalPages: Math.ceil(countResult.total / limit) }, unread_count: unreadCount.cnt });
  } catch (error) {
    console.error('List notifications error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to list notifications' } });
  }
});

// POST /api/notifications/:id/read - Mark notification as read
router.post('/:id/read', authMiddleware, validateParams(z.object({ id: z.string().uuid() })), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const db = getDb();
    
    const notification = db.prepare('SELECT * FROM notifications WHERE id = ? AND user_id = ?').get(req.params.id, user.id);
    if (!notification) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Notification not found' } });
    }
    
    db.prepare('UPDATE notifications SET read = 1 WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to mark notification as read' } });
  }
});

// POST /api/notifications/read-all - Mark all as read
router.post('/read-all', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const db = getDb();
    
    db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').run(user.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Mark all read error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to mark all notifications as read' } });
  }
});

export default router;