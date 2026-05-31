from flask import Flask, request, jsonify, render_template_string
from models import Database
from schedule_service import ScheduleService, ScheduleError

app = Flask(__name__)
db = Database()
service = ScheduleService(db)

HTML_TEMPLATE = '''
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>林区巡航排班系统</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
        }
        .card {
            background: white;
            border-radius: 16px;
            padding: 24px;
            margin-bottom: 20px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.1);
        }
        h1 {
            color: #333;
            font-size: 24px;
            margin-bottom: 20px;
            text-align: center;
        }
        h2 {
            color: #555;
            font-size: 18px;
            margin-bottom: 16px;
            padding-bottom: 8px;
            border-bottom: 2px solid #667eea;
        }
        .form-group {
            margin-bottom: 16px;
        }
        label {
            display: block;
            margin-bottom: 6px;
            color: #555;
            font-weight: 500;
        }
        input, textarea, select {
            width: 100%;
            padding: 10px 12px;
            border: 2px solid #e0e0e0;
            border-radius: 8px;
            font-size: 14px;
            transition: border-color 0.3s;
        }
        input:focus, textarea:focus, select:focus {
            outline: none;
            border-color: #667eea;
        }
        textarea {
            min-height: 80px;
            resize: vertical;
        }
        button {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.2s, box-shadow 0.2s;
        }
        button:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }
        button:active {
            transform: translateY(0);
        }
        .alert {
            padding: 12px 16px;
            border-radius: 8px;
            margin-bottom: 16px;
            white-space: pre-line;
        }
        .alert-success {
            background: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
        }
        .alert-error {
            background: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
        }
        .alert-info {
            background: #d1ecf1;
            color: #0c5460;
            border: 1px solid #bee5eb;
        }
        .history-item {
            background: #f8f9fa;
            padding: 12px;
            border-radius: 8px;
            margin-bottom: 8px;
            border-left: 4px solid #667eea;
        }
        .history-item p {
            margin: 4px 0;
            color: #555;
        }
        .tag {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 500;
            margin-right: 8px;
        }
        .tag-pending {
            background: #fff3cd;
            color: #856404;
        }
        .tag-resolved {
            background: #d4edda;
            color: #155724;
        }
        .tabs {
            display: flex;
            gap: 8px;
            margin-bottom: 20px;
        }
        .tab {
            flex: 1;
            padding: 10px;
            text-align: center;
            background: #f0f0f0;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.3s;
        }
        .tab.active {
            background: #667eea;
            color: white;
        }
        .tab-content {
            display: none;
        }
        .tab-content.active {
            display: block;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="card">
            <h1>🚁 林区巡航排班系统</h1>
            <div class="tabs">
                <div class="tab active" onclick="switchTab('create')">创建排班</div>
                <div class="tab" onclick="switchTab('query')">查询详情</div>
                <div class="tab" onclick="switchTab('kml')">KML修改记录</div>
            </div>

            <div id="message"></div>

            <div id="create" class="tab-content active">
                <h2>📝 提交排班信息</h2>
                <form id="scheduleForm">
                    <div class="form-group">
                        <label>批次编号 *</label>
                        <input type="text" name="batch_id" placeholder="例如：HX20240501001" required>
                    </div>
                    <div class="form-group">
                        <label>飞行日期 *</label>
                        <input type="date" name="flight_date" required>
                    </div>
                    <div class="form-group">
                        <label>巡航区域 *</label>
                        <input type="text" name="area" placeholder="例如：大兴安岭A区" required>
                    </div>
                    <div class="form-group">
                        <label>飞行员 *</label>
                        <input type="text" name="pilot" placeholder="请填写飞行员姓名" required>
                    </div>
                    <div class="form-group">
                        <label>无人机编号 *</label>
                        <input type="text" name="drone_id" placeholder="例如：DJI-001" required>
                    </div>
                    <div class="form-group">
                        <label>航线KML内容 *</label>
                        <textarea name="kml_file" placeholder='粘贴KML内容，包含"返航点"字样会被识别' required></textarea>
                    </div>
                    <div class="form-group">
                        <label>KML修改原因（如有修改）</label>
                        <input type="text" name="kml_change_reason" placeholder="如果是修改KML，请填写原因">
                    </div>
                    <div class="form-group">
                        <label>气象截图标识 *</label>
                        <input type="text" name="weather_snapshot" placeholder="例如：weather_20240501_0800.png" required>
                    </div>
                    <div class="form-group">
                        <label>电池记录（可选）</label>
                        <textarea name="battery_record" placeholder='电池记录，包含"RTP"会被识别返航点'></textarea>
                    </div>
                    <div class="form-group">
                        <label>操作人 *</label>
                        <input type="text" name="operator" placeholder="请填写您的姓名" required>
                    </div>
                    <button type="submit">提交排班</button>
                </form>
            </div>

            <div id="query" class="tab-content">
                <h2>🔍 查询排班详情</h2>
                <div class="form-group">
                    <label>批次编号</label>
                    <input type="text" id="query_batch_id" placeholder="输入批次编号">
                </div>
                <button onclick="querySchedule()">查询</button>
                <div id="query_result" style="margin-top: 20px;"></div>
            </div>

            <div id="kml" class="tab-content">
                <h2>📋 KML修改追踪</h2>
                <div class="form-group">
                    <label>批次编号</label>
                    <input type="text" id="kml_batch_id" placeholder="输入批次编号">
                </div>
                <button onclick="queryKMLHistory()">查询修改记录</button>
                <div id="kml_result" style="margin-top: 20px;"></div>
            </div>
        </div>
    </div>

    <script>
        function switchTab(tabName) {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            event.target.classList.add('active');
            document.getElementById(tabName).classList.add('active');
        }

        function showMessage(message, type = 'info') {
            const msgDiv = document.getElementById('message');
            msgDiv.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
            setTimeout(() => msgDiv.innerHTML = '', 5000);
        }

        document.getElementById('scheduleForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData);
            const operator = data.operator;
            const battery_record = data.battery_record || null;
            delete data.operator;
            delete data.battery_record;

            try {
                const response = await fetch('/api/schedule', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ data, operator, battery_record })
                });
                const result = await response.json();
                
                if (result.success) {
                    const action = result.is_new ? '创建' : '更新';
                    showMessage(`✅ 排班${action}成功！批次号：${result.schedule.batch_id}`, 'success');
                    e.target.reset();
                } else {
                    showMessage(`❌ ${result.error}`, 'error');
                }
            } catch (err) {
                showMessage(`❌ 网络错误：${err.message}`, 'error');
            }
        });

        async function querySchedule() {
            const batchId = document.getElementById('query_batch_id').value;
            if (!batchId) {
                showMessage('请输入批次编号', 'error');
                return;
            }

            try {
                const response = await fetch(`/api/schedule/${batchId}`);
                const result = await response.json();
                
                if (result.success) {
                    const d = result.data;
                    let html = `<div class="card" style="margin-top:0;"><h3>排班基本信息</h3>`;
                    for (const [key, value] of Object.entries(d.schedule)) {
                        html += `<p><strong>${key}：</strong>${value}</p>`;
                    }
                    html += `</div>`;

                    if (d['kml修改历史'].length > 0) {
                        html += `<div class="card" style="margin-top:20px;"><h3>📍 KML修改历史</h3>`;
                        d['kml修改历史'].forEach(h => {
                            html += `<div class="history-item"><p><strong>修改人：</strong>${h.修改人}</p><p><strong>修改时间：</strong>${h.修改时间}</p><p><strong>修改原因：</strong>${h.修改原因}</p></div>`;
                        });
                        html += `</div>`;
                    }

                    if (d['气象截图历史'].length > 0) {
                        html += `<div class="card" style="margin-top:20px;"><h3>🌤️ 气象截图历史</h3>`;
                        d['气象截图历史'].forEach(w => {
                            html += `<div class="history-item"><p><strong>操作人：</strong>${w.操作人}</p><p><strong>操作时间：</strong>${w.操作时间}</p><p><strong>操作类型：</strong>${w.操作类型}</p></div>`;
                        });
                        html += `</div>`;
                    }

                    if (d['返航点问题'].length > 0) {
                        html += `<div class="card" style="margin-top:20px;"><h3>⚠️ 返航点问题记录</h3>`;
                        d['返航点问题'].forEach(i => {
                            const tagClass = i.状态 === '待处理' ? 'tag-pending' : 'tag-resolved';
                            html += `<div class="history-item"><span class="tag ${tagClass}">${i.状态}</span><p><strong>问题来源：</strong>${i.问题来源}</p><p><strong>发现时间：</strong>${i.发现时间}</p><p><strong>处理人：</strong>${i.处理人}</p></div>`;
                        });
                        html += `</div>`;
                    }

                    document.getElementById('query_result').innerHTML = html;
                } else {
                    showMessage(`❌ ${result.error}`, 'error');
                }
            } catch (err) {
                showMessage(`❌ 网络错误：${err.message}`, 'error');
            }
        }

        async function queryKMLHistory() {
            const batchId = document.getElementById('kml_batch_id').value;
            if (!batchId) {
                showMessage('请输入批次编号', 'error');
                return;
            }

            try {
                const response = await fetch(`/api/kml-history/${batchId}`);
                const result = await response.json();
                
                if (result.success) {
                    document.getElementById('kml_result').innerHTML = 
                        `<div class="alert alert-info">${result.message}</div>`;
                } else {
                    showMessage(`❌ ${result.error}`, 'error');
                }
            } catch (err) {
                showMessage(`❌ 网络错误：${err.message}`, 'error');
            }
        }
    </script>
</body>
</html>
'''

