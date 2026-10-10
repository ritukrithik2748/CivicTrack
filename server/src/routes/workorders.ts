import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getDb, runInTransaction } from '../db/database.js';
import { nowISO, now } from '../engines/clock.js';
import { randomUUID } from 'crypto';
import { authMiddleware, AuthenticatedRequest, requireOfficerOrAdmin, requireAdmin, canAccessDepartment } from '../middleware/auth.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validate.js';
import { triggerSecondaryOnPrimaryComplete } from '../engines/sequencing.js';

const router = Router();

const workOrderListQuery = z.object({
  status: z.string().optional(),
  department: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
});

const workOrderItemActionSchema = z.object({
  expected_complete_at: z.string().datetime().optional().nullable(),
  delay_reason: z.string().optional().nullable(),
});

const workOrderItemReleaseSchema = z.object({
  action: z.enum(['reassign', 'release_parallel']),
  new_department_id: z.string().uuid().optional(),
});

// GET /api/workorders - List work orders
router.get('/', authMiddleware, requireOfficerOrAdmin, validateQuery(workOrderListQuery), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { status, department, page, limit } = req.query as any;
    const db = getDb();
    
    let where = 'WHERE 1=1';
    const params: any[] = [];
    
    if (user.role === 'officer') {
      // Show work orders that have items for this officer's department
      where += ` AND EXISTS (
        SELECT 1 FROM work_order_items woi 
        WHERE woi.work_order_id = wo.id AND woi.department_id = ?
      )`;
      params.push(user.department_id);
    } else if (department) {
      where += ` AND EXISTS (
        SELECT 1 FROM work_order_items woi 
        WHERE woi.work_order_id = wo.id AND woi.department_id = ?
      )`;
      params.push(department);
    }
    
    if (status) {
      where += ' AND wo.status = ?';
      params.push(status);
    }
    
    const countResult = db.prepare(`SELECT COUNT(*) as total FROM work_orders wo ${where}`).get(...params) as { total: number };
    const offset = (page - 1) * limit;
    
    const workOrders = db.prepare(`
      SELECT wo.*, s.lat, s.lng, s.label
      FROM work_orders wo
      JOIN spots s ON s.id = wo.spot_id
      ${where}
      ORDER BY wo.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset) as any[];
    
    // Get items for each work order
    for (const wo of workOrders) {
      const items = db.prepare(`
        SELECT woi.*, d.name as department_name, d.code as department_code, pg.category, pg.severity
        FROM work_order_items woi
        JOIN departments d ON d.id = woi.department_id
        JOIN problem_groups pg ON pg.id = woi.group_id
        WHERE woi.work_order_id = ?
        ORDER BY woi.sequence_no ASC
      `).all(wo.id);
      (wo as any).items = items;
    }
    
    res.json({ data: workOrders, pagination: { page, limit, total: countResult.total, totalPages: Math.ceil(countResult.total / limit) } });
  } catch (error) {
    console.error('List work orders error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to list work orders' } });
  }
});

// GET /api/workorders/:id - Get work order detail
router.get('/:id', authMiddleware, validateParams(z.object({ id: z.string().uuid() })), async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const workOrder = db.prepare(`
      SELECT wo.*, s.lat, s.lng, s.radius_m, s.label
      FROM work_orders wo
      JOIN spots s ON s.id = wo.spot_id
      WHERE wo.id = ?
    `).get(req.params.id);
    
    if (!workOrder) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Work order not found' } });
    }
    
    const items = db.prepare(`
      SELECT woi.*, d.name as department_name, d.code as department_code, pg.category, pg.severity, pg.weighted_count
      FROM work_order_items woi
      JOIN departments d ON d.id = woi.department_id
      JOIN problem_groups pg ON pg.id = woi.group_id
      WHERE woi.work_order_id = ?
      ORDER BY woi.sequence_no ASC
    `).all(req.params.id);
    
    res.json({ work_order: { ...workOrder, items } });
  } catch (error) {
    console.error('Get work order error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to get work order' } });
  }
});

// POST /api/workorder-items/:id/accept - Officer accepts work item with ETA
router.post('/workorder-items/:id/accept', authMiddleware, requireOfficerOrAdmin, validateParams(z.object({ id: z.string().uuid() })), validateBody(workOrderItemActionSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const itemId = req.params.id;
    const db = getDb();
    
    const item = db.prepare('SELECT * FROM work_order_items WHERE id = ?').get(itemId) as any;
    if (!item) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Work order item not found' } });
    }
    
    // Check department access
    if (user.role === 'officer' && user.department_id !== item.department_id) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Not your department\'s work item' } });
    }
    
    if (item.status !== 'pending' && item.status !== 'scheduled') {
      return res.status(400).json({ error: { code: 'INVALID_STATUS', message: 'Can only accept pending or scheduled items' } });
    }
    
    const expectedCompleteAt = req.body.expected_complete_at || item.expected_complete_at;
    const createdAt = nowISO();
    
    runInTransaction((tx) => {
      tx.prepare(`
        UPDATE work_order_items
        SET status = 'in_progress', started_at = ?, expected_complete_at = ?, updated_at = ?
        WHERE id = ?
      `).run(createdAt, expectedCompleteAt, createdAt, itemId);
      
      // Audit log
      tx.prepare(`
        INSERT INTO audit_log (id, actor_id, action, entity, entity_id, detail_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(randomUUID(), user.id, 'accept', 'work_order_item', itemId, JSON.stringify({ expected_complete_at: expectedCompleteAt }), createdAt);
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Accept work item error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to accept work item' } });
  }
});

