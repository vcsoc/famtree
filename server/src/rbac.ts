import type { Role } from "./types.js";

const roleOrder: Role[] = ["Visitor", "Arborist", "Ranger", "Warden", "Admin"];

export function hasRole(userRole: Role, required: Role) {
  return roleOrder.indexOf(userRole) >= roleOrder.indexOf(required);
}
