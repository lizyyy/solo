import * as fs from 'fs';
import { ClientInfo, OwnerInfo } from './types';

export function loadClients(filePath: string): ClientInfo[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(content);
  
  const clients = Array.isArray(data) ? data : data.clients || data;
  
  return clients.map((c: any): ClientInfo => ({
    clientId: String(c.clientId || c.id || c.client_id),
    name: String(c.name || c.clientName || c.client_name),
    owner: String(c.owner || c.ownerName || c.owner_name || ''),
    department: c.department ? String(c.department) : undefined,
    versions: Array.isArray(c.versions) ? c.versions.map(String) : [],
    isInternal: Boolean(c.isInternal || c.internal || false),
  })).sort((a: ClientInfo, b: ClientInfo) => a.clientId.localeCompare(b.clientId));
}

export function loadOwners(filePath: string): OwnerInfo[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(content);
  
  const owners = Array.isArray(data) ? data : data.owners || data;
  
  return owners.map((o: any): OwnerInfo => ({
    name: String(o.name || o.ownerName || o.owner_name),
    email: String(o.email || o.mail || ''),
    slack: o.slack ? String(o.slack) : undefined,
    department: o.department ? String(o.department) : undefined,
  })).sort((a: OwnerInfo, b: OwnerInfo) => a.name.localeCompare(b.name));
}

export function createClientsMap(clients: ClientInfo[]): Map<string, ClientInfo> {
  const map = new Map<string, ClientInfo>();
  for (const client of clients) {
    map.set(client.clientId, client);
  }
  return map;
}

export function createOwnersMap(owners: OwnerInfo[]): Map<string, OwnerInfo> {
  const map = new Map<string, OwnerInfo>();
  for (const owner of owners) {
    map.set(owner.name.toLowerCase(), owner);
  }
  return map;
}

export function matchOwner(
  clientOwnerName: string,
  ownersMap: Map<string, OwnerInfo>
): OwnerInfo | undefined {
  const normalized = clientOwnerName.toLowerCase().trim();
  
  if (ownersMap.has(normalized)) {
    return ownersMap.get(normalized);
  }
  
  for (const [name, owner] of ownersMap) {
    if (name.includes(normalized) || normalized.includes(name)) {
      return owner;
    }
  }
  
  return undefined;
}
