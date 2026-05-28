const MockData = {
  accounts: [
    { accountId: 'A001', accountName: '张三', custodian: '中国结算上海', idType: '身份证', idNumber: '310***1234' },
    { accountId: 'A002', accountName: '李四', custodian: '中国结算深圳', idType: '身份证', idNumber: '440***5678' },
    { accountId: 'A001-SZ', accountName: '张三', custodian: '中国结算深圳', idType: '身份证', idNumber: '310***1234' }
  ],

  trades: [
    { row: 1, tradeId: 'T001', accountId: 'A001', stockCode: '600000', stockName: '浦发银行', tradeType: 'buy', tradeDate: '2024-03-15', shares: 2000, price: 7.50, custodian: '中国结算上海' },
    { row: 2, tradeId: 'T002', accountId: 'A001', stockCode: '600000', stockName: '浦发银行', tradeType: 'buy', tradeDate: '2024-08-20', shares: 1000, price: 7.80, custodian: '中国结算上海' },
    { row: 3, tradeId: 'T003', accountId: 'A001', stockCode: '600000', stockName: '浦发银行', tradeType: 'sell', tradeDate: '2025-07-10', shares: 1500, price: 8.20, custodian: '中国结算上海' },
    { row: 4, tradeId: 'T004', accountId: 'A001-SZ', stockCode: '600000', stockName: '浦发银行', tradeType: 'buy', tradeDate: '2024-05-10', shares: 1500, price: 7.60, custodian: '中国结算深圳' },
    { row: 5, tradeId: 'T005', accountId: 'A002', stockCode: '000001', stockName: '平安银行', tradeType: 'buy', tradeDate: '2024-01-10', shares: 5000, price: 11.20, custodian: '中国结算深圳' },
    { row: 6, tradeId: 'T006', accountId: 'A002', stockCode: '000001', stockName: '平安银行', tradeType: 'sell', tradeDate: '2025-02-15', shares: 3000, price: 12.50, custodian: '中国结算深圳' },
    { row: 7, tradeId: 'T007', accountId: 'A002', stockCode: '000001', stockName: '平安银行', tradeType: 'buy', tradeDate: '2025-06-01', shares: 2000, price: 11.80, custodian: '中国结算深圳' },
    { row: 8, tradeId: 'T008', accountId: 'A001', stockCode: '601398', stockName: '工商银行', tradeType: 'buy', tradeDate: '2023-06-01', shares: 10000, price: 5.10, custodian: '中国结算上海' },
    { row: 9, tradeId: 'T009', accountId: 'A001', stockCode: '601398', stockName: '工商银行', tradeType: 'sell', tradeDate: '2025-08-01', shares: 10000, price: 5.60, custodian: '中国结算上海' },
    { row: 10, tradeId: 'T010', accountId: 'A002', stockCode: '600000', stockName: '浦发银行', tradeType: 'buy', tradeDate: '2025-06-10', shares: 3000, price: 8.00, custodian: '中国结算深圳' }
  ],

  dividends: [
    { row: 1, dividendId: 'D001', accountId: 'A001', stockCode: '600000', stockName: '浦发银行', exDate: '2025-06-20', payDate: '2025-07-15', dividendPerShare: 0.35, totalShares: 4500 },
    { row: 2, dividendId: 'D002', accountId: 'A002', stockCode: '000001', stockName: '平安银行', exDate: '2025-07-20', payDate: '2025-08-10', dividendPerShare: 0.25, totalShares: 4000 },
    { row: 3, dividendId: 'D003', accountId: 'A001', stockCode: '601398', stockName: '工商银行', exDate: '2025-07-10', payDate: '2025-08-05', dividendPerShare: 0.3064, totalShares: 10000 }
  ],

  deductions: [
    { row: 1, deductionId: 'DD001', accountId: 'A001', stockCode: '600000', deductionDate: '2025-07-15', amount: 157.50, withheldRate: 0.10, source: '系统预扣', status: 'completed' },
    { row: 2, deductionId: 'DD002', accountId: 'A001-SZ', stockCode: '600000', deductionDate: '2025-07-15', amount: 105.00, withheldRate: 0.20, source: '系统预扣', status: 'completed' },
    { row: 3, deductionId: 'DD003', accountId: 'A002', stockCode: '000001', deductionDate: '2025-08-10', amount: 250.00, withheldRate: 0.10, source: '系统预扣', status: 'completed' },
    { row: 4, deductionId: 'DD004', accountId: 'A002', stockCode: '000001', deductionDate: '2025-08-10', amount: 250.00, withheldRate: 0.10, source: '补扣流水', status: 'completed' },
    { row: 5, deductionId: 'DD005', accountId: 'A001', stockCode: '601398', deductionDate: '2025-08-05', amount: 306.40, withheldRate: 0.10, source: '系统预扣', status: 'completed' },
    { row: 6, deductionId: 'DD006', accountId: 'A002', stockCode: '600000', deductionDate: '2025-07-15', amount: 210.00, withheldRate: 0.20, source: '系统预扣', status: 'completed' }
  ],

  badData: [
    { row: 99, type: '买入记录', raw: 'T_ERR1,A001,600000,浦发银行,buy,2024-13-45,1000,7.50,中国结算上海', error: '日期格式无效: 2024-13-45', source: '买入流水第99行' },
    { row: 100, type: '分红记录', raw: 'D_ERR1,,600000,浦发银行,2025-06-20,2025-07-15,0.35,4500', error: '缺少dividendId字段', source: '分红流水第100行' }
  ]
};

const TAX_TIERS = [
  { maxDays: 30, rate: 0.20, label: '≤1个月', labelEn: '≤1M' },
  { maxDays: 365, rate: 0.10, label: '1个月~1年', labelEn: '1M~1Y' },
  { maxDays: Infinity, rate: 0, label: '>1年', labelEn: '>1Y' }
];

function getTaxRate(holdingDays) {
  if (holdingDays <= 30) return { rate: 0.20, tier: TAX_TIERS[0] };
  if (holdingDays <= 365) return { rate: 0.10, tier: TAX_TIERS[1] };
  return { rate: 0, tier: TAX_TIERS[2] };
}

function daysBetween(dateStr1, dateStr2) {
  const d1 = new Date(dateStr1);
  const d2 = new Date(dateStr2);
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return null;
  return Math.floor((d2 - d1) / (1000 * 60 * 60 * 24));
}

function isValidDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return false;
  const d = new Date(dateStr);
  return !isNaN(d.getTime());
}

