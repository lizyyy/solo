import json
import pandas as pd
from datetime import datetime
from sqlalchemy.orm import Session
from typing import Dict, Any
from . import models
from .services import get_freeze_detail


def export_to_json(freeze_detail: Dict[str, Any]) -> str:
    data = {
        "export_metadata": {
            "export_time": datetime.utcnow().isoformat(),
            "export_version": "1.0"
        },
        "experiment_freeze": {
            "id": freeze_detail["experiment_freeze"].id,
            "experiment_id": freeze_detail["experiment_freeze"].experiment_id,
            "parameter_version": freeze_detail["experiment_freeze"].parameter_version,
            "freeze_time": freeze_detail["experiment_freeze"].freeze_time.isoformat(),
            "status": freeze_detail["experiment_freeze"].status,
            "metric_window_start": freeze_detail["experiment_freeze"].metric_window_start.isoformat(),
            "metric_window_end": freeze_detail["experiment_freeze"].metric_window_end.isoformat(),
            "parameters": freeze_detail["experiment_freeze"].parameters,
            "metrics_config": freeze_detail["experiment_freeze"].metrics_config,
            "created_by": freeze_detail["experiment_freeze"].created_by,
            "created_at": freeze_detail["experiment_freeze"].created_at.isoformat(),
            "updated_at": freeze_detail["experiment_freeze"].updated_at.isoformat(),
            "remarks": freeze_detail["experiment_freeze"].remarks
        },
        "parameter_snapshots": [
            {
                "id": s.id,
                "version": s.version,
                "snapshot_time": s.snapshot_time.isoformat(),
                "hash": s.hash,
                "parameters": s.parameters,
                "created_by": s.created_by
            }
            for s in freeze_detail["parameter_snapshots"]
        ],
        "change_requests": [
            {
                "id": cr.id,
                "change_type": cr.change_type,
                "original_parameters": cr.original_parameters,
                "proposed_parameters": cr.proposed_parameters,
                "reason": cr.reason,
                "requested_by": cr.requested_by,
                "requested_at": cr.requested_at.isoformat(),
                "approval_status": cr.approval_status,
                "approved_by": cr.approved_by,
                "approved_at": cr.approved_at.isoformat() if cr.approved_at else None,
                "approval_remarks": cr.approval_remarks,
                "is_blocked": cr.is_blocked,
                "block_reason": cr.block_reason
            }
            for cr in freeze_detail["change_requests"]
        ],
        "exception_records": [
            {
                "id": er.id,
                "exception_type": er.exception_type,
                "error_code": er.error_code,
                "original_input": er.original_input,
                "processing_basis": er.processing_basis,
                "final_conclusion": er.final_conclusion,
                "occurred_at": er.occurred_at.isoformat(),
                "resolved_at": er.resolved_at.isoformat() if er.resolved_at else None,
                "resolved_by": er.resolved_by,
                "resolution_details": er.resolution_details,
                "is_resolved": er.is_resolved
            }
            for er in freeze_detail["exception_records"]
        ],
        "freeze_reports": [
            {
                "id": fr.id,
                "report_type": fr.report_type,
                "content": fr.content,
                "generated_by": fr.generated_by,
                "generated_at": fr.generated_at.isoformat(),
                "file_path": fr.file_path,
                "file_format": fr.file_format
            }
            for fr in freeze_detail["freeze_reports"]
        ],
        "audit_logs": [
            {
                "id": al.id,
                "action": al.action,
                "previous_state": al.previous_state,
                "new_state": al.new_state,
                "operator": al.operator,
                "operated_at": al.operated_at.isoformat(),
                "remarks": al.remarks
            }
            for al in freeze_detail["audit_logs"]
        ]
    }
    return json.dumps(data, indent=2, ensure_ascii=False)


