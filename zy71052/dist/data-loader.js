"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadClients = loadClients;
exports.loadOwners = loadOwners;
exports.createClientsMap = createClientsMap;
exports.createOwnersMap = createOwnersMap;
exports.matchOwner = matchOwner;
const fs = __importStar(require("fs"));
function loadClients(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    const clients = Array.isArray(data) ? data : data.clients || data;
    return clients.map((c) => ({
        clientId: String(c.clientId || c.id || c.client_id),
        name: String(c.name || c.clientName || c.client_name),
        owner: String(c.owner || c.ownerName || c.owner_name || ''),
        department: c.department ? String(c.department) : undefined,
        versions: Array.isArray(c.versions) ? c.versions.map(String) : [],
        isInternal: Boolean(c.isInternal || c.internal || false),
    })).sort((a, b) => a.clientId.localeCompare(b.clientId));
}
function loadOwners(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    const owners = Array.isArray(data) ? data : data.owners || data;
    return owners.map((o) => ({
        name: String(o.name || o.ownerName || o.owner_name),
        email: String(o.email || o.mail || ''),
        slack: o.slack ? String(o.slack) : undefined,
        department: o.department ? String(o.department) : undefined,
    })).sort((a, b) => a.name.localeCompare(b.name));
}
function createClientsMap(clients) {
    const map = new Map();
    for (const client of clients) {
        map.set(client.clientId, client);
    }
    return map;
}
function createOwnersMap(owners) {
    const map = new Map();
    for (const owner of owners) {
        map.set(owner.name.toLowerCase(), owner);
    }
    return map;
}
function matchOwner(clientOwnerName, ownersMap) {
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
//# sourceMappingURL=data-loader.js.map