import { calculateEditDistance } from './diff';

export function calculateSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  const editDistance = calculateEditDistance(a, b);
  const maxLength = Math.max(a.length, b.length);

  return 1 - editDistance / maxLength;
}

export function calculateJaccardSimilarity(a: string, b: string, nGramSize: number = 2): number {
  const gramsA = getNGrams(a, nGramSize);
  const gramsB = getNGrams(b, nGramSize);

  if (gramsA.size === 0 && gramsB.size === 0) return 1;
  if (gramsA.size === 0 || gramsB.size === 0) return 0;

  const intersection = new Set([...gramsA].filter((x) => gramsB.has(x)));
  const union = new Set([...gramsA, ...gramsB]);

  return intersection.size / union.size;
}

function getNGrams(str: string, n: number): Set<string> {
  const grams = new Set<string>();
  const padded = ` ${str} `;

  for (let i = 0; i <= padded.length - n; i++) {
    grams.add(padded.substring(i, i + n));
  }

  return grams;
}

export function calculateCombinedSimilarity(a: string, b: string): number {
  const editSimilarity = calculateSimilarity(a, b);
  const jaccardSimilarity = calculateJaccardSimilarity(a, b, 2);

  return editSimilarity * 0.6 + jaccardSimilarity * 0.4;
}

export function isSimilar(
  a: string,
  b: string,
  threshold: number = 0.85
): { isSimilar: boolean; similarity: number } {
  if (a === b) {
    return { isSimilar: true, similarity: 1 };
  }

  const similarity = calculateCombinedSimilarity(a, b);
  return {
    isSimilar: similarity >= threshold,
    similarity,
  };
}

export function isDuplicate(
  a: string,
  b: string,
  threshold: number = 0.85
): { isDuplicate: boolean; similarity: number } {
  const result = isSimilar(a, b, threshold);
  return {
    isDuplicate: result.isSimilar,
    similarity: result.similarity,
  };
}

export function findMostSimilar(
  target: string,
  candidates: string[],
  threshold: number = 0.7
): { index: number; similarity: number } | null {
  let bestMatch: { index: number; similarity: number } | null = null;

  for (let i = 0; i < candidates.length; i++) {
    const similarity = calculateCombinedSimilarity(target, candidates[i]);
    if (similarity >= threshold && (!bestMatch || similarity > bestMatch.similarity)) {
      bestMatch = { index: i, similarity };
    }
  }

  return bestMatch;
}

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[，。！？、；：""''（）【】《》\[\]()<>\-_,.;:!?'"`~@#$%^&*+=|\\/]/g, '')
    .trim();
}

export function isContentSimilar(
  content1: string,
  content2: string,
  threshold: number = 0.85
): { isSimilar: boolean; similarity: number } {
  const normalized1 = normalizeText(content1);
  const normalized2 = normalizeText(content2);

  const result = isSimilar(normalized1, normalized2, threshold);
  return result;
}
