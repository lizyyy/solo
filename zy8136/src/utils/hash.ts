export function consistentHash(input: string, seed: string = 'canary'): number {
  let hash = 5381;
  const combined = seed + input;
  
  for (let i = 0; i < combined.length; i++) {
    hash = ((hash << 5) + hash) + combined.charCodeAt(i);
    hash = hash & hash;
  }
  
  return Math.abs(hash % 100);
}

export function userInBucket(userId: string, percentage: number, seed: string = 'canary'): boolean {
  const hash = consistentHash(userId, seed);
  return hash < percentage;
}

export function calculateBucket(userId: string, totalBuckets: number = 100, seed: string = 'canary'): number {
  const hash = consistentHash(userId, seed);
  return hash % totalBuckets;
}
