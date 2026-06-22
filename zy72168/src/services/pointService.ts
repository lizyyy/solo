import type { Point } from '@/types';
import { mockPoints } from '@/mocks/points';
import { findMergeCandidates, mergePoints as mergePointsUtil, shouldMerge } from '@/utils/merge';
import { feedbackService } from '@/services/feedbackService';
import { planService } from '@/services/planService';

let pointsData: Point[] = [...mockPoints];

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export const pointService = {
  async getPoints(params?: { status?: string; keyword?: string }): Promise<Point[]> {
    await delay(300);
    let result = [...pointsData];
    if (params?.status) {
      result = result.filter(p => p.status === params.status);
    }
    if (params?.keyword) {
      const keyword = params.keyword.toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(keyword) ||
        p.aliases.some(a => a.toLowerCase().includes(keyword)) ||
        p.address.toLowerCase().includes(keyword)
      );
    }
    return result;
  },

  async getPointById(id: string): Promise<Point | null> {
    await delay(200);
    return pointsData.find(p => p.id === id) || null;
  },

  async getMergeCandidates(): Promise<Point[][]> {
    await delay(300);
    return findMergeCandidates(pointsData);
  },

  async mergePoints(pointIds: string[], targetName: string): Promise<Point> {
    await delay(500);
    const directPoints = pointsData.filter(p => pointIds.includes(p.id));
    if (directPoints.length < 2) {
      throw new Error('需要至少两个点位才能合并');
    }
    const allRelatedIds = new Set<string>(pointIds);
    for (const dp of directPoints) {
      for (const p of pointsData) {
        if (allRelatedIds.has(p.id)) continue;
        if (shouldMerge(dp, p)) {
          allRelatedIds.add(p.id);
        }
      }
    }
    const allRelatedPoints = pointsData.filter(p => allRelatedIds.has(p.id));
    const mergedPoint = mergePointsUtil(allRelatedPoints, targetName);
    pointsData = pointsData.filter(p => !allRelatedIds.has(p.id));
    pointsData.push(mergedPoint);
    for (const oldId of Array.from(allRelatedIds)) {
      await feedbackService.reassignPointId(oldId, mergedPoint.id);
      await planService.reassignPointId(oldId, mergedPoint.id);
    }
    return mergedPoint;
  },

  async updatePoint(id: string, data: Partial<Point>): Promise<Point> {
    await delay(300);
    const index = pointsData.findIndex(p => p.id === id);
    if (index === -1) {
      throw new Error('点位不存在');
    }
    pointsData[index] = {
      ...pointsData[index],
      ...data,
      updatedAt: new Date().toISOString(),
    };
    return pointsData[index];
  },

  async getAdjacentPoints(pointId: string): Promise<Point[]> {
    await delay(200);
    const point = pointsData.find(p => p.id === pointId);
    if (!point || !point.adjacentPointIds) {
      return [];
    }
    return pointsData.filter(p => point.adjacentPointIds?.includes(p.id));
  },
};
