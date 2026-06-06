import os
import json
from datetime import datetime
from core import WorkflowEngine
from models import TrackStatus


STATUS_LABELS = {
    TrackStatus.NORMAL: "✅ 正常",
    TrackStatus.NEEDS_REWORK: "🔄 需返工",
    TrackStatus.PENDING_COPYRIGHT_REVIEW: "⏳ 待版权运营复核",
    TrackStatus.APPROVED: "✓ 已通过",
}


def generate_text_report(engine: WorkflowEngine, output_path: str = None) -> str:
    lines = []
    lines.append("=" * 60)
    lines.append("       录音棚工时尾差核对报告")
    lines.append("=" * 60)
    lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append(f"当前步骤: 第 {engine.state.step} 步")
    lines.append("")

    total_tracks = len(engine.tickets)
    rework_tracks = sum(1 for t in engine.tickets.values() if t.has_rework_reason)
    pending_review = sum(
        1 for c in engine.rehearsal_changes.values()
        if c.status == TrackStatus.PENDING_COPYRIGHT_REVIEW
    )

    lines.append("【概览】")
    lines.append(f"  总轨道数: {total_tracks}")
    lines.append(f"  含返工原因: {rework_tracks} 条")
    lines.append(f"  待版权运营复核: {pending_review} 条")
    lines.append("")

    if engine.get_tracks_with_rework():
        lines.append("【⚠️  轨道备注含返工原因（重点关注）】")
        lines.append("-" * 60)
        for t in engine.get_tracks_with_rework():
            lines.append(f"  轨道 {t.track_id}: {t.track_name}")
            lines.append(f"    计划工时: {t.planned_hours}h | 实际工时: {t.actual_hours}h | 尾差: {t.hour_diff:+.1f}h")
            lines.append(f"    返工关键词: {', '.join(t.rework_keywords)}")
            lines.append(f"    轨道备注: {t.track_remark}")
            lines.append("")

    if engine.rehearsal_changes:
        lines.append("【排练变更记录】")
        lines.append("-" * 60)
        for change in engine.rehearsal_changes.values():
            status_label = STATUS_LABELS.get(change.status, change.status)
            lines.append(f"  {status_label} | 轨道 {change.track_id}: {change.track_name}")
            lines.append(f"    为什么留下: {change.kept_why}")
            lines.append(f"    变更原因: {change.change_reason}")
            if change.missing_materials:
                lines.append(f"    还缺材料: {', '.join(change.missing_materials)}")
            lines.append(f"    下一步找谁: → {change.next_contact}")
            if change.notes:
                lines.append(f"    备注详情:")
                for note_line in change.notes.split('\n'):
                    lines.append(f"      - {note_line}")
            lines.append("")

    if not engine.state.copyright_review_done and pending_review > 0:
        lines.append("【💡 提示】")
        lines.append(f"  还有 {pending_review} 条记录待版权运营复核，")
        lines.append("  包含返工原因的轨道不会自动归为正常。")
        lines.append("")

    report = "\n".join(lines)

    if output_path:
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(report)

    return report


