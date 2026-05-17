const fs = require('fs');
const path = require('path');

const VALID_SSH_KEYWORDS = new Set([
  'host', 'hostname', 'user', 'port', 'identityfile', 'proxyjump',
  'forwardagent', 'forwardx11', 'forwardx11trusted', 'compression',
  'serveraliveinterval', 'serveralivecountmax', 'tcpkeepalive',
  'strict hostkey checking', 'stricthostkeychecking', 'userknownhostsfile',
  'globalknownhostsfile', 'loglevel', 'ciphers', 'macs', 'kexalgorithms',
  'preferredauthentications', 'gssapiauthentication', 'gssapidelegatecredentials',
  'hashknownhosts', 'visualhostkey', 'controlmaster', 'controlpath',
  'controlpersist', 'batchmode', 'checkhostip', 'addressfamily',
  'connecttimeout', 'connectionattempts', 'escapechar', 'tunnel',
  'tunneldevice', 'permitlocalcommand', 'localcommand', 'proxycommand',
  'proxyusefdpass', 'sendenv', 'setenv', 'term', 'rekeylimit',
  'rekeymaxlimit', 'pubkeyauthentication', 'passwordauthentication',
  'challengeresponseauthentication', 'kbdinteractiveauthentication',
  'gssapikeyexchange', 'hostbasedauthentication', 'hostkeyalgorithms',
  'pubkeyacceptedkeytypes', 'certificatefile', 'identityagent',
  'addkeystoagent', 'updatehostkeys', 'verifymatchlocaliponly',
  'canonicalizefallback', 'canonicalizehostname', 'canonicalizedomainname',
  'canonicalizemaxdots', 'canonicalizepermittedcnames', 'match',
  'include', 'ignoreunknown', 'revokedhostkeys', 'knownhostscommand',
  'systemhostfile', 'syslogfacility', 'xonxoff', 'enablesshkeysign',
  'ipqos', 'identitiesonly', 'exitonforwardfailure', 'numberofpasswordprompts'
]);

class SSHConfigParser {
  constructor() {
    this.hosts = [];
    this.globalOptions = {};
    this.errors = [];
    this.rawLines = [];
  }

  parse(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    let currentHost = null;
    let lineNumber = 0;

    lines.forEach((line, index) => {
      lineNumber = index + 1;
      this.rawLines.push({ line: lineNumber, content: line });
      
      const trimmed = line.trim();
      
      if (trimmed === '' || trimmed.startsWith('#')) {
        return;
      }

      const isIndented = line.startsWith(' ') || line.startsWith('\t');
      const match = trimmed.match(/^(\S+)\s+(.*)$/);
      if (!match) {
        this.errors.push({
          line: lineNumber,
          content: line,
          error: 'Invalid line format'
        });
        return;
      }

      const [, keyword, value] = match;
      const keywordLower = keyword.toLowerCase();

      if (!VALID_SSH_KEYWORDS.has(keywordLower)) {
        this.errors.push({
          line: lineNumber,
          content: line,
          error: `Unknown SSH config keyword: ${keyword}`
        });
        if (currentHost) {
          this.hosts.push(currentHost);
          currentHost = null;
        }
        return;
      }

      if (currentHost && !isIndented && keywordLower !== 'host' && keywordLower !== 'match') {
        currentHost = null;
      }

      if (keywordLower === 'host') {
        if (currentHost) {
          this.hosts.push(currentHost);
        }
        currentHost = {
          patterns: this.parseHostPatterns(value),
          patternString: value,
          options: {},
          definedAt: lineNumber,
          rawLine: line
        };
      } else if (currentHost) {
        currentHost.options[keywordLower] = value;
      } else {
        this.globalOptions[keywordLower] = value;
      }
    });

    if (currentHost) {
      this.hosts.push(currentHost);
    }

    return this;
  }

  parseHostPatterns(value) {
    return value.split(/\s+/).filter(p => p.length > 0);
  }

  findMatchingHosts(hostname) {
    const matches = [];
    
    this.hosts.forEach((host, index) => {
      host.patterns.forEach(pattern => {
        if (this.patternMatches(pattern, hostname)) {
          matches.push({
            host,
            pattern,
            specificity: this.calculateSpecificity(pattern),
            order: index
          });
        }
      });
    });

    matches.sort((a, b) => {
      if (a.specificity !== b.specificity) {
        return a.specificity - b.specificity;
      }
      return a.order - b.order;
    });

    return matches;
  }

  patternMatches(pattern, hostname) {
    const regexStr = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    const regex = new RegExp(`^${regexStr}$`);
    return regex.test(hostname);
  }

  calculateSpecificity(pattern) {
    if (!pattern.includes('*') && !pattern.includes('?')) {
      return 100;
    }
    if (pattern.startsWith('*')) {
      return 10;
    }
    if (pattern.endsWith('*')) {
      return 50;
    }
    return 30;
  }

  resolveHost(hostname) {
    const matches = this.findMatchingHosts(hostname);
    const result = {
      hostname,
      resolvedOptions: { ...this.globalOptions },
      matchingRules: matches.map(m => ({
        pattern: m.pattern,
        patternString: m.host.patternString,
        definedAt: m.host.definedAt,
        specificity: m.specificity,
        options: m.host.options
      })),
      overrides: []
    };

    const appliedHosts = [];
    matches.forEach(match => {
      appliedHosts.push(match.host.patternString);
      Object.keys(match.host.options).forEach(key => {
        const oldValue = result.resolvedOptions[key];
        if (oldValue !== undefined) {
          result.overrides.push({
            key,
            oldValue,
            newValue: match.host.options[key],
            byPattern: match.pattern,
            definedAt: match.host.definedAt
          });
        }
        result.resolvedOptions[key] = match.host.options[key];
      });
    });

    result.effectiveHostname = result.resolvedOptions.hostname || hostname;
    result.appliedHostRules = appliedHosts;

    return result;
  }

  getErrors() {
    return this.errors;
  }

  getAllHosts() {
    return this.hosts;
  }
}

module.exports = SSHConfigParser;
