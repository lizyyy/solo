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
exports.writeJsonFile = exports.readJsonFile = exports.createMaterial = exports.createSample = void 0;
const uuid_1 = require("uuid");
const fs = __importStar(require("fs"));
const createSample = (data) => {
    const now = new Date().toISOString();
    return {
        id: data.id || (0, uuid_1.v4)(),
        name: data.name || `样品-${Date.now()}`,
        type: (data.type || 'general'),
        description: data.description || '',
        originCountry: data.originCountry || 'CN',
        destinationCountry: data.destinationCountry || 'US',
        value: data.value || 0,
        currency: data.currency || 'USD',
        quantity: data.quantity || 1,
        materials: data.materials || [],
        createdAt: data.createdAt || now,
        updatedAt: now
    };
};
exports.createSample = createSample;
const createMaterial = (data) => {
    return {
        id: data.id || (0, uuid_1.v4)(),
        type: (data.type || 'invoice'),
        name: data.name || '',
        filePath: data.filePath || '',
        uploadedAt: data.uploadedAt || new Date().toISOString(),
        valid: data.valid !== undefined ? data.valid : true,
        notes: data.notes
    };
};
exports.createMaterial = createMaterial;
const readJsonFile = (filePath) => {
    if (!fs.existsSync(filePath))
        return null;
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
    catch {
        return null;
    }
};
exports.readJsonFile = readJsonFile;
const writeJsonFile = (filePath, data) => {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
};
exports.writeJsonFile = writeJsonFile;
