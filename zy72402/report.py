import os
import json
from datetime import datetime
from core import WorkflowEngine, detect_rework_reason
from models import TrackStatus


STATUS_LABELS = {
    TrackStatus.NORMAL: "✅ 正常",
    TrackStatus.NEEDS_REWORK: "🔄 需返工",
    TrackStatus.PENDING_COPYRIGHT_REVIEW: "⏳ 待版权运营复核",
    TrackStatus.APPROVED: "✓ 已通过",
}


def _get_combined_rework(engine: WorkflowEngine):
    """
    返回综合判定信息：票务+音频任一含返工就算返工
    返回: {
        track_id: {
            is_rework: bool,
            matched_keywords: [],
            ticket_reason: '',
            audio_reason: '',
            source: []  # 'ticket' / 'audio'
        }
    }
    """
    result = {}
    for tid, ticket in engine.tickets.items():
        t_det = ticket.detection_detail or detect_rework_reason(ticket.track_remark)
        audio = engine.audio_files.get(tid)
        audio_remark = audio.audio_remark if audio else ""
        a_det = detect_rework_reason(audio_remark)

        is_rework = t_det.is_rework or a_det.is_rework
        matched = list(set(t_det.matched_keywords + a_det.matched_keywords))
        source = []
        if t_det.is_rework:
            source.append("票务备注")
        if a_det.is_rework:
            source.append("音频备注")

        result[tid] = {
            "is_rework": is_rework,
            "matched_keywords": matched,
            "source": source,
            "ticket_detail": t_det,
            "audio_detail": a_det,
        }
    return result


def generate_text_report(engine: WorkflowEngine, output_path: str = None) -> str:
    lines = []
    lines.append("=" * 60)
    lines.append("       录音棚工时尾差核对报告")
    lines.append("=" * 60)
    lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append(f"当前步骤: 第 {engine.state.step} 步")
    lines.append("")

    total_tracks = len(engine.tickets)
    combined = _get_combined_rework(engine)
    rework_tracks = sum(1 for info in combined.values() if info["is_rework"])
    pending_review = sum(
        1 for c in engine.rehearsal_changes.values()
        if c.status == TrackStatus.PENDING_COPYRIGHT_REVIEW
    )

    lines.append("【概览】")
    lines.append(f"  总轨道数: {total_tracks}")
    lines.append(f"  含返工原因: {rework_tracks} 条")
    lines.append(f"  待版权运营复核: {pending_review} 条")
    lines.append("")

    rework_entries = [
        (tid, engine.tickets[tid], info)
        for tid, info in combined.items() if info["is_rework"]
    ]
    if rework_entries:
        lines.append("【⚠️  轨道备注或音频备注含返工原因（重点关注）】")
        lines.append("-" * 60)
        for tid, ticket, info in rework_entries:
            audio = engine.audio_files.get(tid)
            audio_remark = audio.audio_remark if audio else "（未补录）"
            lines.append(f"  轨道 {tid}: {ticket.track_name}")
            lines.append(f"    计划工时: {ticket.planned_hours}h | 实际工时: {ticket.actual_hours}h | 尾差: {ticket.hour_diff:+.1f}h")
            lines.append(f"    返工来源: {'、'.join(info['source'])}")
            lines.append(f"    返工关键词: {', '.join(info['matched_keywords'])}")
            lines.append(f"    票务备注: {ticket.track_remark}")
            lines.append(f"    音频备注: {audio_remark}")
            lines.append("")

    if engine.rehearsal_changes:
        lines.append("【排练变更记录】")
        lines.append("-" * 60)
        for change in engine.rehearsal_changes.values():
            status_label = STATUS_LABELS.get(change.status, change.status)
            ticket = engine.tickets.get(change.track_id)
            audio = engine.audio_files.get(change.track_id)
            lines.append(f"  {status_label} | 轨道 {change.track_id}: {change.track_name}")
            lines.append(f"    为什么留下: {change.kept_why}")
            lines.append(f"    变更原因: {change.change_reason}")
            if change.missing_materials:
                lines.append(f"    还缺材料: {', '.join(change.missing_materials)}")
            lines.append(f"    下一步找谁: → {change.next_contact}")
            if change.judgment_explanation:
                lines.append(f"    判定说明: {change.judgment_explanation}")
            lines.append(f"    原始备注详情:")
            lines.append(f"      - 票务备注: {ticket.track_remark if ticket else '-'}")
            lines.append(f"      - 音频备注: {audio.audio_remark if audio and audio.audio_remark else '（未补录）'}")
            lines.append("")

    if not engine.state.copyright_review_done and pending_review > 0:
        lines.append("【💡 提示】")
        lines.append(f"  还有 {pending_review} 条记录待版权运营复核，")
        lines.append("  票务备注或音频备注任一含返工原因的轨道，不会自动归为正常。")
        lines.append("")

    report = "\n".join(lines)

    if output_path:
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(report)

    return report


