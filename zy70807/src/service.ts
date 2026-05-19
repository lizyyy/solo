import { DeclarationSubmission, SubmissionResult, PackageRecord } from './types';
import { validateSubmission } from './validator';
import {
  generateContentHash,
  findByHash,
  findByDeclarationNo,
  getPackagesByDeclarationId,
  insertDeclaration,
  insertPackages,
  queryDeclarations,
  getStatistics,
  updateDeclarationStatus
} from './database';

export async function processSubmission(submission: DeclarationSubmission): Promise<SubmissionResult> {
  const validationErrors = validateSubmission(submission);
  if (validationErrors.length > 0) {
    return {
      success: false,
      errors: validationErrors
    };
  }

  const contentHash = generateContentHash(submission);

  const existingByHash = await findByHash(contentHash);
  if (existingByHash) {
    const packages = await getPackagesByDeclarationId(existingByHash.id);
    return {
      success: true,
      isDuplicate: true,
      declarationId: existingByHash.id,
      declarationNo: existingByHash.declarationNo,
      existingRecord: {
        ...existingByHash,
        packages
      }
    };
  }

  const existingByNo = await findByDeclarationNo(submission.declarationNo);
  if (existingByNo) {
    return {
      success: false,
      errors: [{
        field: 'declarationNo',
        message: `申报编号 ${submission.declarationNo} 已存在`
      }]
    };
  }

  const totalTax = submission.packages.reduce((sum, pkg) => {
    return sum + (pkg.quantity * pkg.unitPrice * pkg.taxRate);
  }, 0);

  const declarationId = await insertDeclaration(submission, contentHash, totalTax);

  const packageRecords: PackageRecord[] = submission.packages.map(pkg => ({
    id: 0,
    declarationId,
    itemNo: pkg.itemNo,
    name: pkg.name,
    category: pkg.category,
    quantity: pkg.quantity,
    unitPrice: pkg.unitPrice,
    currency: pkg.currency,
    taxRate: pkg.taxRate,
    taxAmount: pkg.quantity * pkg.unitPrice * pkg.taxRate
  }));

  await insertPackages(declarationId, packageRecords);

  const newRecord = await findByDeclarationNo(submission.declarationNo);
  const packages = await getPackagesByDeclarationId(declarationId);

  return {
    success: true,
    isDuplicate: false,
    declarationId,
    declarationNo: submission.declarationNo,
    existingRecord: newRecord ? { ...newRecord, packages } : undefined
  };
}

export async function queryDeclarationsService(params: {
  declarationNo?: string;
  submitter?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
}) {
  const declarations = await queryDeclarations(params);
  const result = [];

  for (const decl of declarations) {
    const packages = await getPackagesByDeclarationId(decl.id);
    result.push({
      ...decl,
      packages
    });
  }

  return result;
}

export async function getStatisticsService() {
  return await getStatistics();
}

export async function processDeclaration(
  declarationId: number,
  status: 'processed' | 'rejected',
  processor: string,
  rejectionReason?: string
) {
  await updateDeclarationStatus(declarationId, status, processor, rejectionReason);

  const declaration = await queryDeclarations({});
  const updated = declaration.find(d => d.id === declarationId);

  if (updated) {
    const packages = await getPackagesByDeclarationId(declarationId);
    return {
      ...updated,
      packages
    };
  }

  return null;
}

export async function exportDeclarations(params: {
  declarationNo?: string;
  submitter?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
}) {
  const declarations = await queryDeclarations(params);
  const exportData = [];

  for (const decl of declarations) {
    const packages = await getPackagesByDeclarationId(decl.id);

    for (const pkg of packages) {
      exportData.push({
        申报编号: decl.declarationNo,
        提交人: decl.submitter,
        提交时间: decl.submitTime,
        订单总金额: decl.totalAmount,
        状态: decl.status === 'pending' ? '待处理' : decl.status === 'processed' ? '已处理' : '已退单',
        品项编号: pkg.itemNo,
        商品名称: pkg.name,
        商品品类: pkg.category,
        数量: pkg.quantity,
        单价: pkg.unitPrice,
        货币: pkg.currency,
        品类税率: `${(pkg.taxRate * 100).toFixed(2)}%`,
        税额: pkg.taxAmount,
        海关退单原因: decl.rejectionReason || '',
        最后处理人: decl.processor || '',
        处理时间: decl.processedAt || ''
      });
    }
  }

  return exportData;
}
