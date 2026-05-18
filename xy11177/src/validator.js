export class RepairValidator {
  constructor(logger) {
    this.logger = logger;
    this.duplicates = [];
    this.errors = [];
    this.warnings = [];
  }

  validate(repairs) {
    this.logger.verbose(`开始校验 ${repairs.length} 条报修记录`);
    
    this.checkDuplicates(repairs);
    this.checkDataValidity(repairs);
    this.checkUrgentRepairs(repairs);
    
    const validRepairs = repairs.filter(repair => {
      return !this.duplicates.some(d => d.id === repair.id);
    });
    
    this.logger.log(`校验完成: ${validRepairs.length} 条有效, ${this.duplicates.length} 条重复, ${this.errors.length} 条错误, ${this.warnings.length} 条警告`);
    
    return {
      valid: validRepairs,
      duplicates: this.duplicates,
      errors: this.errors,
      warnings: this.warnings
    };
  }

  checkDuplicates(repairs) {
    this.logger.verbose('检测重复报修...');
    
    const seen = new Map();
    
    for (const repair of repairs) {
      const key1 = `${repair.dormNumber}-${repair.repairType}-${repair.description.substring(0, 20)}`;
      const key2 = `${repair.dormNumber}-${repair.reporter}`;
      
      const reportTime = new Date(repair.reportTime);
      
      for (const [existingKey, existingRepair] of seen.entries()) {
        const existingTime = new Date(existingRepair.reportTime);
        const timeDiff = Math.abs(reportTime - existingTime) / (1000 * 60 * 60);
        
        if (timeDiff < 24 && 
            (existingKey.includes(key1.split('-')[0]) && 
             existingKey.includes(key1.split('-')[1]) ||
             existingKey.includes(key2))) {
          
          const duplicate = {
            id: repair.id,
            duplicateOf: existingRepair.id,
            reason: '同一宿舍24小时内相同类型报修',
            dormNumber: repair.dormNumber,
            repairType: repair.repairType
          };
          
          this.duplicates.push(duplicate);
          this.logger.verbose(`发现重复报修: ${repair.id} 重复于 ${existingRepair.id}`);
          break;
        }
      }
      
      if (!this.duplicates.some(d => d.id === repair.id)) {
        seen.set(key1, repair);
      }
    }
  }

  checkDataValidity(repairs) {
    this.logger.verbose('校验数据有效性...');
    
    const validRepairTypes = ['水电', '门窗', '家具', '卫浴', '空调', '网络', '其他'];
    const validPriorities = ['urgent', 'normal', 'low'];
    
    for (const repair of repairs) {
      if (!/^\d+[A-Za-z]?$/.test(repair.dormNumber)) {
        this.warnings.push({
          id: repair.id,
          field: 'dormNumber',
          message: `宿舍号格式异常: ${repair.dormNumber}`
        });
      }
      
      if (!validRepairTypes.includes(repair.repairType)) {
        this.warnings.push({
          id: repair.id,
          field: 'repairType',
          message: `未知报修类型: ${repair.repairType}, 已归类为'其他'`
        });
        repair.repairType = '其他';
      }
      
      if (!validPriorities.includes(repair.priority)) {
        this.warnings.push({
          id: repair.id,
          field: 'priority',
          message: `未知优先级: ${repair.priority}, 已设置为'normal'`
        });
        repair.priority = 'normal';
      }
      
      if (repair.description.length < 5) {
        this.warnings.push({
          id: repair.id,
          field: 'description',
          message: '报修描述过短，建议补充详情'
        });
      }
      
      if (!repair.contact && repair.priority === 'urgent') {
        this.errors.push({
          id: repair.id,
          field: 'contact',
          message: '急修单必须填写联系方式'
        });
      }
    }
  }

  checkUrgentRepairs(repairs) {
    this.logger.verbose('检查急修单...');
    
    const urgentRepairs = repairs.filter(r => r.priority === 'urgent');
    this.logger.verbose(`发现 ${urgentRepairs.length} 条急修单`);
    
    for (const repair of urgentRepairs) {
      this.logger.verbose(`急修单: ${repair.id} - ${repair.dormNumber} - ${repair.repairType}`);
    }
  }

  getValidationSummary() {
    return {
      totalDuplicates: this.duplicates.length,
      totalErrors: this.errors.length,
      totalWarnings: this.warnings.length
    };
  }
}
