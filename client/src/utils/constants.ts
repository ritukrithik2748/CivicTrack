export const API_URL = process.env.NODE_ENV === 'production'
  ? ''
  : 'http://localhost:5000';

export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  EXPLORE: '/explore',
  REPORT: '/report',
  MY_REPORTS: '/my-reports',
  VERIFY: '/verify',
  ALERTS: '/alerts',
  DISRUPTIONS: '/disruptions',
  ABOUT: '/about',
  DASHBOARD: '/dashboard',
  GROUPS: '/groups',
  GROUP_DETAIL: (id: string) => `/groups/${id}`,
  WORK_ORDERS: '/workorders',
  PROJECT_DETAIL: (id: string) => `/projects/${id}`,
  PROJECTS_MANAGE: '/projects/manage',
  ANALYTICS: '/analytics',
  ADMIN_SETTINGS: '/admin/settings',
  NOTIFICATIONS: '/notifications',
  CONFLICTS: '/conflicts',
};

export const DEMO_ACCOUNTS = [
  { email: 'citizen@demo.com', role: 'Citizen' },
  { email: 'citizen2@demo.com', role: 'Citizen' },
  { email: 'citizen3@demo.com', role: 'Citizen' },
  { email: 'sewage@demo.com', role: 'Sewage Officer' },
  { email: 'drainage@demo.com', role: 'Drainage Officer' },
  { email: 'electricity@demo.com', role: 'Electricity Officer' },
  { email: 'telecom@demo.com', role: 'Telecom Officer' },
  { email: 'roads@demo.com', role: 'Roads Officer' },
  { email: 'admin@demo.com', role: 'Admin' },
];

export const DEMO_PASSWORD = 'demo1234';