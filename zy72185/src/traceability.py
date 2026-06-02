"""来源追溯模块：确保每条版本记录都能追到来源证据"""
from typing import Dict, List, Optional, Any
from .data_loader import DataLoader
from .version_manager import VersionManager


class Traceability:
    def __init__(self, base_dir: str):
        self.base_dir = base_dir
        self.loader = DataLoader(base_dir)
        self.version_manager = VersionManager(base_dir)

    def trace_version(self, version_id: str) -> Dict[str, Any]:
        """追溯整个版本的来源"""
        version = self.loader.load_version(version_id)
        if not version:
            return {"error": f"版本 {version_id} 不存在"}

        result = {
            "version_id": version_id,
            "basic_info": {
                "release_date": version.get("release_date"),
                "release_by": version.get("release_by"),
                "status": version.get("status"),
                "release_notes": version.get("release_notes")
            },
            "sources_trace": [],
            "manual_reviews_trace": [],
            "thresholds_trace": None,
            "prompt_trace": None,
            "traceability_report": {
                "total_sources": 0,
                "verified_sources": 0,
                "missing_sources": [],
                "traceability_score": 0.0
            }
        }

        sources = version.get("sources", [])
        result["traceability_report"]["total_sources"] = len(sources)

        for source in sources:
            source_trace = self._trace_source(source)
            result["sources_trace"].append(source_trace)
            if source_trace["verified"]:
                result["traceability_report"]["verified_sources"] += 1
            else:
                result["traceability_report"]["missing_sources"].append(source_trace)

        manual_reviews = version.get("manual_reviews", [])
        for review in manual_reviews:
            review_trace = self._trace_manual_review(review, version)
            result["manual_reviews_trace"].append(review_trace)

        result["thresholds_trace"] = self._trace_thresholds(version)
        result["prompt_trace"] = self._trace_prompt(version)

        total = result["traceability_report"]["total_sources"]
        if total > 0:
            result["traceability_report"]["traceability_score"] = (
                result["traceability_report"]["verified_sources"] / total * 100
            )

        return result

    def trace_case(self, version_id: str, case_id: str) -> Dict[str, Any]:
        """追溯单个案例的完整来源链"""
        version = self.loader.load_version(version_id)
        if not version:
            return {"error": f"版本 {version_id} 不存在"}

        result = {
            "version_id": version_id,
            "case_id": case_id,
            "evidence_chain": [],
            "review_history": [],
            "threshold_context": None
        }

        sources = version.get("sources", [])
        eval_file = next((s["file"] for s in sources if s["type"] == "eval_log"), None)
        annotation_file = next((s["file"] for s in sources if s["type"] == "annotation"), None)

        if eval_file:
            eval_cases = self.loader.get_eval_cases(eval_file)
            eval_case = eval_cases.get(case_id)
            if eval_case:
                result["evidence_chain"].append({
                    "source_type": "评测日志",
                    "file": eval_file,
                    "content": eval_case,
                    "trace_path": f"{eval_file} -> {case_id}"
                })

        if annotation_file:
            annotation_groups = self.loader.get_annotation_cases(annotation_file)
            annotations = annotation_groups.get(case_id, [])
            for ann in annotations:
                result["evidence_chain"].append({
                    "source_type": "标注表",
                    "file": annotation_file,
                    "line": ann.get("line_number"),
                    "content": ann,
                    "trace_path": f"{annotation_file} -> 第{ann.get('line_number')}行 -> {case_id}"
                })

        manual_reviews = version.get("manual_reviews", [])
        for review in manual_reviews:
            if review["case_id"] == case_id:
                result["review_history"].append({
                    "version": version_id,
                    "reviewer": review.get("reviewer"),
                    "review_date": review.get("review_date"),
                    "original_label": review.get("original_label"),
                    "reviewed_label": review.get("reviewed_label"),
                    "reason": review.get("review_reason"),
                    "source_evidence": review.get("source_evidence")
                })

        thresholds = version.get("thresholds", {})
        eval_evidence = next((e for e in result["evidence_chain"] if e["source_type"] == "评测日志"), None)
        case_score = eval_evidence["content"].get("pred_score") if eval_evidence else None
        result["threshold_context"] = {
            "thresholds": thresholds,
            "case_score": case_score
        }

        return result

    def _trace_source(self, source: Dict[str, Any]) -> Dict[str, Any]:
        """追溯单个来源文件"""
        source_type = source.get("type")
        filename = source.get("file")
        description = source.get("description", "")

        trace_result = {
            "type": source_type,
            "file": filename,
            "description": description,
            "verified": False,
            "content_preview": None,
            "trace_path": f"data/{source_type}s/{filename}"
        }

        try:
            if source_type == "eval_log":
                content = self.loader.load_eval_log(filename)
                if content:
                    trace_result["verified"] = True
                    trace_result["content_preview"] = {
                        "eval_date": content.get("eval_date"),
                        "model_version": content.get("model_version"),
                        "total_cases": content.get("total_cases"),
                        "metrics": content.get("metrics")
                    }
            elif source_type == "annotation":
                content = self.loader.load_annotations(filename)
                if content:
                    trace_result["verified"] = True
                    trace_result["content_preview"] = {
                        "total_rows": len(content),
                        "columns": list(content[0].keys()) if content else [],
                        "sample_rows": content[:3]
                    }
            elif source_type == "threshold_note":
                content = self.loader.load_threshold_note(filename)
                if content:
                    trace_result["verified"] = True
                    trace_result["content_preview"] = content[:500] + "..." if len(content) > 500 else content
        except Exception as e:
            trace_result["error"] = str(e)

        return trace_result

    def _trace_manual_review(self, review: Dict[str, Any], version: Dict[str, Any]) -> Dict[str, Any]:
        """追溯单条人工改判记录的来源"""
        case_id = review.get("case_id")
        source_evidence = review.get("source_evidence", "")

        trace_result = {
            "case_id": case_id,
            "reviewer": review.get("reviewer"),
            "review_date": review.get("review_date"),
            "original_label": review.get("original_label"),
            "reviewed_label": review.get("reviewed_label"),
            "reason": review.get("review_reason"),
            "source_evidence": source_evidence,
            "verified_evidence": [],
            "trace_path": f"{version['version_id']}.json -> manual_reviews -> {case_id}"
        }

        sources = version.get("sources", [])
        annotation_file = next((s["file"] for s in sources if s["type"] == "annotation"), None)
        eval_file = next((s["file"] for s in sources if s["type"] == "eval_log"), None)

        if annotation_file:
            annotation_groups = self.loader.get_annotation_cases(annotation_file)
            annotations = annotation_groups.get(case_id, [])
            for ann in annotations:
                trace_result["verified_evidence"].append({
                    "source": "标注表",
                    "file": annotation_file,
                    "line": ann.get("line_number"),
                    "true_label": ann.get("true_label"),
                    "annotator": ann.get("annotator")
                })

        if eval_file:
            eval_cases = self.loader.get_eval_cases(eval_file)
            eval_case = eval_cases.get(case_id)
            if eval_case:
                trace_result["verified_evidence"].append({
                    "source": "评测日志",
                    "file": eval_file,
                    "pred_label": eval_case.get("pred_label"),
                    "pred_score": eval_case.get("pred_score")
                })

        return trace_result

    def _trace_thresholds(self, version: Dict[str, Any]) -> Dict[str, Any]:
        """追溯阈值配置的来源"""
        thresholds = version.get("thresholds", {})
        sources = version.get("sources", [])
        threshold_file = next((s["file"] for s in sources if s["type"] == "threshold_note"), None)

        trace_result = {
            "thresholds": thresholds,
            "config_file": threshold_file,
            "trace_path": f"{version['version_id']}.json -> thresholds"
        }

        if threshold_file:
            content = self.loader.load_threshold_note(threshold_file)
            if content:
                trace_result["verified"] = True
                trace_result["config_preview"] = content[:300] + "..." if len(content) > 300 else content
            else:
                trace_result["verified"] = False
                trace_result["error"] = f"找不到阈值配置文件: {threshold_file}"

        return trace_result

    def _trace_prompt(self, version: Dict[str, Any]) -> Dict[str, Any]:
        """追溯提示词的版本历史"""
        versions = self.loader.list_versions()
        current_prompt = version.get("prompt_content", "")

        trace_result = {
            "current_prompt": current_prompt,
            "version_history": [],
            "trace_path": f"{version['version_id']}.json -> prompt_content"
        }

        for vid in versions:
            if vid == version["version_id"]:
                continue
            old_version = self.loader.load_version(vid)
            if old_version:
                old_prompt = old_version.get("prompt_content", "")
                changed = old_prompt != current_prompt
                trace_result["version_history"].append({
                    "version": vid,
                    "release_date": old_version.get("release_date"),
                    "prompt_changed": changed,
                    "prompt_preview": old_prompt[:100] + "..." if len(old_prompt) > 100 else old_prompt
                })

        return trace_result
