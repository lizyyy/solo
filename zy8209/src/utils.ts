export function generateId(): string {
  return `ISSUE-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
}

export function arrayToString(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

export function isWildcard(value: string): boolean {
  return value === '*' || value.includes('*');
}

export function isExternalAccount(arn: string): boolean {
  const pattern = /^arn:aws:iam::(\d+):/;
  const match = arn.match(pattern);
  if (!match) return false;
  const accountId = match[1];
  return accountId.length === 12 && !['123456789012', '111122223333'].includes(accountId);
}

export function isPublicPrincipal(principal: string | string[] | Record<string, string | string[]> | undefined): boolean {
  if (!principal) return false;
  const principals = normalizePrincipals(principal);
  return principals.some(p => p === '*' || p.toLowerCase() === 'anonymous');
}

export function normalizePrincipals(
  principal: string | string[] | Record<string, string | string[]> | undefined
): string[] {
  if (!principal) return [];
  
  if (typeof principal === 'string') {
    return [principal];
  }
  
  if (Array.isArray(principal)) {
    return principal;
  }
  
  if (typeof principal === 'object') {
    const result: string[] = [];
    for (const key of Object.keys(principal)) {
      const value = principal[key];
      if (Array.isArray(value)) {
        result.push(...value);
      } else {
        result.push(value);
      }
    }
    return result;
  }
  
  return [];
}

export function isS3Bucket(resourceType: string): boolean {
  return resourceType === 'aws_s3_bucket' || resourceType === 'google_storage_bucket';
}

export function isIAMRole(resourceType: string): boolean {
  return resourceType === 'aws_iam_role' || resourceType === 'google_iam_role';
}

export function isIAMPolicy(resourceType: string): boolean {
  return resourceType === 'aws_iam_policy' || 
         resourceType === 'aws_s3_bucket_policy' ||
         resourceType === 'google_iam_policy';
}
