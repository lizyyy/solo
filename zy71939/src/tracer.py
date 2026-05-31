from typing import List, Dict, Optional, Any
from dataclasses import dataclass
from datetime import datetime

from .models import (
    ProofRecord,
    MaterialPackage,
    VerificationInfo,
    MaterialSource,
    RecordStatus,
    AbnormalType,
)


@dataclass
class TraceLink:
    record_id: str
    material_name: str
    abnormal_type: str
    reason: str
    source_file: str
    source_location: str
    evidence: List[str]


class TraceableReporter:
    def __init__(self, records: List[ProofRecord]):
        self.records = records

    def generate_trace_report(self) -> Dict[str, Any]:
        trace_links: List[TraceLink] = []
        pending_summary: Dict[str, List[Dict[str, str]]] = {}

        for record in self.records:
            if record.status != RecordStatus.NORMAL and record.verification:
                for abnormal_type in record.abnormal_types:
                    link = self._create_trace_link(record, abnormal_type)
                    trace_links.append(link)

                    if abnormal_type not in pending_summary:
                        pending_summary[abnormal_type] = []
                    pending_summary[abnormal_type].append(
                        {
                            "record_id": record.record_id,
                            "material_name": record.material_name,
                            "reason": record.verification.reason,
                        }
                    )

        return {
            "trace_links": trace_links,
            "pending_summary": pending_summary,
            "total_pending": len(trace_links),
        }

    def _create_trace_link(
        self, record: ProofRecord, abnormal_type: AbnormalType
    ) -> TraceLink:
        source_file = "未知文件"
        source_location = "未知位置"

        if record.source:
            source_file = record.source.file_path
            location_parts = []
            if record.source.sheet_name:
                location_parts.append(f"工作表: {record.source.sheet_name}")
            if record.source.line_number:
                location_parts.append(f"行号: {record.source.line_number}")
            source_location = ", ".join(location_parts) if location_parts else "未指定"

        evidence = []
        if record.verification:
            evidence = record.verification.evidence

        return TraceLink(
            record_id=record.record_id,
            material_name=record.material_name,
            abnormal_type=str(abnormal_type),
            reason=record.verification.reason if record.verification else "",
            source_file=source_file,
            source_location=source_location,
            evidence=evidence,
        )

    def get_trace_for_record(self, record_id: str) -> Optional[Dict[str, Any]]:
        for record in self.records:
            if record.record_id == record_id:
                return self._build_record_trace(record)
        return None

    def _build_record_trace(self, record: ProofRecord) -> Dict[str, Any]:
        trace = {
            "record_id": record.record_id,
            "material_name": record.material_name,
            "color_version": record.color_version,
            "spec": record.spec,
            "status": record.status,
            "abnormal_types": [str(t) for t in record.abnormal_types],
            "source": None,
            "verification": None,
            "related_sources": [],
        }

        if record.source:
            trace["source"] = {
                "file_path": record.source.file_path,
                "sheet_name": record.source.sheet_name,
                "line_number": record.source.line_number,
            }

        if record.verification:
            trace["verification"] = {
                "reason": record.verification.reason,
                "evidence": record.verification.evidence,
            }
            for src in record.verification.source_files:
                trace["related_sources"].append(
                    {
                        "file_path": src.file_path,
                        "sheet_name": src.sheet_name,
                        "line_number": src.line_number,
                        "original_value": src.original_value,
                    }
                )

        return trace

    def export_trace_links(self, output_path: str) -> None:
        import json

        report = self.generate_trace_report()
        serializable_links = []
        for link in report["trace_links"]:
            serializable_links.append(
                {
                    "record_id": link.record_id,
                    "material_name": link.material_name,
                    "abnormal_type": link.abnormal_type,
                    "reason": link.reason,
                    "source_file": link.source_file,
                    "source_location": link.source_location,
                    "evidence": link.evidence,
                }
            )

        output = {
            "generated_at": datetime.now().isoformat(),
            "total_pending_items": len(serializable_links),
            "trace_links": serializable_links,
            "pending_summary": report["pending_summary"],
        }

        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(output, f, ensure_ascii=False, indent=2)
