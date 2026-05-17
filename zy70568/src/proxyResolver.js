const fs = require('fs');
const path = require('path');

class ProxyJumpResolver {
  constructor(parser) {
    this.parser = parser;
  }

  resolveProxyChain(hostname, visited = new Set(), chain = []) {
    if (visited.has(hostname)) {
      return { chain, error: 'Circular proxy chain detected', loop: hostname };
    }
    
    visited.add(hostname);
    const resolved = this.parser.resolveHost(hostname);
    chain.push({
      hostname,
      resolvedHost: resolved.effectiveHostname,
      user: resolved.resolvedOptions.user,
      port: resolved.resolvedOptions.port,
      identityFile: resolved.resolvedOptions.identityfile,
      proxyJump: resolved.resolvedOptions.proxyjump
    });

    const proxyJump = resolved.resolvedOptions.proxyjump;
    if (proxyJump && proxyJump !== 'none') {
      let nextHost = proxyJump;
      if (nextHost.includes('@')) {
        nextHost = nextHost.split('@')[1];
      }
      return this.resolveProxyChain(nextHost, visited, chain);
    }

    return { chain, finalTarget: resolved.effectiveHostname };
  }

  checkIdentityFile(identityFile) {
    if (!identityFile) {
      return { exists: false, warning: 'No IdentityFile specified' };
    }
    
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    const filePath = identityFile.replace('~', homeDir);
    
    try {
      const exists = fs.existsSync(filePath);
      const stats = exists ? fs.statSync(filePath) : null;
      return {
        exists,
        path: filePath,
        originalPath: identityFile,
        isFile: stats ? stats.isFile() : false,
        permissions: stats ? stats.mode.toString(8).slice(-3) : null
      };
    } catch (e) {
      return {
        exists: false,
        path: filePath,
        originalPath: identityFile,
        error: e.message
      };
    }
  }
}

module.exports = ProxyJumpResolver;
