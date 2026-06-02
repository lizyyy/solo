// ========== 核心业务逻辑 ==========
(function() {
  const {
    DEPOSIT_RULES,
    STATUS,
    ANOMALY_TYPES,
    SEVERITY,
    createTrackRecord,
    createAnomaly,
    createSettlement,
    createDeduction,
    createAnnotation
  } = window.DataModels;

// ========== 异常检测引擎 ==========
const AnomalyDetector = {
  // 单条记录全面检测
  detectAll(record, allRecords = []) {
    const anomalies = [];
    
    anomalies.push(...this.detectEmptyFields(record));
    anomalies.push(...this.detectOldMaster(record));
    anomalies.push(...this.detectUnauthorized(record));
    anomalies.push(...this.detectRenamed(record));
    anomalies.push(...this.detectBoundary(record));
    anomalies.push(...this.detectDuplicates(record, allRecords));
    
    return anomalies;
  },

  // 空值检测
  detectEmptyFields(record) {
    const anomalies = [];
    const requiredFields = ['trackName', 'artist', 'roomNumber', 'bookingDate', 'bookingTime'];
    
    requiredFields.forEach(field => {
      if (!record[field] || record[field].toString().trim() === '') {
        anomalies.push(createAnomaly(
          ANOMALY_TYPES.EMPTY_FIELD,
          `字段"${this.getFieldLabel(field)}"是空的，得补一下信息`,
          field,
          SEVERITY.ERROR
        ));
      }
    });

    if (record.depositAmount <= 0) {
      anomalies.push(createAnomaly(
        ANOMALY_TYPES.EMPTY_FIELD,
        '押金金额不对，要么是空的要么是0，得确认下',
        'depositAmount',
        SEVERITY.ERROR
      ));
    }

    if (record.durationMinutes <= 0) {
      anomalies.push(createAnomaly(
        ANOMALY_TYPES.EMPTY_FIELD,
        '音频时长读不出来，可能是文件坏了',
        'durationMinutes',
        SEVERITY.ERROR
      ));
    }

    return anomalies;
  },

  // 旧版母带检测
  detectOldMaster(record) {
    const anomalies = [];
    if (record.isOldMaster || /OLD|旧版|master|老版本/i.test(record.fileName)) {
      anomalies.push(createAnomaly(
        ANOMALY_TYPES.OLD_MASTER,
        '文件名带OLD/旧版标记，是旧版母带。按规定扣50元押金',
        'fileName',
        SEVERITY.ERROR
      ));
    }
    return anomalies;
  },

  // 缺授权检测
  detectUnauthorized(record) {
    const anomalies = [];
    if (record.licenseStatus === 'none') {
      anomalies.push(createAnomaly(
        ANOMALY_TYPES.UNAUTHORIZED,
        '没查到版权授权记录，按规定缺授权扣100元',
        'licenseStatus',
        SEVERITY.ERROR
      ));
    } else if (record.licenseStatus === 'pending') {
      anomalies.push(createAnomaly(
        ANOMALY_TYPES.UNAUTHORIZED,
        '授权还在等审批，先别急着结算',
        'licenseStatus',
        SEVERITY.REVIEW
      ));
    }
    return anomalies;
  },

  // 人工改名检测
  detectRenamed(record) {
    const anomalies = [];
    if (record.isRenamed) {
      anomalies.push(createAnomaly(
        ANOMALY_TYPES.RENAMED,
        record.sourceNote || '这条是人工改过名字的，注意核对原始文件名',
        'fileName',
        SEVERITY.WARN
      ));
    }
    return anomalies;
  },

  // 边界情况检测
  detectBoundary(record) {
    const anomalies = [];
    
    // 时长刚好60分钟（预约一般1小时）
    if (Math.abs(record.durationMinutes - 60.0) < 0.01) {
      anomalies.push(createAnomaly(
        ANOMALY_TYPES.BOUNDARY,
        '时长刚好60分钟整，踩在超时边界上，人工确认下有没有真的超时',
        'durationMinutes',
        SEVERITY.REVIEW
      ));
    }

    // 曲目名太短可能有歧义
    if (record.trackName && record.trackName.length <= 3) {
      anomalies.push(createAnomaly(
        ANOMALY_TYPES.BOUNDARY,
        `曲目名"${record.trackName}"太简略，可能有重名，得确认下具体是哪一首`,
        'trackName',
        SEVERITY.REVIEW
      ));
    }

    // 押金金额异常高（可能是旧口径）
    if (record.depositAmount > DEPOSIT_RULES.baseDeposit) {
      anomalies.push(createAnomaly(
        ANOMALY_TYPES.BOUNDARY,
        `押金${record.depositAmount}元比标准${DEPOSIT_RULES.baseDeposit}元高，确认是不是旧口径或特殊琴房`,
        'depositAmount',
        SEVERITY.WARN
      ));
    }

    return anomalies;
  },

  // 重复曲目检测（跨记录
  detectDuplicates(record, allRecords) {
    const anomalies = [];
    if (!allRecords || allRecords.length < 2) return anomalies;

    const duplicates = allRecords.filter(r => {
      if (r.id === record.id) return false;
      const sameTrack = r.trackName && record.trackName && 
        r.trackName.replace(/\s+/g, '') === record.trackName.replace(/\s+/g, '');
      const sameArtist = r.artist === record.artist;
      const sameDate = r.bookingDate === record.bookingDate;
      return sameTrack && sameArtist && sameDate;
    });

    if (duplicates.length > 0) {
      anomalies.push(createAnomaly(
        ANOMALY_TYPES.DUPLICATE,
        `发现${duplicates.length}条重复记录：同一人同一天同一首曲子报了多次`,
        'trackName',
        SEVERITY.WARN
      ));
    }

    return anomalies;
  },

  getFieldLabel(field) {
    const labels = {
      trackName: '曲目名称',
      artist: '演奏者',
      roomNumber: '琴房号',
      bookingDate: '预约日期',
      bookingTime: '预约时间',
      depositAmount: '押金金额',
      durationMinutes: '音频时长'
    };
    return labels[field] || field;
  }
};

// ========== 押金结算引擎 ==========
const SettlementEngine = {
  // 计算单条记录的结算
  calculate(record) {
    const settlement = createSettlement(record.id);
    settlement.originalDeposit = record.depositAmount || DEPOSIT_RULES.baseDeposit;
    settlement.refundAmount = settlement.originalDeposit;

    let totalDeduction = 0;
    const deductions = [];

    // 遍历异常，计算扣款
    record.anomalies.forEach(anomaly => {
      if (anomaly.resolved) return; // 已解决的异常不扣款

      switch (anomaly.type) {
        case ANOMALY_TYPES.OLD_MASTER:
          deductions.push(createDeduction(
            '旧版母带',
            DEPOSIT_RULES.oldMasterPenalty,
            '使用旧版母带扣款'
          ));
          totalDeduction += DEPOSIT_RULES.oldMasterPenalty;
          break;

        case ANOMALY_TYPES.UNAUTHORIZED:
          if (anomaly.severity === SEVERITY.ERROR) {
            deductions.push(createDeduction(
              '缺授权',
              DEPOSIT_RULES.unauthorizedPenalty,
              '未获得版权授权扣款'
            ));
            totalDeduction += DEPOSIT_RULES.unauthorizedPenalty;
          }
          break;

        case ANOMALY_TYPES.DUPLICATE:
          deductions.push(createDeduction(
            '重复申报',
            DEPOSIT_RULES.duplicatePenalty,
            '同一曲目重复申报警告性扣款'
          ));
          totalDeduction += DEPOSIT_RULES.duplicatePenalty;
          break;

        case ANOMALY_TYPES.EMPTY_FIELD:
        case ANOMALY_TYPES.CORRUPT_FILE:
          settlement.status = 'pending';
          break;

        case ANOMALY_TYPES.BOUNDARY:
        case ANOMALY_TYPES.RENAMED:
        case ANOMALY_TYPES.OLD_STANDARD:
          // 这些不自动扣款，等人工确认
          if (settlement.status === 'normal') {
            settlement.status = 'pending';
          }
          break;
      }
    });

    // 检查有没有需要人工确认的异常
    const needsReview = record.anomalies.some(a => 
      a.severity === SEVERITY.REVIEW && !a.resolved
    );
    if (needsReview) {
      settlement.status = 'pending';
    }

    // 最高扣款不超过押金
    if (totalDeduction > settlement.originalDeposit) {
      totalDeduction = settlement.originalDeposit;
    }

    settlement.deductions = deductions;
    settlement.refundAmount = settlement.originalDeposit - totalDeduction;

    if (settlement.status === 'normal') {
      if (totalDeduction > 0 && totalDeduction < settlement.originalDeposit) {
        settlement.status = 'partial';
      } else if (totalDeduction >= settlement.originalDeposit) {
        settlement.status = 'full';
      }
    }

    return settlement;
  },

  // 自动判断记录状态
  determineStatus(record) {
    const errors = record.anomalies.filter(a => a.severity === SEVERITY.ERROR && !a.resolved);
    const reviews = record.anomalies.filter(a => a.severity === SEVERITY.REVIEW && !a.resolved);
    const warns = record.anomalies.filter(a => a.severity === SEVERITY.WARN && !a.resolved);

    if (errors.length > 0) {
      // 有错误但可以自动扣款的还是pending，等人工确认扣款
      return STATUS.PENDING;
    }
    if (reviews.length > 0) {
      return STATUS.NEEDS_REVIEW;
    }
    if (warns.length > 0) {
      // 只有警告的可以自动过，但要留痕
      return STATUS.CONFIRMED;
    }
    return STATUS.CONFIRMED;
  }
};

// ========== 批量导入引擎（含容错）==========
const BatchImportEngine = {
  // 导入一批原始数据，单条失败不影响整体
  async importBatch(rawItems, options = {}) {
    const results = {
      success: [],
      failed: [],
      skipped: [],
      total: rawItems.length
    };

    for (let i = 0; i < rawItems.length; i++) {
      const raw = rawItems[i];
      try {
        const record = await this.processSingle(raw, i, rawItems, options);
        if (record) {
          results.success.push(record);
        } else {
          results.skipped.push({ index: i, raw: raw, reason: '数据为空或无法识别' });
        }
      } catch (error) {
        console.error(`第${i+1}条导入失败:`, error);
        results.failed.push({
          index: i,
          raw: raw,
          fileName: raw.fileName || `第${i+1}条`,
          error: error.message || '未知错误',
          errorStack: error.stack
        });
        // 继续处理下一条，不中断
      }
    }

    // 第二轮：检测跨记录的重复（因为需要全部数据）
    if (results.success.length > 1) {
      results.success.forEach(record => {
        const duplicateAnomalies = AnomalyDetector.detectDuplicates(record, results.success);
        if (duplicateAnomalies.length > 0) {
          record.anomalies.push(...duplicateAnomalies);
        }
      });
    }

    return results;
  },

  // 处理单条数据
  async processSingle(raw, index, allRaw, options) {
    // 模拟处理延迟（让用户感觉在干活
    await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));

    // 模拟损坏文件处理
    if (raw.isCorrupt) {
      throw new Error('文件损坏，读不了音频元数据');
    }

    // 空数据跳过
    if (!raw || (typeof raw === 'object' && Object.keys(raw).length === 0)) {
      return null;
    }

    // 创建记录
    const record = createTrackRecord(raw);
    record.rawData = options.keepRaw ? raw : null;

    // 检测异常（第一轮，单条内部的
    const anomalies = AnomalyDetector.detectAll(record, []);
    record.anomalies = anomalies;

    // 自动判断状态
    record.status = SettlementEngine.determineStatus(record);

    // 如果可以自动结算，先算一笔
    if (record.status === STATUS.CONFIRMED) {
      record.settlement = SettlementEngine.calculate(record);
      record.status = STATUS.CONFIRMED;
    }

    return record;
  }
};

  // ========== 导出 ==========
  window.CoreLogic = {
    AnomalyDetector,
    SettlementEngine,
    BatchImportEngine
  };
})();
