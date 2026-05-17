code = '''

function parseLine(line, lineNumber) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;
  const parts = trimmed.split(/[,\\t]/).map(p => p.trim());
  if (parts.length < 4) {
    return { lineNumber, rawContent: line, reason: "Not enough fields: need 4, got " + parts.length };
  }
  const [cidr, team, purpose, environment] = parts;
  if (!cidr) {
    return { lineNumber, rawContent: line, reason: "CIDR cannot be empty" };
  }
  try {
    const { start, end } = parseCidr(cidr);
    return { lineNumber, cidr, team: team || "Unspecified", purpose: purpose || "Unspecified", environment: environment || "Unspecified", startIp: start, endIp: end };
  } catch (e) {
    return { lineNumber, rawContent: line, reason: "CIDR parse failed: " + e.message };
  }
}
'''
with open('index.js', 'a') as f:
    f.write(code)
print('Added parseLine')
