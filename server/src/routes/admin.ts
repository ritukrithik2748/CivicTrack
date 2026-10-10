import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getDb, runInTransaction } from '../db/database.js';
import { nowISO, now, setOffsetMs, addOffsetMs, resetOffset, getOffsetMs, HOUR_MS, DAY_MS } from '../engines/clock.js';
import { randomUUID } from 'crypto';
import { authMiddleware, AuthenticatedRequest, requireAdmin } from '../middleware/auth.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validate.js';
import { findUserByEmail, createUser, hashPassword, getAllUsers } from '../auth/auth.js';
import { migrate } from '../db/migrate.js';
import { seedDatabase } from '../db/seed.js';

const router = Router();

const settingsSchema = z.object({
  cluster_radius_m: z.number().min(10).max(500).optional(),
  major_count_threshold: z.number().min(1).max(100).optional(),
  stall_days_major: z.number().min(1).max(90).optional(),
  secondary_gap_minutes: z.number().min(0).max(1440).optional(),
  grace_major_hours: z.number().min(1).max(168).optional(),
  grace_moderate_hours: z.number().min(1).max(168).optional(),
  grace_minor_days: z.number().min(1).max(30).optional(),
  verify_radius_m: z.number().min(50).max(1000).optional(),
  max_accuracy_m: z.number().min(10).max(200).optional(),
  quorum_threshold: z.number().min(1).max(10).optional(),
  daily_verification_cap: z.number().min(1).max(100).optional(),
  conflict_radius_m: z.number().min(50).max(500).optional(),
  conflict_months: z.number().min(1).max(24).optional(),
  warning_reports: z.number().min(1).max(50).optional(),
  warning_days: z.number().min(1).max(30).optional(),
  max_reports_per_day: z.number().min(1).max(50).optional(),
  max_photos_per_report: z.number().min(1).max(10).optional(),
  max_file_size_mb: z.number().min(1).max(20).optional(),
  demo_location_mode: z.boolean().optional(),
  city_min_lat: z.number().min(-90).max(90).optional(),
  city_max_lat: z.number().min(-90).max(90).optional(),
  city_min_lng: z.number().min(-180).max(180).optional(),
  city_max_lng: z.number().min(-180).max(180).optional(),
});

// GET /api/admin/settings - Get all settings
router.get('/settings', authMiddleware, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDb();
    const settings = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
    
    const settingsObj: Record<string, string> = {};
    for (const s of settings) {
      settingsObj[s.key] = s.value;
    }
    
    // Add defaults for missing settings
    const defaults: Record<string, string> = {
      cluster_radius_m: '50',
      major_count_threshold: '10',
      stall_days_major: '14',
      secondary_gap_minutes: '60',
      grace_major_hours: '24',
      grace_moderate_hours: '72',
      grace_minor_days: '7',
      verify_radius_m: '200',
      max_accuracy_m: '50',
      quorum_threshold: '3',
      daily_verification_cap: '20',
      conflict_radius_m: '100',
      conflict_months: '6',
      warning_reports: '5',
      warning_days: '7',
      max_reports_per_day: '10',
      max_photos_per_report: '3',
      max_file_size_mb: '5',
      demo_location_mode: 'true',
      city_min_lat: '12.80',
      city_max_lat: '12.86',
      city_min_lng: '80.10',
      city_max_lng: '80.18',
    };
    
    for (const [key, value] of Object.entries(defaults)) {
      if (!(key in settingsObj)) {
        settingsObj[key] = value;
      }
    }
    
    res.json({ settings: settingsObj });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to get settings' } });
  }
});

// PATCH /api/admin/settings - Update settings
router.patch('/settings', authMiddleware, requireAdmin, validateBody(settingsSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDb();
    const user = req.user!;
    
    runInTransaction((tx) => {
      for (const [key, value] of Object.entries(req.body)) {
        tx.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)').run(key, String(value), nowISO());
        
        tx.prepare(`
          INSERT INTO audit_log (id, actor_id, action, entity, entity_id, detail_json, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(randomUUID(), user.id, 'update_setting', 'settings', key, JSON.stringify({ value }), nowISO());
      }
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to update settings' } });
  }
});

// POST /api/admin/time-travel - Time travel control
router.post('/time-travel', authMiddleware, requireAdmin, validateBody(z.object({ 
  action: z.enum(['skip_hour', 'skip_day', 'skip_3days', 'reset', 'set_offset']),
  hours: z.number().optional(),
})), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { action, hours } = req.body;
    let newOffset = getOffsetMs();
    
    switch (action) {
      case 'skip_hour':
        newOffset += HOUR_MS;
        break;
      case 'skip_day':
        newOffset += DAY_MS;
        break;
      case 'skip_3days':
        newOffset += 3 * DAY_MS;
        break;
      case 'reset':
        newOffset = 0;
        break;
      case 'set_offset':
        if (hours !== undefined) {
          newOffset = hours * HOUR_MS;
        }
        break;
    }
    
    setOffsetMs(newOffset);
    
    // Audit log
    const db = getDb();
    db.prepare(`
      INSERT INTO audit_log (id, actor_id, action, entity, entity_id, detail_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(randomUUID(), req.user!.id, 'time_travel', 'clock', 'offset', JSON.stringify({ action, new_offset_ms: newOffset }), nowISO());
    
    res.json({ success: true, offset_ms: newOffset, offset_hours: newOffset / HOUR_MS, current_time: now().toISOString() });
  } catch (error) {
    console.error('Time travel error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to time travel' } });
  }
});

// POST /api/admin/reset-demo - Reset demo data
router.post('/reset-demo', authMiddleware, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Re-run migration and seed
    migrate();
    await seedDatabase();
    
    // Reset clock
    resetOffset();
    
    // Audit log
    const db = getDb();
    db.prepare(`
      INSERT INTO audit_log (id, actor_id, action, entity, entity_id, detail_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(randomUUID(), req.user!.id, 'reset_demo', 'database', 'all', JSON.stringify({}), nowISO());
    
    res.json({ success: true, message: 'Demo data reset successfully' });
  } catch (error) {
    console.error('Reset demo error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to reset demo data' } });
  }
});

// GET /api/admin/users - List all users (admin)
router.get('/users', authMiddleware, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const users = getAllUsers();
    res.json({ users });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to get users' } });
  }
});

// GET /api/admin/audit-log - Get audit log
router.get('/audit-log', authMiddleware, requireAdmin, validateQuery(z.object({ page: z.coerce.number().min(1).default(1), limit: z.coerce.number().min(1).max(100).default(50) })), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { page, limit } = req.query as any;
    const db = getDb();
    const offset = (page - 1) * limit;
    
    const countResult = db.prepare('SELECT COUNT(*) as total FROM audit_log').get() as { total: number };
    const logs = db.prepare(`
      SELECT al.*, u.name as actor_name, u.email as actor_email
      FROM audit_log al
      LEFT JOIN users u ON u.id = al.actor_id
      ORDER BY al.created_at DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset);
    
    res.json({ data: logs, pagination: { page, limit, total: countResult.total, totalPages: Math.ceil(countResult.total / limit) } });
  } catch (error) {
    console.error('Get audit log error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to get audit log' } });
  }
});

export default router;