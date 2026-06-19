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
    def _group_by_dedup_key() -> Dict[str, List[NightSamplingPoint]]:
        groups = defaultdict(list)
        for p in store.get_all_points():
            key = UnifiedDataExporter._get_dedup_key(p)
            groups[key].append(p)
        for key in groups:
            groups[key].sort(key=lambda p: p.updated_at, reverse=True)
        return dict(groups)

    @staticmethod
    def _get_deduped_points() -> List[NightSamplingPoint]:
        groups = UnifiedDataExporter._group_by_dedup_key()
        return [group[0] for group in groups.values()]

    @staticmethod
    def _get_group_members(point: NightSamplingPoint) -> List[NightSamplingPoint]:
        key = UnifiedDataExporter._get_dedup_key(point)
        groups = UnifiedDataExporter._group_by_dedup_key()
        return groups.get(key, [point])

    @staticmethod
    def get_duplicate_groups() -> List[Dict[str, Any]]:
        groups = UnifiedDataExporter._group_by_dedup_key()
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
                            "施工备注": p.construction_note or "",
                        }
                        for p in group
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
            construction_history = UnifiedDataExporter.get_construction_history(point_id, aggregated=True)
            return {
                "point": data,
                "radius_result": result.model_dump() if result else None,
                "audit_logs": [log.model_dump() for log in point.audit_logs],
                "construction_history": construction_history,
                "group_size": len(UnifiedDataExporter._get_group_members(point)),
                "group_batch_ids": [p.import_batch_id for p in UnifiedDataExporter._get_group_members(point)],
            }
        else:
            points = store.get_all_points()
            deduped = UnifiedDataExporter._get_deduped_points()
            return {
                "total": len(points),
                "deduped_total": len(deduped),
                "points": [
                    UnifiedDataExporter._get_unified_point_data(p) for p in deduped
                ],
                "duplicate_groups": UnifiedDataExporter.get_duplicate_groups(),
            }

    @staticmethod
    def get_for_page_display(
        status_filter: Optional[PointStatus] = None,
        abnormal_filter: Optional[str] = None,
        deduped: bool = True,
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
    def get_construction_history(
        point_id: str,
        aggregated: bool = True,
    ) -> List[Dict[str, Any]]:
        point = store.get_point(point_id)
        if not point:
            return []

        points_to_check = UnifiedDataExporter._get_group_members(point) if aggregated else [point]
        all_records = []

        for p in points_to_check:
            for log in p.audit_logs:
                before_note_raw = (log.before.get("construction_note") or "") if log.before else ""
                after_note_raw = (log.after.get("construction_note") or "") if log.after else ""
                before_note = "" if before_note_raw is None or str(before_note_raw).lower() in ("nan", "none") else str(before_note_raw)
                after_note = "" if after_note_raw is None or str(after_note_raw).lower() in ("nan", "none") else str(after_note_raw)
                before_status = (log.before.get("status") or "") if log.before else ""
                after_status = (log.after.get("status") or "") if log.after else ""

                has_note_change = before_note != after_note
                has_construction_abnormal = any(
                    AbnormalType.CONSTRUCTION_NOT_SYNCED.value in str(t)
                    for t in [before_note, after_note, log.action, log.remark or ""]
                )
                has_construction_keyword = any(
                    kw in (log.action or "") or kw in (log.remark or "")
                    for kw in ["施工", "改道", "绕行", "修路", "封路"]
                )

                if has_note_change or has_construction_keyword or has_construction_abnormal:
                    all_records.append({
                        "点位名称": p.name,
                        "点位地址": p.address,
                        "所属批次": p.import_batch_id,
                        "点位ID": p.id,
                        "原始行号": p.original_row_number,
                        "操作时间": log.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
                        "操作时间戳": log.timestamp.isoformat(),
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

        all_records.sort(key=lambda r: r["操作时间戳"])
        seen = []
        for r in all_records:
            r.pop("操作时间戳", None)
            seen.append(r)
        return seen

    @staticmethod
    def get_construction_detour_report(
        deduped: bool = True,
        include_all_batch_trace: bool = True,
    ) -> Dict[str, Any]:
        if deduped:
            candidate_points = UnifiedDataExporter._get_deduped_points()
        else:
            candidate_points = store.get_all_points()

        construction_points = []
        for p in candidate_points:
            group_members = UnifiedDataExporter._get_group_members(p)
            has_any_construction = any(
                m.construction_note or AbnormalType.CONSTRUCTION_NOT_SYNCED in m.abnormal_types
                for m in group_members
            )
            if has_any_construction:
                construction_points.append(p)

        detail_list = []
        for p in construction_points:
            group_members = UnifiedDataExporter._get_group_members(p)
            result = store.get_radius_result(p.id)

            earliest_member = min(group_members, key=lambda m: m.created_at)
            initial_note = ""
            initial_status = ""
            if earliest_member.audit_logs:
                first_log = earliest_member.audit_logs[0]
                if first_log.after:
                    initial_note = first_log.after.get("construction_note") or ""
                    initial_status = first_log.after.get("status") or ""

            latest_note = p.construction_note or ""
            latest_has_issue = AbnormalType.CONSTRUCTION_NOT_SYNCED in p.abnormal_types

            total_note_changes = 0
            all_batches = []
            for m in group_members:
                total_note_changes += sum(
                    1 for log in m.audit_logs
                    if log.before and log.after
                    and (log.before.get("construction_note") or "") != (log.after.get("construction_note") or "")
                )
                all_batches.append({
                    "批次ID": m.import_batch_id,
                    "原始行号": m.original_row_number,
                    "导入时间": m.created_at.strftime("%Y-%m-%d %H:%M:%S"),
                    "该批次施工备注": m.construction_note or "",
                    "该批次状态": UnifiedDataExporter._get_status_text(m.status),
                    "该批次是否有施工未同步": "是" if AbnormalType.CONSTRUCTION_NOT_SYNCED in m.abnormal_types else "否",
                })

            row = {
                "去重键(名称+地址)": UnifiedDataExporter._get_dedup_key(p),
                "主点位ID(最新)": p.id,
                "原始行号(主点位)": p.original_row_number,
                "点位名称": p.name,
                "地址": p.address,
                "重复批次数": len(group_members),
                "涉及批次列表": "; ".join(b["批次ID"] for b in all_batches),
                "初始施工备注(最早批次首次导入)": initial_note,
                "当前施工备注(最新批次)": latest_note,
                "是否触发施工未同步(最新状态)": "是" if latest_has_issue else "否",
                "初始状态": UnifiedDataExporter._get_status_text(
                    PointStatus(initial_status)
                ) if initial_status else "",
                "当前状态": UnifiedDataExporter._get_status_text(p.status),
                "最终服务半径": result.final_radius if result else p.service_radius,
                "是否人工改动(任一批次)": "是" if any(m.is_manual_modified for m in group_members) else "否",
                "投诉编号(最新)": p.complaint_id or "",
                "主导入批次": p.import_batch_id,
                "创建时间": earliest_member.created_at.strftime("%Y-%m-%d %H:%M:%S"),
                "最后更新时间": max(m.updated_at for m in group_members).strftime("%Y-%m-%d %H:%M:%S"),
                "备注变更总次数(所有批次合计)": total_note_changes,
            }

            if include_all_batch_trace:
                for idx, b in enumerate(all_batches):
                    row[f"批次{idx+1}_ID"] = b["批次ID"]
                    row[f"批次{idx+1}_原始行号"] = b["原始行号"]
                    row[f"批次{idx+1}_导入时间"] = b["导入时间"]
                    row[f"批次{idx+1}_施工备注"] = b["该批次施工备注"]
                    row[f"批次{idx+1}_状态"] = b["该批次状态"]
                    row[f"批次{idx+1}_是否施工未同步"] = b["该批次是否有施工未同步"]

            detail_list.append(row)

        return {
            "deduped": deduped,
            "total_points_under_rule": len(construction_points),
            "total_not_synced": sum(1 for d in detail_list if d["是否触发施工未同步(最新状态)"] == "是"),
            "total_duplicate_batches_across_points": sum(
                d["重复批次数"] - 1 for d in detail_list
            ),
            "details": detail_list,
        }

    @staticmethod
    def export_to_excel(output_path: str, deduped: bool = True) -> str:
        all_points = store.get_all_points()
        export_points = UnifiedDataExporter._get_deduped_points() if deduped else all_points
        export_point_ids = {p.id for p in export_points}

        data = [UnifiedDataExporter._get_unified_point_data(p) for p in export_points]
        df = pd.DataFrame(data)

        construction_report = UnifiedDataExporter.get_construction_detour_report(
            deduped=deduped,
            include_all_batch_trace=True,
        )

        with pd.ExcelWriter(output_path, engine="openpyxl") as writer:
            sheet_name = "服务半径明细(去重)" if deduped else "服务半径明细(全量)"
            df.fillna("").to_excel(writer, sheet_name=sheet_name, index=False)

            construction_cols = [c for c in construction_report["details"][0].keys()] if construction_report["details"] else []
            pd.DataFrame(construction_report["details"]).fillna("").to_excel(
                writer, sheet_name="施工改道专项清单", index=False,
                columns=construction_cols if construction_cols else None,
            )

            construction_history_data = []
            points_for_history = export_points if deduped else all_points
            for p in points_for_history:
                history = UnifiedDataExporter.get_construction_history(p.id, aggregated=True)
                for h in history:
                    row = {
                        "点位名称": h.get("点位名称", p.name),
                        "点位地址": h.get("点位地址", p.address),
                    }
                    row.update(h)
                    construction_history_data.append(row)
            if construction_history_data:
                pd.DataFrame(construction_history_data).fillna("").to_excel(
                    writer, sheet_name="施工备注变更历史(含全部批次)", index=False
                )

            audit_data = []
            points_for_audit = export_points if deduped else all_points
            for p in points_for_audit:
                group_members = UnifiedDataExporter._get_group_members(p) if deduped else [p]
                for m in group_members:
                    for log in m.audit_logs:
                        before_note_raw = (log.before.get("construction_note") or "") if log.before else ""
                        after_note_raw = (log.after.get("construction_note") or "") if log.after else ""
                        before_note = "" if before_note_raw is None or str(before_note_raw).lower() in ("nan", "none") else str(before_note_raw)
                        after_note = "" if after_note_raw is None or str(after_note_raw).lower() in ("nan", "none") else str(after_note_raw)
                        before_status = (log.before.get("status") or "") if log.before else ""
                        after_status = (log.after.get("status") or "") if log.after else ""
                        audit_data.append({
                            "所属批次": m.import_batch_id,
                            "主点位去重键": UnifiedDataExporter._get_dedup_key(p),
                            "点位ID": m.id,
                            "点位名称": m.name,
                            "原始行号": m.original_row_number,
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
                            "备注": log.remark or "",
                        })
            if audit_data:
                pd.DataFrame(audit_data).fillna("").to_excel(
                    writer, sheet_name="审计追踪(聚合全部批次)", index=False
                )

            dup_groups = UnifiedDataExporter.get_duplicate_groups()
            dup_data = []
            for g in dup_groups:
                for idx, pt in enumerate(g["点位列表"]):
                    dup_data.append({
                        "去重键(名称+地址)": g["去重键"],
                        "重复批次数": g["重复次数"],
                        "批次序号": idx + 1,
                        "点位ID": pt["点位ID"],
                        "原始行号": pt["原始行号"],
                        "导入批次": pt["导入批次"],
                        "创建时间": pt["创建时间"],
                        "当前状态": pt["当前状态"],
                        "施工备注": pt["施工备注"],
                    })
            if dup_data:
                pd.DataFrame(dup_data).fillna("").to_excel(
                    writer, sheet_name="重复批次明细(可追回重传)", index=False
                )

            summary = [
                {"项目": "去重口径", "数值": "点位名称 + 地址，取最新更新的点位作为主记录"},
                {"项目": "是否启用去重导出", "数值": "是" if deduped else "否"},
                {"项目": "全量点位数(含重传)", "数值": len(all_points)},
                {"项目": "去重后点位数(居民看到的数量)", "数值": len(export_points)},
                {"项目": "服务半径明细sheet行数", "数值": len(data)},
                {"项目": "施工改道专项清单行数(按同一去重口径)", "数值": construction_report["total_points_under_rule"]},
                {"项目": "其中：施工未同步到地图数", "数值": construction_report["total_not_synced"]},
                {"项目": "因重传额外产生的施工记录数(已合并掉)", "数值": construction_report["total_duplicate_batches_across_points"]},
                {"项目": "居民看到的待复核问题数(不翻倍)", "数值": len([d for d in construction_report["details"] if d["是否触发施工未同步(最新状态)"] == "是"])},
                {"项目": "重复导入组数", "数值": len(dup_groups)},
                {"项目": "导出时间", "数值": datetime.now().strftime("%Y-%m-%d %H:%M:%S")},
                {"项目": "口径保证", "数值": "服务半径明细与施工改道专项清单共用同一去重后的点位集合；施工备注变更历史聚合了同名称+地址点位的全部批次记录，可追回重传"},
            ]
            pd.DataFrame(summary).to_excel(writer, sheet_name="导出汇总与口径", index=False)

        return output_path

    @staticmethod
    def get_audit_evidence(point_id: str) -> Dict[str, Any]:
        point = store.get_point(point_id)
        if not point:
            return {"error": "点位不存在"}

        group_members = UnifiedDataExporter._get_group_members(point)
        result = store.get_radius_result(point_id)

        earliest_member = min(group_members, key=lambda m: m.created_at)
        latest_member = max(group_members, key=lambda m: m.updated_at)

        initial_note = ""
        initial_radius = None
        if earliest_member.audit_logs:
            first_log = earliest_member.audit_logs[0]
            if first_log.after:
                initial_note = first_log.after.get("construction_note") or ""
                initial_radius = first_log.after.get("service_radius")

        construction_history = UnifiedDataExporter.get_construction_history(point_id, aggregated=True)

        radius_history_all = []
        for m in group_members:
            for log in m.audit_logs:
                radius_history_all.append({
                    "所属批次": m.import_batch_id,
                    "原始行号": m.original_row_number,
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
                })
        radius_history_all.sort(key=lambda x: x["timestamp"])

        batch_trace = []
        for m in sorted(group_members, key=lambda x: x.created_at):
            batch_trace.append({
                "batch_id": m.import_batch_id,
                "original_excel_row": m.original_row_number,
                "import_time": m.created_at.isoformat(),
                "construction_note_on_import": (
                    m.audit_logs[0].after.get("construction_note") or ""
                    if m.audit_logs else (m.construction_note or "")
                ),
                "status": m.status.value,
                "has_construction_issue": AbnormalType.CONSTRUCTION_NOT_SYNCED in m.abnormal_types,
                "is_latest": m.id == latest_member.id,
            })

        return {
            "point_id": point_id,
            "dedup_key": UnifiedDataExporter._get_dedup_key(point),
            "point_name": point.name,
            "group_size(含重传批次数)": len(group_members),
            "original_row_number": point.original_row_number,
            "is_manual_modified": any(m.is_manual_modified for m in group_members),
            "current_status": point.status.value,
            "status_text": UnifiedDataExporter._get_status_text(point.status),
            "abnormal_types": [t.value for t in point.abnormal_types],
            "initial_construction_note": initial_note,
            "current_construction_note": point.construction_note or "",
            "initial_service_radius": initial_radius,
            "current_service_radius": result.final_radius if result else point.service_radius,
            "construction_history_all_batches": construction_history,
            "radius_history_all_batches": radius_history_all,
            "batch_trace": batch_trace,
            "source_tracing": {
                "primary_import_batch_id": point.import_batch_id,
                "first_ever_import_batch_id": earliest_member.import_batch_id,
                "first_ever_excel_row": earliest_member.original_row_number,
                "first_ever_import_time": earliest_member.created_at.isoformat(),
                "first_import_note": initial_note,
                "total_batches_for_this_point": len(group_members),
                "can_trace_all_batches": True,
            },
        }
