from datetime import datetime, timedelta
from typing import List, Dict, Tuple, Optional
from config import REFUND_THRESHOLD_DAYS, PENDING_AMOUNT_THRESHOLD
from models import (
    Transaction, TransactionType, RateRule, SettlementRecord,
    SettlementStatus, JudgmentReason
)
from data_io import DataIO


class SettlementEngine:
    def __init__(self, rate_rules: List[RateRule], rate_version: str):
        self.rate_rules = rate_rules
        self.rate_version = rate_version
        self.payment_txns: Dict[str, Transaction] = {}

    def _find_rate_rule(self, txn: Transaction) -> Optional[RateRule]:
        for rule in self.rate_rules:
            if rule.merchant_id == txn.merchant_id:
                if rule.effective_date <= txn.txn_time:
                    if rule.expire_date is None or txn.txn_time <= rule.expire_date:
                        return rule
        return self.rate_rules[0] if self.rate_rules else None

    def _calc_fee(self, amount: float, rule: RateRule) -> Tuple[float, float]:
        fee = amount * rule.rate / 100 + rule.fixed_fee
        settlement = amount - fee
        return round(fee, 2), round(settlement, 2)

    def _generate_settlement_id(self, txn: Transaction) -> str:
        return f"SETL_{txn.txn_id}_{datetime.now().strftime('%Y%m%d%H%M%S')}"

    def _build_normal_record(self, txn: Transaction, rule: RateRule) -> SettlementRecord:
        fee, settlement = self._calc_fee(txn.amount, rule)
        return SettlementRecord(
            settlement_id=self._generate_settlement_id(txn),
            txn_id=txn.txn_id,
            order_id=txn.order_id,
            card_no=txn.card_no,
            original_amount=txn.amount,
            rate_applied=rule.rate,
            fee_amount=fee,
            settlement_amount=settlement,
            status=SettlementStatus.MATCHED,
            judgment_reason=JudgmentReason.NORMAL_MATCH,
            judgment_detail=f"交易正常，匹配商户{txn.merchant_id}费率规则",
            next_step="自动清算完成，等待财务复核",
            rate_version=self.rate_version
        )

    def _build_suspended_record(self, txn: Transaction, reason: JudgmentReason, detail: str, next_step: str, rule: Optional[RateRule] = None) -> SettlementRecord:
        if rule:
            fee, settlement = self._calc_fee(txn.amount, rule)
            rate_applied = rule.rate
        else:
            fee, settlement, rate_applied = 0, 0, 0
        
        return SettlementRecord(
            settlement_id=self._generate_settlement_id(txn),
            txn_id=txn.txn_id,
            order_id=txn.order_id,
            card_no=txn.card_no,
            original_amount=txn.amount,
            rate_applied=rate_applied,
            fee_amount=fee,
            settlement_amount=settlement,
            status=SettlementStatus.SUSPENDED,
            judgment_reason=reason,
            judgment_detail=detail,
            next_step=next_step,
            rate_version=self.rate_version
        )

    def _match_refund(self, refund_txn: Transaction) -> Tuple[Optional[Transaction], str]:
        original_id = refund_txn.original_txn_id
        
        if original_id and original_id in self.payment_txns:
            original_txn = self.payment_txns[original_id]
            days_diff = (refund_txn.txn_time - original_txn.txn_time).days
            
            if abs(original_txn.amount - refund_txn.amount) < 0.01:
                return original_txn, "full"
            elif original_txn.amount > refund_txn.amount:
                return original_txn, "partial"
            else:
                return original_txn, "over"
        
        for txn_id, pay_txn in self.payment_txns.items():
            if pay_txn.order_id == refund_txn.order_id and pay_txn.card_no == refund_txn.card_no:
                days_diff = (refund_txn.txn_time - pay_txn.txn_time).days
                if days_diff <= REFUND_THRESHOLD_DAYS * 2:
                    if abs(pay_txn.amount - refund_txn.amount) < 0.01:
                        return pay_txn, "full"
        
        return None, "none"

    def _process_refund(self, txn: Transaction, rule: RateRule) -> SettlementRecord:
        matched_txn, match_type = self._match_refund(txn)
        
        if match_type == "full":
            return SettlementRecord(
                settlement_id=self._generate_settlement_id(txn),
                txn_id=txn.txn_id,
                order_id=txn.order_id,
                card_no=txn.card_no,
                original_amount=txn.amount,
                rate_applied=rule.rate,
                fee_amount=0,
                settlement_amount=-txn.amount,
                status=SettlementStatus.MATCHED,
                judgment_reason=JudgmentReason.NORMAL_MATCH,
                judgment_detail=f"退款匹配成功，对应原交易{matched_txn.txn_id}，金额完全匹配",
                next_step="自动冲正完成，从对应支付清算款中扣除",
                rate_version=self.rate_version
            )
        elif match_type == "partial":
            return self._build_suspended_record(
                txn,
                JudgmentReason.REFUND_PARTIAL_OFFSET,
                f"退款部分匹配，原交易{matched_txn.txn_id}金额{matched_txn.amount}元，本次退款{txn.amount}元，差额{matched_txn.amount - txn.amount:.2f}元",
                "请核对是否为部分退款，联系门店确认剩余金额处理方式",
                rule
            )
        elif match_type == "over":
            return self._build_suspended_record(
                txn,
                JudgmentReason.AMOUNT_MISMATCH,
                f"退款金额超过原交易，原交易{matched_txn.txn_id}金额{matched_txn.amount}元，本次退款{txn.amount}元",
                "退款金额异常，请核查是否重复退款或系统错误",
                rule
            )
        else:
            days_since_txn = (datetime.now() - txn.txn_time).days
            if days_since_txn <= REFUND_THRESHOLD_DAYS:
                detail = f"未找到对应支付记录，退款金额{txn.amount}元，交易时间{txn.txn_time.strftime('%Y-%m-%d %H:%M')}，仍在{REFUND_THRESHOLD_DAYS}天匹配期内"
                next_step = "系统将在后续批次继续尝试匹配，暂挂账处理"
            else:
                detail = f"未找到对应支付记录，退款金额{txn.amount}元，已超过{REFUND_THRESHOLD_DAYS}天匹配期"
                next_step = "请人工核查：1)是否为跨渠道退款 2)是否原交易未同步 3)是否为误操作退款"
            
            return self._build_suspended_record(
                txn,
                JudgmentReason.REFUND_NO_OFFSET,
                detail,
                next_step,
                rule
            )

    def process_transactions(self, transactions: List[Transaction]) -> Tuple[List[SettlementRecord], Dict]:
        results = []
        stats = {"total": 0, "matched": 0, "suspended": 0, "skipped": 0}
        
        processed_txns = DataIO.get_processed_txns()
        
        for txn in transactions:
            if txn.txn_type == TransactionType.PAYMENT:
                self.payment_txns[txn.txn_id] = txn
        
        for txn in transactions:
            stats["total"] += 1
            
            if txn.txn_id in processed_txns:
                record = self._build_historical_record(txn)
                results.append(record)
                stats["skipped"] += 1
                continue
            
            rule = self._find_rate_rule(txn)
            if not rule:
                record = self._build_suspended_record(
                    txn,
                    JudgmentReason.MANUAL_REVIEW,
                    f"未找到商户{txn.merchant_id}的费率规则",
                    "请补全该商户的费率配置后重新处理",
                    None
                )
                results.append(record)
                stats["suspended"] += 1
                continue
            
            if txn.txn_type == TransactionType.PAYMENT:
                record = self._build_normal_record(txn, rule)
                stats["matched"] += 1
            elif txn.txn_type == TransactionType.REFUND:
                record = self._process_refund(txn, rule)
                if record.status == SettlementStatus.MATCHED:
                    stats["matched"] += 1
                else:
                    stats["suspended"] += 1
            else:
                record = self._build_suspended_record(
                    txn,
                    JudgmentReason.MANUAL_REVIEW,
                    f"未知交易类型: {txn.txn_type.value}",
                    "请人工确认交易类型和处理方式",
                    rule
                )
                stats["suspended"] += 1
            
            if txn.amount > PENDING_AMOUNT_THRESHOLD and record.status == SettlementStatus.SUSPENDED:
                record.judgment_reason = JudgmentReason.OVER_THRESHOLD
                record.judgment_detail += f"（金额超过{PENDING_AMOUNT_THRESHOLD}元阈值，重点关注）"
                record.next_step = "【高优先级】" + record.next_step
            
            results.append(record)
        
        return results, stats

    def _build_historical_record(self, txn: Transaction) -> SettlementRecord:
        history = DataIO.load_settlement_history()
        records = history.get(txn.txn_id, [])
        
        if records:
            latest = records[-1]
            return SettlementRecord(
                settlement_id=latest["settlement_id"],
                txn_id=txn.txn_id,
                order_id=txn.order_id,
                card_no=txn.card_no,
                original_amount=txn.amount,
                rate_applied=latest["rate_applied"],
                fee_amount=latest["fee_amount"],
                settlement_amount=latest["settlement_amount"],
                status=SettlementStatus(latest["status"]),
                judgment_reason=JudgmentReason(latest["judgment_reason"]),
                judgment_detail=latest["judgment_detail"] + "【历史记录，跳过】",
                next_step="该交易已处理，保持原清算结果",
                rate_version=latest["rate_version"],
                created_at=datetime.fromisoformat(latest["created_at"]),
                batch_id=latest.get("batch_id", ""),
                is_historical=True
            )
        
        return SettlementRecord(
            settlement_id=f"HIST_{txn.txn_id}",
            txn_id=txn.txn_id,
            order_id=txn.order_id,
            card_no=txn.card_no,
            original_amount=txn.amount,
            rate_applied=0,
            fee_amount=0,
            settlement_amount=0,
            status=SettlementStatus.PENDING,
            judgment_reason=JudgmentReason.DUPLICATE_RECORD,
            judgment_detail="历史记录",
            next_step="历史记录",
            rate_version="",
            is_historical=True
        )
