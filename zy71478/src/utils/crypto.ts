export function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

export async function sha256(message: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  return simpleHash(message);
}

export function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 10)}`;
}

export async function calculateInputHash(input: Record<string, unknown>): Promise<string> {
  const orderedKeys = ['temperature', 'distance', 'timeDiff', 'timeUnit', 
                       'deviceDeviation', 'deviceId', 'operator'] as const;
  const orderedInput: Record<string, unknown> = {};
  for (const key of orderedKeys) {
    orderedInput[key] = input[key] ?? null;
  }
  const serialized = JSON.stringify(orderedInput);
  return sha256(serialized);
}

export async function calculateInputHashTyped<T extends object>(input: T): Promise<string> {
  return calculateInputHash(input as unknown as Record<string, unknown>);
}

export async function calculateViewHash(viewState: Record<string, unknown>): Promise<string> {
  const serialized = JSON.stringify(viewState);
  return sha256(serialized);
}
