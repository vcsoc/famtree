export type Role = "Admin" | "Warden" | "Ranger" | "Arborist" | "Visitor";

export type UserRecord = {
  id: string;
  email: string;
  password_hash: string;
  role: Role;
  tenant_id: string | null;
};

export type TenantRecord = {
  id: string;
  name: string;
};

export type ForestRecord = {
  id: string;
  tenant_id: string;
  name: string;
  created_by: string;
};

export type TreeRecord = {
  id: string;
  forest_id: string;
  name: string;
  created_by: string;
};
