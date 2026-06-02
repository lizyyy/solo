export function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

export function similarityScore(a: string, b: string): number {
  if (!a || !b) return 0;
  
  const normalizedA = a.toLowerCase().trim();
  const normalizedB = b.toLowerCase().trim();
  
  if (normalizedA === normalizedB) return 1;
  
  const distance = levenshteinDistance(normalizedA, normalizedB);
  const maxLength = Math.max(normalizedA.length, normalizedB.length);
  
  return 1 - distance / maxLength;
}

export function extractTrackNumber(filename: string): number | null {
  const match = filename.match(/^(\d+)[_\-\s]/);
  if (match) {
    return parseInt(match[1], 10);
  }
  return null;
}

export function extractTrackName(filename: string): string {
  let name = filename;
  
  name = name.replace(/\.[^/.]+$/, '');
  
  name = name.replace(/^(\d+)[_\-\s]+/, '');
  
  name = name.replace(/[_\-]+/g, ' ');
  
  return name.trim();
}

export function formatDuration(seconds: number | undefined): string {
  if (seconds === undefined || seconds === null) return '--:--';
  
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function parseDurationString(str: string): number | null {
  const match = str.match(/^(\d+):(\d{2})$/);
  if (match) {
    const mins = parseInt(match[1], 10);
    const secs = parseInt(match[2], 10);
    return mins * 60 + secs;
  }
  return null;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function findTextDiff(oldText: string, newText: string): { added: string[]; removed: string[] } {
  const oldWords = oldText.split(/\s+/).filter(w => w);
  const newWords = newText.split(/\s+/).filter(w => w);
  
  const added: string[] = [];
  const removed: string[] = [];
  
  newWords.forEach(word => {
    if (!oldWords.includes(word)) {
      added.push(word);
    }
  });
  
  oldWords.forEach(word => {
    if (!newWords.includes(word)) {
      removed.push(word);
    }
  });
  
  return { added, removed };
}
