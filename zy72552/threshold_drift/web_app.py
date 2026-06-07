import os
import json
from flask import Flask, render_template_string, request, jsonify
from .models import BucketConfig, Status, BucketDiff, NextOwner, DriftRecord
from .detector import BucketDriftDetector
from .data_import import DataImporter
from .experiment import ExperimentManager
from .visualization import Visualizer


def create_app():
    app = Flask(__name__)
    app.config["SECRET_KEY"] = "threshold-drift-secret"

    bucket_config = BucketConfig(boundaries=[0.3, 0.5, 0.7, 0.9])
    detector = BucketDriftDetector(bucket_config)
    exp_manager = ExperimentManager()
    visualizer = Visualizer(bucket_config)

    if not os.path.exists("data"):
        os.makedirs("data")

    @app.route("/")
    def index():
        experiments = list(exp_manager.experiments.keys())
        return render_template_string(
            """
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>异常检测阈值漂移分析系统</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
                    .container { max-width: 1200px; margin: 0 auto; }
                    .card { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
                    h1 { color: #333; }
                    .btn { padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; margin: 5px; }
                    .btn:hover { background: #0056b3; }
                    .btn-success { background: #28a745; }
                    .btn-success:hover { background: #1e7e34; }
                    .btn-warning { background: #ffc107; color: #333; }
                    .step { padding: 15px; margin: 10px 0; border-left: 4px solid #007bff; background: #f8f9fa; }
                    .step h3 { margin-top: 0; }
                    input, select { padding: 8px; margin: 5px; border: 1px solid #ddd; border-radius: 4px; }
                    table { width: 100%; border-collapse: collapse; }
                    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
                    th { background: #f0f0f0; }
                    .one-bucket { background: #fff3cd; }
                    .multi-bucket { background: #f8d7da; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>🔍 异常检测阈值漂移分析系统</h1>

                    <div class="card">
                        <h2>📋 三步工作流</h2>
                        <div class="step">
                            <h3>第一步：导入负样本列表</h3>
                            <p>上传包含 sample_id, offline_score, online_score 的CSV文件，系统自动标出离线和线上分数差了一个桶的记录</p>
                            <form action="/detect" method="post" enctype="multipart/form-data">
                                <input type="file" name="file" accept=".csv,.json" required>
                                <button type="submit" class="btn">开始检测</button>
                            </form>
                        </div>
                        <div class="step">
                            <h3>第二步：算法工程师小乔补录召回候选表</h3>
                            <p>为差1桶的记录补充召回候选，实验对比自动更新</p>
                            {% if experiments %}
                            <form action="/supplement" method="post" enctype="multipart/form-data">
                                <select name="experiment_id" required>
                                    {% for exp_id in experiments %}
                                    <option value="{{ exp_id }}">{{ exp_id }}</option>
                                    {% endfor %}
                                </select>
                                <input type="file" name="file" accept=".csv" required>
                                <button type="submit" class="btn btn-warning">补录召回候选</button>
                            </form>
                            {% else %}
                            <p style="color: #666;">请先完成第一步导入负样本</p>
                            {% endif %}
                        </div>
                        <div class="step">
                            <h3>第三步：评测运营复核，别急着归正常</h3>
                            <p>差1桶的记录需要评测运营复核确认，暂不归为正常</p>
                            {% if experiments %}
                            <form action="/review" method="post">
                                <select name="experiment_id" required>
                                    {% for exp_id in experiments %}
                                    <option value="{{ exp_id }}">{{ exp_id }}</option>
                                    {% endfor %}
                                </select>
                                <input type="text" name="record_id" placeholder="记录ID" required>
                                <select name="status" required>
                                    <option value="reviewed_by_op">已复核（运营）</option>
                                    <option value="confirmed_normal">确认为正常</option>
                                    <option value="needs_investigation">需要进一步调查</option>
                                </select>
                                <input type="text" name="notes" placeholder="复核备注">
                                <button type="submit" class="btn btn-success">提交复核</button>
                            </form>
                            {% else %}
                            <p style="color: #666;">请先完成第一步导入负样本</p>
                            {% endif %}
                        </div>
                    </div>

                    <div class="card">
                        <h2>🔬 实验对比看板</h2>
                        {% if experiments %}
                            {% for exp_id in experiments %}
                            <h3>实验: {{ exp_id }}</h3>
                            <a href="/report/{{ exp_id }}" class="btn">查看完整报告</a>
                            <a href="/dashboard/{{ exp_id }}" class="btn">3D可视化看板</a>
                            {% endfor %}
                        {% else %}
                        <p style="color: #666;">暂无实验数据，请先导入负样本</p>
                        {% endif %}
                    </div>

                    <div class="card">
                        <h2>💡 说明</h2>
                        <ul>
                            <li><strong>差1桶（橙色）</strong>：离线和线上分数差了一个桶，需要评测运营复核，别急着归正常</li>
                            <li><strong>为什么留下</strong>：系统自动说明每条记录为什么被留下，缺什么材料</li>
                            <li><strong>下一步找谁</strong>：明确下一步是找评测运营还是找算法工程师小乔</li>
                            <li><strong>3D/图表展示</strong>：点击数据点可回到负样本列表或召回候选表</li>
                        </ul>
                    </div>
                </div>
            </body>
            </html>
            """,
            experiments=experiments,
        )

    @app.route("/detect", methods=["POST"])
    def detect():
        if "file" not in request.files:
            return jsonify({"error": "未上传文件"}), 400

        file = request.files["file"]
        if file.filename == "":
            return jsonify({"error": "未选择文件"}), 400

        file_path = os.path.join("data", file.filename)
        file.save(file_path)

        if file.filename.endswith(".csv"):
            samples_data = DataImporter.load_negative_samples_from_csv(file_path)
        else:
            samples_data = DataImporter.load_negative_samples_from_json(file_path)

        samples, records = detector.batch_detect(samples_data)
        exp = exp_manager.create_experiment(
            name=f"web_{file.filename}", drift_records=records
        )

        report = exp_manager.generate_report(exp.experiment_id)
        return jsonify(
            {
                "message": "检测完成",
                "experiment_id": exp.experiment_id,
                "total": len(records),
                "one_bucket": report["one_bucket_diff_count"],
                "multi_bucket": report["multi_bucket_diff_count"],
                "one_bucket_records": [
                    r.sample_id
                    for r in exp_manager.get_one_bucket_records(exp.experiment_id)
                ],
            }
        )

    @app.route("/supplement", methods=["POST"])
    def supplement():
        if "file" not in request.files:
            return jsonify({"error": "未上传文件"}), 400

        experiment_id = request.form.get("experiment_id")
        if not experiment_id or experiment_id not in exp_manager.experiments:
            return jsonify({"error": "实验不存在"}), 400

        file = request.files["file"]
        file_path = os.path.join("data", file.filename)
        file.save(file_path)

        candidates = DataImporter.load_recall_candidates_from_csv(file_path)
        exp = exp_manager.experiments[experiment_id]
        exp.drift_records = DataImporter.supplement_recall_candidates(
            exp.drift_records, candidates
        )

        report = exp_manager.generate_report(experiment_id)
        supplemented = sum(
            1 for d in report["details"] if d["recall_candidates_count"] > 0
        )
        return jsonify(
            {
                "message": "召回候选已补录，实验对比已更新",
                "supplemented_count": supplemented,
                "next_owner": "评测运营",
            }
        )

    @app.route("/review", methods=["POST"])
    def review():
        experiment_id = request.form.get("experiment_id")
        record_id = request.form.get("record_id")
        status = request.form.get("status")
        notes = request.form.get("notes", "")

        if not experiment_id or experiment_id not in exp_manager.experiments:
            return jsonify({"error": "实验不存在"}), 400

        updated = exp_manager.update_record_status(
            experiment_id, record_id, Status(status), notes, "评测运营"
        )

        if updated:
            return jsonify(
                {
                    "message": "复核完成",
                    "record_id": record_id,
                    "status": status,
                    "why_kept": updated.why_kept,
                    "next_owner": updated.next_owner.value,
                }
            )
        return jsonify({"error": "记录不存在"}), 400

    @app.route("/report/<experiment_id>")
    def report(experiment_id):
        if experiment_id not in exp_manager.experiments:
            return "实验不存在", 404

        report_data = exp_manager.generate_report(experiment_id)
        one_bucket_records = exp_manager.get_one_bucket_records(experiment_id)

        return render_template_string(
            """
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>实验报告 - {{ report.experiment_name }}</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
                    .container { max-width: 1200px; margin: 0 auto; }
                    .card { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
                    h1, h2 { color: #333; }
                    .stats { display: flex; gap: 20px; flex-wrap: wrap; }
                    .stat-box { flex: 1; min-width: 150px; padding: 20px; background: #f8f9fa; border-radius: 8px; text-align: center; }
                    .stat-value { font-size: 32px; font-weight: bold; color: #007bff; }
                    .stat-label { color: #666; margin-top: 5px; }
                    .warning .stat-value { color: #ffc107; }
                    .danger .stat-value { color: #dc3545; }
                    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
                    th { background: #f0f0f0; }
                    .one-bucket { background: #fff3cd; }
                    .multi-bucket { background: #f8d7da; }
                    .badge { padding: 3px 8px; border-radius: 12px; font-size: 12px; color: white; }
                    .badge-pending { background: #6c757d; }
                    .badge-reviewed { background: #17a2b8; }
                    .badge-supplemented { background: #ffc107; color: #333; }
                    .badge-normal { background: #28a745; }
                    .badge-investigate { background: #dc3545; }
                    .back-link { color: #007bff; text-decoration: none; }
                </style>
            </head>
            <body>
                <div class="container">
                    <p><a href="/" class="back-link">← 返回首页</a></p>
                    <h1>📊 实验对比报告</h1>
                    <h3>{{ report.experiment_name }}</h3>
                    <p>实验ID: {{ report.experiment_id }}</p>

                    <div class="card">
                        <h2>📈 统计概览</h2>
                        <div class="stats">
                            <div class="stat-box">
                                <div class="stat-value">{{ report.total_records }}</div>
                                <div class="stat-label">总记录数</div>
                            </div>
                            <div class="stat-box warning">
                                <div class="stat-value">{{ report.one_bucket_diff_count }}</div>
                                <div class="stat-label">差1桶（需复核）</div>
                            </div>
                            <div class="stat-box danger">
                                <div class="stat-value">{{ report.multi_bucket_diff_count }}</div>
                                <div class="stat-label">差多桶（需调查）</div>
                            </div>
                            <div class="stat-box">
                                <div class="stat-value">{{ report.pending_review }}</div>
                                <div class="stat-label">待复核</div>
                            </div>
                        </div>
                    </div>

                    <div class="card">
                        <h2>⚠️ 差1桶记录重点（共 {{ one_bucket|length }} 条）</h2>
                        <p><strong>说明：</strong>这些记录离线和线上分数差了一个桶，需要评测运营复核，别急着归正常</p>
                        <table>
                            <thead>
                                <tr>
                                    <th>样本ID</th>
                                    <th>离线分桶</th>
                                    <th>线上分桶</th>
                                    <th>状态</th>
                                    <th>为什么留下</th>
                                    <th>缺什么材料</th>
                                    <th>下一步找谁</th>
                                    <th>召回候选数</th>
                                </tr>
                            </thead>
                            <tbody>
                                {% for r in one_bucket %}
                                <tr class="one-bucket">
                                    <td>{{ r.sample_id }}</td>
                                    <td>{{ r.offline_bucket }}</td>
                                    <td>{{ r.online_bucket }}</td>
                                    <td><span class="badge badge-{{ r.status.value.replace('_', '-') }}">{{ r.status.value }}</span></td>
                                    <td>{{ r.why_kept or '-' }}</td>
                                    <td>{{ ', '.join(r.missing_materials) if r.missing_materials else '-' }}</td>
                                    <td>{{ r.next_owner.value }}</td>
                                    <td>{{ r.recall_candidates|length }}</td>
                                </tr>
                                {% endfor %}
                            </tbody>
                        </table>
                    </div>

                    <div class="card">
                        <h2>📋 全部记录详情</h2>
                        <table>
                            <thead>
                                <tr>
                                    <th>样本ID</th>
                                    <th>离线分桶</th>
                                    <th>线上分桶</th>
                                    <th>差异</th>
                                    <th>状态</th>
                                    <th>为什么留下</th>
                                    <th>缺什么材料</th>
                                    <th>下一步找谁</th>
                                    <th>复核备注</th>
                                </tr>
                            </thead>
                            <tbody>
                                {% for d in report.details %}
                                <tr class="{{ 'one-bucket' if d.bucket_diff == 'one_bucket' else ('multi-bucket' if d.bucket_diff == 'multi_bucket' else '') }}">
                                    <td>{{ d.sample_id }}</td>
                                    <td>{{ d.offline_bucket }}</td>
                                    <td>{{ d.online_bucket }}</td>
                                    <td>{{ d.bucket_diff }}</td>
                                    <td><span class="badge badge-{{ d.status.replace('_', '-') }}">{{ d.status }}</span></td>
                                    <td>{{ d.why_kept or '-' }}</td>
                                    <td>{{ ', '.join(d.missing_materials) if d.missing_materials else '-' }}</td>
                                    <td>{{ d.next_owner }}</td>
                                    <td>{{ d.review_notes or '-' }}</td>
                                </tr>
                                {% endfor %}
                            </tbody>
                        </table>
                    </div>
                </div>
            </body>
            </html>
            """,
            report=report_data,
            one_bucket=one_bucket_records,
        )

    @app.route("/dashboard/<experiment_id>")
    def dashboard_view(experiment_id):
        if experiment_id not in exp_manager.experiments:
            return "实验不存在", 404

        exp = exp_manager.experiments[experiment_id]
        records = exp.drift_records

        fig1 = visualizer.create_bucket_scatter_plot(records)
        fig2 = visualizer.create_3d_score_plot(records)
        fig3 = visualizer.create_bucket_diff_bar(records)

        return render_template_string(
            """
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>3D可视化看板</title>
                <script src="https://cdn.plot.ly/plotly-latest.min.js"></script>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
                    .container { max-width: 1400px; margin: 0 auto; }
                    .card { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
                    h1, h2 { color: #333; }
                    .back-link { color: #007bff; text-decoration: none; }
                    .hint { background: #fff3cd; padding: 10px; border-radius: 4px; margin: 10px 0; }
                </style>
            </head>
            <body>
                <div class="container">
                    <p><a href="/" class="back-link">← 返回首页</a></p>
                    <h1>🧊 3D可视化看板</h1>
                    <div class="hint">
                        💡 <strong>提示：</strong>点击图表中的数据点可查看记录ID，差1桶的橙色点需要评测运营复核
                    </div>

                    <div class="card">
                        <h2>📊 分桶差异分布统计</h2>
                        {{ fig3.to_html(full_html=False, include_plotlyjs=False)|safe }}
                    </div>

                    <div class="card">
                        <h2>📈 离线vs线上分桶分布</h2>
                        <p>橙色=差1桶，红色=差多桶，绿色=同桶。对角线上为无偏差样本。</p>
                        {{ fig1.to_html(full_html=False, include_plotlyjs=False)|safe }}
                    </div>

                    <div class="card">
                        <h2>🧊 3D视图：离线分数 × 线上分数 × 分桶差</h2>
                        <p>Z轴为分桶差，越高表示偏差越大。点击数据点可查看记录ID。</p>
                        {{ fig2.to_html(full_html=False, include_plotlyjs=False)|safe }}
                    </div>

                    <script>
                        document.addEventListener('DOMContentLoaded', function() {
                            const plotlyElements = document.querySelectorAll('.js-plotly-plot');
                            plotlyElements.forEach(function(plot) {
                                plot.on('plotly_click', function(data) {
                                    const point = data.points[0];
                                    const recordId = point.customdata;
                                    alert('记录ID: ' + recordId + '\\n\\n可跳转到负样本列表或召回候选表查看详情\\n(功能已预留，可对接实际数据表)');
                                });
                            });
                        });
                    </script>
                </div>
            </body>
            </html>
            """,
            fig1=fig1,
            fig2=fig2,
            fig3=fig3,
        )

    return app
