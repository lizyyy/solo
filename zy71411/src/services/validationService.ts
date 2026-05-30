import {
  ForwardContract,
  RolloverApplication,
  PaymentRecord,
  LinkValidationResult,
  PointsValidationResult,
  MatchValidationResult,
  ValidationError,
  CalculationStep,
} from '../types';
import {
  IMPACT_WEIGHTS,
  SPOT_RATE_TOLERANCE,
  POINTS_DEVIATION_TOLERANCE,
  AMOUNT_MATCH_TOLERANCE,
  PAYMENT_DATE_TOLERANCE_DAYS,
  INTEREST_RATES,
} from '../utils/constants';
import { generateId, formatValidationMessage, calculateDeviation } from '../utils/formatters';
import dayjs from 'dayjs';

export class ValidationService {
  static validateContractLink(
    contract: ForwardContract,
    allContracts: ForwardContract[],
    applications: RolloverApplication[],
    historicalErrors: ValidationError[] = []
  ): LinkValidationResult {
    const errors: ValidationError[] = [...historicalErrors.map(e => ({ ...e, isHistoricalJudgment: true }))];
    const chain: string[] = [];
    let currentId: string | undefined = contract.id;
    let isComplete = true;
    let hasCoverageGap = false;
    let coverageGapAmount: number | undefined;

    while (currentId) {
      const current = allContracts.find(c => c.id === currentId);
      if (!current) break;
      chain.unshift(current.id);

      if (current.status === 'rolled') {
        const rolloverApp = applications.find(a => a.originalContractId === current.id);
        if (!rolloverApp) {
          isComplete = false;
          errors.push(this.createError(
            'link',
            'error',
            current.contractNo,
            undefined,
            'rolloverApplication',
            undefined,
            '存在',
            formatValidationMessage(
              current.contractNo,
              '展期申请',
              '合约已标记为展期但未找到对应的展期申请',
              '展期申请单',
              '请补录展期申请材料，关联到原合约'
            ),
            '展期申请单',
            '请关联展期申请或修改合约状态',
            IMPACT_WEIGHTS.linkCompleteness
          ));
        } else if (!rolloverApp.newContractId) {
          isComplete = false;
          errors.push(this.createError(
            'link',
            'warning',
            current.contractNo,
            undefined,
            'newContractId',
            undefined,
            '存在',
            formatValidationMessage(
              current.contractNo,
              '新合约',
              '展期申请未关联新合约',
              rolloverApp.applicationMaterial,
              '请创建新合约并关联到展期申请'
            ),
            rolloverApp.applicationMaterial,
            '请创建并关联新合约',
            IMPACT_WEIGHTS.linkCompleteness * 0.5
          ));
        } else {
          const newContract = allContracts.find(c => c.id === rolloverApp.newContractId);
          if (newContract && newContract.notionalAmount < current.notionalAmount) {
            hasCoverageGap = true;
            coverageGapAmount = current.notionalAmount - newContract.notionalAmount;
            errors.push(this.createError(
              'link',
              'error',
              current.contractNo,
              undefined,
              'notionalAmount',
              newContract.notionalAmount,
              current.notionalAmount,
              formatValidationMessage(
                current.contractNo,
                '展期金额',
                `新合约金额(${newContract.notionalAmount.toLocaleString()})未完全覆盖原合约金额(${current.notionalAmount.toLocaleString()})，存在${coverageGapAmount.toLocaleString()}缺口`,
                rolloverApp.applicationMaterial,
                '请调整新合约金额以完全覆盖原合约，或说明缺口原因并人工确认'
              ),
              rolloverApp.applicationMaterial,
              '请调整新合约金额覆盖原合约',
              IMPACT_WEIGHTS.linkCoverage
            ));
          }

          if (newContract && current.currencyPair !== newContract.currencyPair) {
            errors.push(this.createError(
              'link',
              'error',
              current.contractNo,
              undefined,
              'currencyPair',
              newContract.currencyPair,
              current.currencyPair,
              formatValidationMessage(
                current.contractNo,
                '币种对',
                `展期后币种对(${newContract.currencyPair})与原合约(${current.currencyPair})不一致`,
                rolloverApp.applicationMaterial,
                '请核实币种对是否正确，如属特殊业务请人工确认'
              ),
              rolloverApp.applicationMaterial,
              '请确保展期前后币种对一致',
              IMPACT_WEIGHTS.linkCompleteness
            ));
          }

          if (newContract && !dayjs(newContract.valueDate).isSame(dayjs(current.valueDate), 'day')) {
            const daysDiff = dayjs(newContract.valueDate).diff(dayjs(current.valueDate), 'day');
            if (Math.abs(daysDiff) > 1) {
              errors.push(this.createError(
                'link',
                'warning',
                current.contractNo,
                undefined,
                'valueDate',
                dayjs(newContract.valueDate).format('YYYY-MM-DD'),
                dayjs(current.valueDate).format('YYYY-MM-DD'),
                formatValidationMessage(
                  current.contractNo,
                  '起息日',
                  `新合约起息日与原合约到期日相差${daysDiff}天，时间不连续`,
                  rolloverApp.applicationMaterial,
                  '请核实起息日是否正确，如属节假日顺延请说明'
                ),
                rolloverApp.applicationMaterial,
                '请调整新合约起息日与原合约到期日衔接',
                IMPACT_WEIGHTS.linkCoverage * 0.3
              ));
            }
          }
        }
        currentId = current.rolloverTo;
      } else {
        break;
      }
    }

    return {
      contractId: contract.id,
      isComplete,
      hasCoverageGap,
      coverageGapAmount,
      chain,
      errors,
    };
  }

