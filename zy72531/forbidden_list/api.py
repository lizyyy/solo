import json
from datetime import datetime
from flask import Flask, jsonify, request, render_template_string

from .core import ForbiddenListEngine
from .data.demo_data import DEMO_DATA


app = Flask(__name__)
engine = ForbiddenListEngine()


def serialize_datetime(obj):
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError(f"Type {type(obj)} not serializable")


def record_to_dict(record):
    return {
        "id": record.id,
        "keyword": record.keyword,
        "status": record.status.value,
        "source": record.source.value,
        "reference_url": record.reference_url,
        "link_404": record.link_404,
        "conflict_note": record.conflict_note,
        "pm_review_note": record.pm_review_note,
        "created_at": record.created_at.isoformat(),
        "updated_at": record.updated_at.isoformat(),
        "history": record.history,
    }


def conflict_to_dict(conflict):
    return {
        "id": conflict.id,
        "forbidden_record_id": conflict.forbidden_record_id,
        "conflict_type": conflict.conflict_type.value,
        "old_content": conflict.old_content,
        "new_content": conflict.new_content,
        "detected_at": conflict.detected_at.isoformat(),
        "resolved": conflict.resolved,
        "resolved_by": conflict.resolved_by,
        "resolution_note": conflict.resolution_note,
    }


