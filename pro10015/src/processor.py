import pandas as pd
from typing import List, Dict, Tuple
from datetime import datetime
from collections import defaultdict
from .models import (
    ManagerNote, CounterTransaction, ValuationRecord,
    DisputeMatchResult, DisputeStatus
)


class DisputeFreezeAlert:
    def __init__(self):
        self.manager_notes: List[ManagerNote] = []
        self.counter_trans: List[CounterTransaction] = []
        self.valuation_records: List[ValuationRecord] = []
        self.results: List[DisputeMatchResult] = []

    def load_manager_notes_from_dataframe(self, df: pd.DataFrame, keep_original_line: bool = True) -> None:
        self.manager_notes = []
        for idx, row in df.iterrows():
            original_line = idx + 2 if keep_original_line else idx + 1
            note = ManagerNote(
                original_line_no=original_line,
                customer_id=str(row.get("customer_id", "")),
                customer_name=str(row.get("customer_name", "")),
                account_no=str(row.get("account_no", "")),
                dispute_amount=float(row.get("dispute_amount", 0)),
                note=str(row.get("note", "")),
                manager=str(row.get("manager", "")),
                record_time=pd.to_datetime(row.get("record_time", datetime.now())),
                frozen=bool(row.get("frozen", False))
            )
            self.manager_notes.append(note)

    def load_counter_trans_from_dataframe(self, df: pd.DataFrame) -> None:
        self.counter_trans = []
        for _, row in df.iterrows():
            trans = CounterTransaction(
                trans_id=str(row.get("trans_id", "")),
                customer_id=str(row.get("customer_id", "")),
                customer_name=str(row.get("customer_name", "")),
                account_no=str(row.get("account_no", "")),
                trans_amount=float(row.get("trans_amount", 0)),
                trans_type=str(row.get("trans_type", "")),
                trans_time=pd.to_datetime(row.get("trans_time", datetime.now())),
                operator=str(row.get("operator", ""))
            )
            self.counter_trans.append(trans)

    def load_valuation_records_from_dataframe(self, df: pd.DataFrame, keep_manual_note: bool = True) -> None:
        self.valuation_records = []
        for _, row in df.iterrows():
            record = ValuationRecord(
                valuation_id=str(row.get("valuation_id", "")),
                customer_id=str(row.get("customer_id", "")),
                account_no=str(row.get("account_no", "")),
                dispute_amount=float(row.get("dispute_amount", 0)),
                valuation_amount=float(row.get("valuation_amount", 0)),
                version=int(row.get("version", 1)),
                manual_note=str(row.get("manual_note", "")) if keep_manual_note else "",
                valuator=str(row.get("valuator", "")),
                valuation_time=pd.to_datetime(row.get("valuation_time")) if pd.notna(row.get("valuation_time")) else None
            )
            self.valuation_records.append(record)

    def match_and_analyze(self) -> List[DisputeMatchResult]:
        self.results = []
        
        customer_groups = self._group_by_customer()
        
        for customer_id, data in customer_groups.items():
            result = self._analyze_customer(customer_id, data)
            self.results.append(result)
        
        return self.results

    def _group_by_customer(self) -> Dict[str, Dict]:
        groups = defaultdict(lambda: {
            "notes": [],
            "trans": [],
            "valuations": [],
            "name": ""
        })
        
        for note in self.manager_notes:
            groups[note.customer_id]["notes"].append(note)
            groups[note.customer_id]["name"] = note.customer_name
        
        for trans in self.counter_trans:
            groups[trans.customer_id]["trans"].append(trans)
            if not groups[trans.customer_id]["name"]:
                groups[trans.customer_id]["name"] = trans.customer_name
        
        for val in self.valuation_records:
            groups[val.customer_id]["valuations"].append(val)
        
        return groups

    def _analyze_customer(self, customer_id: str, data: Dict) -> DisputeMatchResult:
        notes = data["notes"]
        trans = data["trans"]
        valuations = data["valuations"]
        customer_name = data["name"]
        
        impact_accounts = sorted(list(set(
            [n.account_no for n in notes] + 
            [t.account_no for t in trans] +
            [v.account_no for v in valuations]
        )))
        
        total_dispute = sum(n.dispute_amount for n in notes)
        
        conflicts = []
        status = DisputeStatus.NORMAL
        
        note_accounts = set(n.account_no for n in notes)
        trans_accounts = set(t.account_no for t in trans)
        
        if note_accounts != trans_accounts:
            only_in_notes = note_accounts - trans_accounts
            only_in_trans = trans_accounts - note_accounts
            if only_in_notes:
                conflicts.append(f"客户经理备注存在但柜台流水缺失的账号: {', '.join(only_in_notes)}")
            if only_in_trans:
                conflicts.append(f"柜台流水存在但客户经理备注缺失的账号: {', '.join(only_in_trans)}")
        
        for note in notes:
            matching_trans = [t for t in trans if t.account_no == note.account_no]
            trans_total = sum(t.trans_amount for t in matching_trans if t.trans_type == "冻结")
            if abs(note.dispute_amount - trans_total) > 0.01:
                conflicts.append(
                    f"账号 {note.account_no} 争议款金额不匹配: "
                    f"备注{note.dispute_amount:.2f} vs 流水{trans_total:.2f} "
                    f"(备注行号: {note.original_line_no})"
                )
        
        for val in valuations:
            matching_notes = [n for n in notes if n.account_no == val.account_no]
            if matching_notes:
                note_amount = sum(n.dispute_amount for n in matching_notes)
                if abs(note_amount - val.valuation_amount) > 0.01:
                    conflicts.append(
                        f"账号 {val.account_no} 估值金额不匹配: "
                        f"备注{note_amount:.2f} vs 估值{val.valuation_amount:.2f} "
                        f"(估值版本: v{val.version})"
                    )
            if not val.manual_note:
                conflicts.append(f"账号 {val.account_no} 估值版本 v{val.version} 缺少人工备注")
        
        if len(impact_accounts) > 1:
            conflicts.append(f"客户涉及 {len(impact_accounts)} 个账号，影响范围需关注: {', '.join(impact_accounts)}")
        
        if conflicts:
            status = DisputeStatus.CONFLICT if len(conflicts) > 2 else DisputeStatus.PENDING
        
        summary = self._generate_summary(customer_name, status, impact_accounts, total_dispute, conflicts)
        
        return DisputeMatchResult(
            customer_id=customer_id,
            customer_name=customer_name,
            status=status,
            manager_notes=notes,
            counter_trans=trans,
            valuation_records=valuations,
            conflict_details=conflicts,
            impact_accounts=impact_accounts,
            total_dispute_amount=total_dispute,
            summary=summary
        )

    def _generate_summary(self, name: str, status: DisputeStatus, 
                          accounts: List[str], amount: float, 
                          conflicts: List[str]) -> str:
        status_text = {
            DisputeStatus.NORMAL: "数据一致，无异常",
            DisputeStatus.PENDING: "存在待确认项",
            DisputeStatus.CONFLICT: "存在数据冲突",
            DisputeStatus.ABNORMAL: "数据异常"
        }
        
        parts = [
            f"客户: {name}",
            f"状态: {status_text.get(status, status)}",
            f"涉及账号: {len(accounts)}个",
            f"争议款总额: {amount:.2f}元"
        ]
        
        if conflicts:
            parts.append(f"待确认/冲突项: {len(conflicts)}项")
        
        return " | ".join(parts)
