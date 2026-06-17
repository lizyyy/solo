import type { Point } from '@/types';
import { mockPoints } from '@/mocks/points';
import { findMergeCandidates, mergePoints as mergePointsUtil } from '@/utils/merge';
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
    const unmergedPoints = pointsData.filter(p => !p.isMerged);
    return findMergeCandidates(unmergedPoints);
  },

  async mergePoints(pointIds: string[], targetName: string): Promise<Point> {
    await delay(500);
    const pointsToMerge = pointsData.filter(p => pointIds.includes(p.id));
    if (pointsToMerge.length < 2) {
      throw new Error('需要至少两个点位才能合并');
    }
    const mergedPoint = mergePointsUtil(pointsToMerge, targetName);
    pointsData = pointsData.filter(p => !pointIds.includes(p.id));
    pointsData.push(mergedPoint);
    for (const oldId of pointIds) {
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
