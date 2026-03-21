const ROLE_PERMISSIONS = {
  admin: ['*'],
  manager: [
    'dashboard:read',
    'analytics:read',
    'employees:read',
    'employees:write',
    'projects:read',
    'projects:write',
    'tasks:read',
    'tasks:write',
    'leads:read',
    'leads:write',
    'leads:delete',
    'customers:read',
    'customers:write',
    'customers:delete',
    'deals:read',
    'deals:write',
    'deals:delete',
    'notifications:read'
  ],
  sales: [
    'dashboard:read',
    'leads:read',
    'leads:write',
    'leads:delete',
    'customers:read',
    'customers:write',
    'customers:delete',
    'deals:read',
    'deals:write',
    'deals:delete',
    'tasks:read',
    'notifications:read'
  ],
  lead: [
    'dashboard:read',
    'analytics:read',
    'employees:read',
    'employees:write',
    'projects:read',
    'tasks:read',
    'tasks:write',
    'leads:read',
    'leads:write',
    'leads:delete',
    'customers:read',
    'customers:write',
    'customers:delete',
    'deals:read',
    'deals:write',
    'deals:delete',
    'notifications:read'
  ],
  employee: ['dashboard:read', 'projects:read', 'tasks:read', 'tasks:update-own', 'notifications:read'],
  customer: ['dashboard:read', 'projects:read-own', 'tasks:read-own-project', 'notifications:read']
};

export function hasPermission(role, permission) {
  const allowed = ROLE_PERMISSIONS[role] || [];
  return allowed.includes('*') || allowed.includes(permission);
}

export function canAccess(role, permissions = []) {
  if (!Array.isArray(permissions) || permissions.length === 0) return true;
  return permissions.some((perm) => hasPermission(role, perm));
}

export { ROLE_PERMISSIONS };
