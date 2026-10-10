import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    department_id: string | null;
  };
}

export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each IP to 20 requests per windowMs
  message: { error: { code: 'RATE_LIMITED', message: 'Too many authentication attempts, please try again later' } },
  standardHeaders: true,
  legacyHeaders: false,
});

export const apiRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // limit each IP to 100 requests per minute
  message: { error: { code: 'RATE_LIMITED', message: 'Too many requests, please slow down' } },
  standardHeaders: true,
  legacyHeaders: false,
});

export const uploadRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // limit each IP to 50 uploads per hour
  message: { error: { code: 'RATE_LIMITED', message: 'Too many uploads, please try again later' } },
  standardHeaders: true,
  legacyHeaders: false,
});

export const reportRateLimit = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 10, // limit each user to 10 reports per day
  message: { error: { code: 'RATE_LIMITED', message: 'Daily report limit reached' } },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => (req as AuthenticatedRequest).user?.id || req.ip || 'anonymous',
});