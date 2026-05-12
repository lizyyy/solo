export interface Batch {
  id: string;
  name: string;
  status: 'open' | 'in_progress' | 'closed';
  created_at: string;
  updated_at: string;
  description?: string;
  tenant_count?: number;
  passed_count?: number;
  failed_count?: number;
}

export interface Tenant {
  id: string;
  batch_id: string;
  tenant_id: string;
  tenant_name: string;
  status: 'pending' | 'in_progress' | 'passed' | 'failed';
  created_at: string;
  updated_at: string;
  pending_diffs?: number;
  retry_diffs?: number;
  business_diffs?: number;
  unswitched_callbacks?: number;
  frozen_tasks?: number;
}

export interface Diff {
  id: string;
  tenant_id: string;
  type: 'data' | 'permission' | 'task' | 'callback';
  status: 'pending' | 'confirmed' | 'retry' | 'business_decision';
  conclusion?: string;
  created_at: string;
  updated_at: string;
  has_manual_conclusion: number;
}

export interface Callback {
  id: string;
  tenant_id: string;
  service_name: string;
  old_url: string;
  new_url: string;
  is_switched: number;
  switched_at?: string;
}

export interface Task {
  id: string;
  tenant_id: string;
  task_name: string;
  task_type: string;
  is_frozen: number;
  frozen_at?: string;
  unfrozen_at?: string;
}

export interface Snapshot {
  id: string;
  tenant_id: string;
  environment: 'old' | 'new';
  imported_at: string;
  data: string;
}

export interface TenantDetail extends Tenant {
  snapshots: Snapshot[];
  diffs: Diff[];
  callbacks: Callback[];
  tasks: Task[];
}

export interface BatchDetail extends Batch {
  tenants: Tenant[];
}
