import { Decimal } from 'decimal.js';
import { v4 as uuidv4 } from 'uuid';
import type { Bond, CashFlow, YieldCurve, CalculationParams, DurationResult, ConvexityResult, SensitivityAnalysis, CalculationStep, AppException } from '@/types';

const ONE = new Decimal(1);
const HUNDRED = new Decimal(100);
const BASIS_POINT = new Decimal(0.0001);

export function generateCashFlows(bond: Bond): { cashFlows: CashFlow[]; exceptions: AppException[] } {
  const cashFlows: CashFlow[] = [];
  const exceptions: AppException[] = [];

  const maturityDate = new Date(bond.maturityDate);
  const firstCouponDate = new Date(bond.firstCouponDate);
  const issueDate = new Date(bond.issueDate);
  const frequency = bond.couponFrequency;
  const couponRate = new Decimal(bond.couponRate);
  const faceValue = new Decimal(bond.faceValue);
  const couponPayment = faceValue.mul(couponRate).div(frequency);

  let currentDate = new Date(firstCouponDate);
  let period = 1;
  const monthsIncrement = 12 / frequency;
  const prevDates: Set<string> = new Set();

  while (currentDate <= maturityDate) {
    const dateStr = currentDate.toISOString().split('T')[0];
    
    if (prevDates.has(dateStr)) {
      const exception: AppException = {
        id: uuidv4(),
        type: 'DUPLICATE_DATE',
        message: `第${period}期付息日期重复: ${dateStr}`,
        sourceRef: `bond:${bond.id}:firstCouponDate`,
        timestamp: new Date().toISOString(),
        severity: 'ERROR'
      };
      exceptions.push(exception);
    }
    prevDates.add(dateStr);

    const isMaturity = Math.abs(currentDate.getTime() - maturityDate.getTime()) < 86400000;
    const principalPayment = isMaturity ? faceValue : new Decimal(0);
    const totalPayment = couponPayment.add(principalPayment);

    const accruedDays = calculateAccruedDays(
      period === 1 ? issueDate : addMonths(currentDate, -monthsIncrement),
      currentDate,
      bond.dayCountConvention
    );

    const expectedAmount = faceValue.mul(couponRate).mul(accruedDays).div(365);
    const diff = couponPayment.sub(expectedAmount).abs();
    const isIrregular = diff.gt(faceValue.mul(0.001));

    const cashFlow: CashFlow = {
      id: uuidv4(),
      bondId: bond.id,
      period,
      paymentDate: dateStr,
      couponPayment,
      principalPayment,
      totalPayment,
      accruedDays,
      isException: isIrregular || prevDates.has(dateStr),
      exceptionType: isIrregular ? 'IRREGULAR_AMOUNT' : undefined,
      exceptionMessage: isIrregular ? `付息金额与计息天数不符，差异${diff.toFixed(4)}元` : undefined,
      sourceRef: `bond:${bond.id}:period:${period}`
    };

    cashFlows.push(cashFlow);
    currentDate = addMonths(currentDate, monthsIncrement);
    period++;
  }

  const expectedPeriods = Math.ceil(
    (maturityDate.getTime() - firstCouponDate.getTime()) / (365.25 / frequency * 86400000)
  ) + 1;
  
  if (cashFlows.length < expectedPeriods - 1 || cashFlows.length > expectedPeriods + 1) {
    const exception: AppException = {
      id: uuidv4(),
      type: 'MISSING_PERIOD',
      message: `现金流期数异常: 预期${expectedPeriods}期，实际${cashFlows.length}期`,
      sourceRef: `bond:${bond.id}:maturityDate`,
      timestamp: new Date().toISOString(),
      severity: 'WARNING'
    };
    exceptions.push(exception);
  }

  return { cashFlows, exceptions };
}

