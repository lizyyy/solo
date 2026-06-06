import { v4 as uuidv4 } from 'uuid';
import {
  ProcessingStatus,
  AuthorizationTerm,
  TunerMessage,
  WriteOffRecord
} from '../types';
import dataSource from './dataSource';
import selfCheckEngine from './selfCheckEngine';

export enum WorkflowStep {
  STEP_1_IMPORT = 'step_1_import',
  STEP_2_TUNER_REVIEW = 'step_2_tuner_review',
  STEP_3_WRITE_OFF = 'step_3_write_off'
}

export class WorkflowEngine {
  async executeStep1_Import(
    operator: string,
    importData: any[]
  ): Promise<{ success: boolean; message: string; terms?: AuthorizationTerm[]; batchId?: string }> {
    console.log(`[WorkflowEngine] ========== 执行第一步: 授权期限导入 ==========`);
    console.log(`[WorkflowEngine] 操作人: ${operator}, 数据行数: ${importData.length}`);

    try {
      const { importEngine } = await import('./importEngine');
      
      const rawRows = importData.map((row, index) => ({
        rowNumber: index + 1,
        bandName: row.bandName,
        equipmentType: row.equipmentType,
        equipmentModel: row.equipmentModel,
        authorizationStartDate: row.authorizationStartDate,
        authorizationEndDate: row.authorizationEndDate,
        authorizedCities: row.authorizedCities,
        repairFee: row.repairFee
      }));

      const result = importEngine.importFromRawData(rawRows, '授权期限表.xlsx', operator);
      
      console.log(`[WorkflowEngine] 第一步导入完成: 成功 ${result.terms.length} 条, 失败 ${result.errors.length} 条`);

      selfCheckEngine.checkDuplicateImports(operator);
      selfCheckEngine.checkMissingCities(operator);
      selfCheckEngine.checkExportConsistency(operator);

      return {
        success: result.errors.length === 0,
        message: result.errors.length > 0 
          ? `导入完成, ${result.terms.length} 条成功, ${result.errors.length} 条失败` 
          : `成功导入 ${result.terms.length} 条授权期限记录`,
        terms: result.terms,
        batchId: result.batch.id
      };
    } catch (e: any) {
      return { success: false, message: `导入失败: ${e.message}` };
    }
  }

  async executeStep2_TunerReview(
    authorizationTermId: string,
    reviewer: string,
    tunerMessageContent?: string,
    tunerName?: string
  ): Promise<{ success: boolean; message: string; term?: AuthorizationTerm }> {
    console.log(`[WorkflowEngine] ========== 执行第二步: 版权运营小鹿补看调音师留言 ==========`);
    console.log(`[WorkflowEngine] 记录ID: ${authorizationTermId}, 操作人: ${reviewer}`);

    const term = dataSource.getAuthorizationTermById(authorizationTermId);
    if (!term) {
      return { success: false, message: '授权期限记录不存在' };
    }

    if (term.status === ProcessingStatus.VERIFICATION_REQUIRED) {
      console.log(`[WorkflowEngine] 该记录 ${term.bandName} 待店长复核, 跳过自动处理`);
      return {
        success: true,
        message: `记录"${term.bandName}"授权地区可能有问题, 已留待店长复核, 暂不更新状态`,
        term
      };
    }

    if (tunerMessageContent && tunerName) {
      const message: TunerMessage = {
        id: uuidv4(),
        authorizationTermId,
        content: tunerMessageContent,
        tunerName,
        isReviewed: false,
        createdAt: new Date().toISOString()
      };
      dataSource.addTunerMessage(message);
      console.log(`[WorkflowEngine] 新增调音师留言: ${tunerName} - ${tunerMessageContent.substring(0, 30)}...`);
    }

    const messages = dataSource.getTunerMessages(authorizationTermId);
    for (const msg of messages) {
      if (!msg.isReviewed) {
        dataSource.updateTunerMessage(msg.id, {
          isReviewed: true,
          reviewedBy: reviewer,
          reviewedAt: new Date().toISOString()
        });
      }
    }

    dataSource.updateAuthorizationTerm(
      authorizationTermId,
      { status: ProcessingStatus.TUNER_REVIEWED },
      reviewer,
      '第二步: 版权运营小鹿已查看调音师留言'
    );

    const updatedTerm = dataSource.getAuthorizationTermById(authorizationTermId);
    
    selfCheckEngine.checkExportConsistency(reviewer);

    return {
      success: true,
      message: `已完成调音师留言查看, 记录"${term.bandName}"状态更新为"已查看留言"`,
      term: updatedTerm
    };
  }

