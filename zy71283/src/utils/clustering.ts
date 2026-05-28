import type { Cluster, ColorSwatch, Work } from '@/data/types';
import { hexToHsl, hexToOklch } from './colorSpace';
import { ciede2000FromHex } from './ciede2000';

interface ClusterNode {
  id: number;
  workIds: string[];
  distance: number;
  children: [number, number] | null;
}

export function agglomerativeClustering(
  works: Work[],
  swatches: ColorSwatch[],
  threshold: number = 15
): ClusterNode[] {
  const n = works.length;
  if (n === 0) return [];

  const distMatrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dist = computeWorkDistance(works[i], works[j], swatches);
      distMatrix[i][j] = dist;
      distMatrix[j][i] = dist;
    }
  }

  const nodes: ClusterNode[] = works.map((w, i) => ({
    id: i,
    workIds: [w.id],
    distance: 0,
    children: null,
  }));

  const active = new Set<number>(works.map((_, i) => i));
  let nextId = n;

  while (active.size > 1) {
    let minDist = Infinity;
    let minI = -1;
    let minJ = -1;

    const activeArr = Array.from(active);
    for (let a = 0; a < activeArr.length; a++) {
      for (let b = a + 1; b < activeArr.length; b++) {
        const i = activeArr[a];
        const j = activeArr[b];
        const d = computeClusterDistance(nodes[i], nodes[j], distMatrix, works);
        if (d < minDist) {
          minDist = d;
          minI = i;
          minJ = j;
        }
      }
    }

    if (minDist > threshold) break;

    const newNode: ClusterNode = {
      id: nextId++,
      workIds: [...nodes[minI].workIds, ...nodes[minJ].workIds],
      distance: minDist,
      children: [minI, minJ],
    };

    nodes.push(newNode);
    active.delete(minI);
    active.delete(minJ);
    active.add(newNode.id);
  }

  return nodes;
}

function computeClusterDistance(
  a: ClusterNode,
  b: ClusterNode,
  distMatrix: number[][],
  works: Work[]
): number {
  let maxDist = 0;
  for (const wa of a.workIds) {
    for (const wb of b.workIds) {
      const ia = works.findIndex(w => w.id === wa);
      const ib = works.findIndex(w => w.id === wb);
      if (ia >= 0 && ib >= 0) {
        maxDist = Math.max(maxDist, distMatrix[ia][ib]);
      }
    }
  }
  return maxDist;
}

export function computeWorkDistance(
  workA: Work,
  workB: Work,
  swatches: ColorSwatch[]
): number {
  const swA = swatches.filter(s => s.workId === workA.id && !s.isBackground);
  const swB = swatches.filter(s => s.workId === workB.id && !s.isBackground);

  if (swA.length === 0 || swB.length === 0) return 100;

  let totalDist = 0;
  let pairs = 0;

  for (const a of swA) {
    let minDist = Infinity;
    for (const b of swB) {
      const d = ciede2000FromHex(a.hex, b.hex);
      minDist = Math.min(minDist, d);
    }
    totalDist += minDist;
    pairs++;
  }

  for (const b of swB) {
    let minDist = Infinity;
    for (const a of swA) {
      const d = ciede2000FromHex(a.hex, b.hex);
      minDist = Math.min(minDist, d);
    }
    totalDist += minDist;
    pairs++;
  }

  return pairs > 0 ? totalDist / pairs : 100;
}

export function extractClusters(
  nodes: ClusterNode[],
  works: Work[],
  swatches: ColorSwatch[]
): Cluster[] {
  const allNodeIds = new Set(nodes.map(n => n.id));
  const childIds = new Set<number>();
  for (const n of nodes) {
    if (n.children) {
      childIds.add(n.children[0]);
      childIds.add(n.children[1]);
    }
  }
  const rootIds = [...allNodeIds].filter(id => !childIds.has(id));

  const clusters: Cluster[] = [];
  let clusterIdx = 0;

  for (const rootId of rootIds) {
    const node = nodes.find(n => n.id === rootId);
    if (!node) continue;

    const clusterSwatches = swatches.filter(
      s => node.workIds.includes(s.workId) && !s.isBackground
    );

    const avgH = averageHue(clusterSwatches.map(s => hexToHsl(s.hex).h));
    const avgS = clusterSwatches.reduce((sum, s) => sum + hexToHsl(s.hex).s, 0) / Math.max(clusterSwatches.length, 1);
    const avgL = clusterSwatches.reduce((sum, s) => sum + hexToHsl(s.hex).l, 0) / Math.max(clusterSwatches.length, 1);

    const label = generateClusterLabel(avgH, avgS, avgL);
    const description = generateClusterDescription(avgH, avgS, avgL, node.workIds.length);

    const repId = findRepresentative(node.workIds, swatches, avgH, avgS, avgL);

    clusters.push({
      id: `cluster-${clusterIdx++}`,
      label,
      description,
      workIds: node.workIds,
      representativeWorkId: repId,
      avgHue: avgH,
      avgSaturation: avgS,
      avgLightness: avgL,
    });
  }

  return clusters;
}

function averageHue(angles: number[]): number {
  if (angles.length === 0) return 0;
  const rads = angles.map(a => a * Math.PI / 180);
  const sinSum = rads.reduce((s, r) => s + Math.sin(r), 0);
  const cosSum = rads.reduce((s, r) => s + Math.cos(r), 0);
  let avg = Math.atan2(sinSum, cosSum) * 180 / Math.PI;
  if (avg < 0) avg += 360;
  return avg;
}

function generateClusterLabel(h: number, s: number, l: number): string {
  const temp = h < 70 || h > 290 ? '暖' : '冷';
  const sat = s > 60 ? '高饱和' : s > 30 ? '中饱和' : '低饱和';
  const light = l > 65 ? '亮' : l > 35 ? '中' : '暗';
  return `${temp}色${sat}${light}调`;
}

function generateClusterDescription(h: number, s: number, l: number, count: number): string {
  const temp = h < 70 || h > 290 ? '暖色调' : '冷色调';
  const sat = s > 60 ? '饱和度较高，色彩鲜明' : s > 30 ? '饱和度适中' : '饱和度偏低，偏向灰调';
  const light = l > 65 ? '明度偏高，整体偏亮' : l > 35 ? '明度适中' : '明度偏低，整体偏暗';
  return `${count}件作品组成${temp}组，${sat}，${light}。平均色相${h.toFixed(0)}°，饱和度${s.toFixed(0)}%，明度${l.toFixed(0)}%。`;
}

function findRepresentative(
  workIds: string[],
  swatches: ColorSwatch[],
  avgH: number,
  avgS: number,
  avgL: number
): string {
  let bestId = workIds[0];
  let bestScore = Infinity;

  for (const wid of workIds) {
    const ws = swatches.filter(s => s.workId === wid && !s.isBackground);
    if (ws.length === 0) continue;
    const wAvgH = averageHue(ws.map(s => hexToHsl(s.hex).h));
    const wAvgS = ws.reduce((sum, s) => sum + hexToHsl(s.hex).s, 0) / ws.length;
    const wAvgL = ws.reduce((sum, s) => sum + hexToHsl(s.hex).l, 0) / ws.length;

    const hueD = Math.min(Math.abs(wAvgH - avgH), 360 - Math.abs(wAvgH - avgH));
    const score = hueD + Math.abs(wAvgS - avgS) + Math.abs(wAvgL - avgL);

    if (score < bestScore) {
      bestScore = score;
      bestId = wid;
    }
  }

  return bestId;
}
