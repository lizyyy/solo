"""核心处理流程：导入、检测、补录、版本管理"""
import json
import csv
from typing import List, Optional, Dict, Any
from datetime import datetime
from .models import (
    Point3D,
    Segment,
    Conflict,
    GapRecord,
    ParameterVersion,
    Project,
)
from .algorithms import detect_all_conflicts, detect_gaps


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
            )
        )

    parameter_versions = []
    for p in data["parameter_versions"]:
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
                change_log=p.get("change_log", []),
            )
        )

    return Project(
        name=data["name"],
        segments=segments,
        conflicts=conflicts,
        gaps=gaps,
        parameter_versions=parameter_versions,
        created_at=datetime.fromisoformat(data["created_at"]),
        updated_at=datetime.fromisoformat(data["updated_at"]),
        version=data.get("version", 1),
    )


def import_segments_from_csv(csv_path: str, project_name: str) -> Project:
    """从CSV导入线段数据（第一步：手算反例第一次导入）"""
    segments = []
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
                questionnaire_row = int(questionnaire_val) if questionnaire_val else None
                remark = row.get("remark") or None

                segment = Segment(
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
                    meta={k: v for k, v in row.items() if k and v and str(k).startswith("meta_")},
                )
                segments.append(segment)
            except (KeyError, ValueError) as e:
                print(f"第{row_num}行导入失败: {e}")
                continue

    project = Project(name=project_name, segments=segments)

    gaps = detect_gaps(segments)
    project.gaps = gaps

    conflicts = detect_all_conflicts(segments)
    project.conflicts = conflicts

    project.parameter_versions = _initialize_parameter_versions(segments)
    project.updated_at = datetime.now()

    return project


def _initialize_parameter_versions(segments: List[Segment]) -> List[ParameterVersion]:
    """初始化参数版本记录（解释每条为什么被留下、缺什么、下一步找谁）"""
    versions = []
    for seg in segments:
        if seg.is_deleted:
            kept_reason = "已标记删除，等待教研组复核后决定是否保留"
            missing_materials = ["删除原因说明", "问卷原始行验证"]
            next_owner = "教研组"
            status = "pending_review"
        else:
            if seg.questionnaire_row:
                kept_reason = "有问卷原始行支撑，保留待复核"
                missing_materials = []
                next_owner = "教研组"
                status = "ready_for_review"
            else:
                kept_reason = "手算反例导入，暂未关联问卷原始行"
                missing_materials = ["问卷原始行关联", "数据源验证"]
                next_owner = "数据分析师小祁"
                status = "needs_supplement"

        versions.append(
            ParameterVersion(
                version=1,
                segment_id=seg.id,
                kept_reason=kept_reason,
                missing_materials=missing_materials,
                next_owner=next_owner,
                status=status,
                created_at=datetime.now(),
                created_by="系统自动生成",
                change_log=["初始导入，参数版本v1"],
            )
        )
    return versions


def supplement_questionnaire_row(
    project: Project,
    segment_id: int,
    questionnaire_row: int,
    reviewer: str = "数据分析师小祁",
) -> Project:
    """补录问卷原始行（第二步：数据分析师小祁补看问卷原始行）"""
    segment = None
    for s in project.segments:
        if s.id == segment_id:
            segment = s
            break

    if not segment:
        raise ValueError(f"未找到线段ID: {segment_id}")

    old_questionnaire = segment.questionnaire_row
    segment.questionnaire_row = questionnaire_row
    segment.source_type = "questionnaire_verified"

    for gap in project.gaps:
        if gap.gap_start <= questionnaire_row <= gap.gap_end:
            if questionnaire_row not in gap.supplemented_rows:
                gap.supplemented_rows.append(questionnaire_row)
                gap.supplemented_rows.sort()
            if len(gap.supplemented_rows) >= gap.missing_count:
                gap.status = "supplemented"
            gap.note = f"已补录问卷原始行 {questionnaire_row}"

    _update_parameter_version(
        project,
        segment_id,
        change_note=f"数据分析师小祁补录问卷原始行: {questionnaire_row}（原: {old_questionnaire}）",
        reviewer=reviewer,
    )

    project.conflicts = detect_all_conflicts(project.segments)
    project.version += 1
    project.updated_at = datetime.now()

    return project