  static validatePointsCalculation(
    application: RolloverApplication,
    originalContract: ForwardContract | undefined,
    newContract: ForwardContract | undefined,
    historicalErrors: ValidationError[] = []
  ): PointsValidationResult {
    const errors: ValidationError[] = [...historicalErrors.map(e => ({ ...e, isHistoricalJudgment: true }))];
    const calculationSteps: CalculationStep[] = [];
    let directionCorrect = true;
    let calculatedPoints = 0;
    let deviation = 0;

    if (application.spotRate === 0 || !application.hasSupplementalData) {
      errors.push(this.createError(
        'points',
        'warning',
        originalContract?.contractNo,
        undefined,
        'spotRate',
        application.spotRate,
        undefined,
        formatValidationMessage(
          originalContract?.contractNo || application.applicationNo,
          '即期汇率',
          '即期汇率尚未补录，点数计算暂不完整',
          application.applicationMaterial,
          '请补录即期汇率及相关证明材料'
        ),
        application.applicationMaterial,
        '请补录即期汇率',
        IMPACT_WEIGHTS.pointsAccuracy
      ));
    } else {
      const midMarketRate = this.getMidMarketRate(application.spotRate);
      const rateDiff = Math.abs(application.spotRate - midMarketRate) / midMarketRate;

      calculationSteps.push({
        stepNo: 1,
        description: '校验即期汇率合理性',
        formula: '|即期汇率 - 中间价| / 中间价 ≤ 2%',
        input: { spotRate: application.spotRate, midMarketRate },
        output: rateDiff,
        isError: rateDiff > SPOT_RATE_TOLERANCE,
        impact: IMPACT_WEIGHTS.pointsAccuracy * 0.3,
      });

      if (rateDiff > SPOT_RATE_TOLERANCE) {
        errors.push(this.createError(
          'points',
          'error',
          originalContract?.contractNo,
          undefined,
          'spotRate',
          application.spotRate,
          midMarketRate,
          formatValidationMessage(
            originalContract?.contractNo || application.applicationNo,
            '即期汇率',
            `即期汇率(${application.spotRate})偏离中间价(${midMarketRate.toFixed(4)})${(rateDiff * 100).toFixed(2)}%，超出±2%容差`,
            application.spotRateMaterial || '外汇牌价',
            '请核实时点汇率是否正确，如属特殊报价请提供说明'
          ),
          application.spotRateMaterial,
          '请核实并修正即期汇率',
          IMPACT_WEIGHTS.pointsAccuracy * 0.3
        ));
      }
    }

    if (application.spotRate > 0 && originalContract && newContract) {
      const theoreticalForwardRate = application.spotRate + application.swapPoints;

      calculationSteps.push({
        stepNo: 2,
        description: '计算理论远期汇率',
        formula: '远期汇率 = 即期汇率 + 掉期点数',
        input: { spotRate: application.spotRate, swapPoints: application.swapPoints },
        output: theoreticalForwardRate,
        isError: false,
        impact: IMPACT_WEIGHTS.pointsAccuracy * 0.2,
      });

      calculationSteps.push({
        stepNo: 3,
        description: '计算展期点数',
        formula: '展期点数 = 新远期汇率 - 原远期汇率',
        input: { newForwardRate: newContract.forwardRate, oldForwardRate: originalContract.forwardRate },
        output: newContract.forwardRate - originalContract.forwardRate,
        isError: false,
        impact: IMPACT_WEIGHTS.pointsAccuracy * 0.3,
      });

      calculatedPoints = newContract.forwardRate - originalContract.forwardRate;
      deviation = calculateDeviation(calculatedPoints, application.rolloverPoints);

      calculationSteps.push({
        stepNo: 4,
        description: '校验点数偏差',
        formula: '|计算点数 - 申报点数| ≤ 5bp',
        input: { calculatedPoints, actualPoints: application.rolloverPoints },
        output: deviation,
        isError: deviation > POINTS_DEVIATION_TOLERANCE,
        impact: IMPACT_WEIGHTS.pointsAccuracy * 0.2,
      });

      if (deviation > POINTS_DEVIATION_TOLERANCE) {
        errors.push(this.createError(
          'points',
          'error',
          originalContract.contractNo,
          undefined,
          'rolloverPoints',
          application.rolloverPoints,
          calculatedPoints,
          formatValidationMessage(
            originalContract.contractNo,
            '展期点数',
            `计算展期点数(${calculatedPoints.toFixed(4)})与申报点数(${application.rolloverPoints.toFixed(4)})偏差${deviation.toFixed(0)}bp，超出±5bp容差`,
            application.spotRateMaterial || '外汇牌价',
            '请核实展期点数计算是否正确'
          ),
          application.spotRateMaterial,
          '请核实并修正展期点数',
          IMPACT_WEIGHTS.pointsAccuracy
        ));
      }

      const [baseCurrency, quoteCurrency] = originalContract.currencyPair.split('/');
      const baseRate = INTEREST_RATES[baseCurrency] || 0.02;
      const quoteRate = INTEREST_RATES[quoteCurrency] || 0.02;
      const interestDiff = quoteRate - baseRate;
      const expectedDirection = interestDiff > 0 ? 'premium' : 'discount';

      calculationSteps.push({
        stepNo: 5,
        description: '校验点数方向合理性',
        formula: '根据利率平价：高利率货币远期贴水，低利率货币远期升水',
        input: { baseCurrency, quoteCurrency, baseRate, quoteRate, interestDiff, actualDirection: application.pointsDirection },
        output: expectedDirection === application.pointsDirection ? 1 : 0,
        isError: expectedDirection !== application.pointsDirection,
        impact: IMPACT_WEIGHTS.pointsDirection,
      });

      if (expectedDirection !== application.pointsDirection) {
        directionCorrect = false;
        errors.push(this.createError(
          'points',
          'error',
          originalContract.contractNo,
          undefined,
          'pointsDirection',
          application.pointsDirection,
          expectedDirection,
          formatValidationMessage(
            originalContract.contractNo,
            '点数方向',
            `根据利率平价，${baseCurrency}利率(${baseRate * 100}%) ${interestDiff > 0 ? '低于' : '高于'} ${quoteCurrency}利率(${quoteRate * 100}%)，远期应${expectedDirection === 'premium' ? '升水' : '贴水'}，但申报为${application.pointsDirection === 'premium' ? '升水' : '贴水'}`,
            application.applicationMaterial,
            '请核实点数方向是否正确，如属市场特殊情况请提供说明'
          ),
          application.applicationMaterial,
          '请核实并修正点数方向',
          IMPACT_WEIGHTS.pointsDirection
        ));
      }
    }

    return {
      applicationId: application.id,
      calculationSteps,
      directionCorrect,
      calculatedPoints,
      actualPoints: application.rolloverPoints,
      deviation,
      errors,
    };
  }

