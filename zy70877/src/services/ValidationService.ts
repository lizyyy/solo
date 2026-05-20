import { Mentor, Application, TransferRecord, ValidationError, ValidationRule } from '../types';
import { dataStore } from '../store/DataStore';

export class ValidationService {
  validateApplication(app: Application, mentor: Mentor | undefined): ValidationError | null {
    const checks: ValidationRule[] = ['mentor_exists', 'duplicate', 'quota', 'cross_major'];
    
    for (const rule of checks) {
      const error = this.applyRule(rule, app, mentor);
      if (error) return error;
    }
    
    return null;
  }

  validateTransfer(transfer: TransferRecord, mentor: Mentor | undefined): ValidationError | null {
    if (!mentor) {
      return {
        rule: 'mentor_exists',
        message: '目标导师不存在',
        suggestion: '请核对导师信息，确认导师ID和姓名是否正确'
      };
    }

    if (transfer.fromMajor === transfer.toMajor) {
      return {
        rule: 'cross_major',
        message: '调剂专业与原专业相同，无需调剂',
        suggestion: '取消该调剂记录，或修改为不同的目标专业'
      };
    }

    return null;
  }

  private applyRule(rule: ValidationRule, app: Application, mentor: Mentor | undefined): ValidationError | null {
    switch (rule) {
      case 'mentor_exists':
        return this.checkMentorExists(mentor);
      case 'duplicate':
        return this.checkDuplicateApplication(app);
      case 'quota':
        return this.checkMentorQuota(mentor);
      case 'cross_major':
        return this.checkCrossMajor(app, mentor);
      default:
        return null;
    }
  }

  private checkMentorExists(mentor: Mentor | undefined): ValidationError | null {
    if (!mentor) {
      return {
        rule: 'mentor_exists',
        message: '导师不存在',
        suggestion: '请核对导入的导师CSV文件，确认导师ID是否正确'
      };
    }
    return null;
  }

  private checkDuplicateApplication(app: Application): ValidationError | null {
    const existingApps = dataStore.getApplicationsByStudent(app.studentId);
    const hasConfirmed = existingApps.some(a => 
      a.status === 'confirmed' && a.mentorId === app.mentorId
    );
    
    if (hasConfirmed) {
      return {
        rule: 'duplicate',
        message: '该学生已被此导师录取，重复申请',
        suggestion: '跳过该记录，或取消原有录取后重新导入'
      };
    }

    const hasNormal = existingApps.some(a => 
      a.status === 'normal' && a.mentorId === app.mentorId
    );
    
    if (hasNormal) {
      return {
        rule: 'duplicate',
        message: '该学生志愿已存在，重复导入',
        suggestion: '确认是否为更新操作，如需更新请先标记原有记录为无效'
      };
    }

    return null;
  }

  private checkMentorQuota(mentor: Mentor | undefined): ValidationError | null {
    if (!mentor) return null;
    
    if (mentor.usedQuota >= mentor.quota) {
      return {
        rule: 'quota',
        message: `导师招生名额已满（${mentor.usedQuota}/${mentor.quota}）`,
        suggestion: '建议学生调剂到其他导师，或申请增加该导师招生名额'
      };
    }

    if (mentor.usedQuota + 1 > mentor.quota) {
      return {
        rule: 'quota',
        message: `导师名额即将用尽（${mentor.usedQuota + 1}/${mentor.quota}）`,
        suggestion: '可正常录取，但建议提前关注导师名额使用情况'
      };
    }

    return null;
  }

  private checkCrossMajor(app: Application, mentor: Mentor | undefined): ValidationError | null {
    if (!mentor) return null;
    
    const studentMajor = app.studentMajor.trim();
    const mentorMajor = mentor.major.trim();
    
    if (studentMajor !== mentorMajor) {
      if (app.isTransfer) {
        return {
          rule: 'cross_major',
          message: `跨专业调剂需人工确认：学生专业(${studentMajor}) -> 导师专业(${mentorMajor})`,
          suggestion: '提交研究生院审核，确认是否符合跨专业调剂政策'
        };
      } else {
        return {
          rule: 'cross_major',
          message: `学生专业(${studentMajor})与导师专业(${mentorMajor})不匹配`,
          suggestion: '如为跨专业报考，请勾选调剂标识或提交跨专业申请'
        };
      }
    }

    return null;
  }

  checkQuotaWarning(mentor: Mentor): string | null {
    const remaining = mentor.quota - mentor.usedQuota;
    if (remaining === 1) {
      return `导师仅剩1个名额，建议优先确认该生`;
    }
    if (remaining === 0) {
      return `导师名额已满，无法继续录取`;
    }
    return null;
  }
}

export const validationService = new ValidationService();
