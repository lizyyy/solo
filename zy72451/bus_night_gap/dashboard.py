import json
import http.server
import socketserver
import webbrowser
from urllib.parse import urlparse, parse_qs
from .store import store
from .scoring import calculate_score
from .suggestions import generate_suggestion
from .demo_data import load_demo_data, demo_step2_supplement_ramp, demo_step3_manual_correction, demo_step4_rerun


def get_dashboard_data():
    notices = store.list_notices()
    if not notices:
        load_demo_data()
        notices = store.list_notices()

    notice = notices[0]
    workflow = store.get_workflow(notice.id)
    latest_score = store.get_latest_score(notice.id)
    suggestion = store.get_latest_suggestion(notice.id)
    all_scores = store.get_all_scores(notice.id)
    ramp_records = store.get_ramp_records_for_notice(notice.id)
    audit_logs = store.get_audit_logs(entity_id=notice.id)

    score_history = []
    for idx, s in enumerate(all_scores):
        diff = 0
        if idx > 0:
            diff = s.score - all_scores[idx - 1].score
        score_history.append({
            "version": s.version,
            "score": s.score,
            "diff": diff,
            "factors": s.factors,
        })

    status_colors = {
        "pending_review": "#f59e0b",
        "needs_supplement": "#f59e0b",
        "score_unchanged": "#ef4444",
        "ready_for_coordinator": "#3b82f6",
        "resolved": "#10b981",
    }

    return {
        "notice": {
            "id": notice.id,
            "road_name": notice.road_name,
            "construction_type": notice.construction_type,
            "start_date": notice.start_date,
            "end_date": notice.end_date,
            "raw_notes": notice.raw_notes,
        },
        "workflow": {
            "step": workflow.step if workflow else 0,
            "step_description": workflow.step_description if workflow else "",
            "status": workflow.status.value if workflow else "unknown",
            "status_color": status_colors.get(workflow.status.value, "#6b7280") if workflow else "#6b7280",
            "current_assignee": workflow.current_assignee.value if workflow and workflow.current_assignee else "",
            "has_ramp_supplement": workflow.has_ramp_supplement if workflow else False,
            "score_changed_after_supplement": workflow.score_changed_after_supplement if workflow else None,
        },
        "latest_score": {
            "score": latest_score.score,
            "max_score": latest_score.max_score,
            "version": latest_score.version,
            "factors": latest_score.factors,
        } if latest_score else None,
        "score_history": score_history,
        "suggestion": {
            "version": suggestion.version,
            "status": suggestion.status.value,
            "why_kept": suggestion.why_kept,
            "missing_materials": suggestion.missing_materials,
            "next_action_person": suggestion.next_action_person,
            "next_action": suggestion.next_action.value,
            "notes": suggestion.notes,
        } if suggestion else None,
        "ramp_records": [
            {
                "id": r.id,
                "location": r.location,
                "has_ramp": r.has_ramp,
                "ramp_condition": r.ramp_condition,
                "width_cm": r.width_cm,
                "raw_notes": r.raw_notes,
                "recorded_by": r.recorded_by.value,
                "is_supplement": r.is_supplement,
                "recorded_at": r.recorded_at.strftime("%H:%M:%S"),
            }
            for r in ramp_records
        ],
        "audit_logs": [
            {
                "time": l.changed_at.strftime("%H:%M:%S"),
                "changed_by": l.changed_by.value,
                "action": l.action,
                "entity_type": l.entity_type,
                "reason": l.reason,
            }
            for l in audit_logs
        ],
    }


