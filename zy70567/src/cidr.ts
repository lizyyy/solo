export function ipToBigint(ip: string): bigint {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) {
    throw new Error(`无效IP地址: ${ip}`);
  }
  return (BigInt(parts[0]) << 24n) | (BigInt(parts[1]) << 16n) | (BigInt(parts[2]) << 8n) | BigInt(parts[3]);
}

export function bigintToIp(n: bigint): string {
  return [
    Number((n >> 24n) & 0xffn),
    Number((n >> 16n) & 0xffn),
    Number((n >> 8n) & 0xffn),
    Number(n & 0xffn)
  ].join('.');
}

export function parseCidr(cidr: string): { start: bigint; end: bigint } {
  const [ip, prefixStr] = cidr.split('/');
  const prefix = parseInt(prefixStr || '32', 10);
  
  if (isNaN(prefix) || prefix < 0 || prefix > 32) {
    throw new Error(`无效CIDR前缀: ${prefixStr}`);
  }
  
  const ipNum = ipToBigint(ip);
  const mask = prefix === 0 ? 0n : (0xffffffffn << BigInt(32 - prefix));
  const start = ipNum & mask;
  const end = start | (~mask & 0xffffffffn);
  
  return { start, end };
}

export function bigintToCidr(start: bigint, end: bigint): string {
  if (start === end) {
    return `${bigintToIp(start)}/32`;
  }
  
  let prefix = 32;
  while (prefix > 0) {
    const mask = prefix === 0 ? 0n : (0xffffffffn << BigInt(32 - prefix));
    if ((start & mask) === start && (start | (~mask & 0xffffffffn)) >= end) {
      break;
    }
    prefix--;
  }
  
  return `${bigintToIp(start)}/${prefix}`;
}