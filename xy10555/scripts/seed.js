const db = require('../src/models');
const ValuationService = require('../src/services/ValuationService');

const SAMPLES = {
  normal: {
    name: '正常估价样例',
    description: '无事故、里程正常、检测完好的车辆',
    vehicle_profile: {
      vin: 'LSVNF2188D2123456',
      license_plate: '京A12345',
      brand: '大众',
      model: '帕萨特 330TSI DSG尊荣版',
      year: 2020,
      mileage: 75000,
      displacement: 2.0,
      transmission: '手自一体',
      fuel_type: '汽油',
      color: '黑色',
      body_type: '轿车',
      first_registration_date: '2020-03-15',
      ownership_count: 1,
      use_nature: '非营运',
      market_reference_price: 185000
    },
    inspection_items: [
      { category: '外观', item_name: '车身漆面', inspection_result: '正常', is_required: true, inspector: '张检测', inspection_time: new Date() },
      { category: '外观', item_name: '前后保险杠', inspection_result: '正常', is_required: true, inspector: '张检测', inspection_time: new Date() },
      { category: '发动机', item_name: '发动机工况', inspection_result: '正常', is_required: true, inspector: '张检测', inspection_time: new Date() },
      { category: '发动机', item_name: '变速箱工况', inspection_result: '正常', is_required: true, inspector: '张检测', inspection_time: new Date() },
      { category: '底盘', item_name: '悬挂系统', inspection_result: '正常', is_required: true, inspector: '张检测', inspection_time: new Date() },
      { category: '安全系统', item_name: '安全气囊', inspection_result: '正常', is_required: true, inspector: '张检测', inspection_time: new Date() },
      { category: '安全系统', item_name: '制动系统', inspection_result: '正常', is_required: true, inspector: '张检测', inspection_time: new Date() },
      { category: '内饰', item_name: '座椅内饰', inspection_result: '轻微异常', description: '主驾驶座椅有轻微磨损', is_required: false, inspector: '张检测', inspection_time: new Date() }
    ],
    accident_records: [],
    mileage_verifications: [
      {
        reported_mileage: 75000,
        historical_mileages: JSON.stringify([
          { date: '2023-01-10', mileage: 55000 },
          { date: '2022-06-20', mileage: 38000 }
        ]),
        verification_result: '正常',
        verification_method: '保养记录',
        verifier: '李校验',
        verification_time: new Date()
      }
    ],
    repair_costs: [
      { category: '保养维护', item_name: '更换机油机滤', priority: '必须', estimated_cost: 600, description: '常规保养，使用全合成机油' },
      { category: '外观修复', item_name: '前保险杠划痕修复', priority: '建议', estimated_cost: 800, description: '保险杠有轻微划痕，不影响使用' }
    ]
  },
  
  accident: {
    name: '事故车降价样例',
    description: '有重大事故记录的车辆',
    vehicle_profile: {
      vin: 'LBV1Z3108MM123456',
      license_plate: '沪B67890',
      brand: '宝马',
      model: '320Li M运动套装',
      year: 2021,
      mileage: 45000,
      displacement: 2.0,
      transmission: '手自一体',
      fuel_type: '汽油',
      color: '白色',
      body_type: '轿车',
      first_registration_date: '2021-05-20',
      ownership_count: 2,
      use_nature: '非营运',
      market_reference_price: 250000
    },
    inspection_items: [
      { category: '外观', item_name: '车身漆面', inspection_result: '中度异常', description: '左侧翼子板有钣金修复痕迹', is_required: true, inspector: '张检测', inspection_time: new Date() },
      { category: '外观', item_name: '前后保险杠', inspection_result: '正常', is_required: true, inspector: '张检测', inspection_time: new Date() },
      { category: '发动机', item_name: '发动机工况', inspection_result: '正常', is_required: true, inspector: '张检测', inspection_time: new Date() },
      { category: '底盘', item_name: '悬挂系统', inspection_result: '正常', is_required: true, inspector: '张检测', inspection_time: new Date() },
      { category: '安全系统', item_name: '安全气囊', inspection_result: '正常', is_required: true, inspector: '张检测', inspection_time: new Date() }
    ],
    accident_records: [
      {
        accident_date: '2022-11-15',
        accident_type: '重大事故',
        accident_severity: '严重',
        description: '高速追尾，左侧A柱变形，左前纵梁修复',
        damage_parts: JSON.stringify(['左侧A柱', '左前纵梁', '左前翼子板', '左前大灯']),
        repair_amount: 35000,
        is_structural_damage: true,
        is_airbag_deployed: false,
        insurance_claim: true,
        claim_amount: 32000,
        source: '保险记录',
        reporter: '李事故'
      },
      {
        accident_date: '2023-03-20',
        accident_type: '轻微事故',
        accident_severity: '轻微',
        description: '倒车剐蹭右后保险杠',
        damage_parts: JSON.stringify(['右后保险杠']),
        repair_amount: 1500,
        is_structural_damage: false,
        insurance_claim: false,
        source: '4S店记录',
        reporter: '李事故'
      }
    ],
    mileage_verifications: [
      {
        reported_mileage: 45000,
        historical_mileages: JSON.stringify([
          { date: '2023-06-10', mileage: 32000 },
          { date: '2022-12-20', mileage: 25000 }
        ]),
        verification_result: '正常',
        verification_method: 'OBD读取',
        verifier: '王校验',
        verification_time: new Date()
      }
    ],
    repair_costs: [
      { category: '钣金喷漆', item_name: '左侧翼子板喷漆', priority: '建议', estimated_cost: 2000, description: '事故修复后补漆效果一般，建议重新喷漆' },
      { category: '保养维护', item_name: '全车检查', priority: '必须', estimated_cost: 1200, description: '事故车需要全面安全检查' }
    ]
  },
  
  mileageAnomaly: {
    name: '里程异常待审样例',
    description: '表显里程疑似回调，需人工审核',
    vehicle_profile: {
      vin: 'LFMA3E135D1234567',
      license_plate: '粤C11111',
      brand: '丰田',
      model: '凯美瑞 2.5G 豪华版',
      year: 2018,
      mileage: 38000,
      displacement: 2.5,
      transmission: '手自一体',
      fuel_type: '汽油',
      color: '银色',
      body_type: '轿车',
      first_registration_date: '2018-08-10',
      ownership_count: 3,
      use_nature: '非营运',
      market_reference_price: 135000
    },
    inspection_items: [
      { category: '外观', item_name: '车身漆面', inspection_result: '正常', is_required: true, inspector: '张检测', inspection_time: new Date() },
      { category: '内饰', item_name: '方向盘磨损', inspection_result: '严重异常', description: '方向盘磨损严重，与表显里程不符', is_required: true, inspector: '张检测', inspection_time: new Date() },
      { category: '内饰', item_name: '座椅磨损', inspection_result: '中度异常', description: '主驾座椅磨损严重', is_required: false, inspector: '张检测', inspection_time: new Date() },
      { category: '发动机', item_name: '发动机工况', inspection_result: '正常', is_required: true, inspector: '张检测', inspection_time: new Date() },
      { category: '底盘', item_name: '悬挂系统', inspection_result: '正常', is_required: true, inspector: '张检测', inspection_time: new Date() },
      { category: '安全系统', item_name: '安全气囊', inspection_result: '正常', is_required: true, inspector: '张检测', inspection_time: new Date() }
    ],
    accident_records: [],
    mileage_verifications: [
      {
        reported_mileage: 38000,
        historical_mileages: JSON.stringify([
          { date: '2021-05-15', mileage: 65000, source: '4S店保养记录' },
          { date: '2020-11-20', mileage: 52000, source: '4S店保养记录' }
        ]),
        verification_result: '疑似回调',
        verification_method: '综合判断',
        is_rollback_suspected: true,
        rollback_suspected_amount: 27000,
        evidence: '历史保养记录显示2021年已达6.5万公里，目前表显3.8万公里，且方向盘、座椅磨损严重',
        verifier: '赵校验',
        verification_time: new Date(),
        requires_manual_review: true,
        review_status: '待审核'
      }
    ],
    repair_costs: [
      { category: '内饰清洗', item_name: '内饰深度清洗', priority: '建议', estimated_cost: 500, description: '方向盘和座椅需要深度清洁' },
      { category: '保养维护', item_name: '更换正时皮带', priority: '必须', estimated_cost: 3500, description: '按实际里程推算应该更换正时皮带' }
    ]
  }
};

