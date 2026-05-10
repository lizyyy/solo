export function maskValue(value: string, rule: string): string {
  switch (rule) {
    case 'mask_middle':
      if (value.length <= 2) {
        return '*'.repeat(value.length);
      }
      const keepStart = Math.floor(value.length * 0.25);
      const keepEnd = Math.floor(value.length * 0.25);
      const masked = value.slice(0, keepStart) + '*'.repeat(value.length - keepStart - keepEnd) + value.slice(-keepEnd);
      return masked;
    
    case 'replace_with_asterisk':
      return '*'.repeat(value.length);
    
    case 'hash':
      let hash = 0;
      for (let i = 0; i < value.length; i++) {
        const char = value.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return `HASH_${Math.abs(hash).toString(16).toUpperCase()}`;
    
    default:
      return value;
  }
}