def _update_parameter_version(
    project: Project,
    segment_id: int,
    change_note: str,
    reviewer: str,
):
    """更新参数版本页（第三步：参数版本页更新）"""
    existing = [p for p in project.parameter_versions if p.segment_id == segment_id]
    latest_version = max(p.version for p in existing) if existing else 0

    segment = next(s for s in project.segments if s.id == segment_id)

    if segment.questionnaire_row and not segment.is_deleted:
        kept_reason = "已关联问卷原始行，数据完整度提升"
        missing_materials = []
        next_owner = "教研组"
        status = "ready_for_review"
    elif segment.is_deleted:
        kept_reason = "已标记删除，等待教研组最终确认"
        missing_materials = ["删除原因复核"]
        next_owner = "教研组"
        status = "pending_review"
    else:
        kept_reason = "手算反例数据，仍需问卷原始行支撑"
        missing_materials = ["问卷原始行关联"]
        next_owner = "数据分析师小祁"
        status = "needs_supplement"

    new_version = ParameterVersion(
        version=latest_version + 1,
        segment_id=segment_id,
        kept_reason=kept_reason,
        missing_materials=missing_materials,
        next_owner=next_owner,
        status=status,
        created_at=datetime.now(),
        created_by=reviewer,
        change_log=[change_note],
    )

    project.parameter_versions.append(new_version)


def review_gap(
    project: Project,
    gap_index: int,
    approved: bool,
    review_note: str,
    reviewer: str = "教研组",
) -> Project:
    """教研组复核断档（不急着归正常，留给教研组复核）"""
    if gap_index < 0 or gap_index >= len(project.gaps):
        raise ValueError(f"无效的断档索引: {gap_index}")

    gap = project.gaps[gap_index]

    if approved:
        if len(gap.supplemented_rows) >= gap.missing_count:
            gap.status = "resolved"
        else:
            gap.status = "partially_resolved"
    else:
        gap.status = "rejected"
        gap.note = f"教研组驳回: {review_note}"

    project.version += 1
    project.updated_at = datetime.now()

    return project


