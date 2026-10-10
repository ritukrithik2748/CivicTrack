import { getDb, runInTransaction } from './database.js';
import { hashPassword } from '../auth/auth.js';
import { nowISO, setOffsetMs } from '../engines/clock.js';
import { randomUUID } from 'crypto';

export async function seedDatabase() {
  const db = getDb();
  
  // Check if already seeded - do this before transaction
  const count = db.prepare('SELECT COUNT(*) as cnt FROM users').get() as { cnt: number };
  if (count.cnt > 0) {
    console.log('Database already seeded, skipping...');
    return;
  }
  
  console.log('Seeding database...');
  
  // Hash password before transaction
  const passwordHash = await hashPassword('demo1234');
  
  return runInTransaction((tx) => {
    // Create departments
    const departments = [
      { id: randomUUID(), code: 'sewage_water', name: 'Sewage & Water', dependency_level: 1, head_user_id: null },
      { id: randomUUID(), code: 'storm_drainage', name: 'Storm Drainage', dependency_level: 2, head_user_id: null },
      { id: randomUUID(), code: 'electricity', name: 'Electricity', dependency_level: 3, head_user_id: null },
      { id: randomUUID(), code: 'telecom', name: 'Telecom', dependency_level: 3, head_user_id: null },
      { id: randomUUID(), code: 'roads', name: 'Roads', dependency_level: 4, head_user_id: null },
    ];
    
    for (const dept of departments) {
      tx.prepare(`
        INSERT INTO departments (id, code, name, dependency_level, head_user_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(dept.id, dept.code, dept.name, dept.dependency_level, dept.head_user_id, nowISO(), nowISO());
    }
    
    // Create contractors
    const contractors = [
      { id: randomUUID(), name: 'AquaFix Contractors', rating: 4.2 },
      { id: randomUUID(), name: 'VoltFlow Electrical', rating: 4.5 },
      { id: randomUUID(), name: 'ComCast Telecom', rating: 3.8 },
      { id: randomUUID(), name: 'RoadWorks Inc', rating: 4.0 },
      { id: randomUUID(), name: 'DrainMasters', rating: 4.1 },
      { id: randomUUID(), name: 'PipeLine Utilities', rating: 4.3 },
      { id: randomUUID(), name: 'GridPower Services', rating: 4.4 },
      { id: randomUUID(), name: 'CityBuild Construction', rating: 3.9 },
    ];
    
    for (const cont of contractors) {
      tx.prepare(`
        INSERT INTO contractors (id, name, rating, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(cont.id, cont.name, cont.rating, nowISO(), nowISO());
    }
    
    // Create demo users
    const demoUsers = [
      { id: randomUUID(), name: 'Demo Citizen 1', email: 'citizen@demo.com', phone: '+91 98765 43210', role: 'citizen', department_id: null },
      { id: randomUUID(), name: 'Demo Citizen 2', email: 'citizen2@demo.com', phone: '+91 98765 43211', role: 'citizen', department_id: null },
      { id: randomUUID(), name: 'Demo Citizen 3', email: 'citizen3@demo.com', phone: '+91 98765 43212', role: 'citizen', department_id: null },
      { id: randomUUID(), name: 'Sewage Officer', email: 'sewage@demo.com', phone: '+91 98765 43220', role: 'officer', department_id: departments[0].id },
      { id: randomUUID(), name: 'Drainage Officer', email: 'drainage@demo.com', phone: '+91 98765 43221', role: 'officer', department_id: departments[1].id },
      { id: randomUUID(), name: 'Electricity Officer', email: 'electricity@demo.com', phone: '+91 98765 43222', role: 'officer', department_id: departments[2].id },
      { id: randomUUID(), name: 'Telecom Officer', email: 'telecom@demo.com', phone: '+91 98765 43223', role: 'officer', department_id: departments[3].id },
      { id: randomUUID(), name: 'Roads Officer', email: 'roads@demo.com', phone: '+91 98765 43224', role: 'officer', department_id: departments[4].id },
      { id: randomUUID(), name: 'Admin User', email: 'admin@demo.com', phone: '+91 98765 43230', role: 'admin', department_id: null },
    ];
    
    for (const user of demoUsers) {
      tx.prepare(`
        INSERT INTO users (id, name, email, phone, password_hash, role, department_id, verified, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
      `).run(user.id, user.name, user.email, user.phone, passwordHash, user.role, user.department_id, nowISO(), nowISO());
      
      // Set department heads
      if (user.role === 'officer') {
        const deptIdx = ['sewage@demo.com', 'drainage@demo.com', 'electricity@demo.com', 'telecom@demo.com', 'roads@demo.com'].indexOf(user.email);
        if (deptIdx >= 0) {
          tx.prepare('UPDATE departments SET head_user_id = ? WHERE id = ?').run(user.id, departments[deptIdx].id);
        }
      }
    }
    
    // Create sample projects
    const projects = [
      {
        id: randomUUID(),
        title: 'Lake View Road Sewage Upgrade',
        purpose: 'Replace aging sewage pipelines to prevent leaks and improve capacity',
        department_id: departments[0].id, // Sewage & Water
        contractor_id: contractors[0].id, // AquaFix Contractors
        road_name: 'Lake View Road',
        ward: 'Ward 7',
        lat: 12.835,
        lng: 80.145,
        status: 'in_progress',
        claimed_status: 'in_progress',
        start_date: '2026-09-01',
        planned_end: '2026-10-15',
        actual_end: null,
        sanctioned_budget: 2500000,
        spent: 1800000,
        maintenance_budget: 500000,
        maintenance_spent: 200000,
        created_by: demoUsers[3].id, // Sewage Officer
      },
      {
        id: randomUUID(),
        title: '3rd Main Road Pot hole Repair',
        purpose: 'Fix multiple potholes causing traffic disruption',
        department_id: departments[4].id, // Roads
        contractor_id: contractors[3].id, // RoadWorks Inc
        road_name: '3rd Main Road',
        ward: 'Ward 7',
        lat: 12.832,
        lng: 80.142,
        status: 'planned',
        claimed_status: 'planned',
        start_date: '2026-10-20',
        planned_end: '2026-10-25',
        actual_end: null,
        sanctioned_budget: 500000,
        spent: 0,
        maintenance_budget: 100000,
        maintenance_spent: 0,
        created_by: demoUsers[8].id, // Roads Officer
      },
      {
        id: randomUUID(),
        title: 'Substation Maintenance - Electrical',
        purpose: 'Routine maintenance of electrical substation to prevent outages',
        department_id: departments[2].id, // Electricity
        contractor_id: contractors[1].id, // VoltFlow Electrical
        road_name: 'Substation Road',
        ward: 'Ward 7',
        lat: 12.838,
        lng: 80.150,
        status: 'completed',
        claimed_status: 'completed',
        start_date: '2026-08-01',
        planned_end: '2026-08-15',
        actual_end: '2026-08-14',
        sanctioned_budget: 300000,
        spent: 280000,
        maintenance_budget: 0,
        maintenance_spent: 0,
        created_by: demoUsers[6].id, // Electricity Officer
      },
      {
        id: randomUUID(),
        title: 'Fiber Optic Cable Installation',
        purpose: 'Upgrade telecom infrastructure with fiber optic cables',
        department_id: departments[3].id, // Telecom
        contractor_id: contractors[2].id, // ComCast Telecom
        road_name: 'Telecom Avenue',
        ward: 'Ward 7',
        lat: 12.840,
        lng: 80.155,
        status: 'delayed',
        claimed_status: 'in_progress',
        start_date: '2026-09-10',
        planned_end: '2026-09-30',
        actual_end: null,
        sanctioned_budget: 1500000,
        spent: 1200000,
        maintenance_budget: 0,
        maintenance_spent: 0,
        created_by: demoUsers[7].id, // Telecom Officer
      },
      {
        id: randomUUID(),
        title: 'Storm Drain Expansion Project',
        purpose: 'Expand drainage capacity to prevent flooding during monsoon',
        department_id: departments[1].id, // Storm Drainage
        contractor_id: contractors[4].id, // DrainMasters
        road_name: 'Monsoon Lane',
        ward: 'Ward 6',
        lat: 12.825,
        lng: 80.130,
        status: 'disputed',
        claimed_status: 'completed',
        start_date: '2026-07-15',
        planned_end: '2026-08-30',
        actual_end: '2026-08-25',
        sanctioned_budget: 800000,
        spent: 750000,
        maintenance_budget: 200000,
        maintenance_spent: 150000,
        created_by: demoUsers[4].id, // Drainage Officer
      },
    ];
    
    for (const proj of projects) {
      tx.prepare(`
        INSERT INTO projects (
          id, title, purpose, department_id, contractor_id, road_name, ward, 
          lat, lng, status, claimed_status, start_date, planned_end, actual_end,
          sanctioned_budget, spent, maintenance_budget, maintenance_spent,
          created_by, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
      `).run(
        proj.id, proj.title, proj.purpose, proj.department_id, proj.contractor_id,
        proj.road_name, proj.ward, proj.lat, proj.lng, proj.status, proj.claimed_status,
        proj.start_date, proj.planned_end, proj.actual_end,
        proj.sanctioned_budget, proj.spent, proj.maintenance_budget, proj.maintenance_spent,
        proj.created_by, nowISO(), nowISO()
      );
    }
    
    // Create some sample reports
    const reports = [
      {
        id: randomUUID(),
        user_id: demoUsers[0].id, // Citizen 1
        category: 'sewage_leak',
        department_id: departments[0].id, // Sewage & Water
        description: 'Sewage water leaking from pipe near Lake View Road intersection',
        lat: 12.834,
        lng: 80.144,
        location_source: 'device_gps',
        location_trust: 'high',
        location_flag: 'ok',
        weight: 1.0,
        status: 'open',
        image_hashes: JSON.stringify(['sample_hash_1']),
        created_at: nowISO(),
      },
      {
        id: randomUUID(),
        user_id: demoUsers[1].id, // Citizen 2
        category: 'pothole',
        department_id: departments[4].id, // Roads
        description: 'Large pothole on 3rd Main Road causing vehicle damage',
        lat: 12.833,
        lng: 80.143,
        location_source: 'exif',
        location_trust: 'high',
        location_flag: 'ok',
        weight: 1.0,
        status: 'open',
        image_hashes: JSON.stringify(['sample_hash_2']),
        created_at: nowISO(),
      },
      {
        id: randomUUID(),
        user_id: demoUsers[2].id, // Citizen 3
        category: 'live_wire',
        department_id: departments[2].id, // Electricity
        description: 'Exposed live wire on streetlight pole near Substation Road',
        lat: 12.839,
        lng: 80.149,
        location_source: 'manual_pin',
        location_trust: 'low',
        location_flag: 'ok',
        weight: 0.5,
        status: 'open',
        image_hashes: JSON.stringify(['sample_hash_3']),
        created_at: nowISO(),
      },
    ];
    
    for (const rep of reports) {
      tx.prepare(`
        INSERT INTO reports (
          id, user_id, category, department_id, description, lat, lng,
          location_source, location_trust, location_flag, weight, status,
          image_hashes, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
      `).run(
        rep.id, rep.user_id, rep.category, rep.department_id, rep.description,
        rep.lat, rep.lng, rep.location_source, rep.location_trust, rep.location_flag,
        rep.weight, rep.status, rep.image_hashes, rep.created_at, rep.created_at
      );
    }
    
    // Set demo location mode
    tx.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, datetime(\'now\'))')
      .run('demo_location_mode', 'true');
    
    console.log('Database seeding completed');
  });
}

// Run if called directly
const importUrl = import.meta.url.replace('file:///', '').replace(/\//g, '\\');
const arg1 = process.argv[1].replace(/\//g, '\\');
const isMain = importUrl === arg1;
console.log('Module loaded, import.meta.url:', import.meta.url);
console.log('process.argv[1]:', process.argv[1]);
console.log('Normalized import:', importUrl);
console.log('Normalized arg1:', arg1);
console.log('Is main:', isMain);
if (isMain) {
  console.log('Running seed directly');
  seedDatabase().catch(console.error);
}