export function generateImportCommand(fileName: string, operator: string): string {
  return `bridge-crack import --file="${fileName}" --operator="${operator}"`;
}

export function generateSupplementCommand(rowId: string, photoNumber: string, operator: string): string {
  return `bridge-crack supplement --row-id="${rowId}" --photo-number="${photoNumber}" --operator="${operator}"`;
}

export function generateReviewCommand(rowId: string, comment: string, operator: string): string {
  const escapedComment = comment.replace(/"/g, '\\"');
  return `bridge-crack review --row-id="${rowId}" --comment="${escapedComment}" --operator="${operator}"`;
}

export function generateUpdateOcclusionCommand(photoPointIds: string[], operator: string): string {
  const ids = photoPointIds.join(',');
  return `bridge-crack occlusion --ids="${ids}" --operator="${operator}"`;
}

export function generateRecalculateCommand(version: string, operator: string): string {
  return `bridge-crack recalculate --version="${version}" --operator="${operator}"`;
}

export function generateExportCommand(format: 'xlsx' | 'csv', operator: string): string {
  return `bridge-crack export --format="${format}" --operator="${operator}"`;
}

export function generateSelfCheckCommand(checkType: string, operator: string): string {
  return `bridge-crack self-check --type="${checkType}" --operator="${operator}"`;
}

export function generateFixMissingRowCommand(
  rowId: string,
  x: number,
  y: number,
  z: number,
  operator: string
): string {
  return `bridge-crack fix-missing --row-id="${rowId}" --x=${x} --y=${y} --z=${z} --operator="${operator}"`;
}