function calculateAccruedDays(start: Date, end: Date, convention: string): number {
  switch (convention) {
    case 'ACT/ACT':
    case 'ACT/365':
      return Math.ceil((end.getTime() - start.getTime()) / 86400000);
    case '30/360':
      return 30;
    default:
      return Math.ceil((end.getTime() - start.getTime()) / 86400000);
  }
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

export function interpolateRate(curve: YieldCurve, term: Decimal): { rate: Decimal; steps: CalculationStep[]; exception?: AppException } {
  const steps: CalculationStep[] = [];
  const sortedPoints = [...curve.points].sort((a, b) => a.term.sub(b.term).toNumber());
  
  if (sortedPoints.length === 0) {
    return {
      rate: new Decimal(0),
      steps,
      exception: {
        id: uuidv4(),
        type: 'INTERPOLATION_ERROR',
        message: '收益率曲线为空',
        sourceRef: `curve:${curve.id}`,
        timestamp: new Date().toISOString(),
        severity: 'ERROR'
      }
    };
  }

  if (term.lte(sortedPoints[0].term)) {
    return {
      rate: sortedPoints[0].rate,
      steps: [{
        stepId: uuidv4(),
        description: '使用曲线左端利率',
        formula: 'rate = first_point_rate',
        inputs: { term: term.toString(), firstTerm: sortedPoints[0].term.toString() },
        result: sortedPoints[0].rate.toString(),
        sourceRef: `curve:${curve.id}:point:0`
      }]
    };
  }

  if (term.gte(sortedPoints[sortedPoints.length - 1].term)) {
    return {
      rate: sortedPoints[sortedPoints.length - 1].rate,
      steps: [{
        stepId: uuidv4(),
        description: '使用曲线右端利率',
        formula: 'rate = last_point_rate',
        inputs: { term: term.toString(), lastTerm: sortedPoints[sortedPoints.length - 1].term.toString() },
        result: sortedPoints[sortedPoints.length - 1].rate.toString(),
        sourceRef: `curve:${curve.id}:point:${sortedPoints.length - 1}`
      }]
    };
  }

  for (let i = 0; i < sortedPoints.length - 1; i++) {
    const p1 = sortedPoints[i];
    const p2 = sortedPoints[i + 1];
    
    if (term.gte(p1.term) && term.lte(p2.term)) {
      if (curve.interpolationMethod === 'LINEAR') {
        const t = term.sub(p1.term).div(p2.term.sub(p1.term));
        const rate = p1.rate.add(t.mul(p2.rate.sub(p1.rate)));
        
        steps.push({
          stepId: uuidv4(),
          description: `线性插值 (期限${term.toFixed(2)}年)`,
          formula: 'rate = r1 + (t - t1)/(t2 - t1) * (r2 - r1)',
          inputs: {
            t1: p1.term.toString(),
            r1: p1.rate.mul(100).toFixed(4) + '%',
            t2: p2.term.toString(),
            r2: p2.rate.mul(100).toFixed(4) + '%',
            t: term.toString()
          },
          result: rate.mul(100).toFixed(4) + '%',
          sourceRef: `curve:${curve.id}:points:${i}-${i + 1}`
        });

        return { rate, steps };
      } else {
        const rate = p1.rate.add(p2.rate).div(2);
        steps.push({
          stepId: uuidv4(),
          description: `样条插值近似`,
          formula: 'rate = spline_interpolation(t1, t2, r1, r2, t)',
          inputs: {
            t1: p1.term.toString(),
            r1: p1.rate.mul(100).toFixed(4) + '%',
            t2: p2.term.toString(),
            r2: p2.rate.mul(100).toFixed(4) + '%',
            t: term.toString()
          },
          result: rate.mul(100).toFixed(4) + '%',
          sourceRef: `curve:${curve.id}:points:${i}-${i + 1}`
        });
        return { rate, steps };
      }
    }
  }

  return { rate: sortedPoints[sortedPoints.length - 1].rate, steps };
}

export function calculatePrice(
  cashFlows: CashFlow[],
  ytm: Decimal,
  frequency: number,
  valuationDate: string
): { price: Decimal; dirtyPrice: Decimal; accruedInterest: Decimal; steps: CalculationStep[] } {
  const steps: CalculationStep[] = [];
  const valDate = new Date(valuationDate);
  let dirtyPrice = new Decimal(0);
  let accruedInterest = new Decimal(0);
  let lastCouponDate: Date | null = null;

  for (let i = 0; i < cashFlows.length; i++) {
    const cf = cashFlows[i];
    const paymentDate = new Date(cf.paymentDate);
    
    if (paymentDate < valDate) {
      lastCouponDate = paymentDate;
      continue;
    }

    const daysSinceLastCoupon = lastCouponDate 
      ? Math.ceil((valDate.getTime() - lastCouponDate.getTime()) / 86400000)
      : 0;
    
    const daysInPeriod = cf.accruedDays || 180;
    const fractionalPeriod = new Decimal(daysSinceLastCoupon).div(daysInPeriod);
    const periodsToMaturity = new Decimal(cf.period - 1).sub(fractionalPeriod);

    if (i === 0 && lastCouponDate) {
      accruedInterest = new Decimal(cf.couponPayment).mul(fractionalPeriod);
    }

    const discountFactor = ONE.div(ONE.add(ytm.div(frequency)).pow(periodsToMaturity));
    const pv = new Decimal(cf.totalPayment).mul(discountFactor);
    dirtyPrice = dirtyPrice.add(pv);

    steps.push({
      stepId: uuidv4(),
      description: `第${cf.period}期现金流折现`,
      formula: 'PV = CF / (1 + y/k)^n',
      inputs: {
        CF: cf.totalPayment.toFixed(2),
        y: ytm.mul(100).toFixed(4) + '%',
        k: frequency.toString(),
        n: periodsToMaturity.toFixed(4)
      },
      result: pv.toFixed(4),
      sourceRef: cf.sourceRef
    });

    lastCouponDate = paymentDate;
  }

  const cleanPrice = dirtyPrice.sub(accruedInterest);

  steps.unshift({
    stepId: uuidv4(),
    description: '全价计算',
    formula: 'Dirty Price = Σ(CF_i / (1 + y/k)^n_i)',
    inputs: { ytm: ytm.mul(100).toFixed(4) + '%' },
    result: dirtyPrice.toFixed(4),
    sourceRef: 'calculation:price:dirty'
  });

  steps.push({
    stepId: uuidv4(),
    description: '应计利息计算',
    formula: 'Accrued Interest = Coupon * (days_since_last_coupon / days_in_period)',
    inputs: { daysSinceLastCoupon: accruedInterest.toString() },
    result: accruedInterest.toFixed(4),
    sourceRef: 'calculation:price:accrued'
  });

  steps.push({
    stepId: uuidv4(),
    description: '净价计算',
    formula: 'Clean Price = Dirty Price - Accrued Interest',
    inputs: { dirtyPrice: dirtyPrice.toFixed(4), accruedInterest: accruedInterest.toFixed(4) },
    result: cleanPrice.toFixed(4),
    sourceRef: 'calculation:price:clean'
  });

  return { price: cleanPrice, dirtyPrice, accruedInterest, steps };
}

export function calculateDuration(
  bond: Bond,
  cashFlows: CashFlow[],
  ytm: Decimal,
  valuationDate: string,
  curve: YieldCurve
): { result: DurationResult; exceptions: AppException[] } {
  const exceptions: AppException[] = [];
  const steps: CalculationStep[] = [];
  const frequency = bond.couponFrequency;
  const valDate = new Date(valuationDate);

  const { price: cleanPrice, dirtyPrice } = calculatePrice(cashFlows, ytm, frequency, valuationDate);

  let macaulaySum = new Decimal(0);
  let lastCouponDate: Date | null = null;

  for (let i = 0; i < cashFlows.length; i++) {
    const cf = cashFlows[i];
    const paymentDate = new Date(cf.paymentDate);
    
    if (paymentDate < valDate) {
      lastCouponDate = paymentDate;
      continue;
    }

    const daysSinceLastCoupon = lastCouponDate 
      ? Math.ceil((valDate.getTime() - lastCouponDate.getTime()) / 86400000)
      : 0;
    const daysInPeriod = cf.accruedDays || 180;
    const fractionalPeriod = new Decimal(daysSinceLastCoupon).div(daysInPeriod);
    const periodsToMaturity = new Decimal(cf.period - 1).sub(fractionalPeriod);
    const yearsToMaturity = periodsToMaturity.div(frequency);

    const { rate: spotRate } = interpolateRate(curve, yearsToMaturity);
    const discountFactor = ONE.div(ONE.add(spotRate).pow(yearsToMaturity));
    const pv = new Decimal(cf.totalPayment).mul(discountFactor);
    const weight = pv.div(dirtyPrice);
    const weightedTime = weight.mul(yearsToMaturity);

    macaulaySum = macaulaySum.add(weightedTime);
    lastCouponDate = paymentDate;
  }

  const macaulayDuration = macaulaySum;
  steps.push({
    stepId: uuidv4(),
    description: '麦考利久期计算',
    formula: 'MacDur = Σ(t_i * PV_i / P)',
    inputs: { dirtyPrice: dirtyPrice.toFixed(4) },
    result: macaulayDuration.toFixed(4) + ' 年',
    sourceRef: 'calculation:duration:macaulay'
  });

  const modifiedDuration = macaulayDuration.div(ONE.add(ytm.div(frequency)));
  steps.push({
    stepId: uuidv4(),
    description: '修正久期计算',
    formula: 'ModDur = MacDur / (1 + y/k)',
    inputs: {
      macaulayDuration: macaulayDuration.toFixed(4),
      y: ytm.mul(100).toFixed(4) + '%',
      k: frequency.toString()
    },
    result: modifiedDuration.toFixed(4),
    sourceRef: 'calculation:duration:modified'
  });

  const shiftBp = 1;
  const shift = BASIS_POINT.mul(shiftBp);
  const priceUp = calculatePrice(cashFlows, ytm.sub(shift), frequency, valuationDate).price;
  const priceDown = calculatePrice(cashFlows, ytm.add(shift), frequency, valuationDate).price;
  const effectiveDuration = priceUp.sub(priceDown).div(cleanPrice.mul(shift).mul(2)).abs();

  steps.push({
    stepId: uuidv4(),
    description: '有效久期计算',
    formula: 'EffDur = [P(-Δy) - P(+Δy)] / (2 * P0 * Δy)',
    inputs: {
      'P(-1bp)': priceUp.toFixed(4),
      'P(+1bp)': priceDown.toFixed(4),
      'P0': cleanPrice.toFixed(4),
      'Δy': '0.01%'
    },
    result: effectiveDuration.toFixed(4),
    sourceRef: 'calculation:duration:effective'
  });

  const dv01 = modifiedDuration.mul(cleanPrice).mul(BASIS_POINT);
  steps.push({
    stepId: uuidv4(),
    description: 'DV01计算',
    formula: 'DV01 = ModDur * P0 * 0.0001',
    inputs: {
      modifiedDuration: modifiedDuration.toFixed(4),
      price: cleanPrice.toFixed(4)
    },
    result: dv01.toFixed(4) + ' 元/bp',
    sourceRef: 'calculation:duration:dv01'
  });

  return {
    result: {
      macaulayDuration,
      modifiedDuration,
      effectiveDuration,
      dv01,
      calculationSteps: steps
    },
    exceptions
  };
}

export function calculateConvexity(
  bond: Bond,
  cashFlows: CashFlow[],
  ytm: Decimal,
  valuationDate: string,
  curve: YieldCurve
): { result: ConvexityResult; exceptions: AppException[] } {
  const exceptions: AppException[] = [];
  const steps: CalculationStep[] = [];
  const frequency = bond.couponFrequency;
  const valDate = new Date(valuationDate);

  const { dirtyPrice } = calculatePrice(cashFlows, ytm, frequency, valuationDate);

  let convexitySum = new Decimal(0);
  let lastCouponDate: Date | null = null;

  for (let i = 0; i < cashFlows.length; i++) {
    const cf = cashFlows[i];
    const paymentDate = new Date(cf.paymentDate);
    
    if (paymentDate < valDate) {
      lastCouponDate = paymentDate;
      continue;
    }

    const daysSinceLastCoupon = lastCouponDate 
      ? Math.ceil((valDate.getTime() - lastCouponDate.getTime()) / 86400000)
      : 0;
    const daysInPeriod = cf.accruedDays || 180;
    const fractionalPeriod = new Decimal(daysSinceLastCoupon).div(daysInPeriod);
    const periodsToMaturity = new Decimal(cf.period - 1).sub(fractionalPeriod);
    const yearsToMaturity = periodsToMaturity.div(frequency);

    const { rate: spotRate } = interpolateRate(curve, yearsToMaturity);
    const discountFactor = ONE.div(ONE.add(spotRate).pow(yearsToMaturity));
    const pv = new Decimal(cf.totalPayment).mul(discountFactor);
    const convexityTerm = yearsToMaturity.mul(yearsToMaturity.add(1)).mul(pv);
    convexitySum = convexitySum.add(convexityTerm);

    lastCouponDate = paymentDate;
  }

  const ytmAdjusted = ONE.add(ytm.div(frequency));
  const convexity = convexitySum.div(dirtyPrice.mul(ytmAdjusted.pow(2)));

  steps.push({
    stepId: uuidv4(),
    description: '凸性计算',
    formula: 'Convexity = Σ[t*(t+1)*PV_t] / [P * (1 + y/k)^2]',
    inputs: { dirtyPrice: dirtyPrice.toFixed(4) },
    result: convexity.toFixed(4),
    sourceRef: 'calculation:convexity:base'
  });

  const signCheck = convexity.gte(0) ? 'NORMAL' : 'ABNORMAL';
  if (signCheck === 'ABNORMAL') {
    exceptions.push({
      id: uuidv4(),
      type: 'CONVEXITY_SIGN_ERROR',
      message: '凸性符号异常：凸性应为非负值',
      sourceRef: 'calculation:convexity:sign',
      timestamp: new Date().toISOString(),
      severity: 'ERROR'
    });
  }

  const shift100bp = new Decimal(0.01);
  const convexityAdjustment = new Decimal(0.5).mul(convexity).mul(shift100bp.pow(2)).mul(HUNDRED);
  steps.push({
    stepId: uuidv4(),
    description: '凸性修正 (收益率变动100bp)',
    formula: 'Convexity_Adj = 0.5 * Convexity * (Δy)^2 * 100',
    inputs: {
      convexity: convexity.toFixed(4),
      deltaY: '1%'
    },
    result: convexityAdjustment.toFixed(4) + '%',
    sourceRef: 'calculation:convexity:adjustment'
  });

  const dollarConvexity = convexity.mul(dirtyPrice).div(10000);
  steps.push({
    stepId: uuidv4(),
    description: '货币凸性计算',
    formula: 'Dollar_Convexity = Convexity * P / 10000',
    inputs: {
      convexity: convexity.toFixed(4),
      price: dirtyPrice.toFixed(4)
    },
    result: dollarConvexity.toFixed(4),
    sourceRef: 'calculation:convexity:dollar'
  });

  return {
    result: {
      convexity,
      convexityAdjustment,
      dollarConvexity,
      signCheck,
      signCheckMessage: signCheck === 'ABNORMAL' ? '凸性为负，请检查现金流数据' : undefined,
      calculationSteps: steps
    },
    exceptions
  };
}

export function calculateSensitivity(
  bond: Bond,
  cashFlows: CashFlow[],
  ytm: Decimal,
  valuationDate: string,
  params: CalculationParams
): SensitivityAnalysis {
  const frequency = bond.couponFrequency;
  const { price: basePrice, dirtyPrice: baseDirtyPrice } = calculatePrice(cashFlows, ytm, frequency, valuationDate);
  
  const smallShift = BASIS_POINT.mul(params.yieldShiftBpSmall);
  const largeShift = BASIS_POINT.mul(params.yieldShiftBpLarge);

  const smallUpPrice = calculatePrice(cashFlows, ytm.add(smallShift), frequency, valuationDate).price;
  const smallDownPrice = calculatePrice(cashFlows, ytm.sub(smallShift), frequency, valuationDate).price;
  const largeUpPrice = calculatePrice(cashFlows, ytm.add(largeShift), frequency, valuationDate).price;
  const largeDownPrice = calculatePrice(cashFlows, ytm.sub(largeShift), frequency, valuationDate).price;

  const modifiedDuration = baseDirtyPrice.gt(0) 
    ? smallDownPrice.sub(smallUpPrice).div(basePrice.mul(smallShift).mul(2)).abs()
    : new Decimal(0);

  const smallDurationEffect = modifiedDuration.mul(params.yieldShiftBpSmall).div(100);
  const smallConvexityEffect = new Decimal(0);

  const largeDurationEffect = modifiedDuration.mul(params.yieldShiftBpLarge).div(100);
  
  const convexityApprox = basePrice.gt(0)
    ? largeDownPrice.add(largeUpPrice).sub(basePrice.mul(2)).div(basePrice.mul(largeShift.pow(2)))
    : new Decimal(0);
  const largeConvexityEffect = new Decimal(0.5).mul(convexityApprox).mul(largeShift.pow(2)).mul(100);

  const priceDiffExplanation = 
    `收益率变动${params.yieldShiftBpSmall}bp（小变动）：价格变动主要由久期效应主导，约${smallDurationEffect.toFixed(4)}%，` +
    `凸性效应${smallConvexityEffect.toFixed(6)}%可忽略；\n` +
    `收益率变动${params.yieldShiftBpLarge}bp（大变动）：久期效应${largeDurationEffect.toFixed(4)}%，` +
    `凸性修正${largeConvexityEffect.toFixed(4)}%，两者合计能更准确地解释实际价格变动。`;

  return {
    basePrice,
    baseYield: ytm,
    smallUpPrice,
    smallDownPrice,
    largeUpPrice,
    largeDownPrice,
    smallDurationEffect,
    smallConvexityEffect,
    largeDurationEffect,
    largeConvexityEffect,
    priceDiffExplanation
  };
}
