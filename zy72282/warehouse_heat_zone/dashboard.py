from flask import Flask, render_template_string, jsonify

from .processor import HeatZoneProcessor

app = Flask(__name__)

processor = HeatZoneProcessor(data_dir="./data")


def get_status_color(status):
    colors = {
        "normal": "success",
        "need_review": "warning",
        "completed": "info",
        "old_calibration": "secondary",
        "pending": "light",
    }
    return colors.get(status, "light")


def get_status_text(status):
    texts = {
        "normal": "正常",
        "need_review": "待复核",
        "completed": "已完成",
        "old_calibration": "旧口径",
        "pending": "待处理",
    }
    return texts.get(status, status)


DASHBOARD_HTML = """
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>仓储货架承重热区 - 小看板</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <style>
        .heat-zone-circle {
            position: absolute;
            border-radius: 50%;
            opacity: 0.6;
        }
        .severity-critical { background: #dc3545; }
        .severity-high { background: #fd7e14; }
        .severity-medium { background: #ffc107; }
        .severity-low { background: #20c997; }
        .warehouse-map {
            position: relative;
            background: #f8f9fa;
            border: 2px solid #dee2e6;
            height: 400px;
        }
        .shelf-marker {
            position: absolute;
            width: 40px;
            height: 40px;
            background: #6c757d;
            border: 2px solid #495057;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            font-size: 10px;
            transform: translate(-50%, -50%);
        }
        .origin-marker {
            position: absolute;
            width: 30px;
            height: 30px;
            background: #0d6efd;
            border-radius: 50%;
            border: 3px solid #0a58ca;
            transform: translate(-50%, -50%);
        }
    </style>
</head>
<body class="bg-light">
    <div class="container py-4">
        <header class="mb-4">
            <h1 class="h2 mb-2">🏭 仓储货架承重热区</h1>
            <p class="text-muted">实时监控货架承重状态与安全距离</p>
        </header>

        <div class="row mb-4">
            <div class="col-md-3">
                <div class="card bg-primary text-white">
                    <div class="card-body text-center">
                        <div class="display-4 font-weight-bold">{{ total_records }}</div>
                        <div>总记录数</div>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card bg-success text-white">
                    <div class="card-body text-center">
                        <div class="display-4 font-weight-bold">{{ normal_count }}</div>
                        <div>正常</div>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card bg-warning text-dark">
                    <div class="card-body text-center">
                        <div class="display-4 font-weight-bold">{{ need_review_count }}</div>
                        <div>待复核</div>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card bg-secondary text-white">
                    <div class="card-body text-center">
                        <div class="display-4 font-weight-bold">{{ old_calibration_count }}</div>
                        <div>旧口径</div>
                    </div>
                </div>
            </div>
        </div>

        <div class="row">
            <div class="col-md-6">
                <div class="card mb-4">
                    <div class="card-header">
                        <h5 class="mb-0">📍 仓库热区分布图</h5>
                    </div>
                    <div class="card-body">
                        <div class="warehouse-map">
                            <div class="origin-marker" style="left: 10%; top: 90%;" title="坐标原点"></div>
                            {% for record in records %}
                                {% set zone = record.heat_zones[0] if record.heat_zones else None %}
                                {% if zone %}
                                    {% set severity_class = 'severity-' + zone.severity %}
                                    {% set map_x = 10 + (zone.center_x * 2) %}
                                    {% set map_y = 90 - (zone.center_y * 2) %}
                                    {% set map_radius = zone.radius * 15 %}
                                    <div class="heat-zone-circle {{ severity_class }}"
                                         style="left: {{ map_x }}%; top: {{ map_y }}%; width: {{ map_radius * 2 }}px; height: {{ map_radius * 2 }}px; transform: translate(-50%, -50%);">
                                    </div>
                                    <div class="shelf-marker" style="left: {{ map_x }}%; top: {{ map_y }}%;">
                                        {{ record.shelf_code }}
                                    </div>
                                {% endif %}
                            {% endfor %}
                        </div>
                        <div class="mt-3 d-flex gap-3 justify-content-center small">
                            <span><span class="badge rounded-pill severity-critical" style="width:12px;height:12px;display:inline-block"></span> 危险</span>
                            <span><span class="badge rounded-pill severity-high" style="width:12px;height:12px;display:inline-block"></span> 高</span>
                            <span><span class="badge rounded-pill severity-medium" style="width:12px;height:12px;display:inline-block"></span> 中</span>
                            <span><span class="badge rounded-pill severity-low" style="width:12px;height:12px;display:inline-block"></span> 低</span>
                        </div>
                    </div>
                </div>
            </div>

            <div class="col-md-6">
                <div class="card mb-4">
                    <div class="card-header d-flex justify-content-between align-items-center">
                        <h5 class="mb-0">📋 巡检记录列表</h5>
                        <button onclick="location.reload()" class="btn btn-sm btn-outline-primary">刷新</button>
                    </div>
                    <div class="card-body p-0">
                        <div class="table-responsive">
                            <table class="table table-hover mb-0">
                                <thead class="table-light">
                                    <tr>
                                        <th>货架</th>
                                        <th>批次</th>
                                        <th>状态</th>
                                        <th>照片编号</th>
                                        <th>安全距离</th>
                                        <th>重跑</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {% for record in records %}
                                    <tr>
                                        <td class="fw-bold">{{ record.shelf_code }}</td>
                                        <td class="small">{{ record.batch_id or '-' }}</td>
                                        <td>
                                            <span class="badge bg-{{ get_status_color(record.status) }}">
                                                {{ get_status_text(record.status) }}
                                            </span>
                                        </td>
                                        <td class="small">{{ record.photo_number or '-' }}</td>
                                        <td>
                                            {% if record.heat_zones %}
                                                {{ record.heat_zones[0].safe_distance }}m
                                            {% else %}
                                                -
                                            {% endif %}
                                        </td>
                                        <td>{{ record.run_count }}次</td>
                                    </tr>
                                    {% endfor %}
                                    {% if not records %}
                                    <tr>
                                        <td colspan="6" class="text-center text-muted py-4">
                                            暂无记录，请先运行演示: <code>python3 -m warehouse_heat_zone demo</code>
                                        </td>
                                    </tr>
                                    {% endif %}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {% if latest_report %}
        <div class="card mb-4">
            <div class="card-header">
                <h5 class="mb-0">� 最新安全距离报告</h5>
            </div>
            <div class="card-body">
                <div class="row">
                    <div class="col-md-3">
                        <div class="text-center">
                            <div class="h4 mb-0">{{ latest_report.total_records }}</div>
                            <div class="text-muted small">总记录</div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="text-center">
                            <div class="h4 mb-0 text-success">{{ latest_report.normal_count }}</div>
                            <div class="text-muted small">正常</div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="text-center">
                            <div class="h4 mb-0 text-warning">{{ latest_report.need_review_count }}</div>
                            <div class="text-muted small">待复核</div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="text-center">
                            <div class="h4 mb-0">{{ latest_report.avg_safe_distance | round(2) }}m</div>
                            <div class="text-muted small">平均安全距离</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        {% endif %}

        <div class="card">
            <div class="card-header">
                <h5 class="mb-0">�📝 三步流程说明</h5>
            </div>
            <div class="card-body">
                <div class="row">
                    <div class="col-md-4">
                        <div class="d-flex align-items-start">
                            <span class="badge bg-primary rounded-pill me-2">1</span>
                            <div>
                                <h6>导入坐标原点</h6>
                                <p class="small text-muted mb-0">导入仓库坐标基准点，确定货架位置计算基准</p>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="d-flex align-items-start">
                            <span class="badge bg-warning rounded-pill me-2">2</span>
                            <div>
                                <h6>补看巡检照片编号</h6>
                                <p class="small text-muted mb-0">培训教官老梁检查照片，如遇移动端截图遮挡则留待复核</p>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="d-flex align-items-start">
                            <span class="badge bg-success rounded-pill me-2">3</span>
                            <div>
                                <h6>安全距离报告更新</h6>
                                <p class="small text-muted mb-0">补录完成后重跑分析，生成最新的安全距离报告</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <footer class="mt-4 text-center text-muted small">
            <p>仓储货架承重热区系统 | 可复盘、可重跑</p>
        </footer>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>
"""


