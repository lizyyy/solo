from typing import List, Dict, Tuple
from collections import defaultdict
from datetime import datetime
import logging

from .data_models import (
    ProcessedRecord,
    DataStatus,
    LabelType,
)

logger = logging.getLogger(__name__)


class MetricsCalculator:
    def __init__(self):
        pass

    def calculate_all(self, records: List[ProcessedRecord]) -> Dict:
        metrics = {}

        metrics.update(self._count_metrics(records))
        metrics.update(self._deduplication_metrics(records))
        metrics.update(self._label_metrics(records))
        metrics.update(self._quality_metrics(records))
        metrics.update(self._version_metrics(records))

        return metrics

    def _count_metrics(self, records: List[ProcessedRecord]) -> Dict:
        total = len(records)
        status_counts = defaultdict(int)
        duplicates_merged = 0
        needs_review = 0
        has_annotation = 0
        has_conflict = 0

        for pr in records:
            status_counts[pr.status.value] += 1
            duplicates_merged += len(pr.duplicates)
            if pr.needs_review:
                needs_review += 1
            if pr.annotation:
                has_annotation += 1
            if pr.conflict_case:
                has_conflict += 1

        original_total = total + duplicates_merged

        return {
            "total_processed_samples": total,
            "original_evaluation_records": original_total,
            "duplicates_merged": duplicates_merged,
            "deduplication_rate": round(duplicates_merged / original_total * 100, 2) if original_total > 0 else 0,
            "status_distribution": dict(status_counts),
            "samples_needing_review": needs_review,
            "review_rate": round(needs_review / total * 100, 2) if total > 0 else 0,
            "samples_with_annotation": has_annotation,
            "samples_with_conflict_cases": has_conflict,
        }

    def _deduplication_metrics(self, records: List[ProcessedRecord]) -> Dict:
        sim_scores = []
        duplicate_groups = 0

        for pr in records:
            if pr.similarity_scores:
                sim_scores.extend(pr.similarity_scores.values())
                duplicate_groups += 1

        if sim_scores:
            return {
                "duplicate_groups_found": duplicate_groups,
                "avg_similarity_score": round(sum(sim_scores) / len(sim_scores), 4),
                "min_similarity_score": round(min(sim_scores), 4),
                "max_similarity_score": round(max(sim_scores), 4),
            }
        return {
            "duplicate_groups_found": 0,
            "avg_similarity_score": 0,
            "min_similarity_score": 0,
            "max_similarity_score": 0,
        }

    def _label_metrics(self, records: List[ProcessedRecord]) -> Dict:
        model_labels = defaultdict(int)
        human_labels = defaultdict(int)
        final_labels = defaultdict(int)
        human_overrides = 0
        model_human_agreement = 0
        model_human_disagreement = 0

        for pr in records:
            model_score = pr.primary_record.score
            if model_score >= 0.8:
                model_labels["accept"] += 1
                model_label = LabelType.ACCEPT
            elif model_score >= 0.6:
                model_labels["revise"] += 1
                model_label = LabelType.REVISE
            else:
                model_labels["reject"] += 1
                model_label = LabelType.REJECT

            if pr.annotation:
                human_labels[pr.annotation.human_label.value] += 1

                if model_label == pr.annotation.human_label:
                    model_human_agreement += 1
                else:
                    model_human_disagreement += 1

            if pr.human_decision_override:
                human_overrides += 1

            final_label = pr.get_final_label()
            final_labels[final_label.value] += 1

        total_with_annotation = sum(human_labels.values())
        agreement_rate = 0
        if total_with_annotation > 0:
            agreement_rate = round(model_human_agreement / total_with_annotation * 100, 2)

        return {
            "model_predicted_labels": dict(model_labels),
            "human_annotated_labels": dict(human_labels),
            "final_decisions": dict(final_labels),
            "human_decisions_overridden": human_overrides,
            "model_human_agreement_count": model_human_agreement,
            "model_human_disagreement_count": model_human_disagreement,
            "model_human_agreement_rate": agreement_rate,
        }

    def _quality_metrics(self, records: List[ProcessedRecord]) -> Dict:
        scores = []
        empty_count = 0
        boundary_count = 0
        conflict_count = 0
        duplicate_count = 0

        for pr in records:
            scores.append(pr.primary_record.score)
            if pr.status == DataStatus.EMPTY:
                empty_count += 1
            elif pr.status == DataStatus.BOUNDARY:
                boundary_count += 1
            elif pr.status == DataStatus.CONFLICT:
                conflict_count += 1
            if pr.duplicates:
                duplicate_count += 1

        if scores:
            return {
                "avg_model_score": round(sum(scores) / len(scores), 4),
                "min_model_score": round(min(scores), 4),
                "max_model_score": round(max(scores), 4),
                "empty_samples": empty_count,
                "boundary_samples": boundary_count,
                "conflict_samples": conflict_count,
                "samples_with_duplicates": duplicate_count,
            }
        return {}

    def _version_metrics(self, records: List[ProcessedRecord]) -> Dict:
        version_counts = defaultdict(int)
        version_scores = defaultdict(list)

        for pr in records:
            v = pr.primary_record.model_version
            version_counts[v] += 1
            version_scores[v].append(pr.primary_record.score)

        version_avg_scores = {}
        for v, scores in version_scores.items():
            version_avg_scores[v] = round(sum(scores) / len(scores), 4)

        return {
            "model_version_distribution": dict(version_counts),
            "avg_score_by_version": version_avg_scores,
        }


class VersionManager:
    def __init__(self, report_dir: str = "reports"):
        self.report_dir = report_dir

    def get_next_version(self, prefix: str = "v") -> str:
        import os
        from pathlib import Path

        report_path = Path(self.report_dir)
        if not report_path.exists():
            return f"{prefix}1"

        existing_versions = []
        for f in report_path.glob("report_*.md"):
            name = f.stem.replace("report_", "")
            try:
                ver_num = int(name.split("_")[0].replace(prefix, ""))
                existing_versions.append(ver_num)
            except (ValueError, IndexError):
                continue

        if existing_versions:
            next_num = max(existing_versions) + 1
        else:
            next_num = 1

        return f"{prefix}{next_num}"

    def generate_report_filename(self, prefix: str = "report", include_timestamp: bool = True) -> str:
        import os
        from pathlib import Path

        version = self.get_next_version()
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S") if include_timestamp else ""

        if timestamp:
            filename = f"{prefix}_{version}_{timestamp}.md"
        else:
            filename = f"{prefix}_{version}.md"

        return filename

    def list_existing_reports(self) -> List[Dict]:
        from pathlib import Path

        report_path = Path(self.report_dir)
        if not report_path.exists():
            return []

        reports = []
        for f in sorted(report_path.glob("report_*.md")):
            stat = f.stat()
            reports.append({
                "filename": f.name,
                "path": str(f.absolute()),
                "created_time": datetime.fromtimestamp(stat.st_ctime).isoformat(),
                "modified_time": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                "size_bytes": stat.st_size,
            })

        return reports
