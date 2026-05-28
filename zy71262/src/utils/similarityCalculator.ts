import { FormulaComponent, Pigment, SimilarPigmentResult } from '../types';

export function calculateFormulaSimilarity(f1: FormulaComponent[], f2: FormulaComponent[]): number {
  const allComponents = new Set([
    ...f1.map(c => c.componentName),
    ...f2.map(c => c.componentName),
  ]);
  
  const v1: number[] = [];
  const v2: number[] = [];
  
  allComponents.forEach(comp => {
    v1.push(f1.find(c => c.componentName === comp)?.ratio || 0);
    v2.push(f2.find(c => c.componentName === comp)?.ratio || 0);
  });
  
  const dotProduct = v1.reduce((sum, val, i) => sum + val * v2[i], 0);
  const norm1 = Math.sqrt(v1.reduce((sum, val) => sum + val * val, 0));
  const norm2 = Math.sqrt(v2.reduce((sum, val) => sum + val * val, 0));
  
  if (norm1 === 0 || norm2 === 0) return 0;
  
  return dotProduct / (norm1 * norm2);
}

export function calculateTransparencySimilarity(t1: number, t2: number): number {
  return 1 - Math.abs(t1 - t2);
}

export function calculateLightfastnessSimilarity(l1: number | null, l2: number | null): number {
  if (l1 === null || l2 === null) return 0.5;
  return 1 - Math.abs(l1 - l2) / 7;
}

export function calculateOverallSimilarity(p1: Pigment, p2: Pigment): number {
  const formulaSim = calculateFormulaSimilarity(p1.formula, p2.formula);
  const transparencySim = calculateTransparencySimilarity(p1.transparency, p2.transparency);
  const lightfastnessSim = calculateLightfastnessSimilarity(p1.lightfastness, p2.lightfastness);
  
  return formulaSim * 0.5 + transparencySim * 0.3 + lightfastnessSim * 0.2;
}

export function findSimilarPigments(
  targetId: string,
  pigments: Pigment[],
  topN: number = 5
): SimilarPigmentResult[] {
  const target = pigments.find(p => p.id === targetId);
  if (!target) return [];
  
  return pigments
    .filter(p => p.id !== targetId)
    .map(p => ({
      pigment: p,
      similarityScore: calculateOverallSimilarity(target, p),
      differences: {
        formula: calculateFormulaSimilarity(target.formula, p.formula),
        transparency: calculateTransparencySimilarity(target.transparency, p.transparency),
        lightfastness: calculateLightfastnessSimilarity(target.lightfastness, p.lightfastness),
      },
    }))
    .sort((a, b) => b.similarityScore - a.similarityScore)
    .slice(0, topN);
}

export function pigmentToCubePosition(pigment: Pigment): { x: number; y: number; z: number } {
  const x = (pigment.formula[0]?.ratio || 50) / 100 - 0.5;
  const y = pigment.transparency - 0.5;
  const z = (pigment.lightfastness || 4) / 8 - 0.5;
  
  return { x, y, z };
}
