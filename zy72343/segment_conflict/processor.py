"""核心处理流程：导入、检测、补录、版本管理

关键设计：所有入口（CLI/API/报告/Web）统计参数版本时，
统一调用 get_latest_parameter_versions() 去重后再统计，
确保列表/详情/摘要/历史记录/导出报告串到同一份最新结果。
"""
import json
import csv
from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime
from .models import (
    Point3D,
    Segment,
    Conflict,
    GapRecord,
    ReviewRecord,
    ParameterVersion,
    Project,
)
from .algorithms import detect_all_conflicts, detect_gaps


# ============================================================
#  统一入口：最新参数版本获取（所有统计展示都走这里）
# ============================================================

def get_latest_parameter_versions(
    project: Project,
) -> Dict[int, ParameterVersion]:
    """获取每条线段的**最新**参数版本（按segment_id去重）

    所有入口（CLI status / API / 报告 / Web面板）统计
    「待小祁补录」「待教研组复核」时都必须调用此函数去重。
    返回：{segment_id: 最新ParameterVersion对象}
    """
    latest: Dict[int, ParameterVersion] = {}
    for pv in project.parameter_versions:
        if (
            pv.segment_id not in latest
            or pv.version > latest[pv.segment_id].version
        ):
            latest[pv.segment_id] = pv
    return latest


def get_parameter_version_history(
    project: Project, segment_id: int
) -> List[ParameterVersion]:
    """获取单条线段的完整参数版本历史（按版本号升序）"""
    history = [pv for pv in project.parameter_versions if pv.segment_id == segment_id]
    history.sort(key=lambda pv: pv.version)
    return history


def count_todo_by_latest_versions(
    project: Project,
) -> Tuple[int, int]:
    """基于最新参数版本统计待处理项

    Returns:
        (needs_qi_count, needs_review_count)
    """
    latest = get_latest_parameter_versions(project)
    needs_qi = 0
    needs_review = 0
    for pv in latest.values():
        if pv.next_owner == "数据分析师小祁" and pv.status == "needs_supplement":
            needs_qi += 1
        elif pv.next_owner == "教研组" and pv.status in (
            "pending_review",
            "ready_for_review",
        ):
            needs_review += 1
    return needs_qi, needs_review


# ============================================================
#  项目加载 / 保存
# ============================================================

def load_project(filepath: str) -> Project:
    """加载项目"""
    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)

    segments = []
    for s in data["segments"]:
        segments.append(
            Segment(
                id=s["id"],
                original_row_num=s["original_row_num"],
                name=s["name"],
                start=Point3D(**s["start"]),
                end=Point3D(**s["end"]),
                category=s["category"],
                source_type=s["source_type"],
                is_deleted=s.get("is_deleted", False),
                deleted_reason=s.get("deleted_reason"),
                questionnaire_row=s.get("questionnaire_row"),
                remark=s.get("remark"),
                meta=s.get("meta", {}),
            )
        )

    conflicts = []
    for c in data["conflicts"]:
        conflicts.append(
            Conflict(
                id=c["id"],
                segment1_id=c["segment1_id"],
                segment2_id=c["segment2_id"],
                intersection_point=Point3D(**c["intersection_point"]),
                distance=c["distance"],
                conflict_type=c["conflict_type"],
                severity=c["severity"],
                status=c.get("status", "pending_review"),
                review_note=c.get("review_note"),
                reviewer=c.get("reviewer"),
                reviewed_at=datetime.fromisoformat(c["reviewed_at"])
                if c.get("reviewed_at")
                else None,
            )
        )

    gaps = []
    for g in data["gaps"]:
        gaps.append(
            GapRecord(
                gap_start=g["gap_start"],
                gap_end=g["gap_end"],
                missing_count=g["missing_count"],
                segment_before=g.get("segment_before"),
                segment_after=g.get("segment_after"),
                status=g.get("status", "pending_supplement"),
                supplemented_rows=g.get("supplemented_rows", []),
                note=g.get("note"),
                reviewed_by=g.get("reviewed_by"),
                reviewed_at=datetime.fromisoformat(g["reviewed_at"])
                if g.get("reviewed_at")
                else None,
            )
        )

    parameter_versions = []
    for p in data.get("parameter_versions", []):
        parameter_versions.append(
            ParameterVersion(
                version=p["version"],
                segment_id=p["segment_id"],
                kept_reason=p["kept_reason"],
                missing_materials=p["missing_materials"],
                next_owner=p["next_owner"],
                status=p["status"],
                created_at=datetime.fromisoformat(p["created_at"]),
                created_by=p["created_by"],
                original_value=p.get("original_value"),
                new_value=p.get("new_value"),
                change_reason=p.get("change_reason"),
                change_log=p.get("change_log", []),
            )
        )

    review_records = []
    for r in data.get("review_records", []):
        review_records.append(
            ReviewRecord(
                id=r["id"],
                target_type=r["target_type"],
                target_id=r["target_id"],
                original_status=r["original_status"],
                new_status=r["new_status"],
                reason=r["reason"],
                next_owner=r["next_owner"],
                reviewer=r["reviewer"],
                reviewed_at=datetime.fromisoformat(r["reviewed_at"]),
                changes=r.get("changes", {}),
            )
        )

    return Project(
        name=data["name"],
        segments=segments,
        conflicts=conflicts,
        gaps=gaps,
        parameter_versions=parameter_versions,
        review_records=review_records,
        created_at=datetime.fromisoformat(data["created_at"]),
        updated_at=datetime.fromisoformat(data["updated_at"]),
        version=data.get("version", 1),
    )


