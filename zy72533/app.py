from flask import Flask, render_template, jsonify, request, send_from_directory
import os
from datetime import datetime
from data_store import DataStore, DemoDataGenerator
from core import AnnotationWorkflow, ModelVersionComparator, ConfidenceAnalyzer
from report_generator import ReportGenerator

app = Flask(__name__)
app.config['JSON_AS_ASCII'] = False

data_store = DataStore()


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/samples', methods=['GET'])
def get_samples():
    status = request.args.get('status')
    show_hidden = request.args.get('show_hidden', 'false').lower() == 'true'

    samples = data_store.load_all_samples()

    if status:
        samples = [s for s in samples if s.status.value == status]

    if show_hidden:
        samples = [s for s in samples if s.hidden_by_avg]

    result = []
    for s in samples:
        latest_summary = s.model_outputs[-1].summary if s.model_outputs else "无模型输出"
        latest_conf = s.model_outputs[-1].confidence if s.model_outputs else 0

        result.append({
            'sample_id': s.sample_id,
            'status': s.status.value,
            'confidence_level': s.confidence_level.value,
            'confidence': latest_conf,
            'hidden_by_avg': s.hidden_by_avg,
            'next_action': s.next_action.value if s.next_action else None,
            'summary_preview': latest_summary[:50],
            'call_time': s.call_time.strftime('%Y-%m-%d %H:%M'),
            'has_annotations': len(s.annotations) > 0,
            'has_supplements': len(s.supplements) > 0
        })

    return jsonify(result)


@app.route('/api/samples/<sample_id>', methods=['GET'])
def get_sample(sample_id):
    sample = data_store.load_sample(sample_id)
    if not sample:
        return jsonify({'error': '样本不存在'}), 404

    return jsonify(sample.model_dump(mode="json"))


@app.route('/api/samples', methods=['POST'])
def create_sample():
    data = request.json
    sample_data = data.get('samples', [data]) if isinstance(data, dict) else data
    result = data_store.import_samples(sample_data)
    return jsonify(result.model_dump(mode="json"))


@app.route('/api/samples/<sample_id>/annotations', methods=['POST'])
def add_annotation(sample_id):
    sample = data_store.load_sample(sample_id)
    if not sample:
        return jsonify({'error': '样本不存在'}), 404

    data = request.json
    sample = AnnotationWorkflow.add_annotation(
        sample,
        annotator=data['annotator'],
        corrected_summary=data['corrected_summary'],
        comment=data['comment'],
        error_type=data.get('error_type')
    )
    data_store.save_sample(sample)
    return jsonify(sample.model_dump(mode="json"))


@app.route('/api/samples/<sample_id>/supplements', methods=['POST'])
def add_supplement(sample_id):
    sample = data_store.load_sample(sample_id)
    if not sample:
        return jsonify({'error': '样本不存在'}), 404

    data = request.json
    sample = AnnotationWorkflow.add_supplement(
        sample,
        operator=data['operator'],
        model_output_snippet=data['model_output_snippet'],
        reason=data['reason'],
        additional_notes=data.get('additional_notes')
    )
    data_store.save_sample(sample)
    return jsonify(sample.model_dump(mode="json"))


@app.route('/api/samples/<sample_id>/model-outputs', methods=['POST'])
def add_model_output(sample_id):
    sample = data_store.load_sample(sample_id)
    if not sample:
        return jsonify({'error': '样本不存在'}), 404

    data = request.json
    sample = AnnotationWorkflow.add_model_output(
        sample,
        model_version=data['model_version'],
        summary=data['summary'],
        confidence=data['confidence'],
        entities=data.get('entities', []),
        mask_details=data.get('mask_details', []),
        raw_output=data.get('raw_output')
    )
    data_store.save_sample(sample)
    return jsonify(sample.model_dump(mode="json"))


@app.route('/api/samples/<sample_id>/review', methods=['POST'])
def review_sample(sample_id):
    sample = data_store.load_sample(sample_id)
    if not sample:
        return jsonify({'error': '样本不存在'}), 404

    data = request.json
    sample = AnnotationWorkflow.escalate_for_review(sample, data['notes'])
    from models import NextAction
    sample.next_action = NextAction.TO_ALGO_OPER
    data_store.save_sample(sample)
    return jsonify(sample.model_dump(mode="json"))


@app.route('/api/samples/<sample_id>/resolve', methods=['POST'])
def resolve_sample(sample_id):
    sample = data_store.load_sample(sample_id)
    if not sample:
        return jsonify({'error': '样本不存在'}), 404

    data = request.json
    sample = AnnotationWorkflow.resolve_sample(sample, data['notes'])
    data_store.save_sample(sample)
    return jsonify(sample.model_dump(mode="json"))


