"""导出模块：导出时必须带冲突原因，不能只在页面上闪一下"""
import json
import csv
import os
from datetime import datetime
from typing import Dict, List, Any
from .conflict_detector import ConflictDetector
from .traceability import Traceability
from .version_manager import VersionManager


class Exporter:
    def __init__(self, base_dir: str):
        self.base_dir = base_dir
        self.export_dir = os.path.join(base_dir, "exports")
        os.makedirs(self.export_dir, exist_ok=True)
        self.conflict_detector = ConflictDetector(base_dir)
        self.traceability = Traceability(base_dir)
        self.version_manager = VersionManager(base_dir)

    def export_version(self, version_id: str, format: str = "json") -> str:
        """导出版本完整信息，包含所有冲突检测结果和来源追溯"""
        version = self.version_manager.get_version(version_id)
        if not version:
            raise ValueError(f"版本 {version_id} 不存在")

        conflicts = self.conflict_detector.detect_all(version_id)
        trace = self.traceability.trace_version(version_id)

        export_data = {
            "export_metadata": {
                "export_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "export_tool": "大模型提示词版本仓库 v1.0",
                "export_reason": self._generate_export_reason(version, conflicts, trace),
                "conflict_summary": conflicts.get("summary", {}),
                "traceability_score": trace.get("traceability_report", {}).get("traceability_score")
            },
            "version_info": version,
            "conflict_detection_results": conflicts,
            "traceability_report": trace,
            "version_diff": self._get_version_diff(version_id)
        }

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"version_{version_id}_full_{timestamp}.{format}"
        filepath = os.path.join(self.export_dir, filename)

        if format == "json":
            with open(filepath, "w", encoding="utf-8") as f:
                json.dump(export_data, f, ensure_ascii=False, indent=2)
        elif format == "csv":
            filepath = self._export_to_csv(export_data, version_id, timestamp)
        else:
            raise ValueError(f"不支持的导出格式: {format}")

        return filepath

    def export_conflicts(self, version_id: str, conflict_type: str = "all") -> str:
        """导出冲突清单"""
        TYPE_KEY_MAP = {
            "label": "label_conflicts",
            "sample_leak": "sample_leaks",
            "version": "version_conflicts",
            "empty": "empty_values",
            "duplicate": "duplicate_records",
            "boundary": "boundary_cases",
        }

        conflicts = self.conflict_detector.detect_all(version_id)
        if "error" in conflicts:
            raise ValueError(conflicts["error"])

        all_conflicts = conflicts.get("conflicts", {})
        all_summary = conflicts.get("summary", {})

        if conflict_type == "all":
            filtered_conflicts = all_conflicts
            filtered_summary = all_summary
        else:
            real_key = TYPE_KEY_MAP.get(conflict_type, conflict_type)
            matched_items = all_conflicts.get(real_key, [])
            filtered_conflicts = {real_key: matched_items}

            breakdown = {}
            severity = {"critical": 0, "high": 0, "medium": 0, "low": 0}
            decision = 0
            for item in matched_items:
                sv = item.get("severity", "medium")
                if sv in severity:
                    severity[sv] += 1
                if item.get("decision_required"):
                    decision += 1
            breakdown[real_key] = len(matched_items)

            filtered_summary = {
                "total_conflicts": len(matched_items),
                "breakdown": breakdown,
                "severity_breakdown": severity,
                "decision_required_count": decision,
            }

        export_data = {
            "export_metadata": {
                "export_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "export_tool": "大模型提示词版本仓库 v1.0",
                "version_id": version_id,
                "conflict_type": conflict_type,
                "real_conflict_key": "all" if conflict_type == "all" else (TYPE_KEY_MAP.get(conflict_type, conflict_type)),
            },
            "summary": filtered_summary,
            "conflicts": filtered_conflicts,
        }

        def _filter_decision(all_conflicts_map, ftype, real_map):
            if ftype == "all":
                return self._get_decision_required_items({"conflicts": all_conflicts_map})
            rk = TYPE_KEY_MAP.get(ftype, ftype)
            items = all_conflicts_map.get(rk, [])
            result = []
            for item in items:
                if item.get("decision_required"):
                    result.append({
                        "conflict_type": rk,
                        "conflict_id": item.get("conflict_id", item.get("case_id")),
                        "case_id": item.get("case_id"),
                        "severity": item.get("severity"),
                        "release_claim": item.get("release_claim"),
                        "actual_data": item.get("actual_data"),
                        "evidence_comparison": item.get("evidence_comparison"),
                        "suggested_actions": item.get("suggested_actions"),
                        "note": item.get("note"),
                    })
            return result

        export_data["decision_required_items"] = _filter_decision(all_conflicts, conflict_type, filtered_conflicts)
        export_data["export_reason"] = self._generate_conflict_export_reason(
            {"summary": filtered_summary, "conflicts": filtered_conflicts}, conflict_type
        )

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"conflicts_{version_id}_{conflict_type}_{timestamp}.json"
        filepath = os.path.join(self.export_dir, filename)

        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(export_data, f, ensure_ascii=False, indent=2)

        return filepath

    def export_manual_reviews(self, version_id: str) -> str:
        """导出人工改判记录，带完整证据链"""
        reviews = self.version_manager.get_manual_reviews(version_id)
        version = self.version_manager.get_version(version_id)

        export_reviews = []
        for review in reviews:
            trace = self.traceability.trace_case(version_id, review["case_id"])
            export_reviews.append({
                "review_info": review,
                "evidence_chain": trace.get("evidence_chain", []),
                "threshold_context": trace.get("threshold_context"),
                "export_reason_note": f"人工改判：{review.get('original_label')} -> {review.get('reviewed_label')}，理由：{review.get('review_reason')}"
            })

        export_data = {
            "export_metadata": {
                "export_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "export_tool": "大模型提示词版本仓库 v1.0",
                "version_id": version_id,
                "total_reviews": len(reviews)
            },
            "version_info": {
                "release_date": version.get("release_date"),
                "release_by": version.get("release_by"),
                "thresholds": version.get("thresholds")
            },
            "manual_reviews": export_reviews,
            "export_reason": f"导出版本{version_id}的{len(reviews)}条人工改判记录，每条都附带来源证据链"
        }

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"manual_reviews_{version_id}_{timestamp}.json"
        filepath = os.path.join(self.export_dir, filename)

        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(export_data, f, ensure_ascii=False, indent=2)

        return filepath

    def export_trace(self, version_id: str, case_id: str) -> str:
        """导出单个案例的完整来源追溯"""
        trace = self.traceability.trace_case(version_id, case_id)
        if "error" in trace:
            raise ValueError(trace["error"])

        export_data = {
            "export_metadata": {
                "export_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "export_tool": "大模型提示词版本仓库 v1.0",
                "version_id": version_id,
                "case_id": case_id
            },
            "trace_result": trace,
            "export_reason": f"追溯案例{case_id}在版本{version_id}中的完整证据链，包含评测日志、标注表、人工改判记录"
        }

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"trace_{version_id}_{case_id}_{timestamp}.json"
        filepath = os.path.join(self.export_dir, filename)

        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(export_data, f, ensure_ascii=False, indent=2)

        return filepath

    def _generate_export_reason(self, version: Dict[str, Any], conflicts: Dict[str, Any], trace: Dict[str, Any]) -> str:
        """生成导出原因说明，确保导出时带着原因"""
        version_id = version.get("version_id", "")
        summary = conflicts.get("summary", {})
        total_conflicts = summary.get("total_conflicts", 0)
        decision_required = summary.get("decision_required_count", 0)
        trace_score = trace.get("traceability_report", {}).get("traceability_score", 0)

        reasons = []
        reasons.append(f"导出版本{version_id}的完整信息")

        if total_conflicts > 0:
            breakdown = summary.get("breakdown", {})
            conflict_details = ", ".join([f"{k}:{v}" for k, v in breakdown.items() if v > 0])
            reasons.append(f"检测到{total_conflicts}处问题（{conflict_details}）")

        if decision_required > 0:
            reasons.append(f"其中{decision_required}处需要人工决策，系统未自动处理")

        if trace_score < 100:
            reasons.append(f"来源可追溯性得分：{trace_score:.1f}%，存在未验证的来源文件")

        severity = summary.get("severity_breakdown", {})
        if severity.get("critical", 0) > 0:
            reasons.append(f"严重警告：存在{severity['critical']}个critical级问题（如样本泄漏）")

        reasons.append("导出内容包含：版本配置、冲突检测结果、来源追溯报告、版本对比")
        return "；".join(reasons)

    def _generate_conflict_export_reason(self, conflicts: Dict[str, Any], conflict_type: str) -> str:
        """生成冲突导出原因"""
        summary = conflicts.get("summary", {})
        total = summary.get("total_conflicts", 0)

        if conflict_type == "all":
            count = total
            reason = f"导出全部{count}个冲突问题，用于人工审核和决策"
        else:
            TYPE_KEY_MAP = {
                "label": "label_conflicts",
                "sample_leak": "sample_leaks",
                "version": "version_conflicts",
                "empty": "empty_values",
                "duplicate": "duplicate_records",
                "boundary": "boundary_cases",
            }
            real_key = TYPE_KEY_MAP.get(conflict_type, conflict_type)
            count = len(conflicts.get("conflicts", {}).get(real_key, []))
            reason = f"导出{conflict_type}类型的{count}个冲突问题"

        decision_required = summary.get("decision_required_count", 0)
        if decision_required > 0:
            reason += f"；其中{decision_required}个需要人工决策，系统仅展示证据对比和建议动作，不自动修改"

        severity = summary.get("severity_breakdown", {})
        if severity.get("critical", 0) > 0 or severity.get("high", 0) > 0:
            high_risk = severity.get("critical", 0) + severity.get("high", 0)
            reason += f"；包含{high_risk}个高优先级问题，请优先处理"

        return reason

    def _get_decision_required_items(self, conflicts: Dict[str, Any]) -> List[Dict[str, Any]]:
        """获取需要人工决策的所有项"""
        decision_items = []
        for conflict_type, items in conflicts.get("conflicts", {}).items():
            for item in items:
                if item.get("decision_required"):
                    decision_items.append({
                        "conflict_type": conflict_type,
                        "conflict_id": item.get("conflict_id", item.get("case_id")),
                        "severity": item.get("severity"),
                        "release_claim": item.get("release_claim"),
                        "actual_data": item.get("actual_data"),
                        "evidence_comparison": item.get("evidence_comparison"),
                        "suggested_actions": item.get("suggested_actions"),
                        "note": item.get("note")
                    })
        return decision_items

    def _get_version_diff(self, version_id: str) -> Dict[str, Any]:
        """获取与上一版本的差异"""
        versions = self.version_manager.list_versions()
        version_ids = [v["version_id"] for v in versions]

        if version_id not in version_ids:
            return {}

        idx = version_ids.index(version_id)
        if idx + 1 >= len(version_ids):
            return {"note": "这是第一个版本，无历史版本可对比"}

        prev_version = version_ids[idx + 1]
        diff = self.version_manager.compare_versions(prev_version, version_id)
        return {
            "compared_with": prev_version,
            "differences": diff
        }

    def _export_to_csv(self, data: Dict[str, Any], version_id: str, timestamp: str) -> str:
        """导出为CSV格式，重点导出冲突和改判记录"""
        filepath = os.path.join(self.export_dir, f"version_{version_id}_summary_{timestamp}.csv")

        conflicts = data.get("conflict_detection_results", {}).get("conflicts", {})

        with open(filepath, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.writer(f)

            writer.writerow(["=== 大模型提示词版本仓库 - 导出报告 ==="])
            writer.writerow(["版本号", version_id])
            writer.writerow(["导出时间", data.get("export_metadata", {}).get("export_time")])
            writer.writerow(["导出原因", data.get("export_metadata", {}).get("export_reason")])
            writer.writerow([])

            writer.writerow(["=== 冲突摘要 ==="])
            summary = data.get("conflict_detection_results", {}).get("summary", {})
            writer.writerow(["问题总数", summary.get("total_conflicts", 0)])
            writer.writerow(["需要人工决策", summary.get("decision_required_count", 0)])
            severity = summary.get("severity_breakdown", {})
            writer.writerow(["Critical级", severity.get("critical", 0)])
            writer.writerow(["High级", severity.get("high", 0)])
            writer.writerow(["Medium级", severity.get("medium", 0)])
            writer.writerow(["Low级", severity.get("low", 0)])
            writer.writerow([])

            writer.writerow(["=== 标签冲突详情 ==="])
            writer.writerow(["案例ID", "案例文本", "预测标签", "预测分数", "标注标签", "标注人", "标注行号", "严重程度", "建议动作"])
            for item in conflicts.get("label_conflicts", []):
                writer.writerow([
                    item.get("case_id"),
                    item.get("case_text"),
                    item.get("pred_label"),
                    item.get("pred_score"),
                    item.get("true_label"),
                    item.get("annotator"),
                    item.get("annotation_line"),
                    item.get("severity"),
                    "; ".join(item.get("suggested_actions", []))
                ])
            writer.writerow([])

            writer.writerow(["=== 版本冲突详情（需要人工决策） ==="])
            writer.writerow(["冲突ID", "冲突类型", "严重程度", "发布记录宣称", "实际数据", "证据对比", "建议动作", "备注"])
            for item in conflicts.get("version_conflicts", []):
                writer.writerow([
                    item.get("conflict_id"),
                    item.get("conflict_type"),
                    item.get("severity"),
                    json.dumps(item.get("release_claim"), ensure_ascii=False),
                    json.dumps(item.get("actual_data"), ensure_ascii=False),
                    json.dumps(item.get("evidence_comparison"), ensure_ascii=False),
                    "; ".join(item.get("suggested_actions", [])),
                    item.get("note")
                ])
            writer.writerow([])

            writer.writerow(["=== 样本泄漏 ==="])
            writer.writerow(["案例ID", "描述", "严重程度", "涉及数据集", "建议动作"])
            for item in conflicts.get("sample_leaks", []):
                writer.writerow([
                    item.get("case_id"),
                    item.get("description"),
                    item.get("severity"),
                    ", ".join(item.get("evidence", {}).get("data_sets_involved", [])),
                    "; ".join(item.get("suggested_actions", []))
                ])
            writer.writerow([])

            writer.writerow(["=== 数据质量问题 ==="])
            writer.writerow(["问题类型", "案例ID", "空字段/重复行数", "行号", "严重程度", "建议动作"])
            for item in conflicts.get("empty_values", []):
                writer.writerow([
                    "空值",
                    item.get("case_id"),
                    ", ".join(item.get("empty_fields", [])),
                    item.get("annotation_line"),
                    item.get("severity"),
                    "; ".join(item.get("suggested_actions", []))
                ])
            for item in conflicts.get("duplicate_records", []):
                writer.writerow([
                    "重复项",
                    item.get("case_id"),
                    item.get("duplicate_count"),
                    ", ".join(map(str, item.get("lines", []))),
                    item.get("severity"),
                    "; ".join(item.get("suggested_actions", []))
                ])
            writer.writerow([])

            writer.writerow(["=== 边界记录 ==="])
            writer.writerow(["案例ID", "案例文本", "预测分数", "边界类型", "边界阈值", "严重程度", "建议动作"])
            for item in conflicts.get("boundary_cases", []):
                writer.writerow([
                    item.get("case_id"),
                    item.get("case_text"),
                    item.get("pred_score"),
                    item.get("boundary_type"),
                    item.get("boundary_threshold"),
                    item.get("severity"),
                    "; ".join(item.get("suggested_actions", []))
                ])

        return filepath
