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
exports.parseOpenAPI = parseOpenAPI;
exports.generatePathPatterns = generatePathPatterns;
exports.matchPathToRoute = matchPathToRoute;
exports.getRouteSignature = getRouteSignature;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const yaml = __importStar(require("js-yaml"));
const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace'];
function parseOpenAPI(filePath, globalDeprecationDate) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const ext = path.extname(filePath).toLowerCase();
    let spec;
    if (ext === '.json') {
        spec = JSON.parse(content);
    }
    else {
        spec = yaml.load(content);
    }
    const deprecatedRoutes = [];
    let allRoutesCount = 0;
    for (const [pathKey, pathItem] of Object.entries(spec.paths || {})) {
        const pathLevelAliases = pathItem['x-path-aliases'] || [];
        const pathLevelDeprecated = pathItem['x-deprecated'] || false;
        for (const method of HTTP_METHODS) {
            const operation = pathItem[method];
            if (!operation)
                continue;
            allRoutesCount++;
            const operationAliases = operation['x-path-aliases'] || [];
            const allAliases = [...new Set([...pathLevelAliases, ...operationAliases])];
            const isDeprecated = pathLevelDeprecated || operation.deprecated;
            if (isDeprecated) {
                const deprecationInfo = operation['x-deprecation'];
                const route = {
                    path: pathKey,
                    method: method.toUpperCase(),
                    summary: operation.summary,
                    description: operation.description,
                    deprecationDate: deprecationInfo?.date || globalDeprecationDate,
                    sunsetDate: deprecationInfo?.sunsetDate,
                    replacement: deprecationInfo?.replacement,
                    xDeprecation: deprecationInfo,
                    pathAliases: allAliases,
                };
                deprecatedRoutes.push(route);
            }
        }
    }
    return {
        title: spec.info.title,
        version: spec.info.version,
        deprecatedRoutes: sortRoutes(deprecatedRoutes),
        allRoutes: allRoutesCount,
    };
}
function generatePathPatterns(route) {
    const patterns = [];
    const allPaths = [route.path, ...route.pathAliases];
    for (const p of allPaths) {
        const pattern = p
            .replace(/\{[^}]+\}/g, '[^/]+')
            .replace(/\*/g, '.*');
        patterns.push(new RegExp(`^${pattern}$`));
    }
    return patterns;
}
function matchPathToRoute(requestPath, routes) {
    for (const route of routes) {
        const directPattern = route.path
            .replace(/\{[^}]+\}/g, '[^/]+')
            .replace(/\*/g, '.*');
        if (new RegExp(`^${directPattern}$`).test(requestPath)) {
            return { route, isAlias: false };
        }
        for (const alias of route.pathAliases) {
            const aliasPattern = alias
                .replace(/\{[^}]+\}/g, '[^/]+')
                .replace(/\*/g, '.*');
            if (new RegExp(`^${aliasPattern}$`).test(requestPath)) {
                return { route, isAlias: true };
            }
        }
    }
    return null;
}
function sortRoutes(routes) {
    return [...routes].sort((a, b) => {
        const pathCompare = a.path.localeCompare(b.path);
        if (pathCompare !== 0)
            return pathCompare;
        return a.method.localeCompare(b.method);
    });
}
function getRouteSignature(route) {
    return `${route.method} ${route.path}`;
}
//# sourceMappingURL=openapi-parser.js.map