// POST /api/workorder-items/:id/start - Officer starts work item
router.post('/workorder-items/:id/start', authMiddleware, requireOfficerOrAdmin, validateParams(z.object({ id: z.string().uuid() })), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const itemId = req.params.id;
    const db = getDb();
    
    const item = db.prepare('SELECT * FROM work_order_items WHERE id = ?').get(itemId) as any;
    if (!item) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Work order item not found' } });
    }
    
    if (user.role === 'officer' && user.department_id !== item.department_id) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Not your department\'s work item' } });
    }
    
    // Check if secondary item can start (scheduled_start_at must have passed or admin released)
    if (item.role === 'secondary' && item.scheduled_start_at) {
      const scheduledStart = new Date(item.scheduled_start_at).getTime();
      if (now().getTime() < scheduledStart) {
        return res.status(400).json({ error: { code: 'NOT_SCHEDULED_YET', message: `Work scheduled to start at ${new Date(item.scheduled_start_at).toLocaleString()}` } });
      }
    }
    
    if (item.status !== 'scheduled' && item.status !== 'in_progress') {
      return res.status(400).json({ error: { code: 'INVALID_STATUS', message: 'Can only start scheduled or in_progress items' } });
    }
    
    const createdAt = nowISO();
    
    runInTransaction((tx) => {
      tx.prepare(`
        UPDATE work_order_items
        SET status = 'in_progress', started_at = ?, updated_at = ?
        WHERE id = ?
      `).run(createdAt, createdAt, itemId);
      
      tx.prepare(`
        INSERT INTO audit_log (id, actor_id, action, entity, entity_id, detail_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(randomUUID(), user.id, 'start', 'work_order_item', itemId, JSON.stringify({}), createdAt);
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Start work item error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to start work item' } });
  }
});

// POST /api/workorder-items/:id/complete - Officer completes work item
router.post('/workorder-items/:id/complete', authMiddleware, requireOfficerOrAdmin, validateParams(z.object({ id: z.string().uuid() })), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const itemId = req.params.id;
    const db = getDb();
    
    const item = db.prepare('SELECT * FROM work_order_items WHERE id = ?').get(itemId) as any;
    if (!item) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Work order item not found' } });
    }
    
    if (user.role === 'officer' && user.department_id !== item.department_id) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Not your department\'s work item' } });
    }
    
    if (item.status !== 'in_progress') {
      return res.status(400).json({ error: { code: 'INVALID_STATUS', message: 'Can only complete in_progress items' } });
    }
    
    const completedAt = nowISO();
    
    runInTransaction((tx) => {
      tx.prepare(`
        UPDATE work_order_items
        SET status = 'complete', completed_at = ?, updated_at = ?
        WHERE id = ?
      `).run(completedAt, completedAt, itemId);
      
      tx.prepare(`
        INSERT INTO audit_log (id, actor_id, action, entity, entity_id, detail_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(randomUUID(), user.id, 'complete', 'work_order_item', itemId, JSON.stringify({}), completedAt);
      
      // Update problem group status
      tx.prepare('UPDATE problem_groups SET status = ?, updated_at = ? WHERE id = ?').run('resolved', completedAt, item.group_id);
      tx.prepare('UPDATE reports SET status = ?, updated_at = ? WHERE group_id = ?').run('resolved', completedAt, item.group_id);
    });
    
    // Trigger secondary if this was primary
    if (item.role === 'primary') {
      triggerSecondaryOnPrimaryComplete(item.work_order_id, itemId);
    }
    
    // Check if all items complete -> mark work order complete
    const workOrder = db.prepare('SELECT * FROM work_orders WHERE id = ?').get(item.work_order_id) as any;
    const allItems = db.prepare('SELECT * FROM work_order_items WHERE work_order_id = ?').all(item.work_order_id) as any[];
    const allComplete = allItems.every(i => i.status === 'complete');
    
    if (allComplete && workOrder) {
      db.prepare('UPDATE work_orders SET status = ?, updated_at = ? WHERE id = ?').run('completed', nowISO(), item.work_order_id);
    }
    
    res.json({ success: true, triggered_secondary: item.role === 'primary' });
  } catch (error) {
    console.error('Complete work item error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to complete work item' } });
  }
});

