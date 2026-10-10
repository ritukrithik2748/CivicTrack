import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getDb, runInTransaction } from '../db/database.js';
import { nowISO, now } from '../engines/clock.js';
import { randomUUID } from 'crypto';
import { authMiddleware, AuthenticatedRequest, requireOfficerOrAdmin } from '../middleware/auth.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validate.js';
import { uploadReportPhotos, handleUploadError } from '../middleware/upload.js';
import { validateFileType } from '../middleware/upload.js';
import { determineLocationTrust } from '../engines/locationTrust.js';
import { getOrCreateSpot, reclusterOnReportChange, CLUSTER_RADIUS_M } from '../engines/clustering.js';
import { updateGroupSeverity } from '../engines/severity.js';
import { createOrUpdateWorkOrder } from '../engines/sequencing.js';
import sharp from 'sharp';
import { createHash } from 'crypto';

const router = Router();

const reportSchema = z.object({
  category: z.enum([
    'sewage_leak', 'sewage_blockage', 'water_pipe_leak',
    'drain_blockage', 'waterlogging',
    'live_wire', 'streetlight_out', 'transformer_issue',
    'cable_fault', 'open_trench_cable',
    'pothole', 'road_cave_in', 'damaged_road'
  ]),
  description: z.string().max(2000).optional(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  location_source: z.enum(['exif', 'device_gps', 'manual_pin']),
  exif_lat: z.number().optional().nullable(),
  exif_lng: z.number().optional().nullable(),
  exif_timestamp: z.string().datetime().optional().nullable(),
  device_accuracy: z.number().optional().nullable(),
  manual_lat: z.number().optional().nullable(),
  manual_lng: z.number().optional().nullable(),
});

const reportListQuery = z.object({
  status: z.string().optional(),
  category: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

// Category to department mapping
const CATEGORY_DEPARTMENT: Record<string, string> = {
  sewage_leak: 'sewage_water',
  sewage_blockage: 'sewage_water',
  water_pipe_leak: 'sewage_water',
  drain_blockage: 'storm_drainage',
  waterlogging: 'storm_drainage',
  live_wire: 'electricity',
  streetlight_out: 'electricity',
  transformer_issue: 'electricity',
  cable_fault: 'telecom',
  open_trench_cable: 'telecom',
  pothole: 'roads',
  road_cave_in: 'roads',
  damaged_road: 'roads',
};

// GET /api/reports - List reports (officer/admin)
router.get('/', authMiddleware, requireOfficerOrAdmin, validateQuery(reportListQuery), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { status, category, page, limit } = req.query as any;
    const db = getDb();
    
    let where = 'WHERE 1=1';
    const params: any[] = [];
    
    // Officers see all reports in their department unless admin
    if (user.role === 'officer') {
      where += ' AND r.department_id = ?';
      params.push(user.department_id);
    }
    
    if (status) {
      where += ' AND r.status = ?';
      params.push(status);
    }
    if (category) {
      where += ' AND r.category = ?';
      params.push(category);
    }
    
    const countResult = db.prepare(`SELECT COUNT(*) as total FROM reports r ${where}`).get(...params) as { total: number };
    const offset = (page - 1) * limit;
    
    const reports = db.prepare(`
      SELECT r.*, pg.severity as group_severity, pg.severity_reason, d.name as department_name
      FROM reports r
      LEFT JOIN problem_groups pg ON pg.id = r.group_id
      LEFT JOIN departments d ON d.id = r.department_id
      ${where}
      ORDER BY r.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);
    
    res.json({ data: reports, pagination: { page, limit, total: countResult.total, totalPages: Math.ceil(countResult.total / limit) } });
  } catch (error) {
    console.error('List reports error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to list reports' } });
  }
});

// POST /api/reports - Create new report (with photo upload)
router.post('/', authMiddleware, uploadReportPhotos, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const files = req.files as Express.Multer.File[] || [];
    const body = req.body;

    // Determine location trust
    let locationInfo;
    try {
      locationInfo = determineLocationTrust(
        body.exif_lat ? Number(body.exif_lat) : null,
        body.exif_lng ? Number(body.exif_lng) : null,
        body.exif_timestamp ? new Date(body.exif_timestamp) : null,
        body.lat, // device GPS from form
        body.lng,
        body.device_accuracy ? Number(body.device_accuracy) : null,
        body.manual_lat ? Number(body.manual_lat) : null,
        body.manual_lng ? Number(body.manual_lng) : null
      );
    } catch (error: any) {
      return res.status(400).json({ error: { code: 'LOCATION_ERROR', message: error.message } });
    }

    // Process photos
    const photoHashes: string[] = [];
    const photoPaths: string[] = [];

    for (const file of files) {
      // Validate file type by magic bytes
      const mimeType = await validateFileType(file.buffer);
      if (!mimeType) {
        return res.status(400).json({ error: { code: 'INVALID_FILE_TYPE', message: 'File type not allowed. Only JPEG, PNG, WebP accepted.' } });
      }

      // Resize and strip EXIF
      const processed = await sharp(file.buffer)
        .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85, mozjpeg: true })
        .toBuffer();

      // Compute hash
      const hash = createHash('sha256').update(processed).digest('hex');

      // Check for duplicate
      const existing = getDb().prepare('SELECT id FROM report_photos WHERE sha256 = ?').get(hash);
      if (existing) {
        photoHashes.push(hash);
        continue;
      }

      // Save file
      const photoId = randomUUID();
      const photoPath = `uploads/${photoId}.jpg`;
      const fs = await import('fs');
      const path = await import('path');
      const uploadDir = path.join(process.cwd(), 'uploads');
      if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
      fs.writeFileSync(path.join(process.cwd(), photoPath), processed);

      // Record photo
      getDb().prepare(`
        INSERT INTO report_photos (id, report_id, path, sha256, width, height, bytes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(photoId, '', hash, 1600, 1600, processed.length, nowISO());

      photoHashes.push(hash);
      photoPaths.push(photoPath);
    }

    // Get department for category
    const departmentId = CATEGORY_DEPARTMENT[body.category];
    if (!departmentId) {
      return res.status(400).json({ error: { code: 'INVALID_CATEGORY', message: 'Invalid category' } });
    }

    // Create report
    const reportId = randomUUID();
    const createdAt = nowISO();

    runInTransaction((tx) => {
      tx.prepare(`
        INSERT INTO reports (id, user_id, category, department_id, description, lat, lng, location_source, location_trust, location_flag, weight, status, image_hashes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?)
      `).run(
        reportId, user.id, body.category, departmentId, body.description || null,
        locationInfo.lat, locationInfo.lng, locationInfo.source, locationInfo.trust, locationInfo.flag, locationInfo.weight,
        JSON.stringify(photoHashes), createdAt, createdAt
      );

      // Update photo records with report_id
      for (const hash of photoHashes) {
        tx.prepare('UPDATE report_photos SET report_id = ? WHERE sha256 = ?').run(reportId, hash);
      }

      // Audit log
      tx.prepare(`
        INSERT INTO audit_log (id, actor_id, action, entity, entity_id, detail_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(randomUUID(), user.id, 'create', 'report', reportId, JSON.stringify({ category: body.category, location_source: locationInfo.source }), createdAt);
    });

    // Clustering
    const spot = getOrCreateSpot(locationInfo.lat, locationInfo.lng);
    reclusterOnReportChange(reportId);

    // Update severity for affected groups
    const db = getDb();
    const groups = db.prepare('SELECT id FROM problem_groups WHERE spot_id = ?').all(spot.id) as { id: string }[];
    for (const group of groups) {
      updateGroupSeverity(group.id);
    }

    // Check for work order creation
    createOrUpdateWorkOrder(spot.id);

    const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(reportId);
    const group = db.prepare('SELECT * FROM problem_groups WHERE spot_id = ? AND category = ?').get(spot.id, body.category);

    res.status(201).json({ report, group, spot, location_info: locationInfo });
  } catch (error) {
    console.error('Create report error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to create report' } });
  }
});

// GET /api/reports/mine - Get current user's reports
router.get('/mine', authMiddleware, validateQuery(reportListQuery), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { status, category, page, limit } = req.query as any;
    const db = getDb();
    
    let where = 'WHERE r.user_id = ?';
    const params: any[] = [user.id];
    
    if (status) {
      where += ' AND r.status = ?';
      params.push(status);
    }
    if (category) {
      where += ' AND r.category = ?';
      params.push(category);
    }
    
    const countResult = db.prepare(`SELECT COUNT(*) as total FROM reports r ${where}`).get(...params) as { total: number };
    const offset = (page - 1) * limit;
    
    const reports = db.prepare(`
      SELECT r.*, pg.severity as group_severity, pg.severity_reason, d.name as department_name
      FROM reports r
      LEFT JOIN problem_groups pg ON pg.id = r.group_id
      LEFT JOIN departments d ON d.id = r.department_id
      ${where}
      ORDER BY r.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);
    
    res.json({ data: reports, pagination: { page, limit, total: countResult.total, totalPages: Math.ceil(countResult.total / limit) } });
  } catch (error) {
    console.error('Get my reports error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to get reports' } });
  }
});

// GET /api/reports/:id - Get single report
router.get('/:id', validateParams(z.object({ id: z.string().uuid() })), async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const report = db.prepare(`
      SELECT r.*, u.name as user_name, d.name as department_name, pg.severity as group_severity
      FROM reports r
      JOIN users u ON u.id = r.user_id
      LEFT JOIN departments d ON d.id = r.department_id
      LEFT JOIN problem_groups pg ON pg.id = r.group_id
      WHERE r.id = ?
    `).get(req.params.id);
    
    if (!report) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Report not found' } });
    }
    
    // Get photos
    const photos = db.prepare('SELECT * FROM report_photos WHERE report_id = ?').all(req.params.id);
    
    // Get replies
    const replies = db.prepare(`
      SELECT rr.*, u.name as user_name, u.role as user_role
      FROM report_replies rr
      JOIN users u ON u.id = rr.user_id
      WHERE rr.report_id = ?
      ORDER BY rr.created_at ASC
    `).all(req.params.id);
    
    res.json({ report: { ...report, photos, replies } });
  } catch (error) {
    console.error('Get report error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to get report' } });
  }
});

