export async function sha256(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

export async function calculateEvidenceChainHash(
  rate: any,
  refund: any,
  attachments: any[],
  confirmations: any[]
): Promise<string> {
  const evidence = {
    rate: JSON.stringify(rate),
    refund: JSON.stringify(refund),
    attachments: attachments.map(a => JSON.stringify(a)).sort().join('|'),
    confirmations: confirmations.map(c => JSON.stringify(c)).sort().join('|'),
  };
  return sha256(JSON.stringify(evidence));
}

export async function calculateDataHash(data: any[]): Promise<string> {
  const sortedData = [...data].sort((a, b) => {
    const aStr = JSON.stringify(a);
    const bStr = JSON.stringify(b);
    return aStr.localeCompare(bStr);
  });
  return sha256(JSON.stringify(sortedData));
}

export function shortHash(hash: string, length: number = 8): string {
  return hash.substring(0, length);
}
