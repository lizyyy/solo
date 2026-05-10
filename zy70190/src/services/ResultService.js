const dayjs = require('dayjs');
const { MaterialShortage, CommitmentVersion, UrgeTask, DeliveryReceipt, RiskReport, AffectedOrder } = require('../models');

class ResultService {
  static async calculateShortageResult(shortageId) {
    const shortage = await MaterialShortage.findByPk(shortageId, {
      include: [
        { model: CommitmentVersion, as: 'commitments', order: [['versionNo', 'DESC']] },
        { model: UrgeTask, as: 'urgeTasks', order: [['createdAt', 'DESC']] },
        { model: DeliveryReceipt, as: 'deliveryReceipts', order: [['deliveryDate', 'DESC']] },
        { model: RiskReport, as: 'riskReports', order: [['createdAt', 'DESC']] },
        { model: AffectedOrder, as: 'affectedOrders' }
      ]
    });

    if (!shortage) {
      throw new Error('缺料单不存在');
    }

    const result = this._analyzeShortage(shortage);
    return result;
  }

  static _analyzeShortage(shortage) {
    const data = {
      shortageNo: shortage.shortageNo,
      material: `${shortage.materialName} (${shortage.materialCode})`,
      supplier: `${shortage.supplierName} (${shortage.supplierCode})`,
      requiredDate: shortage.requiredDate,
      requiredQuantity: parseFloat(shortage.requiredQuantity),
      status: shortage.status
    };

    const latestCommitment = shortage.commitments[0];
    const totalDelivered = shortage.deliveryReceipts.reduce((sum, r) => sum + parseFloat(r.deliveryQuantity), 0);
    const pendingUrges = shortage.urgeTasks.filter(t => t.status === 'pending' || t.status === 'in_progress');
    const activeRisks = shortage.riskReports.filter(r => r.status === 'active' || r.status === 'mitigated');
    const affectedOrders = shortage.affectedOrders;

    let resultText = `【缺料单分析报告】\n`;
    resultText += `================================\n`;
    resultText += `缺料单号：${data.shortageNo}\n`;
    resultText += `物料信息：${data.material}\n`;
    resultText += `供应商：${data.supplier}\n`;
    resultText += `需求日期：${dayjs(data.requiredDate).format('YYYY-MM-DD')}\n`;
    resultText += `需求数量：${data.requiredQuantity}\n`;
    resultText += `================================\n\n`;

    resultText += `一、承诺情况\n`;
    if (latestCommitment) {
      resultText += `  最新承诺日期：${dayjs(latestCommitment.promiseDate).format('YYYY-MM-DD')}\n`;
      resultText += `  承诺数量：${parseFloat(latestCommitment.promiseQuantity)}\n`;
      resultText += `  承诺版本：第${latestCommitment.versionNo}版\n`;
      resultText += `  承诺原因：${latestCommitment.reason || '无'}\n`;
      resultText += `  承诺来源：${latestCommitment.source || '无'}\n\n`;
    } else {
      resultText += `  ❌ 尚未收到供应商承诺！\n\n`;
    }

    resultText += `二、到料情况\n`;
    resultText += `  累计到料：${totalDelivered}\n`;
    resultText += `  缺口数量：${Math.max(0, data.requiredQuantity - totalDelivered)}\n`;
    if (shortage.deliveryReceipts.length > 0) {
      const latestReceipt = shortage.deliveryReceipts[0];
      resultText += `  最近到料日期：${dayjs(latestReceipt.deliveryDate).format('YYYY-MM-DD')}\n`;
      resultText += `  最近到料数量：${parseFloat(latestReceipt.deliveryQuantity)}\n`;
      resultText += `  质量状态：${this._translateQualityStatus(latestReceipt.qualityStatus)}\n`;
    }
    resultText += `\n`;

    resultText += `三、催办情况\n`;
    resultText += `  待处理催办任务：${pendingUrges.length} 项\n`;
    if (pendingUrges.length > 0) {
      resultText += `  紧急程度：\n`;
      const urgentCount = pendingUrges.filter(t => t.priority === 'urgent').length;
      const highCount = pendingUrges.filter(t => t.priority === 'high').length;
      if (urgentCount > 0) resultText += `    🔴 紧急：${urgentCount} 项\n`;
      if (highCount > 0) resultText += `    🟠 高：${highCount} 项\n`;
    }
    resultText += `\n`;

    resultText += `四、风险情况\n`;
    resultText += `  活跃风险报告：${activeRisks.length} 份\n`;
    if (activeRisks.length > 0) {
      const criticalCount = activeRisks.filter(r => r.riskLevel === 'critical').length;
      const highCount = activeRisks.filter(r => r.riskLevel === 'high').length;
      if (criticalCount > 0) resultText += `    🔴 严重风险：${criticalCount} 份\n`;
      if (highCount > 0) resultText += `    🟠 高风险：${highCount} 份\n`;
    }
    resultText += `\n`;

    resultText += `五、影响订单\n`;
    resultText += `  受影响订单数：${affectedOrders.length} 个\n`;
    if (affectedOrders.length > 0) {
      const criticalOrders = affectedOrders.filter(o => o.impactLevel === 'critical');
      resultText += `  严重影响订单：${criticalOrders.length} 个\n`;
    }
    resultText += `\n`;

    resultText += `================================\n`;
    resultText += `六、综合判断\n`;
    const conclusion = this._generateConclusion(shortage, latestCommitment, totalDelivered, pendingUrges, activeRisks, affectedOrders);
    resultText += conclusion;

    return {
      summary: resultText,
      details: {
        shortage: data,
        latestCommitment: latestCommitment ? {
          date: dayjs(latestCommitment.promiseDate).format('YYYY-MM-DD'),
          quantity: parseFloat(latestCommitment.promiseQuantity),
          version: latestCommitment.versionNo
        } : null,
        delivery: {
          totalDelivered,
          gap: Math.max(0, data.requiredQuantity - totalDelivered),
          isFullyDelivered: totalDelivered >= data.requiredQuantity
        },
        urges: {
          pendingCount: pendingUrges.length,
          urgentCount: pendingUrges.filter(t => t.priority === 'urgent').length
        },
        risks: {
          activeCount: activeRisks.length,
          criticalCount: activeRisks.filter(r => r.riskLevel === 'critical').length
        },
        orders: {
          totalAffected: affectedOrders.length,
          criticalCount: affectedOrders.filter(o => o.impactLevel === 'critical').length
        },
        conclusion
      }
    };
  }

