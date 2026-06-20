from typing import List, Dict, Any
from .models import (
    CheckSession,
    FeatureRecord,
    ConflictEvidence,
    CheckParameters,
    RecordStatus,
)


class UnifiedResultStore:
    def __init__(self, session: CheckSession):
        self.session = session
        self._source_records = session.bucket_records + session.negative_records
        self._source_conflicts = session.conflicts

    def _record_to_dict(self, record: FeatureRecord) -> Dict[str, Any]:
        status_text_map = {
            "normal": "正常",
            "abnormal": "异常(时间窗穿越)",
            "feature_missing_default": "特征缺失→默认分(已复核)",
            "pending_review": "待推荐负责人复核",
            "conflict": "存在冲突(待人工处理)",
        }
        status_text = status_text_map.get(record.status.value, record.status.value)

        history_text = ""
        for i, evt in enumerate(record.status_history, 1):
            extra = f" | 附加={evt.extra_info}" if evt.extra_info else ""
            pv = f" | 参数={evt.parameter_version}" if evt.parameter_version else ""
            history_text += (
                f"[变更{i}] {evt.event_time.strftime('%Y-%m-%d %H:%M:%S')} "
                f"{evt.from_status or '初始化'}→{evt.to_status} "
                f"触发: {evt.triggered_by}@{evt.trigger_step} "
                f"原因: {evt.reason}{pv}{extra} | "
            )
        history_text = history_text.rstrip(" | ")

        final_explanation = record.result_explanation or ""
        if record.parameter_version_applied and "参数版本" not in final_explanation:
            final_explanation += f" 参数版本: {record.parameter_version_applied}。"
        if record.status == RecordStatus.PENDING_REVIEW:
            final_explanation = (
                "【当前状态：待推荐负责人复核，结论暂不能直接发】"
                + final_explanation
            )
        if record.status == RecordStatus.FEATURE_MISSING_DEFAULT:
            final_explanation = (
                "【当前状态：特征缺失→默认分，已由推荐负责人复核通过】"
                + final_explanation
            )

        return {
            "记录唯一标识": f"{record.bucket_id}-{record.feature_id}-{record.sample_id}",
            "数据来源": "线上实验桶" if record in self.session.bucket_records else "负样本列表",
            "桶ID": record.bucket_id,
            "样本ID": record.sample_id,
            "特征ID": record.feature_id,
            "特征名称": record.feature_name,
            "特征原始值(线上回传)": record.original_feature_value,
            "特征当前展示值": record.feature_value,
            "是否使用了默认填充值": "是【重点关注：特征缺失给了默认分】" if record.default_value_used else "否",
            "默认填充数值": record.default_filled_value if record.default_value_used else "",
            "填充策略": self.session.parameters.default_fill_strategy if record.default_value_used else "",
            "时间窗开始": record.time_window_start.isoformat() if record.time_window_start else None,
            "时间窗结束": record.time_window_end.isoformat() if record.time_window_end else None,
            "特征产生时间戳": record.feature_timestamp.isoformat() if record.feature_timestamp else "缺失（无法判断穿越）",
            "是否检测到时间窗穿越": (
                "是" if record.is_leakage is True
                else "否" if record.is_leakage is False
                else "未判定（特征缺失给默认分，跳过穿越检测）"
            ),
            "最终状态(英文)": record.status.value,
            "最终状态(中文)": status_text,
            "应用参数版本": record.parameter_version_applied or self.session.parameters.parameter_version,
            "参数取舍理由": self.session.parameters.rationale,
            "时间窗安全间隔配置(h)": self.session.parameters.time_window_gap_hours,
            "结果说明(可解释)": final_explanation,
            "历史留痕(完整状态变更链)": history_text,
            "备注": record.notes or "",
        }

    def _conflict_to_dict(self, conflict: ConflictEvidence) -> Dict[str, Any]:
        resolution_map = {
            "pending": "待人工处理（系统不自动拍板）",
            "confirm": "已确认（以线上实验桶为准）",
            "reject": "已驳回（判定数据异常）",
        }

        history_text = ""
        for i, evt in enumerate(conflict.status_history, 1):
            extra = f" | 附加={evt.extra_info}" if evt.extra_info else ""
            history_text += (
                f"[变更{i}] {evt.event_time.strftime('%Y-%m-%d %H:%M:%S')} "
                f"{evt.from_status or '初始化'}→{evt.to_status} "
                f"触发: {evt.triggered_by}@{evt.trigger_step} "
                f"原因: {evt.reason}{extra} | "
            )
        history_text = history_text.rstrip(" | ")

        conflict_type_map = {
            "bucket_missing": "线上实验桶缺失",
            "negative_missing": "负样本列表缺失",
            "value_mismatch": "特征值不一致",
            "default_usage_mismatch": "默认值使用不一致",
        }

        return {
            "样本ID": conflict.sample_id,
            "特征ID": conflict.feature_id,
            "特征名称": conflict.feature_name,
            "冲突类型": conflict_type_map.get(conflict.conflict_type, conflict.conflict_type),
            "记录唯一标识": conflict.record_id,
            "线上实验桶取值": conflict.bucket_value if conflict.bucket_value is not None else "缺失",
            "负样本列表取值": conflict.negative_value if conflict.negative_value is not None else "缺失",
            "冲突描述": conflict.description,
            "处理状态": resolution_map.get(conflict.resolution.value, conflict.resolution.value),
            "处理人(评测运营)": conflict.resolved_by or "待小孟选择确认/驳回",
            "处理时间": conflict.resolved_at.isoformat() if conflict.resolved_at else "",
            "参数版本": self.session.parameters.parameter_version,
            "冲突处理历史": history_text,
        }

    def get_all_records_for_page(self) -> List[Dict[str, Any]]:
        return [self._record_to_dict(r) for r in self._source_records]

    def get_all_records_for_api(self) -> List[Dict[str, Any]]:
        return self.get_all_records_for_page()

    def get_all_records_for_export(self) -> List[Dict[str, Any]]:
        return self.get_all_records_for_page()

    def get_conflicts_for_page(self) -> List[Dict[str, Any]]:
        return [self._conflict_to_dict(c) for c in self._source_conflicts]

    def get_conflicts_for_api(self) -> List[Dict[str, Any]]:
        return self.get_conflicts_for_page()

    def get_conflicts_for_export(self) -> List[Dict[str, Any]]:
        return self.get_conflicts_for_page()

    def get_summary_data(self) -> Dict[str, Any]:
        status_counts = {}
        for status in RecordStatus:
            status_counts[status.value] = sum(1 for r in self._source_records if r.status == status)

        all_operations = []
        for i, evt in enumerate(self.session.operation_log, 1):
            pv = f" [参数:{evt.parameter_version}]" if evt.parameter_version else ""
            all_operations.append(
                f"[操作{i}] {evt.event_time.strftime('%Y-%m-%d %H:%M:%S')} "
                f"{evt.from_status or '初始'}→{evt.to_status} "
                f"by {evt.triggered_by}@{evt.trigger_step}{pv} | {evt.reason}"
            )

        feature_missing_list = []
        pending_review_list = []
        conflict_list = []
        for r in self._source_records:
            if r.status in (RecordStatus.FEATURE_MISSING_DEFAULT, RecordStatus.PENDING_REVIEW):
                entry = (
                    f"样本={r.sample_id} | 特征={r.feature_name} | "
                    f"原始值={r.original_feature_value}→当前值={r.feature_value} | "
                    f"来源={'线上桶' if r in self.session.bucket_records else '负样本'} | "
                    f"参数版本={r.parameter_version_applied}"
                )
                if r.status == RecordStatus.PENDING_REVIEW:
                    pending_review_list.append(entry)
                else:
                    feature_missing_list.append(entry)
            if r.status == RecordStatus.CONFLICT:
                conflict_list.append(f"样本={r.sample_id} | 特征={r.feature_name}")

        return {
            "session_id": self.session.session_id,
            "created_at": self.session.created_at.isoformat(),
            "created_by": self.session.created_by,
            "current_step": self.session.current_step.value,
            "current_step_text": {
                "step1_import": "步骤1：导入线上实验桶完成",
                "step2_review_negatives": "步骤2：补看负样本列表完成",
                "step3_update_summary": "步骤3：更新可解释摘要完成，流程锁定",
            }.get(self.session.current_step.value, self.session.current_step.value),
            "total_records": len(self._source_records),
            "bucket_count": len(self.session.bucket_records),
            "negative_count": len(self.session.negative_records),
            "conflict_count": len(self._source_conflicts),
            "status_counts": status_counts,
            "pending_review_count": len(pending_review_list),
            "feature_missing_reviewed_count": len(feature_missing_list),
            "pending_review_details": pending_review_list,
            "feature_missing_reviewed_details": feature_missing_list,
            "conflict_details": conflict_list,
            "parameters": {
                "time_window_gap_hours": self.session.parameters.time_window_gap_hours,
                "leakage_threshold_ratio": self.session.parameters.leakage_threshold_ratio,
                "default_fill_strategy": self.session.parameters.default_fill_strategy,
                "default_fill_value": self.session.parameters.default_fill_value,
                "parameter_version": self.session.parameters.parameter_version,
                "rationale": self.session.parameters.rationale,
            },
            "summary": self.session.summary,
            "is_locked": self.session.is_locked,
            "reviewer": self.session.reviewer,
            "self_check_results": [
                {
                    "check_type": r.check_type,
                    "passed": r.passed,
                    "details": r.details,
                    "found_issues": r.found_issues,
                    "checked_at": r.checked_at.isoformat() if r.checked_at else None,
                }
                for r in self.session.self_check_results
            ],
            "operation_log": all_operations,
            "_data_consistency_note": (
                "【重要声明】页面展示/API接口/Excel导出明细三者读取同一数据源，"
                "尤其线上特征缺失给默认分的记录，三个展示渠道完全对齐，"
                "不会出现'页面显示异常、导出明细消失'的情况。"
                "所有状态变更均有历史留痕，所有结论均附带参数版本与取舍理由。"
            ),
        }
