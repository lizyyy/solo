from __future__ import annotations

import json
import logging
from datetime import datetime
from pathlib import Path

from .models import (
    DetailedReport,
    DuplicateRecord,
    ExportBundle,
    ProcessingStatus,
    ReportSummary,
    SampleFile,
    TagCategory,
)

logger = logging.getLogger(__name__)


class ReportExporter:
    def __init__(self, indent: int = 2):
        self.indent = indent

    def generate_report(
        self,
        samples: list[SampleFile],
        conflicts: list,
        duplicates: list[DuplicateRecord],
        run_id: str,
        source_folders: list[str],
        start_time: datetime,
    ) -> ExportBundle:
        end_time = datetime.now()
        processing_time = (end_time - start_time).total_seconds()
        summary = self._generate_summary(
            samples,
            conflicts,
            duplicates,
            run_id,
            processing_time,
        )
        detailed = DetailedReport(
            summary=summary,
            samples=samples,
            conflicts=conflicts,
            duplicates=duplicates,
            source_folders=source_folders,
        )
        return ExportBundle(
            generated_at=datetime.now(),
            report=detailed,
            metadata={
                "processing_start": start_time.isoformat(),
                "processing_end": end_time.isoformat(),
            },
        )

    def _generate_summary(
        self,
        samples: list[SampleFile],
        conflicts: list,
        duplicates: list[DuplicateRecord],
        run_id: str,
        processing_time: float,
    ) -> ReportSummary:
        total_files = len(samples)
        tagged_files = sum(1 for s in samples if s.tags or s.manual_tags)
        silent_files = sum(1 for s in samples if s.is_silent)
        suspicious_files = sum(1 for s in samples if s.is_suspicious)
        tag_breakdown = {}
        for sample in samples:
            primary_tag = sample.get_primary_tag()
            if primary_tag:
                cat = primary_tag.category.value
                tag_breakdown[cat] = tag_breakdown.get(cat, 0) + 1
        duplicate_count = sum(len(d.sample_ids) for d in duplicates)
        return ReportSummary(
            total_files=total_files,
            tagged_files=tagged_files,
            silent_files=silent_files,
            suspicious_files=suspicious_files,
            conflict_count=len(conflicts),
            duplicate_count=duplicate_count,
            duplicate_groups=len(duplicates),
            tag_breakdown=tag_breakdown,
            processing_time_seconds=processing_time,
            run_id=run_id,
            generated_at=datetime.now(),
        )

    def export_to_file(self, bundle: ExportBundle, output_path: Path) -> Path:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(bundle.model_dump(), f, ensure_ascii=False, indent=self.indent)
        return output_path

    def export_summary_file(self, bundle: ExportBundle, output_path: Path) -> Path:
        summary_data = {
            "version": bundle.version,
            "generated_at": bundle.generated_at.isoformat(),
            "summary": bundle.report.summary.model_dump(),
            "source_folders": bundle.report.source_folders,
            "quick_lookup": {
                "total_conflicts": [
                    {
                        "conflict_id": c.conflict_id,
                        "sample_id": c.sample_id,
                        "sample_name": self._get_sample_name(bundle, c.sample_id),
                        "type": c.conflict_type.value,
                        "description": c.description,
                        "resolved": c.resolved,
                    }
                    for c in bundle.report.conflicts
                ],
                "duplicate_groups": [
                    {
                        "group_id": d.duplicate_group_id,
                        "type": d.duplicate_type.value,
                        "sample_count": len(d.sample_ids),
                        "primary_sample_id": d.primary_sample_id,
                        "primary_name": self._get_sample_name(bundle, d.primary_sample_id),
                        "similarity": d.similarity_score,
                        "sample_ids": d.sample_ids,
                    }
                    for d in bundle.report.duplicates
                ],
            },
        }
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(summary_data, f, ensure_ascii=False, indent=self.indent)
        return output_path

    @staticmethod
    def _get_sample_name(bundle: ExportBundle, sample_id: str | None) -> str:
        if sample_id is None:
            return ""
        sample = bundle.lookup_sample(sample_id)
        return sample.file_name if sample else ""

    def print_console_summary(self, bundle: ExportBundle) -> str:
        summary = bundle.report.summary
        lines = [
            "=" * 60,
            "采样音色标签器 - 处理摘要",
            "=" * 60,
            f"运行ID: {summary.run_id}",
            f"生成时间: {summary.generated_at.strftime('%Y-%m-%d %H:%M:%S')}",
            f"处理时间: {summary.processing_time_seconds:.2f} 秒",
            "-" * 60,
            f"总文件数: {summary.total_files}",
            f"已标注文件: {summary.tagged_files}",
            f"静音样本: {summary.silent_files}",
            f"可疑噪声: {summary.suspicious_files}",
            f"冲突数量: {summary.conflict_count}",
            f"重复样本: {summary.duplicate_count} (共 {summary.duplicate_groups} 组)",
            "-" * 60,
            "标签分布:",
        ]
        for tag, count in summary.tag_breakdown.items():
            lines.append(f"  {tag}: {count}")
        lines.extend([
            "-" * 60,
            f"源文件夹: {', '.join(bundle.report.source_folders) if bundle.report.source_folders else 'N/A'}",
            "=" * 60,
        ])
        return "\n".join(lines)
