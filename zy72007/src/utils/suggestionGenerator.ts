import { Material, MaterialType, InvestmentRecord } from '../types';

export function generateSuggestion(record: InvestmentRecord): string {
  const { materials, amount } = record;
  
  const hasPayment = materials.some(m => m.type === MaterialType.PAYMENT);
  const hasApproval = materials.some(m => m.type === MaterialType.APPROVAL);
  const hasHandwritten = materials.some(m => m.type === MaterialType.HANDWRITTEN);
  const hasRefund = materials.some(m => m.type === MaterialType.REFUND);
  
  const paymentMaterial = materials.find(m => m.type === MaterialType.PAYMENT);
  const paymentAmount = paymentMaterial?.amount;
  
  const suggestions: string[] = [];
  
  if (!hasPayment) {
    suggestions.push('【缺失关键凭证】请联系运营部门提供投资者的银行收款流水凭证，这是入账的必要依据');
  }
  
  if (!hasApproval) {
    suggestions.push('【缺失审批文件】请补充业务主管的审批邮件截图，确保该笔投资经过合规审批');
  }
  
  if (!hasHandwritten) {
    suggestions.push('【建议补充】请上传投资者手写的风险确认书或回访备注原件照片');
  }
  
  if (hasPayment && paymentAmount && paymentAmount !== amount) {
    suggestions.push(`【金额不匹配】系统登记金额 ${amount.toLocaleString()} 元与收款流水金额 ${paymentAmount.toLocaleString()} 元不符，请人工核对差异原因`);
  }
  
  if (hasRefund) {
    suggestions.push('【含退款申请】该笔投资关联退款，请确认退款审批流程是否完成后再入账');
  }
  
  if (hasPayment && hasApproval && paymentAmount === amount) {
    suggestions.unshift('【材料齐全】收款流水、审批邮件齐全，金额匹配，建议确认入账');
  } else if (hasPayment && hasApproval) {
    suggestions.unshift('【需人工核对】材料基本齐全，但存在差异点，请人工确认后处理');
  }
  
  if (suggestions.length === 0) {
    suggestions.push('请人工审核该笔投资的全部材料后进行处理');
  }
  
  return suggestions.join('\n\n');
}

export function checkMaterialCompleteness(materials: Material[]): { complete: boolean; missing: string[] } {
  const requiredTypes = [MaterialType.PAYMENT, MaterialType.APPROVAL];
  const missing: string[] = [];
  
  for (const type of requiredTypes) {
    if (!materials.some(m => m.type === type)) {
      missing.push(type);
    }
  }
  
  return {
    complete: missing.length === 0,
    missing,
  };
}
