import { AuditCheckResult, WhitelistStatus } from '../types';

const CACHE_TTL = 5 * 60 * 1000;
const whitelistCache = new Map<string, { status: string; cachedAt: number }>();

export const cacheWhitelistAccount = (account: string, status: string): void => {
  whitelistCache.set(account, {
    status,
    cachedAt: Date.now()
  });
};

export const getCachedWhitelist = (account: string): { status: string; cachedAt: number } | undefined => {
  const cached = whitelistCache.get(account);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
    return cached;
  }
  whitelistCache.delete(account);
  return undefined;
};

export const removeCachedWhitelist = (account: string): void => {
  whitelistCache.delete(account);
};

export const shouldBypassAudit = (account: string): AuditCheckResult => {
  const cached = getCachedWhitelist(account);
  if (!cached) {
    return { shouldBypass: false };
  }
  if (cached.status === WhitelistStatus.EXPIRED) {
    return {
      shouldBypass: true,
      reason: '账号已失效，缓存仍跳过审核',
      cachedAt: new Date(cached.cachedAt).toISOString()
    };
  }
  return {
    shouldBypass: true,
    reason: '账号在白名单中',
    cachedAt: new Date(cached.cachedAt).toISOString()
  };
};

export const clearExpiredCache = (): void => {
  const now = Date.now();
  for (const [account, data] of whitelistCache.entries()) {
    if (now - data.cachedAt >= CACHE_TTL) {
      whitelistCache.delete(account);
    }
  }
};