# ============================================================
#  第一步：导入手算反例
# ============================================================

def import_segments_from_csv(csv_path: str, project_name: str) -> Project:
    """从CSV导入线段数据（第一步：手算反例第一次导入）"""
    segments: List[Segment] = []
    with open(csv_path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row_num, row in enumerate(reader, start=1):
            try:
                seg_id = int(row.get("id", row_num))
                original_row = int(row.get("original_row_num", row_num))
                is_deleted_val = row.get("is_deleted") or "false"
                is_deleted = str(is_deleted_val).lower() == "true"

                source_type = row.get("source_type") or "hand_calculated"
                deleted_reason = row.get("deleted_reason") or None
                questionnaire_val = row.get("questionnaire_row")
                questionnaire_row = (
                    int(questionnaire_val) if questionnaire_val else None
                )
                remark = row.get("remark") or None

                segments.append(
                    Segment(
                        id=seg_id,
                        original_row_num=original_row,
                        name=row["name"],
                        start=Point3D(
                            float(row["start_x"]),
                            float(row["start_y"]),
                            float(row["start_z"]),
                        ),
                        end=Point3D(
                            float(row["end_x"]),
                            float(row["end_y"]),
                            float(row["end_z"]),
                        ),
                        category=row["category"],
                        source_type=source_type,
                        is_deleted=is_deleted,
                        deleted_reason=deleted_reason,
                        questionnaire_row=questionnaire_row,
                        remark=remark,
                        meta={
                            k: v
                            for k, v in row.items()
                            if k and v and str(k).startswith("meta_")
                        },
                    )
                )
            except (KeyError, ValueError) as e:
                print(f"第{row_num}行导入失败: {e}")
                continue

    project = Project(name=project_name, segments=segments)

    project.gaps = detect_gaps(segments)
    project.conflicts = detect_all_conflicts(segments)
    project.parameter_versions = _initialize_parameter_versions(segments)
    project.updated_at = datetime.now()

    return project


def _initialize_parameter_versions(segments: List[Segment]) -> List[ParameterVersion]:
    """初始化参数版本v1（原始说法=导入时的初始状态）"""
    versions: List[ParameterVersion] = []
    now = datetime.now()
    for seg in segments:
        if seg.is_deleted:
            kept_reason = "已标记删除，等待教研组复核后决定是否保留"
            missing_materials = ["删除原因说明", "问卷原始行验证"]
            next_owner = "教研组"
            status = "pending_review"
            original_value = "导入即标记为已删除"
            new_value = "保留在历史中，待教研组复核是否恢复"
            change_reason = seg.deleted_reason or "手算反例标记删除"
        else:
            if seg.questionnaire_row:
                kept_reason = "有问卷原始行支撑，保留待复核"
                missing_materials: List[str] = []
                next_owner = "教研组"
                status = "ready_for_review"
                original_value = "问卷行未关联"
                new_value = f"已关联问卷原始行#{seg.questionnaire_row}"
                change_reason = "导入时自带问卷行关联"
            else:
                kept_reason = "手算反例导入，暂未关联问卷原始行"
                missing_materials = ["问卷原始行关联", "数据源验证"]
                next_owner = "数据分析师小祁"
                status = "needs_supplement"
                original_value = "未关联问卷原始行"
                new_value = "（待数据分析师小祁补录）"
                change_reason = "首次导入手算反例"

        versions.append(
            ParameterVersion(
                version=1,
                segment_id=seg.id,
                kept_reason=kept_reason,
                missing_materials=missing_materials,
                next_owner=next_owner,
                status=status,
                created_at=now,
                created_by="系统自动生成",
                original_value=original_value,
                new_value=new_value,
                change_reason=change_reason,
                change_log=["初始导入，参数版本v1"],
            )
        )
    return versions


# ============================================================
#  第二步：数据分析师小祁补录问卷原始行
# ============================================================

def supplement_questionnaire_row(
    project: Project,
    segment_id: int,
    questionnaire_row: int,
    reviewer: str = "数据分析师小祁",
) -> Project:
    """补录问卷原始行（第二步：数据分析师小祁补看问卷原始行）

    同时更新：
    1. segment.questionnaire_row / source_type
    2. gap.supplemented_rows / status / note（如问卷行落在断档区间）
    3. 生成新的参数版本（v递增），记录 原始值→改后值→处理原因
    4. conflicts、project.version、updated_at
    """
    segment = next((s for s in project.segments if s.id == segment_id), None)
    if not segment:
        raise ValueError(f"未找到线段ID: {segment_id}")

    # 1. 更新线段本身
    old_questionnaire = segment.questionnaire_row
    segment.questionnaire_row = questionnaire_row
    segment.source_type = "questionnaire_verified"

    # 2. 更新关联的断档记录（问卷行落在哪个断档区间，就补到哪里）
    for gap in project.gaps:
        if gap.gap_start <= questionnaire_row <= gap.gap_end:
            if questionnaire_row not in gap.supplemented_rows:
                gap.supplemented_rows.append(questionnaire_row)
                gap.supplemented_rows.sort()
            if len(gap.supplemented_rows) >= gap.missing_count:
                gap.status = "supplemented"
            else:
                gap.status = "partially_resolved"
            gap.note = (
                f"数据分析师小祁补录问卷原始行 {questionnaire_row}"
                + (f"（共{gap.missing_count}行，已补{len(gap.supplemented_rows)}行）"
                   if gap.missing_count > 1
                   else "")
            )

    # 3. 生成新参数版本（记录变更四要素：原始说法、改后值、处理原因、下一步找谁）
    _append_parameter_version(
        project=project,
        segment_id=segment_id,
        change_note=(
            f"数据分析师小祁补录问卷原始行: {questionnaire_row}"
            f"（原: {old_questionnaire if old_questionnaire else '未关联'}）"
        ),
        reviewer=reviewer,
        change_reason="补看问卷原始行后补录，提升数据完整度",
        original_value=(
            f"问卷原始行 = {old_questionnaire}"
            if old_questionnaire
            else "问卷原始行 = 未关联"
        ),
        new_value=f"问卷原始行 = {questionnaire_row}",
    )

    # 4. 重新检测冲突、递增版本
    project.conflicts = detect_all_conflicts(project.segments)
    project.version += 1
    project.updated_at = datetime.now()

    return project


def _append_parameter_version(
    project: Project,
    segment_id: int,
    change_note: str,
    reviewer: str,
    change_reason: str,
    original_value: Optional[str],
    new_value: Optional[str],
):
    """追加新参数版本（基于当前线段最新状态推导 kept_reason / missing_materials / next_owner）

    此函数是所有入口共享的参数版本推导逻辑，确保一致性。
    """
    existing = [p for p in project.parameter_versions if p.segment_id == segment_id]
    latest_version = max(p.version for p in existing) if existing else 0

    segment = next(s for s in project.segments if s.id == segment_id)

    # ===== 统一推导规则（所有入口都走这套） =====
    if segment.is_deleted:
        kept_reason = "已标记删除，等待教研组最终确认（不提前归正常）"
        missing_materials = ["删除原因复核"]
        next_owner = "教研组"
        status = "pending_review"
    else:
        if segment.questionnaire_row:
            kept_reason = "已关联问卷原始行，数据完整度提升"
            missing_materials = []
            next_owner = "教研组"
            status = "ready_for_review"
        else:
            kept_reason = "手算反例数据，仍需问卷原始行支撑"
            missing_materials = ["问卷原始行关联"]
            next_owner = "数据分析师小祁"
            status = "needs_supplement"

    # 补充还缺什么材料：如果相邻断档还在待补录，追加提示
    for gap in project.gaps:
        if gap.status in ("pending_supplement", "partially_resolved"):
            adjacent = (
                (segment.original_row_num == gap.gap_start - 1)
                or (segment.original_row_num == gap.gap_end + 1)
            )
            if adjacent and segment.questionnaire_row:
                material = (
                    f"相邻断档第{gap.gap_start}-{gap.gap_end}行需补录/复核"
                )
                if material not in missing_materials:
                    missing_materials.append(material)
                if "相邻断档处理" not in kept_reason:
                    kept_reason += f"；但相邻断档第{gap.gap_start}-{gap.gap_end}行待处理"
                if next_owner != "教研组":
                    next_owner = "教研组"

    new_pv = ParameterVersion(
        version=latest_version + 1,
        segment_id=segment_id,
        kept_reason=kept_reason,
        missing_materials=missing_materials,
        next_owner=next_owner,
        status=status,
        created_at=datetime.now(),
        created_by=reviewer,
        original_value=original_value,
        new_value=new_value,
        change_reason=change_reason,
        change_log=[change_note],
    )
    project.parameter_versions.append(new_pv)


# ============================================================
#  第三步：教研组复核断档 / 复核参数版本
# ============================================================

def review_gap(
    project: Project,
    gap_index: int,
    approved: bool,
    review_note: str,
    reviewer: str = "教研组",
) -> Project:
    """教研组复核断档：不急着归正常，保留完整复核记录链

    更新内容：
    1. gap.status（仅在教研组明确操作后变更，不提前归正常）
    2. 生成 ReviewRecord：原始状态→新状态→处理原因→下一步找谁
    3. 对 gap 相邻的两条线段，分别追加参数版本（记录此复核的影响）
    4. project.version、updated_at
    """
    if gap_index < 0 or gap_index >= len(project.gaps):
        raise ValueError(f"无效的断档索引: {gap_index}")

    gap = project.gaps[gap_index]
    original_status = gap.status

    # 1. 变更断档状态
    if approved:
        if len(gap.supplemented_rows) >= gap.missing_count:
            gap.status = "resolved"
            next_owner_gap = "（已解决）"
        else:
            gap.status = "partially_resolved"
            next_owner_gap = "数据分析师小祁（仍需补录缺失行）"
        gap.note = (
            f"教研组复核通过: {review_note}"
            + f"（已补{len(gap.supplemented_rows)}/{gap.missing_count}行）"
        )
    else:
        gap.status = "rejected"
        next_owner_gap = "数据分析师小祁（重新核实问卷原始行）"
        gap.note = f"教研组驳回: {review_note}"

    gap.reviewed_by = reviewer
    gap.reviewed_at = datetime.now()

    # 2. 生成 ReviewRecord（完整四要素）
    review_id = len(project.review_records) + 1
    changes: Dict[str, Any] = {
        "status": {"from": original_status, "to": gap.status},
        "supplemented_rows": gap.supplemented_rows,
        "note": gap.note,
    }
    project.review_records.append(
        ReviewRecord(
            id=review_id,
            target_type="gap",
            target_id=f"gap#{gap_index}({gap.gap_start}-{gap.gap_end})",
            original_status=original_status,
            new_status=gap.status,
            reason=review_note,
            next_owner=next_owner_gap,
            reviewer=reviewer,
            reviewed_at=datetime.now(),
            changes=changes,
        )
    )

    # 3. 对相邻两条线段分别追加参数版本（同步告知此复核对它们的影响）
    adjacent_seg_ids = [gap.segment_before, gap.segment_after]
    for seg_id in adjacent_seg_ids:
        if seg_id is None:
            continue
        _append_parameter_version(
            project=project,
            segment_id=seg_id,
            change_note=(
                f"教研组复核断档第{gap.gap_start}-{gap.gap_end}行: "
                f"{'通过' if approved else '驳回'} - {review_note}"
            ),
            reviewer=reviewer,
            change_reason=f"相邻断档状态变更（{original_status}→{gap.status}），同步更新本线段状态",
            original_value=f"相邻断档状态 = {original_status}",
            new_value=f"相邻断档状态 = {gap.status}（{review_note}）",
        )

    project.version += 1
    project.updated_at = datetime.now()
    return project


def review_segment_parameter(
    project: Project,
    segment_id: int,
    approved: bool,
    review_note: str,
    reviewer: str = "教研组",
) -> Project:
    """教研组直接复核单条线段的参数版本（不提前归正常，保留完整记录链）"""
    segment = next((s for s in project.segments if s.id == segment_id), None)
    if segment is None:
        raise ValueError(f"未找到线段ID: {segment_id}")

    latest_map = get_latest_parameter_versions(project)
    latest_pv = latest_map.get(segment_id)
    original_status = latest_pv.status if latest_pv else "unknown"

    # 记录 ReviewRecord
    review_id = len(project.review_records) + 1
    if approved:
        new_status = "resolved"
        next_owner_seg = "（已完成，可进入施工方案）"
    else:
        new_status = "needs_supplement"
        next_owner_seg = "数据分析师小祁（按复核意见补正）"

    changes: Dict[str, Any] = {
        "status": {"from": original_status, "to": new_status},
        "review_note": review_note,
        "segment_info": {
            "name": segment.name,
            "original_row": segment.original_row_num,
            "questionnaire_row": segment.questionnaire_row,
        },
    }
    project.review_records.append(
        ReviewRecord(
            id=review_id,
            target_type="segment_parameter",
            target_id=f"segment#{segment_id}({segment.name})",
            original_status=original_status,
            new_status=new_status,
            reason=review_note,
            next_owner=next_owner_seg,
            reviewer=reviewer,
            reviewed_at=datetime.now(),
            changes=changes,
        )
    )

    # 追加参数版本
    pv = ParameterVersion(
        version=(latest_pv.version + 1) if latest_pv else 1,
        segment_id=segment_id,
        kept_reason=(
            f"教研组复核{'通过' if approved else '驳回'}: {review_note}"
        ),
        missing_materials=(
            [] if approved else [f"按教研组意见补正: {review_note}"]
        ),
        next_owner=("（已完成）" if approved else "数据分析师小祁"),
        status=new_status,
        created_at=datetime.now(),
        created_by=reviewer,
        original_value=f"参数版本状态 = {original_status}",
        new_value=f"参数版本状态 = {new_status}（{review_note}）",
        change_reason=f"教研组复核操作: {'通过' if approved else '驳回'}",
        change_log=[
            f"教研组复核{'通过' if approved else '驳回'}: {review_note}",
        ],
    )
    project.parameter_versions.append(pv)

    project.version += 1
    project.updated_at = datetime.now()
    return project


# ============================================================
#  报告生成（所有统计基于最新参数版本，保证和 CLI / API 一致）
# ============================================================

def generate_report(project: Project, output_path: str):
    """生成报告（有温度、可解释、与其他入口统计一致）

    一致性保证：
    - 待小祁 / 待教研组 数量通过 count_todo_by_latest_versions() 统计
    - 参数版本页展示「同一条线段只取最新版本」，但附完整历史
    - 断档、冲突、行动指引全部串到同一份 project 对象上
    """
    # ===== 统一取最新参数版本 =====
    latest_pvs = get_latest_parameter_versions(project)
    needs_qi_count, needs_review_count = count_todo_by_latest_versions(project)

    needs_qi_list = [
        pv for pv in latest_pvs.values()
        if pv.next_owner == "数据分析师小祁" and pv.status == "needs_supplement"
    ]
    needs_review_list = [
        pv for pv in latest_pvs.values()
        if pv.next_owner == "教研组"
        and pv.status in ("pending_review", "ready_for_review")
    ]

    active_segments = [s for s in project.segments if not s.is_deleted]
    deleted_segments = [s for s in project.segments if s.is_deleted]
    pending_gaps = [g for g in project.gaps if g.status == "pending_supplement"]
    critical_conflicts = [
        c for c in project.conflicts if c.severity in ("critical", "high")
    ]

    # ===== 写报告 =====
    L: List[str] = []
    sep60 = "=" * 60
    sep40 = "-" * 40

    L.append(sep60)
    L.append("  线段相交施工冲突检测报告")
    L.append(sep60)
    L.append(f"项目名称: {project.name}")
    L.append(f"报告版本: v{project.version}")
    L.append(f"生成时间: {project.updated_at.strftime('%Y-%m-%d %H:%M:%S')}")
    L.append(
        f"一致性校验: 最新参数版本覆盖 {len(latest_pvs)}/{len(project.segments)} 条线段"
        f"（共 {len(project.parameter_versions)} 条历史版本）"
    )
    L.append("")

    # 一、数据概览
    L.append(sep40)
    L.append("一、数据概览（与 CLI status / API 摘要一致）")
    L.append(sep40)
    L.append(f"  有效线段数: {len(active_segments)}")
    L.append(f"  已删除线段数: {len(deleted_segments)}")
    L.append(f"  检测冲突数: {len(project.conflicts)}")
    L.append(f"  严重/高危冲突: {len(critical_conflicts)}")
    L.append(f"  待补录断档: {len(pending_gaps)}")
    L.append(f"  待数据分析师小祁处理: {needs_qi_count} 条")
    L.append(f"  待教研组复核: {needs_review_count} 条")
    L.append("")

    # 二、编号断档追踪
    L.append(sep40)
    L.append("二、编号断档追踪（人工删除行标记，不提前归正常）")
    L.append(sep40)
    if project.gaps:
        for i, gap in enumerate(project.gaps, 1):
            L.append(
                f"  断档#{i}: 第{gap.gap_start}-{gap.gap_end}行"
                f"（缺失{gap.missing_count}行）"
            )
            L.append(f"    状态: {_translate_status(gap.status)}")
            if gap.supplemented_rows:
                L.append(
                    f"    已补录行: {gap.supplemented_rows}"
                    f"（{len(gap.supplemented_rows)}/{gap.missing_count}）"
                )
            if gap.reviewed_by:
                L.append(
                    f"    复核人: {gap.reviewed_by} @ "
                    f"{gap.reviewed_at.strftime('%Y-%m-%d %H:%M') if gap.reviewed_at else ''}"
                )
            if gap.note:
                L.append(f"    备注: {gap.note}")
            if gap.status == "pending_supplement":
                L.append("    → 下一步: 找数据分析师小祁补录问卷原始行")
            elif gap.status in ("partially_resolved", "supplemented"):
                L.append("    → 下一步: 找教研组复核确认（不提前归正常）")
            elif gap.status == "rejected":
                L.append("    → 下一步: 找数据分析师小祁重新核实")
            L.append("")
    else:
        L.append("  无断档")
        L.append("")

    # 三、线段相交冲突
    L.append(sep40)
    L.append("三、线段相交冲突列表")
    L.append(sep40)
    if project.conflicts:
        for c in project.conflicts:
            s1 = next((s for s in project.segments if s.id == c.segment1_id), None)
            s2 = next((s for s in project.segments if s.id == c.segment2_id), None)
            sev_label = {"critical": "【严重】", "high": "【高危】", "medium": "【中等】"}.get(
                c.severity, ""
            )
            L.append(
                f"  冲突#{c.id} {sev_label}{_translate_type(c.conflict_type)}"
            )
            L.append(
                f"    线段: {s1.name if s1 else '未知'}"
                f" (原始行{s1.original_row_num if s1 else '?'})"
                f" ↔ {s2.name if s2 else '未知'}"
                f" (原始行{s2.original_row_num if s2 else '?'})"
            )
            L.append(
                f"    交点: ({c.intersection_point.x:.2f},"
                f" {c.intersection_point.y:.2f}, {c.intersection_point.z:.2f})"
            )
            L.append(f"    距离: {c.distance:.6f}米")
            L.append(f"    状态: {_translate_status(c.status)}")
            if c.review_note:
                L.append(f"    复核意见: {c.review_note}")
            L.append("")
    else:
        L.append("  未检测到冲突")
        L.append("")

    # 四、参数版本页（数据血缘追踪）
    L.append(sep40)
    L.append("四、参数版本页（数据血缘追踪 - 展示最新版本，附变更四要素）")
    L.append(sep40)
    L.append("  ■ 待数据分析师小祁处理:")
    if needs_qi_list:
        needs_qi_list.sort(key=lambda pv: pv.segment_id)
        for pv in needs_qi_list:
            seg = next((s for s in project.segments if s.id == pv.segment_id), None)
            L.append(
                f"    线段{pv.segment_id} "
                f"({seg.name if seg else '未知'}): v{pv.version}"
                f"  <{_translate_status(pv.status)}>"
            )
            L.append(f"      为什么被留下: {pv.kept_reason}")
            L.append(
                f"      还缺什么材料: "
                f"{'、'.join(pv.missing_materials) if pv.missing_materials else '无'}"
            )
            if pv.original_value:
                L.append(f"      原始说法: {pv.original_value}")
            if pv.new_value:
                L.append(f"      改后值  : {pv.new_value}")
            if pv.change_reason:
                L.append(f"      处理原因: {pv.change_reason}")
            L.append(f"      下一步找谁: {pv.next_owner}")
            if pv.change_log:
                L.append(f"      变更记录: {pv.change_log[-1]}")
            L.append("")
    else:
        L.append("    无")
        L.append("")

    L.append("  ■ 待教研组复核:")
    if needs_review_list:
        needs_review_list.sort(key=lambda pv: pv.segment_id)
        for pv in needs_review_list:
            seg = next((s for s in project.segments if s.id == pv.segment_id), None)
            L.append(
                f"    线段{pv.segment_id} "
                f"({seg.name if seg else '未知'}): v{pv.version}"
                f"  <{_translate_status(pv.status)}>"
            )
            L.append(f"      为什么被留下: {pv.kept_reason}")
            L.append(
                f"      还缺什么材料: "
                f"{'、'.join(pv.missing_materials) if pv.missing_materials else '无'}"
            )
            if seg and seg.questionnaire_row:
                L.append(f"      关联问卷行: 第{seg.questionnaire_row}行")
            if pv.original_value:
                L.append(f"      原始说法: {pv.original_value}")
            if pv.new_value:
                L.append(f"      改后值  : {pv.new_value}")
            if pv.change_reason:
                L.append(f"      处理原因: {pv.change_reason}")
            L.append(f"      下一步找谁: {pv.next_owner}（本报告不提前归正常）")
            if pv.change_log:
                L.append(f"      变更记录: {pv.change_log[-1]}")
            L.append("")
    else:
        L.append("    无")
        L.append("")

    # 五、人工复核记录链
    if project.review_records:
        L.append(sep40)
        L.append("五、人工复核记录链（原始说法→改后值→处理原因→下一步找谁）")
        L.append(sep40)
        for r in project.review_records:
            type_label = {"gap": "断档复核", "segment_parameter": "参数版本复核"}.get(
                r.target_type, r.target_type
            )
            L.append(
                f"  复核#{r.id} [{type_label}] {r.target_id}"
                f"  @{r.reviewer} {r.reviewed_at.strftime('%Y-%m-%d %H:%M')}"
            )
            L.append(
                f"    原始说法: 状态=「{_translate_status(r.original_status)}」"
            )
            L.append(f"    改后值  : 状态=「{_translate_status(r.new_status)}」")
            L.append(f"    处理原因: {r.reason}")
            L.append(f"    下一步找谁: {r.next_owner}")
            if r.changes:
                L.append(f"    变更明细: {json.dumps(r.changes, ensure_ascii=False)}")
            L.append("")

    # 六、参数版本历史（每条线段完整变更链）
    L.append(sep40)
    L.append(
        "六、参数版本完整历史（每条线段 v1→v2→…，供追溯；"
        "摘要处已用最新版本统计，请勿用此处计数）"
    )
    L.append(sep40)
    seg_ids = sorted({pv.segment_id for pv in project.parameter_versions})
    for sid in seg_ids:
        history = get_parameter_version_history(project, sid)
        seg = next((s for s in project.segments if s.id == sid), None)
        L.append(
            f"  线段{sid} ({seg.name if seg else '未知'}): "
            f"共{len(history)}个版本"
        )
        for pv in history:
            L.append(
                f"    v{pv.version}  [{_translate_status(pv.status)}]"
                f"  {pv.created_by} @ "
                f"{pv.created_at.strftime('%Y-%m-%d %H:%M')}"
            )
            L.append(f"        保留原因: {pv.kept_reason}")
            if pv.original_value:
                L.append(f"        原始说法: {pv.original_value}")
            if pv.new_value:
                L.append(f"        改后值  : {pv.new_value}")
            if pv.change_reason:
                L.append(f"        处理原因: {pv.change_reason}")
            L.append(f"        下一步  : {pv.next_owner}")
        L.append("")

    # 七、下一步行动指引（数量由最新参数版本保证一致）
    L.append(sep40)
    L.append("七、下一步行动指引（与其他入口摘要一致）")
    L.append(sep40)
    if needs_qi_count > 0:
        L.append(f"  □ 数据分析师小祁: 补录 {needs_qi_count} 条线段的问卷原始行/补正材料")
    if needs_review_count > 0:
        L.append(f"  □ 教研组: 复核 {needs_review_count} 条线段的参数版本")
    if pending_gaps:
        L.append(f"  □ 数据分析师小祁: 处理 {len(pending_gaps)} 处编号断档")
    if critical_conflicts:
        L.append(f"  □ 施工方: 处理 {len(critical_conflicts)} 处严重/高危冲突")
    if (
        needs_qi_count == 0
        and needs_review_count == 0
        and not pending_gaps
        and not critical_conflicts
    ):
        L.append("  ✓ 所有项目已处理完毕")
    L.append("")

    L.append(sep60)
    L.append("  报告结束 - 如有疑问请联系数据分析师小祁或教研组")
    L.append(
        "  一致性说明: 本报告「待处理数量」「参数版本」与 CLI status / API / Web 面板"
        "均基于同一份最新参数版本去重结果"
    )
    L.append(sep60)

    with open(output_path, "w", encoding="utf-8") as f:
        f.write("\n".join(L))


# ============================================================
#  辅助翻译
# ============================================================

def _translate_status(status: str) -> str:
    mapping = {
        "pending_review": "待复核",
        "pending_supplement": "待补录",
        "needs_supplement": "需补录",
        "ready_for_review": "待复核(材料齐)",
        "partially_resolved": "部分补录待复核",
        "supplemented": "已补录待复核",
        "resolved": "已解决",
        "rejected": "已驳回(待补正)",
    }
    return mapping.get(status, status)


def _translate_type(ctype: str) -> str:
    mapping = {
        "exact_intersection": "精确相交",
        "near_intersection": "近似相交",
        "close_proximity": "距离过近",
    }
    return mapping.get(ctype, ctype)