DASHBOARD_HTML = """
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>公交夜班覆盖缺口 - 小看板</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: #f3f4f6;
            padding: 20px;
            color: #1f2937;
        }
        .container { max-width: 1200px; margin: 0 auto; }
        h1 { font-size: 24px; margin-bottom: 20px; color: #1e3a8a; }
        .card {
            background: white;
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .card h2 { font-size: 18px; margin-bottom: 15px; color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
        .badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 999px;
            font-size: 12px;
            font-weight: 600;
            color: white;
        }
        .score-display {
            text-align: center;
            padding: 20px;
        }
        .score-number {
            font-size: 48px;
            font-weight: bold;
            color: #1e40af;
        }
        .score-label { color: #6b7280; margin-top: 5px; }
        .raw-notes {
            background: #fffbeb;
            border-left: 4px solid #f59e0b;
            padding: 12px;
            margin: 10px 0;
            border-radius: 4px;
            font-size: 14px;
            line-height: 1.6;
        }
        .ramp-item {
            padding: 12px;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            margin-bottom: 10px;
        }
        .ramp-item.supplement { border-color: #f59e0b; background: #fffbeb; }
        .suggestion-section { margin-bottom: 15px; }
        .suggestion-section h3 { font-size: 14px; color: #6b7280; margin-bottom: 8px; }
        .missing-item {
            display: flex;
            align-items: center;
            padding: 6px 0;
        }
        .missing-item::before {
            content: "☐";
            margin-right: 8px;
            color: #ef4444;
        }
        .next-person {
            background: #dbeafe;
            padding: 12px;
            border-radius: 8px;
            font-weight: 600;
            color: #1e40af;
        }
        .audit-item {
            padding: 8px 0;
            border-bottom: 1px solid #f3f4f6;
            font-size: 13px;
        }
        .audit-time { color: #6b7280; }
        .controls {
            display: flex;
            gap: 10px;
            margin-bottom: 20px;
            flex-wrap: wrap;
        }
        .btn {
            padding: 10px 20px;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 600;
            transition: all 0.2s;
        }
        .btn-primary { background: #2563eb; color: white; }
        .btn-primary:hover { background: #1d4ed8; }
        .btn-secondary { background: #6b7280; color: white; }
        .btn-secondary:hover { background: #4b5563; }
        .btn-warning { background: #f59e0b; color: white; }
        .btn-warning:hover { background: #d97706; }
        .step-indicator {
            display: flex;
            gap: 8px;
            margin-bottom: 20px;
        }
        .step {
            flex: 1;
            padding: 10px;
            text-align: center;
            border-radius: 8px;
            font-size: 12px;
            background: #e5e7eb;
            color: #6b7280;
        }
        .step.active {
            background: #2563eb;
            color: white;
        }
        .step.done {
            background: #10b981;
            color: white;
        }
        .score-history {
            display: flex;
            gap: 15px;
            align-items: flex-end;
            margin-top: 15px;
        }
        .score-bar {
            flex: 1;
            text-align: center;
        }
        .score-bar-fill {
            background: #3b82f6;
            border-radius: 4px 4px 0 0;
            min-height: 20px;
            position: relative;
        }
        .score-bar-fill.unchanged { background: #ef4444; }
        .score-bar-label { font-size: 11px; color: #6b7280; margin-top: 5px; }
        .score-bar-value { font-size: 12px; font-weight: 600; position: absolute; top: -20px; left: 0; right: 0; }
        .alert {
            padding: 12px;
            border-radius: 8px;
            margin: 10px 0;
        }
        .alert-warning { background: #fef3c7; border-left: 4px solid #f59e0b; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚌 公交夜班覆盖缺口 - 无障碍坡道复核看板</h1>

        <div class="controls">
            <button class="btn btn-primary" onclick="loadDemo()">加载演示数据</button>
            <button class="btn btn-warning" onclick="runStep2()">步骤2: 周姐补录坡道</button>
            <button class="btn btn-warning" onclick="runStep3()">步骤3: 交通协管复核</button>
            <button class="btn btn-secondary" onclick="runStep4()">步骤4: 重跑生成报告</button>
            <button class="btn btn-secondary" onclick="refresh()">刷新</button>
        </div>

        <div id="content"></div>
    </div>

    <script>
        async function api(path, method = 'GET') {
            const res = await fetch(path, { method });
            return res.json();
        }

        function render(data) {
            const wf = data.workflow;
            const steps = [
                { name: '导入告示', done: wf.step >= 1 },
                { name: '初步记录', done: wf.step >= 2 },
                { name: '补录坡道', done: wf.step >= 3 },
                { name: '协管复核', done: wf.step >= 4 },
                { name: '完成报告', done: wf.step >= 5 },
            ];
            steps[Math.min(wf.step, 4)].active = true;

            const scoreBars = data.score_history.map((s, i) => {
                const isUnchanged = i > 0 && Math.abs(s.diff) < 0.001;
                const height = Math.max((s.score / 100) * 150, 20);
                return `
                    <div class="score-bar">
                        <div class="score-bar-fill ${isUnchanged ? 'unchanged' : ''}" style="height: ${height}px">
                            <span class="score-bar-value">${s.score.toFixed(0)}</span>
                        </div>
                        <div class="score-bar-label">v${s.version}${isUnchanged ? ' ⚠️' : ''}</div>
                    </div>
                `;
            }).join('');

            const rampItems = data.ramp_records.map(r => `
                <div class="ramp-item ${r.is_supplement ? 'supplement' : ''}">
                    <strong>${r.location}</strong>
                    ${r.is_supplement ? '<span class="badge" style="background:#f59e0b">补录</span>' : ''}
                    <br>
                    ${r.has_ramp ? '✅ 有坡道' : '❌ 无坡道'}
                    ${r.ramp_condition ? `| 状况: ${r.ramp_condition}` : ''}
                    ${r.width_cm ? `| 宽度: ${r.width_cm}cm` : ''}
                    <br>
                    <small>录入人: ${r.recorded_by} | ${r.recorded_at}</small>
                    ${r.raw_notes ? `<div class="raw-notes" style="margin-top:8px"><strong>原始备注:</strong> ${r.raw_notes}</div>` : ''}
                </div>
            `).join('');

            const auditItems = data.audit_logs.map(l => `
                <div class="audit-item">
                    <span class="audit-time">[${l.time}]</span>
                    <strong>${l.changed_by}</strong> ${l.action} ${l.entity_type}
                    ${l.reason ? `<br><small style="color:#6b7280">原因: ${l.reason}</small>` : ''}
                </div>
            `).join('');

            const missingMaterials = data.suggestion && data.suggestion.missing_materials.length > 0
                ? data.suggestion.missing_materials.map(m => `<div class="missing-item">${m}</div>`).join('')
                : '<div style="color:#10b981">✅ 材料齐全</div>';

            const suggestionHtml = data.suggestion ? `
                <div class="suggestion-section">
                    <h3>❓ 为什么这条被留下</h3>
                    <p>${data.suggestion.why_kept}</p>
                </div>
                <div class="suggestion-section">
                    <h3>📦 还缺什么材料</h3>
                    ${missingMaterials}
                </div>
                <div class="suggestion-section">
                    <h3>📞 下一步该找谁</h3>
                    <div class="next-person">👉 ${data.suggestion.next_action_person} (${data.suggestion.next_action})</div>
                </div>
                ${data.suggestion.notes ? `
                <div class="suggestion-section">
                    <h3>📝 保留的原始备注</h3>
                    <div class="raw-notes">${data.suggestion.notes.replace(/\\n/g, '<br>')}</div>
                </div>
                ` : ''}
            ` : '<p>暂无整改建议</p>';

            const content = `
                <div class="step-indicator">
                    ${steps.map(s => `<div class="step ${s.active ? 'active' : ''} ${s.done ? 'done' : ''}">${s.name}</div>`).join('')}
                </div>

                <div class="grid">
                    <div class="card">
                        <h2>📍 施工告示</h2>
                        <p><strong>路段:</strong> ${data.notice.road_name}</p>
                        <p><strong>类型:</strong> ${data.notice.construction_type}</p>
                        <p><strong>工期:</strong> ${data.notice.start_date} ~ ${data.notice.end_date}</p>
                        <p><strong>当前状态:</strong> <span class="badge" style="background:${wf.status_color}">${wf.status}</span></p>
                        ${wf.current_assignee ? `<p><strong>当前负责人:</strong> ${wf.current_assignee}</p>` : ''}
                        ${data.notice.raw_notes ? `
                        <div class="raw-notes">
                            <strong>💬 原始备注（未清洗，保留）:</strong><br>
                            ${data.notice.raw_notes}
                        </div>
                        ` : ''}
                    </div>

                    <div class="card">
                        <h2>🎯 当前评分</h2>
                        <div class="score-display">
                            ${data.latest_score ? `
                                <div class="score-number">${data.latest_score.score.toFixed(0)}</div>
                                <div class="score-label">/ ${data.latest_score.max_score} 分 (版本 ${data.latest_score.version})</div>
                            ` : '<p>暂无评分</p>'}
                        </div>
                        <div class="score-history">${scoreBars}</div>
                        ${wf.score_changed_after_supplement === false ? `
                            <div class="alert alert-warning">
                                ⚠️ <strong>补录后评分未变化</strong> - 已转交通协管复核，不会自动归为正常
                            </div>
                        ` : ''}
                    </div>
                </div>

                <div class="grid">
                    <div class="card">
                        <h2>📋 整改建议 (版本 ${data.suggestion ? data.suggestion.version : 0})</h2>
                        ${suggestionHtml}
                    </div>

                    <div class="card">
                        <h2>♿ 坡道记录 (${data.ramp_records.length} 条)</h2>
                        ${rampItems || '<p>暂无坡道记录</p>'}
                    </div>
                </div>

                <div class="card">
                    <h2>📜 审计日志 - 谁改了什么、为什么改</h2>
                    ${auditItems || '<p>暂无日志</p>'}
                </div>
            `;

            document.getElementById('content').innerHTML = content;
        }

        async function refresh() {
            const data = await api('/api/data');
            render(data);
        }

        async function loadDemo() {
            await api('/api/demo/load', 'POST');
            refresh();
        }

        async function runStep2() {
            await api('/api/demo/step2', 'POST');
            refresh();
        }

        async function runStep3() {
            await api('/api/demo/step3', 'POST');
            refresh();
        }

        async function runStep4() {
            await api('/api/demo/step4', 'POST');
            refresh();
        }

        refresh();
    </script>
</body>
</html>
"""


class DashboardHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/" or parsed.path == "/index.html":
            self.send_response(200)
            self.send_header("Content-type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(DASHBOARD_HTML.encode("utf-8"))
        elif parsed.path == "/api/data":
            self.send_response(200)
            self.send_header("Content-type", "application/json; charset=utf-8")
            self.end_headers()
            data = get_dashboard_data()
            self.wfile.write(json.dumps(data, ensure_ascii=False).encode("utf-8"))
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/demo/load":
            load_demo_data()
            self.send_response(200)
            self.send_header("Content-type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"ok":true}')
        elif parsed.path == "/api/demo/step2":
            notices = store.list_notices()
            if notices:
                demo_step2_supplement_ramp(notices[0].id)
            self.send_response(200)
            self.send_header("Content-type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"ok":true}')
        elif parsed.path == "/api/demo/step3":
            notices = store.list_notices()
            if notices:
                demo_step3_manual_correction(notices[0].id)
            self.send_response(200)
            self.send_header("Content-type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"ok":true}')
        elif parsed.path == "/api/demo/step4":
            notices = store.list_notices()
            if notices:
                demo_step4_rerun(notices[0].id)
            self.send_response(200)
            self.send_header("Content-type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"ok":true}')
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        pass


def run_dashboard(port=8765):
    with socketserver.TCPServer(("", port), DashboardHandler) as httpd:
        url = f"http://localhost:{port}"
        print(f"✅ 小看板已启动: {url}")
        print("按 Ctrl+C 停止服务器")
        webbrowser.open(url)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n👋 服务器已停止")