async function main() {
  console.log('开始初始化数据库...');
  
  await db.sequelize.sync({ force: true });
  console.log('数据库已重置');
  
  const createdIds = {};
  
  for (const [key, sample] of Object.entries(SAMPLES)) {
    console.log(`\n创建样例: ${sample.name}`);
    console.log(`描述: ${sample.description}`);
    
    try {
      const result = await ValuationService.createValuation({
        request_id: `sample-${key}-${Date.now()}`,
        valuation_no: `V-DEMO-${key.toUpperCase()}`,
        ...sample
      }, 'seed_script');
      
      createdIds[key] = result.valuation.id;
      console.log(`✓ 估价单号: ${result.valuation.valuation_no}`);
      console.log(`✓ ID: ${result.valuation.id}`);
      
      const valuationId = result.valuation.id;
      
      if (key === 'normal') {
        console.log('  推进状态: 草稿 → 待检测 → 检测中 → 检测完成 → 待审核 → 审核通过 → 估价完成');
        
        await ValuationService.advanceStatus(valuationId, '待检测', 'seed_script', '进入检测流程');
        await ValuationService.advanceStatus(valuationId, '检测中', 'seed_script', '开始检测');
        await ValuationService.advanceStatus(valuationId, '检测完成', 'seed_script', '检测完成');
        await ValuationService.advanceStatus(valuationId, '待审核', 'seed_script', '提交审核');
        await ValuationService.advanceStatus(valuationId, '审核通过', 'seed_script', '审核通过');
        await ValuationService.advanceStatus(valuationId, '估价完成', 'seed_script', '完成估价计算');
        
        const detail = await ValuationService.getValuationDetail(valuationId);
        console.log(`  基础估价: ¥${detail.base_price}`);
        console.log(`  最终估价: ¥${detail.final_price}`);
        console.log(`  建议售价: ¥${detail.suggested_sale_price}`);
        console.log(`  风险等级: ${detail.risk_level}`);
        
        await ValuationService.createQuoteVersion(valuationId, {
          version_name: '首次报价',
          base_price: detail.base_price,
          accident_deduction: detail.accident_deduction,
          mileage_deduction: detail.mileage_deduction,
          inspection_deduction: detail.inspection_deduction,
          repair_cost_total: detail.repair_cost_total,
          final_price: detail.final_price,
          suggested_sale_price: detail.suggested_sale_price,
          quoted_price: detail.suggested_sale_price,
          customer_name: '张先生',
          customer_phone: '13800138001',
          quote_status: '已报价',
          valid_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          change_reason: '首次给客户报价'
        }, '王销售');
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        await ValuationService.createQuoteVersion(valuationId, {
          version_name: '优惠报价',
          base_price: detail.base_price,
          accident_deduction: detail.accident_deduction,
          mileage_deduction: detail.mileage_deduction,
          inspection_deduction: detail.inspection_deduction,
          repair_cost_total: detail.repair_cost_total,
          final_price: detail.final_price,
          suggested_sale_price: detail.suggested_sale_price,
          quoted_price: Math.round(detail.suggested_sale_price * 0.97),
          customer_name: '张先生',
          customer_phone: '13800138001',
          quote_status: '已报价',
          valid_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          change_reason: '客户议价，给予3%优惠'
        }, '王销售');
        
        console.log('  ✓ 创建了2个报价版本用于对比');
      }
      
      if (key === 'accident') {
        console.log('  推进状态: 草稿 → 待检测 → 检测中 → 检测完成 → 待审核 → 审核通过 → 估价完成');
        
        await ValuationService.advanceStatus(valuationId, '待检测', 'seed_script', '进入检测流程');
        await ValuationService.advanceStatus(valuationId, '检测中', 'seed_script', '开始检测');
        await ValuationService.advanceStatus(valuationId, '检测完成', 'seed_script', '检测完成');
        await ValuationService.advanceStatus(valuationId, '待审核', 'seed_script', '提交审核（事故车重点审核）');
        await ValuationService.advanceStatus(valuationId, '审核通过', 'seed_script', '事故审核通过');
        await ValuationService.advanceStatus(valuationId, '估价完成', 'seed_script', '完成估价计算');
        
        const detail = await ValuationService.getValuationDetail(valuationId);
        console.log(`  基础估价: ¥${detail.base_price}`);
        console.log(`  事故扣减: -¥${detail.accident_deduction}`);
        console.log(`  最终估价: ¥${detail.final_price}`);
        console.log(`  风险等级: ${detail.risk_level}`);
        console.log(`  重大事故: ${detail.has_major_accident ? '是' : '否'}`);
        console.log(`  事故次数: ${detail.major_accident_count}`);
      }
      
      if (key === 'mileageAnomaly') {
        console.log('  推进状态: 草稿 → 待检测 → 检测中 → 检测完成');
        
        await ValuationService.advanceStatus(valuationId, '待检测', 'seed_script', '进入检测流程');
        await ValuationService.advanceStatus(valuationId, '检测中', 'seed_script', '开始检测');
        await ValuationService.advanceStatus(valuationId, '检测完成', 'seed_script', '检测完成（发现里程异常）');
        
        const detail = await ValuationService.getValuationDetail(valuationId);
        console.log(`  里程异常: ${detail.has_mileage_anomaly ? '是' : '否'}`);
        console.log(`  异常类型: ${detail.mileage_anomaly_type || '无'}`);
        console.log(`  需要人工审核: ${detail.requires_manual_review ? '是' : '否'}`);
        
        await ValuationService.createManualCorrection(valuationId, {
          correction_type: '里程异常调整',
          field_name: null,
          before_value: { reported_mileage: 38000 },
          after_value: { actual_mileage: 78000 },
          difference: '根据历史记录和车况判断，实际里程约7.8万公里，表显3.8万公里疑似回调',
          reason: '里程异常，经人工核实后修正里程',
          update_valuation: false
        }, '审核专员-李');
        
        console.log('  ✓ 创建了人工修正记录');
      }
      
    } catch (error) {
      console.error(`✗ 创建失败: ${error.message}`);
      console.error(error.stack);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('样例数据创建完成！');
  console.log('='.repeat(60));
  console.log('可用样例:');
  for (const [key, id] of Object.entries(createdIds)) {
    console.log(`  ${key}: ${SAMPLES[key].name}`);
    console.log(`    ID: ${id}`);
  }
  console.log('\n提示:');
  console.log('  - 正常估价样例: 可以查看完整估价流程和报价版本对比');
  console.log('  - 事故车样例: 可以查看重大事故扣分规则');
  console.log('  - 里程异常样例: 可以查看里程疑似回调检测和人工审核流程');
  console.log('='.repeat(60));
  
  process.exit(0);
}

main().catch(error => {
  console.error('初始化失败:', error);
  process.exit(1);
});
