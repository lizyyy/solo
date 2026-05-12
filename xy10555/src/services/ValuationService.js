const dayjs = require('dayjs');
const { v4: uuidv4 } = require('uuid');
const db = require('../models');
const ValuationRulesService = require('./ValuationRulesService');

class ValuationService {
  static generateValuationNo() {
    const date = dayjs().format('YYYYMMDD');
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `V${date}${random}`;
  }

  static async createValuation(data, operator = 'system') {
    const transaction = await db.sequelize.transaction();
    try {
      if (data.request_id) {
        const existing = await db.Valuation.findOne({
          where: { request_id: data.request_id },
          transaction
        });
        if (existing) {
          await transaction.commit();
          return {
            isNew: false,
            valuation: existing,
            message: '幂等请求，返回已存在的估价'
          };
        }
      }

      let vehicleProfile = await db.VehicleProfile.findOne({
        where: { vin: data.vehicle_profile.vin },
        transaction
      });

      if (!vehicleProfile) {
        vehicleProfile = await db.VehicleProfile.create(data.vehicle_profile, { transaction });
      } else {
        await vehicleProfile.update(data.vehicle_profile, { transaction });
      }

      const valuationNo = data.valuation_no || this.generateValuationNo();
      const valuation = await db.Valuation.create({
        vehicle_profile_id: vehicleProfile.id,
        valuation_no: valuationNo,
        request_id: data.request_id,
        status: '草稿',
        creator: operator,
        operator: operator
      }, { transaction });

      if (data.inspection_items && data.inspection_items.length > 0) {
        for (const item of data.inspection_items) {
          await db.InspectionItem.create({
            ...item,
            vehicle_profile_id: vehicleProfile.id,
            valuation_id: valuation.id
          }, { transaction });
        }
      }

      if (data.accident_records && data.accident_records.length > 0) {
        for (const record of data.accident_records) {
          await db.AccidentRecord.create({
            ...record,
            vehicle_profile_id: vehicleProfile.id,
            valuation_id: valuation.id
          }, { transaction });
        }
      }

      if (data.mileage_verifications && data.mileage_verifications.length > 0) {
        for (const verification of data.mileage_verifications) {
          await db.MileageVerification.create({
            ...verification,
            vehicle_profile_id: vehicleProfile.id,
            valuation_id: valuation.id
          }, { transaction });
        }
      }

      if (data.repair_costs && data.repair_costs.length > 0) {
        for (const cost of data.repair_costs) {
          await db.RepairCost.create({
            ...cost,
            vehicle_profile_id: vehicleProfile.id,
            valuation_id: valuation.id
          }, { transaction });
        }
      }

      await this.recordHistory(valuation.id, '创建估价', null, '草稿', operator, '创建估价单', null, transaction);

      await transaction.commit();

      const fullValuation = await this.getValuationDetail(valuation.id);
      return {
        isNew: true,
        valuation: fullValuation,
        message: '估价创建成功'
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  static async advanceStatus(valuationId, targetStatus, operator = 'system', reason = '', extraData = {}) {
    const transaction = await db.sequelize.transaction();
    try {
      const valuation = await db.Valuation.findByPk(valuationId, { transaction });
      if (!valuation) {
        throw new Error('估价单不存在');
      }

      const fromStatus = valuation.status;

      if (!this.canTransition(fromStatus, targetStatus)) {
        throw new Error(`无法从"${fromStatus}"转换到"${targetStatus}"状态`);
      }

      let updateData = {
        status: targetStatus,
        operator: operator
      };

      if (targetStatus === '估价完成') {
        const calculationResult = await this.calculateValuation(valuationId, transaction);
        updateData = { ...updateData, ...calculationResult };
      }

      await valuation.update(updateData, { transaction });

      const snapshot = await this.createSnapshot(valuationId, transaction);
      await this.recordHistory(valuationId, `推进到${targetStatus}`, fromStatus, targetStatus, operator, reason, null, transaction, snapshot);

      await transaction.commit();

      return await this.getValuationDetail(valuationId);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  static canTransition(fromStatus, toStatus) {
    const transitions = {
      '草稿': ['待检测', '已作废'],
      '待检测': ['检测中', '已作废'],
      '检测中': ['检测完成', '已作废'],
      '检测完成': ['待审核', '已作废'],
      '待审核': ['审核通过', '审核驳回', '已作废'],
      '审核通过': ['估价完成', '已作废'],
      '审核驳回': ['检测中', '已作废'],
      '估价完成': ['已报价', '已作废'],
      '已报价': ['已成交', '已作废'],
      '已成交': [],
      '已作废': []
    };

    const allowed = transitions[fromStatus] || [];
    return allowed.includes(toStatus);
  }

  static async calculateValuation(valuationId, transaction = null) {
    const commitOutside = !transaction;
    if (!transaction) {
      transaction = await db.sequelize.transaction();
    }

    try {
      const valuation = await db.Valuation.findByPk(valuationId, {
        include: [
          { model: db.VehicleProfile, as: 'vehicle_profile' },
          { model: db.InspectionItem, as: 'inspection_items' },
          { model: db.AccidentRecord, as: 'accident_records' },
          { model: db.MileageVerification, as: 'mileage_verifications' },
          { model: db.RepairCost, as: 'repair_costs' }
        ],
        transaction
      });

      if (!valuation) {
        throw new Error('估价单不存在');
      }

      const vehicleProfile = valuation.vehicle_profile;
      const basePrice = ValuationRulesService.calculateBasePrice(vehicleProfile);

      const accidentAnalysis = ValuationRulesService.analyzeAccidents(
        valuation.accident_records || [],
        basePrice
      );

      const mileageAnalysis = ValuationRulesService.analyzeMileage(
        valuation.mileage_verifications || [],
        vehicleProfile
      );

      const inspectionAnalysis = ValuationRulesService.analyzeInspections(
        valuation.inspection_items || [],
        basePrice
      );

      const repairAnalysis = ValuationRulesService.analyzeRepairCosts(
        valuation.repair_costs || [],
        basePrice
      );

      const priceResult = ValuationRulesService.calculateFinalPrice(
        basePrice,
        accidentAnalysis.totalDeduction,
        mileageAnalysis.totalDeduction,
        inspectionAnalysis.totalDeduction,
        repairAnalysis.totalCost
      );

      const riskLevel = ValuationRulesService.calculateRiskLevel(
        accidentAnalysis,
        mileageAnalysis,
        inspectionAnalysis
      );

      const valuationFactors = ValuationRulesService.buildValuationFactors(
        vehicleProfile,
        accidentAnalysis,
        mileageAnalysis,
        inspectionAnalysis,
        repairAnalysis
      );

      const deductionReasons = [
        ...accidentAnalysis.deductionReasons,
        ...mileageAnalysis.deductionReasons,
        ...inspectionAnalysis.deductionReasons,
        repairAnalysis.isOverThreshold ? `整备成本超阈值，当前${repairAnalysis.totalCost.toFixed(2)}元，阈值${repairAnalysis.threshold.toFixed(2)}元` : null
      ].filter(Boolean);

      const updateData = {
        base_price: basePrice,
        total_score_deduction: accidentAnalysis.scoreDeduction + mileageAnalysis.scoreDeduction + inspectionAnalysis.scoreDeduction,
        accident_deduction: accidentAnalysis.totalDeduction,
        mileage_deduction: mileageAnalysis.totalDeduction,
        inspection_deduction: inspectionAnalysis.totalDeduction,
        repair_cost_total: repairAnalysis.totalCost,
        repair_cost_threshold: repairAnalysis.threshold,
        is_repair_cost_over_threshold: repairAnalysis.isOverThreshold,
        has_missing_inspection_items: inspectionAnalysis.hasMissingItems,
        missing_inspection_count: inspectionAnalysis.missingItemCount,
        has_major_accident: accidentAnalysis.hasMajorAccident,
        major_accident_count: accidentAnalysis.majorAccidentCount,
        has_mileage_anomaly: mileageAnalysis.hasAnomaly,
        mileage_anomaly_type: mileageAnalysis.anomalyType,
        final_price: priceResult.finalPrice,
        suggested_sale_price: priceResult.suggestedSalePrice,
        valuation_factors: JSON.stringify(valuationFactors),
        deduction_reasons: JSON.stringify(deductionReasons),
        risk_level: riskLevel,
        requires_manual_review: mileageAnalysis.requiresReview || inspectionAnalysis.hasMissingItems
      };

      await valuation.update(updateData, { transaction });

      if (commitOutside) {
        await transaction.commit();
      }

      return updateData;
    } catch (error) {
      if (commitOutside) {
        await transaction.rollback();
      }
      throw error;
    }
  }

  static async recordHistory(valuationId, action, fromStatus, toStatus, operator, reason = '', failureReason = null, transaction = null, snapshot = null) {
    return await db.ValuationHistory.create({
      valuation_id: valuationId,
      action: action,
      from_status: fromStatus,
      to_status: toStatus,
      operator: operator,
      reason: reason,
      failure_reason: failureReason,
      snapshot: snapshot ? JSON.stringify(snapshot) : null
    }, { transaction });
  }

  static async createSnapshot(valuationId, transaction = null) {
    const valuation = await db.Valuation.findByPk(valuationId, {
      include: [
        { model: db.VehicleProfile, as: 'vehicle_profile' },
        { model: db.InspectionItem, as: 'inspection_items' },
        { model: db.AccidentRecord, as: 'accident_records' },
        { model: db.MileageVerification, as: 'mileage_verifications' },
        { model: db.RepairCost, as: 'repair_costs' }
      ],
      transaction
    });

    if (!valuation) return null;

    return {
      valuation: valuation.toJSON(),
      vehicle_profile: valuation.vehicle_profile?.toJSON(),
      inspection_items: valuation.inspection_items?.map(i => i.toJSON()),
      accident_records: valuation.accident_records?.map(a => a.toJSON()),
      mileage_verifications: valuation.mileage_verifications?.map(m => m.toJSON()),
      repair_costs: valuation.repair_costs?.map(r => r.toJSON())
    };
  }

  static async getValuationDetail(valuationId) {
    return await db.Valuation.findByPk(valuationId, {
      include: [
        { model: db.VehicleProfile, as: 'vehicle_profile' },
        { model: db.InspectionItem, as: 'inspection_items' },
        { model: db.AccidentRecord, as: 'accident_records' },
        { model: db.MileageVerification, as: 'mileage_verifications' },
        { model: db.RepairCost, as: 'repair_costs' },
        { 
          model: db.ValuationHistory, 
          as: 'history_records',
          order: [['operation_time', 'DESC']]
        },
        {
          model: db.QuoteVersion,
          as: 'quote_versions',
          order: [['version_no', 'DESC']]
        },
        {
          model: db.ManualCorrection,
          as: 'manual_corrections',
          order: [['operation_time', 'DESC']]
        }
      ]
    });
  }

  static async getValuationList(params = {}) {
    const where = {};
    if (params.status) where.status = params.status;
    if (params.valuation_no) where.valuation_no = { [db.Sequelize.Op.like]: `%${params.valuation_no}%` };

    const { count, rows } = await db.Valuation.findAndCountAll({
      where,
      include: [{ model: db.VehicleProfile, as: 'vehicle_profile' }],
      order: [['created_at', 'DESC']],
      limit: params.limit || 20,
      offset: params.offset || 0
    });

    return {
      total: count,
      items: rows
    };
  }

  static async createQuoteVersion(valuationId, data, operator = 'system') {
    const transaction = await db.sequelize.transaction();
    try {
      if (data.customer_phone) {
        const valuation = await db.Valuation.findByPk(valuationId, { transaction });
        if (valuation) {
          const existing = await ValuationRulesService.checkDuplicateQuote(
            valuation.vehicle_profile_id,
            data.customer_phone
          );
          if (existing && existing.valuation_id !== valuationId) {
            throw new Error(`重复报价：该客户在估价单 ${existing.valuation.valuation_no} 中已有有效报价`);
          }
        }
      }

      const versions = await db.QuoteVersion.findAll({
        where: { valuation_id: valuationId },
        transaction,
        order: [['version_no', 'DESC']]
      });

      const newVersionNo = versions.length > 0 ? versions[0].version_no + 1 : 1;

      await db.QuoteVersion.update(
        { is_current: false },
        { where: { valuation_id: valuationId }, transaction }
      );

      const quoteVersion = await db.QuoteVersion.create({
        valuation_id: valuationId,
        version_no: newVersionNo,
        version_name: data.version_name || `版本${newVersionNo}`,
        is_current: true,
        base_price: data.base_price,
        accident_deduction: data.accident_deduction,
        mileage_deduction: data.mileage_deduction,
        inspection_deduction: data.inspection_deduction,
        repair_cost_total: data.repair_cost_total,
        final_price: data.final_price,
        suggested_sale_price: data.suggested_sale_price,
        quoted_price: data.quoted_price,
        customer_name: data.customer_name,
        customer_phone: data.customer_phone,
        quote_time: data.quote_time || new Date(),
        quote_status: data.quote_status || '草稿',
        valid_until: data.valid_until,
        operator: operator,
        change_reason: data.change_reason
      }, { transaction });

      const valuation = await db.Valuation.findByPk(valuationId, { transaction });
      if (valuation && data.quote_status === '已报价') {
        await valuation.update({
          status: '已报价',
          current_version: newVersionNo,
          operator
        }, { transaction });

        await this.recordHistory(valuationId, '生成报价', valuation.status, '已报价', operator, `生成报价版本${newVersionNo}`, null, transaction);
      }

      await transaction.commit();
      return quoteVersion;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  static async createManualCorrection(valuationId, data, operator) {
    const transaction = await db.sequelize.transaction();
    try {
      const correction = await db.ManualCorrection.create({
        valuation_id: valuationId,
        correction_type: data.correction_type,
        field_name: data.field_name,
        before_value: JSON.stringify(data.before_value),
        after_value: JSON.stringify(data.after_value),
        difference: data.difference,
        reason: data.reason,
        operator: operator
      }, { transaction });

      if (data.update_valuation) {
        const valuation = await db.Valuation.findByPk(valuationId, { transaction });
        if (valuation && data.field_name) {
          const updateData = {};
          updateData[data.field_name] = data.after_value;
          await valuation.update(updateData, { transaction });
        }
      }

      await this.recordHistory(
        valuationId,
        '人工修正',
        null,
        null,
        operator,
        `人工修正: ${data.correction_type}`,
        null,
        transaction
      );

      await transaction.commit();
      return correction;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  static async generateReport(valuationId) {
    const valuation = await this.getValuationDetail(valuationId);
    if (!valuation) {
      throw new Error('估价单不存在');
    }

    const vehicleProfile = valuation.vehicle_profile;
    const historyRecords = valuation.history_records || [];
    const quoteVersions = valuation.quote_versions || [];
    const manualCorrections = valuation.manual_corrections || [];

    let valuationFactors = {};
    let deductionReasons = [];
    try {
      if (valuation.valuation_factors) {
        valuationFactors = JSON.parse(valuation.valuation_factors);
      }
      if (valuation.deduction_reasons) {
        deductionReasons = JSON.parse(valuation.deduction_reasons);
      }
    } catch (e) {
    }

    const repairDetails = (valuation.repair_costs || []).map(cost => ({
      分类: cost.category,
      项目: cost.item_name,
      优先级: cost.priority,
      预估费用: `¥${cost.estimated_cost}`,
      描述: cost.description
    }));

    const salesExplanation = this.generateSalesExplanation(valuation, deductionReasons, repairDetails);

    return {
      report_no: `R${valuation.valuation_no}`,
      generated_at: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      valuation_info: {
        valuation_no: valuation.valuation_no,
        status: valuation.status,
        risk_level: valuation.risk_level,
        created_at: valuation.created_at
      },
      vehicle_info: {
        brand: vehicleProfile?.brand,
        model: vehicleProfile?.model,
        year: vehicleProfile?.year,
        mileage: vehicleProfile?.mileage,
        vin: vehicleProfile?.vin,
        license_plate: vehicleProfile?.license_plate
      },
      price_breakdown: {
        base_price: parseFloat(valuation.base_price),
        accident_deduction: parseFloat(valuation.accident_deduction),
        mileage_deduction: parseFloat(valuation.mileage_deduction),
        inspection_deduction: parseFloat(valuation.inspection_deduction),
        repair_cost_total: parseFloat(valuation.repair_cost_total),
        final_price: parseFloat(valuation.final_price),
        suggested_sale_price: parseFloat(valuation.suggested_sale_price)
      },
      valuation_factors: valuationFactors,
      deduction_reasons: deductionReasons,
      repair_details: repairDetails,
      flags: {
        has_major_accident: valuation.has_major_accident,
        has_mileage_anomaly: valuation.has_mileage_anomaly,
        has_missing_inspection_items: valuation.has_missing_inspection_items,
        is_repair_cost_over_threshold: valuation.is_repair_cost_over_threshold,
        requires_manual_review: valuation.requires_manual_review
      },
      history: historyRecords.map(h => ({
        action: h.action,
        from_status: h.from_status,
        to_status: h.to_status,
        operator: h.operator,
        time: dayjs(h.operation_time).format('YYYY-MM-DD HH:mm:ss'),
        reason: h.reason,
        failure_reason: h.failure_reason
      })),
      quote_versions: quoteVersions.map(q => ({
        version_no: q.version_no,
        version_name: q.version_name,
        quoted_price: parseFloat(q.quoted_price),
        customer_name: q.customer_name,
        quote_status: q.quote_status,
        change_reason: q.change_reason
      })),
      manual_corrections: manualCorrections.map(c => ({
        correction_type: c.correction_type,
        field_name: c.field_name,
        difference: c.difference,
        reason: c.reason,
        operator: c.operator,
        time: dayjs(c.operation_time).format('YYYY-MM-DD HH:mm:ss')
      })),
      sales_explanation: salesExplanation
    };
  }

  static generateSalesExplanation(valuation, deductionReasons, repairDetails) {
    const explanations = [];
    
    explanations.push(`【车辆基础信息】
品牌型号：${valuation.vehicle_profile?.brand} ${valuation.vehicle_profile?.model}
出厂年份：${valuation.vehicle_profile?.year}年
表显里程：${valuation.vehicle_profile?.mileage}公里`);

    if (deductionReasons.length > 0) {
      explanations.push(`\n【价格调整说明】
${deductionReasons.map((r, i) => `${i + 1}. ${r}`).join('\n')}`);
    }

    if (repairDetails.length > 0) {
      explanations.push(`\n【整备明细】
${repairDetails.map((r, i) => `${i + 1}. [${r.优先级}] ${r.项目} - ${r.预估费用}
   说明: ${r.描述}`).join('\n')}`);
    }

    explanations.push(`\n【报价依据】
基础估价：¥${parseFloat(valuation.base_price).toLocaleString()}
事故扣减：¥${parseFloat(valuation.accident_deduction).toLocaleString()}
里程扣减：¥${parseFloat(valuation.mileage_deduction).toLocaleString()}
检测扣减：¥${parseFloat(valuation.inspection_deduction).toLocaleString()}
整备成本：¥${parseFloat(valuation.repair_cost_total).toLocaleString()}
─────────────────────
最终估价：¥${parseFloat(valuation.final_price).toLocaleString()}
建议售价：¥${parseFloat(valuation.suggested_sale_price).toLocaleString()}`);

    if (valuation.risk_level !== '低风险') {
      explanations.push(`\n【风险提示】
风险等级：${valuation.risk_level}
${valuation.has_major_accident ? '⚠️ 存在重大事故记录' : ''}
${valuation.has_mileage_anomaly ? `⚠️ 里程${valuation.mileage_anomaly_type}` : ''}
${valuation.has_missing_inspection_items ? `⚠️ 存在${valuation.missing_inspection_count}项未检测` : ''}
${valuation.is_repair_cost_over_threshold ? '⚠️ 整备成本超阈值' : ''}`);
    }

    return explanations.join('\n');
  }

  static async handleError(valuationId, error, operator = 'system') {
    await this.recordHistory(
      valuationId,
      '异常处理',
      null,
      null,
      operator,
      '系统异常',
      error.message
    );

    const valuation = await db.Valuation.findByPk(valuationId);
    if (valuation && ['检测中', '估价完成'].includes(valuation.status)) {
      await valuation.update({
        requires_manual_review: true,
        operator
      });
    }
  }
}

module.exports = ValuationService;