def generate_dashboard_html(engine: WorkflowEngine, output_path: str) -> str:
    total_tracks = len(engine.tickets)
    rework_count = sum(1 for t in engine.tickets.values() if t.has_rework_reason)
    pending_count = sum(
        1 for c in engine.rehearsal_changes.values()
        if c.status == TrackStatus.PENDING_COPYRIGHT_REVIEW
    )
    approved_count = sum(
        1 for c in engine.rehearsal_changes.values()
        if c.status == TrackStatus.APPROVED
    )

    ticket_data = {tid: t.track_remark for tid, t in engine.tickets.items()}
    audio_data = {tid: af.audio_remark for tid, af in engine.audio_files.items()}
    ticket_json = json.dumps(ticket_data, ensure_ascii=False)
    audio_json = json.dumps(audio_data, ensure_ascii=False)

    rework_rows = ""
    for t in engine.get_tracks_with_rework():
        ticket = engine.tickets.get(t.track_id)
        audio = engine.audio_files.get(t.track_id)
        audio_remark = audio.audio_remark if audio else "（未补录）"
        rework_rows += f"""
        <tr class="rework-row">
            <td>{t.track_id}</td>
            <td>{t.track_name}</td>
            <td>{ticket.hour_diff:+.1f}h</td>
            <td class="keyword-badge">{', '.join(t.rework_keywords)}</td>
            <td class="remark-cell" onclick="showDetail('{t.track_id}', 'ticket', this)">
                {t.track_remark}
            </td>
            <td class="remark-cell audio-remark" onclick="showDetail('{t.track_id}', 'audio', this)">
                {audio_remark}
            </td>
            <td><span class="status-pending">待复核</span></td>
        </tr>
        """

    change_rows = ""
    for c in engine.rehearsal_changes.values():
        status_class = {
            TrackStatus.NORMAL: "status-normal",
            TrackStatus.NEEDS_REWORK: "status-rework",
            TrackStatus.PENDING_COPYRIGHT_REVIEW: "status-pending",
            TrackStatus.APPROVED: "status-approved",
        }.get(c.status, "")
        status_text = STATUS_LABELS.get(c.status, c.status)
        change_rows += f"""
        <tr>
            <td>{c.track_id}</td>
            <td>{c.track_name}</td>
            <td>{c.kept_why}</td>
            <td>{', '.join(c.missing_materials) if c.missing_materials else '-'}</td>
            <td><strong>{c.next_contact}</strong></td>
            <td><span class="{status_class}">{status_text}</span></td>
        </tr>
        """

    step_indicators = ""
    steps = [
        ("1", "票务导出表导入", engine.state.ticket_imported),
        ("2", "阿梅补看音频备注", engine.state.amei_review_done),
        ("3", "排练变更记录更新", engine.state.rehearsal_updated),
        ("4", "版权运营复核", engine.state.copyright_review_done),
    ]
    for num, label, done in steps:
        active_class = "active" if engine.state.step >= int(num) else ""
        done_class = "done" if done else ""
        step_indicators += f"""
        <div class="step {active_class} {done_class}">
            <div class="step-circle">{num}</div>
            <div class="step-label">{label}</div>
        </div>
        """

    time_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    html = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>录音棚工时尾差核对 - 看板</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
            background: #f5f7fa;
            color: #333;
            padding: 20px;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 24px 32px;
            border-radius: 12px;
            margin-bottom: 24px;
        }
        .header h1 { font-size: 24px; margin-bottom: 8px; }
        .header p { opacity: 0.9; font-size: 14px; }
        .stats {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 16px;
            margin-bottom: 24px;
        }
        .stat-card {
            background: white;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.06);
        }
        .stat-card .number {
            font-size: 32px;
            font-weight: bold;
            color: #667eea;
        }
        .stat-card .label { color: #666; font-size: 14px; margin-top: 4px; }
        .stat-card.warning .number { color: #f59e0b; }
        .stat-card.pending .number { color: #3b82f6; }
        .stat-card.success .number { color: #10b981; }

        .steps {
            display: flex;
            justify-content: space-between;
            background: white;
            padding: 20px 32px;
            border-radius: 10px;
            margin-bottom: 24px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.06);
        }
        .step {
            display: flex;
            flex-direction: column;
            align-items: center;
            flex: 1;
            position: relative;
        }
        .step-circle {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: #e5e7eb;
            color: #999;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            margin-bottom: 8px;
            transition: all 0.3s;
        }
        .step.active .step-circle {
            background: #667eea;
            color: white;
        }
        .step.done .step-circle {
            background: #10b981;
            color: white;
        }
        .step-label { font-size: 13px; color: #666; }
        .step.active .step-label { color: #333; font-weight: 500; }

        .section {
            background: white;
            border-radius: 10px;
            padding: 24px;
            margin-bottom: 24px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.06);
        }
        .section h2 {
            font-size: 18px;
            margin-bottom: 16px;
            color: #333;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .section h2 .badge {
            background: #fef3c7;
            color: #d97706;
            padding: 2px 10px;
            border-radius: 12px;
            font-size: 12px;
        }

        table {
            width: 100%;
            border-collapse: collapse;
        }
        th, td {
            padding: 12px 16px;
            text-align: left;
            border-bottom: 1px solid #eee;
            font-size: 14px;
        }
        th {
            background: #f9fafb;
            color: #666;
            font-weight: 500;
        }
        .rework-row {
            background: #fffbeb;
        }
        .rework-row:hover {
            background: #fef3c7;
        }
        .remark-cell {
            max-width: 200px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            cursor: pointer;
            color: #667eea;
        }
        .remark-cell:hover { text-decoration: underline; }
        .keyword-badge {
            display: inline-block;
            background: #fee2e2;
            color: #dc2626;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 12px;
        }
        .status-normal { color: #10b981; }
        .status-pending { color: #3b82f6; }
        .status-rework { color: #f59e0b; }
        .status-approved { color: #10b981; font-weight: 500; }

        .modal {
            display: none;
            position: fixed;
            top: 0; left: 0;
            width: 100%; height: 100%;
            background: rgba(0,0,0,0.5);
            z-index: 1000;
            align-items: center;
            justify-content: center;
        }
        .modal.show { display: flex; }
        .modal-content {
            background: white;
            padding: 24px;
            border-radius: 10px;
            max-width: 500px;
            width: 90%;
        }
        .modal-content h3 { margin-bottom: 12px; }
        .modal-content p {
            color: #333;
            line-height: 1.6;
            padding: 12px;
            background: #f9fafb;
            border-radius: 6px;
        }
        .modal-content button {
            margin-top: 16px;
            padding: 8px 16px;
            background: #667eea;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🎵 录音棚工时尾差核对</h1>
        <p>生成时间: __TIME__ | 当前步骤: 第 __STEP__ 步</p>
    </div>

    <div class="stats">
        <div class="stat-card">
            <div class="number">__TOTAL__</div>
            <div class="label">总轨道数</div>
        </div>
        <div class="stat-card warning">
            <div class="number">__REWORK__</div>
            <div class="label">含返工原因</div>
        </div>
        <div class="stat-card pending">
            <div class="number">__PENDING__</div>
            <div class="label">待版权复核</div>
        </div>
        <div class="stat-card success">
            <div class="number">__APPROVED__</div>
            <div class="label">已通过</div>
        </div>
    </div>

    <div class="steps">
        __STEPS__
    </div>

    <div class="section">
        <h2>⚠️ 轨道备注含返工原因 <span class="badge">点击备注查看详情</span></h2>
        <table>
            <thead>
                <tr>
                    <th>轨道编号</th>
                    <th>曲目名称</th>
                    <th>工时尾差</th>
                    <th>返工关键词</th>
                    <th>票务备注（点击查看）</th>
                    <th>音频备注（点击查看）</th>
                    <th>状态</th>
                </tr>
            </thead>
            <tbody>
                __REWORK_ROWS__
            </tbody>
        </table>
    </div>

    <div class="section">
        <h2>📋 排练变更记录</h2>
        <table>
            <thead>
                <tr>
                    <th>轨道编号</th>
                    <th>曲目名称</th>
                    <th>为什么留下</th>
                    <th>还缺材料</th>
                    <th>下一步找谁</th>
                    <th>状态</th>
                </tr>
            </thead>
            <tbody>
                __CHANGE_ROWS__
            </tbody>
        </table>
    </div>

    <div id="modal" class="modal">
        <div class="modal-content">
            <h3 id="modal-title">备注详情</h3>
            <p id="modal-content"></p>
            <button onclick="closeModal()">关闭</button>
        </div>
    </div>

    <script>
        const ticketRemarks = __TICKET_JSON__;
        const audioRemarks = __AUDIO_JSON__;

        function showDetail(trackId, type, el) {
            const modal = document.getElementById('modal');
            const title = document.getElementById('modal-title');
            const content = document.getElementById('modal-content');

            if (type === 'ticket') {
                title.textContent = '票务导出表 - 轨道备注';
                content.textContent = ticketRemarks[trackId] || '无';
            } else {
                title.textContent = '音频文件 - 备注';
                content.textContent = audioRemarks[trackId] || '（未补录）';
            }
            modal.classList.add('show');
        }

        function closeModal() {
            document.getElementById('modal').classList.remove('show');
        }

        document.getElementById('modal').addEventListener('click', function(e) {
            if (e.target === this) closeModal();
        });
    </script>
</body>
</html>
"""

    html = html.replace('__TIME__', time_str)
    html = html.replace('__STEP__', str(engine.state.step))
    html = html.replace('__TOTAL__', str(total_tracks))
    html = html.replace('__REWORK__', str(rework_count))
    html = html.replace('__PENDING__', str(pending_count))
    html = html.replace('__APPROVED__', str(approved_count))
    html = html.replace('__STEPS__', step_indicators)
    html = html.replace('__REWORK_ROWS__', rework_rows)
    html = html.replace('__CHANGE_ROWS__', change_rows)
    html = html.replace('__TICKET_JSON__', ticket_json)
    html = html.replace('__AUDIO_JSON__', audio_json)

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(html)

    return output_path
