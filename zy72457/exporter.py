import pandas as pd
from typing import List, Dict, Any, Optional
from datetime import datetime

from models import NightSamplingPoint, ServiceRadiusResult, PointStatus
from storage import store


class UnifiedDataExporter:
    @staticmethod
    def _get_unified_point_data(point: NightSamplingPoint) -> Dict[str, Any]:
        result = store.get_radius_result(point.id)
        return {
            "点位ID": point.id,
            "原始行号": point.original_row_number,
            "点位名称": point.name,
            "地址": point.address,
            "经度": point.longitude,
            "纬度": point.latitude,
            "原始服务半径": result.original_radius if result else point.service_radius,
            "计算服务半径": result.calculated_radius if result else point.service_radius,
            "最终服务半径": result.final_radius if result else point.service_radius,
            "投诉编号": point.complaint_id or "",
            "当前状态": point.status.value,
            "状态说明": UnifiedDataExporter._get_status_text(point.status),
            "异常类型": ",".join([t.value for t in point.abnormal_types]),
            "是否人工改动": "是" if point.is_manual_modified else "否",
            "施工备注": point.construction_note or "",
            "导入批次": point.import_batch_id,
            "创建时间": point.created_at.strftime("%Y-%m-%d %H:%M:%S"),
            "更新时间": point.updated_at.strftime("%Y-%m-%d %H:%M:%S"),
            "审计记录数": len(point.audit_logs),
        }

    @staticmethod
    def _get_status_text(status: PointStatus) -> str:
        status_map = {
            PointStatus.PENDING_REVIEW: "待审核",
            PointStatus.NORMAL: "正常",
            PointStatus.ABNORMAL: "异常",
            PointStatus.CONSTRUCTION_DETOUR: "施工改道",
            PointStatus.RESIDENT_REVIEW: "待居民代表复核",
            PointStatus.UPDATED: "已更新",
        }
        return status_map.get(status, status.value)

    @staticmethod
    def get_for_api(point_id: Optional[str] = None) -> Dict[str, Any]:
        if point_id:
            point = store.get_point(point_id)
            if not point:
                return {"error": "点位不存在"}
            data = UnifiedDataExporter._get_unified_point_data(point)
            result = store.get_radius_result(point_id)
            return {
                "point": data,
                "radius_result": result.model_dump() if result else None,
                "audit_logs": [log.model_dump() for log in point.audit_logs],
            }
        else:
            points = store.get_all_points()
            return {
                "total": len(points),
                "points": [
                    UnifiedDataExporter._get_unified_point_data(p) for p in points
                ],
            }

    @staticmethod
    def get_for_page_display(
        status_filter: Optional[PointStatus] = None,
        abnormal_filter: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        points = store.get_all_points()
        if status_filter:
            points = [p for p in points if p.status == status_filter]
        if abnormal_filter:
            points = [
                p
                for p in points
                if any(abnormal_filter in t.value for t in p.abnormal_types)
            ]
        return [UnifiedDataExporter._get_unified_point_data(p) for p in points]

    @staticmethod
    def export_to_excel(output_path: str) -> str:
        points = store.get_all_points()
        data = [UnifiedDataExporter._get_unified_point_data(p) for p in points]
        df = pd.DataFrame(data)

        with pd.ExcelWriter(output_path, engine="openpyxl") as writer:
            df.to_excel(writer, sheet_name="服务半径明细", index=False)

            audit_data = []
            for p in points:
                for log in p.audit_logs:
                    audit_data.append(
                        {
                            "点位ID": p.id,
                            "点位名称": p.name,
                            "操作时间": log.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
                            "操作人": log.operator,
                            "操作动作": log.action,
                            "备注": log.remark or "",
                        }
                    )
            if audit_data:
                pd.DataFrame(audit_data).to_excel(
                    writer, sheet_name="审计追踪", index=False
                )

        return output_path

    @staticmethod
    def get_audit_evidence(point_id: str) -> Dict[str, Any]:
        point = store.get_point(point_id)
        if not point:
            return {"error": "点位不存在"}

        return {
            "point_id": point_id,
            "point_name": point.name,
            "original_row_number": point.original_row_number,
            "is_manual_modified": point.is_manual_modified,
            "current_status": point.status.value,
            "status_text": UnifiedDataExporter._get_status_text(point.status),
            "abnormal_types": [t.value for t in point.abnormal_types],
            "construction_note": point.construction_note,
            "radius_history": [
                {
                    "timestamp": log.timestamp.isoformat(),
                    "action": log.action,
                    "operator": log.operator,
                    "service_radius_before": (
                        log.before.get("service_radius") if log.before else None
                    ),
                    "service_radius_after": (
                        log.after.get("service_radius") if log.after else None
                    ),
                    "status_before": log.before.get("status") if log.before else None,
                    "status_after": log.after.get("status") if log.after else None,
                }
                for log in point.audit_logs
            ],
        }
