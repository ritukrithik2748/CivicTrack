-- CivicTrack Database Schema
-- SQLite with WAL mode, foreign keys ON


-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('citizen', 'officer', 'admin')),
  department_id TEXT,
  verified INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_department ON users(department_id);

-- Departments table
CREATE TABLE IF NOT EXISTS departments (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  dependency_level INTEGER NOT NULL,
  head_user_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (head_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_departments_level ON departments(dependency_level);

-- Contractors table
CREATE TABLE IF NOT EXISTS contractors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  rating REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  purpose TEXT,
  department_id TEXT NOT NULL,
  contractor_id TEXT,
  road_name TEXT,
  ward TEXT,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('planned', 'in_progress', 'completed', 'delayed', 'disputed')),
  claimed_status TEXT NOT NULL CHECK (claimed_status IN ('planned', 'in_progress', 'completed')) DEFAULT 'planned',
  start_date TEXT,
  planned_end TEXT,
  actual_end TEXT,
  sanctioned_budget REAL NOT NULL DEFAULT 0,
  spent REAL NOT NULL DEFAULT 0,
  maintenance_budget REAL NOT NULL DEFAULT 0,
  maintenance_spent REAL NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT,
  FOREIGN KEY (contractor_id) REFERENCES contractors(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_department ON projects(department_id);
CREATE INDEX IF NOT EXISTS idx_projects_ward ON projects(ward);
CREATE INDEX IF NOT EXISTS idx_projects_location ON projects(lat, lng);
CREATE INDEX IF NOT EXISTS idx_projects_dates ON projects(start_date, planned_end);

-- Project delays table
CREATE TABLE IF NOT EXISTS project_delays (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  old_end TEXT NOT NULL,
  new_end TEXT NOT NULL,
  reason TEXT NOT NULL,
  changed_by TEXT NOT NULL,
  changed_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_project_delays_project ON project_delays(project_id);

-- Project updates table (timeline entries)
CREATE TABLE IF NOT EXISTS project_updates (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  status TEXT NOT NULL,
  note TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_project_updates_project ON project_updates(project_id);

-- Reports table
CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  category TEXT NOT NULL,
  department_id TEXT NOT NULL,
  description TEXT,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  location_source TEXT NOT NULL CHECK (location_source IN ('exif', 'device_gps', 'manual_pin')),
  location_trust TEXT NOT NULL CHECK (location_trust IN ('high', 'low')),
  location_flag TEXT NOT NULL CHECK (location_flag IN ('ok', 'unverified')),
  weight REAL NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open', 'acknowledged', 'in_progress', 'resolved', 'reopened')) DEFAULT 'open',
  group_id TEXT,
  project_id TEXT,
  image_hashes TEXT, -- JSON array of hashes
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT,
  FOREIGN KEY (group_id) REFERENCES problem_groups(id) ON DELETE SET NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_reports_user ON reports(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_department ON reports(department_id);
CREATE INDEX IF NOT EXISTS idx_reports_location ON reports(lat, lng);
CREATE INDEX IF NOT EXISTS idx_reports_group ON reports(group_id);
CREATE INDEX IF NOT EXISTS idx_reports_category ON reports(category);

-- Report photos table
CREATE TABLE IF NOT EXISTS report_photos (
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL,
  path TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  bytes INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_report_photos_hash ON report_photos(sha256);
CREATE INDEX IF NOT EXISTS idx_report_photos_report ON report_photos(report_id);

-- Report replies table
CREATE TABLE IF NOT EXISTS report_replies (
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_report_replies_report ON report_replies(report_id);

-- Spots table (location clusters)
CREATE TABLE IF NOT EXISTS spots (
  id TEXT PRIMARY KEY,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  radius_m REAL NOT NULL DEFAULT 50,
  label TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_spots_location ON spots(lat, lng);

-- Problem groups table
CREATE TABLE IF NOT EXISTS problem_groups (
  id TEXT PRIMARY KEY,
  spot_id TEXT NOT NULL,
  category TEXT NOT NULL,
  department_id TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('minor', 'moderate', 'major')),
  report_count INTEGER NOT NULL DEFAULT 0,
  weighted_count REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('open', 'acknowledged', 'in_progress', 'resolved', 'reopened')) DEFAULT 'open',
  first_reported_at TEXT NOT NULL,
  last_reported_at TEXT NOT NULL,
  stalled_since TEXT,
  severity_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (spot_id) REFERENCES spots(id) ON DELETE CASCADE,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_problem_groups_spot ON problem_groups(spot_id);
CREATE INDEX IF NOT EXISTS idx_problem_groups_department ON problem_groups(department_id);
CREATE INDEX IF NOT EXISTS idx_problem_groups_severity ON problem_groups(severity);
CREATE INDEX IF NOT EXISTS idx_problem_groups_status ON problem_groups(status);

-- Work orders table
CREATE TABLE IF NOT EXISTS work_orders (
  id TEXT PRIMARY KEY,
  spot_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'active', 'completed', 'cancelled')) DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (spot_id) REFERENCES spots(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_work_orders_spot ON work_orders(spot_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_status ON work_orders(status);

-- Work order items table
CREATE TABLE IF NOT EXISTS work_order_items (
  id TEXT PRIMARY KEY,
  work_order_id TEXT NOT NULL,
  group_id TEXT NOT NULL,
  department_id TEXT NOT NULL,
  sequence_no INTEGER NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('primary', 'secondary', 'parallel')),
  tie_break_reason TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'scheduled', 'in_progress', 'complete', 'overdue')) DEFAULT 'pending',
  expected_complete_at TEXT,
  scheduled_start_at TEXT,
  started_at TEXT,
  completed_at TEXT,
  escalation_level INTEGER NOT NULL DEFAULT 0,
  delay_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (work_order_id) REFERENCES work_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (group_id) REFERENCES problem_groups(id) ON DELETE RESTRICT,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_work_order_items_work_order ON work_order_items(work_order_id);
CREATE INDEX IF NOT EXISTS idx_work_order_items_department ON work_order_items(department_id);
CREATE INDEX IF NOT EXISTS idx_work_order_items_status ON work_order_items(status);
CREATE INDEX IF NOT EXISTS idx_work_order_items_sequence ON work_order_items(work_order_id, sequence_no);

-- Verifications table
CREATE TABLE IF NOT EXISTS verifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  status_type TEXT NOT NULL CHECK (status_type IN ('in_progress', 'completed')),
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  accuracy_m REAL NOT NULL,
  distance_m REAL NOT NULL,
  photo_path TEXT,
  sha256 TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE RESTRICT,
  UNIQUE(user_id, project_id, status_type)
);

CREATE INDEX IF NOT EXISTS idx_verifications_project ON verifications(project_id);
CREATE INDEX IF NOT EXISTS idx_verifications_user ON verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_verifications_status_type ON verifications(status_type);

-- Subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('ward', 'circle', 'road')),
  ward TEXT,
  center_lat REAL,
  center_lng REAL,
  radius_m REAL,
  road_name TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  link TEXT,
  read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_id, read);

-- Escalations table
CREATE TABLE IF NOT EXISTS escalations (
  id TEXT PRIMARY KEY,
  work_order_item_id TEXT NOT NULL,
  level INTEGER NOT NULL CHECK (level IN (1, 2)),
  notified_user_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (work_order_item_id) REFERENCES work_order_items(id) ON DELETE CASCADE,
  FOREIGN KEY (notified_user_id) REFERENCES users(id) ON DELETE RESTRICT,
  UNIQUE(work_order_item_id, level)
);

CREATE INDEX IF NOT EXISTS idx_escalations_item ON escalations(work_order_item_id);

-- Conflicts table
CREATE TABLE IF NOT EXISTS conflicts (
  id TEXT PRIMARY KEY,
  project_a TEXT NOT NULL,
  project_b TEXT NOT NULL,
  distance_m REAL,
  gap_days INTEGER,
  suggestion TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open', 'acknowledged', 'resolved', 'merged')) DEFAULT 'open',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (project_a) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (project_b) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_conflicts_project_a ON conflicts(project_a);
CREATE INDEX IF NOT EXISTS idx_conflicts_project_b ON conflicts(project_b);
CREATE INDEX IF NOT EXISTS idx_conflicts_status ON conflicts(status);

-- Settings table
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Audit log table
CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  actor_id TEXT,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  detail_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);

-- Triggers for updated_at
CREATE TRIGGER IF NOT EXISTS trg_users_updated
AFTER UPDATE ON users
BEGIN
  UPDATE users SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_departments_updated
AFTER UPDATE ON departments
BEGIN
  UPDATE departments SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_contractors_updated
AFTER UPDATE ON contractors
BEGIN
  UPDATE contractors SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_projects_updated
AFTER UPDATE ON projects
BEGIN
  UPDATE projects SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_spots_updated
AFTER UPDATE ON spots
BEGIN
  UPDATE spots SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_problem_groups_updated
AFTER UPDATE ON problem_groups
BEGIN
  UPDATE problem_groups SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_work_orders_updated
AFTER UPDATE ON work_orders
BEGIN
  UPDATE work_orders SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_work_order_items_updated
AFTER UPDATE ON work_order_items
BEGIN
  UPDATE work_order_items SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_settings_updated
AFTER UPDATE ON settings
BEGIN
  UPDATE settings SET updated_at = datetime('now') WHERE key = NEW.key;
END;
