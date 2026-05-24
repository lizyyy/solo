import { ClientInfo, OwnerInfo } from './types';
export declare function loadClients(filePath: string): ClientInfo[];
export declare function loadOwners(filePath: string): OwnerInfo[];
export declare function createClientsMap(clients: ClientInfo[]): Map<string, ClientInfo>;
export declare function createOwnersMap(owners: OwnerInfo[]): Map<string, OwnerInfo>;
export declare function matchOwner(clientOwnerName: string, ownersMap: Map<string, OwnerInfo>): OwnerInfo | undefined;