@app.route("/")
def dashboard():
    stats = engine.get_statistics()
    records = [record_to_dict(r) for r in engine.forbidden_records]
    conflicts = [conflict_to_dict(c) for c in engine.conflict_samples]

    return render_template_string(
        """
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>导购推荐禁推清单 - 小看板</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
               background: #f5f7fa; padding: 20px; color: #303133; }
        .header { background: linear-gradient(135deg, #409eff, #66b1ff);
                  color: white; padding: 24px; border-radius: 8px; margin-bottom: 20px; }
        .header h1 { font-size: 24px; margin-bottom: 8px; }
        .header p { opacity: 0.9; font-size: 14px; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                      gap: 16px; margin-bottom: 24px; }
        .stat-card { background: white; padding: 20px; border-radius: 8px;
                     box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
        .stat-card .num { font-size: 32px; font-weight: bold; color: #409eff; }
        .stat-card .label { font-size: 14px; color: #909399; margin-top: 4px; }
        .section { background: white; border-radius: 8px; padding: 20px;
                   margin-bottom: 20px; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
        .section h2 { font-size: 18px; margin-bottom: 16px; color: #303133;
                      border-left: 4px solid #409eff; padding-left: 12px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ebeef5; }
        th { background: #f5f7fa; font-weight: 600; font-size: 14px; color: #606266; }
        td { font-size: 14px; }
        .tag { display: inline-block; padding: 2px 8px; border-radius: 4px;
               font-size: 12px; font-weight: 500; }
        .tag-normal { background: #f0f9eb; color: #67c23a; }
        .tag-404 { background: #fdf6ec; color: #e6a23c; }
        .tag-pm { background: #fef0f0; color: #f56c6c; }
        .tag-conflict { background: #fef0f0; color: #f56c6c; }
        .tag-supplemented { background: #ecf5ff; color: #409eff; }
        .tag-pending { background: #f4f4f5; color: #909399; }
        .btn { padding: 8px 16px; border: none; border-radius: 4px;
               cursor: pointer; font-size: 14px; margin-right: 8px; }
        .btn-primary { background: #409eff; color: white; }
        .btn-success { background: #67c23a; color: white; }
        .btn:hover { opacity: 0.9; }
        .btn-group { margin-bottom: 16px; }
        .workflow-step { padding: 12px 16px; background: #f5f7fa;
                          border-radius: 4px; margin-bottom: 8px; font-size: 14px; }
        .workflow-step.active { background: #ecf5ff; border-left: 3px solid #409eff; }
        .step-num { display: inline-block; width: 24px; height: 24px;
                    background: #409eff; color: white; border-radius: 50%;
                    text-align: center; line-height: 24px; font-size: 12px;
                    margin-right: 8px; }
        .alert { padding: 12px 16px; border-radius: 4px; margin-bottom: 12px; font-size: 14px; }
        .alert-warning { background: #fdf6ec; color: #e6a23c; border-left: 4px solid #e6a23c; }
        .alert-info { background: #ecf5ff; color: #409eff; border-left: 4px solid #409eff; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🛒 导购推荐禁推清单</h1>
        <p>标注负责人工作台 - 周姐专用</p>
    </div>

    <div class="stats-grid">
        <div class="stat-card">
            <div class="num">{{ stats.总记录数 }}</div>
            <div class="label">总记录数</div>
        </div>
        <div class="stat-card">
            <div class="num">{{ stats.冲突样本数 }}</div>
            <div class="label">冲突样本数</div>
        </div>
        <div class="stat-card">
            <div class="num">{{ stats.待产品经理复核数 }}</div>
            <div class="label">待产品经理复核</div>
        </div>
        <div class="stat-card">
            <div class="num">步骤 {{ stats.工作流步骤 }}/3</div>
            <div class="label">当前工作流进度</div>
        </div>
    </div>

    <div class="section">
        <h2>快速操作</h2>
        <div class="btn-group">
            <button class="btn btn-primary" onclick="loadDemo()">加载演示数据</button>
            <button class="btn btn-success" onclick="runStep1()">第一步：导入标注留言</button>
            <button class="btn btn-success" onclick="runStep2()">第二步：周姐复核</button>
            <button class="btn btn-success" onclick="runStep3()">第三步：补录模型片段</button>
            <button class="btn btn-primary" onclick="location.reload()">刷新</button>
        </div>
        <div class="workflow-step {{ 'active' if stats.工作流步骤 >= 1 else '' }}">
            <span class="step-num">1</span>标注员导入留言，系统自动检查链接
        </div>
        <div class="workflow-step {{ 'active' if stats.工作流步骤 >= 2 else '' }}">
            <span class="step-num">2</span>标注负责人周姐复核，标记404问题
        </div>
        <div class="workflow-step {{ 'active' if stats.工作流步骤 >= 3 else '' }}">
            <span class="step-num">3</span>补录模型输出片段，更新冲突样本表
        </div>
    </div>

    {% if stats.待产品经理复核数 > 0 %}
    <div class="alert alert-warning">
        ⚠️ 有 {{ stats.待产品经理复核数 }} 条记录待产品经理复核（引用链接404但被判通过）
    </div>
    {% endif %}

    <div class="section">
        <h2>禁推清单记录</h2>
        <table>
            <thead>
                <tr>
                    <th>关键词</th>
                    <th>状态</th>
                    <th>来源</th>
                    <th>引用链接</th>
                    <th>链接404</th>
                    <th>冲突/备注</th>
                </tr>
            </thead>
            <tbody>
                {% for r in records %}
                <tr>
                    <td><strong>{{ r.keyword }}</strong></td>
                    <td>
                        {% set status_class = {
                            '正常通过': 'tag-normal',
                            '链接404但判通过': 'tag-404',
                            '待产品经理复核': 'tag-pm',
                            '口径冲突': 'tag-conflict',
                            '已补录修正': 'tag-supplemented',
                            '待处理': 'tag-pending',
                            '已驳回': 'tag-pending'
                        } %}
                        <span class="tag {{ status_class.get(r.status, 'tag-pending') }}">{{ r.status }}</span>
                    </td>
                    <td>{{ r.source }}</td>
                    <td>{{ r.reference_url or '-' }}</td>
                    <td>{{ '是 ⚠️' if r.link_404 else '否' }}</td>
                    <td>{{ r.conflict_note or '-' }}</td>
                </tr>
                {% else %}
                <tr><td colspan="6" style="text-align:center;color:#909399;">暂无数据，点击"加载演示数据"</td></tr>
                {% endfor %}
            </tbody>
        </table>
    </div>

    <div class="section">
        <h2>冲突样本表</h2>
        <table>
            <thead>
                <tr>
                    <th>冲突ID</th>
                    <th>关联记录</th>
                    <th>冲突类型</th>
                    <th>旧内容</th>
                    <th>新内容摘要</th>
                    <th>是否解决</th>
                </tr>
            </thead>
            <tbody>
                {% for c in conflicts %}
                <tr>
                    <td>{{ c.id }}</td>
                    <td>{{ c.forbidden_record_id }}</td>
                    <td>{{ c.conflict_type }}</td>
                    <td>{{ c.old_content }}</td>
                    <td>{{ c.new_content[:50] }}...</td>
                    <td>{{ '是' if c.resolved else '否' }}</td>
                </tr>
                {% else %}
                <tr><td colspan="6" style="text-align:center;color:#909399;">暂无冲突样本</td></tr>
                {% endfor %}
            </tbody>
        </table>
    </div>

    {% if records %}
    <div class="alert alert-info">
        💡 三种处理结果：
        1) <strong>顺利记录</strong>：链接有效，正常通过 &nbsp;&nbsp;
        2) <strong>链接404待复核</strong>：标记后转产品经理 &nbsp;&nbsp;
        3) <strong>补录发现旧口径</strong>：自动生成冲突样本
    </div>
    {% endif %}

    <script>
        function loadDemo() {
            fetch('/api/load-demo', {method: 'POST'})
                .then(r => r.json())
                .then(d => { alert(d.message); location.reload(); });
        }
        function runStep1() {
            fetch('/api/workflow/step1', {method: 'POST'})
                .then(r => r.json())
                .then(d => { alert('第一步完成：导入 ' + d.count + ' 条记录'); location.reload(); });
        }
        function runStep2() {
            fetch('/api/workflow/step2', {method: 'POST'})
                .then(r => r.json())
                .then(d => { alert('第二步完成：周姐已复核'); location.reload(); });
        }
        function runStep3() {
            fetch('/api/workflow/step3', {method: 'POST'})
                .then(r => r.json())
                .then(d => { alert('第三步完成：新增 ' + d.conflicts + ' 条冲突样本'); location.reload(); });
        }
    </script>
</body>
</html>
    """,
        stats=stats,
        records=records,
        conflicts=conflicts,
    )


