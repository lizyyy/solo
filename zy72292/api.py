#!/usr/bin/env python3
from flask import Flask, jsonify, request, render_template_string

from processor import SketchProcessor
from report_generator import ReportGenerator
from demo_data import create_demo_playback

app = Flask(__name__)
processor = SketchProcessor()
playbacks = {}


@app.route("/")
def index():
    html = """
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>大型会展摊位视线图 - API文档</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; background: #f5f5f5; }
        h1 { color: #333; border-bottom: 3px solid #4a90d9; padding-bottom: 10px; }
        .endpoint { background: white; border-radius: 8px; padding: 15px; margin: 10px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .method { display: inline-block; padding: 4px 12px; border-radius: 4px; color: white; font-weight: bold; }
        .GET { background: #61affe; }
        .POST { background: #49cc90; }
        .url { font-family: monospace; font-size: 1.1em; margin-left: 10px; }
        .desc { margin-top: 8px; color: #666; }
        .dashboard-link { display: block; text-align: center; padding: 15px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 8px; font-size: 1.2em; margin: 20px 0; }
        .dashboard-link:hover { opacity: 0.9; }
    </style>
</head>
<body>
    <h1>🏢 大型会展摊位视线图 API</h1>
    
    <a href="/dashboard" class="dashboard-link">📊 打开小看板可视化界面</a>

    <h2>API 端点</h2>

    <div class="endpoint">
        <span class="method GET">GET</span>
        <span class="url">/api/playback/demo</span>
        <div class="desc">获取演示数据 - 包含完整的楼层草图、点云日志、人工修正和重跑记录</div>
    </div>

    <div class="endpoint">
        <span class="method GET">GET</span>
        <span class="url">/api/playback/demo/text</span>
        <div class="desc">获取文本格式的演示报告</div>
    </div>

    <div class="endpoint">
        <span class="method POST">POST</span>
        <span class="url">/api/sketch/import</span>
        <div class="desc">导入楼层剖面草图 (JSON参数: name, importer, floor_number, z_axis_direction, stall_coordinates)</div>
    </div>

    <div class="endpoint">
        <span class="method POST">POST</span>
        <span class="url">/api/playback/&lt;id&gt;/add-log</span>
        <div class="desc">补录点云抽稀日志</div>
    </div>

    <div class="endpoint">
        <span class="method GET">GET</span>
        <span class="url">/api/playback/&lt;id&gt;/report</span>
        <div class="desc">生成路径回放报告</div>
    </div>

    <div class="endpoint">
        <span class="method GET">GET</span>
        <span class="url">/api/teaching/step/&lt;int:step&gt;</span>
        <div class="desc">教学模式 - 获取指定步骤 (1-3)</div>
    </div>
</body>
</html>
    """
    return render_template_string(html)


@app.route("/api/playback/demo")
def api_demo():
    playback = create_demo_playback()
    return jsonify(ReportGenerator.generate_json_report(playback))


@app.route("/api/playback/demo/text")
def api_demo_text():
    playback = create_demo_playback()
    return ReportGenerator.generate_playback_report(playback), 200, {"Content-Type": "text/plain; charset=utf-8"}


@app.route("/api/sketch/import", methods=["POST"])
def api_import_sketch():
    data = request.json
    result = processor.import_sketch(
        name=data.get("name", "未命名草图"),
        importer=data.get("importer", "未知操作员"),
        floor_number=data.get("floor_number", 1),
        z_axis_direction=data.get("z_axis_direction", "up"),
        stall_coordinates=data.get("stall_coordinates", []),
    )

    playback = processor.create_playback(data.get("project_name", "新项目"))
    playback.sketch = result["sketch"]
    playback.issues.extend(result["issues"])
    playbacks[playback.playback_id] = playback

    return jsonify(
        {
            "playback_id": playback.playback_id,
            "sketch": {
                "sketch_id": result["sketch"].sketch_id,
                "z_axis_direction": result["sketch"].z_axis_direction,
            },
            "issues": [
                {
                    "issue_id": i.issue_id,
                    "type": i.type,
                    "description": i.description,
                    "why_kept": i.why_kept,
                    "next_action": i.next_action.value,
                }
                for i in result["issues"]
            ],
        }
    )


@app.route("/api/playback/<playback_id>/report")
def api_get_report(playback_id):
    playback = playbacks.get(playback_id)
    if not playback:
        return jsonify({"error": "回放不存在"}), 404
    return jsonify(ReportGenerator.generate_json_report(playback))


@app.route("/api/teaching/step/<int:step>")
def api_teaching_step(step):
    from demo_data import create_step_by_step_demo

    data = create_step_by_step_demo()
    playback = data["playback"]
    proc = data["processor"]

    if step >= 2:
        proc.add_point_cloud_log(
            playback=playback,
            operator="航测内业-小魏",
            action="补录点云抽稀日志",
            thinning_ratio=0.25,
            parameters={"algorithm": "随机采样"},
            notes="确认Z轴坐标系，内业标准与现场习惯存在差异",
        )

    return jsonify(
        {
            "step": step,
            "completed": step >= 3,
            "playback": ReportGenerator.generate_json_report(playback),
        }
    )


@app.route("/dashboard")
def dashboard():
    from dashboard import DASHBOARD_HTML
    return render_template_string(DASHBOARD_HTML)


if __name__ == "__main__":
    print("🚀 启动大型会展摊位视线图 API 服务器")
    print("📍 访问 http://localhost:8765 查看API文档")
    print("📊 访问 http://localhost:8765/dashboard 打开小看板")
    app.run(debug=True, host="0.0.0.0", port=8765)