  static validatePaymentMatching(
    payment: PaymentRecord,
    contracts: ForwardContract[],
    historicalErrors: ValidationError[] = []
  ): MatchValidationResult {
    const errors: ValidationError[] = [...historicalErrors.map(e => ({ ...e, isHistoricalJudgment: true }))];
    const matchedContractCount = payment.matchedContractIds.length;
    let isDuplicate = matchedContractCount > 1;

    if (isDuplicate) {
      const contractNos = payment.matchedContractIds
        .map(id => contracts.find(c => c.id === id)?.contractNo)
        .filter(Boolean)
        .join('、');
      errors.push(this.createError(
        'match',
        'error',
        undefined,
        payment.voucherNo,
        'matchedContractIds',
        payment.matchedContractIds,
        [payment.matchedContractIds[0]],
        formatValidationMessage(
          contractNos || '多份合约',
          '收付匹配',
          `收付凭证${payment.voucherNo}被多次匹配到合约：${contractNos}`,
          payment.materialRef,
          '请核实匹配关系，确保每份收付凭证只对应一个合约'
        ),
        payment.materialRef,
        '请修正匹配关系，确保一一对应',
        IMPACT_WEIGHTS.matchUniqueness
      ));
    }

    if (payment.contractId) {
      const matchedContract = contracts.find(c => c.id === payment.contractId);
      if (matchedContract) {
        const expectedAmount = matchedContract.notionalAmount * matchedContract.forwardRate;
        const amountDiff = Math.abs(payment.amount - expectedAmount) / expectedAmount;

        if (amountDiff > AMOUNT_MATCH_TOLERANCE) {
          errors.push(this.createError(
            'match',
            'warning',
            matchedContract.contractNo,
            payment.voucherNo,
            'amount',
            payment.amount,
            expectedAmount,
            formatValidationMessage(
              matchedContract.contractNo,
              '收付金额',
              `收付金额(${payment.amount.toLocaleString()})与合约结算金额(${expectedAmount.toLocaleString()})偏差${(amountDiff * 100).toFixed(2)}%，超出±0.5%容差`,
              payment.materialRef,
              '请核实收付金额是否正确，如属手续费等扣款请说明'
            ),
            payment.materialRef,
            '请核实收付金额或调整匹配关系',
            IMPACT_WEIGHTS.matchAmount
          ));
        }

        const daysDiff = dayjs(payment.paymentDate).diff(dayjs(matchedContract.valueDate), 'day');
        if (Math.abs(daysDiff) > PAYMENT_DATE_TOLERANCE_DAYS) {
          errors.push(this.createError(
            'match',
            'warning',
            matchedContract.contractNo,
            payment.voucherNo,
            'paymentDate',
            dayjs(payment.paymentDate).format('YYYY-MM-DD'),
            dayjs(matchedContract.valueDate).format('YYYY-MM-DD'),
            formatValidationMessage(
              matchedContract.contractNo,
              '收付日期',
              `收付日期(${dayjs(payment.paymentDate).format('YYYY-MM-DD')})与合约到期日(${dayjs(matchedContract.valueDate).format('YYYY-MM-DD')})相差${Math.abs(daysDiff)}天，超出±3天容差`,
              payment.materialRef,
              '请核实收付日期是否正确，如属特殊情况请说明'
            ),
            payment.materialRef,
            '请核实收付日期或调整匹配关系',
            IMPACT_WEIGHTS.matchAmount * 0.5
          ));
        }
      }
    } else if (payment.matchedStatus === 'unmatched' && payment.paymentType === 'settlement') {
      errors.push(this.createError(
        'match',
        'info',
        undefined,
        payment.voucherNo,
        'contractId',
        undefined,
        '待匹配',
        formatValidationMessage(
          '待匹配',
          '合约关联',
          `收付凭证${payment.voucherNo}尚未关联到任何合约`,
          payment.materialRef,
          '请匹配对应的远期合约'
        ),
        payment.materialRef,
        '请匹配对应的合约',
        IMPACT_WEIGHTS.matchUniqueness * 0.3
      ));
    }

    return {
      paymentId: payment.id,
      isDuplicate,
      matchedContractCount,
      errors,
    };
  }

