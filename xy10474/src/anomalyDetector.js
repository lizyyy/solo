class AnomalyDetector {
  detectRefundsWithoutSignature(refunds) {
    return refunds
      .filter(refund => !refund.hasManagerSignature)
      .map(refund => ({
        type: 'refund_without_signature',
        severity: 'high',
        message: `退款记录 #${refund.refundId} 缺少店长签字`,
        refundId: refund.refundId,
        cashierId: refund.cashierId,
        amount: refund.amount,
        transactionId: refund.transactionId
      }));
  }

  detectPettyCashWithoutHandover(pettyCash, handovers, storeId) {
    const anomalies = [];
    const storePettyCash = pettyCash.filter(pc => pc.storeId === storeId);
    const storeHandover = handovers.filter(h => h.storeId === storeId);

    storePettyCash.forEach(pc => {
      const hasHandover = storeHandover.some(h => {
        const handoverDate = new Date(h.handoverTime).toDateString();
        const pcDate = new Date(pc.timestamp).toDateString();
        return handoverDate === pcDate;
      });

      if (!hasHandover) {
        anomalies.push({
          type: 'petty_cash_without_handover',
          severity: 'medium',
          message: `备用金变动 #${pc.recordId} 未在交接本记录`,
          recordId: pc.recordId,
          cashierId: pc.cashierId,
          amount: pc.amount,
          changeType: pc.changeType
        });
      }
    });

    return anomalies;
  }

  detectDuplicateTransactions(transactions) {
    const seen = new Map();
    const duplicates = [];

    transactions.forEach(t => {
      const key = `${t.storeId}-${t.transactionId}`;
      if (seen.has(key)) {
        duplicates.push({
          type: 'duplicate_transaction',
          severity: 'medium',
          message: `交易记录 #${t.transactionId} 重复导入`,
          transactionId: t.transactionId,
          cashierId: t.cashierId,
          amount: t.amount
        });
      } else {
        seen.set(key, t);
      }
    });

    return duplicates;
  }

  detectHandoverGaps(handovers, storeId, date) {
    const anomalies = [];
    const storeHandover = handovers
      .filter(h => h.storeId === storeId)
      .filter(h => {
        const handoverDate = new Date(h.handoverTime).toISOString().split('T')[0];
        return handoverDate === date;
      })
      .sort((a, b) => new Date(a.handoverTime) - new Date(b.handoverTime));

    for (let i = 1; i < storeHandover.length; i++) {
      const prev = storeHandover[i - 1];
      const current = storeHandover[i];
      
      const prevEnd = new Date(prev.handoverTime);
      const currentStart = new Date(current.handoverTime);
      const gapMinutes = (currentStart - prevEnd) / (1000 * 60);

      if (gapMinutes > 30) {
        anomalies.push({
          type: 'handover_gap',
          severity: 'high',
          message: `交接时间断档: 收银员 ${prev.outgoingCashierId} 到 ${current.incomingCashierId} 间隔 ${Math.round(gapMinutes)} 分钟`,
          gapMinutes: Math.round(gapMinutes),
          outgoingCashierId: prev.outgoingCashierId,
          incomingCashierId: current.incomingCashierId
        });
      }
    }

    return anomalies;
  }

  detectAll(data, storeId, date) {
    const { transactions, refunds, pettyCash, handovers } = data;
    
    return [
      ...this.detectRefundsWithoutSignature(refunds),
      ...this.detectPettyCashWithoutHandover(pettyCash, handovers, storeId),
      ...this.detectDuplicateTransactions(transactions),
      ...this.detectHandoverGaps(handovers, storeId, date)
    ];
  }
}

module.exports = AnomalyDetector;
