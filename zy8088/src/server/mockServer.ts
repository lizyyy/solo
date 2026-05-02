import { WorkOrder, ServerConfig } from '../types';

let serverConfig: ServerConfig = {
  isOnline: true,
  isOpen: true,
  delay: 500
};

const sampleWorkOrders: WorkOrder[] = [
  {
    id: 'WO-001',
    title: '配电室日常巡检',
    description: '检查配电室设备运行状态',
    status: 'pending',
    photos: [
      { id: 'P001', url: 'https://picsum.photos/seed/1/200/200', caption: '配电柜外观', updatedAt: '2026-05-01T08:00:00Z' },
      { id: 'P002', url: 'https://picsum.photos/seed/2/200/200', caption: '电压表读数', updatedAt: '2026-05-01T08:05:00Z' }
    ],
    notes: '设备运行正常',
    version: 1,
    updatedAt: '2026-05-01T08:10:00Z',
    updatedBy: 'remote'
  },
  {
    id: 'WO-002',
    title: '消防设施检查',
    description: '检查消防栓和灭火器有效期',
    status: 'in_progress',
    photos: [
      { id: 'P003', url: 'https://picsum.photos/seed/3/200/200', caption: '消防栓', updatedAt: '2026-05-01T09:00:00Z' }
    ],
    notes: '需要更换灭火器',
    version: 2,
    updatedAt: '2026-05-01T09:30:00Z',
    updatedBy: 'remote'
  },
  {
    id: 'WO-003',
    title: '电梯月度保养',
    description: '电梯钢丝绳检查和润滑',
    status: 'completed',
    photos: [],
    notes: '已完成全部保养项目',
    version: 1,
    updatedAt: '2026-05-01T10:00:00Z',
    updatedBy: 'local'
  }
];

const serverData: Map<string, WorkOrder> = new Map(
  sampleWorkOrders.map(wo => [wo.id, { ...wo }])
);

export function getServerConfig(): ServerConfig {
  return { ...serverConfig };
}

export function setServerOnline(online: boolean): void {
  serverConfig.isOnline = online;
}

export function setServerOpen(open: boolean): void {
  serverConfig.isOpen = open;
}

export function setServerDelay(delay: number): void {
  serverConfig.delay = delay;
}

async function simulateNetworkDelay(): Promise<void> {
  if (serverConfig.delay > 0) {
    await new Promise(resolve => setTimeout(resolve, serverConfig.delay));
  }
}

export async function fetchWorkOrders(): Promise<WorkOrder[]> {
  await simulateNetworkDelay();

  if (!serverConfig.isOnline) {
    throw new Error('Network unavailable');
  }

  if (!serverConfig.isOpen) {
    throw new Error('Server closed for maintenance');
  }

  return Array.from(serverData.values()).map(wo => ({ ...wo }));
}

export async function fetchWorkOrder(id: string): Promise<WorkOrder | null> {
  await simulateNetworkDelay();

  if (!serverConfig.isOnline) {
    throw new Error('Network unavailable');
  }

  if (!serverConfig.isOpen) {
    throw new Error('Server closed for maintenance');
  }

  const wo = serverData.get(id);
  return wo ? { ...wo } : null;
}

export async function updateWorkOrder(
  id: string,
  updates: Partial<WorkOrder>,
  expectedVersion: number
): Promise<WorkOrder> {
  await simulateNetworkDelay();

  if (!serverConfig.isOnline) {
    throw new Error('Network unavailable');
  }

  if (!serverConfig.isOpen) {
    throw new Error('Server closed for maintenance');
  }

  const existing = serverData.get(id);

  if (!existing) {
    throw new Error('Work order not found');
  }

  if (existing.version !== expectedVersion) {
    throw new Error(`Version conflict: expected ${expectedVersion}, current ${existing.version}`);
  }

  const updated: WorkOrder = {
    ...existing,
    ...updates,
    version: existing.version + 1,
    updatedAt: new Date().toISOString(),
    updatedBy: 'remote'
  };

  serverData.set(id, updated);
  return { ...updated };
}

export async function createWorkOrder(
  wo: Omit<WorkOrder, 'id' | 'version' | 'updatedAt' | 'updatedBy'>
): Promise<WorkOrder> {
  await simulateNetworkDelay();

  if (!serverConfig.isOnline) {
    throw new Error('Network unavailable');
  }

  if (!serverConfig.isOpen) {
    throw new Error('Server closed for maintenance');
  }

  const id = `WO-${Date.now()}`;
  const newWo: WorkOrder = {
    ...wo,
    id,
    version: 1,
    updatedAt: new Date().toISOString(),
    updatedBy: 'remote'
  };

  serverData.set(id, newWo);
  return { ...newWo };
}

export async function closeWorkOrder(id: string, expectedVersion: number): Promise<WorkOrder> {
  await simulateNetworkDelay();

  if (!serverConfig.isOnline) {
    throw new Error('Network unavailable');
  }

  if (!serverConfig.isOpen) {
    throw new Error('Server closed for maintenance');
  }

  const existing = serverData.get(id);

  if (!existing) {
    throw new Error('Work order not found');
  }

  if (existing.status === 'closed') {
    throw new Error('Work order already closed');
  }

  return updateWorkOrder(id, { status: 'closed' }, expectedVersion);
}

export function getAllWorkOrders(): WorkOrder[] {
  return Array.from(serverData.values()).map(wo => ({ ...wo }));
}

export function resetServerData(): void {
  serverData.clear();
  sampleWorkOrders.forEach(wo => serverData.set(wo.id, { ...wo }));
}
