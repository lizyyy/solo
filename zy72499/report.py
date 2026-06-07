import os
from datetime import datetime
from models import MergeSession, RecordStatus, PointStatus


def generate_review_report(session: MergeSession, output_dir: str = "output") -> str:
    os.makedirs(output_dir, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    report_path = os.path.join(output_dir, f"复盘记录_{session.session_id}_{timestamp}.md")

    lines = []
    lines.append(f"# 城中村门牌归并 - 复盘记录")
    lines.append("")
    lines.append(f"**会话ID**: {session.session_id}")
    lines.append(f"**会话名称**: {session.name}")
    lines.append(f"**创建时间**: {session.created_at.strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append(f"**完成时间**: {session.completed_at.strftime('%Y-%m-%d %H:%M:%S') if session.completed_at else '未完成'}")
    lines.append("")

    lines.append("## 一、处理结果统计")
    lines.append("")
    status_count = {}
    for record in session.records:
        status = record.status.value
        status_count[status] = status_count.get(status, 0) + 1

    for status, count in status_count.items():
        lines.append(f"- **{status}**: {count} 条")
    lines.append("")

    lines.append("## 二、点位清单")
    lines.append("")
    lines.append("| 点位ID | 门牌编号 | 地址 | 状态 | 关联记录 | 备注 |")
    lines.append("|--------|----------|------|------|----------|------|")
    for point in session.points:
        lines.append(
            f"| {point.point_id} | {point.house_number} | {point.address} | {point.status.value} | {', '.join(point.source_records)} | {point.remark} |"
        )
    lines.append("")

    lines.append("## 三、记录明细与历史轨迹")
    lines.append("")

    for record in session.records:
        lines.append(f"### {record.record_id} - {record.house_number}")
        lines.append("")
        lines.append(f"- **来源**: {record.source.value}")
        lines.append(f"- **当前状态**: {record.status.value}")
        lines.append(f"- **居民投诉编号**: {record.resident_complaint_id or '无'}")
        lines.append(f"- **路口照片ID**: {record.intersection_photo_id or '无'}")
        lines.append(f"- **关联点位**: {record.point_id or '无'}")
        lines.append(f"- **施工临时改道**: {'是' if record.is_temporary_detour else '否'}")
        lines.append(f"- **旧口径**: {'是' if record.is_old_standard else '否'}")
        if record.remark:
            lines.append(f"- **备注**: {record.remark}")
        lines.append("")

        if record.conflicts:
            lines.append("#### 冲突证据")
            lines.append("")
            for idx, conflict in enumerate(record.conflicts, 1):
                lines.append(f"{idx}. **{conflict.field_name}**")
                lines.append(f"   - 居民投诉: {conflict.complaint_value}")
                lines.append(f"   - 路口照片: {conflict.photo_value}")
                lines.append(f"   - 说明: {conflict.description}")
            lines.append("")

        lines.append("#### 操作历史")
        lines.append("")
        lines.append("| 时间 | 操作人 | 操作 | 状态变更前 | 备注 |")
        lines.append("|------|--------|------|------------|------|")
        for log in record.audit_logs:
            lines.append(
                f"| {log.timestamp.strftime('%Y-%m-%d %H:%M:%S')} | {log.operator} | {log.action} | {log.before_status or '-'} | {log.remark} |"
            )
        lines.append("")

    lines.append("## 四、点位清单与历史记录核对")
    lines.append("")
    lines.append("### 核对结果")
    lines.append("")
    all_matched = True
    for point in session.points:
        for record_id in point.source_records:
            record = None
            for r in session.records:
                if r.record_id == record_id:
                    record = r
                    break
            if record and record.point_id == point.point_id:
                lines.append(f"- ✅ {point.point_id} ↔ {record_id}: 双向关联一致")
            else:
                lines.append(f"- ❌ {point.point_id} ↔ {record_id}: 关联不一致")
                all_matched = False
    lines.append("")
    if all_matched:
        lines.append("**核对结论**: 所有点位与记录双向关联一致 ✓")
    else:
        lines.append("**核对结论**: 存在关联不一致，需检查 ✗")
    lines.append("")

    report_content = "\n".join(lines)
    with open(report_path, "w", encoding="utf-8") as f:
        f.write(report_content)

    return report_path


def generate_replay_script(session: MergeSession, output_dir: str = "output") -> str:
    os.makedirs(output_dir, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    script_path = os.path.join(output_dir, f"重跑命令_{session.session_id}_{timestamp}.sh")

    lines = []
    lines.append("#!/bin/bash")
    lines.append("")
    lines.append(f"# 城中村门牌归并重跑脚本")
    lines.append(f"# 会话ID: {session.session_id}")
    lines.append(f"# 生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append("")
    lines.append("# 使用方法:")
    lines.append("#   chmod +x 重跑命令_*.sh")
    lines.append("#   ./重跑命令_*.sh")
    lines.append("")
    lines.append("set -e")
    lines.append("")
    lines.append('echo "开始重跑城中村门牌归并流程..."')
    lines.append('echo "会话ID: ' + session.session_id + '"')
    lines.append("")

    for cmd in session.replay_commands:
        lines.append(cmd)

    lines.append("")
    lines.append('echo "归并流程重跑完成！"')
    lines.append('echo "请查看 output/ 目录下的复盘记录"')

    script_content = "\n".join(lines)
    with open(script_path, "w", encoding="utf-8") as f:
        f.write(script_content)

    os.chmod(script_path, 0o755)
    return script_path


def generate_console_summary(session: MergeSession) -> str:
    lines = []
    lines.append("=" * 60)
    lines.append("  城中村门牌归并 - 处理结果")
    lines.append("=" * 60)
    lines.append(f"  会话: {session.name} ({session.session_id})")
    lines.append("")

    lines.append("  [处理统计]")
    status_count = {}
    for record in session.records:
        status = record.status.value
        status_count[status] = status_count.get(status, 0) + 1
    for status, count in status_count.items():
        marker = "  "
        if status == "已归并":
            marker = "✅"
        elif status == "冲突待确认":
            marker = "⚠️"
        elif status == "待居民代表复核":
            marker = "👥"
        elif status == "已补录":
            marker = "📝"
        elif status == "已驳回":
            marker = "❌"
        lines.append(f"    {marker} {status}: {count} 条")
    lines.append("")

    lines.append("  [点位清单]")
    for point in session.points:
        lines.append(f"    • {point.point_id}: {point.house_number} - {point.address} [{point.status.value}]")
    lines.append("")

    lines.append("  [待处理事项]")
    has_pending = False
    for record in session.records:
        if record.status == RecordStatus.CONFLICT:
            has_pending = True
            lines.append(f"    ⚠️  {record.record_id}: 冲突待周姐确认")
        if record.status == RecordStatus.PENDING_RESIDENT_REVIEW:
            has_pending = True
            lines.append(f"    👥  {record.record_id}: 待居民代表复核(施工临时改道)")
    if not has_pending:
        lines.append("    无待处理事项")
    lines.append("")

    lines.append("=" * 60)

    return "\n".join(lines)
