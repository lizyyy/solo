code = '''#!/usr/bin/env node

const fs = require('fs');
const { Command } = require('commander');

function ipToBigint(ip) {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) {
    throw new Error("Invalid IP: " + ip);
  }
  return (BigInt(parts[0]) << 24n) | (BigInt(parts[1]) << 16n) | (BigInt(parts[2]) << 8n) | BigInt(parts[3]);
}

function bigintToIp(n) {
  return [
    Number((n >> 24n) & 0xffn),
    Number((n >> 16n) & 0xffn),
    Number((n >> 8n) & 0xffn),
    Number(n & 0xffn)
  ].join('.');
}

function parseCidr(cidr) {
  const [ip, prefixStr] = cidr.split('/');
  const prefix = parseInt(prefixStr || '32', 10);
  if (isNaN(prefix) || prefix < 0 || prefix > 32) {
    throw new Error("Invalid CIDR prefix: " + prefixStr);
  }
  const ipNum = ipToBigint(ip);
  const mask = prefix === 0 ? 0n : (0xffffffffn << BigInt(32 - prefix));
  const start = ipNum & mask;
  const end = start | (~mask & 0xf  const end = start | start, end };
}

function bigintToCidr(start, end) {
  if (start === end) return bigintToIp(start) + '/32';
  let prefix = 32;
  while (prefix > 0) {
    const mask = prefix === 0 ? 0n : (0xffffffffn << BigInt(32 - prefix));
    if ((start & mask) === start && (start | (~mask & 0xffffffffn)) >= end) break;
    prefix--;
  }
  return bigintToIp(start) + '/' + prefix;
}
'''
with open('p1.js', 'w') as f:
    f.write(code)
print('p1.js created: ' + str(len(code)) + ' bytes')