@app.route("/")
def index():
    p = HeatZoneProcessor(data_dir="./data")
    records = p.get_all_records()
    total_records = len(records)
    normal_count = sum(1 for r in records if r.status.value == "normal")
    need_review_count = sum(1 for r in records if r.status.value == "need_review")
    old_calibration_count = sum(1 for r in records if r.status.value == "old_calibration")

    record_dicts = []
    for r in records:
        rd = {
            "record_id": r.record_id,
            "shelf_code": r.shelf_code,
            "batch_id": r.batch_id,
            "status": r.status.value,
            "photo_number": r.photo_number,
            "run_count": r.run_count,
            "heat_zones": [z.__dict__ for z in r.heat_zones],
        }
        record_dicts.append(rd)

    latest_report = None
    if p.current_batch_id:
        latest_report = p.get_latest_report(p.current_batch_id)

    return render_template_string(
        DASHBOARD_HTML,
        records=record_dicts,
        total_records=total_records,
        normal_count=normal_count,
        need_review_count=need_review_count,
        old_calibration_count=old_calibration_count,
        latest_report=latest_report,
        get_status_color=get_status_color,
        get_status_text=get_status_text,
    )


@app.route("/api/records")
def api_records():
    p = HeatZoneProcessor(data_dir="./data")
    records = p.get_all_records()
    return jsonify({
        "records": [
            {
                "record_id": r.record_id,
                "shelf_code": r.shelf_code,
                "batch_id": r.batch_id,
                "status": r.status.value,
                "photo_number": r.photo_number,
                "run_count": r.run_count,
                "safe_distance": r.heat_zones[0].safe_distance if r.heat_zones else 0,
            }
            for r in records
        ]
    })


def run_dashboard(host="127.0.0.1", port=5000):
    print(f"小看板已启动: http://{host}:{port}")
    print("按 Ctrl+C 停止服务")
    app.run(host=host, port=port, debug=False)


if __name__ == "__main__":
    run_dashboard()
