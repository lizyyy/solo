import { Material, ClassificationResult, MaterialStatus } from './types';

export function classifyMaterial(material: Partial<Material>): ClassificationResult {
  const requiredFields = ['document_number', 'borrower', 'borrow_date'];
  const missingFields: string[] = [];

  for (const field of requiredFields) {
    if (!material[field as keyof Material]) {
      missingFields.push(field);
    }
  }

  if (missingFields.length > 0) {
    return {
      status: 'needs_supplement',
      reason: `缺少必填字段: ${missingFields.join(', ')}`,
      followUpAction: '请档案室管理员联系借阅人补充材料信息'
    };
  }

  if (material.document_number) {
    const docNum = material.document_number.toUpperCase();
    if (docNum.includes('TEST') || docNum.includes('INVALID')) {
      return {
        status: 'blocked',
        reason: '卷宗编号包含非法标识',
        followUpAction: '请档案室管理员核查卷宗来源，标记为问题卷宗'
      };
    }
  }

  if (material.borrow_date && material.return_date) {
    const borrowDate = new Date(material.borrow_date);
    const returnDate = new Date(material.return_date);
    if (returnDate < borrowDate) {
      return {
        status: 'blocked',
        reason: '归还日期早于借阅日期',
        followUpAction: '请档案室管理员核实借阅归还日期，修正错误信息'
      };
    }
  }

  if (material.document_type) {
    const validTypes = ['正卷', '副卷', '证据卷', '庭审笔录', '判决书', '裁定书'];
    if (!validTypes.includes(material.document_type)) {
      return {
        status: 'needs_supplement',
        reason: `卷宗类型不规范: ${material.document_type}`,
        followUpAction: '请档案室管理员确认卷宗类型，规范后重新录入'
      };
    }
  }

  return {
    status: 'normal',
    reason: '材料信息完整且规范',
    followUpAction: '卷宗可正常归档，进入借阅归还流程'
  };
}

export function getStatusDisplayName(status: MaterialStatus): string {
  const statusMap: Record<MaterialStatus, string> = {
    pending: '待处理',
    normal: '正常',
    needs_supplement: '待补充',
    blocked: '已拦截'
  };
  return statusMap[status] || status;
}
