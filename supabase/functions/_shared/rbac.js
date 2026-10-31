// Ren behörighetslogik för admin-users. Inga externa anrop.

export const VALID_ROLES = ["superadmin", "admin", "employee", "intern"];
// Verifierade behörighets-id i UsersPanel.jsx: <område>:<read|write|delete>
const PERMISSION_RE = /^[a-z_]+:(read|write|delete)$/;
const ROLE_RANK = { superadmin: 3, admin: 2, employee: 1, intern: 0 };

/** Behåller bara välformade, unika behörigheter. Intern får aldrig write/delete. */
export function sanitizePermissions(permissions, role) {
  if (!Array.isArray(permissions)) return [];
  const out = [];
  for (const p of permissions) {
    if (typeof p !== "string" || !PERMISSION_RE.test(p) || out.includes(p)) continue;
    if (role === "intern" && (p.endsWith(":write") || p.endsWith(":delete"))) continue;
    out.push(p);
  }
  return out;
}

export function isValidRole(role) {
  return typeof role === "string" && VALID_ROLES.includes(role);
}

/** Admin får endast hantera employee/intern (eller sig själv); superadmin får hantera alla. */
export function canManageTarget(callerRole, targetRole, isSelf = false) {
  if (callerRole === "superadmin") return true;
  if (callerRole !== "admin") return false;
  if (isSelf) return true;
  return (ROLE_RANK[targetRole] ?? 99) < ROLE_RANK.admin;
}
