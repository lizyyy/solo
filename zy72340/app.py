from flask import Flask, render_template, request, jsonify, Response
from flask_cors import CORS
import models
import json

app = Flask(__name__)
CORS(app)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/weight-tables', methods=['GET'])
def list_weight_tables():
    return jsonify(models.WeightTable.list_all())

@app.route('/api/weight-tables', methods=['POST'])
def create_weight_table():
    data = request.json
    new_id = models.WeightTable.create(
        version=data['version'],
        name=data['name'],
        data=data['data'],
        created_by=data.get('created_by', 'admin')
    )
    return jsonify({'id': new_id, 'status': 'success'})

@app.route('/api/ledgers', methods=['GET'])
def list_ledgers():
    return jsonify(models.LedgerRecord.list_all())

@app.route('/api/ledgers/<int:ledger_id>', methods=['GET'])
def get_ledger(ledger_id):
    record = models.LedgerRecord.get(ledger_id)
    if not record:
        return jsonify({'error': '记录不存在'}), 404
    return jsonify(record)

@app.route('/api/ledgers', methods=['POST'])
def create_ledger():
    data = request.json
    new_id = models.LedgerRecord.create(
        serial_no=data['serial_no'],
        title=data['title'],
        weight_table_id=data['weight_table_id'],
        items=data['items'],
        created_by=data.get('created_by', 'admin')
    )
    
    models.HistoryLog.create(
        ledger_id=new_id,
        action='创建台账',
        detail={'serial_no': data['serial_no'], 'title': data['title'],
                'item_count': len(data['items'])},
        operator=data.get('created_by', 'admin')
    )
    
    return jsonify({'id': new_id, 'status': 'success'})

@app.route('/api/ledgers/<int:ledger_id>/items/<int:item_id>/delete', methods=['POST'])
def delete_item(ledger_id, item_id):
    data = request.json
    result = models.LedgerItem.soft_delete(
        item_id=item_id,
        deleted_by=data.get('operator', 'admin'),
        delete_reason=data.get('delete_reason', '人工识别为异常点')
    )
    return jsonify({'ledger_id': result, 'status': 'success'})

@app.route('/api/ledgers/<int:ledger_id>/items/<int:item_id>/correct', methods=['POST'])
def correct_item_api(ledger_id, item_id):
    data = request.json
    result = models.LedgerItem.correct_item(
        item_id=item_id,
        new_x=data.get('new_x'),
        new_y=data.get('new_y'),
        reason=data.get('correction_reason', ''),
        source=data.get('source', ''),
        operator=data.get('operator', 'admin'),
        next_handler=data.get('next_handler')
    )
    if 'error' in result:
        return jsonify(result), 400
    return jsonify(result)

@app.route('/api/ledgers/<int:ledger_id>/items/old-caliber', methods=['POST'])
def add_old_caliber_item(ledger_id):
    data = request.json
    new_id = models.LedgerItem.add_old_caliber_item(
        ledger_id=ledger_id,
        x_value=data['x_value'],
        y_value=data['y_value'],
        source=data['source'],
        created_by=data.get('operator', 'admin'),
        reason=data.get('reason', '从旧公式截图补录，用于新旧口径对比')
    )
    return jsonify({'id': new_id, 'status': 'success'})

@app.route('/api/ledgers/<int:ledger_id>/screenshot', methods=['POST'])
def add_screenshot(ledger_id):
    data = request.json
    new_id = models.FormulaScreenshot.create(
        ledger_id=ledger_id,
        description=data.get('description', ''),
        formula_content=data['formula_content'],
        uploaded_by=data.get('uploaded_by', 'admin'),
        image_path=data.get('image_path')
    )
    
    models.HistoryLog.create(
        ledger_id=ledger_id,
        action='上传旧公式截图',
        detail={'screenshot_id': new_id, 
                'formula_content': data['formula_content']},
        operator=data.get('uploaded_by', 'admin')
    )
    
    return jsonify({'id': new_id, 'status': 'success'})

@app.route('/api/ledgers/<int:ledger_id>/param-versions', methods=['GET'])
def list_param_versions(ledger_id):
    return jsonify(models.ParamVersion.list_by_ledger(ledger_id))

@app.route('/api/ledgers/<int:ledger_id>/param-versions', methods=['POST'])
def create_param_version(ledger_id):
    data = request.json
    new_id = models.ParamVersion.create(
        ledger_id=ledger_id,
        params=data['params'],
        change_type=data['change_type'],
        change_note=data.get('change_note', ''),
        created_by=data.get('created_by', 'admin'),
        weight_table_id=data.get('weight_table_id'),
        formula_screenshot_id=data.get('formula_screenshot_id'),
        is_suspended=data.get('is_suspended', 0),
        suspension_note=data.get('suspension_note'),
        correction_reason=data.get('correction_reason'),
        next_handler=data.get('next_handler')
    )
    return jsonify({'id': new_id, 'status': 'success'})

