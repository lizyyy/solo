from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime

from ..models import (
    DJShow,
    Batch,
    Ticket,
    EnergyPoint,
    RehearsalImport,
    ContractScreenshot,
    BatchStatus,
    TicketType,
)


class TraceEngine:
    @staticmethod
    def trace_ticket_origin(
        show: DJShow,
        ticket_id: str,
    ) -> Dict[str, Any]:
        for batch in show.batches:
            for ticket in batch.tickets:
                if ticket.id == ticket_id:
                    source_ref = ticket.source_ref
                    origin = {
                        "ticket": ticket.dict(),
                        "batch": {"id": batch.id, "name": batch.name, "status": batch.status},
                        "source_ref": source_ref,
                        "sources": [],
                    }

                    if source_ref.startswith("import:"):
                        parts = source_ref.split(":")
                        filename = parts[1] if len(parts) > 1 else ""
                        hash_prefix = parts[2] if len(parts) > 2 else ""

                        for imp in show.rehearsal_imports:
                            if imp.source_filename == filename or imp.source_hash.startswith(hash_prefix):
                                origin["sources"].append({
                                    "type": "rehearsal_import",
                                    "id": imp.id,
                                    "filename": imp.source_filename,
                                    "imported_at": imp.imported_at.strftime("%Y-%m-%d %H:%M"),
                                    "imported_by": imp.imported_by,
                                    "raw_content_preview": imp.raw_content[:200] + "..." if len(imp.raw_content) > 200 else imp.raw_content,
                                })

                    for screenshot in show.contract_screenshots:
                        if batch.id in screenshot.linked_batch_ids:
                            origin["sources"].append({
                                "type": "contract_screenshot",
                                "id": screenshot.id,
                                "image_path": screenshot.image_path,
                                "uploaded_at": screenshot.uploaded_at.strftime("%Y-%m-%d %H:%M"),
                                "ocr_preview": screenshot.ocr_text[:200] + "..." if screenshot.ocr_text and len(screenshot.ocr_text) > 200 else screenshot.ocr_text,
                            })

                    return origin
        return {"error": "未找到该票"}

    @staticmethod
    def trace_batch_origin(
        show: DJShow,
        batch_id: str,
    ) -> Dict[str, Any]:
        for batch in show.batches:
            if batch.id == batch_id:
                origin = {
                    "batch": batch.dict(),
                    "ticket_count": len(batch.tickets),
                    "ticket_types": dict(batch.ticket_counts),
                    "sources": [],
                }

                for imp in show.rehearsal_imports:
                    if batch.id in imp.batch_ids:
                        origin["sources"].append({
                            "type": "rehearsal_import",
                            "id": imp.id,
                            "filename": imp.source_filename,
                            "imported_at": imp.imported_at.strftime("%Y-%m-%d %H:%M"),
                            "imported_by": imp.imported_by,
                        })

                for screenshot in show.contract_screenshots:
                    if batch.id in screenshot.linked_batch_ids:
                        origin["sources"].append({
                            "type": "contract_screenshot",
                            "id": screenshot.id,
                            "image_path": screenshot.image_path,
                            "uploaded_at": screenshot.uploaded_at.strftime("%Y-%m-%d %H:%M"),
                        })

                return origin
        return {"error": "未找到该批次"}

    @staticmethod
    def trace_energy_point_origin(
        show: DJShow,
        track_name: str,
    ) -> Dict[str, Any]:
        if not show.energy_curve:
            return {"error": "未设置能量曲线"}

        for point in show.energy_curve.points:
            if point.track_name == track_name:
                origin = {
                    "energy_point": point.model_dump(),
                    "sources": [],
                }

                if point.source_ref:
                    origin["source_ref"] = point.source_ref
                    sr = point.source_ref
                    for imp in show.rehearsal_imports:
                        if imp.source_filename in sr or sr in imp.raw_content:
                            origin["sources"].append({
                                "type": "rehearsal_import",
                                "id": imp.id,
                                "filename": imp.source_filename,
                                "note": imp.note,
                                "imported_by": imp.imported_by,
                                "imported_at": imp.imported_at,
                            })
                    for sc in show.contract_screenshots:
                        if sc.image_path in sr or sc.note and (sc.note in sr or sr in sc.note):
                            origin["sources"].append({
                                "type": "contract_screenshot",
                                "id": sc.id,
                                "image_path": sc.image_path,
                                "note": sc.note,
                                "uploaded_by": sc.uploaded_by,
                            })
                    if not origin["sources"]:
                        origin["sources"].append({
                            "type": "manual_reference",
                            "label": point.source_ref,
                        })

                return origin
        return {"error": "未找到该曲目"}

    @staticmethod
    def get_visualization_context(
        show: DJShow,
        batch_id: Optional[str] = None,
        ticket_id: Optional[str] = None,
        track_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        context = {
            "show": {
                "id": show.id,
                "name": show.name,
                "date": show.date.strftime("%Y-%m-%d"),
                "venue": show.venue,
                "dj_name": show.dj_name,
            },
            "clicked_element": None,
            "source_links": [],
            "action_items": [],
        }

        if batch_id:
            batch_trace = TraceEngine.trace_batch_origin(show, batch_id)
            context["clicked_element"] = batch_trace
            for src in batch_trace.get("sources", []):
                context["source_links"].append(src)

            batch = next((b for b in show.batches if b.id == batch_id), None)
            if batch and batch.status in (BatchStatus.MIXED, BatchStatus.PENDING_REVIEW):
                context["action_items"].append({
                    "type": "review",
                    "label": "送录音师复核",
                    "description": f"批次 [{batch.name}] 存在混票，请录音师确认处理方式",
                })

        if ticket_id:
            ticket_trace = TraceEngine.trace_ticket_origin(show, ticket_id)
            context["clicked_element"] = ticket_trace
            for src in ticket_trace.get("sources", []):
                context["source_links"].append(src)

        if track_name:
            track_trace = TraceEngine.trace_energy_point_origin(show, track_name)
            context["clicked_element"] = track_trace
            for src in track_trace.get("sources", []):
                context["source_links"].append(src)

        return context

    @staticmethod
    def generate_3d_chart_data(show: DJShow) -> Dict[str, Any]:
        if not show.energy_curve:
            return {"error": "未设置能量曲线"}

        batches_data = []
        for batch in show.batches:
            batches_data.append({
                "id": batch.id,
                "name": batch.name,
                "status": batch.status,
                "ticket_count": len(batch.tickets),
                "is_mixed": batch.has_mixed_types,
                "ticket_types": {k.value: v for k, v in batch.ticket_counts.items()},
                "trace_link": f"/api/batch/{batch.id}/trace",
            })

        energy_data = []
        for point in show.energy_curve.points:
            energy_data.append({
                "track_name": point.track_name,
                "track_order": point.track_order,
                "energy_level": point.energy_level,
                "bpm": point.bpm,
                "trace_link": f"/api/track/{point.track_name}/trace",
            })

        return {
            "show_id": show.id,
            "energy_curve": energy_data,
            "batches": batches_data,
            "warnings": [
                {
                    "type": "mixed_batch",
                    "batch_id": b.id,
                    "batch_name": b.name,
                    "message": "赠票售票混在一个批次，请点击查看原始接龙/截图",
                    "trace_link": f"/api/batch/{b.id}/trace",
                }
                for b in show.batches if b.has_mixed_types
            ],
            "metadata": {
                "generated_at": datetime.now().isoformat(),
                "workflow_stage": show.workflow_stage.value,
                "has_mixed_batches": any(b.has_mixed_types for b in show.batches),
            },
        }

    @staticmethod
    def generate_audit_trail(show: DJShow) -> List[Dict[str, Any]]:
        trail = []

        for imp in show.rehearsal_imports:
            trail.append({
                "timestamp": imp.imported_at,
                "type": "import",
                "actor": imp.imported_by,
                "action": f"导入排练群接龙: {imp.source_filename}",
                "reference": imp.id,
            })

        for screenshot in show.contract_screenshots:
            trail.append({
                "timestamp": screenshot.uploaded_at,
                "type": "contract",
                "actor": screenshot.uploaded_by,
                "action": f"上传合同页截图: {screenshot.image_path}",
                "reference": screenshot.id,
            })

        for mod in show.modification_history:
            trail.append({
                "timestamp": mod.modified_at,
                "type": "modification",
                "actor": mod.modified_by,
                "action": f"修改 {mod.entity_type} 的 {mod.field_name}: {mod.old_value} → {mod.new_value}",
                "reference": mod.id,
                "reason": mod.reason,
            })

        return sorted(trail, key=lambda x: x["timestamp"])
