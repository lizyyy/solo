import { createVerify } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { getAll, getOne, runQuery } from '../database';
import { ContractStatus, FieldDiff, VerifyResult, VerificationConclusion } from '../types';

export class VerifyService {
  async verifySignature(
    publicKey: string,
    body: Record<string, any>,
    signature: string,
    algorithm: string = 'RSA-SHA256'
  ): Promise<{ valid: boolean; basis: string }> {
    try {
      const bodyStr = JSON.stringify(body);
      const verifier = createVerify(algorithm);
      verifier.update(bodyStr);
      verifier.end();
      
      const valid = verifier.verify(publicKey, signature, 'base64');
      
      return {
        valid,
        basis: valid 
          ? `签名验证通过，算法: ${algorithm}, 数据长度: ${bodyStr.length}`
          : `签名验证失败，算法: ${algorithm}, 签名值: ${signature.substring(0, 20)}...`
      };
    } catch (error) {
      return {
        valid: false,
        basis: `签名验证异常: ${error instanceof Error ? error.message : '未知错误'}`
      };
    }
  }

  async verifyFields(
    expectedFields: string[],
    actualBody: Record<string, any>
  ): Promise<{ result: VerifyResult; diffs: FieldDiff[]; basis: string }> {
    const diffs: FieldDiff[] = [];
    const actualKeys = Object.keys(actualBody);

    for (const field of expectedFields) {
      if (!actualBody.hasOwnProperty(field)) {
        diffs.push({
          id: uuidv4(),
          callbackSampleId: '',
          fieldName: field,
          expected: '存在',
          actual: '缺失',
          diffType: 'missing',
          severity: 'error'
        });
      }
    }

    for (const key of actualKeys) {
      if (!expectedFields.includes(key)) {
        diffs.push({
          id: uuidv4(),
          callbackSampleId: '',
          fieldName: key,
          expected: '不存在',
          actual: JSON.stringify(actualBody[key]),
          diffType: 'extra',
          severity: 'warning'
        });
      }
    }

    const errorCount = diffs.filter(d => d.severity === 'error').length;
    const warningCount = diffs.filter(d => d.severity === 'warning').length;

    let result: VerifyResult;
    if (errorCount === 0 && warningCount === 0) {
      result = VerifyResult.SUCCESS;
    } else if (errorCount === 0) {
      result = VerifyResult.PARTIAL;
    } else {
      result = VerifyResult.FAILED;
    }

    const basis = `字段校验完成，期望字段数: ${expectedFields.length}, 实际字段数: ${actualKeys.length}, 错误: ${errorCount}, 警告: ${warningCount}`;

    return { result, diffs, basis };
  }

  async createConclusion(
    sampleId: string,
    supplierId: string,
    contractVersionId: string,
    signResult: VerifyResult,
    fieldResult: VerifyResult,
    rawInput: string,
    processingBasis: string,
    errorMessage?: string
  ): Promise<string> {
    const conclusionId = uuidv4();
    
    let overallResult: VerifyResult;
    if (signResult === VerifyResult.SUCCESS && fieldResult === VerifyResult.SUCCESS) {
      overallResult = VerifyResult.SUCCESS;
    } else if (signResult === VerifyResult.FAILED || fieldResult === VerifyResult.FAILED) {
      overallResult = VerifyResult.FAILED;
    } else {
      overallResult = VerifyResult.PARTIAL;
    }

    let status = ContractStatus.PENDING;
    if (overallResult === VerifyResult.FAILED) {
      status = ContractStatus.BLOCKED;
    }

    const finalConclusion = overallResult === VerifyResult.SUCCESS
      ? '验签和字段校验全部通过，待确认'
      : overallResult === VerifyResult.PARTIAL
        ? '部分校验通过，存在警告，待人工审核'
        : '校验失败，已拦截';

    await runQuery(`
      INSERT INTO verification_conclusions (
        id, callback_sample_id, supplier_id, contract_version_id,
        status, sign_result, field_result, overall_result,
        raw_input, processing_basis, final_conclusion, error_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      conclusionId, sampleId, supplierId, contractVersionId,
      status, signResult, fieldResult, overallResult,
      rawInput, processingBasis, finalConclusion, errorMessage
    ]);

    return conclusionId;
  }

  async saveFieldDiffs(sampleId: string, diffs: FieldDiff[]): Promise<void> {
    for (const diff of diffs) {
      await runQuery(`
        INSERT INTO field_diffs (id, callback_sample_id, field_name, expected, actual, diff_type, severity)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [uuidv4(), sampleId, diff.fieldName, diff.expected, diff.actual, diff.diffType, diff.severity]);
    }
  }

  async getConclusion(conclusionId: string) {
    return getOne(`
      SELECT vc.*, s.name as supplier_name, cv.version as contract_version
      FROM verification_conclusions vc
      LEFT JOIN suppliers s ON vc.supplier_id = s.id
      LEFT JOIN contract_versions cv ON vc.contract_version_id = cv.id
      WHERE vc.id = ?
    `, [conclusionId]);
  }

  async getFieldDiffs(sampleId: string) {
    return getAll('SELECT * FROM field_diffs WHERE callback_sample_id = ?', [sampleId]);
  }

  async getAuditLogs(conclusionId: string) {
    return getAll('SELECT * FROM audit_logs WHERE conclusion_id = ? ORDER BY created_at DESC', [conclusionId]);
  }
}

export const verifyService = new VerifyService();
