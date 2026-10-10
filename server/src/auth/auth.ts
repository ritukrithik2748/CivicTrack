import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { getDb } from '../db/database.js';
import { nowISO } from '../engines/clock.js';

const JWT_SECRET = process.env.JWT_SECRET || 'civictrack-dev-secret-change-in-production';
const JWT_EXPIRES_IN = '30d';
const BCRYPT_ROUNDS = 12;

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  departmentId?: string;
  iat?: number;
  exp?: number;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}

export function createSessionCookie(token: string): string {
  // In production, use Secure and SameSite=Strict or Lax
  const isProd = process.env.NODE_ENV === 'production';
  return `token=${token}; HttpOnly; Path=/; Max-Age=${30 * 24 * 60 * 60}; SameSite=Lax${isProd ? '; Secure' : ''}`;
}

export function clearSessionCookie(): string {
  const isProd = process.env.NODE_ENV === 'production';
  return `token=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax${isProd ? '; Secure' : ''}`;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  password_hash: string;
  role: 'citizen' | 'officer' | 'admin';
  department_id: string | null;
  verified: number;
  created_at: string;
  updated_at: string;
}

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: 'citizen' | 'officer' | 'admin';
  department_id: string | null;
  verified: number;
  created_at: string;
}

export function toPublicUser(user: User): PublicUser {
  const { password_hash, ...publicUser } = user;
  return publicUser;
}

export function findUserByEmail(email: string): User | null {
  const db = getDb();
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email) as User | null;
}

export function findUserById(id: string): User | null {
  const db = getDb();
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User | null;
}

export function createUser(
  name: string,
  email: string,
  phone: string | null,
  passwordHash: string,
  role: 'citizen' | 'officer' | 'admin',
  departmentId: string | null = null
): User {
  const db = getDb();
  const id = randomUUID();
  const now = nowISO();
  
  db.prepare(`
    INSERT INTO users (id, name, email, phone, password_hash, role, department_id, verified, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `).run(id, name, email, phone, passwordHash, role, departmentId, now, now);
  
  return findUserById(id)!;
}

export function updateUserLastLogin(userId: string): void {
  const db = getDb();
  db.prepare('UPDATE users SET updated_at = ? WHERE id = ?').run(nowISO(), userId);
}

export function getAllUsers(): PublicUser[] {
  const db = getDb();
  const users = db.prepare('SELECT id, name, email, phone, role, department_id, verified, created_at FROM users ORDER BY created_at DESC').all() as PublicUser[];
  return users;
}

export function getUsersByDepartment(departmentId: string): PublicUser[] {
  const db = getDb();
  return db.prepare('SELECT id, name, email, phone, role, department_id, verified, created_at FROM users WHERE department_id = ? AND role = \'officer\'').all(departmentId) as PublicUser[];
}

export function getDepartmentHeads(): PublicUser[] {
  const db = getDb();
  return db.prepare(`
    SELECT u.id, u.name, u.email, u.phone, u.role, u.department_id, u.verified, u.created_at
    FROM users u
    JOIN departments d ON d.head_user_id = u.id
  `).all() as PublicUser[];
}