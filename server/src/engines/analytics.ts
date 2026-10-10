import { getDb } from '../db/database.js';
import { now, DAY_MS } from './clock.js';

const WARNING_REPORTS = 5;
const WARNING_DAYS = 7;

export function getHeatmapData(): { lat: number; lng: number; weight: number }[] {
  const db = getDb();
  return db.prepare(`
    SELECT lat, lng, weight FROM reports
    WHERE status IN ('open', 'acknowledged', 'in_progress', 'reopened')
  `).all() as { lat: number; lng: number; weight: number }[];
}

export function getHotspots(limit: number = 10): any[] {
  const db = getDb();
  return db.prepare(`
    SELECT pg.*, s.lat, s.lng, d.name as department_name
    FROM problem_groups pg
    JOIN spots s ON s.id = pg.spot_id
    JOIN departments d ON d.id = pg.department_id
    WHERE pg.status IN ('open', 'acknowledged', 'in_progress')
    ORDER BY pg.weighted_count DESC, pg.first_reported_at ASC
    LIMIT ?
  `).all(limit);
}

export function getDepartmentScorecards(): any[] {
  const db = getDb();
  const departments = db.prepare('SELECT id, code, name FROM departments').all() as any[];
  
  return departments.map(dept => {
    const projects = db.prepare('SELECT * FROM projects WHERE department_id = ?').all(dept.id) as any[];
    const reports = db.prepare('SELECT * FROM reports WHERE department_id = ?').all(dept.id) as any[];
    const workOrders = db.prepare(`
      SELECT woi.* FROM work_order_items woi
      JOIN work_orders wo ON wo.id = woi.work_order_id
      WHERE woi.department_id = ?
    `).all(dept.id) as any[];
    
    const totalProjects = projects.length;
    const completedProjects = projects.filter(p => p.status === 'completed').length;
    const delayedProjects = projects.filter(p => p.status === 'delayed').length;
    const overBudgetProjects = projects.filter(p => p.spent > p.sanctioned_budget).length;
    
    const totalBudget = projects.reduce((sum, p) => sum + (p.sanctioned_budget || 0), 0);
    const totalSpent = projects.reduce((sum, p) => sum + (p.spent || 0), 0);
    const budgetVariance = totalBudget > 0 ? ((totalSpent - totalBudget) / totalBudget) * 100 : 0;
    
    const acknowledgedReports = reports.filter(r => r.status !== 'open').length;
    const avgResponseTime = acknowledgedReports > 0 
      ? reports.filter(r => r.status !== 'open').reduce((sum, r) => {
          const created = new Date(r.created_at).getTime();
          // We don't have acknowledgement time, so use a proxy
          return sum + 0;
        }, 0) / acknowledgedReports
      : 0;
    
    const repeatIssueRate = 0; // Would need more complex calculation
    
    const completedWorkOrders = workOrders.filter(w => w.status === 'complete').length;
    const overdueWorkOrders = workOrders.filter(w => w.status === 'overdue').length;
    const delayRate = workOrders.length > 0 ? (overdueWorkOrders / workOrders.length) * 100 : 0;
    
    return {
      department_id: dept.id,
      department_code: dept.code,
      department_name: dept.name,
      total_projects: totalProjects,
      completed_projects: completedProjects,
      delayed_projects: delayedProjects,
      over_budget_projects: overBudgetProjects,
      total_budget: totalBudget,
      total_spent: totalSpent,
      budget_variance_pct: Math.round(budgetVariance * 100) / 100,
      total_reports: reports.length,
      avg_response_time_hours: Math.round(avgResponseTime),
      repeat_issue_rate: repeatIssueRate,
      delay_rate_pct: Math.round(delayRate * 100) / 100,
    };
  });
}

export function getContractorScorecards(): any[] {
  const db = getDb();
  const contractors = db.prepare('SELECT id, name, rating FROM contractors').all() as any[];
  
  return contractors.map(contractor => {
    const projects = db.prepare('SELECT * FROM projects WHERE contractor_id = ?').all(contractor.id) as any[];
    
    const totalProjects = projects.length;
    const completedProjects = projects.filter(p => p.status === 'completed').length;
    const delayedProjects = projects.filter(p => p.status === 'delayed').length;
    const overBudgetProjects = projects.filter(p => p.spent > p.sanctioned_budget).length;
    
    const totalBudget = projects.reduce((sum, p) => sum + (p.sanctioned_budget || 0), 0);
    const totalSpent = projects.reduce((sum, p) => sum + (p.spent || 0), 0);
    const budgetVariance = totalBudget > 0 ? ((totalSpent - totalBudget) / totalBudget) * 100 : 0;
    
    return {
      contractor_id: contractor.id,
      contractor_name: contractor.name,
      rating: contractor.rating,
      total_projects: totalProjects,
      completed_projects: completedProjects,
      delayed_projects: delayedProjects,
      over_budget_projects: overBudgetProjects,
      total_budget: totalBudget,
      total_spent: totalSpent,
      budget_variance_pct: Math.round(budgetVariance * 100) / 100,
    };
  });
}

