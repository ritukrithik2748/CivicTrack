import { Request, Response, NextFunction } from 'express';
import { verifyToken, JWTPayload, PublicUser, findUserById } from '../auth/auth.js';
import { getDb } from '../db/database.js';

export interface AuthenticatedRequest extends Request {
  user?: PublicUser;
  userPayload?: JWTPayload;
}

export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const token = req.cookies?.token;
  
  if (!token) {
    res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    return;
  }
  
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: { code: 'INVALID_TOKEN', message: 'Invalid or expired token' } });
    return;
  }
  
  const user = findUserById(payload.userId);
  if (!user) {
    res.status(401).json({ error: { code: 'USER_NOT_FOUND', message: 'User no longer exists' } });
    return;
  }
  
  req.user = user;
  req.userPayload = payload;
  next();
}

export function optionalAuthMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const token = req.cookies?.token;
  
  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      const user = findUserById(payload.userId);
      if (user) {
        req.user = user;
        req.userPayload = payload;
      }
    }
  }
  
  next();
}

export function requireRole(...roles: ('citizen' | 'officer' | 'admin')[]): (req: AuthenticatedRequest, res: Response, next: NextFunction) => void {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
      return;
    }
    
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } });
      return;
    }
    
    next();
  };
}

export function requireOfficerOrAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    return;
  }
  
  if (req.user.role === 'citizen') {
    res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Officer or admin access required' } });
    return;
  }
  
  next();
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    return;
  }
  
  if (req.user.role !== 'admin') {
    res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Admin access required' } });
    return;
  }
  
  next();
}

export function requireOwnDepartment(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    return;
  }
  
  if (req.user.role === 'admin') {
    next();
    return;
  }
  
  if (req.user.role === 'officer') {
    // For officers, check if they're accessing their own department's data
    // This will be enforced in route handlers with specific department_id checks
    next();
    return;
  }
  
  res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Officer or admin access required' } });
}

export function canAccessDepartment(req: AuthenticatedRequest, departmentId: string): boolean {
  if (!req.user) return false;
  if (req.user.role === 'admin') return true;
  if (req.user.role === 'officer' && req.user.department_id === departmentId) return true;
  return false;
}

export function canAccessProject(req: AuthenticatedRequest, projectDepartmentId: string): boolean {
  return canAccessDepartment(req, projectDepartmentId);
}

export function canAccessWorkOrderItem(req: AuthenticatedRequest, itemDepartmentId: string): boolean {
  return canAccessDepartment(req, itemDepartmentId);
}