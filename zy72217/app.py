from flask import Flask, jsonify, request, send_file, render_template
from flask_cors import CORS
import io
import csv
from datetime import datetime
from store import store
from engine import PositionGapService, SelfCheckEngine

app = Flask(__name__)
CORS(app)


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/warnings', methods=['GET'])
def get_warnings():
    warnings = store.get_all_warnings()
    return jsonify([{
        'id': w.id,
        'report_date': w.report_date,
        'fund_code': w.fund_code,
        'fund_name': w.fund_name,
        'status': w.status,
        'entry_count': len(w.entries),
        'created_at': w.created_at.isoformat(),
        'updated_at': w.updated_at.isoformat()
    } for w in warnings])


@app.route('/api/warnings', methods=['POST'])
def create_warning():
    data = request.json
    warning = store.create_warning(
        report_date=data.get('report_date', datetime.now().strftime('%Y-%m-%d')),
        fund_code=data.get('fund_code', ''),
        fund_name=data.get('fund_name', '')
    )
    return jsonify({
        'success': True,
        'warning_id': warning.id,
        'message': '预警记录已创建'
    })


@app.route('/api/warnings/<warning_id>', methods=['GET'])
def get_warning_detail(warning_id):
    data = PositionGapService.get_api_response_data(warning_id)
    if not data:
        return jsonify({'success': False, 'message': '预警记录不存在'}), 404
    return jsonify(data)


@app.route('/api/warnings/<warning_id>/import', methods=['POST'])
def import_entries(warning_id):
    data = request.json
    rows = data.get('rows', [])
    file_name = data.get('file_name', 'unknown.xlsx')

    result = PositionGapService.import_adjustment_entries(warning_id, rows, file_name)
    return jsonify(result)


@app.route('/api/warnings/<warning_id>/entries/<entry_id>/adjust', methods=['POST'])
def apply_adjustment(warning_id, entry_id):
    data = request.json
    result = PositionGapService.apply_manual_adjustment(
        entry_id=entry_id,
        warning_id=warning_id,
        operator=data.get('operator', '林姐'),
        adjustment_amount=data.get('adjustment_amount', 0),
        remark=data.get('remark')
    )
    return jsonify(result)


@app.route('/api/warnings/<warning_id>/entries/<entry_id>/custodian-confirm', methods=['POST'])
def custodian_confirm(warning_id, entry_id):
    data = request.json
    result = PositionGapService.custodian_confirm(
        entry_id=entry_id,
        warning_id=warning_id,
        custodian_operator=data.get('custodian_operator', '托管对接人'),
        confirmed_amount=data.get('confirmed_amount', 0),
        confirmed_currency=data.get('confirmed_currency', 'CNY'),
        remark=data.get('remark'),
        is_correction=data.get('is_correction', False)
    )
    return jsonify(result)


@app.route('/api/warnings/<warning_id>/update-audit', methods=['POST'])
def update_audit(warning_id):
    data = request.json
    result = PositionGapService.update_audit_details(
        warning_id=warning_id,
        operator=data.get('operator', '系统')
    )
    return jsonify(result)


@app.route('/api/warnings/<warning_id>/supplement', methods=['POST'])
def supplement_entries(warning_id):
    data = request.json
    rows = data.get('rows', [])
    result = PositionGapService.supplement_entries(
        warning_id=warning_id,
        rows=rows,
        operator=data.get('operator', '林姐'),
        remark=data.get('remark')
    )
    return jsonify(result)


@app.route('/api/warnings/<warning_id>/recalculate', methods=['POST'])
def recalculate(warning_id):
    data = request.json
    result = PositionGapService.recalculate(
        warning_id=warning_id,
        operator=data.get('operator', '林姐')
    )
    return jsonify(result)


@app.route('/api/warnings/<warning_id>/self-check', methods=['GET'])
def run_self_check(warning_id):
    warning = store.get_warning(warning_id)
    if not warning:
        return jsonify({'success': False, 'message': '预警记录不存在'}), 404

    results = SelfCheckEngine.run_all_checks(warning, include_duplicate_check=True)
    return jsonify({
        'success': True,
        'check_results': results,
        'passed_count': sum(1 for r in results if r['passed']),
        'total_count': len(results)
    })


@app.route('/api/warnings/<warning_id>/export', methods=['GET'])
def export_warning(warning_id):
    data = PositionGapService.get_export_data(warning_id)
    if not data:
        return jsonify({'success': False, 'message': '预警记录不存在'}), 404

    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow(['资金头寸缺口预警明细导出'])
    writer.writerow(['报告日期', data.get('report_date')])
    writer.writerow(['基金代码', data.get('fund_code')])
    writer.writerow(['基金名称', data.get('fund_name')])
    writer.writerow(['导出时间', data.get('export_time')])
    writer.writerow([])

    writer.writerow([
        '原始行号', '证券代码', '证券名称', '原始金额', '币种',
        '人工调整', '调整后金额', '当前状态', '异常类型', '备注'
    ])

    for entry in data.get('entries', []):
        writer.writerow([
            entry.get('original_row_number'),
            entry.get('security_code'),
            entry.get('security_name'),
            entry.get('original_amount'),
            entry.get('original_currency'),
            entry.get('manual_adjustment') or '',
            entry.get('adjusted_amount') or '',
            entry.get('current_status'),
            ','.join(entry.get('abnormal_types', [])),
            entry.get('mixed_currency_note') or ''
        ])

    output.seek(0)
    bytes_output = io.BytesIO(output.getvalue().encode('utf-8-sig'))

    return send_file(
        bytes_output,
        mimetype='text/csv',
        as_attachment=True,
        download_name=f'头寸缺口预警_{data.get("report_date")}.csv'
    )


@app.route('/api/warnings/<warning_id>/page-data', methods=['GET'])
def get_page_data(warning_id):
    data = PositionGapService.get_page_display_data(warning_id)
    if not data:
        return jsonify({'success': False, 'message': '预警记录不存在'}), 404

    warning = store.get_warning(warning_id)
    data['self_check_results'] = [
        {
            'check_name': r.get('check_name'),
            'passed': r.get('passed'),
            'message': r.get('message'),
            'level': r.get('level')
        }
        for r in getattr(warning, 'self_check_results', [])
    ]
    data['custodian_confirmations'] = [
        {
            'id': c.id,
            'adjustment_id': c.adjustment_id,
            'custodian_operator': c.custodian_operator,
            'confirm_time': c.confirm_time.isoformat(),
            'confirmed_amount': c.confirmed_amount,
            'confirmed_currency': c.confirmed_currency,
            'remark': c.remark,
            'is_manual_correction': c.is_manual_correction
        }
        for c in getattr(warning, 'custodian_confirmations', [])
    ]

    return jsonify(data)


@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'ok'})


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080, debug=True)
