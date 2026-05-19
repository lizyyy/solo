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
exports.BACKUP_RETENTION_DAYS = exports.IDEMPOTENCY_TTL_HOURS = exports.DEFAULT_USER = exports.EQUIPMENT_CATEGORIES = exports.SENSITIVE_FIELDS = exports.ROLE_PERMISSIONS = exports.ROLES = exports.PERMISSIONS = exports.DB_VERSION = exports.EXPORT_DIR = exports.LOG_FILE = exports.DB_FILE = exports.DATA_DIR = void 0;
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const types_1 = require("./types");
exports.DATA_DIR = path.join(os.homedir(), '.exhibition-rental');
exports.DB_FILE = path.join(exports.DATA_DIR, 'database.json');
exports.LOG_FILE = path.join(exports.DATA_DIR, 'audit.log');
exports.EXPORT_DIR = path.join(exports.DATA_DIR, 'exports');
exports.DB_VERSION = '1.0.0';
exports.PERMISSIONS = {
    EQUIPMENT_VIEW: 'equipment:view',
    EQUIPMENT_EDIT: 'equipment:edit',
    EQUIPMENT_IMPORT: 'equipment:import',
    BOOTH_VIEW: 'booth:view',
    BOOTH_EDIT: 'booth:edit',
    RENTAL_CREATE: 'rental:create',
    RENTAL_VIEW: 'rental:view',
    RENTAL_CONFIRM: 'rental:confirm',
    RENTAL_RETURN: 'rental:return',
    TRANSFER_CREATE: 'transfer:create',
    DAMAGE_REPORT: 'damage:report',
    AUDIT_VIEW: 'audit:view',
    EXPORT: 'export',
    ADMIN: 'admin'
};
exports.ROLES = {
    ADMIN: 'admin',
    MANAGER: 'manager',
    OPERATOR: 'operator',
    VIEWER: 'viewer'
};
exports.ROLE_PERMISSIONS = {
    [exports.ROLES.ADMIN]: Object.values(exports.PERMISSIONS),
    [exports.ROLES.MANAGER]: [
        exports.PERMISSIONS.EQUIPMENT_VIEW,
        exports.PERMISSIONS.EQUIPMENT_EDIT,
        exports.PERMISSIONS.EQUIPMENT_IMPORT,
        exports.PERMISSIONS.BOOTH_VIEW,
        exports.PERMISSIONS.BOOTH_EDIT,
        exports.PERMISSIONS.RENTAL_CREATE,
        exports.PERMISSIONS.RENTAL_VIEW,
        exports.PERMISSIONS.RENTAL_CONFIRM,
        exports.PERMISSIONS.RENTAL_RETURN,
        exports.PERMISSIONS.TRANSFER_CREATE,
        exports.PERMISSIONS.DAMAGE_REPORT,
        exports.PERMISSIONS.AUDIT_VIEW,
        exports.PERMISSIONS.EXPORT
    ],
    [exports.ROLES.OPERATOR]: [
        exports.PERMISSIONS.EQUIPMENT_VIEW,
        exports.PERMISSIONS.BOOTH_VIEW,
        exports.PERMISSIONS.RENTAL_CREATE,
        exports.PERMISSIONS.RENTAL_VIEW,
        exports.PERMISSIONS.RENTAL_RETURN,
        exports.PERMISSIONS.TRANSFER_CREATE,
        exports.PERMISSIONS.DAMAGE_REPORT
    ],
    [exports.ROLES.VIEWER]: [
        exports.PERMISSIONS.EQUIPMENT_VIEW,
        exports.PERMISSIONS.BOOTH_VIEW,
        exports.PERMISSIONS.RENTAL_VIEW
    ]
};
exports.SENSITIVE_FIELDS = [
    {
        fields: ['contactPhone'],
        maskPattern: '****',
        roles: [exports.ROLES.ADMIN, exports.ROLES.MANAGER]
    },
    {
        fields: ['supplier'],
        maskPattern: '***',
        roles: [exports.ROLES.ADMIN, exports.ROLES.MANAGER]
    },
    {
        fields: ['pricePerDay'],
        maskPattern: '***',
        roles: [exports.ROLES.ADMIN, exports.ROLES.MANAGER]
    }
];
exports.EQUIPMENT_CATEGORIES = {
    [types_1.EquipmentType.TRUSS]: '桁架',
    [types_1.EquipmentType.LIGHT]: '灯具',
    [types_1.EquipmentType.SCREEN]: '屏幕'
};
exports.DEFAULT_USER = {
    userId: 'default-user',
    userName: 'System',
    role: exports.ROLES.ADMIN,
    permissions: exports.ROLE_PERMISSIONS[exports.ROLES.ADMIN]
};
exports.IDEMPOTENCY_TTL_HOURS = 72;
exports.BACKUP_RETENTION_DAYS = 30;
