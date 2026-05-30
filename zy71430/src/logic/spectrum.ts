
import { MINERALS } from '../data/minerals';
import { Mineral } from '../types';

export function calculateSpectrumSimilarity(
  spectrum1: number[],
  spectrum2: number[]
): number {
  if (spectrum1.length !== spectrum2.length) return 0;

  const dotProduct = spectrum1.reduce((sum, val, i) => sum + val * spectrum2[i], 0);
  const norm1 = Math.sqrt(spectrum1.reduce((sum, val) => sum + val * val, 0));
  const norm2 = Math.sqrt(spectrum2.reduce((sum, val) => sum + val * val, 0));

  if (norm1 === 0 || norm2 === 0) return 0;
  return dotProduct / (norm1 * norm2);
}

export function findMatchingMineral(spectrum: number[]): {
  mineral: Mineral;
  similarity: number;
} | null {
  let bestMatch: Mineral | null = null;
  let highestSimilarity = 0;

  for (const mineral of MINERALS) {
    const similarity = calculateSpectrumSimilarity(spectrum, mineral.spectrum);
    if (similarity > highestSimilarity) {
      highestSimilarity = similarity;
      bestMatch = mineral;
    }
  }

  if (!bestMatch) return null;
  return { mineral: bestMatch, similarity: highestSimilarity };
}

export function getSimilarityConfidence(similarity: number): string {
  if (similarity >= 0.95) return '极高';
  if (similarity >= 0.85) return '高';
  if (similarity >= 0.7) return '中等';
  if (similarity >= 0.5) return '低';
  return '极低';
}

export function addSpectrumNoise(spectrum: number[], noiseLevel: number = 0.05): number[] {
  return spectrum.map(value => {
    const noise = (Math.random() - 0.5) * noiseLevel * 2;
    return Math.max(0, Math.min(1, value + noise));
  });
}
