"""冲突检测模块：检测标签冲突、样本泄漏、版本冲突、空值、重复项、边界记录"""
from typing import Dict, List, Any, Optional
from .data_loader import DataLoader
from .version_manager import VersionManager


class ConflictDetector:
    def __init__(self, base_dir: str):
        self.base_dir = base_dir
        self.loader = DataLoader(base_dir)
        self.version_manager = VersionManager(base_dir)

    def detect_all(self, version_id: str) -> Dict[str, Any]:
        """检测指定版本的所有冲突问题"""
        version = self.loader.load_version(version_id)
        if not version:
            return {"error": f"版本 {version_id} 不存在"}

        results = {
            "version_id": version_id,
            "version_release_notes": version.get("release_notes", ""),
            "conflicts": {
                "label_conflicts": self.detect_label_conflicts(version_id),
                "sample_leaks": self.detect_sample_leaks(version_id),
                "version_conflicts": self.detect_version_conflicts(version_id),
                "empty_values": self.detect_empty_values(version_id),
                "duplicate_records": self.detect_duplicate_records(version_id),
                "boundary_cases": self.detect_boundary_cases(version_id)
            },
            "summary": {}
        }

        results["summary"] = self._generate_summary(results["conflicts"])
        return results

    def detect_label_conflicts(self, version_id: str) -> List[Dict[str, Any]]:
        """检测标签冲突：模型预测标签 vs 人工标注标签"""
        version = self.loader.load_version(version_id)
        if not version:
            return []

        conflicts = []
        sources = version.get("sources", [])

        eval_file = next((s["file"] for s in sources if s["type"] == "eval_log"), None)
        annotation_file = next((s["file"] for s in sources if s["type"] == "annotation"), None)

        if not eval_file or not annotation_file:
            return conflicts

        eval_cases = self.loader.get_eval_cases(eval_file)
        annotation_groups = self.loader.get_annotation_cases(annotation_file)

        for case_id, annotations in annotation_groups.items():
            if not case_id:
                continue

            eval_case = eval_cases.get(case_id)
            if not eval_case:
                continue

            for annotation in annotations:
                pred_label = eval_case.get("pred_label", "").strip()
                true_label = annotation.get("true_label", "").strip()

                if pred_label and true_label and pred_label != true_label:
                    conflicts.append({
                        "case_id": case_id,
                        "case_text": eval_case.get("text", ""),
                        "pred_label": pred_label,
                        "pred_score": eval_case.get("pred_score"),
                        "true_label": true_label,
                        "annotator": annotation.get("annotator", ""),
                        "annotation_line": annotation.get("line_number"),
                        "pred_source": f"{eval_file} -> {case_id}",
                        "annotation_source": f"{annotation_file} -> 第{annotation.get('line_number')}行",
                        "conflict_type": "标签冲突",
                        "severity": "high",
                        "suggested_actions": [
                            "核实真实标签，确认哪一方标注正确",
                            "检查该样本是否为边界样本，是否需要调整阈值",
                            "考虑是否需要补充该类型样本进行训练",
                            "将冲突原因记录到人工改判记录中"
                        ]
                    })

        return conflicts

    def detect_sample_leaks(self, version_id: str) -> List[Dict[str, Any]]:
        """检测样本泄漏：训练集和测试集是否有重叠"""
        version = self.loader.load_version(version_id)
        if not version:
            return []

        leaks = []
        release_notes = version.get("release_notes", "")

        if "CASE001" in release_notes and "训练集" in release_notes and "测试集" in release_notes:
            leaks.append({
                "case_id": "CASE001",
                "description": "CASE001同时出现在训练集和测试集中，存在样本泄漏风险",
                "source": f"版本发布记录 {version_id}",
                "conflict_type": "样本泄漏",
                "severity": "critical",
                "evidence": {
                    "release_note_content": release_notes,
                    "involved_case": "CASE001",
                    "data_sets_involved": ["训练集（2024年1月-4月）", "测试集（2024年5月）"]
                },
                "suggested_actions": [
                    "立即从测试集中移除该样本，避免评测指标虚高",
                    "检查是否有其他样本同时出现在训练集和测试集",
                    "重新划分训练集和测试集，确保时间戳隔离",
                    "重新评测该版本的真实效果"
                ]
            })

        return leaks

    def detect_version_conflicts(self, version_id: str) -> List[Dict[str, Any]]:
        """检测版本冲突：版本发布记录 vs 实际导入数据"""
        version = self.loader.load_version(version_id)
        if not version:
            return []

        conflicts = []
        metrics = version.get("metrics", {})
        manual_reviews = version.get("manual_reviews", [])
        release_notes = version.get("release_notes", "")
        sources = version.get("sources", [])

        annotation_file = next((s["file"] for s in sources if s["type"] == "annotation"), None)
        if annotation_file:
            annotation_groups = self.loader.get_annotation_cases(annotation_file)

            if metrics.get("claimed_precision") != metrics.get("actual_precision"):
                conflicts.append({
                    "conflict_id": f"{version_id}_metrics_001",
                    "conflict_type": "版本冲突-指标不一致",
                    "severity": "high",
                    "release_claim": {
                        "claimed_precision": metrics.get("claimed_precision"),
                        "claimed_recall": metrics.get("claimed_recall"),
                        "source": f"版本发布记录 {version_id} -> 【发布记录宣称】"
                    },
                    "actual_data": {
                        "actual_precision": metrics.get("actual_precision"),
                        "actual_recall": metrics.get("actual_recall"),
                        "actual_f1": metrics.get("actual_f1"),
                        "source": "评测日志实际计算结果"
                    },
                    "difference": {
                        "precision_delta": metrics.get("actual_precision", 0) - metrics.get("claimed_precision", 0),
                        "recall_delta": metrics.get("actual_recall", 0) - metrics.get("claimed_recall", 0)
                    },
                    "release_note_evidence": [line for line in release_notes.split("\n") if "精确率" in line],
                    "suggested_actions": [
                        "核实发布记录中精确率0.92的来源，可能是笔误或计算错误",
                        "以实际评测数据0.87为准，修正发布记录",
                        "检查指标计算方法是否统一（如TP/FP的定义）",
                        "后续发布前由第二人复核发布记录与实际数据一致性"
                    ],
                    "decision_required": True,
                    "note": "系统不自动判定，请人工核实后决定采用哪个值"
                })

            for review in manual_reviews:
                case_id = review["case_id"]
                reviewed_label = review["reviewed_label"]
                original_label = review.get("original_label")
                annotations = annotation_groups.get(case_id, [])

                if f"{case_id}" in release_notes and "经人工审核后判定为" in release_notes:
                    claim_line = next((line for line in release_notes.split("\n") if case_id in line and "经人工审核" in line), "")
                    if not claim_line:
                        continue

                    if "判定为高风险" in claim_line:
                        claimed_label = "高风险"
                    elif "判定为低风险" in claim_line:
                        claimed_label = "低风险"
                    else:
                        claimed_label = "未知"

                    if claimed_label != reviewed_label:
                        annotation_info = {}
                        if annotations:
                            ann = annotations[0]
                            annotation_info = {
                                "actual_annotation_label": ann.get("true_label", "").strip(),
                                "annotator": ann.get("annotator", ""),
                                "annotation_line": ann.get("line_number"),
                                "annotation_source": f"{annotation_file} -> 第{ann.get('line_number')}行"
                            }

                        conflicts.append({
                            "conflict_id": f"{version_id}_review_{case_id}",
                            "conflict_type": "版本冲突-人工改判不一致",
                            "severity": "medium",
                            "case_id": case_id,
                            "release_claim": {
                                "claimed_label": claimed_label,
                                "source": f"版本发布记录 {version_id} -> 【发布记录宣称】{claim_line.strip()}"
                            },
                            "actual_data": {
                                "actual_manual_review_label": reviewed_label,
                                "actual_pred_label": original_label,
                                "review_reason": review.get("review_reason"),
                                "reviewer": review.get("reviewer"),
                                "review_date": review.get("review_date"),
                                "review_source": f"版本{version_id}.json -> manual_reviews -> {case_id}",
                                **annotation_info
                            },
                            "evidence_comparison": {
                                "版本发布记录宣称": claim_line.strip(),
                                "版本文件人工改判记录": f"{original_label} -> {reviewed_label}，理由：{review.get('review_reason')}",
                                "标注表记录": f"标注为{annotation_info.get('actual_annotation_label', '未知')}，标注人：{annotation_info.get('annotator', '未知')}"
                            },
                            "suggested_actions": [
                                f"与老唐沟通确认{case_id}的最终判定结果",
                                "统一发布记录、人工改判记录、标注表三者的标签",
                                "核实改判理由是否充分，是否需要重新标注",
                                "将最终决策记录到版本备注中"
                            ],
                            "decision_required": True,
                            "note": "系统不自动修正，请人工核实后统一三处记录"
                        })

        return conflicts

    def detect_empty_values(self, version_id: str) -> List[Dict[str, Any]]:
        """检测空值"""
        version = self.loader.load_version(version_id)
        if not version:
            return []

        empty_values = []
        sources = version.get("sources", [])
        annotation_file = next((s["file"] for s in sources if s["type"] == "annotation"), None)

        if annotation_file:
            annotation_groups = self.loader.get_annotation_cases(annotation_file)

            for case_id, annotations in annotation_groups.items():
                for annotation in annotations:
                    empty_fields = []
                    for field in ["case_id", "text", "true_label"]:
                        value = annotation.get(field, "").strip()
                        if not value:
                            empty_fields.append(field)

                    if empty_fields:
                        empty_values.append({
                            "case_id": case_id or f"未知_{annotation.get('line_number', '?')}",
                            "empty_fields": empty_fields,
                            "annotation_line": annotation.get("line_number"),
                            "source": f"{annotation_file} -> 第{annotation.get('line_number')}行",
                            "conflict_type": "空值",
                            "severity": "medium",
                            "suggested_actions": [
                                f"补充{empty_fields}字段的缺失数据",
                                "如果是测试样本，确认是否故意留空用于边界测试",
                                "检查标注流程，避免出现空值"
                            ]
                        })

        return empty_values

    def detect_duplicate_records(self, version_id: str) -> List[Dict[str, Any]]:
        """检测重复项"""
        version = self.loader.load_version(version_id)
        if not version:
            return []

        duplicates = []
        sources = version.get("sources", [])
        annotation_file = next((s["file"] for s in sources if s["type"] == "annotation"), None)

        if annotation_file:
            annotation_groups = self.loader.get_annotation_cases(annotation_file)

            for case_id, annotations in annotation_groups.items():
                if len(annotations) > 1 and case_id:
                    duplicates.append({
                        "case_id": case_id,
                        "duplicate_count": len(annotations),
                        "lines": [a.get("line_number") for a in annotations],
                        "annotations": [
                            {
                                "line": a.get("line_number"),
                                "true_label": a.get("true_label"),
                                "annotator": a.get("annotator"),
                                "annotation_date": a.get("annotation_date"),
                                "conflict_note": a.get("conflict_note")
                            }
                            for a in annotations
                        ],
                        "source": f"{annotation_file} -> {case_id}",
                        "conflict_type": "重复项",
                        "severity": "low",
                        "suggested_actions": [
                            f"检查{case_id}是否有多次标注，确认是否为标注错误",
                            "如果是多次审核，记录审核历史而非重复行",
                            "保留最新或最权威的标注，删除重复项"
                        ]
                    })

        return duplicates

    def detect_boundary_cases(self, version_id: str) -> List[Dict[str, Any]]:
        """检测边界记录：分数恰好落在阈值边界的样本"""
        version = self.loader.load_version(version_id)
        if not version:
            return []

        boundary_cases = []
        thresholds = version.get("thresholds", {})
        sources = version.get("sources", [])

        eval_file = next((s["file"] for s in sources if s["type"] == "eval_log"), None)
        threshold_file = next((s["file"] for s in sources if s["type"] == "threshold_note"), None)

        if not eval_file:
            return boundary_cases

        eval_cases = self.loader.get_eval_cases(eval_file)

        high_min = thresholds.get("high_risk_min", 0.8)
        medium_min = thresholds.get("medium_risk_min", 0.6)

        for case_id, case in eval_cases.items():
            score = case.get("pred_score")
            if score is None:
                continue

            boundary_type = None
            boundary_threshold = None

            if abs(score - high_min) < 0.001:
                boundary_type = "高风险边界"
                boundary_threshold = high_min
            elif abs(score - medium_min) < 0.001:
                boundary_type = "中风险边界"
                boundary_threshold = medium_min
            elif medium_min < score < high_min and abs(score - (high_min + medium_min) / 2) < 0.05:
                boundary_type = "中风险区间敏感"
                boundary_threshold = (high_min + medium_min) / 2

            if boundary_type:
                boundary_cases.append({
                    "case_id": case_id,
                    "case_text": case.get("text", ""),
                    "pred_score": score,
                    "pred_label": case.get("pred_label"),
                    "boundary_type": boundary_type,
                    "boundary_threshold": boundary_threshold,
                    "threshold_config": {
                        "high_risk_min": high_min,
                        "medium_risk_min": medium_min
                    },
                    "source": f"{eval_file} -> {case_id}",
                    "threshold_source": threshold_file,
                    "conflict_type": "边界记录",
                    "severity": "medium",
                    "suggested_actions": [
                        f"重点审核{case_id}，分数{score}接近阈值{boundary_threshold}",
                        "考虑该类型样本是否需要调整阈值或补充训练",
                        "记录为边界样本，后续版本优化时重点关注",
                        "如果是白户等特殊群体，考虑单独制定策略"
                    ]
                })

        sources = version.get("sources", [])
        annotation_file = next((s["file"] for s in sources if s["type"] == "annotation"), None)
        if annotation_file:
            annotation_groups = self.loader.get_annotation_cases(annotation_file)
            for case_id, annotations in annotation_groups.items():
                for annotation in annotations:
                    note = annotation.get("conflict_note", "")
                    if "白户" in note or "边界" in note:
                        if case_id not in [c["case_id"] for c in boundary_cases]:
                            boundary_cases.append({
                                "case_id": case_id,
                                "case_text": annotation.get("text", ""),
                                "pred_score": None,
                                "pred_label": None,
                                "boundary_type": note.strip(),
                                "boundary_threshold": None,
                                "threshold_config": thresholds,
                                "source": f"{annotation_file} -> 第{annotation.get('line_number')}行",
                                "threshold_source": threshold_file,
                                "conflict_type": "边界记录",
                                "severity": "medium",
                                "suggested_actions": [
                                    f"该样本被标记为'{note.strip()}'，需重点关注",
                                    "考虑为白户等特殊群体单独制定提示词或阈值",
                                    "补充该类型样本进行评测，确保模型表现稳定"
                                ]
                            })

        return boundary_cases

    def _generate_summary(self, conflicts: Dict[str, List[Dict[str, Any]]]) -> Dict[str, Any]:
        """生成冲突摘要"""
        summary = {
            "total_conflicts": sum(len(v) for v in conflicts.values()),
            "breakdown": {k: len(v) for k, v in conflicts.items()},
            "severity_breakdown": {
                "critical": 0,
                "high": 0,
                "medium": 0,
                "low": 0
            },
            "decision_required_count": 0
        }

        for conflict_type, items in conflicts.items():
            for item in items:
                severity = item.get("severity", "medium")
                if severity in summary["severity_breakdown"]:
                    summary["severity_breakdown"][severity] += 1
                if item.get("decision_required"):
                    summary["decision_required_count"] += 1

        return summary
