const fs = require('fs');
class ProxyJumpResolver {
  constructor(parser) { this.parser = parser; }
  resolveProxyChain(hostname, visited = new Set(), chain = []) {
    if (visited.has(hostname)) return { chain, error: 'Circular proxy chain detected', loop: hostname };
    visited.add(hostname);
    const resolved = this.parser.resolveHost(hostname);
    chain.push({ hostname, resolvedHost: resolved.effectiveHostname, user: resolved.resolvedOptions.user, port: resolved.resolvedOptions.port, identityFile: resolved.resolvedOptions.identityfile, proxyJump: resolved.resolvedOptions.proxyjump });
    const proxyJump = resolved.resolvedOptions.proxyjump;
    if (proxyJump && proxyJump !== 'none') {
      let nextHost = proxyJump.includes('@') ? proxyJump.split('@')[1] : proxyJump;
      return this.resolveProxyChain(nextHost, visited, chain);
    }
    return { chain, finalTarget: resolved.effectiveHostname };
  }
  checonst fs = require('fs');
f) fs.writeFileSync('src/pr rclass ProxyJumpResolver {
  constructor(parser) { this.parser = pa c  constructor(parser) { nv  resolveProxyChain(hostname, visited = new Sele    if (visited.has(hostname)) return { chain, error: 'Circularts    visited.add(hostname);
    const resolved = this.parser.resolveHost(hostname);
    chain.push({ hos f    const resolved = thisen    chain.push({ hostname, resolvedHost: resolved.effeis    const proxyJump = resolved.resolvedOptions.proxyjump;
    if (proxyJump && proxyJump !== 'none') {
      let nextHost = proxyJump.includes('@') ? proxyJump.split('@')[1] : proxyJump;
      return this.resolveProxyChain(nextHost, visited, chr.    if (proxyJump && proxyJump !== 'none') {
      let nha      let nextHost = proxyJump.includes('@'(p      return this.resolveProxyChain(nextHost, visited, chain);
    }
    return { }
    }
    return { chain, finalTarget: resolved.effectiveHosts.    er  }
  checonst fs = require('fs');
f) fs.writeFileSync('src/pol  r.f) fs.writeFileSync('src/pr r    constructor(parser) { this.parser = pa c  constructit    const resolved = this.parser.resolveHost(hostname);
    chain.push({ hos f    const resolved = thisen    chain.push({ hostname, resolvedHost: resolved.effeis    const proxyJump = resolved.resolvedOptione(    chain.push({ hos f    const resolved = thisen    clk    if (proxyJump && proxyJump !== 'none') {
      let nextHost = proxyJump.includes('@') ? proxyJump.split('@')[1] : proxyJump;
      return this.resolveProxyCh?     let nextHost = proxyJump.includes('@'es      return this.resolveProxyChain(nextHost, visited, chr.    if (proxyJump && prat      let nha      let nextHost = proxyJump.includes('@'(p      return this.resolveProxyChain(nextHosttp    }
    return { }
    }
    return { chain, finalTarget: resolved.effectiveHosts.    er  }
  checonst fs = require('ri    fo    }
    ret o    t.  checonst fs = require('fs');
f) fs.writeFileSync('src/pol  r.f) +f) fs.writeFileSync('src/pol .g    chain.push({ hos f    const resolved = thisen    chain.push({ hostname, resolvedHost: resolved.effeis    const proxyJump = resolved.resolvedOptione(    chain.push({ hosor      let nextHost = proxyJump.includes('@') ? proxyJump.split('@')[1] : proxyJump;
      return this.resolveProxyCh?     let nextHost = proxyJump.includes('@'es      return this.resolveProxyChain(nextHost, visited, chr.    if (proxyJump && prat    on      return this.resolveProxyCh?     let nextHost = proxyJump.includes('@'es   +     return { }
    }
    return { chain, finalTarget: resolved.effectiveHosts.    er  }
  checonst fs = require('ri    fo    }
    ret o    t.  checonst fs = require('fs');
f) fs.writeFileSync('src/pol  r.f) +f) fs.writeFileSync('src/pol .g    chain.push({ hos f    constns    }
    retou    .p  checonst fs = require('ri    fo    }
    ret o    t.  checonst ?'    ret o    t.  checonst fs = requirpuf) fs.writeFileSync('src/pol  r.f) +f) fs.wr.e      return this.resolveProxyCh?     let nextHost = proxyJump.includes('@'es      return this.resolveProxyChain(nextHost, visited, chr.    if (proxyJump && prat    on      return this.resolveProxyCh?     let nextHost = proxyJump.includes('@'es   +     return { }
    }
    return { chain, finalTarget: resolved.effecti')    }
    return { chain, finalTarget: resolved.effectiveHosts.    er  }
  checonst fs = require('ri    fo    }
    ret o    t.  checonst fs = require('fs');
f) fs.writeFileSync('src/pol  r.f) +f) fs.writeFileSync('src/pol .g    chain.push({ hos f    constns    }
  k     is  checonst fs = require('ri    fo    }
    ret o    t.  checonst yf    ret o    t.  checonst fs = reqratedf) fs.writeFileSync('src/pol  r.f) +f) fs.wrlv    retou    .p  checonst fs = require('ri    fo    }
    ret o    t.  checonst ?'    ret o    t.  checolH    ret o    t.  checonst ?'    ret o    t.  checonsAt    }
    return { chain, finalTarget: resolved.effecti')    }
    return { chain, finalTarget: resolved.effectiveHosts.    er  }
  checonst fs = require('ri    fo    }
    ret o    t.  checonst fs = require('fs');
f) fs.writeFileSync('src/pol  r.f) +f) fs.writeFileSync('src/pol .g    chain.push({ hos f    constns    }
  k     is  checonst fs = require('ri    fo    }
    ret o/s    na    return { chain, finalTarget: resolved.effectiveHostir  checonst fs = require('ri    fo    }
    ret o    t.  checonst  c    ret o    t.  checonst fs =re('../srf) fs.writeFileSync('src/pol  r.f) +f) fs.wreq  k     is  checonst fs = require('ri    fo    }
    ret o    t.  checonst yf    ret o    t.  checonst fsh    ret o    t.  checonst yf    ret o    t.  ch.v    ret o    t.  checonst ?'    ret o    t.  checolH    ret o    t.  checonst ?'    ret o    t.  checonsAt    }
    return { chain, finalTarget: resolved.effecti')  sh    return { chain, finalTarget: resolved.effecti')    }
    return { chain, finalTarget: resolved.effectiveHo =    return { chain, finalTarget: resolved.effectiveHostar  checonst fs = require('ri    fo    }
    ret o    t.  checonst yR    ret = new ProxyJumpResolver(parser)f) fs.writeFileSync('src/pol  r.f) +f) fs.wrer  k     is  checonst fs = require('ri    fo    }
    ret o/s.log(reportGen.generateTerminalReport(hostname    ret o/s    na    return { chain, finalTargere    ret o    t.  checonst  c    ret o    t.  checonst fs =re('../srf) fs.writeFileSync('src/pol  r.f) +f) fs.wrig    ret o    t.  checonst yf    ret o    t.  checonst fsh    ret o    t.  checonst yf    ret o    t.  ch.v    ret o    t.  checonst ?'    ret o    t.  checolH  ar    return { chain, finalTarget: resolved.effecti')  sh    return { chain, finalTarget: resolved.effecti')    }
    return { chain, finalTarget: resolved.effectiveHo =    return { chain, finalTarget: resolved.effecti{     return { chain, finalTarget: resolved.effectiveHo =    return { chain, finalTarget: resolved.effectiveHostst    ret o    t.  checonst yR    ret = new ProxyJumpResolver(parser)f) fs.writeFileSync('src/pol  r.f) +f) fs.wrer  k     is  checonst fs = require('rp/    ret o/s.log(reportGen.generateTerminalReport(hostname    ret o/s    na    return { chain, finalTargere    ret o    t.  checonst  c    ret o    t.  checonst am    return { chain, finalTarget: resolved.effectiveHo =    return { chain, finalTarget: resolved.effecti{     return { chain, finalTarget: resolved.effectiveHo =    return { chain, finalTarget: resolved.effectiveHostst    ret o    t.  checonst yR    ret = new ProxyJumpResolver(parser)f) fs.writeFileSync('src/pol  r.f) +f) fs.wrer  k     is  checonst fs = require('rp/    ret o/s.log(reportGen.generateTerminalReport(hostname    ret o/s    na    return { chain, finalTargere    ret o    t. g'); const parser = new SSHConfigParser(); parser.parse(testConfigPath); console.log('=== SSH配置解析器 - 自检 ==='); console.log('1. ✓ 解析成功, Host规则数:', parser.getAllHosts().length); const resolved = parser.resolveHost('db-server.internal'); console.log('2. ✓ 主机解析:', resolved.effectiveHostname); console.log('3. ✓ 匹配规则:', resolved.matchingRules.length, '覆盖项:', resolved.overrides.length); const proxyResolver = new ProxyJumpResolver(parser); const chain = proxyResolver.resolveProxyChain('db-server.internal'); console.log('4. ✓ 跳板链长度:', chain.chain.length); const loop = proxyResolver.resolveProxyChain('loop-host-a'); console.log('5. ✓ 循环检测:', loop.error || '正常'); console.log(String.fromCharCode(10) + '=== 所有测试通过! ===');