def generate_dashboard_html(engine: WorkflowEngine, output_path: str) -> str:
    total_tracks = len(engine.tickets)
    combined = _get_combined_rework(engine)
    rework_count = sum(1 for info in combined.values() if info["is_rework"])
    pending_count = sum(
        1 for c in engine.rehearsal_changes.values()
        if c.status == TrackStatus.PENDING_COPYRIGHT_REVIEW
    )
    approved_count = sum(
        1 for c in engine.rehearsal_changes.values()
        if c.status == TrackStatus.APPROVED
    )

    ticket_data = {}
    audio_data = {}
    judgment_data = {}
    for tid, ticket in engine.tickets.items():
        ticket_data[tid] = ticket.track_remark
        af = engine.audio_files.get(tid)
        audio_data[tid] = af.audio_remark if af else "（未补录）"
    for tid, c in engine.rehearsal_changes.items():
        judgment_data[tid] = c.judgment_explanation if c else ""

    ticket_json = json.dumps(ticket_data, ensure_ascii=False)
    audio_json = json.dumps(audio_data, ensure_ascii=False)
    judgment_json = json.dumps(judgment_data, ensure_ascii=False)

    rework_rows = ""
    for tid, ticket in engine.tickets.items():
        info = combined.get(tid)
        if not info or not info["is_rework"]:
            continue
        audio = engine.audio_files.get(tid)
        audio_remark = audio.audio_remark if audio and audio.audio_remark else "（未补录）"
        source_label = "、".join(info["source"])
        rework_rows += f"""
        <tr class="rework-row">
            <td>{tid}</td>
            <td>{ticket.track_name}</td>
            <td>{ticket.hour_diff:+.1f}h</td>
            <td><span class="source-badge">{source_label}</span><br/><span class="keyword-badge">{', '.join(info['matched_keywords'])}</span></td>
            <td class="remark-cell" onclick="showDetail('{tid}', 'ticket', this)" title="点击查看完整票务备注">
                {ticket.track_remark[:25] + ('...' if len(ticket.track_remark) > 25 else '')}
            </td>
            <td class="remark-cell audio-remark" onclick="showDetail('{tid}', 'audio', this)" title="点击查看完整音频备注">
                {audio_remark[:25] + ('...' if len(audio_remark) > 25 else '')}
            </td>
            <td><span class="status-pending">待复核</span></td>
        </tr>
        """

    change_rows = ""
    for c in engine.rehearsal_changes.values():
        ticket = engine.tickets.get(c.track_id)
        audio = engine.audio_files.get(c.track_id)
        tr = ticket.track_remark if ticket else ""
        ar = (audio.audio_remark if audio and audio.audio_remark else "（未补录）")
        status_class = {
            TrackStatus.NORMAL: "status-normal",
            TrackStatus.NEEDS_REWORK: "status-rework",
            TrackStatus.PENDING_COPYRIGHT_REVIEW: "status-pending",
            TrackStatus.APPROVED: "status-approved",
        }.get(c.status, "")
        status_text = STATUS_LABELS.get(c.status, c.status)
        judgment_preview = c.judgment_explanation[:28] + "..." if len(c.judgment_explanation) > 28 else c.judgment_explanation
        change_rows += f"""
        <tr>
            <td>{c.track_id}</td>
            <td>{c.track_name}</td>
            <td class="remark-cell" onclick="showDetail('{c.track_id}', 'ticket', this)" title="点击查看完整票务备注">
                {tr[:22] + ('...' if len(tr) > 22 else '')}
            </td>
            <td class="remark-cell audio-remark" onclick="showDetail('{c.track_id}', 'audio', this)" title="点击查看完整音频备注">
                {ar[:22] + ('...' if len(ar) > 22 else '')}
            </td>
            <td>{c.kept_why}</td>
            <td>{', '.join(c.missing_materials) if c.missing_materials else '-'}</td>
            <td><strong>{c.next_contact}</strong></td>
            <td class="judgment-cell" onclick="showJudgment('{c.track_id}', this)" title="点击查看为什么这样处理">
                {judgment_preview or '点击查看'}
            </td>
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
            font-size: 13px;
            vertical-align: middle;
        }
        th {
            background: #f9fafb;
            color: #666;
            font-weight: 500;
            font-size: 13px;
            white-space: nowrap;
        }
        .rework-row {
            background: #fffbeb;
        }
        .rework-row:hover {
            background: #fef3c7;
        }
        .remark-cell {
            max-width: 180px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            cursor: pointer;
            color: #667eea;
        }
        .remark-cell:hover { text-decoration: underline; }
        .audio-remark { color: #8b5cf6; }
        .judgment-cell {
            cursor: pointer;
            color: #667eea;
            font-size: 13px;
            max-width: 220px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .judgment-cell:hover { text-decoration: underline; }
        .keyword-badge {
            display: inline-block;
            background: #fee2e2;
            color: #dc2626;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 12px;
            margin-top: 2px;
        }
        .source-badge {
            display: inline-block;
            background: #e0e7ff;
            color: #4f46e5;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 12px;
            margin-bottom: 2px;
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
            padding: 28px;
            border-radius: 12px;
            max-width: 620px;
            width: 90%;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        .modal-content h3 {
            margin-bottom: 16px;
            padding-bottom: 10px;
            border-bottom: 1px solid #eee;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .modal-label {
            display: block;
            margin-top: 12px;
            margin-bottom: 6px;
            color: #666;
            font-size: 13px;
            font-weight: 500;
        }
        .modal-value {
            color: #1f2937;
            line-height: 1.7;
            padding: 14px 16px;
            background: #f9fafb;
            border-radius: 8px;
            border-left: 3px solid #667eea;
            font-size: 14px;
            white-space: pre-wrap;
            word-break: break-all;
        }
        .modal-value.audio { border-left-color: #8b5cf6; }
        .modal-value.judgment {
            background: #eef2ff;
            border-left-color: #4f46e5;
            font-size: 13px;
        }
        .modal-content button {
            margin-top: 20px;
            padding: 9px 20px;
            background: #667eea;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            transition: background 0.2s;
        }
        .modal-content button:hover {
            background: #5568d3;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🎵 录音棚工时尾差核对</h1>
        <p>生成时间: __TIME__ | 当前步骤: 第 __STEP__ 步 | 票务备注或音频备注任一含返工即标记待复核</p>
    </div>

    <div class="stats">
        <div class="stat-card">
            <div class="number">__TOTAL__</div>
            <div class="label">总轨道数</div>
        </div>
        <div class="stat-card warning">
            <div class="number">__REWORK__</div>
            <div class="label">含返工原因（票务或音频）</div>
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
        <h2>⚠️ 含返工原因（票务或音频） <span class="badge">点击任一备注查看详情</span></h2>
        <table>
            <thead>
                <tr>
                    <th>轨道编号</th>
                    <th>曲目名称</th>
                    <th>工时尾差</th>
                    <th>来源 + 关键词</th>
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
        <h2>📋 排练变更记录 <span class="badge">点击备注/判定查看详情</span></h2>
        <table>
            <thead>
                <tr>
                    <th>轨道编号</th>
                    <th>曲目名称</th>
                    <th>票务备注（点击）</th>
                    <th>音频备注（点击）</th>
                    <th>为什么留下</th>
                    <th>还缺材料</th>
                    <th>下一步找谁</th>
                    <th>判定说明（点击查看）</th>
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
            <div id="modal-body"></div>
            <button onclick="closeModal()">关闭</button>
        </div>
    </div>

    <script>
        const ticketRemarks = __TICKET_JSON__;
        const audioRemarks = __AUDIO_JSON__;
        const judgmentData = __JUDGMENT_JSON__;

        function renderDetail(kind, trackId) {
            const parts = [];

            if (kind === 'ticket' || kind === 'all') {
                const v = ticketRemarks[trackId] || '无';
                parts.push('<span class="modal-label">📝 票务导出表备注</span>');
                parts.push('<div class="modal-value">' + escapeHtml(v) + '</div>');
            }

            if (kind === 'audio' || kind === 'all') {
                const v = audioRemarks[trackId] || '（未补录）';
                parts.push('<span class="modal-label">🎵 音频文件备注</span>');
                parts.push('<div class="modal-value audio">' + escapeHtml(v) + '</div>');
            }

            if (kind === 'judgment' || kind === 'all') {
                const v = judgmentData[trackId] || '暂无说明';
                parts.push('<span class="modal-label">🔍 判定说明 - 为什么这样处理？</span>');
                parts.push('<div class="modal-value judgment">' + escapeHtml(v).replace(/；/g, '；<br/>').replace(/【/g, '<br/>【') + '</div>');
            }

            return parts.join('');
        }

        function showDetail(trackId, type, el) {
            const modal = document.getElementById('modal');
            const title = document.getElementById('modal-title');
            const body = document.getElementById('modal-body');

            if (type === 'ticket') {
                title.innerHTML = '📝 票务导出表 - 轨道备注详情 | ' + trackId;
                body.innerHTML = renderDetail('ticket', trackId)
                    + '<span class="modal-label">🎵 关联音频备注（对照查看）</span>'
                    + '<div class="modal-value audio">' + escapeHtml(audioRemarks[trackId] || '（未补录）') + '</div>'
                    + '<span class="modal-label">🔍 本条判定说明</span>'
                    + '<div class="modal-value judgment">' + escapeHtml(judgmentData[trackId] || '暂无说明').replace(/；/g, '；<br/>').replace(/【/g, '<br/>【') + '</div>';
            } else {
                title.innerHTML = '🎵 音频文件 - 备注详情 | ' + trackId;
                body.innerHTML = renderDetail('audio', trackId)
                    + '<span class="modal-label">📝 关联票务备注（对照查看）</span>'
                    + '<div class="modal-value">' + escapeHtml(ticketRemarks[trackId] || '无') + '</div>'
                    + '<span class="modal-label">🔍 本条判定说明</span>'
                    + '<div class="modal-value judgment">' + escapeHtml(judgmentData[trackId] || '暂无说明').replace(/；/g, '；<br/>').replace(/【/g, '<br/>【') + '</div>';
            }
            modal.classList.add('show');
        }

        function showJudgment(trackId, el) {
            const modal = document.getElementById('modal');
            const title = document.getElementById('modal-title');
            const body = document.getElementById('modal-body');
            title.innerHTML = '🔍 判定说明 - 为什么这样处理？ | ' + trackId;
            body.innerHTML = renderDetail('judgment', trackId)
                + '<span class="modal-label">📝 判定依据 - 票务备注</span>'
                + '<div class="modal-value">' + escapeHtml(ticketRemarks[trackId] || '无') + '</div>'
                + '<span class="modal-label">🎵 判定依据 - 音频备注</span>'
                + '<div class="modal-value audio">' + escapeHtml(audioRemarks[trackId] || '（未补录）') + '</div>';
            modal.classList.add('show');
        }

        function escapeHtml(str) {
            const div = document.createElement('div');
            div.textContent = str;
            return div.innerHTML;
        }

        function closeModal() {
            document.getElementById('modal').classList.remove('show');
        }

        document.getElementById('modal').addEventListener('click', function(e) {
            if (e.target === this) closeModal();
        });

        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') closeModal();
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
    html = html.replace('__JUDGMENT_JSON__', judgment_json)

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(html)

    return output_path
