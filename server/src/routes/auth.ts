import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authRateLimit } from '../middleware/rateLimit.js';
import { validateBody } from '../middleware/validate.js';
import { hashPassword, verifyPassword, generateToken, createSessionCookie, clearSessionCookie, findUserByEmail, createUser, toPublicUser, updateUserLastLogin } from '../auth/auth.js';
import { authMiddleware, optionalAuthMiddleware, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  phone: z.string().min(10).max(20).optional().nullable(),
  password: z.string().min(8).max(100),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post('/register', authRateLimit, validateBody(registerSchema), async (req: Request, res: Response) => {
  try {
    const { name, email, phone, password } = req.body;
    
    const existing = findUserByEmail(email);
    if (existing) {
      return res.status(409).json({ error: { code: 'EMAIL_EXISTS', message: 'Email already registered' } });
    }
    
    const passwordHash = await hashPassword(password);
    const user = createUser(name, email, phone || null, passwordHash, 'citizen');
    
    const token = generateToken({ userId: user.id, email: user.email, role: user.role, departmentId: user.department_id ?? undefined });
    res.setHeader('Set-Cookie', createSessionCookie(token));
    
    res.status(201).json({ user: toPublicUser(user) });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Registration failed' } });
  }
});

router.post('/login', authRateLimit, validateBody(loginSchema), async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    
    const user = findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
    }
    
    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
    }
    
    updateUserLastLogin(user.id);
    
    const token = generateToken({ userId: user.id, email: user.email, role: user.role, departmentId: user.department_id ?? undefined });
    res.setHeader('Set-Cookie', createSessionCookie(token));
    
    res.json({ user: toPublicUser(user) });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Login failed' } });
  }
});

router.post('/logout', (req: Request, res: Response) => {
  res.setHeader('Set-Cookie', clearSessionCookie());
  res.json({ success: true });
});

router.get('/me', optionalAuthMiddleware, (req: AuthenticatedRequest, res: Response) => {
  res.json({ user: req.user || null });
});

router.post('/demo-login', authRateLimit, validateBody(z.object({ email: z.string().email() })), async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    
    const user = findUserByEmail(email);
    if (!user) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Demo account not found' } });
    }
    
    // Demo password is always demo1234
    const valid = await verifyPassword('demo1234', user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid demo credentials' } });
    }
    
    updateUserLastLogin(user.id);
    
    const token = generateToken({ userId: user.id, email: user.email, role: user.role, departmentId: user.department_id ?? undefined });
    res.setHeader('Set-Cookie', createSessionCookie(token));
    
    res.json({ user: toPublicUser(user) });
  } catch (error) {
    console.error('Demo login error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Demo login failed' } });
  }
});

export default router;