def generate_report(project: Project, output_path: str):
    """生成报告（不是冷冰冰的系统日志）"""
    active_segments = [s for s in project.segments if not s.is_deleted]
    deleted_segments = [s for s in project.segments if s.is_deleted]
    pending_gaps = [g for g in project.gaps if g.status == "pending_supplement"]
    critical_conflicts = [
        c for c in project.conflicts if c.severity in ["critical", "high"]
    ]

    needs_qi = [
        p
        for p in project.parameter_versions
        if p.next_owner == "数据分析师小祁" and p.status == "needs_supplement"
    ]
    needs_review = [
        p
        for p in project.parameter_versions
        if p.next_owner == "教研组" and p.status in ["pending_review", "ready_for_review"]
    ]

    report_lines = []
    report_lines.append("=" * 60)
    report_lines.append("  线段相交施工冲突检测报告")
    report_lines.append("=" * 60)
    report_lines.append(f"项目名称: {project.name}")
    report_lines.append(f"报告版本: v{project.version}")
    report_lines.append(f"生成时间: {project.updated_at.strftime('%Y-%m-%d %H:%M:%S')}")
    report_lines.append("")

    report_lines.append("-" * 40)
    report_lines.append("一、数据概览")
    report_lines.append("-" * 40)
    report_lines.append(f"  有效线段数: {len(active_segments)}")
    report_lines.append(f"  已删除线段数: {len(deleted_segments)}")
    report_lines.append(f"  检测冲突数: {len(project.conflicts)}")
    report_lines.append(f"  严重/高危冲突: {len(critical_conflicts)}")
    report_lines.append(f"  待补录断档: {len(pending_gaps)}")
    report_lines.append("")

    report_lines.append("-" * 40)
    report_lines.append("二、编号断档追踪（人工删除行标记）")
    report_lines.append("-" * 40)
    if project.gaps:
        for i, gap in enumerate(project.gaps, 1):
            report_lines.append(f"  断档#{i}: 第{gap.gap_start}-{gap.gap_end}行（缺失{gap.missing_count}行）")
            report_lines.append(f"    状态: {_translate_status(gap.status)}")
            if gap.supplemented_rows:
                report_lines.append(f"    已补录行: {gap.supplemented_rows}")
            if gap.note:
                report_lines.append(f"    备注: {gap.note}")
            if gap.status == "pending_supplement":
                report_lines.append(f"    → 下一步: 找数据分析师小祁补录问卷原始行")
            elif gap.status in ["partially_resolved", "supplemented"]:
                report_lines.append(f"    → 下一步: 找教研组复核确认")
            report_lines.append("")
    else:
        report_lines.append("  无断档")
        report_lines.append("")

    report_lines.append("-" * 40)
    report_lines.append("三、线段相交冲突列表")
    report_lines.append("-" * 40)
    if project.conflicts:
        for c in project.conflicts:
            s1 = next((s for s in project.segments if s.id == c.segment1_id), None)
            s2 = next((s for s in project.segments if s.id == c.segment2_id), None)
            severity_label = {"critical": "【严重】", "high": "【高危】", "medium": "【中等】"}.get(c.severity, "")
            report_lines.append(f"  冲突#{c.id} {severity_label}{_translate_type(c.conflict_type)}")
            report_lines.append(f"    线段: {s1.name if s1 else '未知'} ↔ {s2.name if s2 else '未知'}")
            report_lines.append(f"    交点: ({c.intersection_point.x:.2f}, {c.intersection_point.y:.2f}, {c.intersection_point.z:.2f})")
            report_lines.append(f"    距离: {c.distance:.6f}米")
            report_lines.append(f"    状态: {_translate_status(c.status)}")
            if c.review_note:
                report_lines.append(f"    复核意见: {c.review_note}")
            report_lines.append("")
    else:
        report_lines.append("  未检测到冲突")
        report_lines.append("")

    report_lines.append("-" * 40)
    report_lines.append("四、参数版本页（数据血缘追踪）")
    report_lines.append("-" * 40)
    report_lines.append("  待数据分析师小祁处理:")
    if needs_qi:
        for p in needs_qi:
            seg = next((s for s in project.segments if s.id == p.segment_id), None)
            report_lines.append(f"    线段{p.segment_id} ({seg.name if seg else '未知'}): v{p.version}")
            report_lines.append(f"      保留原因: {p.kept_reason}")
            report_lines.append(f"      缺失材料: {', '.join(p.missing_materials) if p.missing_materials else '无'}")
            report_lines.append(f"      变更记录: {p.change_log[-1]}")
            report_lines.append("")
    else:
        report_lines.append("    无")
        report_lines.append("")

    report_lines.append("  待教研组复核:")
    if needs_review:
        for p in needs_review:
            seg = next((s for s in project.segments if s.id == p.segment_id), None)
            report_lines.append(f"    线段{p.segment_id} ({seg.name if seg else '未知'}): v{p.version}")
            report_lines.append(f"      保留原因: {p.kept_reason}")
            report_lines.append(f"      缺失材料: {', '.join(p.missing_materials) if p.missing_materials else '无'}")
            if seg and seg.questionnaire_row:
                report_lines.append(f"      关联问卷行: {seg.questionnaire_row}")
            report_lines.append(f"      变更记录: {p.change_log[-1]}")
            report_lines.append("")
    else:
        report_lines.append("    无")
        report_lines.append("")

    report_lines.append("-" * 40)
    report_lines.append("五、下一步行动指引")
    report_lines.append("-" * 40)
    if needs_qi:
        report_lines.append(f"  □ 数据分析师小祁: 补录 {len(needs_qi)} 条线段的问卷原始行")
    if needs_review:
        report_lines.append(f"  □ 教研组: 复核 {len(needs_review)} 条线段的参数版本")
    if pending_gaps:
        report_lines.append(f"  □ 数据分析师小祁: 处理 {len(pending_gaps)} 处编号断档")
    if critical_conflicts:
        report_lines.append(f"  □ 施工方: 处理 {len(critical_conflicts)} 处严重/高危冲突")
    report_lines.append("")

    report_lines.append("=" * 60)
    report_lines.append("  报告结束 - 如有疑问请联系数据分析师小祁或教研组")
    report_lines.append("=" * 60)

    with open(output_path, "w", encoding="utf-8") as f:
        f.write("\n".join(report_lines))


def _translate_status(status: str) -> str:
    mapping = {
        "pending_review": "待复核",
        "pending_supplement": "待补录",
        "needs_supplement": "需补录",
        "ready_for_review": "待复核",
        "partially_resolved": "部分补录待复核",
        "supplemented": "已补录待复核",
        "resolved": "已解决",
        "rejected": "已驳回",
    }
    return mapping.get(status, status)


def _translate_type(ctype: str) -> str:
    mapping = {
        "exact_intersection": "精确相交",
        "near_intersection": "近似相交",
        "close_proximity": "距离过近",
    }
    return mapping.get(ctype, ctype)
