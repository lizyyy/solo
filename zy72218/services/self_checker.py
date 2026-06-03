from typing import List, Dict, Optional, Any, Tuple
from collections import defaultdict
from datetime import datetime

from models import (
    SelfCheckResult,
    SelfCheckType,
    FundMatchRecord,
    Invoice,
    HolidayExtension,
    TailAdjustment,
    RecordType,
    MatchStatus,
)
from repository import MatchRepository


class SelfChecker:
    def __init__(self, repository: Optional[MatchRepository] = None):
        self.repo = repository or MatchRepository()

    def run_all_checks(self) -> List[SelfCheckResult]:
        results = []
        results.extend(self.check_duplicate_imports())
        results.extend(self.check_split_records())
        results.extend(self.check_recalculation())
        results.extend(self.check_export_consistency())
        for result in results:
            self.repo.add_self_check_result(result)
        return results

    def check_duplicate_imports(self) -> List[SelfCheckResult]:
        results = []
        invoice_duplicates = self._find_duplicate_invoices()
        holiday_duplicates = self._find_duplicate_holiday_extensions()
        tail_duplicates = self._find_duplicate_tail_adjustments()

        all_duplicates = {**invoice_duplicates, **holiday_duplicates, **tail_duplicates}

        if not all_duplicates:
            results.append(
                SelfCheckResult(
                    check_type=SelfCheckType.DUPLICATE_IMPORT,
                    passed=True,
                    message="未检测到重复导入记录",
                )
            )
            return results

        for key, info in all_duplicates.items():
            results.append(
                SelfCheckResult(
                    check_type=SelfCheckType.DUPLICATE_IMPORT,
                    passed=False,
                    business_no=info.get("business_no"),
                    message=f"检测到重复导入: {info['description']}",
                    details={
                        "duplicate_key": key,
                        "duplicate_count": info["count"],
                        "record_ids": info["record_ids"],
                        "import_batches": info["import_batches"],
                        "data_type": info["data_type"],
                    },
                )
            )

        return results

    def check_split_records(self) -> List[SelfCheckResult]:
        results = []
        business_no_groups = self._find_split_record_groups()

        if not business_no_groups:
            results.append(
                SelfCheckResult(
                    check_type=SelfCheckType.SPLIT_RECORD,
                    passed=True,
                    message="未检测到同一业务号拆分行",
                )
            )
            return results

        for business_no, records in business_no_groups.items():
            has_principal = any(r.record_type == RecordType.PRINCIPAL for r in records)
            has_fee = any(r.record_type == RecordType.FEE for r in records)
            has_related_ids = all(r.related_record_id is not None for r in records if r.record_type != RecordType.COMBINED)

            is_valid = has_principal and has_fee and has_related_ids and len(records) >= 2

            principal_amount = sum(r.expected_amount for r in records if r.record_type == RecordType.PRINCIPAL)
            fee_amount = sum(r.expected_amount for r in records if r.record_type == RecordType.FEE)
            combined_amount = sum(r.expected_amount for r in records if r.record_type == RecordType.COMBINED)

            results.append(
                SelfCheckResult(
                    check_type=SelfCheckType.SPLIT_RECORD,
                    passed=is_valid,
                    business_no=business_no,
                    message=(
                        f"业务号 {business_no} 拆分为 {len(records)} 行记录："
                        f"本金 {principal_amount:.2f} 元，手续费 {fee_amount:.2f} 元，"
                        f"合并 {combined_amount:.2f} 元。"
                        + (" 结构正常，待主管复核。" if is_valid else " 结构异常，请检查关联关系。")
                    ),
                    details={
                        "record_count": len(records),
                        "has_principal": has_principal,
                        "has_fee": has_fee,
                        "principal_amount": principal_amount,
                        "fee_amount": fee_amount,
                        "combined_amount": combined_amount,
                        "total_amount": principal_amount + fee_amount + combined_amount,
                        "record_ids": [r.record_id for r in records],
                        "record_types": [r.record_type.value for r in records],
                        "requires_supervisor_review": is_valid,
                    },
                )
            )

        return results

    def check_recalculation(self) -> List[SelfCheckResult]:
        results = []
        needs_recalc = self._find_records_needing_recalculation()

        if not needs_recalc:
            results.append(
                SelfCheckResult(
                    check_type=SelfCheckType.RECALCULATION,
                    passed=True,
                    message="所有记录计算结果一致，无需重算",
                )
            )
            return results

        for business_no, info in needs_recalc.items():
            results.append(
                SelfCheckResult(
                    check_type=SelfCheckType.RECALCULATION,
                    passed=False,
                    business_no=business_no,
                    message=f"业务号 {business_no} 补录后需要重算：{info['reason']}",
                    details={
                        "reason": info["reason"],
                        "original_amount": info["original_amount"],
                        "current_amount": info["current_amount"],
                        "expected_amount": info["expected_amount"],
                        "difference": info["difference"],
                        "affected_record_ids": info["record_ids"],
                        "supplementary_data": info["supplementary_data"],
                    },
                )
            )

        return results

    def check_export_consistency(self) -> List[SelfCheckResult]:
        results = []
        export_data = self.repo.get_match_records_for_export()
        display_data = self.repo.get_match_records_for_display()
        api_data = self.repo.get_match_records_for_api()

        is_consistent, inconsistencies = self._compare_data_sources(export_data, display_data, api_data)

        if is_consistent:
            results.append(
                SelfCheckResult(
                    check_type=SelfCheckType.EXPORT_CONSISTENCY,
                    passed=True,
                    message=f"导出明细、页面展示、接口返回共 {len(export_data)} 条记录完全一致",
                    details={"record_count": len(export_data)},
                )
            )
            return results

        for business_no, info in inconsistencies.items():
            results.append(
                SelfCheckResult(
                    check_type=SelfCheckType.EXPORT_CONSISTENCY,
                    passed=False,
                    business_no=business_no,
                    message=f"业务号 {business_no} 数据源不一致：{info['description']}",
                    details={
                        "export_value": info["export_value"],
                        "display_value": info["display_value"],
                        "api_value": info["api_value"],
                        "field": info["field"],
                        "record_id": info["record_id"],
                    },
                )
            )

        return results

    def _find_duplicate_invoices(self) -> Dict[str, Any]:
        duplicates = {}
        invoice_groups: Dict[Tuple[str, str], List[Invoice]] = defaultdict(list)

        for invoice in self.repo.get_all_invoices():
            key = (invoice.invoice_no, invoice.seller)
            invoice_groups[key].append(invoice)

        for key, invoices in invoice_groups.items():
            if len(invoices) > 1:
                duplicates[f"invoice_{key[0]}"] = {
                    "data_type": "发票",
                    "business_no": invoices[0].business_no,
                    "count": len(invoices),
                    "record_ids": [inv.invoice_id for inv in invoices],
                    "import_batches": list({inv.import_batch for inv in invoices if inv.import_batch}),
                    "description": f"发票号 {key[0]} 重复导入 {len(invoices)} 次",
                }

        return duplicates

    def _find_duplicate_holiday_extensions(self) -> Dict[str, Any]:
        duplicates = {}
        groups: Dict[str, List[HolidayExtension]] = defaultdict(list)

        for ext in self.repo.get_all_holiday_extensions():
            groups[ext.business_no].append(ext)

        for business_no, exts in groups.items():
            active_exts = [e for e in exts if e.is_active]
            if len(active_exts) > 1:
                duplicates[f"holiday_{business_no}"] = {
                    "data_type": "节假日顺延说明",
                    "business_no": business_no,
                    "count": len(active_exts),
                    "record_ids": [e.extension_id for e in active_exts],
                    "import_batches": list({e.import_batch for e in active_exts if e.import_batch}),
                    "description": f"业务号 {business_no} 有 {len(active_exts)} 条有效的节假日顺延说明",
                }

        return duplicates

    def _find_duplicate_tail_adjustments(self) -> Dict[str, Any]:
        duplicates = {}
        groups: Dict[str, List[TailAdjustment]] = defaultdict(list)

        for adj in self.repo.get_all_tail_adjustments():
            groups[adj.business_no].append(adj)

        for business_no, adjs in groups.items():
            active_adjs = [a for a in adjs if a.is_active]
            if len(active_adjs) > 1:
                duplicates[f"tail_{business_no}"] = {
                    "data_type": "尾差调整条",
                    "business_no": business_no,
                    "count": len(active_adjs),
                    "record_ids": [a.adjustment_id for a in active_adjs],
                    "import_batches": list({a.import_batch for a in active_adjs if a.import_batch}),
                    "description": f"业务号 {business_no} 有 {len(active_adjs)} 条有效的尾差调整条",
                }

        return duplicates

    def _find_split_record_groups(self) -> Dict[str, List[FundMatchRecord]]:
        groups: Dict[str, List[FundMatchRecord]] = defaultdict(list)

        for record in self.repo.get_all_match_records():
            if record.record_type in [RecordType.PRINCIPAL, RecordType.FEE]:
                groups[record.business_no].append(record)
            elif record.record_type == RecordType.COMBINED and record.related_record_id:
                groups[record.business_no].append(record)

        return {k: v for k, v in groups.items() if len(v) >= 1}

    def _find_records_needing_recalculation(self) -> Dict[str, Any]:
        needs_recalc = {}

        business_groups: Dict[str, List[FundMatchRecord]] = defaultdict(list)
        for record in self.repo.get_all_match_records():
            business_groups[record.business_no].append(record)

        for business_no, records in business_groups.items():
            holiday = self.repo.get_holiday_extension_by_business_no(business_no)
            tail_adj = self.repo.get_tail_adjustment_by_business_no(business_no)

            if not holiday and not tail_adj:
                continue

            original_matched = sum(r.matched_amount for r in records)
            expected_amount = sum(r.expected_amount for r in records)

            calculated_amount = expected_amount
            supplementary_data = []

            if holiday:
                calculated_amount = calculated_amount * (1 + holiday.extension_days * 0.001)
                supplementary_data.append(f"节假日顺延 {holiday.extension_days} 天")

            if tail_adj:
                calculated_amount += tail_adj.adjustment_amount
                supplementary_data.append(f"尾差调整 {tail_adj.adjustment_amount:.2f} 元")

            difference = abs(original_matched - calculated_amount)
            if difference > 0.001 and supplementary_data:
                needs_recalc[business_no] = {
                    "reason": "存在补录的节假日顺延或尾差调整，金额已变更",
                    "original_amount": original_matched,
                    "current_amount": original_matched,
                    "expected_amount": calculated_amount,
                    "difference": difference,
                    "record_ids": [r.record_id for r in records],
                    "supplementary_data": supplementary_data,
                }

        return needs_recalc

    def _compare_data_sources(
        self,
        export_data: List[Dict[str, Any]],
        display_data: List[Dict[str, Any]],
        api_data: List[Dict[str, Any]],
    ) -> Tuple[bool, Dict[str, Any]]:
        inconsistencies = {}

        if len(export_data) != len(display_data) or len(export_data) != len(api_data):
            inconsistencies["count"] = {
                "description": f"记录数量不一致：导出 {len(export_data)} 条，页面 {len(display_data)} 条，接口 {len(api_data)} 条",
                "export_value": len(export_data),
                "display_value": len(display_data),
                "api_value": len(api_data),
                "field": "record_count",
                "record_id": None,
            }
            return False, inconsistencies

        key_fields = ["record_id", "business_no", "record_type", "expected_amount", "matched_amount", "status", "is_split_record"]

        for i, (export_rec, display_rec, api_rec) in enumerate(zip(export_data, display_data, api_data)):
            for field in key_fields:
                exp_val = export_rec.get(field)
                disp_val = display_rec.get(field)
                api_val = api_rec.get(field)

                if not (exp_val == disp_val == api_val):
                    business_no = export_rec.get("business_no", f"unknown_{i}")
                    inconsistencies[business_no] = {
                        "description": f"字段 {field} 数值不一致",
                        "export_value": exp_val,
                        "display_value": disp_val,
                        "api_value": api_val,
                        "field": field,
                        "record_id": export_rec.get("record_id"),
                    }

        return len(inconsistencies) == 0, inconsistencies
