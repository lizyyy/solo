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
exports.collectLicenses = collectLicenses;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const types_1 = require("./types");
const lockfile_parser_1 = require("./lockfile-parser");
const workspace_detector_1 = require("./workspace-detector");
const license_parser_1 = require("./license-parser");
const exceptions_1 = require("./exceptions");
const exit_codes_1 = require("./exit-codes");
const package_json_1 = require("../package.json");
async function collectLicenses(options) {
    const cwd = path.resolve(options.cwd);
    if (!fs.existsSync(cwd)) {
        throw new Error(`工作目录不存在: ${cwd}`);
    }
    const lockfilePackages = (0, lockfile_parser_1.parseLockfile)(cwd);
    const workspacePackages = await (0, workspace_detector_1.detectWorkspacePackages)(cwd);
    const exceptions = options.exceptionsFile ? (0, exceptions_1.loadExceptions)(options.exceptionsFile) : [];
    const allPackages = await collectAllPackages(lockfilePackages, workspacePackages, cwd, options);
    const { violations, activeExceptions } = checkCompliance(allPackages, options.allowedLicenses || [], exceptions);
    const finalPackages = options.includePrivate
        ? allPackages
        : allPackages.filter(p => !p.isPrivate);
    const summary = calculateSummary(finalPackages, violations, activeExceptions);
    const exitCode = determineExitCode(violations, options.failOnViolation);
    const report = {
        summary,
        packages: finalPackages,
        violations,
        exceptions: activeExceptions,
        exitCode,
        exitCodeDescription: (0, exit_codes_1.describeExitCode)(exitCode),
        generatedAt: new Date().toISOString(),
        cliVersion: package_json_1.version,
    };
    return { report, exitCode };
}
async function collectAllPackages(lockfilePackages, workspacePackages, cwd, options) {
    const packages = [];
    const seen = new Set();
    for (const wsPkg of workspacePackages.values()) {
        const key = `${wsPkg.name}@${wsPkg.version}`;
        if (seen.has(key))
            continue;
        seen.add(key);
        const licenseFile = (0, workspace_detector_1.findLicenseFile)(wsPkg.path);
        packages.push({
            name: wsPkg.name,
            version: wsPkg.version,
            license: wsPkg.license,
            licenseFile: licenseFile || undefined,
            licenseText: licenseFile ? (0, workspace_detector_1.readLicenseText)(licenseFile) || undefined : undefined,
            path: wsPkg.path,
            isWorkspace: true,
            isPrivate: wsPkg.isPrivate,
            dependencies: [],
        });
    }
    for (const [key, lockPkg] of lockfilePackages.entries()) {
        if (workspacePackages.has(lockPkg.name)) {
            continue;
        }
        if (seen.has(key))
            continue;
        seen.add(key);
        const pkgPath = path.join(cwd, 'node_modules', lockPkg.name);
        const pkgJsonPath = path.join(pkgPath, 'package.json');
        let license = lockPkg.license || null;
        let isPrivate = false;
        let licenseFile;
        let licenseText;
        if (fs.existsSync(pkgJsonPath)) {
            try {
                const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
                license = pkgJson.license || license;
                isPrivate = !!pkgJson.private;
                const foundLicense = (0, workspace_detector_1.findLicenseFile)(pkgPath);
                if (foundLicense) {
                    licenseFile = foundLicense;
                    licenseText = (0, workspace_detector_1.readLicenseText)(foundLicense) || undefined;
                }
            }
            catch {
            }
        }
        packages.push({
            name: lockPkg.name,
            version: lockPkg.version,
            license,
            licenseFile,
            licenseText,
            path: pkgPath,
            isWorkspace: false,
            isPrivate,
            dependencies: Object.keys(lockPkg.dependencies || {}),
        });
    }
    return packages;
}
function checkCompliance(packages, allowedLicenses, exceptions) {
    const violations = [];
    const activeExceptions = [];
    if (allowedLicenses.length === 0) {
        return { violations, activeExceptions };
    }
    for (const pkg of packages) {
        if (pkg.isWorkspace)
            continue;
        const excepted = (0, exceptions_1.isPackageExcepted)(pkg.name, pkg.version, exceptions);
        if (excepted) {
            activeExceptions.push(excepted);
            continue;
        }
        if (!pkg.license) {
            violations.push({
                packageName: pkg.name,
                packageVersion: pkg.version,
                type: 'missing_license',
                license: null,
                severity: 'warning',
                message: '缺失许可证信息',
            });
            continue;
        }
        const licenseInfo = (0, license_parser_1.parseLicense)(pkg.license);
        if (!licenseInfo.isValid) {
            violations.push({
                packageName: pkg.name,
                packageVersion: pkg.version,
                type: 'unknown_license',
                license: pkg.license,
                severity: 'warning',
                message: `未知许可证格式: ${pkg.license}`,
            });
            continue;
        }
        if (!(0, license_parser_1.isLicenseAllowed)(licenseInfo, allowedLicenses)) {
            violations.push({
                packageName: pkg.name,
                packageVersion: pkg.version,
                type: 'unallowed_license',
                license: pkg.license,
                severity: 'error',
                message: `许可证 ${pkg.license} 不在允许列表中`,
            });
        }
    }
    return { violations, activeExceptions };
}
function calculateSummary(packages, violations, exceptions) {
    const workspacePackages = packages.filter(p => p.isWorkspace);
    const externalPackages = packages.filter(p => !p.isWorkspace);
    const privatePackages = packages.filter(p => p.isPrivate);
    const packagesWithLicense = packages.filter(p => p.license);
    const packagesMissingLicense = packages.filter(p => !p.license);
    let dualLicenseCount = 0;
    for (const pkg of packages) {
        if (pkg.license) {
            const info = (0, license_parser_1.parseLicense)(pkg.license);
            if (info.isDual)
                dualLicenseCount++;
        }
    }
    return {
        totalPackages: packages.length,
        workspacePackages: workspacePackages.length,
        externalPackages: externalPackages.length,
        privatePackages: privatePackages.length,
        packagesWithLicense: packagesWithLicense.length,
        packagesMissingLicense: packagesMissingLicense.length,
        dualLicensePackages: dualLicenseCount,
        violations: violations.length,
        exceptions: exceptions.length,
    };
}
function determineExitCode(violations, failOnViolation) {
    if (violations.length === 0) {
        return types_1.ExitCodes.SUCCESS;
    }
    const hasErrors = violations.some(v => v.severity === 'error');
    if (failOnViolation && hasErrors) {
        return types_1.ExitCodes.VIOLATIONS;
    }
    return types_1.ExitCodes.SUCCESS;
}