@app.route('/api/compare', methods=['GET'])
def compare_versions():
    baseline = request.args.get('baseline', 'v1.0')
    current = request.args.get('current', 'v2.0')
    sample_id = request.args.get('sample_id')

    if sample_id:
        sample = data_store.load_sample(sample_id)
        if not sample:
            return jsonify({'error': '样本不存在'}), 404
        samples = [sample]
    else:
        samples = data_store.load_all_samples()

    comparisons = []
    for sample in samples:
        comp = ModelVersionComparator.compare_versions(sample, baseline, current)
        if comp:
            comparisons.append(comp.model_dump(mode="json"))

    report = ReportGenerator.generate_comparison_report(samples, baseline, current)

    return jsonify({
        'baseline_version': baseline,
        'current_version': current,
        'comparisons': comparisons,
        'report_text': report
    })


@app.route('/api/stats', methods=['GET'])
def get_stats():
    stats = data_store.get_stats()
    return jsonify(stats)


@app.route('/api/demo/init', methods=['POST'])
def init_demo():
    dataset = DemoDataGenerator.create_demo_dataset()
    samples_data = [s.model_dump(mode="json") for s in dataset.samples]
    result = data_store.import_samples(samples_data)
    DemoDataGenerator.save_demo_dataset(dataset)
    return jsonify(result.model_dump(mode="json"))


@app.route('/api/report/workflow/<sample_id>', methods=['GET'])
def get_workflow_report(sample_id):
    sample = data_store.load_sample(sample_id)
    if not sample:
        return jsonify({'error': '样本不存在'}), 404

    report = ReportGenerator.generate_workflow_report(sample)
    return jsonify({'report': report})


