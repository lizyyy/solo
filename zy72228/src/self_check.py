import hashlib
from datetime import datetime, date
from typing import List, Dict, Any
from .models import (
    CounterFlow,
    MarginRecord,
    SelfCheckResult,
    SelfCheckItem,
    SettlementType,
    RecordSource
)
from .conflict_detector import ConflictDetector


class SelfChecker:
    def __init__(self, conflict_detector: ConflictDetector):
        self.conflict_detector = conflict_detector
        self.import_history: List[Dict[str, Any]] = []
        self.export_history: List[Dict[str, Any]] = []

    def run_all_checks(
        self,
        current_flows: List[CounterFlow],
        current_records: List[MarginRecord],
        original_flows: List[CounterFlow] = None
    ) -> SelfCheckResult:
        result = SelfCheckResult()
        
        result.add_item(self.check_duplicate_import(current_flows, current_records))
        result.add_item(self.check_t1_to_t2_modification(current_flows, original_flows or []))
        result.add_item(self.check_supplement_recalculation(current_records))
        result.add_item(self.check_export_consistency(current_flows, current_records))
        
        return result

    def check_duplicate_import(
        self,
        flows: List[CounterFlow],
        records: List[MarginRecord]
    ) -> SelfCheckItem:
        duplicates = []
        details = []
        flow_id_count: Dict[str, int] = {}
        
        for flow in flows:
            flow_id_count[flow.flow_id] = flow_id_count.get(flow.flow_id, 0) + 1
        
        for flow_id, count in flow_id_count.items():
            if count > 1:
                duplicates.append(flow_id)
                details.append(f"流水号 {flow_id} 出现 {count} 次")
        
        record_id_count: Dict[str, int] = {}
        for record in records:
            key = f"{record.trade_date}_{record.amount}_{record.direction}"
            record_id_count[key] = record_id_count.get(key, 0) + 1
        
        for key, count in record_id_count.items():
            if count > 1:
                details.append(f"保证金记录 {key} 出现 {count} 次")
        
        passed = len(duplicates) == 0 and len(details) == 0
        
        if passed:
            message = "✅ 重复导入检查通过，没有发现重复数据"
        else:
            message = f"❌ 发现重复导入数据"
        
        return SelfCheckItem(
            check_name="重复导入检查",
            check_type="数据一致性",
            passed=passed,
            message=message,
            details=details if details else ["无重复数据"],
            affected_records=duplicates
        )

    def check_t1_to_t2_modification(
        self,
        current_flows: List[CounterFlow],
        original_flows: List[CounterFlow]
    ) -> SelfCheckItem:
        modifications = []
        details = []
        original_map = {f.flow_id: f for f in original_flows}
        
        for flow in current_flows:
            original = original_map.get(flow.flow_id)
            if not original:
                continue
            
            if (original.settlement_type == SettlementType.T1 and
                flow.settlement_type == SettlementType.T2 and
                flow.is_manual_modified):
                modifications.append(flow.flow_id)
                modified_by = flow.modified_by or "未知用户"
                modified_time = flow.modified_time.strftime('%Y-%m-%d %H:%M') if flow.modified_time else "未知时间"
                details.append(
                    f"流水号 {flow.flow_id}: 由 {modified_by} 在 {modified_time} 将 T+1 改为 T+2，需要基金经理复核"
                )
        
        passed = len(modifications) == 0
        
        if passed:
            message = "✅ T+1→T+2 修改检查通过"
        else:
            message = f"⚠️  发现 {len(modifications)} 笔手工修改到账类型，请基金经理复核"
        
        return SelfCheckItem(
            check_name="T+1→T+2手工修改检测",
            check_type="合规检查",
            passed=passed,
            message=message,
            details=details if details else ["没有发现手工修改"],
            affected_records=modifications
        )

    def check_supplement_recalculation(
        self,
        records: List[MarginRecord]
    ) -> SelfCheckItem:
        issues = []
        details = []
        
        supplement_records = [r for r in records if r.source == RecordSource.SUPPLEMENT]
        normal_records = [r for r in records if r.source != RecordSource.SUPPLEMENT]
        
        for supp in supplement_records:
            linked = [r for r in normal_records if r.linked_flow_id == supp.linked_flow_id]
            
            if not linked:
                continue
            
            for rec in linked:
                if rec.approval_status.value in ["待确认", "已确认"]:
                    if rec.version < supp.version:
                        issues.append(supp.record_id)
                        details.append(
                            f"补录记录 {supp.record_id} 对应的原始记录需要重新计算"
                        )
        
        passed = len(issues) == 0
        
        if passed:
            message = "✅ 补录后重算检查通过"
        else:
            message = f"⚠️  发现需要重算的记录"
        
        return SelfCheckItem(
            check_name="补录后重算检查",
            check_type="数据一致性",
            passed=passed,
            message=message,
            details=details if details else ["所有补录记录已正确关联"],
            affected_records=issues
        )

    def check_export_consistency(
        self,
        flows: List[CounterFlow],
        records: List[MarginRecord]
    ) -> SelfCheckItem:
        issues = []
        details = []
        
        flow_amounts = {}
        for flow in flows:
            key = flow.trade_date
            flow_amounts[key] = flow_amounts.get(key, 0) + flow.amount
        
        record_amounts = {}
        for record in records:
            key = record.trade_date
            direction = 1 if record.direction == "缴" else -1
            record_amounts[key] = record_amounts.get(key, 0) + record.amount * direction
        
        all_dates = set(flow_amounts.keys()) | set(record_amounts.keys())
        
        for trade_date in sorted(all_dates):
            flow_total = flow_amounts.get(trade_date, 0)
            record_total = record_amounts.get(trade_date, 0)
            
            if abs(flow_total - record_total) > 0.01:
                issues.append(str(trade_date))
                details.append(
                    f"{trade_date.strftime('%Y-%m-%d')}: 柜台流水合计 {flow_total:,.2f} vs 保证金记录合计 {record_total:,.2f}")
        
        passed = len(issues) == 0
        
        if passed:
            message = "✅ 导出一致性检查通过"
        else:
            message = f"❌ 柜台流水与保证金记录不一致"
        
        return SelfCheckItem(
            check_name="导出一致性检查",
            check_type="数据一致性",
            passed=passed,
            message=message,
            details=details if details else ["各日期数据一致"],
            affected_records=issues
        )

    def record_import(self, flows: List[CounterFlow], records: List[MarginRecord]):
        import_hash = self._calculate_import_hash(flows, records)
        self.import_history.append({
            "time": datetime.now(),
            "hash": import_hash,
            "flow_count": len(flows),
            "record_count": len(records)
        })

    def record_export(self, export_data: Dict[str, Any]):
        export_hash = hashlib.md5(
            str(export_data).encode()
        ).hexdigest()
        self.export_history.append({
            "time": datetime.now(),
            "hash": export_hash,
            "data": export_data
        })

    def _calculate_import_hash(
        self,
        flows: List[CounterFlow],
        records: List[MarginRecord]
    ) -> str:
        flow_ids = sorted([f.flow_id for f in flows])
        record_ids = sorted([r.record_id for r in records])
        combined = str(flow_ids + record_ids).encode()
        return hashlib.md5(combined).hexdigest()

    def format_check_result(self, result: SelfCheckResult) -> str:
        lines = [
            "=" * 60,
            "📋 大宗商品保证金联动 - 自检报告",
            "=" * 60,
            f"检查时间: {result.check_time.strftime('%Y-%m-%d %H:%M:%S')}",
            f"总检查项: {result.total_checks}",
            f"通过: {result.passed_checks} | 失败: {result.failed_checks}",
            f"整体结果: {'✅ 通过' if result.overall_passed else '❌ 有问题需处理'}",
            "",
        ]
        
        for item in result.check_items:
            status_icon = "✅" if item.passed else "❌"
            lines.append(f"{status_icon} {item.check_name}")
            lines.append(f"   类型: {item.check_type}")
            lines.append(f"   结果: {item.message}")
            if item.details:
                lines.append("   详情:")
                for detail in item.details[:5]:
                    lines.append(f"      - {detail}")
                if len(item.details) > 5:
                    lines.append(f"      ... 还有 {len(item.details) - 5} 条更多")
            lines.append("")
        
        lines.append("=" * 60)
        
        return "\n".join(lines)

    def get_failed_checks(self, result: SelfCheckResult) -> List[SelfCheckItem]:
        return [item for item in result.check_items if not item.passed]

    def generate_report_summary(self, result: SelfCheckResult) -> Dict[str, Any]:
        return {
            "检查时间": result.check_time.strftime('%Y-%m-%d %H:%M:%S'),
            "总检查项": result.total_checks,
            "通过项数": result.passed_checks,
            "失败项数": result.failed_checks,
            "整体状态": "通过" if result.overall_passed else "未通过",
            "未通过项": [
            {
                "检查项": item.check_name,
                "问题描述": item.message,
                "影响记录": item.affected_records
            }
            for item in result.check_items if not item.passed
        ]
    }
