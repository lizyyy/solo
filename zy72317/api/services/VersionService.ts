import type { ParameterVersion } from '../../shared/types';
import { versionRepository } from '../repositories/VersionRepository';
import { weightRepository } from '../repositories/WeightRepository';
import { routeService } from './RouteService';

export class VersionService {
  getAllVersions(): ParameterVersion[] {
    return versionRepository.findAll();
  }

  getVersionById(id: string): ParameterVersion | null {
    return versionRepository.findById(id);
  }

  getLatestVersion(): ParameterVersion | null {
    return versionRepository.findLatest();
  }

  createVersion(versionNo: string, createdBy: string): ParameterVersion {
    const reviewInfo = weightRepository.getReviewInfo();
    if (!reviewInfo || !reviewInfo.reviewedBy) {
      throw new Error('评分权重表尚未补看完成，请先完成补看');
    }

    const gapResult = routeService.detectAndCreateGapRecords(createdBy);
    const hasGap = gapResult.openGapCount > 0;

    const version = versionRepository.create(
      versionNo,
      hasGap,
      gapResult.openGapCount,
      createdBy
    );

    return version;
  }

  publishVersion(id: string): ParameterVersion | null {
    const version = versionRepository.findById(id);
    if (!version) {
      throw new Error('版本不存在');
    }

    const openGapCount = routeService.countOpenGaps();
    if (openGapCount > 0) {
      throw new Error(`存在${openGapCount}处编号断档待教研组复核，不能发布版本，请先处理断档问题`);
    }

    return versionRepository.publish(id);
  }

  canPublish(): { canPublish: boolean; reason?: string } {
    const reviewInfo = weightRepository.getReviewInfo();
    if (!reviewInfo || !reviewInfo.reviewedBy) {
      return { canPublish: false, reason: '评分权重表尚未补看完成' };
    }

    const openGapCount = routeService.countOpenGaps();
    if (openGapCount > 0) {
      return { canPublish: false, reason: `存在${openGapCount}处编号断档待教研组复核` };
    }

    return { canPublish: true };
  }
}

export const versionService = new VersionService();
