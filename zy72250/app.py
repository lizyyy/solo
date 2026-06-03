from flask import Flask, jsonify, request, render_template_string
from datetime import datetime
from core import WarehouseBlindSpotReview
from demo_data import DemoData
from models import PointStatus

app = Flask(__name__)
review_system = WarehouseBlindSpotReview()


HTML_TEMPLATE = """
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>仓库叉车盲区复盘 - 小看板</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { 
            text-align: center; 
            color: white; 
            margin-bottom: 30px;
        }
        .header h1 { font-size: 28px; margin-bottom: 10px; }
        .header p { opacity: 0.9; }
        
        .cards { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .card { 
            background: white; 
            border-radius: 12px; 
            padding: 20px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
        }
        .card.success { border-top: 4px solid #10b981; }
        .card.review { border-top: 4px solid #f59e0b; }
        .card.supplement { border-top: 4px solid #8b5cf6; }
        
        .card h3 { 
            font-size: 18px; 
            margin-bottom: 15px;
            color: #1f2937;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .badge { 
            padding: 4px 12px; 
            border-radius: 20px; 
            font-size: 12px;
            font-weight: 500;
        }
        .badge.success { background: #d1fae5; color: #065f46; }
        .badge.review { background: #fef3c7; color: #92400e; }
        .badge.supplement { background: #ede9fe; color: #5b21b6; }
        
        .point-list { list-style: none; }
        .point-item { 
            padding: 12px; 
            background: #f9fafb;
            border-radius: 8px;
            margin-bottom: 10px;
        }
        .point-header { 
            display: flex; 
            justify-content: space-between;
            margin-bottom: 8px;
        }
        .point-index { 
            font-weight: 600;
            color: #374151;
        }
        .point-status {
            display: flex;
            align-items: center;
            gap: 4px;
        }
        .occluded { color: #ef4444; }
        .reason { 
            font-size: 13px; 
            color: #6b7280;
            margin-top: 4px;
        }
        .notes { 
            font-size: 12px; 
            color: #8b5cf6;
            margin-top: 4px;
            font-style: italic;
        }
        
        .steps {
            background: white;
            border-radius: 12px;
            padding: 25px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
        }
        .steps h2 { 
            font-size: 20px; 
            margin-bottom: 20px;
            color: #1f2937;
        }
        .step { 
            display: flex;
            gap: 15px;
            padding: 15px 0;
            border-bottom: 1px solid #e5e7eb;
        }
        .step:last-child { border-bottom: none; }
        .step-number {
            width: 40px;
            height: 40px;
            background: #667eea;
            color: white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 600;
            flex-shrink: 0;
        }
        .step-content h4 { 
            font-size: 16px; 
            color: #1f2937;
            margin-bottom: 5px;
        }
        .step-content p { 
            font-size: 14px; 
            color: #6b7280;
            line-height: 1.5;
        }
        .laoliang { 
            background: #fef3c7; 
            padding: 10px; 
            border-radius: 6px;
            margin-top: 8px;
            font-size: 13px;
        }
        .laoliang:before { content: "💬 老梁说："; font-weight: 600; }
        
        .stats {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 15px;
            margin-bottom: 20px;
        }
        .stat {
            background: white;
            padding: 15px;
            border-radius: 8px;
            text-align: center;
        }
        .stat-number { 
            font-size: 28px; 
            font-weight: 700;
            color: #667eea;
        }
        .stat-label { 
            font-size: 13px; 
            color: #6b7280;
            margin-top: 5px;
        }
        
        .loading {
            text-align: center;
            padding: 40px;
            color: white;
        }
        .btn {
            display: inline-block;
            padding: 10px 20px;
            background: #667eea;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            margin: 10px 0;
        }
        .btn:hover { background: #5a67d8; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🏭 仓库叉车盲区复盘</h1>
            <p>培训教官老梁的小看板 - 数据晚到不要紧，返工留在明面上</p>
            <button class="btn" onclick="loadData()">🔄 刷新数据</button>
        </div>
        
        <div id="content">
            <div class="loading">正在加载演示数据...</div>
        </div>
    </div>

    <script>
        function getStatusIcon(status) {
            const icons = {
                'normal': '✅',
                'pending_review': '🔍',
                'from_safety_radius': '📋',
                'missing_coord': '⚠️'
            };
            return icons[status] || '❓';
        }
        
        function getStatusText(status) {
            const texts = {
                'normal': '正常',
                'pending_review': '待安全员复核',
                'from_safety_radius': '从安全半径表补录',
                'missing_coord': '坐标缺失'
            };
            return texts[status] || status;
        }
        
        function renderStats(data) {
            const total = data.reduce((sum, c) => sum + c.occlusion_points.total, 0);
            const normal = data.reduce((sum, c) => sum + c.occlusion_points.normal, 0);
            const pending = data.reduce((sum, c) => sum + c.occlusion_points.pending_review, 0);
            const supplemented = data.reduce((sum, c) => sum + c.occlusion_points.from_safety_radius, 0);
            
            return `
                <div class="stats">
                    <div class="stat">
                        <div class="stat-number">${total}</div>
                        <div class="stat-label">总点位</div>
                    </div>
                    <div class="stat">
                        <div class="stat-number" style="color:#10b981">${normal}</div>
                        <div class="stat-label">✅ 正常</div>
                    </div>
                    <div class="stat">
                        <div class="stat-number" style="color:#f59e0b">${pending}</div>
                        <div class="stat-label">🔍 待复核</div>
                    </div>
                    <div class="stat">
                        <div class="stat-number" style="color:#8b5cf6">${supplemented}</div>
                        <div class="stat-label">📋 补录</div>
                    </div>
                </div>
            `;
        }
        
        function renderCard(caseData, points, cardClass, badgeClass) {
            const pointsHtml = points.map(p => `
                <li class="point-item">
                    <div class="point-header">
                        <span class="point-index">点位 #${p.point_index}</span>
                        <span class="point-status">
                            ${getStatusIcon(p.status)}
                            ${getStatusText(p.status)}
                            ${p.is_occluded ? '<span class="occluded">⚠️遮挡</span>' : ''}
                        </span>
                    </div>
                    ${p.occlusion_reason ? `<div class="reason">原因: ${p.occlusion_reason}</div>` : ''}
                    ${p.reviewer_notes ? `<div class="notes">${p.reviewer_notes}</div>` : ''}
                </li>
            `).join('');
            
            return `
                <div class="card ${cardClass}">
                    <h3>
                        ${caseData.photo_id}
                        <span class="badge ${badgeClass}">${caseData.status}</span>
                    </h3>
                    <ul class="point-list">${pointsHtml}</ul>
                </div>
            `;
        }
        
        function renderContent(data) {
            const successCase = data.find(c => c.status === '顺利完成');
            const reviewCase = data.find(c => c.status === '待安全员复核');
            const supplementCase = data.find(c => c.status === '旧口径补录');
            
            document.getElementById('content').innerHTML = `
                ${renderStats(data)}
                
                <div class="cards">
                    ${successCase ? renderCard(successCase, successCase.points_detail, 'success', 'success') : ''}
                    ${reviewCase ? renderCard(reviewCase, reviewCase.points_detail, 'review', 'review') : ''}
                    ${supplementCase ? renderCard(supplementCase, supplementCase.points_detail, 'supplement', 'supplement') : ''}
                </div>
                
                <div class="steps">
                    <h2>📝 标准三步流程（老梁培训笔记）</h2>
                    <div class="step">
                        <div class="step-number">1</div>
                        <div class="step-content">
                            <h4>点云抽稀日志第一次导入</h4>
                            <p>导入照片点位和坐标表，系统自动比对。</p>
                            <div class="laoliang">照片有点位但坐标表缺一行？别急，先标"待安全员复核"，别着急归正常。安全半径表晚到是常有的事。</div>
                        </div>
                    </div>
                    <div class="step">
                        <div class="step-number">2</div>
                        <div class="step-content">
                            <h4>补看安全半径表</h4>
                            <p>安全半径表到了就导入，系统会自动匹配旧口径数据。</p>
                            <div class="laoliang">看见没？安全半径表一到，原来的判断就得改。返工要留在明面上，让所有人都看见。</div>
                        </div>
                    </div>
                    <div class="step">
                        <div class="step-number">3</div>
                        <div class="step-content">
                            <h4>遮挡点清单更新</h4>
                            <p>重新生成遮挡点清单，三种结果一目了然。</p>
                            <div class="laoliang">三种结果都要讲清楚：顺利的直接标正常，缺行的留给安全员复核，安全半径表补来的旧口径要标清楚来源。</div>
                        </div>
                    </div>
                </div>
            `;
        }
        
        function loadData() {
            document.getElementById('content').innerHTML = '<div class="loading">正在加载演示数据...</div>';
            fetch('/api/demo')
                .then(res => res.json())
                .then(data => renderContent(data.cases));
        }
        
        loadData();
    </script>
</body>
</html>
"""


