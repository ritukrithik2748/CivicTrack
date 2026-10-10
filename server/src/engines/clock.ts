import { getDb } from '../db/database.js';

const CLOCK_OFFSET_KEY = 'clock_offset_ms';

let clockOffsetMs = 0;

function loadOffset(): void {
  const db = getDb();
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(CLOCK_OFFSET_KEY) as { value: string } | undefined;
  if (row) {
    clockOffsetMs = parseInt(row.value, 10) || 0;
  }
}

function saveOffset(offsetMs: number): void {
  const db = getDb();
  db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, datetime(\'now\'))')
    .run(CLOCK_OFFSET_KEY, String(offsetMs));
  clockOffsetMs = offsetMs;
}

export function now(): Date {
  return new Date(Date.now() + clockOffsetMs);
}

export function nowISO(): string {
  return now().toISOString();
}

export function getOffsetMs(): number {
  return clockOffsetMs;
}

export function setOffsetMs(offsetMs: number): void {
  saveOffset(offsetMs);
}

export function addOffsetMs(deltaMs: number): void {
  saveOffset(clockOffsetMs + deltaMs);
}

export function resetOffset(): void {
  saveOffset(0);
}

export function initClock(): void {
  loadOffset();
}

export const HOUR_MS = 60 * 60 * 1000;
export const DAY_MS = 24 * HOUR_MS;

export function formatDuration(ms: number): string {
  if (ms < 0) return '0s';
  const days = Math.floor(ms / DAY_MS);
  const hours = Math.floor((ms % DAY_MS) / HOUR_MS);
  const minutes = Math.floor((ms % HOUR_MS) / (60 * 1000));
  const seconds = Math.floor((ms % (60 * 1000)) / 1000);
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);
  return parts.join(' ');
}

function toRad(deg: number): number {
  return deg * Math.PI / 180;
}

export function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // Earth radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}