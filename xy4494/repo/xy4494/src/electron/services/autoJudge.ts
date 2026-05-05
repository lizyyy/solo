import { LostItem, ItemCategory, ItemStatus, AutoJudgeResult } from '../../shared/types';

export class AutoJudgeService {
  private highValueThreshold: number = 5000;

  setHighValueThreshold(threshold: number): void {
    this.highValueThreshold = threshold;
  }

  judge(item: LostItem): AutoJudgeResult {
    const reasons: string[] = [];
    const suggestedActions: string[] = [];
    let canReturn = true;
    let needProof = false;
    let needSupervisor = false;
    let confidence = 80;

    if (item.estimatedValue >= this.highValueThreshold) {
      reasons.push(`物品价值较高（${item.estimatedValue}元），超过高价值阈值`);
      needSupervisor = true;
      canReturn = false;
      confidence = 90;
    }

    if (item.category === ItemCategory.VALUABLES) {
      reasons.push('物品类型为贵重物品，需要值班长复核');
      needSupervisor = true;
      canReturn = false;
      confidence = 95;
    }

    if (item.category === ItemCategory.DOCUMENTS) {
      reasons.push('物品为证件类物品，认领时需要核对身份信息');
      needProof = true;
      suggestedActions.push('请认领人提供身份证明文件');
      confidence = 85;
    }

    if (item.claimAppointments.length === 0) {
      reasons.push('暂无认领预约记录，需要等待认领人前来');
      canReturn = false;
      confidence -= 20;
    } else {
      const hasProof = item.claimAppointments.some(
        (a) => a.proofDocuments && a.proofDocuments.length > 0
      );
      if (!hasProof && item.category === ItemCategory.DOCUMENTS) {
        reasons.push('认领预约中未提供证明文件，需要补充');
        needProof = true;
        suggestedActions.push('请认领人补充提供证明文件');
      }
    }

    if (item.photos.length === 0) {
      reasons.push('暂无物品照片，建议补充照片以便认领核对');
      suggestedActions.push('请补充物品照片');
      confidence -= 10;
    }

    if (item.finderName.trim() === '') {
      reasons.push('未记录交件人信息');
      confidence -= 5;
    }

    if (!item.specialMarks || item.specialMarks.trim() === '') {
      reasons.push('未记录物品特殊标识，认领核对可能有困难');
      suggestedActions.push('请补充物品特殊标识描述');
      confidence -= 15;
    }

    if (needSupervisor) {
      suggestedActions.push('提交值班长复核');
    } else if (needProof) {
      suggestedActions.push('请认领人提供补充证明材料');
    } else if (canReturn && item.claimAppointments.length > 0) {
      suggestedActions.push('可正常归还物品');
    } else {
      suggestedActions.push('等待认领人预约');
    }

    confidence = Math.max(0, Math.min(100, confidence));

    return {
      canReturn: canReturn && !needProof && !needSupervisor && item.claimAppointments.length > 0,
      needProof,
      needSupervisor,
      reasons,
      suggestedActions,
      confidence,
    };
  }

  getStatusFromJudgeResult(judgeResult: AutoJudgeResult): ItemStatus {
    if (judgeResult.needSupervisor) {
      return ItemStatus.NEED_SUPERVISOR;
    } else if (judgeResult.needProof) {
      return ItemStatus.NEED_PROOF;
    } else if (judgeResult.canReturn) {
      return ItemStatus.APPROVED;
    }
    return ItemStatus.PROCESSING;
  }
}
