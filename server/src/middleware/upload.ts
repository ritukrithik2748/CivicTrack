import multer from 'multer';
import { Request, Response, NextFunction } from 'express';
import { fileTypeFromBuffer } from 'file-type';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILES_PER_REPORT = 3;
const MAX_FILES_PER_VERIFICATION = 1;

const memoryStorage = multer.memoryStorage();

function fileFilter(req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback): void {
  // Check MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(new Error(`File type ${file.mimetype} not allowed. Allowed: JPEG, PNG, WebP`));
    return;
  }
  
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    cb(new Error(`File size exceeds ${MAX_FILE_SIZE / (1024 * 1024)} MB limit`));
    return;
  }
  
  cb(null, true);
}

export const uploadReportPhotos = multer({
  storage: memoryStorage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: MAX_FILES_PER_REPORT,
  },
}).array('photos', MAX_FILES_PER_REPORT);

export const uploadVerificationPhoto = multer({
  storage: memoryStorage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: MAX_FILES_PER_VERIFICATION,
  },
}).single('photo');

export function handleUploadError(err: Error, req: Request, res: Response, next: NextFunction): void {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({ error: { code: 'FILE_TOO_LARGE', message: `File size exceeds ${MAX_FILE_SIZE / (1024 * 1024)} MB limit` } });
      return;
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      res.status(400).json({ error: { code: 'TOO_MANY_FILES', message: `Maximum ${MAX_FILES_PER_REPORT} photos per report allowed` } });
      return;
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      res.status(400).json({ error: { code: 'UNEXPECTED_FIELD', message: 'Unexpected file field' } });
      return;
    }
  }
  
  if (err.message.includes('not allowed') || err.message.includes('exceeds')) {
    res.status(400).json({ error: { code: 'INVALID_FILE', message: err.message } });
    return;
  }
  
  next(err);
}

export async function validateFileType(buffer: Buffer): Promise<string | null> {
  const type = await fileTypeFromBuffer(buffer);
  if (!type || !ALLOWED_MIME_TYPES.includes(type.mime)) {
    return null;
  }
  return type.mime;
}

export function getMaxFilesForReport(): number {
  return MAX_FILES_PER_REPORT;
}

export function getMaxFilesForVerification(): number {
  return MAX_FILES_PER_VERIFICATION;
}