
code = r"""
function parseCidr(cidr) {
  const [ip, prefixStr] = cidr.split("/");
  const prefix = parseInt(prefixStr || "32", 10);
  if (isNaN(prefix) || prefix < 0 || prefix > 32) {
    throw new Error("Invalid CIDR prefix: " + prefixStr);
  }
  const ipNum = ipToBigint(ip);
  const mask = prefix === 0 ? 0n : (0xffffffffn << BigInt(32 - prefix));
  const start = ipNum & mask;
  const end = start | (~mask & 0xffffffffn);
  return { start, end };
}

function bigintToCidr(start, end) {
  if (start === end) return bigintToIp(start) + "/32";
  let prefix = 32;
  while (prefix > 0) {
    const mask = prefix === 0 ? 0n : (0xffffffffn << BigInt(32 - prefix));
    if ((start & mask) === start && (start | (~mask & 0xffffffffn)) >= end) break;
    prefix--;
  }
  return bigintToIp(start) + "/" + prefix;
}
"""
with open("index.js", "a") as f:
    f.write(code)