  async executeStep3_WriteOffUpdate(
    authorizationTermId: string,
    operator: string,
    courseHours: number,
    unitPrice: number,
    writeOffNumber: string
  ): Promise<{ success: boolean; message: string; term?: AuthorizationTerm }> {
    console.log(`[WorkflowEngine] ========== 执行第三步: 课时核销单更新 ==========`);
    console.log(`[WorkflowEngine] 记录ID: ${authorizationTermId}, 操作人: ${operator}, 课时: ${courseHours}`);

    const term = dataSource.getAuthorizationTermById(authorizationTermId);
    if (!term) {
      return { success: false, message: '授权期限记录不存在' };
    }

    if (term.status === ProcessingStatus.VERIFICATION_REQUIRED) {
      console.log(`[WorkflowEngine] 该记录 ${term.bandName} 待店长复核, 不能更新核销单`);
      return {
        success: false,
        message: `记录"${term.bandName}"授权地区待店长复核, 请先联系店长确认后再更新核销单`,
        term
      };
    }

    if (term.status !== ProcessingStatus.TUNER_REVIEWED && term.status !== ProcessingStatus.MANAGER_REVIEWED) {
      return { 
        success: false, 
        message: `请先完成第二步调音师留言查看（当前状态: ${term.status}）`,
        term
      };
    }

    const writeOff: WriteOffRecord = {
      id: uuidv4(),
      authorizationTermId,
      writeOffNumber,
      courseHours,
      unitPrice,
      totalAmount: courseHours * unitPrice,
      writeOffDate: new Date().toISOString().split('T')[0],
      operator,
      status: ProcessingStatus.WRITE_OFF_UPDATED,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    dataSource.addWriteOffRecord(writeOff);

    dataSource.updateAuthorizationTerm(
      authorizationTermId,
      { 
        status: ProcessingStatus.WRITE_OFF_UPDATED,
        writeOffId: writeOff.id
      },
      operator,
      '第三步: 课时核销单已更新'
    );

    const updatedTerm = dataSource.getAuthorizationTermById(authorizationTermId);

    selfCheckEngine.checkRecalculationAfterSupplement(operator);
    selfCheckEngine.checkExportConsistency(operator);

    return {
      success: true,
      message: `核销单 ${writeOffNumber} 已更新, 总计 ${writeOff.totalAmount} 元`,
      term: updatedTerm
    };
  }

  async managerReview(
    authorizationTermId: string,
    manager: string,
    approved: boolean,
    reviewComment?: string
  ): Promise<{ success: boolean; message: string; term?: AuthorizationTerm }> {
    console.log(`[WorkflowEngine] ========== 店长复核 ==========`);
    console.log(`[WorkflowEngine] 记录ID: ${authorizationTermId}, 店长: ${manager}, 通过: ${approved}`);

    const term = dataSource.getAuthorizationTermById(authorizationTermId);
    if (!term) {
      return { success: false, message: '授权期限记录不存在' };
    }

    if (term.status !== ProcessingStatus.VERIFICATION_REQUIRED) {
      return { success: false, message: '该记录无需店长复核', term };
    }

    const newStatus = approved ? ProcessingStatus.MANAGER_REVIEWED : ProcessingStatus.ABNORMAL;
    const reason = approved 
      ? `店长复核通过${reviewComment ? ': ' + reviewComment : ''}`
      : `店长复核不通过${reviewComment ? ': ' + reviewComment : ''}`;

    dataSource.updateAuthorizationTerm(
      authorizationTermId,
      { status: newStatus },
      manager,
      reason
    );

    const updatedTerm = dataSource.getAuthorizationTermById(authorizationTermId);

    selfCheckEngine.checkExportConsistency(manager);

    return {
      success: true,
      message: `店长复核完成, 记录"${term.bandName}"状态: ${approved ? '已通过' : '异常'}`,
      term: updatedTerm
    };
  }

  getWorkflowProgress(): { step1: number; step2: number; step3: number; pendingReview: number } {
    const terms = dataSource.getAuthorizationTerms();
    
    return {
      step1: terms.filter(t => t.status === ProcessingStatus.IMPORTED || t.status === ProcessingStatus.VERIFICATION_REQUIRED).length,
      step2: terms.filter(t => t.status === ProcessingStatus.TUNER_REVIEWED).length,
      step3: terms.filter(t => t.status === ProcessingStatus.WRITE_OFF_UPDATED || t.status === ProcessingStatus.COMPLETED).length,
      pendingReview: terms.filter(t => t.status === ProcessingStatus.VERIFICATION_REQUIRED).length
    };
  }

  getTermsAwaitingReview(): AuthorizationTerm[] {
    return dataSource.getAuthorizationTerms().filter(t => t.status === ProcessingStatus.VERIFICATION_REQUIRED);
  }
}

export const workflowEngine = new WorkflowEngine();
export default workflowEngine;