def export_to_excel(freeze_detail: Dict[str, Any], file_path: str) -> str:
    with pd.ExcelWriter(file_path, engine='openpyxl') as writer:
        freeze_data = [{
            "ID": freeze_detail["experiment_freeze"].id,
            "Experiment ID": freeze_detail["experiment_freeze"].experiment_id,
            "Parameter Version": freeze_detail["experiment_freeze"].parameter_version,
            "Freeze Time": freeze_detail["experiment_freeze"].freeze_time,
            "Status": freeze_detail["experiment_freeze"].status,
            "Metric Window Start": freeze_detail["experiment_freeze"].metric_window_start,
            "Metric Window End": freeze_detail["experiment_freeze"].metric_window_end,
            "Parameters": json.dumps(freeze_detail["experiment_freeze"].parameters, ensure_ascii=False),
            "Created By": freeze_detail["experiment_freeze"].created_by,
            "Created At": freeze_detail["experiment_freeze"].created_at,
            "Updated At": freeze_detail["experiment_freeze"].updated_at,
            "Remarks": freeze_detail["experiment_freeze"].remarks
        }]
        pd.DataFrame(freeze_data).to_excel(writer, sheet_name='Experiment Freeze', index=False)
        
        if freeze_detail["parameter_snapshots"]:
            snapshot_data = [{
                "ID": s.id,
                "Version": s.version,
                "Snapshot Time": s.snapshot_time,
                "Hash": s.hash,
                "Parameters": json.dumps(s.parameters, ensure_ascii=False),
                "Created By": s.created_by
            } for s in freeze_detail["parameter_snapshots"]]
            pd.DataFrame(snapshot_data).to_excel(writer, sheet_name='Parameter Snapshots', index=False)
        
        if freeze_detail["change_requests"]:
            cr_data = [{
                "ID": cr.id,
                "Change Type": cr.change_type,
                "Original Parameters": json.dumps(cr.original_parameters, ensure_ascii=False),
                "Proposed Parameters": json.dumps(cr.proposed_parameters, ensure_ascii=False),
                "Reason": cr.reason,
                "Requested By": cr.requested_by,
                "Requested At": cr.requested_at,
                "Approval Status": cr.approval_status,
                "Approved By": cr.approved_by,
                "Approved At": cr.approved_at,
                "Approval Remarks": cr.approval_remarks,
                "Is Blocked": cr.is_blocked,
                "Block Reason": cr.block_reason
            } for cr in freeze_detail["change_requests"]]
            pd.DataFrame(cr_data).to_excel(writer, sheet_name='Change Requests', index=False)
        
        if freeze_detail["exception_records"]:
            er_data = [{
                "ID": er.id,
                "Exception Type": er.exception_type,
                "Error Code": er.error_code,
                "Original Input": json.dumps(er.original_input, ensure_ascii=False),
                "Processing Basis": json.dumps(er.processing_basis, ensure_ascii=False),
                "Final Conclusion": json.dumps(er.final_conclusion, ensure_ascii=False),
                "Occurred At": er.occurred_at,
                "Resolved At": er.resolved_at,
                "Resolved By": er.resolved_by,
                "Resolution Details": er.resolution_details,
                "Is Resolved": er.is_resolved
            } for er in freeze_detail["exception_records"]]
            pd.DataFrame(er_data).to_excel(writer, sheet_name='Exception Records', index=False)
        
        if freeze_detail["audit_logs"]:
            al_data = [{
                "ID": al.id,
                "Action": al.action,
                "Previous State": json.dumps(al.previous_state, ensure_ascii=False) if al.previous_state else None,
                "New State": json.dumps(al.new_state, ensure_ascii=False) if al.new_state else None,
                "Operator": al.operator,
                "Operated At": al.operated_at,
                "Remarks": al.remarks
            } for al in freeze_detail["audit_logs"]]
            pd.DataFrame(al_data).to_excel(writer, sheet_name='Audit Logs', index=False)
    
    return file_path


def export_freeze_data(db: Session, freeze_id: int, export_format: str = "json") -> Dict[str, Any]:
    freeze_detail = get_freeze_detail(db, freeze_id)
    if not freeze_detail:
        return None
    
    if export_format == "json":
        json_content = export_to_json(freeze_detail)
        return {
            "format": "json",
            "content": json_content,
            "filename": f"freeze_{freeze_id}_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}.json"
        }
    elif export_format == "excel":
        file_path = f"exports/freeze_{freeze_id}_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}.xlsx"
        export_to_excel(freeze_detail, file_path)
        return {
            "format": "excel",
            "file_path": file_path,
            "filename": f"freeze_{freeze_id}_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}.xlsx"
        }
    else:
        raise ValueError(f"Unsupported export format: {export_format}")
