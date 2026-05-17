class CookieAuditor {
  constructor() {
    this.riskLevels = {
      CRITICAL: 'critical',
      HIGH: 'high',
      MEDIUM: 'medium',
      LOW: 'low',
      INFO: 'info'
    };
  }

  auditAllCookies(allCookies, targetDomains = []) {
    const results = {
      summary: {
        total: 0,
        valid: 0,
        invalid: 0,
        risks: {
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
          info: 0
        }
      },
      normal: [],
      risks: [],
      unparseable: []
    };

    allCookies.forEach(cookie => {
      results.summary.total++;
      
      if (cookie.parseError) {
        results.summary.invalid++;
        results.unparseable.push({
          cookie,
          error: cookie.parseError
        });
        return;
      }

      const auditResult = this.auditCookie(cookie, targetDomains);
      
      if (auditResult.risks.length === 0) {
        results.summary.valid++;
        results.normal.push({
          cookie,
          checks: auditResult.checks
        });
      } else {
        auditResult.risks.forEach(risk => {
          results.summary.risks[risk.level]++;
        });
        results.risks.push({
          cookie,
          risks: auditResult.risks,
          checks: auditResult.checks
        });
      }
    });

    if (targetDomains.length > 0) {
      results.domainAnalysis = this.analyzeDomainConflicts(allCookies, targetDomains);
    }

    return results;
  }

  auditCookie(cookie, targetDomains = []) {
    const risks = [];
    const checks = {};

    checks.expired = this.checkExpired(cookie);
    if (checks.expired.isExpired) {
      risks.push({
        type: 'expired',
        level: this.riskLevels.HIGH,
        message: `Cookie已过期: ${checks.expired.daysAgo}天`,
        detail: checks.expired
      });
    }

    checks.sameSite = this.checkSameSite(cookie);
    if (!checks.sameSite.valid) {
      risks.push({
        type: 'samesite',
        level: this.riskLevels.MEDIUM,
        message: checks.sameSite.message,
        detail: checks.sameSite
      });
    }

    checks.domain = this.checkDomain(cookie, targetDomains);
    if (!checks.domain.valid) {
      risks.push({
        type: 'domain',
        level: checks.domain.riskLevel,
        message: checks.domain.message,
        detail: checks.domain
      });
    }

    checks.path = this.checkPath(cookie);
    if (!checks.path.valid) {
      risks.push({
        type: 'path',
        level: this.riskLevels.LOW,
        message: checks.path.message,
        detail: checks.path
      });
    }

    checks.secure = this.checkSecure(cookie);
    if (!checks.secure.valid) {
      risks.push({
        type: 'secure',
        level: cookie.sameSite === 'None' ? this.riskLevels.CRITICAL : this.riskLevels.MEDIUM,
        message: checks.secure.message,
        detail: checks.secure
      });
    }

    checks.httpOnly = this.checkHttpOnly(cookie);
    if (!checks.httpOnly.valid) {
      risks.push({
        type: 'httponly',
        level: this.riskLevels.MEDIUM,
        message: checks.httpOnly.message,
        detail: checks.httpOnly
      });
    }

    return { risks, checks };
  }

  checkExpired(cookie) {
    if (!cookie.expires || cookie.expires === 0) {
      return { isExpired: false, isSession: true };
    }

    const now = Date.now();
    const isExpired = cookie.expires < now;
    const daysAgo = isExpired 
      ? Math.floor((now - cookie.expires) / (1000 * 60 * 60 * 24))
      : -Math.floor((cookie.expires - now) / (1000 * 60 * 60 * 24));

    return {
      isExpired,
      daysAgo,
      expiresAt: new Date(cookie.expires).toISOString()
    };
  }

  checkSameSite(cookie) {
    const sameSite = cookie.sameSite;
    
    if (sameSite === 'None' && !cookie.secure) {
      return {
        valid: false,
        message: 'SameSite=None 必须配合 Secure 属性使用',
        value: sameSite
      };
    }

    if (!sameSite || sameSite === 'Lax') {
      return {
        valid: true,
        message: 'SameSite 设置合理',
        value: sameSite
      };
    }

    return {
      valid: true,
      message: `SameSite=${sameSite}`,
      value: sameSite
    };
  }

  checkDomain(cookie, targetDomains = []) {
    const domain = cookie.domain;
    
    if (!domain) {
      return {
        valid: false,
        riskLevel: this.riskLevels.HIGH,
        message: 'Cookie 未设置 domain 属性',
        value: domain
      };
    }

    if (domain.startsWith('.')) {
      return {
        valid: true,
        riskLevel: this.riskLevels.INFO,
        message: 'Domain 带前导点，适用于所有子域',
        value: domain,
        scope: 'all-subdomains'
      };
    }

    if (targetDomains.length > 0) {
      const matches = targetDomains.filter(target => 
        this.domainMatches(domain, target)
      );
      
      if (matches.length > 1) {
        return {
          valid: false,
          riskLevel: this.riskLevels.CRITICAL,
          message: `Domain 设置可能导致跨域冲突: 匹配 ${matches.length} 个目标域`,
          value: domain,
          matches
        };
      }
    }

    return {
      valid: true,
      message: 'Domain 设置合理',
      value: domain
    };
  }

  checkPath(cookie) {
    const path = cookie.path || '/';
    
    if (path === '/') {
      return {
        valid: true,
        message: 'Path=/ 适用于全站',
        value: path,
        scope: 'entire-site'
      };
    }

    return {
      valid: true,
      message: `Path 限制为 ${path}`,
      value: path
    };
  }

  checkSecure(cookie) {
    if (cookie.secure) {
      return {
        valid: true,
        message: 'Secure 属性已设置',
        value: true
      };
    }

    if (cookie.sameSite === 'None') {
      return {
        valid: false,
        message: 'SameSite=None 必须设置 Secure 属性',
        value: false
      };
    }

    return {
      valid: false,
      message: '建议设置 Secure 属性 (仅 HTTPS 传输)',
      value: false
    };
  }

  checkHttpOnly(cookie) {
    if (cookie.httpOnly) {
      return {
        valid: true,
        message: 'HttpOnly 属性已设置',
        value: true
      };
    }

    return {
      valid: false,
      message: '建议设置 HttpOnly 属性 (防止 XSS 窃取)',
      value: false
    };
  }

  domainMatches(cookieDomain, targetDomain) {
    const cd = cookieDomain.replace(/^\./, '').toLowerCase();
    const td = targetDomain.replace(/^\./, '').toLowerCase();
    
    if (cd === td) return true;
    
    if (td.endsWith('.' + cd)) return true;
    
    if (cd.endsWith('.' + td)) return true;
    
    return false;
  }

  analyzeDomainConflicts(allCookies, targetDomains) {
    const conflicts = [];
    const domainGroups = {};

    allCookies.forEach(cookie => {
      if (cookie.parseError) return;
      
      const domain = cookie.domain || 'unknown';
      if (!domainGroups[domain]) {
        domainGroups[domain] = [];
      }
      domainGroups[domain].push(cookie);
    });

    Object.keys(domainGroups).forEach(domain => {
      const cookiesInDomain = domainGroups[domain];
      const nameGroups = {};

      cookiesInDomain.forEach(cookie => {
        const name = cookie.name;
        if (!nameGroups[name]) {
          nameGroups[name] = [];
        }
        nameGroups[name].push(cookie);
      });

      Object.keys(nameGroups).forEach(name => {
        const cookiesWithSameName = nameGroups[name];
        if (cookiesWithSameName.length > 1) {
          const paths = [...new Set(cookiesWithSameName.map(c => c.path))];
          const domains = [...new Set(cookiesWithSameName.map(c => c.domain))];
          
          if (paths.length > 1 || domains.length > 1) {
            conflicts.push({
              cookieName: name,
              cookieCount: cookiesWithSameName.length,
              domains,
              paths,
              cookies: cookiesWithSameName,
              riskLevel: domains.length > 1 ? this.riskLevels.CRITICAL : this.riskLevels.HIGH,
              message: domains.length > 1 
                ? `同名Cookie跨多个域存在，可能导致登录串号` 
                : `同名Cookie跨多个路径存在`
            });
          }
        }
      });
    });

    return {
      totalConflicts: conflicts.length,
      conflicts,
      domainGroups: Object.keys(domainGroups)
    };
  }
}

module.exports = CookieAuditor;
