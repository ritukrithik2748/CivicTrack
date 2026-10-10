import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getDb, runInTransaction } from '../db/database.js';
import { nowISO, now, haversineDistance } from '../engines/clock.js';
import { randomUUID } from 'crypto';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';
import { validateBody, validateParams } from '../middleware/validate.js';
import { uploadVerificationPhoto, handleUploadError } from '../middleware/upload.js';
import { validateFileType } from '../middleware/upload.js';
import { verifyProject, getProjectVerifications, getVerificationStatus } from '../engines/verification.js';
import sharp from 'sharp';
import { createHash } from 'crypto';

const router = Router();

const verifySchema = z.object({
  status_type: z.enum(['in_progress', 'completed']),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy_m: z.number().min(0).max(1000),
  demo_lat: z.number().optional().nullable(), // For demo mode
  demo_lng: z.number().optional().nullable(),
});

// POST /api/projects/:id/verify - Submit verification
router.post('/projects/:id/verify', authMiddleware, uploadVerificationPhoto, handleUploadError, validateParams(z.object({ id: z.string().uuid() })), validateBody(verifySchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const projectId = req.params.id;
    const file = req.file as Express.Multer.File | undefined;
    const body = req.body;
    
    // Use demo location if in demo mode
    const demoLat = body.demo_lat ? Number(body.demo_lat) : null;
    const demoLng = body.demo_lng ? Number(body.demo_lng) : null;
    const lat = demoLat !== null ? demoLat : body.lat;
    const lng = demoLng !== null ? demoLng : body.lng;
    const accuracyM = Number(body.accuracy_m);
    
    // Process photo if provided
    let photoPath: string | null = null;
    let photoSha256: string | null = null;
    
    if (file) {
      const mimeType = await validateFileType(file.buffer);
      if (!mimeType) {
        return res.status(400).json({ error: { code: 'INVALID_FILE_TYPE', message: 'File type not allowed. Only JPEG, PNG, WebP accepted.' } });
      }
      
      const processed = await sharp(file.buffer)
        .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85, mozjpeg: true })
        .toBuffer();
      
      const hash = createHash('sha256').update(processed).digest('hex');
      
      // Check for duplicate
      const existing = getDb().prepare('SELECT id FROM report_photos WHERE sha256 = ?').get(hash);
      if (!existing) {
        const photoId = randomUUID();
        photoPath = `uploads/${photoId}.jpg`;
        const fs = await import('fs');
        const path = await import('path');
        const uploadDir = path.join(process.cwd(), 'uploads');
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
        fs.writeFileSync(path.join(process.cwd(), photoPath), processed);
        photoSha256 = hash;
      } else {
        photoSha256 = hash;
      }
    }
    
    const result = verifyProject(user.id, projectId, body.status_type, lat, lng, accuracyM, photoPath, photoSha256);
    
    if (!result.success) {
      return res.status(400).json({ error: { code: 'VERIFICATION_FAILED', message: result.message } });
    }
    
    res.json({ 
      success: true, 
      verification_id: result.verificationId,
      quorum_reached: result.quorumReached,
      disputed: result.disputed,
      message: result.message 
    });
  } catch (error) {
    console.error('Verify project error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to submit verification' } });
  }
});

// GET /api/projects/:id/verifications - Get project verifications
router.get('/projects/:id/verifications', validateParams(z.object({ id: z.string().uuid() })), async (req: Request, res: Response) => {
  try {
    const projectId = req.params.id;
    const verifications = getProjectVerifications(projectId);
    const status = getVerificationStatus(projectId);
    
    res.json({ verifications, status });
  } catch (error) {
    console.error('Get verifications error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to get verifications' } });
  }
});

export default router;