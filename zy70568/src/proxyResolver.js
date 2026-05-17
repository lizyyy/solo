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
      const jumpHosts = proxyJump.split(',').map(j => j.trim()).filter(j => j.length > 0);
      
      for (let i = 0; i < jumpHosts.length; i++) {
        let jumpHost = jumpHosts[i];
        if (jumpHost.includes('@')) {
          jumpHost = jumpHost.split('@')[1];
        }
        const result = this.resolveProxyChain(jumpHost, visited, chain);
        if (result.error) {
          return result;
        }
      }
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