function formatMoney(amount) {
  return '¥' + amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

const DataValidator = {
  validateTrades(trades) {
    const errors = [];
    trades.forEach((t, idx) => {
      const rowNum = t.row || (idx + 1);
      const src = `买入流水第${rowNum}行`;
      if (!t.tradeId) errors.push({ row: rowNum, source: src, field: 'tradeId', error: '缺少交易编号', raw: JSON.stringify(t) });
      if (!t.accountId) errors.push({ row: rowNum, source: src, field: 'accountId', error: '缺少账户编号', raw: JSON.stringify(t) });
      if (!t.stockCode) errors.push({ row: rowNum, source: src, field: 'stockCode', error: '缺少证券代码', raw: JSON.stringify(t) });
      if (!isValidDate(t.tradeDate)) errors.push({ row: rowNum, source: src, field: 'tradeDate', error: `日期格式无效: ${t.tradeDate}`, raw: JSON.stringify(t) });
      if (!t.shares || t.shares <= 0) errors.push({ row: rowNum, source: src, field: 'shares', error: `股数无效: ${t.shares}`, raw: JSON.stringify(t) });
      if (!t.price || t.price <= 0) errors.push({ row: rowNum, source: src, field: 'price', error: `价格无效: ${t.price}`, raw: JSON.stringify(t) });
    });
    return errors;
  },

  validateDividends(dividends) {
    const errors = [];
    dividends.forEach((d, idx) => {
      const rowNum = d.row || (idx + 1);
      const src = `分红流水第${rowNum}行`;
      if (!d.dividendId) errors.push({ row: rowNum, source: src, field: 'dividendId', error: '缺少分红编号', raw: JSON.stringify(d) });
      if (!d.stockCode) errors.push({ row: rowNum, source: src, field: 'stockCode', error: '缺少证券代码', raw: JSON.stringify(d) });
      if (!isValidDate(d.exDate)) errors.push({ row: rowNum, source: src, field: 'exDate', error: `除权日格式无效: ${d.exDate}`, raw: JSON.stringify(d) });
      if (!isValidDate(d.payDate)) errors.push({ row: rowNum, source: src, field: 'payDate', error: `派息日格式无效: ${d.payDate}`, raw: JSON.stringify(d) });
      if (d.dividendPerShare == null || d.dividendPerShare <= 0) errors.push({ row: rowNum, source: src, field: 'dividendPerShare', error: `每股红利无效: ${d.dividendPerShare}`, raw: JSON.stringify(d) });
    });
    return errors;
  },

  validateDeductions(deductions) {
    const errors = [];
    deductions.forEach((dd, idx) => {
      const rowNum = dd.row || (idx + 1);
      const src = `补扣流水第${rowNum}行`;
      if (!dd.deductionId) errors.push({ row: rowNum, source: src, field: 'deductionId', error: '缺少补扣编号', raw: JSON.stringify(dd) });
      if (!dd.accountId) errors.push({ row: rowNum, source: src, field: 'accountId', error: '缺少账户编号', raw: JSON.stringify(dd) });
      if (!dd.stockCode) errors.push({ row: rowNum, source: src, field: 'stockCode', error: '缺少证券代码', raw: JSON.stringify(dd) });
      if (!isValidDate(dd.deductionDate)) errors.push({ row: rowNum, source: src, field: 'deductionDate', error: `补扣日期格式无效: ${dd.deductionDate}`, raw: JSON.stringify(dd) });
      if (dd.amount == null || dd.amount < 0) errors.push({ row: rowNum, source: src, field: 'amount', error: `金额无效: ${dd.amount}`, raw: JSON.stringify(dd) });
    });
    return errors;
  }
};

const PositionConsolidator = {
  consolidate(trades, accounts) {
    const idNumberMap = {};
    accounts.forEach(a => {
      if (a.idNumber) {
        if (!idNumberMap[a.idNumber]) idNumberMap[a.idNumber] = [];
        idNumberMap[a.idNumber].push(a.accountId);
      }
    });

    const linkedAccounts = {};
    Object.entries(idNumberMap).forEach(([idNum, ids]) => {
      ids.forEach(id => { linkedAccounts[id] = ids; });
    });

    const positionMap = {};
    trades.forEach(t => {
      if (!t.stockCode) return;
      const key = `${t.accountId}::${t.stockCode}`;
      if (!positionMap[key]) {
        positionMap[key] = {
          accountId: t.accountId,
          stockCode: t.stockCode,
          stockName: t.stockName,
          custodian: t.custodian,
          buyLots: [],
          sellLots: []
        };
      }
      if (t.tradeType === 'buy') {
        positionMap[key].buyLots.push({ tradeId: t.tradeId, date: t.tradeDate, shares: t.shares, price: t.price, row: t.row });
      } else {
        positionMap[key].sellLots.push({ tradeId: t.tradeId, date: t.tradeDate, shares: t.shares, price: t.price, row: t.row });
      }
    });

    const positions = Object.values(positionMap);

    const stockAccountMap = {};
    positions.forEach(p => {
      if (!stockAccountMap[p.stockCode]) stockAccountMap[p.stockCode] = [];
      stockAccountMap[p.stockCode].push(p.accountId);
    });

    const crossCustodianStocks = {};
    Object.entries(stockAccountMap).forEach(([stockCode, accountIds]) => {
      if (accountIds.length <= 1) return;
      const grouped = {};
      accountIds.forEach(aid => {
        const acc = accounts.find(a => a.accountId === aid);
        if (!acc || !acc.idNumber) return;
        if (!grouped[acc.idNumber]) grouped[acc.idNumber] = new Set();
        grouped[acc.idNumber].add(acc.custodian);
      });
      const crossAccounts = [];
      Object.entries(grouped).forEach(([idNum, custodians]) => {
        if (custodians.size > 1) {
          const linkedIds = idNumberMap[idNum] || [];
          linkedIds.forEach(lid => {
            if (accountIds.includes(lid)) crossAccounts.push(lid);
          });
        }
      });
      if (crossAccounts.length > 1) {
        crossCustodianStocks[stockCode] = [...new Set(crossAccounts)];
      }
    });

    const consolidated = [];
    positions.forEach(p => {
      const processedSells = [...p.sellLots].sort((a, b) => a.date.localeCompare(b.date));
      const buyQueue = [...p.buyLots].sort((a, b) => a.date.localeCompare(b.date));
      const isCrossCustodian = crossCustodianStocks[p.stockCode] != null && crossCustodianStocks[p.stockCode].includes(p.accountId);

      processedSells.forEach(sell => {
        let remaining = sell.shares;
        while (remaining > 0 && buyQueue.length > 0) {
          const lot = buyQueue[0];
          if (lot.shares <= 0) { buyQueue.shift(); continue; }
          const matched = Math.min(remaining, lot.shares);
          const holdDays = daysBetween(lot.date, sell.date);
          consolidated.push({
            accountId: p.accountId,
            stockCode: p.stockCode,
            stockName: p.stockName,
            custodian: p.custodian,
            buyTradeId: lot.tradeId,
            buyDate: lot.date,
            sellTradeId: sell.tradeId,
            sellDate: sell.date,
            shares: matched,
            buyPrice: lot.price,
            sellPrice: sell.price,
            holdingDays: holdDays,
            isCrossCustodian,
            buyRow: lot.row,
            sellRow: sell.row
          });
          lot.shares -= matched;
          remaining -= matched;
          if (lot.shares <= 0) buyQueue.shift();
        }
        if (remaining > 0) {
          consolidated.push({
            accountId: p.accountId,
            stockCode: p.stockCode,
            stockName: p.stockName,
            custodian: p.custodian,
            buyTradeId: null,
            buyDate: null,
            sellTradeId: sell.tradeId,
            sellDate: sell.date,
            shares: remaining,
            buyPrice: null,
            sellPrice: sell.price,
            holdingDays: null,
            isCrossCustodian,
            buyRow: null,
            sellRow: sell.row,
            anomaly: '卖出股数超过已录入买入记录',
            anomalySource: `卖出流水第${sell.row}行`
          });
        }
      });

      buyQueue.forEach(lot => {
        if (lot.shares > 0) {
          consolidated.push({
            accountId: p.accountId,
            stockCode: p.stockCode,
            stockName: p.stockName,
            custodian: p.custodian,
            buyTradeId: lot.tradeId,
            buyDate: lot.date,
            sellTradeId: null,
            sellDate: null,
            shares: lot.shares,
            buyPrice: lot.price,
            sellPrice: null,
            holdingDays: null,
            isCrossCustodian,
            buyRow: lot.row,
            sellRow: null,
            isUnsold: true
          });
        }
      });
    });

    return { consolidated, crossCustodianStocks, linkedAccounts };
  }
};

const TaxRecalculator = {
  recalculate(consolidated, dividends, accounts) {
    const results = [];
    const anomalies = [];

    dividends.forEach(div => {
      let stockPositions = consolidated.filter(p => p.stockCode === div.stockCode);

      if (div.accountId) {
        const targetAccount = accounts.find(a => a.accountId === div.accountId);
        if (targetAccount && targetAccount.idNumber) {
          const relatedAccountIds = accounts
            .filter(a => a.idNumber === targetAccount.idNumber)
            .map(a => a.accountId);
          stockPositions = stockPositions.filter(p => relatedAccountIds.includes(p.accountId));
        } else {
          stockPositions = stockPositions.filter(p => p.accountId === div.accountId);
        }
      }

      if (stockPositions.length === 0) {
        anomalies.push({
          type: 'warning',
          code: 'NO_POSITION',
          stockCode: div.stockCode,
          stockName: div.stockName,
          message: `分红记录${div.dividendId}无对应持仓记录`,
          source: `分红流水第${div.row}行`,
          dividendId: div.dividendId
        });
        return;
      }

      const positionsByAccount = {};
      stockPositions.forEach(p => {
        if (!positionsByAccount[p.accountId]) positionsByAccount[p.accountId] = [];
        positionsByAccount[p.accountId].push(p);
      });

      let positionDetails = [];
      let totalShares = 0;
      let weightedHoldingDays = 0;
      let totalWeight = 0;

      Object.entries(positionsByAccount).forEach(([accountId, accountPositions]) => {
        accountPositions.forEach(pos => {
          let eligible = false;
          let holdDays = null;

          if (pos.isUnsold || !pos.sellDate) {
            eligible = true;
            holdDays = daysBetween(pos.buyDate, div.exDate);
          } else if (pos.sellDate > div.exDate) {
            eligible = true;
            holdDays = daysBetween(pos.buyDate, pos.sellDate);
          }

          if (eligible) {
            const taxInfo = holdDays != null ? getTaxRate(holdDays) : { rate: null, tier: null };
            const posDividend = pos.shares * div.dividendPerShare;
            const posTax = taxInfo.rate != null ? posDividend * taxInfo.rate : null;

            positionDetails.push({
              ...pos,
              calculatedHoldingDays: holdDays,
              calculatedRate: taxInfo.rate,
              calculatedTier: taxInfo.tier,
              posDividend,
              posTax,
              dividendExDate: div.exDate
            });

            totalShares += pos.shares;
            if (holdDays != null) {
              weightedHoldingDays += holdDays * pos.shares;
              totalWeight += pos.shares;
            }
          }
        });
      });

      if (div.totalShares && Math.abs(totalShares - div.totalShares) > 0.01) {
        anomalies.push({
          type: 'warning',
          code: 'SHARES_MISMATCH',
          stockCode: div.stockCode,
          stockName: div.stockName,
          message: `持仓股数不匹配：分红记录声明${div.totalShares}股，重算实际持仓${totalShares}股`,
          source: `分红流水第${div.row}行`,
          declaredShares: div.totalShares,
          calculatedShares: totalShares
        });
      }

      if (positionDetails.length === 0) {
        anomalies.push({
          type: 'warning',
          code: 'NO_ELIGIBLE_POSITION',
          stockCode: div.stockCode,
          stockName: div.stockName,
          message: `除权日${div.exDate}无有效持仓，可能已全部卖出`,
          source: `分红流水第${div.row}行`,
          dividendId: div.dividendId
        });
      }

      const dividendAmount = totalShares * div.dividendPerShare;
      const avgHoldingDays = totalWeight > 0 ? Math.round(weightedHoldingDays / totalWeight) : null;
      const avgTaxInfo = avgHoldingDays != null ? getTaxRate(avgHoldingDays) : { rate: null, tier: null };

      const correctTax = positionDetails.reduce((sum, pd) => sum + (pd.posTax || 0), 0);
      const preWithheld = dividendAmount * 0.05;
      const supplementalDeduction = Math.max(0, correctTax - preWithheld);
      const refund = Math.max(0, preWithheld - correctTax);

      const crossCustodianSeen = new Set();
      stockPositions.forEach(pos => {
        if (pos.isCrossCustodian && !crossCustodianSeen.has(pos.accountId)) {
          crossCustodianSeen.add(pos.accountId);
          anomalies.push({
            type: 'error',
            code: 'CROSS_CUSTODIAN',
            stockCode: div.stockCode,
            stockName: div.stockName,
            accountId: pos.accountId,
            message: `持仓跨托管：${pos.stockName}(${pos.stockCode})在多个托管机构存在持仓，需归并计算持股期限`,
            source: `买入流水第${pos.buyRow}行 / 账户${pos.accountId}`,
            position: pos
          });
        }

        if (pos.anomaly) {
          anomalies.push({
            type: 'error',
            code: 'UNMATCHED_SELL',
            stockCode: div.stockCode,
            stockName: div.stockName,
            accountId: pos.accountId,
            message: pos.anomaly,
            source: pos.anomalySource,
            position: pos
          });
        }
      });

      positionDetails.forEach(pd => {
        if (pd.calculatedHoldingDays != null) {
          if (pd.calculatedHoldingDays > 25 && pd.calculatedHoldingDays <= 35) {
            anomalies.push({
              type: 'warning',
              code: 'TIER_BOUNDARY',
              stockCode: div.stockCode,
              stockName: div.stockName,
              accountId: pd.accountId,
              message: `持股期限${pd.calculatedHoldingDays}天，接近1个月档位边界，请核实`,
              source: `买入流水第${pd.buyRow}行`,
              position: pd
            });
          }
          if (pd.calculatedHoldingDays > 355 && pd.calculatedHoldingDays <= 375) {
            anomalies.push({
              type: 'warning',
              code: 'TIER_BOUNDARY',
              stockCode: div.stockCode,
              stockName: div.stockName,
              accountId: pd.accountId,
              message: `持股期限${pd.calculatedHoldingDays}天，接近1年档位边界，请核实`,
              source: `买入流水第${pd.buyRow}行`,
              position: pd
            });
          }
        }
      });

      results.push({
        dividendId: div.dividendId,
        stockCode: div.stockCode,
        stockName: div.stockName,
        exDate: div.exDate,
        payDate: div.payDate,
        dividendPerShare: div.dividendPerShare,
        declaredTotalShares: div.totalShares,
        calculatedTotalShares: totalShares,
        totalShares,
        dividendAmount,
        avgHoldingDays,
        avgTaxRate: avgTaxInfo.rate,
        avgTaxTier: avgTaxInfo.tier,
        correctTax,
        preWithheld,
        supplementalDeduction,
        refund,
        positionDetails
      });
    });

    return { results, anomalies };
  }
};

const DeductionChecker = {
  check(deductions, taxResults, accounts) {
    const anomalies = [];
    const checkedResults = [];

    const idNumberMap = {};
    accounts.forEach(a => {
      if (a.idNumber) {
        if (!idNumberMap[a.idNumber]) idNumberMap[a.idNumber] = [];
        idNumberMap[a.idNumber].push(a.accountId);
      }
    });

    const deductionKeys = new Map();
    deductions.forEach(dd => {
      const linkedIds = idNumberMap[accounts.find(a => a.accountId === dd.accountId)?.idNumber] || [dd.accountId];
      const key = `${dd.stockCode}::${dd.deductionDate}::${dd.amount}`;
      const linkedKey = `LINKED::${dd.stockCode}::${dd.deductionDate}::${dd.amount}`;

      let isDuplicate = false;
      let duplicateOf = null;

      for (const [existingKey, existingDd] of deductionKeys.entries()) {
        if (existingKey.startsWith('LINKED::')) {
          const parts = existingKey.split('::');
          if (parts[1] === dd.stockCode && parts[2] === dd.deductionDate && parts[3] === String(dd.amount)) {
            const existingLinkedIds = idNumberMap[accounts.find(a => a.accountId === existingDd.accountId)?.idNumber] || [existingDd.accountId];
            const hasOverlap = linkedIds.some(id => existingLinkedIds.includes(id));
            if (hasOverlap && existingDd.deductionId !== dd.deductionId) {
              isDuplicate = true;
              duplicateOf = existingDd;
              break;
            }
          }
        }
      }

      deductionKeys.set(key, dd);
      deductionKeys.set(linkedKey, dd);

      const taxResult = taxResults.find(tr => tr.stockCode === dd.stockCode);
      let expectedAmount = null;
      let rateMismatch = false;
      let expectedRate = null;

      if (taxResult) {
        const posDetail = taxResult.positionDetails.find(pd => pd.accountId === dd.accountId);
        if (posDetail && posDetail.calculatedRate != null) {
          expectedRate = posDetail.calculatedRate;
          const posDividend = posDetail.shares * taxResult.dividendPerShare;
          expectedAmount = posDividend * expectedRate;
          if (dd.withheldRate != null && Math.abs(dd.withheldRate - expectedRate) > 0.001) {
            rateMismatch = true;
          }
        }
      }

      const checked = {
        ...dd,
        isDuplicate,
        duplicateOf,
        rateMismatch,
        expectedRate,
        expectedAmount
      };

      if (isDuplicate) {
        anomalies.push({
          type: 'error',
          code: 'DUPLICATE_DEDUCTION',
          deductionId: dd.deductionId,
          stockCode: dd.stockCode,
          accountId: dd.accountId,
          message: `补扣重复：${dd.deductionId}与${duplicateOf.deductionId}对同一投资者同一股票同一日扣了相同金额${formatMoney(dd.amount)}`,
          source: `补扣流水第${dd.row}行 / 对比第${duplicateOf.row}行`,
          originalRecord: duplicateOf
        });
      }

      if (rateMismatch) {
        anomalies.push({
          type: 'error',
          code: 'RATE_MISMATCH',
          deductionId: dd.deductionId,
          stockCode: dd.stockCode,
          accountId: dd.accountId,
          message: `税率档位错：扣税率${(dd.withheldRate * 100).toFixed(0)}%，重算应为${(expectedRate * 100).toFixed(0)}%`,
          source: `补扣流水第${dd.row}行`,
          expectedRate,
          actualRate: dd.withheldRate
        });
      }

      checkedResults.push(checked);
    });

    const deductionMap = {};
    deductions.forEach(dd => {
      const key = dd.stockCode;
      if (!deductionMap[key]) deductionMap[key] = [];
      deductionMap[key].push(dd);
    });

    taxResults.forEach(tr => {
      const totalDeducted = (deductionMap[tr.stockCode] || []).reduce((s, dd) => s + dd.amount, 0);
      if (Math.abs(totalDeducted - tr.correctTax) > 0.01 && totalDeducted > 0) {
        anomalies.push({
          type: 'warning',
          code: 'AMOUNT_MISMATCH',
          stockCode: tr.stockCode,
          stockName: tr.stockName,
          message: `总扣税额${formatMoney(totalDeducted)}与重算应纳税额${formatMoney(tr.correctTax)}不一致`,
          source: `分红记录${tr.dividendId}关联的所有补扣流水`
        });
      }
    });

    return { checkedResults, anomalies };
  }
};

const ExplanationGenerator = {
  generate(taxResults, deductionAnomalies, crossCustodianStocks, linkedAccounts, accounts) {
    const sections = [];

    taxResults.forEach(tr => {
      const lines = [];
      lines.push(`【${tr.stockName}(${tr.stockCode})分红税费重算说明】`);
      lines.push('');
      lines.push(`一、分红基本信息`);
      lines.push(`  除权除息日：${tr.exDate}`);
      lines.push(`  派息日：${tr.payDate}`);
      lines.push(`  每股红利：${tr.dividendPerShare}元`);
      lines.push(`  分红声明股数：${tr.declaredTotalShares || '-'}股`);
      lines.push(`  重算实际持仓：${tr.totalShares}股（除权日时点有效持仓）`);
      lines.push(`  红利总额：${formatMoney(tr.dividendAmount)}`);
      if (tr.declaredTotalShares && Math.abs(tr.totalShares - tr.declaredTotalShares) > 0.01) {
        lines.push(`  ⚠ 注意：声明股数与实际持仓不一致，已按实际持仓计算`);
      }
      lines.push('');

      lines.push(`二、持股期限与适用税率`);
      tr.positionDetails.forEach((pd, idx) => {
        const accName = accounts.find(a => a.accountId === pd.accountId)?.accountName || pd.accountId;
        const rateLabel = pd.calculatedTier ? pd.calculatedTier.label : '未确定';
        const ratePct = pd.calculatedRate != null ? `${(pd.calculatedRate * 100).toFixed(0)}%` : '待确认';
        lines.push(`  ${idx + 1}. 账户${pd.accountId}(${accName}) ${pd.custodian}`);
        lines.push(`     买入日期：${pd.buyDate || '未知'}，${pd.sellDate ? '卖出日期：' + pd.sellDate + '，' : '尚未卖出，'}持股${pd.calculatedHoldingDays != null ? pd.calculatedHoldingDays + '天' : '未知'}`);
        lines.push(`     股数：${pd.shares}股，适用税率：${ratePct}(${rateLabel})`);
        lines.push(`     红利：${formatMoney(pd.posDividend || 0)}，应扣税：${formatMoney(pd.posTax || 0)}`);
        if (pd.isCrossCustodian) {
          lines.push(`     ⚠ 注意：该持仓跨托管机构，已归并计算`);
        }
      });
      lines.push('');

      lines.push(`三、税费计算汇总`);
      lines.push(`  加权平均持股天数：${tr.avgHoldingDays != null ? tr.avgHoldingDays + '天' : '未知'}`);
      lines.push(`  加权平均适用税率：${tr.avgTaxRate != null ? (tr.avgTaxRate * 100).toFixed(0) + '%' : '未知'}`);
      lines.push(`  应纳税总额：${formatMoney(tr.correctTax)}`);
      lines.push(`  已预扣(5%)：${formatMoney(tr.preWithheld)}`);
      lines.push(`  应补扣：${formatMoney(tr.supplementalDeduction)}`);
      if (tr.refund > 0) {
        lines.push(`  应退还：${formatMoney(tr.refund)}`);
      }
      lines.push('');

      const stockAnomalies = deductionAnomalies.filter(a => a.stockCode === tr.stockCode);
      if (stockAnomalies.length > 0) {
        lines.push(`四、异常说明`);
        stockAnomalies.forEach((a, idx) => {
          const icon = a.type === 'error' ? '🔴' : '🟡';
          lines.push(`  ${idx + 1}. ${icon} [${a.code}] ${a.message}`);
          lines.push(`     来源：${a.source}`);
        });
        lines.push('');
      }

      if (crossCustodianStocks[tr.stockCode]) {
        const relatedAccountIds = crossCustodianStocks[tr.stockCode];
        lines.push(`五、跨托管归并说明`);
        lines.push(`  ${tr.stockName}在多个托管机构有持仓，关联账户：${relatedAccountIds.join('、')}`);
        lines.push(`  归并依据：同一身份证号码下的账户视为同一投资者持仓`);
        lines.push(`  归并后已按FIFO原则统一计算持股期限`);
        lines.push('');
      }

      sections.push({ stockCode: tr.stockCode, stockName: tr.stockName, text: lines.join('\n') });
    });

    return sections;
  }
};

const ExportManager = {
  toCSV(taxResults, checkedDeductions, consolidated) {
    const rows = [];

    rows.push(['=== 分红税费重算明细 ===']);
    rows.push([]);
    rows.push(['分红编号', '证券代码', '证券名称', '除权日', '派息日', '每股红利', '声明股数', '计算股数', '红利总额', '加权持股天数', '适用税率', '应纳税额', '已预扣', '应补扣', '应退还']);
    taxResults.forEach(tr => {
      rows.push([
        tr.dividendId, tr.stockCode, tr.stockName, tr.exDate, tr.payDate,
        tr.dividendPerShare, tr.declaredTotalShares || '', tr.totalShares, tr.dividendAmount.toFixed(2),
        tr.avgHoldingDays != null ? tr.avgHoldingDays : '',
        tr.avgTaxRate != null ? (tr.avgTaxRate * 100).toFixed(0) + '%' : '',
        tr.correctTax.toFixed(2), tr.preWithheld.toFixed(2),
        tr.supplementalDeduction.toFixed(2), tr.refund.toFixed(2)
      ]);
    });

    rows.push([]);
    rows.push(['=== 持仓明细 ===']);
    rows.push([]);
    rows.push(['账户', '证券代码', '证券名称', '托管机构', '买入日期', '卖出日期', '股数', '持股天数', '适用税率', '红利', '应扣税']);
    taxResults.forEach(tr => {
      tr.positionDetails.forEach(pd => {
        rows.push([
          pd.accountId, pd.stockCode, pd.stockName, pd.custodian,
          pd.buyDate || '', pd.sellDate || '', pd.shares,
          pd.calculatedHoldingDays != null ? pd.calculatedHoldingDays : '',
          pd.calculatedRate != null ? (pd.calculatedRate * 100).toFixed(0) + '%' : '',
          (pd.posDividend || 0).toFixed(2), (pd.posTax || 0).toFixed(2)
        ]);
      });
    });

    rows.push([]);
    rows.push(['=== 补扣流水检查 ===']);
    rows.push([]);
    rows.push(['补扣编号', '账户', '证券代码', '补扣日期', '金额', '扣税率', '重算税率', '是否重复', '税率是否异常']);
    checkedDeductions.forEach(cd => {
      rows.push([
        cd.deductionId, cd.accountId, cd.stockCode, cd.deductionDate,
        cd.amount.toFixed(2),
        cd.withheldRate != null ? (cd.withheldRate * 100).toFixed(0) + '%' : '',
        cd.expectedRate != null ? (cd.expectedRate * 100).toFixed(0) + '%' : '',
        cd.isDuplicate ? '是(重复' + (cd.duplicateOf ? ':' + cd.duplicateOf.deductionId : '') + ')' : '否',
        cd.rateMismatch ? '是' : '否'
      ]);
    });

    return rows.map(r => r.map(c => {
      const s = String(c);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    }).join(',')).join('\n');
  },

  download(csvContent, filename) {
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
};

const ChartManager = {
  taxDistributionChart: null,
  holdingPeriodChart: null,

  renderTaxDistribution(taxResults) {
    const ctx = document.getElementById('taxDistChart');
    if (!ctx) return;

    if (this.taxDistributionChart) this.taxDistributionChart.destroy();

    const labels = taxResults.map(tr => `${tr.stockName}(${tr.stockCode})`);
    const withheld = taxResults.map(tr => tr.preWithheld);
    const supplemental = taxResults.map(tr => tr.supplementalDeduction);
    const refund = taxResults.map(tr => tr.refund);

    this.taxDistributionChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: '已预扣(5%)', data: withheld, backgroundColor: '#5B8FF9', stack: 'tax' },
          { label: '应补扣', data: supplemental, backgroundColor: '#F6BD16', stack: 'tax' },
          { label: '应退还', data: refund, backgroundColor: '#5AD8A6', stack: 'tax' }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: { display: true, text: '分红税费构成', font: { size: 14 } },
          tooltip: {
            callbacks: {
              label: ctx => `${ctx.dataset.label}: ${formatMoney(ctx.raw)}`
            }
          }
        },
        scales: {
          x: { stacked: true },
          y: { stacked: true, ticks: { callback: v => '¥' + v } }
        }
      }
    });
  },

  renderHoldingPeriod(taxResults) {
    const ctx = document.getElementById('holdingChart');
    if (!ctx) return;

    if (this.holdingPeriodChart) this.holdingPeriodChart.destroy();

    const allDetails = taxResults.flatMap(tr => tr.positionDetails.filter(pd => pd.calculatedHoldingDays != null));

    const tierCounts = { '≤1个月(20%)': 0, '1个月~1年(10%)': 0, '>1年(0%)': 0 };
    allDetails.forEach(pd => {
      if (pd.calculatedHoldingDays <= 30) tierCounts['≤1个月(20%)'] += pd.shares;
      else if (pd.calculatedHoldingDays <= 365) tierCounts['1个月~1年(10%)'] += pd.shares;
      else tierCounts['>1年(0%)'] += pd.shares;
    });

    this.holdingPeriodChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: Object.keys(tierCounts),
        datasets: [{
          data: Object.values(tierCounts),
          backgroundColor: ['#E8684A', '#F6BD16', '#5AD8A6'],
          borderWidth: 2,
          borderColor: '#fff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: { display: true, text: '持股期限分布（按股数）', font: { size: 14 } },
          tooltip: {
            callbacks: {
              label: ctx => `${ctx.label}: ${ctx.raw}股`
            }
          }
        }
      }
    });
  }
};

