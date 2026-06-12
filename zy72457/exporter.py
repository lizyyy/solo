import pandas as pd
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
from collections import defaultdict

from models import NightSamplingPoint, ServiceRadiusResult, PointStatus, AbnormalType
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
            "是否施工改道未同步": "是" if AbnormalType.CONSTRUCTION_NOT_SYNCED in point.abnormal_types else "否",
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
    def _get_dedup_key(point: NightSamplingPoint) -> str:
        return f"{point.name}||{point.address}"

    @staticmethod
    def _get_deduped_points() -> List[NightSamplingPoint]:
        groups = defaultdict(list)
        for p in store.get_all_points():
            key = UnifiedDataExporter._get_dedup_key(p)
            groups[key].append(p)

        deduped = []
        for key, group in groups.items():
            latest = max(group, key=lambda p: p.updated_at)
            deduped.append(latest)
        return deduped

    @staticmethod
    def get_duplicate_groups() -> List[Dict[str, Any]]:
        groups = defaultdict(list)
        for p in store.get_all_points():
            key = UnifiedDataExporter._get_dedup_key(p)
            groups[key].append(p)

        result = []
        for key, group in groups.items():
            if len(group) > 1:
                result.append({
                    "去重键": key,
                    "重复次数": len(group),
                    "点位列表": [
                        {
                            "点位ID": p.id,
                            "原始行号": p.original_row_number,
                            "导入批次": p.import_batch_id,
                            "创建时间": p.created_at.strftime("%Y-%m-%d %H:%M:%S"),
                            "当前状态": p.status.value,
                        }
                        for p in sorted(group, key=lambda x: x.created_at)
                    ],
                })
        return result

    @staticmethod
    def get_for_api(point_id: Optional[str] = None) -> Dict[str, Any]:
        if point_id:
            point = store.get_point(point_id)
            if not point:
                return {"error": "点位不存在"}
            data = UnifiedDataExporter._get_unified_point_data(point)
            result = store.get_radius_result(point_id)
            construction_history = UnifiedDataExporter.get_construction_history(point_id)
            return {
                "point": data,
                "radius_result": result.model_dump() if result else None,
                "audit_logs": [log.model_dump() for log in point.audit_logs],
                "construction_history": construction_history,
            }
        else:
            points = store.get_all_points()
            return {
                "total": len(points),
                "deduped_total": len(UnifiedDataExporter._get_deduped_points()),
                "points": [
                    UnifiedDataExporter._get_unified_point_data(p) for p in points
                ],
                "duplicate_groups": UnifiedDataExporter.get_duplicate_groups(),
            }

    @staticmethod
    def get_for_page_display(
        status_filter: Optional[PointStatus] = None,
        abnormal_filter: Optional[str] = None,
        deduped: bool = False,
    ) -> List[Dict[str, Any]]:
        points = UnifiedDataExporter._get_deduped_points() if deduped else store.get_all_points()
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
    def get_construction_history(point_id: str) -> List[Dict[str, Any]]:
        point = store.get_point(point_id)
        if not point:
            return []

        history = []
        for log in point.audit_logs:
            before_note = (log.before.get("construction_note") or "") if log.before else ""
            after_note = (log.after.get("construction_note") or "") if log.after else ""
            before_status = (log.before.get("status") or "") if log.before else ""
            after_status = (log.after.get("status") or "") if log.after else ""

            has_note_change = before_note != after_note
            has_construction_abnormal = any(
                AbnormalType.CONSTRUCTION_NOT_SYNCED.value in str(t)
                for t in [before_note, after_note, log.action, log.remark or ""]
            )

            if has_note_change or "施工" in log.action or has_construction_abnormal:
                history.append({
                    "操作时间": log.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
                    "操作人": log.operator,
                    "操作动作": log.action,
                    "施工备注_改前": before_note,
                    "施工备注_改后": after_note,
                    "状态_改前": UnifiedDataExporter._get_status_text(
                        PointStatus(before_status)
                    ) if before_status else "",
                    "状态_改后": UnifiedDataExporter._get_status_text(
                        PointStatus(after_status)
                    ) if after_status else "",
                    "备注说明": log.remark or "",
                })
        return history

    @staticmethod
    def get_construction_detour_report() -> Dict[str, Any]:
        all_points = store.get_all_points()
        construction_points = [
            p for p in all_points
            if p.construction_note or AbnormalType.CONSTRUCTION_NOT_SYNCED in p.abnormal_types
        ]

        detail_list = []
        for p in construction_points:
            result = store.get_radius_result(p.id)
            initial_note = ""
            initial_status = ""
            if p.audit_logs:
                first_log = p.audit_logs[0]
                if first_log.after:
                    initial_note = first_log.after.get("construction_note") or ""
                    initial_status = first_log.after.get("status") or ""

            detail_list.append({
                "点位ID": p.id,
                "原始行号": p.original_row_number,
                "点位名称": p.name,
                "地址": p.address,
                "初始施工备注": initial_note,
                "当前施工备注": p.construction_note or "",
                "是否触发施工未同步": "是" if AbnormalType.CONSTRUCTION_NOT_SYNCED in p.abnormal_types else "否",
                "初始状态": UnifiedDataExporter._get_status_text(
                    PointStatus(initial_status)
                ) if initial_status else "",
                "当前状态": UnifiedDataExporter._get_status_text(p.status),
                "最终服务半径": result.final_radius if result else p.service_radius,
                "是否人工改动": "是" if p.is_manual_modified else "否",
                "投诉编号": p.complaint_id or "",
                "导入批次": p.import_batch_id,
                "创建时间": p.created_at.strftime("%Y-%m-%d %H:%M:%S"),
                "备注变更次数": sum(
                    1 for log in p.audit_logs
                    if log.before and log.after
                    and log.before.get("construction_note") != log.after.get("construction_note")
                ),
            })

        return {
            "total_construction_points": len(detail_list),
            "total_not_synced": sum(1 for d in detail_list if d["是否触发施工未同步"] == "是"),
            "details": detail_list,
        }

    @staticmethod
    def export_to_excel(output_path: str, deduped: bool = False) -> str:
        all_points = store.get_all_points()
        export_points = UnifiedDataExporter._get_deduped_points() if deduped else all_points

        data = [UnifiedDataExporter._get_unified_point_data(p) for p in export_points]
        df = pd.DataFrame(data)

        construction_report = UnifiedDataExporter.get_construction_detour_report()

        with pd.ExcelWriter(output_path, engine="openpyxl") as writer:
            sheet_name = "服务半径明细(去重)" if deduped else "服务半径明细"
            df.to_excel(writer, sheet_name=sheet_name, index=False)

            pd.DataFrame(construction_report["details"]).fillna("").to_excel(
                writer, sheet_name="施工改道专项清单", index=False
            )

            construction_history_data = []
            for p in all_points:
                history = UnifiedDataExporter.get_construction_history(p.id)
                for h in history:
                    row = {
                        "点位ID": p.id,
                        "点位名称": p.name,
                        "原始行号": p.original_row_number,
                    }
                    row.update(h)
                    construction_history_data.append(row)
            if construction_history_data:
                df_history = pd.DataFrame(construction_history_data)
                df_history = df_history.fillna("")
                df_history.to_excel(
                    writer, sheet_name="施工备注变更历史", index=False
                )

            audit_data = []
            for p in all_points:
                for log in p.audit_logs:
                    before_note = log.before.get("construction_note") if log.before else ""
                    after_note = log.after.get("construction_note") if log.after else ""
                    before_status = log.before.get("status") if log.before else ""
                    after_status = log.after.get("status") if log.after else ""
                    audit_data.append(
                        {
                            "点位ID": p.id,
                            "点位名称": p.name,
                            "原始行号": p.original_row_number,
                            "操作时间": log.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
                            "操作人": log.operator,
                            "操作动作": log.action,
                            "施工备注_改前": before_note or "",
                            "施工备注_改后": after_note or "",
                            "状态_改前": UnifiedDataExporter._get_status_text(
                                PointStatus(before_status)
                            ) if before_status else "",
                            "状态_改后": UnifiedDataExporter._get_status_text(
                                PointStatus(after_status)
                            ) if after_status else "",
                            "备注": log.remark or "",
                        }
                    )
            if audit_data:
                pd.DataFrame(audit_data).fillna("").to_excel(
                    writer, sheet_name="审计追踪(含施工备注)", index=False
                )

            if not deduped:
                dup_groups = UnifiedDataExporter.get_duplicate_groups()
                dup_data = []
                for g in dup_groups:
                    for idx, pt in enumerate(g["点位列表"]):
                        dup_data.append({
                            "去重键": g["去重键"],
                            "重复次数": g["重复次数"],
                            "序号": idx + 1,
                            "点位ID": pt["点位ID"],
                            "原始行号": pt["原始行号"],
                            "导入批次": pt["导入批次"],
                            "创建时间": pt["创建时间"],
                            "当前状态": pt["当前状态"],
                        })
                if dup_data:
                    pd.DataFrame(dup_data).to_excel(
                        writer, sheet_name="重复点位明细", index=False
                    )

            summary = [
                {"项目": "总点位数(全量)", "数值": len(all_points)},
                {"项目": "去重后点位数", "数值": len(UnifiedDataExporter._get_deduped_points())},
                {"项目": "有施工备注的点位数", "数值": construction_report["total_construction_points"]},
                {"项目": "施工未同步到地图数", "数值": construction_report["total_not_synced"]},
                {"项目": "待居民代表复核数", "数值": len(store.get_points_by_status(PointStatus.RESIDENT_REVIEW))},
                {"项目": "重复导入组数", "数值": len(dup_groups) if not deduped else "（去重模式）"},
                {"项目": "导出时间", "数值": datetime.now().strftime("%Y-%m-%d %H:%M:%S")},
                {"项目": "导出口径说明", "数值": "施工改道专项清单与服务半径明细读取同一份底层数据；去重口径=点位名称+地址，取最新更新记录"},
            ]
            pd.DataFrame(summary).to_excel(writer, sheet_name="导出汇总", index=False)

        return output_path

    @staticmethod
    def get_audit_evidence(point_id: str) -> Dict[str, Any]:
        point = store.get_point(point_id)
        if not point:
            return {"error": "点位不存在"}

        result = store.get_radius_result(point_id)
        construction_history = UnifiedDataExporter.get_construction_history(point_id)

        initial_note = ""
        initial_radius = None
        if point.audit_logs:
            first_log = point.audit_logs[0]
            if first_log.after:
                initial_note = first_log.after.get("construction_note") or ""
                initial_radius = first_log.after.get("service_radius")

        return {
            "point_id": point_id,
            "point_name": point.name,
            "original_row_number": point.original_row_number,
            "is_manual_modified": point.is_manual_modified,
            "current_status": point.status.value,
            "status_text": UnifiedDataExporter._get_status_text(point.status),
            "abnormal_types": [t.value for t in point.abnormal_types],
            "initial_construction_note": initial_note,
            "current_construction_note": point.construction_note or "",
            "initial_service_radius": initial_radius,
            "current_service_radius": result.final_radius if result else point.service_radius,
            "construction_history": construction_history,
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
            "source_tracing": {
                "import_batch_id": point.import_batch_id,
                "original_excel_row": point.original_row_number,
                "creation_time": point.created_at.isoformat(),
                "first_import_note": initial_note,
                "can_trace_to_original": point.original_row_number > 0 and point.import_batch_id,
            },
        }
