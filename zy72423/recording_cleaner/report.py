from datetime import datetime
from .models import WeeklyReportItem, SongStatus


def render_weekly_report(items: list, week_range: str = None) -> str:
    if week_range is None:
        today = datetime.now()
        week_start = today.strftime("%Y-%m-%d")
        week_range = f"{week_start} 周度汇总"

    pending_review = [i for i in items if i.status == SongStatus.PENDING_REVIEW]
    pending_contract = [i for i in items if i.status == SongStatus.PENDING_CONTRACT]
    completed = [i for i in items if i.status == SongStatus.COMPLETED]
    normal = [i for i in items if i.status == SongStatus.NORMAL]

    lines = []
    lines.append("=" * 60)
    lines.append(f"  录音工程轨道备注清洗周报 —— {week_range}")
    lines.append("=" * 60)
    lines.append("")
    lines.append(f"📊 本周概览")
    lines.append(f"  ├─ 总歌曲数：{len(items)}")
    lines.append(f"  ├─ 待音乐老师复核：{len(pending_review)} 首")
    lines.append(f"  ├─ 待补合同页截图：{len(pending_contract)} 首")
    lines.append(f"  ├─ 已完成清洗：{len(completed)} 首")
    lines.append(f"  └─ 正常无特殊处理：{len(normal)} 首")
    lines.append("")

    if pending_review:
        lines.append("-" * 60)
        lines.append(f"🔍 待音乐老师复核（共 {len(pending_review)} 首）")
        lines.append("-" * 60)
        for idx, item in enumerate(pending_review, 1):
            lines.append(f"{idx}. 🎵 {item.song_scene_name}")
            if item.song_copyright_name:
                lines.append(f"     版权登记名：{item.song_copyright_name}")
            lines.append(f"     ⚠️  为什么留下：{item.why_kept}")
            lines.append(f"     📭 还缺材料：{'、'.join(item.missing_materials) if item.missing_materials else '无'}")
            lines.append(f"     👤 下一步找：{item.next_step_person}")
            lines.append(f"     📋 具体动作：{item.next_step_detail}")
            lines.append("")

    if pending_contract:
        lines.append("-" * 60)
        lines.append(f"📄 待补合同页截图（共 {len(pending_contract)} 首）")
        lines.append("-" * 60)
        for idx, item in enumerate(pending_contract, 1):
            lines.append(f"{idx}. 🎵 {item.song_scene_name}")
            if item.song_copyright_name:
                lines.append(f"     版权登记名：{item.song_copyright_name}")
            lines.append(f"     ⚠️  为什么留下：{item.why_kept}")
            lines.append(f"     📭 还缺材料：{'、'.join(item.missing_materials) if item.missing_materials else '无'}")
            lines.append(f"     👤 下一步找：{item.next_step_person}")
            lines.append(f"     📋 具体动作：{item.next_step_detail}")
            lines.append("")

    if completed:
        lines.append("-" * 60)
        lines.append(f"✅ 已完成清洗（共 {len(completed)} 首）")
        lines.append("-" * 60)
        for idx, item in enumerate(completed, 1):
            lines.append(f"{idx}. 🎵 {item.song_scene_name}")
            if item.song_copyright_name:
                lines.append(f"     版权登记名：{item.song_copyright_name}")
            lines.append(f"     ✅ 状态：{item.why_kept}")
            lines.append("")

    if normal:
        lines.append("-" * 60)
        lines.append(f"🎶 正常歌曲（共 {len(normal)} 首，无特殊清洗需求）")
        lines.append("-" * 60)
        song_names = [i.song_scene_name for i in normal]
        lines.append("  " + "、".join(song_names))
        lines.append("")

    lines.append("=" * 60)
    lines.append("  📝 备注：碰到同一首歌有现场名和版权名时，先不急着归正常，")
    lines.append("           一律留给音乐老师复核后再推进后续流程。")
    lines.append("=" * 60)

    return "\n".join(lines)


def render_review_log(logs: list) -> str:
    lines = []
    lines.append("=" * 60)
    lines.append("  操作审计记录（复盘用）")
    lines.append("=" * 60)
    for log in logs:
        ts = log.timestamp.strftime("%Y-%m-%d %H:%M:%S")
        lines.append(f"[{ts}] {log.operator} | {log.action}")
        lines.append(f"       歌曲ID：{log.song_id}")
        lines.append(f"       备注：{log.note}")
        lines.append("")
    return "\n".join(lines)
