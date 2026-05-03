import { pathToRegexp, Key } from 'path-to-regexp';
import { Route, TrafficSample, RouteMatchResult } from '../types';
import { logger } from '../utils/logger';

export class RouteMatcher {
  private routes: Route[];
  private routeRegexCache: Map<string, { regex: RegExp; keys: Key[] }> = new Map();

  constructor(routes: Route[]) {
    this.routes = [...routes].sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }

  match(sample: TrafficSample): RouteMatchResult | null {
    logger.debug(`Matching route for path: ${sample.path}, method: ${sample.method}`);
    
    for (const route of this.routes) {
      const result = this.matchSingleRoute(route, sample);
      if (result.matched) {
        return result;
      }
    }
    
    return null;
  }

  private matchSingleRoute(route: Route, sample: TrafficSample): RouteMatchResult {
    const reasons: string[] = [];

    if (!this.matchPath(route.path, sample.path)) {
      reasons.push(`Path '${sample.path}' does not match '${route.path}'`);
      return { route, matched: false, reason: reasons.join('; ') };
    }

    if (route.method && route.method.toUpperCase() !== sample.method.toUpperCase()) {
      reasons.push(`Method '${sample.method}' does not match '${route.method}'`);
      return { route, matched: false, reason: reasons.join('; ') };
    }

    if (route.headers) {
      for (const [key, expectedValue] of Object.entries(route.headers)) {
        const actualValue = sample.headers[key] || sample.headers[key.toLowerCase()];
        if (!actualValue || actualValue !== expectedValue) {
          reasons.push(`Header '${key}' does not match`);
          return { route, matched: false, reason: reasons.join('; ') };
        }
      }
    }

    return { route, matched: true, reason: 'All conditions matched' };
  }

  private matchPath(pattern: string, path: string): boolean {
    if (this.routeRegexCache.has(pattern)) {
      const { regex } = this.routeRegexCache.get(pattern)!;
      return regex.test(path);
    }

    let regex: RegExp;

    if (pattern.includes('*')) {
      regex = this.wildcardToRegex(pattern);
    } else {
      try {
        const keys: Key[] = [];
        regex = pathToRegexp(pattern, keys);
      } catch (error) {
        logger.warn(`Failed to parse path pattern '${pattern}' with path-to-regexp, falling back to simple match`);
        regex = this.simplePathToRegex(pattern);
      }
    }

    this.routeRegexCache.set(pattern, { regex, keys: [] });
    return regex.test(path);
  }

  private wildcardToRegex(pattern: string): RegExp {
    const escapedPattern = pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '(.*)');
    
    return new RegExp(`^${escapedPattern}$`);
  }

  private simplePathToRegex(pattern: string): RegExp {
    const segments = pattern.split('/').filter(Boolean);
    const regexSegments = segments.map(seg => {
      if (seg.startsWith(':')) {
        return '([^/]+)';
      }
      return seg.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    });
    
    const regexPattern = regexSegments.length > 0 
      ? `^/${regexSegments.join('/')}(?:/)?$`
      : '^/$';
    
    return new RegExp(regexPattern);
  }

  detectOverlaps(): { path1: string; path2: string; priorityConflict: boolean }[] {
    const overlaps: { path1: string; path2: string; priorityConflict: boolean }[] = [];
    
    for (let i = 0; i < this.routes.length; i++) {
      for (let j = i + 1; j < this.routes.length; j++) {
        const r1 = this.routes[i];
        const r2 = this.routes[j];
        
        if (this.pathsOverlap(r1.path, r2.path)) {
          const priorityConflict = (r1.priority || 0) === (r2.priority || 0);
          overlaps.push({
            path1: r1.path,
            path2: r2.path,
            priorityConflict
          });
          logger.warn(`Route overlap detected: ${r1.path} and ${r2.path} ${priorityConflict ? '(priority conflict!)' : ''}`);
        }
      }
    }
    
    return overlaps;
  }

  private pathsOverlap(path1: string, path2: string): boolean {
    if (path1 === path2) return true;

    const norm1 = this.normalizePathPattern(path1);
    const norm2 = this.normalizePathPattern(path2);

    return this.patternsMayOverlap(norm1, norm2) || this.patternsMayOverlap(norm2, norm1);
  }

  private normalizePathPattern(path: string): string {
    return path
      .replace(/:[a-zA-Z_][a-zA-Z0-9_]*/g, '{param}')
      .replace(/\*/g, '{wildcard}');
  }

  private patternsMayOverlap(pattern1: string, pattern2: string): boolean {
    const segs1 = pattern1.split('/').filter(Boolean);
    const segs2 = pattern2.split('/').filter(Boolean);

    const isWildcard1 = segs1.includes('{wildcard}');
    const isWildcard2 = segs2.includes('{wildcard}');

    if (isWildcard1 && isWildcard2) {
      return this.checkDoubleWildcardOverlap(segs1, segs2);
    }

    if (isWildcard1) {
      return this.checkSingleWildcardOverlap(segs1, segs2);
    }

    if (isWildcard2) {
      return this.checkSingleWildcardOverlap(segs2, segs1);
    }

    if (segs1.length !== segs2.length) {
      return false;
    }

    for (let i = 0; i < segs1.length; i++) {
      const s1 = segs1[i];
      const s2 = segs2[i];
      
      if (s1 === '{param}' || s2 === '{param}') {
        continue;
      }
      
      if (s1 !== s2) {
        return false;
      }
    }

    return true;
  }

  private checkDoubleWildcardOverlap(
    wildcardSegs1: string[], 
    wildcardSegs2: string[]
  ): boolean {
    const prefix1 = this.getPrefixBeforeWildcard(wildcardSegs1);
    const prefix2 = this.getPrefixBeforeWildcard(wildcardSegs2);

    return this.prefixesOverlap(prefix1, prefix2) || 
           this.prefixesOverlap(prefix2, prefix1);
  }

  private checkSingleWildcardOverlap(
    wildcardSegs: string[], 
    otherSegs: string[]
  ): boolean {
    const prefix = this.getPrefixBeforeWildcard(wildcardSegs);
    
    if (prefix.length > otherSegs.length) {
      return false;
    }

    for (let i = 0; i < prefix.length; i++) {
      const s1 = prefix[i];
      const s2 = otherSegs[i];
      
      if (s1 === '{param}' || s2 === '{param}') {
        continue;
      }
      
      if (s1 !== s2) {
        return false;
      }
    }

    return true;
  }

  private getPrefixBeforeWildcard(segs: string[]): string[] {
    const result: string[] = [];
    for (const seg of segs) {
      if (seg === '{wildcard}') {
        break;
      }
      result.push(seg);
    }
    return result;
  }

  private prefixesOverlap(prefix1: string[], prefix2: string[]): boolean {
    const minLen = Math.min(prefix1.length, prefix2.length);
    
    for (let i = 0; i < minLen; i++) {
      const s1 = prefix1[i];
      const s2 = prefix2[i];
      
      if (s1 === '{param}' || s2 === '{param}') {
        continue;
      }
      
      if (s1 !== s2) {
        return false;
      }
    }

    return true;
  }
}
