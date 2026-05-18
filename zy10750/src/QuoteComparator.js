class QuoteComparator {
  constructor(rules) {
    this.rules = rules;
    this.specialCases = {
      differentCurrency: [],
      tieredPricing: [],
      expiredQuotes: [],
      duplicateRows: [],
      badRows: []
    };
    this.priceChanges = [];
    this.matched = [];
    this.onlyOld = [];
    this.onlyNew = [];
  }

  compare(oldQuotes, newQuotes) {
    this.detectBadRows(oldQuotes, 'old');
    this.detectBadRows(newQuotes, 'new');
    
    this.detectDuplicates(oldQuotes, 'old');
    this.detectDuplicates(newQuotes, 'new');
    
    this.detectExpiredQuotes(oldQuotes, 'old');
    this.detectExpiredQuotes(newQuotes, 'new');
    
    this.detectTieredPricing(oldQuotes, 'old');
    this.detectTieredPricing(newQuotes, 'new');
    
    const oldMap = this.buildQuoteMap(oldQuotes);
    const newMap = this.buildQuoteMap(newQuotes);
    
    const allKeys = new Set([...oldMap.keys(), ...newMap.keys()]);
    
    for (const key of allKeys) {
      const oldQuote = oldMap.get(key);
      const newQuote = newMap.get(key);
      
      if (oldQuote && newQuote) {
        this.processMatchedQuote(oldQuote, newQuote);
      } else if (oldQuote) {
        this.onlyOld.push({
          type: 'only_old',
          key,
          quote: oldQuote,
          description: '仅在旧报价中存在，新报价已删除'
        });
      } else if (newQuote) {
        this.onlyNew.push({
          type: 'only_new',
          key,
          quote: newQuote,
          description: '仅在新报价中存在，为新增报价'
        });
      }
    }
    
    return {
      stats: {
        oldCount: oldQuotes.length,
        newCount: newQuotes.length,
        matchedCount: this.matched.length,
        onlyOldCount: this.onlyOld.length,
        onlyNewCount: this.onlyNew.length
      },
      matched: this.matched,
      onlyOld: this.onlyOld,
      onlyNew: this.onlyNew,
      priceChanges: this.priceChanges,
      specialCases: this.specialCases
    };
  }

  buildQuoteMap(quotes) {
    const map = new Map();
    const keyFields = this.rules.keyFields || ['supplierName', 'productCode', 'productName'];
    
    for (const quote of quotes) {
      if (quote._isBadRow) continue;
      
      const key = keyFields.map(f => quote[f] || '').join('|');
      if (key) {
        map.set(key, quote);
      }
    }
    
    return map;
  }

  processMatchedQuote(oldQuote, newQuote) {
    const oldPrice = parseFloat(oldQuote.unitPrice) || 0;
    const newPrice = parseFloat(newQuote.unitPrice) || 0;
    const changeAmount = newPrice - oldPrice;
    const changePercent = oldPrice !== 0 ? ((changeAmount / oldPrice) * 100).toFixed(2) : null;
    
    const result = {
      supplierName: oldQuote.supplierName || newQuote.supplierName,
      productCode: oldQuote.productCode || newQuote.productCode,
      productName: oldQuote.productName || newQuote.productName,
      oldPrice,
      newPrice,
      changeAmount,
      changePercent: changePercent !== null ? parseFloat(changePercent) : null,
      oldCurrency: oldQuote.currency,
      newCurrency: newQuote.currency,
      oldValidUntil: oldQuote.validUntil,
      newValidUntil: newQuote.validUntil
    };
    
    if (oldQuote.currency !== newQuote.currency) {
      this.specialCases.differentCurrency.push({
        ...result,
        description: `币种不一致: 旧报价 ${oldQuote.currency}，新报价 ${newQuote.currency}，需确认汇率换算`
      });
    }
    
    this.matched.push(result);
    
    if (changeAmount !== 0) {
      this.priceChanges.push(result);
    }
  }

  detectBadRows(quotes, source) {
    const requiredFields = this.rules.requiredFields || ['supplierName', 'productCode', 'unitPrice'];
    
    for (let i = 0; i < quotes.length; i++) {
      const quote = quotes[i];
      const missingFields = [];
      
      for (const field of requiredFields) {
        if (!quote[field] || quote[field].toString().trim() === '') {
          missingFields.push(field);
        }
      }
      
      if (missingFields.length > 0) {
        quote._isBadRow = true;
        this.specialCases.badRows.push({
          source,
          rowIndex: i + 2,
          quote,
          missingFields,
          description: `数据异常 - ${source}报价第 ${i + 2} 行缺失字段: ${missingFields.join(', ')}`
        });
      }
    }
  }

  detectDuplicates(quotes, source) {
    const keyFields = this.rules.keyFields || ['supplierName', 'productCode', 'productName'];
    const seen = new Map();
    
    for (let i = 0; i < quotes.length; i++) {
      const quote = quotes[i];
      if (quote._isBadRow) continue;
      
      const key = keyFields.map(f => quote[f] || '').join('|');
      
      if (seen.has(key)) {
        const firstIndex = seen.get(key);
        this.specialCases.duplicateRows.push({
          source,
          firstRow: firstIndex + 2,
          duplicateRow: i + 2,
          key,
          quote,
          description: `重复报价 - ${source}报价第 ${i + 2} 行与第 ${firstIndex + 2} 行重复: ${key}`
        });
      } else {
        seen.set(key, i);
      }
    }
  }

  detectExpiredQuotes(quotes, source) {
    const today = new Date();
    const validUntilField = this.rules.validUntilField || 'validUntil';
    
    for (let i = 0; i < quotes.length; i++) {
      const quote = quotes[i];
      if (quote._isBadRow) continue;
      
      if (quote[validUntilField]) {
        const validUntil = new Date(quote[validUntilField]);
        if (!isNaN(validUntil.getTime()) && validUntil < today) {
          this.specialCases.expiredQuotes.push({
            source,
            rowIndex: i + 2,
            quote,
            validUntil: quote[validUntilField],
            description: `过期报价 - ${source}报价第 ${i + 2} 行已过期，有效期至: ${quote[validUntilField]}`
          });
        }
      }
    }
  }

  detectTieredPricing(quotes, source) {
    const minQtyField = this.rules.minQtyField || 'minQuantity';
    const maxQtyField = this.rules.maxQtyField || 'maxQuantity';
    
    for (let i = 0; i < quotes.length; i++) {
      const quote = quotes[i];
      if (quote._isBadRow) continue;
      
      const hasMinQty = quote[minQtyField] !== undefined && quote[minQtyField] !== '' && quote[minQtyField] !== null;
      const hasMaxQty = quote[maxQtyField] !== undefined && quote[maxQtyField] !== '' && quote[maxQtyField] !== null;
      
      if (hasMinQty || hasMaxQty) {
        this.specialCases.tieredPricing.push({
          source,
          rowIndex: i + 2,
          quote,
          minQuantity: quote[minQtyField],
          maxQuantity: quote[maxQtyField],
          description: `阶梯价 - ${source}报价第 ${i + 2} 行存在数量区间: ${quote[minQtyField] || 0} - ${quote[maxQtyField] || '不限'}`
        });
      }
    }
  }
}

module.exports = QuoteComparator;
