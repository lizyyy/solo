import { DeprecatedRoute, ParsedOpenAPI } from './types';
export declare function parseOpenAPI(filePath: string, globalDeprecationDate?: string): ParsedOpenAPI;
export declare function generatePathPatterns(route: DeprecatedRoute): RegExp[];
export declare function matchPathToRoute(requestPath: string, routes: DeprecatedRoute[]): {
    route: DeprecatedRoute;
    isAlias: boolean;
} | null;
export declare function getRouteSignature(route: DeprecatedRoute): string;