const App = {
  state: {
    accounts: [],
    trades: [],
    dividends: [],
    deductions: [],
    validationErrors: [],
    badData: [],
    consolidated: null,
    taxResults: null,
    taxAnomalies: [],
    deductionChecked: null,
    deductionAnomalies: [],
    explanations: [],
    crossCustodianStocks: {},
    linkedAccounts: {},
    activeTab: 'input'
  },

  init() {
    this.bindEvents();
    this.showTab('input');
  },

  bindEvents() {
    document.getElementById('btnLoadMock').addEventListener('click', () => this.loadMockData());
    document.getElementById('btnProcess').addEventListener('click', () => this.process());
    document.getElementById('btnExport').addEventListener('click', () => this.exportCSV());

    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => this.showTab(btn.dataset.tab));
    });
  },

  showTab(tabId) {
    this.state.activeTab = tabId;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tabId));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === `panel-${tabId}`));
    if (tabId === 'charts' && this.state.taxResults) {
      setTimeout(() => {
        ChartManager.renderTaxDistribution(this.state.taxResults);
        ChartManager.renderHoldingPeriod(this.state.taxResults);
      }, 50);
    }
  },

  loadMockData() {
    this.state.accounts = JSON.parse(JSON.stringify(MockData.accounts));
    this.state.trades = JSON.parse(JSON.stringify(MockData.trades));
    this.state.dividends = JSON.parse(JSON.stringify(MockData.dividends));
    this.state.deductions = JSON.parse(JSON.stringify(MockData.deductions));
    this.state.badData = JSON.parse(JSON.stringify(MockData.badData));

    document.getElementById('dataAccount').value = JSON.stringify(this.state.accounts, null, 2);
    document.getElementById('dataTrades').value = JSON.stringify(this.state.trades, null, 2);
    document.getElementById('dataDividends').value = JSON.stringify(this.state.dividends, null, 2);
    document.getElementById('dataDeductions').value = JSON.stringify(this.state.deductions, null, 2);

    this.showToast('已加载模拟数据（含跨托管、税率错、补扣重复场景）');
  },

  process() {
    try {
      this.state.accounts = JSON.parse(document.getElementById('dataAccount').value || '[]');
      this.state.trades = JSON.parse(document.getElementById('dataTrades').value || '[]');
      this.state.dividends = JSON.parse(document.getElementById('dataDividends').value || '[]');
      this.state.deductions = JSON.parse(document.getElementById('dataDeductions').value || '[]');
    } catch (e) {
      this.showToast('JSON解析失败: ' + e.message, 'error');
      return;
    }

    const v1 = DataValidator.validateTrades(this.state.trades);
    const v2 = DataValidator.validateDividends(this.state.dividends);
    const v3 = DataValidator.validateDeductions(this.state.deductions);
    this.state.validationErrors = [...v1, ...v2, ...v3];

    if (this.state.validationErrors.length > 0) {
      this.renderValidationErrors();
      this.showTab('validation');
    }

    const { consolidated, crossCustodianStocks, linkedAccounts } = PositionConsolidator.consolidate(this.state.trades, this.state.accounts);
    this.state.consolidated = consolidated;
    this.state.crossCustodianStocks = crossCustodianStocks;
    this.state.linkedAccounts = linkedAccounts;

    const { results, anomalies } = TaxRecalculator.recalculate(consolidated, this.state.dividends, this.state.accounts);
    this.state.taxResults = results;
    this.state.taxAnomalies = anomalies;

    const { checkedResults, anomalies: dedAnomalies } = DeductionChecker.check(this.state.deductions, results, this.state.accounts);
    this.state.deductionChecked = checkedResults;
    this.state.deductionAnomalies = dedAnomalies;

    this.state.explanations = ExplanationGenerator.generate(
      results, dedAnomalies, crossCustodianStocks, linkedAccounts, this.state.accounts
    );

    this.renderPositions();
    this.renderTaxResults();
    this.renderDeductionCheck();
    this.renderExplanations();
    this.renderAnomalySummary();
    ChartManager.renderTaxDistribution(results);
    ChartManager.renderHoldingPeriod(results);

    this.showTab('positions');
    this.showToast('处理完成');
  },

  renderValidationErrors() {
    const container = document.getElementById('validationList');
    if (!container) return;
    container.innerHTML = this.state.validationErrors.map(e => `
      <div class="validation-error">
        <span class="error-badge">数据异常</span>
        <span class="error-source">${e.source}</span>
        <span class="error-msg">${e.error}</span>
        <span class="error-raw" title="${(e.raw || '').substring(0, 200)}">原始数据 ▸</span>
      </div>
    `).join('') + this.state.badData.map(b => `
      <div class="validation-error bad-data">
        <span class="error-badge">坏数据</span>
        <span class="error-source">${b.source}</span>
        <span class="error-msg">${b.error}</span>
        <span class="error-raw" title="${(b.raw || '').substring(0, 200)}">原始数据 ▸</span>
      </div>
    `).join('');
  },

  renderPositions() {
    const container = document.getElementById('positionsTable');
    if (!container) return;

    let html = `<table class="data-table"><thead><tr>
      <th>账户</th><th>证券代码</th><th>证券名称</th><th>托管机构</th>
      <th>买入日期</th><th>卖出日期</th><th>股数</th><th>持股天数</th>
      <th>标记</th>
    </tr></thead><tbody>`;

    this.state.consolidated.forEach(p => {
      const isCross = p.isCrossCustodian;
      const hasAnomaly = p.anomaly;
      const cls = isCross || hasAnomaly ? 'row-anomaly' : '';
      const markers = [];
      if (isCross) markers.push('<span class="marker cross">跨托管</span>');
      if (hasAnomaly) markers.push(`<span class="marker error">${p.anomaly}</span>`);
      if (p.isUnsold) markers.push('<span class="marker info">未卖出</span>');

      html += `<tr class="${cls}" data-buy-row="${p.buyRow || ''}" data-sell-row="${p.sellRow || ''}">
        <td>${p.accountId}</td>
        <td>${p.stockCode}</td>
        <td>${p.stockName}</td>
        <td>${p.custodian}</td>
        <td>${p.buyDate || '-'}</td>
        <td>${p.sellDate || '-'}</td>
        <td>${p.shares}</td>
        <td>${p.holdingDays != null ? p.holdingDays : '-'}</td>
        <td>${markers.join(' ')}</td>
      </tr>`;
    });

    html += '</tbody></table>';

    if (Object.keys(this.state.crossCustodianStocks).length > 0) {
      html += '<div class="cross-custodian-note"><strong>跨托管归并：</strong>';
      Object.entries(this.state.crossCustodianStocks).forEach(([stock, accountIds]) => {
        html += `${stock} 涉及账户 ${accountIds.join('、')}（按身份证归并）`;
      });
      html += '</div>';
    }

    container.innerHTML = html;

    container.querySelectorAll('.row-anomaly').forEach(row => {
      row.style.cursor = 'pointer';
      row.addEventListener('click', () => {
        const buyRow = row.dataset.buyRow;
        const sellRow = row.dataset.sellRow;
        this.showOriginalRecord(buyRow, sellRow);
      });
    });
  },

  showOriginalRecord(buyRow, sellRow) {
    const modal = document.getElementById('modal');
    const content = document.getElementById('modalContent');
    const records = [];

    if (buyRow) {
      const buy = this.state.trades.find(t => String(t.row) === String(buyRow));
      if (buy) records.push({ label: '买入记录', data: buy });
    }
    if (sellRow) {
      const sell = this.state.trades.find(t => String(t.row) === String(sellRow));
      if (sell) records.push({ label: '卖出记录', data: sell });
    }

    content.innerHTML = records.map(r => `
      <div class="original-record">
        <h4>${r.label}（第${r.data.row}行）</h4>
        <pre>${JSON.stringify(r.data, null, 2)}</pre>
      </div>
    `).join('') || '<p>无关联原始记录</p>';

    modal.classList.add('show');
  },

  renderTaxResults() {
    const container = document.getElementById('taxResultsTable');
    if (!container) return;

    let html = `<table class="data-table"><thead><tr>
      <th>分红编号</th><th>证券</th><th>除权日</th><th>每股红利</th><th>声明股数</th><th>计算股数</th>
      <th>红利总额</th><th>加权持股天数</th><th>适用税率</th><th>应纳税额</th>
      <th>已预扣</th><th>应补扣</th><th>应退还</th>
    </tr></thead><tbody>`;

    this.state.taxResults.forEach(tr => {
      const stockAnomalies = [...this.state.taxAnomalies, ...this.state.deductionAnomalies].filter(a => a.stockCode === tr.stockCode);
      const hasAnomaly = stockAnomalies.some(a => a.type === 'error');
      const hasShareMismatch = tr.declaredTotalShares && Math.abs(tr.totalShares - tr.declaredTotalShares) > 0.01;
      const cls = hasAnomaly ? 'row-anomaly' : '';

      html += `<tr class="${cls}" data-stock="${tr.stockCode}">
        <td>${tr.dividendId}</td>
        <td>${tr.stockName}(${tr.stockCode})</td>
        <td>${tr.exDate}</td>
        <td>${tr.dividendPerShare}</td>
        <td>${tr.declaredTotalShares || '-'}</td>
        <td class="${hasShareMismatch ? 'text-warning' : ''}">${tr.totalShares}</td>
        <td>${formatMoney(tr.dividendAmount)}</td>
        <td>${tr.avgHoldingDays != null ? tr.avgHoldingDays + '天' : '-'}</td>
        <td>${tr.avgTaxRate != null ? (tr.avgTaxRate * 100).toFixed(0) + '%' : '-'}</td>
        <td>${formatMoney(tr.correctTax)}</td>
        <td>${formatMoney(tr.preWithheld)}</td>
        <td>${formatMoney(tr.supplementalDeduction)}</td>
        <td>${tr.refund > 0 ? formatMoney(tr.refund) : '-'}</td>
      </tr>`;
    });

    html += '</tbody></table>';

    html += '<div class="detail-section"><h3>持仓计算明细</h3>';
    this.state.taxResults.forEach(tr => {
      html += `<div class="stock-detail" data-stock="${tr.stockCode}"><h4>${tr.stockName}(${tr.stockCode})</h4>`;
      html += `<table class="data-table compact"><thead><tr>
        <th>账户</th><th>托管</th><th>买入日</th><th>卖出日</th><th>股数</th>
        <th>持股天数</th><th>税率档位</th><th>税率</th><th>红利</th><th>应扣税</th>
      </tr></thead><tbody>`;
      tr.positionDetails.forEach(pd => {
        const hasIssue = pd.isCrossCustodian || pd.anomaly;
        html += `<tr class="${hasIssue ? 'row-anomaly' : ''}">
          <td>${pd.accountId}</td>
          <td>${pd.custodian}</td>
          <td>${pd.buyDate || '-'}</td>
          <td>${pd.sellDate || '-'}</td>
          <td>${pd.shares}</td>
          <td>${pd.calculatedHoldingDays != null ? pd.calculatedHoldingDays : '-'}</td>
          <td>${pd.calculatedTier ? pd.calculatedTier.label : '-'}</td>
          <td>${pd.calculatedRate != null ? (pd.calculatedRate * 100).toFixed(0) + '%' : '-'}</td>
          <td>${formatMoney(pd.posDividend || 0)}</td>
          <td>${formatMoney(pd.posTax || 0)}</td>
        </tr>`;
      });
      html += '</tbody></table></div>';
    });
    html += '</div>';

    container.innerHTML = html;
  },

  renderDeductionCheck() {
    const container = document.getElementById('deductionTable');
    if (!container) return;

    let html = `<table class="data-table"><thead><tr>
      <th>补扣编号</th><th>账户</th><th>证券代码</th><th>补扣日期</th>
      <th>金额</th><th>扣税率</th><th>重算税率</th><th>重复?</th><th>税率异常?</th><th>来源</th>
    </tr></thead><tbody>`;

    this.state.deductionChecked.forEach(cd => {
      const hasIssue = cd.isDuplicate || cd.rateMismatch;
      html += `<tr class="${hasIssue ? 'row-anomaly' : ''}">
        <td>${cd.deductionId}</td>
        <td>${cd.accountId}</td>
        <td>${cd.stockCode}</td>
        <td>${cd.deductionDate}</td>
        <td>${formatMoney(cd.amount)}</td>
        <td>${cd.withheldRate != null ? (cd.withheldRate * 100).toFixed(0) + '%' : '-'}</td>
        <td>${cd.expectedRate != null ? (cd.expectedRate * 100).toFixed(0) + '%' : '-'}</td>
        <td>${cd.isDuplicate ? '<span class="marker error">是</span>' : '否'}</td>
        <td>${cd.rateMismatch ? '<span class="marker error">是</span>' : '否'}</td>
        <td>${cd.source}</td>
      </tr>`;
    });

    html += '</tbody></table>';

    if (this.state.deductionAnomalies.length > 0) {
      html += '<div class="anomaly-list"><h3>拦截记录</h3>';
      this.state.deductionAnomalies.forEach(a => {
        const icon = a.type === 'error' ? '🔴' : '🟡';
        html += `<div class="anomaly-item ${a.type}">
          ${icon} <strong>[${a.code}]</strong> ${a.message}
          <div class="anomaly-source">来源：${a.source}</div>
        </div>`;
      });
      html += '</div>';
    }

    container.innerHTML = html;
  },

  renderExplanations() {
    const container = document.getElementById('explanationContent');
    if (!container) return;

    container.innerHTML = this.state.explanations.map(sec => `
      <div class="explanation-section">
        <h3>${sec.stockName}(${sec.stockCode})</h3>
        <pre class="explanation-text">${sec.text}</pre>
      </div>
    `).join('');
  },

  renderAnomalySummary() {
    const container = document.getElementById('anomalySummary');
    if (!container) return;

    const allAnomalies = [...this.state.taxAnomalies, ...this.state.deductionAnomalies];
    if (allAnomalies.length === 0) {
      container.innerHTML = '<div class="no-anomaly">✅ 未发现异常</div>';
      return;
    }

    const errors = allAnomalies.filter(a => a.type === 'error');
    const warnings = allAnomalies.filter(a => a.type === 'warning');

    let html = `<div class="anomaly-summary">
      <div class="summary-counts">
        <span class="count error-count">🔴 严重 ${errors.length}</span>
        <span class="count warning-count">🟡 警告 ${warnings.length}</span>
      </div>
      <div class="anomaly-detail-list">`;

    allAnomalies.forEach(a => {
      const icon = a.type === 'error' ? '🔴' : '🟡';
      html += `<div class="anomaly-detail-item ${a.type}">
        ${icon} <strong>[${a.code}]</strong> ${a.message}
        <div class="anomaly-source">来源：${a.source}</div>
        <div class="anomaly-reason">拦截原因：${this.getAnomalyReason(a.code)}</div>
      </div>`;
    });

    html += '</div></div>';
    container.innerHTML = html;
  },

  getAnomalyReason(code) {
    const reasons = {
      'CROSS_CUSTODIAN': '同一投资者在不同托管机构持有同一证券，持股期限未归并计算导致税率档位可能出错',
      'DUPLICATE_DEDUCTION': '同一投资者同一证券同一日扣了相同金额，属于重复补扣，需去重后重新计算',
      'RATE_MISMATCH': '实际扣税率与重算税率不一致，需按正确持股期限对应税率补退差额',
      'TIER_BOUNDARY': '持股天数接近税率档位边界，稍有偏差就会改变税率，需核实买入卖出日期',
      'UNMATCHED_SELL': '卖出记录找不到对应的买入记录，可能是数据缺失或录入错误',
      'NO_POSITION': '分红记录找不到对应持仓，可能是账户未归集或分红信息错误',
      'NO_ELIGIBLE_POSITION': '除权日当天无有效持仓，该股票可能在除权日前已全部卖出',
      'SHARES_MISMATCH': '分红记录声明的股数与重算实际持仓股数不一致，需核实分红范围和实际持仓',
      'AMOUNT_MISMATCH': '实际总扣税额与重算应纳税额不一致，需逐笔核对补扣流水'
    };
    return reasons[code] || '需人工核实';
  },

  exportCSV() {
    if (!this.state.taxResults || !this.state.deductionChecked) {
      this.showToast('请先执行处理', 'error');
      return;
    }
    const csv = ExportManager.toCSV(this.state.taxResults, this.state.deductionChecked, this.state.consolidated);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    ExportManager.download(csv, `分红税费重算明细_${timestamp}.csv`);
    this.showToast('导出成功');
  },

  showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    setTimeout(() => toast.classList.remove('show'), 3000);
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());

document.getElementById('modalClose')?.addEventListener('click', () => {
  document.getElementById('modal').classList.remove('show');
});

document.getElementById('modal')?.addEventListener('click', (e) => {
  if (e.target === e.currentTarget) {
    e.currentTarget.classList.remove('show');
  }
});
