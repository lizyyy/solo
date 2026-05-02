const fs = require('fs');
const yaml = require('js-yaml');
const ManifestParser = require('../manifest/parser');

class PermissionChecker {
  constructor(extDir, whitelistPath) {
    this.extDir = extDir;
    this.whitelistPath = whitelistPath;
    this.whitelist = null;
    this.manifestData = null;
  }

  loadWhitelist() {
    if (!this.whitelistPath || !fs.existsSync(this.whitelistPath)) {
      this.whitelist = { allowed_permissions: [], allowed_hosts: [] };
      return;
    }

    const content = fs.readFileSync(this.whitelistPath, 'utf-8');
    this.whitelist = yaml.load(content);

    if (!this.whitelist.allowed_permissions) {
      this.whitelist.allowed_permissions = [];
    }
    if (!this.whitelist.allowed_hosts) {
      this.whitelist.allowed_hosts = [];
    }
  }

  check(manifestData) {
    this.manifestData = manifestData;
    this.loadWhitelist();

    const findings = [];

    findings.push(...this.checkPermissions());
    findings.push(...this.checkHostPermissions());

    return findings;
  }

  checkPermissions() {
    const findings = [];
    const permissions = this.manifestData.manifest.permissions || [];

    const dangerousPermissions = [
      'tabs',
      'webRequest',
      'webRequestBlocking',
      'privacy',
      'proxy',
      'downloads',
      'downloads.open',
      'downloads.shelf',
      'management',
      'alarms',
      'background',
      'activeTab'
    ];

    for (const perm of permissions) {
      if (this.whitelist.allowed_permissions.includes(perm)) {
        continue;
      }

      if (dangerousPermissions.includes(perm)) {
        findings.push({
          type: 'permission_not_whitelisted',
          severity: 'warning',
          message: `Sensitive permission "${perm}" is not in the whitelist`,
          location: 'manifest.permissions',
          permission: perm,
          suggestion: `Add "${perm}" to the permission whitelist if intentional.`
        });
      }

      if (perm.startsWith('permissions.')) {
        findings.push({
          type: 'permission_style',
          severity: 'error',
          message: `Invalid permission format: ${perm}`,
          location: 'manifest.permissions',
          permission: perm,
          suggestion: 'Permissions should not be prefixed with "permissions."'
        });
      }
    }

    return findings;
  }

  checkHostPermissions() {
    const findings = [];

    const allPermissions = [
      ...(this.manifestData.manifest.permissions || []),
      ...(this.manifestData.manifest.host_permissions || [])
    ];

    for (const perm of allPermissions) {
      if (this.isWildcardDomain(perm)) {
        const expanded = ManifestParser.expandWildcardDomains(perm);
        const allowed = this.matchAllowedHosts(perm);

        if (!allowed) {
          findings.push({
            type: 'host_permission_not_whitelisted',
            severity: perm === '<all_urls>' ? 'error' : 'warning',
            message: `Host permission "${perm}" is not in the whitelist`,
            location: this.manifestData.manifest.permissions?.includes(perm)
              ? 'manifest.permissions'
              : 'manifest.host_permissions',
            permission: perm,
            suggestion: `Add specific domains or paths to whitelist. Current whitelist: ${this.whitelist.allowed_hosts.join(', ') || '(empty)'}`
          });
        }
      }
    }

    return findings;
  }

  isWildcardDomain(perm) {
    if (perm === '<all_urls>') return true;
    if (perm.includes('*://')) return true;
    if (perm.endsWith('/*')) return true;
    return false;
  }

  matchAllowedHosts(perm) {
    for (const allowed of this.whitelist.allowed_hosts) {
      if (this.domainsMatch(perm, allowed)) {
        return true;
      }
    }
    return false;
  }

  domainsMatch(perm, allowed) {
    const normalize = (p) => {
      if (p === '<all_urls>') return { scheme: '*', host: '*', path: '/*' };

      let scheme = '*';
      let host = p;
      let path = '/*';

      if (p.includes('://')) {
        const parts = p.split('://');
        scheme = parts[0];
        const rest = parts[1];

        if (rest.includes('/')) {
          const pathParts = rest.split('/');
          host = pathParts[0];
          path = '/' + pathParts.slice(1).join('/');
        } else {
          host = rest;
        }
      } else if (p.includes('/')) {
        const pathParts = p.split('/');
        host = pathParts[0];
        path = '/' + pathParts.slice(1).join('/');
      }

      return { scheme, host, path };
    };

    const np = normalize(perm);
    const na = normalize(allowed);

    if (na.scheme !== '*' && np.scheme !== na.scheme) return false;

    const hostMatch = this.hostPatternMatch(np.host, na.host);
    if (!hostMatch) return false;

    if (na.path !== '/*' && !np.path.startsWith(na.path)) return false;

    return true;
  }

  hostPatternMatch(pattern, allowed) {
    if (allowed === '*' || allowed === '*/*') return true;

    if (pattern === allowed) return true;

    if (pattern.includes('*')) {
      const regex = new RegExp('^' + pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
      return regex.test(allowed);
    }

    return false;
  }
}

module.exports = PermissionChecker;
