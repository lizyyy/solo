import { InventoryRecord, ProcessingResult, FailedRecord, ErrorType } from './types';

export class InventoryProcessor {
  private processedKeys: Set<string> = new Set();

  processRecord(record: InventoryRecord): { result: 'success' | 'skipped' | 'failed'; record: InventoryRecord | FailedRecord } {
    const recordKey = `${record.车辆编号}-${record.药品编码}-${record.批号}-${record.回库日期}`;

    if (record.处理标记 === '已处理' || this.processedKeys.has(recordKey)) {
      return { result: 'skipped', record };
    }

    const validation = this.validateRecord(record);
    if (validation !== true) {
      const failedRecord: FailedRecord = {
        ...record,
        错误类型: validation.errorType,
        错误信息: validation.message,
        修复建议: validation.suggestion
      };
      return { result: 'failed', record: failedRecord };
    }

    const damageCheck = this.checkTransitDamage(record);
    if (damageCheck !== true) {
      const failedRecord: FailedRecord = {
        ...record,
        错误类型: damageCheck.errorType,
        错误信息: damageCheck.message,
        修复建议: damageCheck.suggestion
      };
      return { result: 'failed', record: failedRecord };
    }

    const splitCheck = this.checkLotSplit(record);
    if (splitCheck !== true) {
      const failedRecord: FailedRecord = {
        ...record,
        错误类型: splitCheck.errorType,
        错误信息: splitCheck.message,
        修复建议: splitCheck.suggestion
      };
      return { result: 'failed', record: failedRecord };
    }

    this.processedKeys.add(recordKey);
    record.状态 = '处理完成';
    record.处理标记 = '已处理';

    return { result: 'success', record };
  }

  processRecords(records: InventoryRecord[]): ProcessingResult {
    const result: ProcessingResult = {
      success: [],
      skipped: [],
      failed: []
    };

    for (const record of records) {
      const processed = this.processRecord(record);
      if (processed.result === 'success') {
        result.success.push(processed.record as InventoryRecord);
      } else if (processed.result === 'skipped') {
        result.skipped.push(processed.record as InventoryRecord);
      } else {
        result.failed.push(processed.record as FailedRecord);
      }
    }

    return result;
  }

  private validateRecord(record: InventoryRecord): true | { errorType: ErrorType; message: string; suggestion: string } {
    if (!record.车辆编号) {
      return {
        errorType: '必填项缺失',
        message: '车辆编号为空',
        suggestion: '请填写车辆编号，格式为：CLINIC-VEH-XXXX'
      };
    }

    if (!record.药品编码) {
      return {
        errorType: '必填项缺失',
        message: '药品编码为空',
        suggestion: '请填写药品编码，可从药品目录中查询'
      };
    }

    if (!record.批号) {
      return {
        errorType: '必填项缺失',
        message: '批号为空',
        suggestion: '请填写药品生产批号'
      };
    }

    if (!record.回库日期) {
      return {
        errorType: '必填项缺失',
        message: '回库日期为空',
        suggestion: '请填写回库日期，格式为：YYYY-MM-DD'
      };
    }

    const total = record.销售数量 + record.回库数量 + record.途中报损数量;
    if (total !== record.出库数量) {
      return {
        errorType: '数量不匹配',
        message: `数量不匹配：出库${record.出库数量}，但销售+回库+报损=${total}`,
        suggestion: `请核对数量：出库数量(${record.出库数量}) 应等于 销售数量(${record.销售数量}) + 回库数量(${record.回库数量}) + 途中报损数量(${record.途中报损数量})`
      };
    }

    return true;
  }

  private checkTransitDamage(record: InventoryRecord): true | { errorType: ErrorType; message: string; suggestion: string } {
    if (record.途中报损数量 > 0) {
      if (!record.报损原因 || record.报损原因.trim() === '') {
        return {
          errorType: '途中报损异常',
          message: `报损数量(${record.途中报损数量})大于0，但未填写报损原因`,
          suggestion: '请填写报损原因，如：包装破损、过期、温度失控等'
        };
      }

      const validReasons = ['包装破损', '过期', '温度失控', '挤压变形', '液体泄漏', '其他'];
      if (!validReasons.some(r => record.报损原因.includes(r))) {
        return {
          errorType: '途中报损异常',
          message: `报损原因"${record.报损原因}"不在标准原因列表中`,
          suggestion: `请从标准原因中选择：${validReasons.join('、')}`
        };
      }

      if (record.途中报损数量 > record.出库数量 * 0.3) {
        return {
          errorType: '途中报损异常',
          message: `报损数量(${record.途中报损数量})超过出库数量(${record.出库数量})的30%`,
          suggestion: '报损比例过高，请确认是否属实，必要时附照片说明'
        };
      }
    }

    return true;
  }

  private checkLotSplit(record: InventoryRecord): true | { errorType: ErrorType; message: string; suggestion: string } {
    if (record.拆分批号) {
      if (!record.拆分后数量 || record.拆分后数量 <= 0) {
        return {
          errorType: '批号拆分异常',
          message: '填写了拆分批号，但拆分后数量为空或小于等于0',
          suggestion: '请填写拆分后数量，拆分后数量之和应等于原批号数量'
        };
      }

      if (record.拆分批号 === record.批号) {
        return {
          errorType: '批号拆分异常',
          message: '拆分批号与原批号相同',
          suggestion: '拆分批号应与原批号不同，请检查输入'
        };
      }

      if (!/^[A-Z0-9]{6,12}-SPLIT-[0-9]+$/.test(record.拆分批号)) {
        return {
          errorType: '批号拆分异常',
          message: `拆分批号"${record.拆分批号}"格式不正确`,
          suggestion: '拆分批号格式应为：原批号-SPLIT-序号，例如：B2024001-SPLIT-1'
        };
      }
    }

    return true;
  }

  resetProcessedKeys(): void {
    this.processedKeys.clear();
  }
}