  private static getMidMarketRate(actualRate: number): number {
    return actualRate * 1.0005;
  }

  private static createError(
    type: 'link' | 'points' | 'match',
    severity: 'error' | 'warning' | 'info',
    contractNo: string | undefined,
    voucherNo: string | undefined,
    fieldName: string,
    fieldValue: any,
    expectedValue: any,
    errorMessage: string,
    relatedMaterial: string | undefined,
    suggestion: string,
    impactOnResult: number
  ): ValidationError {
    return {
      id: generateId(),
      type,
      severity,
      contractNo,
      voucherNo,
      fieldName,
      fieldValue,
      expectedValue,
      errorMessage,
      relatedMaterial,
      suggestion,
      impactOnResult,
      isHistoricalJudgment: false,
      timestamp: new Date(),
    };
  }

  static runIncrementalValidation(
    newData: {
      contracts?: ForwardContract[];
      applications?: RolloverApplication[];
      payments?: PaymentRecord[];
    },
    existingResults: {
      linkResults: LinkValidationResult[];
      pointsResults: PointsValidationResult[];
      matchResults: MatchValidationResult[];
    }
  ): {
    linkResults: LinkValidationResult[];
    pointsResults: PointsValidationResult[];
    matchResults: MatchValidationResult[];
  } {
    const { contracts = [], applications = [], payments = [] } = newData;
    const { linkResults, pointsResults, matchResults } = existingResults;

    const newLinkResults = [...linkResults];
    for (const contract of contracts) {
      const existing = linkResults.find(r => r.contractId === contract.id);
      const historicalErrors = existing?.errors || [];
      const newResult = this.validateContractLink(
        contract,
        [...contracts, ...(existing ? [] : [])],
        applications,
        historicalErrors
      );
      const idx = newLinkResults.findIndex(r => r.contractId === contract.id);
      if (idx >= 0) {
        newLinkResults[idx] = newResult;
      } else {
        newLinkResults.push(newResult);
      }
    }

    const newPointsResults = [...pointsResults];
    for (const app of applications) {
      const existing = pointsResults.find(r => r.applicationId === app.id);
      const historicalErrors = existing?.errors || [];
      const newResult = this.validatePointsCalculation(
        app,
        undefined,
        undefined,
        historicalErrors
      );
      const idx = newPointsResults.findIndex(r => r.applicationId === app.id);
      if (idx >= 0) {
        newPointsResults[idx] = newResult;
      } else {
        newPointsResults.push(newResult);
      }
    }

    const newMatchResults = [...matchResults];
    for (const payment of payments) {
      const existing = matchResults.find(r => r.paymentId === payment.id);
      const historicalErrors = existing?.errors || [];
      const newResult = this.validatePaymentMatching(
        payment,
        contracts,
        historicalErrors
      );
      const idx = newMatchResults.findIndex(r => r.paymentId === payment.id);
      if (idx >= 0) {
        newMatchResults[idx] = newResult;
      } else {
        newMatchResults.push(newResult);
      }
    }

    return {
      linkResults: newLinkResults,
      pointsResults: newPointsResults,
      matchResults: newMatchResults,
    };
  }
}
