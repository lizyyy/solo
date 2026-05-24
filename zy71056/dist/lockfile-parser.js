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
exports.parseLockfile = parseLockfile;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const yarnLockfile = __importStar(require("@yarnpkg/lockfile"));
function parseLockfile(cwd) {
    const packageLockPath = path.join(cwd, 'package-lock.json');
    const yarnLockPath = path.join(cwd, 'yarn.lock');
    if (fs.existsSync(packageLockPath)) {
        return parsePackageLock(packageLockPath);
    }
    else if (fs.existsSync(yarnLockPath)) {
        return parseYarnLock(yarnLockPath);
    }
    throw new Error('未找到 package-lock.json 或 yarn.lock');
}
function parsePackageLock(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    const packages = new Map();
    if (data.packages) {
        for (const [pkgPath, pkgData] of Object.entries(data.packages)) {
            if (pkgPath === '')
                continue;
            const name = pkgData.name || pkgPath.replace(/^node_modules\//, '');
            const version = pkgData.version;
            if (version) {
                packages.set(`${name}@${version}`, {
                    name,
                    version,
                    license: pkgData.license,
                    dependencies: pkgData.dependencies,
                });
            }
        }
    }
    return packages;
}
function parseYarnLock(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = yarnLockfile.parse(content);
    if (parsed.type !== 'success') {
        throw new Error('yarn.lock 解析失败');
    }
    const packages = new Map();
    for (const [key, pkgData] of Object.entries(parsed.object)) {
        const nameMatch = key.match(/^(.+)@/);
        if (!nameMatch)
            continue;
        const name = nameMatch[1];
        const version = pkgData.version;
        if (version) {
            packages.set(`${name}@${version}`, {
                name,
                version,
                dependencies: pkgData.dependencies,
            });
        }
    }
    return packages;
}
