export function computeDiff(oldStr: string, newStr: string): string {
  const oldTrimmed = (oldStr || '').trim();
  const newTrimmed = (newStr || '').trim();

  if (oldTrimmed === newTrimmed) {
    return '无变更';
  }

  if (!oldTrimmed && newTrimmed) {
    return `新增备注: ${newTrimmed}`;
  }

  if (oldTrimmed && !newTrimmed) {
    return `移除备注: ${oldTrimmed}`;
  }

  const additions: string[] = [];
  const deletions: string[] = [];

  const oldChars = oldTrimmed.split('');
  const newChars = newTrimmed.split('');

  let i = 0;
  let j = 0;

  while (i < oldChars.length || j < newChars.length) {
    if (i < oldChars.length && j < newChars.length && oldChars[i] === newChars[j]) {
      i++;
      j++;
    } else if (j < newChars.length && (i >= oldChars.length || oldChars[i] !== newChars[j])) {
      additions.push(newChars[j]);
      j++;
    } else if (i < oldChars.length) {
      deletions.push(oldChars[i]);
      i++;
    }
  }

  const parts: string[] = [];
  if (additions.length > 0) {
    parts.push(`新增: "${additions.join('')}"`);
  }
  if (deletions.length > 0) {
    parts.push(`删除: "${deletions.join('')}"`);
  }

  return parts.length > 0 ? parts.join(', ') : '内容变更';
}
