from datetime import datetime, date
from typing import List, Dict, Optional, Tuple
from .db import DataStore
from .models import Transaction, Member, generate_id, generate_hash
import copy

class BusinessError(Exception):
    pass

class Engine:
    def __init__(self, data_store: DataStore):
        self.db = data_store

    def _parse_date(self, date_str: str) -> date:
        return datetime.strptime(date_str, "%Y-%m-%d").date()

    def _check_duplicate(self, member_id: str, date: str, start_time: str, end_time: str, tx_type: str) -> Optional[Dict]:
        """检查是否有重复提交的交易（基于时间和内容的 Hash）。"""
        existing_txs = self.db.get_transactions()
        # 生成基于关键信息的 hash，如果之前确认过，应该能匹配到
        # 注意：这里只检查已确认的
        h = generate_hash(member_id, date, start_time, end_time, tx_type)
        
        for tx in existing_txs:
            if tx.get("source_hash") == h and tx.get("status") == "confirmed":
                return tx
        return None

    def _check_ref_duplicate(self, ref_id: str) -> Optional[Dict]:
        """检查补录或加时是否已经针对同一原始预约操作过。"""
        if not ref_id:
            return None
        existing_txs = self.db.get_transactions()
        for tx in existing_txs:
            if tx.get("ref_id") == ref_id and tx.get("status") == "confirmed":
                return tx
        return None

    def _is_monthly_valid(self, member_id: str, usage_date: str) -> bool:
        """检查会员在指定日期是否有有效的包月权益。"""
        packages = self.db.get_packages()
        usage_dt = self._parse_date(usage_date)
        
        valid_monthly = [
            p for p in packages 
            if p["member_id"] == member_id 
            and p["type"] == "monthly" 
            and p["status"] == "active"
        ]
        
        for p in valid_monthly:
            if p["start_date"] and p["end_date"]:
                start = self._parse_date(p["start_date"])
                end = self._parse_date(p["end_date"])
                if start <= usage_dt <= end:
                    return True
        return False

    def get_member_balance(self, member_id: str) -> float:
        """当前会员剩余可用课时（优先看 Member 快照，这里直接读数据库）。"""
        members = self.db.get_members()
        m = next((x for x in members if x["member_id"] == member_id), None)
        return m["balance_hours"] if m else 0.0

    def _create_preview_tx(self, 
                           member_id: str, 
                           tx_type: str, 
                           date: str, 
                           duration_min: float, 
                           start_time: str, 
                           end_time: str,
                           ref_id: str = "",
                           notes: str = "",
                           operator: str = "system",
                           no_show: bool = False, # 预约取消扣课时
                           ignore_balance: bool = False # 强制核销（余额不足）
                           ) -> Tuple[Transaction, Dict]:
        """
        核心逻辑：生成预览交易记录。
        返回：(Transaction对象, 报告字典)
        """
        members = self.db.get_members()
        member = next((m for m in members if m["member_id"] == member_id), None)
        
        if not member:
            raise BusinessError(f"会员 {member_id} 不存在")

        # 0. 高优先级检查：去重检查 (必须放在最前面，防止误判余额不足而掩盖了重复操作)
        dup = self._check_duplicate(member_id, date, start_time, end_time, tx_type)
        if dup:
            raise BusinessError(f"操作重复：检测到已存在相同的确认记录 (TX: {dup['tx_id']})")
        
        if ref_id:
            dup_ref = self._check_ref_duplicate(ref_id)
            if dup_ref:
                raise BusinessError(f"操作重复：针对原预约 {ref_id} 已经有过确认操作 (TX: {dup_ref['tx_id']})")

        # 1. 计算扣减金额 (小时)
        amount_hours = -(duration_min / 60.0)
        
        # 2. 检查包月权益
        has_monthly = self._is_monthly_valid(member_id, date)
        
        balance_before = self.get_member_balance(member_id)
        balance_after = balance_before
        requires_review = False
        review_reason = ""
        effective_amount = 0.0

        report = {
            "member_name": member["name"],
            "has_monthly": has_monthly,
            "original_balance": balance_before,
            "calculated_deduction": abs(amount_hours),
        }

        # 逻辑分支
        if has_monthly:
            # 包月用户：不扣余额，但记录时长
            effective_amount = 0.0
            review_reason = "包月权益核销"
        elif no_show:
            # 预约取消（No-show）：必须扣课时
            effective_amount = amount_hours
            review_reason = "预约未到/取消扣课时"
            if balance_before + effective_amount < 0:
                requires_review = True
                review_reason = "取消扣课时导致余额不足"
        else:
            # 普通扣减
            effective_amount = amount_hours
            if balance_before + effective_amount < 0:
                if ignore_balance:
                    requires_review = True
                    review_reason = "余额不足，强制核销（需人工审核）"
                else:
                    raise BusinessError(f"余额不足。当前余额: {balance_before} 小时, 需要: {abs(amount_hours)} 小时。请使用 --force 标记并联系财务。")

        balance_after = balance_before + effective_amount

        # 构建 Transaction
        tx = Transaction(
            tx_id=generate_id("TX"),
            member_id=member_id,
            type=tx_type,
            status="pending",
            date=date,
            start_time=start_time,
            end_time=end_time,
            duration=duration_min,
            ref_id=ref_id,
            source_hash=generate_hash(member_id, date, start_time, end_time, tx_type),
            amount=effective_amount,
            balance_before=balance_before,
            balance_after=balance_after,
            requires_review=requires_review,
            review_reason=review_reason,
            operator=operator,
            notes=notes
        )

        report["new_balance"] = balance_after
        report["requires_review"] = requires_review
        report["review_reason"] = review_reason
        
        return tx, report

    def preview(self, **kwargs) -> Tuple[Transaction, Dict]:
        """公开的预览接口"""
        return self._create_preview_tx(**kwargs)

    def confirm(self, tx: Transaction) -> Dict:
        """
        确认交易：更新会员余额，保存 Transaction。
        再次检查去重，防止并发问题。
        """
        # 再次检查重复（虽然 Preview 查过，但 Confirm 是写入点）
        # 这里简化处理，实际系统需锁
        existing_hash = self._check_duplicate(tx.member_id, tx.date, tx.start_time, tx.end_time, tx.type)
        existing_ref = self._check_ref_duplicate(tx.ref_id) if tx.ref_id else None

        if existing_hash or existing_ref:
            raise BusinessError("确认失败：该操作已被其他进程确认。")

        # 更新状态
        tx.status = "confirmed"
        tx.confirmed_at = datetime.now().isoformat()

        # 更新会员余额
        members = self.db.get_members()
        for i, m in enumerate(members):
            if m["member_id"] == tx.member_id:
                members[i]["balance_hours"] = tx.balance_after
                self.db._write_json(self.db.members_file, members)
                break
        
        # 保存交易
        self.db.save_transaction(tx.to_dict())
        
        return {"success": True, "tx_id": tx.tx_id}

    def get_history(self, member_id: Optional[str] = None, status: Optional[str] = None) -> List[Dict]:
        txs = self.db.get_transactions()
        if member_id:
            txs = [t for t in txs if t["member_id"] == member_id]
        if status:
            txs = [t for t in txs if t["status"] == status]
        return sorted(txs, key=lambda x: x["created_at"], reverse=True)

    def get_review_list(self) -> List[Dict]:
        return [t for t in self.db.get_transactions() if t.get("requires_review") and t.get("status") == "confirmed"]

    def get_all_members_status(self) -> List[Dict]:
        members = self.db.get_members()
        # 加入最近交易时间等丰富信息
        txs = self.db.get_transactions()
        
        summary = []
        for m in members:
            last_tx = next((t for t in reversed(txs) if t["member_id"] == m["member_id"]), None)
            summary.append({
                "member_id": m["member_id"],
                "name": m["name"],
                "phone": m["phone"],
                "balance_hours": m["balance_hours"],
                "status": m["status"],
                "last_activity": last_tx["date"] if last_tx else "N/A"
            })
        return summary