export function getBudgetSummary(): any {
  const db = getDb();
  
  const byDepartment = db.prepare(`
    SELECT d.code, d.name, 
           SUM(p.sanctioned_budget) as sanctioned,
           SUM(p.spent) as spent,
           SUM(p.maintenance_budget) as maintenance_budget,
           SUM(p.maintenance_spent) as maintenance_spent
    FROM projects p
    JOIN departments d ON d.id = p.department_id
    GROUP BY d.id
  `).all();
  
  const byContractor = db.prepare(`
    SELECT c.name,
           SUM(p.sanctioned_budget) as sanctioned,
           SUM(p.spent) as spent
    FROM projects p
    JOIN contractors c ON c.id = p.contractor_id
    GROUP BY c.id
  `).all();
  
  const byWard = db.prepare(`
    SELECT ward,
           SUM(sanctioned_budget) as sanctioned,
           SUM(spent) as spent
    FROM projects
    WHERE ward IS NOT NULL
    GROUP BY ward
  `).all();
  
  const totals = db.prepare(`
    SELECT SUM(sanctioned_budget) as sanctioned, SUM(spent) as spent,
           SUM(maintenance_budget) as maintenance_budget, SUM(maintenance_spent) as maintenance_spent
    FROM projects
  `).get();
  
  return { byDepartment, byContractor, byWard, totals };
}

export function getDelayHistory(): any[] {
  const db = getDb();
  return db.prepare(`
    SELECT pd.*, p.title as project_title, u.name as changed_by_name
    FROM project_delays pd
    JOIN projects p ON p.id = pd.project_id
    JOIN users u ON u.id = pd.changed_by
    ORDER BY pd.changed_at DESC
  `).all();
}

export function checkEarlyWarnings(): any[] {
  const db = getDb();
  const since = new Date(now().getTime() - WARNING_DAYS * DAY_MS).toISOString();
  
  // Check projects
  const projectWarnings = db.prepare(`
    SELECT p.id, p.title, p.department_id, COUNT(r.id) as report_count
    FROM projects p
    JOIN reports r ON r.project_id = p.id
    WHERE r.created_at >= ?
    GROUP BY p.id
    HAVING report_count >= ?
  `).all(since, WARNING_REPORTS) as any[];
  
  // Check problem groups
  const groupWarnings = db.prepare(`
    SELECT pg.id, pg.category, pg.department_id, pg.spot_id, COUNT(r.id) as report_count
    FROM problem_groups pg
    JOIN reports r ON r.group_id = pg.id
    WHERE r.created_at >= ?
    GROUP BY pg.id
    HAVING report_count >= ?
  `).all(since, WARNING_REPORTS) as any[];
  
  const warnings: any[] = [];
  
  for (const pw of projectWarnings) {
    const dept = db.prepare('SELECT head_user_id FROM departments WHERE id = ?').get(pw.department_id) as { head_user_id: string | null } | undefined;
    if (dept?.head_user_id) {
      warnings.push({
        type: 'project',
        entity_id: pw.id,
        entity_title: pw.title,
        department_id: pw.department_id,
        report_count: pw.report_count,
        notify_user_id: dept.head_user_id,
      });
    }
  }
  
  for (const gw of groupWarnings) {
    const dept = db.prepare('SELECT head_user_id FROM departments WHERE id = ?').get(gw.department_id) as { head_user_id: string | null } | undefined;
    if (dept?.head_user_id) {
      warnings.push({
        type: 'problem_group',
        entity_id: gw.id,
        entity_title: gw.category,
        department_id: gw.department_id,
        report_count: gw.report_count,
        notify_user_id: dept.head_user_id,
      });
    }
  }
  
  return warnings;
}

export function sendEarlyWarningNotifications(): number {
  const warnings = checkEarlyWarnings();
  const db = getDb();
  let sent = 0;
  
  for (const warning of warnings) {
    // Check if already notified recently
    const existing = db.prepare(`
      SELECT id FROM notifications
      WHERE user_id = ? AND type = 'early_warning' AND link LIKE ?
      AND created_at > datetime('now', '-1 day')
    `).get(warning.notify_user_id, `%${warning.entity_id}%`);
    
    if (!existing) {
      db.prepare(`
        INSERT INTO notifications (id, user_id, type, title, body, link, read, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 0, datetime('now'))
      `).run(randomUUID(), warning.notify_user_id, 'early_warning', 'Early Warning: High Complaint Volume',
        `${warning.report_count} complaints in ${WARNING_DAYS} days for ${warning.entity_title}`,
        warning.type === 'project' ? `/projects/${warning.entity_id}` : `/groups/${warning.entity_id}`);
      sent++;
    }
  }
  
  return sent;
}

function randomUUID(): string {
  return crypto.randomUUID();
}

export function getAnalyticsConfig(): { warningReports: number; warningDays: number } {
  return { warningReports: WARNING_REPORTS, warningDays: WARNING_DAYS };
}