@app.route('/api/ledgers/<int:ledger_id>/history', methods=['GET'])
def list_history(ledger_id):
    return jsonify(models.HistoryLog.list_by_ledger(ledger_id))

@app.route('/api/ledgers/<int:ledger_id>/change-traces', methods=['GET'])
def list_change_traces(ledger_id):
    return jsonify(models.ChangeTrace.list_by_ledger(ledger_id))

@app.route('/api/ledgers/<int:ledger_id>/run', methods=['POST'])
def run_calc(ledger_id):
    data = request.json
    result = models.run_calculation(
        ledger_id=ledger_id,
        operator=data.get('operator', 'admin')
    )
    if 'error' in result:
        return jsonify(result), 400
    return jsonify(result)

@app.route('/api/ledgers/<int:ledger_id>/review', methods=['POST'])
def review_ledger(ledger_id):
    data = request.json
    new_id = models.ReviewRecord.create(
        ledger_id=ledger_id,
        review_type=data['review_type'],
        review_result=data['review_result'],
        review_note=data.get('review_note', ''),
        reviewed_by=data.get('reviewed_by', 'admin'),
        original_claim=data.get('original_claim'),
        corrected_value=data.get('corrected_value'),
        next_step=data.get('next_step'),
        next_handler=data.get('next_handler')
    )
    return jsonify({'id': new_id, 'status': 'success'})

@app.route('/api/ledgers/<int:ledger_id>/check-gap', methods=['GET'])
def check_gap(ledger_id):
    return jsonify(models.LedgerRecord.check_gap(ledger_id))

@app.route('/api/ledgers/<int:ledger_id>/suspend', methods=['POST'])
def suspend_ledger(ledger_id):
    data = request.json
    trace_id = models.LedgerRecord.suspend(
        ledger_id=ledger_id,
        operator=data.get('operator', 'admin'),
        suspension_note=data.get('suspension_note', '暂停处理流程'),
        next_handler=data.get('next_handler')
    )
    return jsonify({'trace_id': trace_id, 'status': 'success'})

@app.route('/api/ledgers/<int:ledger_id>/resume', methods=['POST'])
def resume_ledger(ledger_id):
    data = request.json
    trace_id = models.LedgerRecord.resume(
        ledger_id=ledger_id,
        operator=data.get('operator', 'admin'),
        resume_note=data.get('resume_note', '')
    )
    return jsonify({'trace_id': trace_id, 'status': 'success'})

@app.route('/api/ledgers/<int:ledger_id>/report', methods=['GET'])
def get_report(ledger_id):
    fmt = request.args.get('format', 'json')
    report = models.LedgerRecord.generate_report(ledger_id, fmt)
    if report is None:
        return jsonify({'error': '记录不存在'}), 404
    
    if fmt == 'json':
        return jsonify(report)
    elif fmt == 'csv':
        return Response(
            report,
            mimetype='text/csv; charset=utf-8',
            headers={
                'Content-Disposition': f'attachment; filename=ledger-{ledger_id}-report.csv'
            }
        )
    else:
        return jsonify({'error': '不支持的格式'}), 400