@app.route('/')
def index():
    return render_template_string(HTML_TEMPLATE)

@app.route('/api/schedule', methods=['POST'])
def create_schedule():
    try:
        payload = request.json
        data = payload['data']
        operator = payload['operator']
        battery_record = payload.get('battery_record')

        schedule, is_new = service.process_schedule(data, operator, battery_record)
        
        return jsonify({
            'success': True,
            'is_new': is_new,
            'schedule': {
                'batch_id': schedule.batch_id,
                'flight_date': schedule.flight_date,
                'area': schedule.area
            }
        })
    except ScheduleError as e:
        return jsonify({
            'success': False,
            'error': str(e)
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': '系统出了点小问题，请稍后再试或者联系技术支持~'
        })

@app.route('/api/schedule/<batch_id>')
def get_schedule(batch_id):
    try:
        details = service.get_schedule_details(batch_id)
        return jsonify({
            'success': True,
            'data': details
        })
    except ScheduleError as e:
        return jsonify({
            'success': False,
            'error': str(e)
        })

@app.route('/api/kml-history/<batch_id>')
def get_kml_history(batch_id):
    try:
        message = service.get_kml_modifiers(batch_id)
        return jsonify({
            'success': True,
            'message': message
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': '查询失败，请稍后再试~'
        })

if __name__ == '__main__':
    app.run(debug=True, port=5000)
