import { v4 as uuidv4 } from 'uuid';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import type {
  Customer,
  GuaranteeContract,
  CreditLine,
  CounterGuarantee,
  VersionSnapshot,
  OperationLog,
  RiskAnalysisResult,
  RiskLevel,
} from '../../shared/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, '../data/guarantee_circle.db');

const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);

function runMigrations() {
  const migrationPath = path.resolve(__dirname, '../migrations/001_initial_schema.sql');
  const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
  db.exec(migrationSQL);
  console.log('数据库迁移完成');
}

function generateRandomAmount(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1) + min) * 10000;
}

function generateRandomDate(daysBack: number = 365): string {
  const date = new Date();
  date.setDate(date.getDate() - Math.floor(Math.random() * daysBack));
  return date.toISOString().split('T')[0];
}

function calculateRiskLevel(score: number): RiskLevel {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

const customerNames = [
  '华润集团有限公司',
  '中国五矿集团有限公司',
  '中粮集团有限公司',
  '国家电网有限公司',
  '中国南方电网有限责任公司',
  '中国航空工业集团有限公司',
  '中国船舶集团有限公司',
  '中国兵器工业集团有限公司',
  '中国电子科技集团有限公司',
  '中国石油天然气集团有限公司',
  '中国石油化工集团有限公司',
  '中国海洋石油集团有限公司',
  '国家开发投资集团有限公司',
  '中国建筑集团有限公司',
  '中国铁路工程集团有限公司',
  '中国铁道建筑集团有限公司',
  '中国交通建设集团有限公司',
  '中国电力建设集团有限公司',
  '中国能源建设集团有限公司',
  '中国有色矿业集团有限公司',
];

const industries = [
  '能源电力',
  '制造业',
  '金融业',
  '房地产',
  '交通运输',
  '批发零售',
  '建筑工程',
  '信息技术',
  '采矿业',
  '农林牧渔',
];

const creditRatings = ['AAA', 'AA+', 'AA', 'AA-', 'A+', 'A', 'A-', 'BBB+', 'BBB'];

function generateMockData() {
  console.log('开始生成Mock数据...');

  runMigrations();

  db.exec('BEGIN TRANSACTION');

  try {
    const versionId = uuidv4();
    const batchId = uuidv4();
    const snapshotId = uuidv4();
    const now = new Date().toISOString();

    const insertSnapshotStmt = db.prepare(`
      INSERT INTO version_snapshot (id, name, description, created_at, created_by, data_version, calculation_version, data_files, is_active, can_rollback)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertSnapshotStmt.run(
      versionId,
      '初始版本',
      'Mock数据初始版本',
      now,
      'admin',
      'v1.0.0',
      '1.0.0',
      JSON.stringify(['mock_customer_data.xlsx', 'mock_guarantee_data.xlsx', 'mock_credit_data.xlsx']),
      1,
      1
    );

    const insertBatchStmt = db.prepare(`
      INSERT INTO import_batch (id, name, upload_time, uploader, status, total_rows, valid_rows, error_rows, version)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertBatchStmt.run(
      batchId,
      'Mock数据导入批次',
      now,
      'admin',
      'completed',
      customerNames.length + 30 + 20 + 10,
      customerNames.length + 30 + 20 + 10,
      0,
      versionId
    );

    const customers: Customer[] = [];
    const guarantees: GuaranteeContract[] = [];
    const credits: CreditLine[] = [];
    const counterGuarantees: CounterGuarantee[] = [];

    for (let i = 0; i < customerNames.length; i++) {
      const customer: Customer = {
        id: `CUST${String(i + 1).padStart(4, '0')}`,
        name: customerNames[i],
        customerType: Math.random() > 0.3 ? 'group' : 'enterprise',
        creditRating: creditRatings[Math.floor(Math.random() * creditRatings.length)],
        industry: industries[Math.floor(Math.random() * industries.length)],
        attributes: {
          registeredCapital: generateRandomAmount(1000, 100000),
          establishedDate: generateRandomDate(3650),
          legalRepresentative: `法定代表人${i + 1}`,
        },
        version: versionId,
        sourceFile: 'mock_customer_data.xlsx',
        sourceBatch: batchId,
        createdAt: now,
        updatedAt: now,
      };
      customers.push(customer);
    }

    const insertCustomerStmt = db.prepare(`
      INSERT INTO customer (id, name, customer_type, credit_rating, industry, attributes, version, source_file, source_batch, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    customers.forEach((c) => {
      insertCustomerStmt.run(
        c.id,
        c.name,
        c.customerType,
        c.creditRating,
        c.industry,
        JSON.stringify(c.attributes),
        c.version,
        c.sourceFile,
        c.sourceBatch,
        c.createdAt,
        c.updatedAt
      );
    });

    for (let i = 0; i < 30; i++) {
      const guarantorIdx = Math.floor(Math.random() * customers.length);
      let guaranteedIdx = Math.floor(Math.random() * customers.length);
      while (guaranteedIdx === guarantorIdx) {
        guaranteedIdx = Math.floor(Math.random() * customers.length);
      }

      const isCounterGuarantee = Math.random() > 0.7;
      const amount = generateRandomAmount(500, 50000);
      const startDate = generateRandomDate(180);
      const endDate = new Date(startDate);
      endDate.setFullYear(endDate.getFullYear() + 1 + Math.floor(Math.random() * 2));

      const guarantee: GuaranteeContract = {
        id: `GUAR${String(i + 1).padStart(6, '0')}`,
        guarantorId: customers[guarantorIdx].id,
        guaranteedId: customers[guaranteedIdx].id,
        amount,
        currency: 'CNY',
        startDate,
        endDate: endDate.toISOString().split('T')[0],
        contractNumber: `HT${Date.now()}${String(i).padStart(4, '0')}`,
        isCounterGuarantee,
        attributes: {
          guaranteeType: Math.random() > 0.5 ? '连带责任保证' : '一般保证',
        },
        version: versionId,
        sourceFile: 'mock_guarantee_data.xlsx',
        sourceRow: i + 2,
        sourceBatch: batchId,
        createdAt: now,
        updatedAt: now,
      };
      guarantees.push(guarantee);

      if (isCounterGuarantee) {
        const cg: CounterGuarantee = {
          id: `CG${String(i + 1).padStart(6, '0')}`,
          guaranteeId: guarantee.id,
          providerId: customers[guaranteedIdx].id,
          type: ['存单质押', '房产抵押', '股权质押', '第三方担保'][Math.floor(Math.random() * 4)],
          amount: amount * (0.3 + Math.random() * 0.7),
          coverageRatio: 0.3 + Math.random() * 0.7,
          attributes: {
            collateralLocation: '北京市朝阳区',
            collateralValue: amount * 1.5,
          },
          version: versionId,
          sourceFile: 'mock_counter_guarantee_data.xlsx',
          sourceRow: i + 2,
          sourceBatch: batchId,
          createdAt: now,
          updatedAt: now,
        };
        counterGuarantees.push(cg);
      }
    }

    const insertGuaranteeStmt = db.prepare(`
      INSERT INTO guarantee_contract (id, guarantor_id, guaranteed_id, amount, currency, start_date, end_date, contract_number, is_counter_guarantee, attributes, version, source_file, source_row, source_batch, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    guarantees.forEach((g) => {
      insertGuaranteeStmt.run(
        g.id,
        g.guarantorId,
        g.guaranteedId,
        g.amount,
        g.currency,
        g.startDate,
        g.endDate,
        g.contractNumber,
        g.isCounterGuarantee ? 1 : 0,
        JSON.stringify(g.attributes),
        g.version,
        g.sourceFile,
        g.sourceRow,
        g.sourceBatch,
        g.createdAt,
        g.updatedAt
      );
    });

    const insertCounterGuaranteeStmt = db.prepare(`
      INSERT INTO counter_guarantee (id, guarantee_id, provider_id, type, amount, coverage_ratio, attributes, version, source_file, source_row, source_batch, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    counterGuarantees.forEach((cg) => {
      insertCounterGuaranteeStmt.run(
        cg.id,
        cg.guaranteeId,
        cg.providerId,
        cg.type,
        cg.amount,
        cg.coverageRatio,
        JSON.stringify(cg.attributes),
        cg.version,
        cg.sourceFile,
        cg.sourceRow,
        cg.sourceBatch,
        cg.createdAt,
        cg.updatedAt
      );
    });

    customers.forEach((customer, idx) => {
      const totalAmount = generateRandomAmount(1000, 100000);
      const usedRatio = 0.3 + Math.random() * 0.5;
      const usedAmount = Math.floor(totalAmount * usedRatio);

      const credit: CreditLine = {
        id: `CRED${String(idx + 1).padStart(6, '0')}`,
        customerId: customer.id,
        totalAmount,
        usedAmount,
        availableAmount: totalAmount - usedAmount,
        asOfDate: generateRandomDate(30),
        currency: 'CNY',
        attributes: {
          creditType: ['综合授信', '流动资金贷款', '项目贷款'][Math.floor(Math.random() * 3)],
          interestRate: (4 + Math.random() * 2).toFixed(2) + '%',
        },
        version: versionId,
        sourceFile: 'mock_credit_data.xlsx',
        sourceRow: idx + 2,
        sourceBatch: batchId,
        createdAt: now,
        updatedAt: now,
      };
      credits.push(credit);
    });

    const insertCreditStmt = db.prepare(`
      INSERT INTO credit_line (id, customer_id, total_amount, used_amount, available_amount, as_of_date, currency, attributes, version, source_file, source_row, source_batch, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    credits.forEach((c) => {
      insertCreditStmt.run(
        c.id,
        c.customerId,
        c.totalAmount,
        c.usedAmount,
        c.availableAmount,
        c.asOfDate,
        c.currency,
        JSON.stringify(c.attributes),
        c.version,
        c.sourceFile,
        c.sourceRow,
        c.sourceBatch,
        c.createdAt,
        c.updatedAt
      );
    });

    const insertOperationLogStmt = db.prepare(`
      INSERT INTO operation_log (id, operation_type, operator, timestamp, description, affected_objects, previous_snapshot_id, can_undo)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertOperationLogStmt.run(
      uuidv4(),
      '数据导入',
      'system',
      now,
      '导入Mock数据，包含20个客户、30个担保合同、20条授信记录',
      JSON.stringify(customers.map((c) => c.id)),
      null,
      0
    );

    const insertSnapshotStmt2 = db.prepare(`
      INSERT INTO version_snapshot (id, name, description, created_at, created_by, data_version, calculation_version, data_files, is_active, can_rollback)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertSnapshotStmt2.run(
      uuidv4(),
      '2024年Q1数据更新',
      '一季度数据更新，包含最新授信余额',
      new Date(Date.now() - 86400000 * 30).toISOString(),
      '张三',
      'v1.1.0',
      'v1.0.0',
      JSON.stringify(['customer_2024Q1.xlsx', 'credit_2024Q1.xlsx']),
      0,
      1
    );

    insertSnapshotStmt2.run(
      uuidv4(),
      '2024年Q2数据更新',
      '二季度数据更新，新增反担保材料',
      new Date(Date.now() - 86400000 * 7).toISOString(),
      '李四',
      'v1.2.0',
      'v1.0.0',
      JSON.stringify(['counter_guarantee_2024Q2.xlsx']),
      0,
      1
    );

    customers.forEach((customer) => {
      const guaranteeCount = guarantees.filter(
        (g) => g.guarantorId === customer.id || g.guaranteedId === customer.id
      ).length;

      const customerCredits = credits.filter((c) => c.customerId === customer.id);
      const totalCredit = customerCredits.reduce((sum, c) => sum + c.totalAmount, 0);
      const usedCredit = customerCredits.reduce((sum, c) => sum + c.usedAmount, 0);

      const customerGuarantees = guarantees.filter((g) => g.guarantorId === customer.id);
      const totalGuaranteeAmount = customerGuarantees.reduce((sum, g) => sum + g.amount, 0);

      const customerCounterGuarantees = counterGuarantees.filter((cg) =>
        guarantees.some((g) => g.id === cg.guaranteeId && g.guarantorId === customer.id)
      );
      const totalCounterGuaranteeAmount = customerCounterGuarantees.reduce(
        (sum, cg) => sum + cg.amount,
        0
      );

      const complexityScore = Math.min(100, guaranteeCount * 15);
      const concentrationScore = totalCredit > 0 ? Math.min(100, (usedCredit / totalCredit) * 100) : 50;
      const coverageScore = totalGuaranteeAmount > 0
        ? Math.min(100, 100 - (totalCounterGuaranteeAmount / totalGuaranteeAmount) * 100)
        : 50;
      const crossGuaranteeScore = Math.min(100, Math.floor(Math.random() * 100));

      const riskScore = Math.round(
        complexityScore * 0.3 +
          concentrationScore * 0.25 +
          coverageScore * 0.25 +
          crossGuaranteeScore * 0.2
      );

      const riskLevel = calculateRiskLevel(riskScore);

      const guaranteeChainRisk = calculateRiskLevel(complexityScore);
      const crossGuaranteeRisk = calculateRiskLevel(crossGuaranteeScore);
      const counterGuaranteeCoverage = totalGuaranteeAmount > 0
        ? totalCounterGuaranteeAmount / totalGuaranteeAmount
        : 0;
      const creditConcentration = totalCredit > 0 ? usedCredit / totalCredit : 0;

      const totalExposure = totalGuaranteeAmount * 0.5 + usedCredit;

      const riskFactors = [];
      if (guaranteeCount >= 5) {
        riskFactors.push({
          code: 'COMPLEX_GUARANTEE_CHAIN',
          name: '担保链复杂',
          severity: 'medium' as RiskLevel,
          description: `该客户涉及 ${guaranteeCount} 个担保关系，担保链复杂度较高`,
          relatedObjects: customerGuarantees.map((g) => g.id),
        });
      }
      if (creditConcentration > 0.7) {
        riskFactors.push({
          code: 'HIGH_CREDIT_CONCENTRATION',
          name: '授信集中度高',
          severity: 'high' as RiskLevel,
          description: `授信使用率达到 ${(creditConcentration * 100).toFixed(1)}%，超过警戒线`,
          relatedObjects: customerCredits.map((c) => c.id),
        });
      }
      if (counterGuaranteeCoverage < 0.5 && totalGuaranteeAmount > 0) {
        riskFactors.push({
          code: 'LOW_COUNTER_GUARANTEE',
          name: '反担保覆盖率低',
          severity: 'high' as RiskLevel,
          description: `反担保覆盖率仅为 ${(counterGuaranteeCoverage * 100).toFixed(1)}%，风险缓释不足`,
          relatedObjects: customerCounterGuarantees.map((cg) => cg.id),
        });
      }
      if (Math.random() > 0.7) {
        riskFactors.push({
          code: 'CROSS_GUARANTEE_RISK',
          name: '互保风险',
          severity: 'medium' as RiskLevel,
          description: '检测到与其他客户存在互保关系，可能形成风险传染',
          relatedObjects: [],
        });
      }

      const result: RiskAnalysisResult = {
        id: uuidv4(),
        customerId: customer.id,
        customerName: customer.name,
        totalExposure,
        guaranteeChainRisk,
        crossGuaranteeRisk,
        counterGuaranteeCoverage,
        creditConcentration,
        overallRiskLevel: riskLevel,
        riskFactors,
        riskScore,
        calculationVersion: 'v1.0.0',
        calculationTime: now,
        version: versionId,
      };

      const insertRiskStmt = db.prepare(`
        INSERT INTO risk_analysis_result (
          id, customer_id, customer_name, total_exposure, guarantee_chain_risk,
          cross_guarantee_risk, counter_guarantee_coverage, credit_concentration,
          overall_risk_level, risk_factors, risk_score, calculation_version,
          calculation_time, version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      insertRiskStmt.run(
        result.id,
        result.customerId,
        result.customerName,
        result.totalExposure,
        result.guaranteeChainRisk,
        result.crossGuaranteeRisk,
        result.counterGuaranteeCoverage,
        result.creditConcentration,
        result.overallRiskLevel,
        JSON.stringify(result.riskFactors),
        result.riskScore,
        result.calculationVersion,
        result.calculationTime,
        result.version
      );
    });

    const warningTypes = [
      {
        warningType: 'DUPLICATE_GUARANTEE',
        severity: 'warning' as const,
        message: '检测到重复担保记录：同一担保方对同一被担保方存在多份金额相近的合同',
        suggestion: '请核实是否为同一笔业务的多次录入，如为重复数据建议删除',
      },
      {
        warningType: 'DATE_ANOMALY',
        severity: 'error' as const,
        message: '授信余额日期异常：数据日期超过30天，可能已过期',
        suggestion: '请获取最新的授信余额数据，确保分析准确性',
      },
      {
        warningType: 'MISSING_COUNTER_GUARANTEE',
        severity: 'warning' as const,
        message: '反担保材料缺失：大额担保合同未提供对应的反担保措施',
        suggestion: '请补充反担保材料，或在系统中注明原因',
      },
      {
        warningType: 'CYCLE_GUARANTEE',
        severity: 'error' as const,
        message: '检测到循环担保：A为B担保，B为C担保，C为A担保，形成闭环',
        suggestion: '循环担保可能导致系统性风险，建议重点关注并采取风险缓释措施',
      },
    ];

    const insertWarningStmt = db.prepare(`
      INSERT INTO data_import_warning (
        id, source_file, row_number, object_id, object_name, warning_type,
        severity, message, suggestion, raw_data, batch_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (let i = 0; i < 8; i++) {
      const warningType = warningTypes[Math.floor(Math.random() * warningTypes.length)];
      const customer = customers[Math.floor(Math.random() * customers.length)];

      insertWarningStmt.run(
        uuidv4(),
        ['mock_customer_data.xlsx', 'mock_guarantee_data.xlsx', 'mock_credit_data.xlsx'][Math.floor(Math.random() * 3)],
        Math.floor(Math.random() * 50) + 2,
        customer.id,
        customer.name,
        warningType.warningType,
        warningType.severity,
        warningType.message,
        warningType.suggestion,
        JSON.stringify({ customerId: customer.id, customerName: customer.name }),
        batchId
      );
    }

    db.exec('COMMIT');

    console.log('Mock数据生成完成！');
    console.log(`- 客户数据：${customers.length} 条`);
    console.log(`- 担保合同：${guarantees.length} 条`);
    console.log(`- 授信余额：${credits.length} 条`);
    console.log(`- 反担保：${counterGuarantees.length} 条`);
    console.log(`- 风险分析结果：${customers.length} 条`);
    console.log(`- 异常警告：8 条`);
    console.log(`- 版本快照：3 个`);
  } catch (error) {
    db.exec('ROLLBACK');
    console.error('生成Mock数据失败:', error);
    throw error;
  }
}

generateMockData();
