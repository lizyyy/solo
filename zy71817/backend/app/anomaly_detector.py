from datetime import datetime, timedelta
from collections import defaultdict
from .models import Transaction, AnomalyRecord
from . import db


class AnomalyDetector:
    def __init__(self, period):
        self.period = period
        self.anomalies = []

    def detect_all(self, transactions):
        self.detect_duplicate_transactions(transactions)
        self.detect_cross_period_fees(transactions)
        self.detect_suspense_refunds(transactions)
        self.detect_late_attachments(transactions)
        return self.anomalies

    def detect_duplicate_transactions(self, transactions):
        key_groups = defaultdict(list)

        for tx in transactions:
            key1 = (tx.transaction_no, abs(tx.amount))
            key2 = (tx.order_no, abs(tx.amount), tx.transaction_date)
            key3 = (tx.channel, tx.payer, abs(tx.amount), tx.transaction_date)

            key_groups[key1].append(tx)
            key_groups[key2].append(tx)
            key_groups[key3].append(tx)

        processed_pairs = set()

        for key, group in key_groups.items():
            if len(group) >= 2:
                for i, tx1 in enumerate(group):
                    for tx2 in group[i+1:]:
                        pair_id = tuple(sorted([tx1.id, tx2.id]))
                        if pair_id in processed_pairs:
                            continue
                        processed_pairs.add(pair_id)

                        confidence = self._calculate_duplicate_confidence(tx1, tx2)
                        if confidence >= 60:
                            anomaly = AnomalyRecord(
                                transaction_id=tx1.id,
                                anomaly_type='duplicate',
                                severity='high' if confidence >= 80 else 'warning',
                                description=f'疑似重复入账（相似度 {confidence}%）',
                                evidence=self._build_duplicate_evidence(tx1, tx2, confidence),
                                related_transaction_ids=str(tx2.id)
                            )
                            self.anomalies.append(anomaly)

                            if tx1.status != 'anomaly':
                                tx1.status = 'pending_confirm'
                            if tx2.status != 'anomaly':
                                tx2.status = 'pending_confirm'

    def _calculate_duplicate_confidence(self, tx1, tx2):
        score = 0

        if tx1.transaction_no and tx1.transaction_no == tx2.transaction_no:
            score += 40

        if abs(tx1.amount - tx2.amount) < 0.01:
            score += 25

        if tx1.transaction_date == tx2.transaction_date:
            score += 15

        if tx1.order_no and tx1.order_no == tx2.order_no:
            score += 10

        if tx1.channel == tx2.channel:
            score += 5

        if tx1.payer == tx2.payer:
            score += 5

        return min(score, 100)

    def _build_duplicate_evidence(self, tx1, tx2, confidence):
        evidence = [
            f'检测依据（相似度 {confidence}%）：',
            f'流水号1: {tx1.transaction_no}, 流水号2: {tx2.transaction_no}',
            f'金额: {"一致" if abs(tx1.amount - tx2.amount) < 0.01 else "不一致"} ({tx1.amount} vs {tx2.amount})',
            f'交易日期: {"一致" if tx1.transaction_date == tx2.transaction_date else "不一致"} ({tx1.transaction_date} vs {tx2.transaction_date})',
            f'订单号: {tx1.order_no or "空"} vs {tx2.order_no or "空"}',
            f'渠道: {tx1.channel or "空"} vs {tx2.channel or "空"}',
            f'付款方: {tx1.payer or "空"} vs {tx2.payer or "空"}',
            '建议：请核实是否为同一笔流水重复录入，如确系重复，请标记作废；如为不同业务，请说明原因后确认。'
        ]
        return '\n'.join(evidence)

    def detect_cross_period_fees(self, transactions):
        period_date = self._parse_period(self.period)

        for tx in transactions:
            if abs(tx.fee) > 0:
                tx_period = f"{tx.transaction_date.year}-{tx.transaction_date.month:02d}"
                if tx_period != self.period:
                    months_diff = (tx.transaction_date.year - period_date.year) * 12 + \
                                  (tx.transaction_date.month - period_date.month)

                    anomaly = AnomalyRecord(
                        transaction_id=tx.id,
                        anomaly_type='cross_period_fee',
                        severity='warning',
                        description=f'手续费跨期（{abs(months_diff)}个月）',
                        evidence=self._build_cross_period_evidence(tx, months_diff),
                        related_transaction_ids=None
                    )
                    self.anomalies.append(anomaly)

                    if tx.status == 'pending':
                        tx.status = 'pending_confirm'

    def _build_cross_period_evidence(self, tx, months_diff):
        evidence = [
            f'手续费金额: {tx.fee} 元',
            f'交易归属期: {tx.transaction_date.year}-{tx.transaction_date.month:02d}',
            f'当前对账期: {self.period}',
            f'跨期月数: {abs(months_diff)} 个月',
            '建议：请核实手续费归属期是否正确。如为补记上期手续费，请在备注中说明后确认。'
        ]
        return '\n'.join(evidence)

    def detect_suspense_refunds(self, transactions):
        for tx in transactions:
            is_refund = tx.type in ['refund', '退款', '赔付'] or tx.amount < 0

            if is_refund:
                has_allocation = any(alloc for alloc in tx.allocations if alloc.compensation_amount > 0)
                has_clear_remark = tx.remark and any(
                    kw in tx.remark for kw in ['售后', '赔付', '补偿', '质量', '退款原因']
                )

                if not has_allocation and not has_clear_remark:
                    anomaly = AnomalyRecord(
                        transaction_id=tx.id,
                        anomaly_type='suspense_refund',
                        severity='warning',
                        description='退款挂账-未明确赔付归属',
                        evidence=self._build_suspense_evidence(tx),
                        related_transaction_ids=None
                    )
                    self.anomalies.append(anomaly)

                    if tx.status == 'pending':
                        tx.status = 'pending_confirm'

    def _build_suspense_evidence(self, tx):
        evidence = [
            f'交易金额: {tx.amount} 元（退款/赔付类）',
            f'当前备注: {tx.remark or "无"}',
            f'分摊状态: 未关联售后赔付分摊记录',
            '建议：请确认该笔款项性质。如为售后赔付，请补充分摊信息；如为其他退款，请补充备注说明。'
        ]
        return '\n'.join(evidence)

    def detect_late_attachments(self, transactions):
        for tx in transactions:
            if tx.attachment_date:
                days_diff = (tx.attachment_date - tx.transaction_date).days
                if days_diff > 7:
                    anomaly = AnomalyRecord(
                        transaction_id=tx.id,
                        anomaly_type='late_attachment',
                        severity='info',
                        description=f'附件晚到（{days_diff}天）',
                        evidence=f'交易日期: {tx.transaction_date}\n附件到账日期: {tx.attachment_date}\n间隔天数: {days_diff} 天\n说明：附件到账晚于交易7天以上，请注意核对完整性。',
                        related_transaction_ids=None
                    )
                    self.anomalies.append(anomaly)

    def _parse_period(self, period_str):
        year, month = map(int, period_str.split('-'))
        return datetime(year, month, 1)
