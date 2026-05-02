const fs = require('fs');
const path = require('path');

class ManifestParser {
  constructor(extDir) {
    this.extDir = extDir;
    this.manifest = null;
    this.version = null;
    this.manifestVersion = null;
  }

  parse() {
    const manifestPath = path.join(this.extDir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      throw new Error(`Manifest not found at ${manifestPath}`);
    }

    const content = fs.readFileSync(manifestPath, 'utf-8');
    this.manifest = JSON.parse(content);

    this.version = this.manifest.version;
    this.manifestVersion = this.manifest.manifest_version;

    return {
      manifest: this.manifest,
      version: this.version,
      manifestVersion: this.manifestVersion,
      findings: this.analyze()
    };
  }

  analyze() {
    const findings = [];

    findings.push(...this.checkManifestVersionMixing());
    findings.push(...this.checkHostPermissions());
    findings.push(...this.checkContentScriptsConflicts());

    return findings;
  }

  checkManifestVersionMixing() {
    const findings = [];
    const bg = this.manifest.background;
    const contentScripts = this.manifest.content_scripts;

    if (bg) {
      if (bg.scripts && bg.page) {
        findings.push({
          type: 'manifest_mixing',
          severity: 'error',
          message: 'Background has both "scripts" and "page" defined. Choose one.',
          location: 'manifest.background',
          suggestion: 'Use manifest_version 3 with service_worker or manifest_version 2 with scripts.'
        });
      }

      if (this.manifestVersion === 3 && bg.page) {
        findings.push({
          type: 'manifest_mixing',
          severity: 'warning',
          message: 'Manifest V3 does not support background.page. Use service_worker instead.',
          location: 'manifest.background',
          suggestion: 'Convert background.page to background.service_worker.'
        });
      }

      if (this.manifestVersion === 2 && bg.service_worker) {
        findings.push({
          type: 'manifest_mixing',
          severity: 'warning',
          message: 'Manifest V2 does not support service_worker. Use scripts instead.',
          location: 'manifest.background',
          suggestion: 'Convert background.service_worker to background.scripts.'
        });
      }
    }

    if (contentScripts && contentScripts.length > 0) {
      const hasV3Style = contentScripts.some(cs => cs.service_workers);
      if (hasV3Style && this.manifestVersion === 2) {
        findings.push({
          type: 'manifest_mixing',
          severity: 'error',
          message: 'content_scripts.service_workers is only valid in Manifest V3.',
          location: 'manifest.content_scripts',
          suggestion: 'Use manifest_version: 3 or remove service_workers from content_scripts.'
        });
      }
    }

    return findings;
  }

  checkHostPermissions() {
    const findings = [];

    const permissions = this.manifest.permissions || [];
    const hostPermissions = this.manifest.host_permissions || [];

    const widePatterns = [
      '<all_urls>',
      'http://*/*',
      'https://*/*',
      'file://*/*'
    ];

    const allHostPermissions = [...permissions, ...hostPermissions];

    for (const perm of allHostPermissions) {
      if (widePatterns.includes(perm)) {
        findings.push({
          type: 'host_permissions',
          severity: perm === '<all_urls>' ? 'error' : 'warning',
          message: `Overly broad host permission: ${perm}`,
          location: permissions.includes(perm) ? 'manifest.permissions' : 'manifest.host_permissions',
          suggestion: 'Restrict to specific domains or paths.'
        });
      }

      if (perm.includes('://*.')) {
        findings.push({
          type: 'host_permissions',
          severity: 'warning',
          message: `Wildcard subdomain permission: ${perm}`,
          location: permissions.includes(perm) ? 'manifest.permissions' : 'manifest.host_permissions',
          suggestion: 'Consider using specific subdomains if possible.'
        });
      }
    }

    return findings;
  }

  checkContentScriptsConflicts() {
    const findings = [];
    const contentScripts = this.manifest.content_scripts || [];

    if (contentScripts.length < 2) {
      return findings;
    }

    for (let i = 0; i < contentScripts.length; i++) {
      for (let j = i + 1; j < contentScripts.length; j++) {
        const conflict = this.findOverlap(contentScripts[i], contentScripts[j]);
        if (conflict) {
          findings.push({
            type: 'content_scripts_conflict',
            severity: 'warning',
            message: `content_scripts[${i}] and content_scripts[${j}] have overlapping matches: ${conflict.join(', ')}`,
            location: `manifest.content_scripts[${i}] and [${j}]`,
            suggestion: 'Consider merging these patterns or using "exclude_matches" to avoid duplicate injections.'
          });
        }
      }
    }

    return findings;
  }

  findOverlap(cs1, cs2) {
    const matches1 = cs1.matches || [];
    const matches2 = cs2.matches || [];
    const exclude1 = cs1.exclude_matches || [];
    const exclude2 = cs2.exclude_matches || [];

    const overlaps = matches1.filter(m1 =>
      matches2.some(m2 => this.patternsOverlap(m1, m2))
    );

    const filtered = overlaps.filter(m =>
      !exclude1.some(e => this.patternsOverlap(m, e)) &&
      !exclude2.some(e => this.patternsOverlap(m, e))
    );

    return filtered.length > 0 ? filtered : null;
  }

  patternsOverlap(p1, p2) {
    if (p1 === p2) return true;

    const normalize = (p) => {
      if (p.includes('*://')) {
        const scheme = p.split('*://')[0] + '*://';
        let rest = p.split('*://')[1];
        rest = rest.replace(/\*/g, '.*').replace(/\?/g, '.');
        return { scheme, host: rest };
      }
      return null;
    };

    const n1 = normalize(p1);
    const n2 = normalize(p2);

    if (n1 && n2) {
      const schemeMatch = n1.scheme === n2.scheme || n1.scheme === '*://' || n2.scheme === '*://';
      if (schemeMatch) {
        const regex1 = new RegExp('^' + n1.host.replace(/\.\*/g, '.*') + '$');
        const regex2 = new RegExp('^' + n2.host.replace(/\.\*/g, '.*') + '$');
        return regex1.test(n2.host) || regex2.test(n1.host) || this.globMatch(n1.host, n2.host);
      }
    }

    return false;
  }

  globMatch(pattern, str) {
    const regex = new RegExp('^' + pattern.replace(/\.\*/g, '.*').replace(/\./g, '\\.') + '$');
    return regex.test(str);
  }

  static expandWildcardDomains(domain) {
    if (domain === '<all_urls>') {
      return ['http://*/*', 'https://*/*'];
    }

    const patterns = [];
    if (domain.includes('*')) {
      patterns.push(domain);
    } else {
      patterns.push(`https://${domain}/*`);
      patterns.push(`http://${domain}/*`);
    }

    return patterns;
  }
}

module.exports = ManifestParser;