// POST /api/reports/:id/reply - Add reply (officer)
router.post('/:id/reply', authMiddleware, requireOfficerOrAdmin, validateParams(z.object({ id: z.string().uuid() })), validateBody(z.object({ message: z.string().min(1).max(2000) })), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const reportId = req.params.id;
    const db = getDb();
    
    const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(reportId) as any;
    if (!report) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Report not found' } });
    }
    
    // Check department access
    if (user.role === 'officer' && user.department_id !== report.department_id) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Cannot reply to report from another department' } });
    }
    
    const replyId = randomUUID();
    const createdAt = nowISO();
    
    runInTransaction((tx) => {
      tx.prepare(`
        INSERT INTO report_replies (id, report_id, user_id, message, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(replyId, reportId, user.id, req.body.message, createdAt);
      
      // Update report status if open
      if (report.status === 'open') {
        tx.prepare('UPDATE reports SET status = ?, updated_at = ? WHERE id = ?').run('acknowledged', createdAt, reportId);
      }
      
      // Notify reporter
      tx.prepare(`
        INSERT INTO notifications (id, user_id, type, title, body, link, read, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 0, ?)
      `).run(randomUUID(), report.user_id, 'reply', 'Department Reply', `Officer replied to your report: "${req.body.message.substring(0, 100)}..."`, `/reports/${reportId}`, createdAt);
    });
    
    res.status(201).json({ success: true });
  } catch (error) {
    console.error('Add reply error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to add reply' } });
  }
});

// POST /api/reports/:id/confirm-resolved - Citizen confirms resolution
router.post('/:id/confirm-resolved', authMiddleware, validateParams(z.object({ id: z.string().uuid() })), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const reportId = req.params.id;
    const db = getDb();
    
    const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(reportId) as any;
    if (!report) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Report not found' } });
    }
    
    if (report.user_id !== user.id) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Not your report' } });
    }
    
    if (report.status !== 'resolved') {
      return res.status(400).json({ error: { code: 'INVALID_STATUS', message: 'Report is not marked as resolved' } });
    }
    
    const createdAt = nowISO();
    db.prepare('UPDATE reports SET status = ?, updated_at = ? WHERE id = ?').run('closed', createdAt, reportId);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Confirm resolved error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to confirm resolution' } });
  }
});

// POST /api/reports/:id/reopen - Citizen reopens report
router.post('/:id/reopen', authMiddleware, validateParams(z.object({ id: z.string().uuid() })), validateBody(z.object({ reason: z.string().min(1).max(500) })), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const reportId = req.params.id;
    const db = getDb();
    
    const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(reportId) as any;
    if (!report) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Report not found' } });
    }
    
    if (report.user_id !== user.id) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Not your report' } });
    }
    
    if (report.status !== 'resolved' && report.status !== 'closed') {
      return res.status(400).json({ error: { code: 'INVALID_STATUS', message: 'Can only reopen resolved or closed reports' } });
    }
    
    const createdAt = nowISO();
    db.prepare('UPDATE reports SET status = ?, updated_at = ? WHERE id = ?').run('reopened', createdAt, reportId);
    
    // Notify department
    const officers = db.prepare('SELECT id FROM users WHERE department_id = ? AND role = \'officer\'').all(report.department_id) as { id: string }[];
    for (const officer of officers) {
      db.prepare(`
        INSERT INTO notifications (id, user_id, type, title, body, link, read, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 0, ?)
      `).run(randomUUID(), officer.id, 'reopen', 'Report Reopened', `Citizen reopened report: ${req.body.reason}`, `/reports/${reportId}`, createdAt);
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Reopen report error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to reopen report' } });
  }
});

export default router;