// POST /api/workorder-items/:id/delay - Officer enters delay reason
router.post('/workorder-items/:id/delay', authMiddleware, requireOfficerOrAdmin, validateParams(z.object({ id: z.string().uuid() })), validateBody(workOrderItemActionSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const itemId = req.params.id;
    const db = getDb();
    
    const item = db.prepare('SELECT * FROM work_order_items WHERE id = ?').get(itemId) as any;
    if (!item) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Work order item not found' } });
    }
    
    if (user.role === 'officer' && user.department_id !== item.department_id) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Not your department\'s work item' } });
    }
    
    if (!req.body.delay_reason) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Delay reason is required', fields: [{ field: 'delay_reason', message: 'Delay reason is required' }] } });
    }
    
    const newExpectedAt = req.body.expected_complete_at || new Date(now().getTime() + 24 * 60 * 60 * 1000).toISOString();
    const createdAt = nowISO();
    
    runInTransaction((tx) => {
      tx.prepare(`
        UPDATE work_order_items
        SET status = 'overdue', delay_reason = ?, expected_complete_at = ?, updated_at = ?
        WHERE id = ?
      `).run(req.body.delay_reason, newExpectedAt, createdAt, itemId);
      
      tx.prepare(`
        INSERT INTO audit_log (id, actor_id, action, entity, entity_id, detail_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(randomUUID(), user.id, 'delay', 'work_order_item', itemId, JSON.stringify({ delay_reason: req.body.delay_reason, new_expected: newExpectedAt }), createdAt);
    });
    
    // Notify secondary departments
    const { notifySecondariesOfDelay } = await import('../engines/escalation.js');
    notifySecondariesOfDelay(item.work_order_id, item.sequence_no);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Delay work item error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to record delay' } });
  }
});

// POST /api/workorder-items/:id/release - Admin releases secondary to parallel
router.post('/workorder-items/:id/release', authMiddleware, requireAdmin, validateParams(z.object({ id: z.string().uuid() })), validateBody(workOrderItemReleaseSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const itemId = req.params.id;
    const { action, new_department_id } = req.body;
    const db = getDb();
    
    const item = db.prepare('SELECT * FROM work_order_items WHERE id = ?').get(itemId) as any;
    if (!item) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Work order item not found' } });
    }
    
    if (action === 'reassign') {
      if (!new_department_id) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'New department ID required for reassignment' } });
      }
      
      const { reassignWorkOrderItem } = await import('../engines/escalation.js');
      reassignWorkOrderItem(itemId, new_department_id, user.id);
    } else if (action === 'release_parallel') {
      const { releaseSecondaryToParallel } = await import('../engines/escalation.js');
      releaseSecondaryToParallel(itemId, user.id);
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Release work item error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to release work item' } });
  }
});

export default router;