@app.route('/api/init-demo', methods=['POST'])
def init_demo_data():
    data = request.json
    operator = data.get('operator', 'admin')
    
    wt_id = models.WeightTable.create(
        version='v1.0',
        name='2025赛季竞赛评分权重表',
        data={'x': 1.05, 'y': 1.0, 'intercept': 0.98},
        created_by=operator
    )
    
    wt_id_v2 = models.WeightTable.create(
        version='v2.0',
        name='2026赛季新评分权重表',
        data={'x': 1.0, 'y': 1.0, 'intercept': 1.0},
        created_by=operator
    )
    
    demo_items_normal = [
        {'x': 1.0, 'y': 2.1},
        {'x': 2.0, 'y': 4.0},
        {'x': 3.0, 'y': 5.9},
        {'x': 4.0, 'y': 8.2},
        {'x': 5.0, 'y': 10.1}
    ]
    ledger_1_id = models.LedgerRecord.create(
        serial_no='LD-2026-001',
        title='【正常】标定实验-20260601',
        weight_table_id=wt_id_v2,
        items=demo_items_normal,
        created_by=operator
    )
    models.HistoryLog.create(ledger_1_id, '第一步：导入评分权重表',
                            {'weight_table_id': wt_id_v2, 'version': 'v2.0'},
                            operator)
    fs_id_1 = models.FormulaScreenshot.create(
        ledger_1_id, '2025旧公式截图',
        'y = 1.05x + 0.98 (2025赛季)',
        operator
    )
    models.HistoryLog.create(ledger_1_id, '第二步：唐老师补看旧公式截图',
                            {'screenshot_id': fs_id_1, 'formula': 'y = 1.05x + 0.98'},
                            operator)
    models.ParamVersion.create(
        ledger_1_id, {'slope': 1.0, 'intercept': 1.0, 'r_squared': 0.999},
        'manual', '第三步：参数版本页更新（新口径）',
        operator, wt_id_v2, fs_id_1
    )
    
    demo_items_gap = [
        {'x': 1.0, 'y': 2.2},
        {'x': 2.0, 'y': 3.8},
        {'x': 3.0, 'y': 6.5},
        {'x': 4.0, 'y': 7.9},
        {'x': 5.0, 'y': 10.3}
    ]
    ledger_2_id = models.LedgerRecord.create(
        serial_no='LD-2026-002',
        title='【断档】人工删除一行后编号断档',
        weight_table_id=wt_id_v2,
        items=demo_items_gap,
        created_by=operator
    )
    record2 = models.LedgerRecord.get(ledger_2_id)
    if record2 and len(record2['items']) >= 3:
        item_to_delete = record2['items'][2]['id']
        models.LedgerItem.soft_delete(item_to_delete, operator, '现场发现编号3数据点操作失误，人工剔除')
    
    demo_items_old = [
        {'x': 1.0, 'y': 2.0},
        {'x': 2.0, 'y': 3.9},
        {'x': 3.0, 'y': 6.1},
        {'x': 4.0, 'y': 8.0}
    ]
    ledger_3_id = models.LedgerRecord.create(
        serial_no='LD-2026-003',
        title='【旧口径】从旧公式截图补录数据',
        weight_table_id=wt_id,
        items=demo_items_old,
        created_by=operator
    )
    models.HistoryLog.create(ledger_3_id, '第一步：导入旧评分权重表',
                            {'weight_table_id': wt_id, 'version': 'v1.0'},
                            operator)
    fs_id_3 = models.FormulaScreenshot.create(
        ledger_3_id, '2025旧公式截图',
        'y = 1.05x + 0.98 (2025赛季)',
        operator
    )
    models.HistoryLog.create(ledger_3_id, '第二步：唐老师补看旧公式截图',
                            {'screenshot_id': fs_id_3, 'formula': 'y = 1.05x + 0.98'},
                            operator)
    models.LedgerItem.add_old_caliber_item(
        ledger_3_id, 5.0, 10.5, '旧公式截图2025赛季第3页', operator,
        '从旧公式截图补录编号5数据点，按2025赛季口径y=1.05x+0.98得出'
    )
    models.ParamVersion.create(
        ledger_3_id, {'slope': 1.05, 'intercept': 0.98, 'r_squared': 0.995},
        'manual', '第三步：参数版本页更新（旧口径）',
        operator, wt_id, fs_id_3
    )
    
    models.run_calculation(ledger_1_id, operator)
    models.run_calculation(ledger_3_id, operator)
    
    return jsonify({
        'status': 'success',
        'weight_tables': [wt_id, wt_id_v2],
        'ledgers': {
            'normal': ledger_1_id,
            'gap': ledger_2_id,
            'old_caliber': ledger_3_id
        }
    })

@app.route('/api/demo-results')
def get_demo_results():
    ledgers = models.LedgerRecord.list_all()
    results = []
    for lr in ledgers:
        detail = models.LedgerRecord.get(lr['id'])
        params = detail.get('params', {})
        results.append({
            'id': lr['id'],
            'serial_no': lr['serial_no'],
            'title': lr['title'],
            'status': lr['status'],
            'has_gap': lr.get('has_gap', 0),
            'is_old_caliber': lr.get('is_old_caliber', 0),
            'review_status': lr.get('review_status', 'pending'),
            'slope': params.get('slope'),
            'intercept': params.get('intercept'),
            'r_squared': params.get('r_squared'),
            'item_count': len(detail.get('items', [])),
            'deleted_count': len(detail.get('deleted_items', [])),
            'next_handler': lr.get('next_handler'),
            'suspension_note': lr.get('suspension_note'),
            'gap_original_claim': lr.get('gap_original_claim'),
            'gap_corrected_value': lr.get('gap_corrected_value'),
            'gap_reason': lr.get('gap_reason'),
            'gap_next_handler': lr.get('gap_next_handler'),
            'trace_count': lr.get('trace_count', 0),
            'version_count': lr.get('version_count', 0),
            'latest_version': lr.get('latest_version'),
            'is_suspended': detail.get('is_suspended', False),
            'active_count': lr.get('active_count', 0),
            'old_caliber_count': lr.get('old_caliber_count', 0)
        })
    return jsonify(results)

if __name__ == '__main__':
    app.run(debug=True, port=5000)