def create_templates():
    templates_dir = os.path.join(os.path.dirname(__file__), 'templates')
    os.makedirs(templates_dir, exist_ok=True)

    html_content = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>政务热线摘要脱敏 - 小看板</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f5f7fa; color: #333; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px 40px; }
        .header h1 { font-size: 24px; margin-bottom: 5px; }
        .header p { opacity: 0.9; font-size: 14px; }
        .container { max-width: 1400px; margin: 20px auto; padding: 0 20px; }
        .stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 20px; }
        .stat-card { background: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
        .stat-card .label { font-size: 13px; color: #999; margin-bottom: 8px; }
        .stat-card .value { font-size: 28px; font-weight: bold; color: #333; }
        .stat-card.warning .value { color: #f59e0b; }
        .stat-card.danger .value { color: #ef4444; }
        .tabs { display: flex; gap: 10px; margin-bottom: 20px; }
        .tab { padding: 10px 20px; background: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; }
        .tab.active { background: #667eea; color: white; }
        .panel { background: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); display: none; }
        .panel.active { display: block; }
        .btn { padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; margin-right: 8px; }
        .btn-primary { background: #667eea; color: white; }
        .btn-success { background: #10b981; color: white; }
        .btn-warning { background: #f59e0b; color: white; }
        .btn-danger { background: #ef4444; color: white; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; font-size: 13px; }
        th { background: #f9fafb; font-weight: 600; }
        tr:hover { background: #f9fafb; }
        .badge { padding: 3px 8px; border-radius: 12px; font-size: 11px; font-weight: 500; }
        .badge-high { background: #d1fae5; color: #065f46; }
        .badge-medium { background: #fef3c7; color: #92400e; }
        .badge-low { background: #fee2e2; color: #991b1b; }
        .badge-hidden { background: #fecaca; color: #991b1b; font-weight: bold; }
        .modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000; }
        .modal.active { display: flex; align-items: center; justify-content: center; }
        .modal-content { background: white; border-radius: 8px; padding: 30px; max-width: 800px; max-height: 80vh; overflow-y: auto; width: 90%; }
        .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .modal-header h2 { font-size: 18px; }
        .close-btn { background: none; border: none; font-size: 24px; cursor: pointer; }
        .form-group { margin-bottom: 15px; }
        .form-group label { display: block; margin-bottom: 5px; font-size: 13px; font-weight: 500; }
        .form-group input, .form-group textarea, .form-group select { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 6px; font-size: 13px; }
        .form-group textarea { min-height: 80px; }
        .report-box { background: #1f2937; color: #e5e7eb; padding: 20px; border-radius: 6px; font-family: monospace; font-size: 12px; white-space: pre-wrap; }
        .section-title { font-size: 16px; font-weight: 600; margin: 20px 0 10px; padding-bottom: 8px; border-bottom: 2px solid #667eea; }
        .timeline { position: relative; padding-left: 30px; }
        .timeline-item { position: relative; margin-bottom: 20px; }
        .timeline-item::before { content: ''; position: absolute; left: -25px; top: 5px; width: 12px; height: 12px; border-radius: 50%; background: #667eea; }
        .timeline-item::after { content: ''; position: absolute; left: -20px; top: 17px; width: 2px; height: calc(100% + 8px); background: #e5e7eb; }
        .timeline-item:last-child::after { display: none; }
        .timeline-title { font-weight: 600; font-size: 14px; margin-bottom: 5px; }
        .timeline-meta { font-size: 12px; color: #999; margin-bottom: 5px; }
        .timeline-content { font-size: 13px; color: #666; }
    </style>
</head>
<body>
    <div class="header">
        <h1>📋 政务热线摘要脱敏 - 小看板</h1>
        <p>低置信度样本检测 · 模型版本对比 · 标注补录流程</p>
    </div>

    <div class="container">
        <div class="stats-row" id="statsRow">
            <div class="stat-card">
                <div class="label">总样本数</div>
                <div class="value" id="totalSamples">0</div>
            </div>
            <div class="stat-card warning">
                <div class="label">需复核样本</div>
                <div class="value" id="needReview">0</div>
            </div>
            <div class="stat-card danger">
                <div class="label">被平均掩盖</div>
                <div class="value" id="hiddenByAvg">0</div>
            </div>
            <div class="stat-card">
                <div class="label">已补录</div>
                <div class="value" id="supplemented">0</div>
            </div>
        </div>

        <div style="margin-bottom: 15px;">
            <button class="btn btn-primary" onclick="initDemo()">初始化演示数据</button>
            <button class="btn btn-success" onclick="generateCompareReport()">生成版本对比报告</button>
            <button class="btn btn-warning" onclick="showHiddenOnly()">只看被掩盖样本</button>
        </div>

        <div class="tabs">
            <button class="tab active" onclick="switchTab('samples')">样本列表</button>
            <button class="tab" onclick="switchTab('compare')">版本对比</button>
        </div>

        <div class="panel active" id="panelSamples">
            <table>
                <thead>
                    <tr>
                        <th>样本ID</th>
                        <th>状态</th>
                        <th>置信度</th>
                        <th>被掩盖</th>
                        <th>下一步</th>
                        <th>摘要预览</th>
                        <th>操作</th>
                    </tr>
                </thead>
                <tbody id="samplesTableBody">
                </tbody>
            </table>
        </div>

        <div class="panel" id="panelCompare">
            <div style="margin-bottom: 15px;">
                <label>基线版本: </label>
                <select id="baselineVersion" style="padding: 6px;">
                    <option value="v1.0">v1.0</option>
                    <option value="v2.0">v2.0</option>
                </select>
                <label style="margin-left: 15px;">当前版本: </label>
                <select id="currentVersion" style="padding: 6px;">
                    <option value="v2.0">v2.0</option>
                    <option value="v1.0">v1.0</option>
                </select>
                <button class="btn btn-primary" onclick="loadCompare()">刷新对比</button>
            </div>
            <div id="compareContent"></div>
        </div>
    </div>

    <div class="modal" id="detailModal">
        <div class="modal-content">
            <div class="modal-header">
                <h2 id="modalTitle">样本详情</h2>
                <button class="close-btn" onclick="closeModal()">&times;</button>
            </div>
            <div id="modalBody"></div>
        </div>
    </div>

    <div class="modal" id="annotateModal">
        <div class="modal-content">
            <div class="modal-header">
                <h2>添加标注</h2>
                <button class="close-btn" onclick="closeAnnotateModal()">&times;</button>
            </div>
            <div class="form-group">
                <label>标注员</label>
                <input type="text" id="annotator" value="标注员小王">
            </div>
            <div class="form-group">
                <label>修正后摘要</label>
                <textarea id="correctedSummary"></textarea>
            </div>
            <div class="form-group">
                <label>标注留言</label>
                <textarea id="annotationComment" placeholder="说明标注原因和发现的问题"></textarea>
            </div>
            <div class="form-group">
                <label>错误类型</label>
                <input type="text" id="errorType" placeholder="如：脱敏不完整、信息遗漏等">
            </div>
            <button class="btn btn-primary" onclick="submitAnnotation()">提交标注</button>
        </div>
    </div>

    <div class="modal" id="supplementModal">
        <div class="modal-content">
            <div class="modal-header">
                <h2>补录模型输出片段</h2>
                <button class="close-btn" onclick="closeSupplementModal()">&times;</button>
            </div>
            <div class="form-group">
                <label>操作人</label>
                <input type="text" id="operator" value="算法运营老唐">
            </div>
            <div class="form-group">
                <label>模型输出原始片段</label>
                <textarea id="modelSnippet" placeholder="粘贴模型原始输出片段"></textarea>
            </div>
            <div class="form-group">
                <label>补录原因</label>
                <textarea id="supplementReason" placeholder="说明为什么需要补录"></textarea>
            </div>
            <div class="form-group">
                <label>补充说明</label>
                <textarea id="supplementNotes"></textarea>
            </div>
            <button class="btn btn-primary" onclick="submitSupplement()">提交补录</button>
        </div>
    </div>

    <script>
        let currentSampleId = null;
        let showHiddenFlag = false;

        function initDemo() {
            fetch('/api/demo/init', { method: 'POST' })
                .then(r => r.json())
                .then(data => {
                    alert('演示数据初始化完成！\\n共导入 ' + data.success + ' 条样本，其中 ' + data.hidden_by_avg_count + ' 条被平均指标掩盖。');
                    loadSamples();
                    loadStats();
                });
        }

        function loadStats() {
            fetch('/api/stats')
                .then(r => r.json())
                .then(data => {
                    document.getElementById('totalSamples').textContent = data.total_samples;
                    document.getElementById('needReview').textContent = (data.by_status.needs_review || 0);
                    document.getElementById('hiddenByAvg').textContent = data.hidden_by_avg_count;
                    document.getElementById('supplemented').textContent = (data.by_status.supplemented || 0);
                });
        }

        function loadSamples() {
            let url = '/api/samples';
            if (showHiddenFlag) {
                url += '?show_hidden=true';
            }
            fetch(url)
                .then(r => r.json())
                .then(data => {
                    const tbody = document.getElementById('samplesTableBody');
                    tbody.innerHTML = '';
                    data.forEach(s => {
                        const tr = document.createElement('tr');
                        let confBadge = '<span class="badge badge-medium">' + s.confidence.toFixed(2) + '</span>';
                        if (s.confidence >= 0.85) confBadge = '<span class="badge badge-high">' + s.confidence.toFixed(2) + '</span>';
                        if (s.confidence < 0.6) confBadge = '<span class="badge badge-low">' + s.confidence.toFixed(2) + '</span>';

                        const hiddenBadge = s.hidden_by_avg ? '<span class="badge badge-hidden">🔴 是</span>' : '<span>否</span>';
                        const nextAction = s.next_action ? s.next_action.replace('to_', '').replace('_', ' ') : '待处理';

                        tr.innerHTML = `
                            <td><strong>${s.sample_id}</strong></td>
                            <td>${s.status}</td>
                            <td>${confBadge}</td>
                            <td>${hiddenBadge}</td>
                            <td>${nextAction}</td>
                            <td>${s.summary_preview}...</td>
                            <td>
                                <button class="btn btn-primary" onclick="viewDetail('${s.sample_id}')">详情</button>
                                <button class="btn btn-success" onclick="openAnnotate('${s.sample_id}')">标注</button>
                                <button class="btn btn-warning" onclick="openSupplement('${s.sample_id}')">补录</button>
                            </td>
                        `;
                        tbody.appendChild(tr);
                    });
                });
        }

        function showHiddenOnly() {
            showHiddenFlag = !showHiddenFlag;
            loadSamples();
        }

        function viewDetail(sampleId) {
            fetch('/api/samples/' + sampleId)
                .then(r => r.json())
                .then(data => {
                    currentSampleId = sampleId;
                    document.getElementById('modalTitle').textContent = '样本详情 - ' + sampleId;

                    let html = '<div class="section-title">基本信息</div>';
                    html += `<p><strong>来电时间:</strong> ${data.call_time}</p>`;
                    html += `<p><strong>热线号码:</strong> ${data.hotline_number}</p>`;
                    html += `<p><strong>原始文本:</strong> ${data.original_text}</p>`;
                    html += `<p><strong>状态:</strong> ${data.status} | <strong>置信度:</strong> ${data.confidence_level}`;
                    if (data.hidden_by_avg) {
                        html += ' | <span style="color:red;font-weight:bold;">🔴 低置信度被平均指标掩盖</span>';
                    }
                    html += '</p>';

                    html += '<div class="section-title">处理时间线</div>';
                    html += '<div class="timeline">';

                    data.model_outputs.forEach((m, i) => {
                        html += `<div class="timeline-item">
                            <div class="timeline-title">🤖 模型输出版本 ${m.model_version}</div>
                            <div class="timeline-meta">置信度: ${m.confidence.toFixed(2)} | ${m.timestamp}</div>
                            <div class="timeline-content">摘要: ${m.summary}</div>
                        </div>`;
                    });

                    data.annotations.forEach((a, i) => {
                        html += `<div class="timeline-item">
                            <div class="timeline-title">✏️  标注员: ${a.annotator}</div>
                            <div class="timeline-meta">${a.timestamp}</div>
                            <div class="timeline-content">
                                修正摘要: ${a.corrected_summary}<br>
                                留言: ${a.comment}
                                ${a.error_type ? '<br>错误类型: ' + a.error_type : ''}
                            </div>
                        </div>`;
                    });

                    data.supplements.forEach((s, i) => {
                        html += `<div class="timeline-item">
                            <div class="timeline-title">🔧 补录人: ${s.operator}</div>
                            <div class="timeline-meta">${s.timestamp}</div>
                            <div class="timeline-content">
                                原因: ${s.reason}<br>
                                输出片段: ${s.model_output_snippet}
                                ${s.additional_notes ? '<br>说明: ' + s.additional_notes : ''}
                            </div>
                        </div>`;
                    });

                    html += '</div>';

                    if (data.review_notes) {
                        html += '<div class="section-title">复核意见</div>';
                        html += '<p>' + data.review_notes + '</p>';
                    }

                    document.getElementById('modalBody').innerHTML = html;
                    document.getElementById('detailModal').classList.add('active');
                });
        }

        function closeModal() {
            document.getElementById('detailModal').classList.remove('active');
        }

        function openAnnotate(sampleId) {
            currentSampleId = sampleId;
            fetch('/api/samples/' + sampleId)
                .then(r => r.json())
                .then(data => {
                    const latest = data.model_outputs[data.model_outputs.length - 1];
                    document.getElementById('correctedSummary').value = latest ? latest.summary : '';
                });
            document.getElementById('annotateModal').classList.add('active');
        }

        function closeAnnotateModal() {
            document.getElementById('annotateModal').classList.remove('active');
        }

        function submitAnnotation() {
            const data = {
                annotator: document.getElementById('annotator').value,
                corrected_summary: document.getElementById('correctedSummary').value,
                comment: document.getElementById('annotationComment').value,
                error_type: document.getElementById('errorType').value
            };

            fetch('/api/samples/' + currentSampleId + '/annotations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            }).then(r => r.json()).then(() => {
                alert('标注提交成功！');
                closeAnnotateModal();
                loadSamples();
                loadStats();
            });
        }

        function openSupplement(sampleId) {
            currentSampleId = sampleId;
            document.getElementById('supplementModal').classList.add('active');
        }

        function closeSupplementModal() {
            document.getElementById('supplementModal').classList.remove('active');
        }

        function submitSupplement() {
            const data = {
                operator: document.getElementById('operator').value,
                model_output_snippet: document.getElementById('modelSnippet').value,
                reason: document.getElementById('supplementReason').value,
                additional_notes: document.getElementById('supplementNotes').value
            };

            fetch('/api/samples/' + currentSampleId + '/supplements', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            }).then(r => r.json()).then(() => {
                alert('补录提交成功！版本对比报告已更新。');
                closeSupplementModal();
                loadSamples();
                loadStats();
            });
        }

        function switchTab(tabName) {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
            event.target.classList.add('active');
            document.getElementById('panel' + tabName.charAt(0).toUpperCase() + tabName.slice(1)).classList.add('active');

            if (tabName === 'compare') {
                loadCompare();
            }
        }

        function generateCompareReport() {
            switchTab('compare');
            loadCompare();
        }

        function loadCompare() {
            const baseline = document.getElementById('baselineVersion').value;
            const current = document.getElementById('currentVersion').value;

            fetch(`/api/compare?baseline=${baseline}&current=${current}`)
                .then(r => r.json())
                .then(data => {
                    let html = '<div class="report-box">' + data.report_text + '</div>';
                    document.getElementById('compareContent').innerHTML = html;
                });
        }

        loadSamples();
        loadStats();
    </script>
</body>
</html>
"""

    with open(os.path.join(templates_dir, 'index.html'), 'w', encoding='utf-8') as f:
        f.write(html_content)


create_templates()

if __name__ == '__main__':
    print("政务热线摘要脱敏系统启动中...")
    print("访问 http://localhost:5000 查看小看板")
    print("使用 python cli.py --help 查看命令行工具")
    app.run(host='127.0.0.1', port=5000, debug=False)
