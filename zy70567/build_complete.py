#!/usr/bin/env python3
import sys

lines = [
    '#!/usr/bin/env node',
    '',
    'const fs = require("fs");',
    'const { Command } = require("commander");',
    '',
    'function ipToBigint(ip) {',
    '  const parts = ip.split(".").map(Number);',
    '  return (BigInt(parts[0]) << 24n) | (BigInt(parts[1]) << 16n) | (BigInt(parts[2]) << 8n) | BigInt(parts[3]);',
    '}',
    '',
    'function bigintToIp(n) {',
    '  return [',
    '    Number((n >> 24n) & 0xffn),',
    '    Number((n >> 16n) & 0xffn),',
    '    Number((n >> 8n) & 0xffn),',
    '    Number(n & 0xffn)',
    '  ].join(".");',
    '}',
]

with open('index.js', 'w') as f:
    f.write('\n'.join(lines))

print(f'Wrote {len(lines)} lines')