@app.route("/api/stats")
def api_stats():
    return jsonify(engine.get_statistics())


@app.route("/api/records")
def api_records():
    return jsonify([record_to_dict(r) for r in engine.forbidden_records])


@app.route("/api/conflicts")
def api_conflicts():
    return jsonify([conflict_to_dict(c) for c in engine.conflict_samples])


@app.route("/api/load-demo", methods=["POST"])
def api_load_demo():
    global engine
    engine = ForbiddenListEngine()
    from .cli import run_demo_workflow
    run_demo_workflow(engine, show_steps=False)
    return jsonify({"message": "演示数据已加载", "stats": engine.get_statistics()})


@app.route("/api/workflow/step1", methods=["POST"])
def api_step1():
    records = engine.run_full_workflow_step1_import(DEMO_DATA)
    return jsonify({"count": len(records), "records": [r.id for r in records]})


@app.route("/api/workflow/step2", methods=["POST"])
def api_step2():
    review_decisions = {}
    for i, key in enumerate(["first_record", "second_record", "third_record"]):
        if i < len(engine.forbidden_records):
            review_decisions[engine.forbidden_records[i].id] = DEMO_DATA["review_decisions"][key]
    engine.run_full_workflow_step2_review("周姐", review_decisions)
    return jsonify({"status": "ok"})


@app.route("/api/workflow/step3", methods=["POST"])
def api_step3():
    supplements = {}
    if len(engine.forbidden_records) >= 3:
        supplements[engine.forbidden_records[2].id] = DEMO_DATA["model_outputs_to_supplement"]["third_record"]
    new_conflicts = engine.run_full_workflow_step3_supplement("周姐", supplements)
    return jsonify({"conflicts": len(new_conflicts)})


@app.route("/api/import", methods=["POST"])
def api_import():
    data = request.get_json()
    records = engine.run_full_workflow_step1_import(data)
    return jsonify({"count": len(records), "ids": [r.id for r in records]})


def run_server(host="127.0.0.1", port=5000):
    print(f"🚀 导购推荐禁推清单小看板启动: http://{host}:{port}")
    app.run(host=host, port=port, debug=False)


if __name__ == "__main__":
    run_server()