def init_demo_data():
    cases = DemoData.get_all_demo_cases()
    for case in cases:
        review_system.import_point_cloud_logs(
            case["photo_id"], 
            case["point_cloud_logs"]
        )
        review_system.import_coord_table(
            case["photo_id"], 
            case["coord_rows"]
        )
        review_system.import_safety_radius_table(
            case["photo_id"], 
            case["safety_radius_entries"]
        )
        review_system.generate_occlusion_list(case["photo_id"])


@app.route('/')
def index():
    return render_template_string(HTML_TEMPLATE)


@app.route('/api/demo')
def api_demo():
    init_demo_data()
    
    cases_data = []
    for case in DemoData.get_all_demo_cases():
        photo_id = case["photo_id"]
        summary = review_system.get_record_summary(photo_id)
        record = review_system.review_records.get(photo_id)
        
        points_detail = []
        if record:
            for point in record.occlusion_points:
                points_detail.append({
                    "point_index": point.point_index,
                    "status": point.status.value,
                    "is_occluded": point.is_occluded,
                    "occlusion_reason": point.occlusion_reason,
                    "reviewer_notes": point.reviewer_notes
                })
        
        summary["points_detail"] = points_detail
        cases_data.append(summary)
    
    return jsonify({
        "cases": cases_data,
        "step_history": review_system.step_history
    })


@app.route('/api/records')
def api_records():
    records = []
    for photo_id, record in review_system.review_records.items():
        summary = review_system.get_record_summary(photo_id)
        records.append(summary)
    return jsonify({"records": records})


@app.route('/api/review', methods=['POST'])
def api_review():
    data = request.json
    success = review_system.safety_officer_review(
        data.get("photo_id"),
        data.get("point_index"),
        data.get("is_approved", False),
        data.get("reviewer_notes", "")
    )
    return jsonify({"success": success})


@app.route('/api/rerun/<photo_id>')
def api_rerun(photo_id):
    points = review_system.rerun_analysis(photo_id)
    return jsonify({
        "photo_id": photo_id,
        "points_count": len(points)
    })


if __name__ == '__main__':
    print("🏭 仓库叉车盲区复盘小看板启动中...")
    print("📋 访问 http://localhost:5000 查看小看板")
    print("💡 培训教官老梁提醒：先看三步流程，再对比三种结果")
    app.run(debug=True, port=5000)