  static _generateConclusion(shortage, latestCommitment, totalDelivered, pendingUrges, activeRisks, affectedOrders) {
    const requiredDate = dayjs(shortage.requiredDate);
    const requiredQuantity = parseFloat(shortage.requiredQuantity);
    const today = dayjs();

    let conclusion = '';

    if (totalDelivered >= requiredQuantity) {
      conclusion += `✅ 物料已全部到料，缺料问题已解决。\n`;
      if (shortage.actualDeliveryDate) {
        const actualDate = dayjs(shortage.actualDeliveryDate);
        if (actualDate.isAfter(requiredDate)) {
          conclusion += `⚠️ 注意：实际到料日期晚于需求日期 ${actualDate.diff(requiredDate, 'day')} 天。\n`;
        }
      }
      return conclusion;
    }

    if (shortage.status === 'withdrawn') {
      conclusion += `📝 该缺料单已撤回，不再追踪。\n`;
      return conclusion;
    }

    const hasCriticalIssue = activeRisks.some(r => r.riskLevel === 'critical');
    const hasUrgentTask = pendingUrges.some(t => t.priority === 'urgent');
    const hasCriticalOrder = affectedOrders.some(o => o.impactLevel === 'critical');
    const daysToRequired = requiredDate.diff(today, 'day');

    if (hasCriticalIssue || hasUrgentTask || hasCriticalOrder) {
      conclusion += `🔴 【紧急预警】\n`;
      if (hasCriticalIssue) conclusion += `  - 存在严重风险，必须立即处理！\n`;
      if (hasUrgentTask) conclusion += `  - 有紧急催办任务待处理！\n`;
      if (hasCriticalOrder) conclusion += `  - 涉及严重影响的订单！\n`;
    } else if (activeRisks.length > 0 || pendingUrges.length > 0) {
      conclusion += `🟠 【存在风险】\n`;
      conclusion += `  - 有 ${activeRisks.length} 项风险需要关注\n`;
      conclusion += `  - 有 ${pendingUrges.length} 项催办任务待处理\n`;
    } else if (latestCommitment) {
      const promiseDate = dayjs(latestCommitment.promiseDate);
      if (promiseDate.isAfter(requiredDate)) {
        conclusion += `🟡 【承诺延期】\n`;
        conclusion += `  - 供应商承诺日期晚于需求日期 ${promiseDate.diff(requiredDate, 'day')} 天\n`;
        conclusion += `  - 请关注对生产计划的影响\n`;
      } else {
        conclusion += `🟢 【进展正常】\n`;
        conclusion += `  - 供应商承诺在需求日期前到料\n`;
        conclusion += `  - 建议持续追踪\n`;
      }
    } else {
      conclusion += `🟡 【等待承诺】\n`;
      conclusion += `  - 尚未收到供应商承诺\n`;
      if (daysToRequired <= 7 && daysToRequired > 0) {
        conclusion += `  - ⚠️ 距离需求日期仅剩 ${daysToRequired} 天，请尽快跟进！\n`;
      } else if (daysToRequired <= 0) {
        conclusion += `  - ⚠️ 已过需求日期，问题严重！\n`;
      }
    }

    if (!latestCommitment && daysToRequired <= 7) {
      conclusion += `\n建议：\n`;
      conclusion += `  1. 立即联系供应商确认到料时间\n`;
      conclusion += `  2. 评估是否需要启动应急预案\n`;
      conclusion += `  3. 通知生产计划部门调整排产\n`;
    }

    return conclusion;
  }

  static _translateQualityStatus(status) {
    const map = {
      'qualified': '合格',
      'unqualified': '不合格',
      'inspecting': '检验中'
    };
    return map[status] || status;
  }

  static async recalculateAll() {
    const shortages = await MaterialShortage.findAll({
      where: { status: ['pending', 'processing'] }
    });

    const results = [];
    for (const shortage of shortages) {
      const result = await this.calculateShortageResult(shortage.id);
      await shortage.update({ result: result.summary });
      results.push({
        shortageNo: shortage.shortageNo,
        recalculated: true
      });
    }

    return {
      totalRecalculated: results.length,
      details: results
    };
  }
}

module.exports = ResultService;
