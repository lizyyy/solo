import os
import json
import tempfile
from datetime import datetime
from flask import Flask, render_template, request, redirect, url_for, session, send_file, jsonify

import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from tidal_power_predictor.importer.file_importer import TidalFileImporter, ImportResult
from tidal_power_predictor.importer.column_mapper import ColumnMapping, ColumnNameNormalizer, STANDARD_COLUMNS
from tidal_power_predictor.core.calculator import TidalPredictionInput, TidalPowerCalculator
from tidal_power_predictor.core.data_processor import TidalDataProcessor, ProcessingSummary
from tidal_power_predictor.report.generator import ReportGenerator
from tidal_power_predictor.data.sample_data import create_sample_dataset


app = Flask(__name__)
app.secret_key = 'tidal-power-prediction-secret-key-2024'
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024
app.config['UPLOAD_FOLDER'] = tempfile.gettempdir()

importer = TidalFileImporter()
calculator = TidalPowerCalculator()
processor = TidalDataProcessor()
report_gen = ReportGenerator()


TARGET_COLUMN_LABELS = {
    "record_id": "记录编号",
    "station_name": "测站名称",
    "timestamp": "观测时间",
    "tidal_range": "潮差数值",
    "tidal_range_unit": "潮差单位",
    "flow_rate": "流量数值",
    "flow_rate_unit": "流量单位",
    "water_velocity": "水流速度",
    "water_velocity_unit": "流速单位",
    "cross_sectional_area": "过流面积",
    "cross_sectional_area_unit": "面积单位",
    "turbine_efficiency": "水轮机效率",
    "data_source": "数据来源",
    "notes": "备注",
}


def serialize_record(record: TidalPredictionInput) -> dict:
    return {
        "record_id": record.record_id,
        "timestamp": record.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
        "station_name": record.station_name,
        "tidal_range": record.tidal_range,
        "tidal_range_unit": record.tidal_range_unit,
        "flow_rate": record.flow_rate,
        "flow_rate_unit": record.flow_rate_unit,
        "water_velocity": record.water_velocity,
        "water_velocity_unit": record.water_velocity_unit,
        "cross_sectional_area": record.cross_sectional_area,
        "cross_sectional_area_unit": record.cross_sectional_area_unit,
        "turbine_efficiency": record.turbine_efficiency,
        "data_source": record.data_source,
        "notes": record.notes,
    }


def deserialize_record(data: dict) -> TidalPredictionInput:
    return TidalPredictionInput(
        record_id=data.get("record_id", ""),
        timestamp=datetime.strptime(data.get("timestamp", datetime.now().strftime("%Y-%m-%d %H:%M:%S")), "%Y-%m-%d %H:%M:%S"),
        station_name=data.get("station_name", ""),
        tidal_range=float(data["tidal_range"]) if data.get("tidal_range") not in [None, ""] else None,
        tidal_range_unit=data.get("tidal_range_unit", "m"),
        flow_rate=float(data["flow_rate"]) if data.get("flow_rate") not in [None, ""] else None,
        flow_rate_unit=data.get("flow_rate_unit", "m³/s"),
        water_velocity=float(data["water_velocity"]) if data.get("water_velocity") not in [None, ""] else None,
        water_velocity_unit=data.get("water_velocity_unit", "m/s"),
        cross_sectional_area=float(data["cross_sectional_area"]) if data.get("cross_sectional_area") not in [None, ""] else None,
        cross_sectional_area_unit=data.get("cross_sectional_area_unit", "m²"),
        turbine_efficiency=float(data["turbine_efficiency"]) if data.get("turbine_efficiency") not in [None, ""] else None,
        data_source=data.get("data_source", "imported"),
        notes=data.get("notes", ""),
    )


@app.route('/')
def index():
    return redirect(url_for('upload'))


@app.route('/upload', methods=['GET', 'POST'])
def upload():
    if request.method == 'POST':
        if 'file' not in request.files:
            return render_template('upload.html', error="请选择文件")
        
        file = request.files['file']
        if file.filename == '':
            return render_template('upload.html', error="请选择文件")
        
        if file:
            filename = file.filename
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], f"tidal_upload_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{filename}")
            file.save(filepath)
            
            try:
                preview = importer.preview_file(filepath)
                
                session['current_filepath'] = filepath
                session['preview'] = {
                    'filename': preview.filename,
                    'total_rows': preview.total_rows,
                    'total_columns': preview.total_columns,
                    'source_columns': preview.source_columns,
                    'sample_data': preview.sample_data,
                    'suggested_mappings': [
                        {
                            'source_column': m.source_column,
                            'target_column': m.target_column,
                            'confidence': m.confidence,
                            'is_custom': m.is_custom,
                        }
                        for m in preview.suggested_mappings
                    ],
                    'raw_preview': preview.raw_preview,
                }
                
                return redirect(url_for('mapping'))
            except Exception as e:
                return render_template('upload.html', error=f"文件预览失败: {str(e)}")
    
    return render_template('upload.html')


@app.route('/mapping', methods=['GET', 'POST'])
def mapping():
    if 'preview' not in session:
        return redirect(url_for('upload'))
    
    preview = session['preview']
    
    if request.method == 'POST':
        mappings = []
        for source_col in preview['source_columns']:
            target = request.form.get(f"mapping_{source_col}", "")
            if target:
                mappings.append({
                    'source_column': source_col,
                    'target_column': target,
                    'confidence': 1.0,
                    'is_custom': True,
                })
        
        session['mappings'] = mappings
        
        try:
            mapping_objs = [
                ColumnMapping(
                    source_column=m['source_column'],
                    target_column=m['target_column'],
                    confidence=m['confidence'],
                    is_custom=m['is_custom'],
                )
                for m in mappings
            ]
            
            import_result = importer.import_file(
                session['current_filepath'],
                mapping_objs
            )
            
            if import_result.success:
                session['records'] = [serialize_record(r) for r in import_result.records]
                session['import_stats'] = import_result.stats
                session['import_warnings'] = import_result.warnings
                return redirect(url_for('preview_data'))
            else:
                return render_template('mapping.html', 
                                     preview=preview,
                                     target_columns=list(TARGET_COLUMN_LABELS.items()),
                                     error="; ".join(import_result.errors))
        except Exception as e:
            return render_template('mapping.html', 
                                 preview=preview,
                                 target_columns=list(TARGET_COLUMN_LABELS.items()),
                                 error=f"导入失败: {str(e)}")
    
    return render_template('mapping.html', 
                         preview=preview,
                         target_columns=list(TARGET_COLUMN_LABELS.items()))


@app.route('/preview')
def preview_data():
    if 'records' not in session:
        return redirect(url_for('upload'))
    
    records = session['records']
    import_stats = session.get('import_stats', {})
    import_warnings = session.get('import_warnings', [])
    
    results = []
    for rec_data in records:
        rec = deserialize_record(rec_data)
        result = calculator.calculate_power(rec)
        results.append({
            'record': rec_data,
            'predicted_power': round(result.predicted_power, 2) if result.predicted_power else None,
            'status': result.status,
            'status_text': {
                'success': '计算成功',
                'needs_review': '待人工确认',
                'failed': '计算失败',
                'pending': '待处理'
            }.get(result.status, result.status),
            'issues': [
                {'level': i.level, 'field': i.field, 'message': i.message, 'suggestion': i.suggestion}
                for i in result.issues
            ],
            'calculation_method': result.calculation_method,
            'confidence_score': round(result.confidence_score * 100, 1) if result.confidence_score else 0,
        })
    
    return render_template('preview.html',
                         results=results,
                         import_stats=import_stats,
                         import_warnings=import_warnings)


@app.route('/edit/<record_id>', methods=['GET', 'POST'])
def edit_record(record_id):
    if 'records' not in session:
        return redirect(url_for('upload'))
    
    records = session['records']
    record_index = next((i for i, r in enumerate(records) if r['record_id'] == record_id), None)
    
    if record_index is None:
        return redirect(url_for('preview_data'))
    
    if request.method == 'POST':
        updated = dict(request.form)
        for key in updated:
            records[record_index][key] = updated[key]
        
        session['records'] = records
        return redirect(url_for('preview_data'))
    
    return render_template('edit.html',
                         record=records[record_index],
                         target_columns=TARGET_COLUMN_LABELS)


@app.route('/calculate')
def calculate_all():
    if 'records' not in session:
        return redirect(url_for('upload'))
    
    records_data = session['records']
    records = [deserialize_record(r) for r in records_data]
    
    results, summary = processor.process_batch(records)
    
    session['summary'] = {
        'total_records': summary.total_records,
        'success_count': summary.success_count,
        'needs_review_count': summary.needs_review_count,
        'failed_count': summary.failed_count,
        'old_portal_count': summary.old_portal_count,
        'duplicate_count': summary.duplicate_count,
        'total_power_kwh': round(summary.total_power_kwh, 2),
        'avg_confidence': round(summary.avg_confidence * 100, 1),
        'duplicates': [
            {
                'primary_record_id': d.primary_record_id,
                'duplicate_record_ids': d.duplicate_record_ids,
            }
            for d in summary.duplicates
        ]
    }
    
    session['calculated_results'] = [
        {
            'record_id': r.record_id,
            'station_name': r.station_name,
            'timestamp': r.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
            'predicted_power': round(r.predicted_power, 2) if r.predicted_power else None,
            'power_unit': r.power_unit,
            'status': r.status,
            'status_text': {
                'success': '计算成功',
                'needs_review': '待人工确认',
                'failed': '计算失败',
                'pending': '待处理'
            }.get(r.status, r.status),
            'calculation_method': r.calculation_method,
            'confidence_score': round(r.confidence_score * 100, 1) if r.confidence_score else 0,
            'issues': [
                {'level': i.level, 'field': i.field, 'message': i.message, 'suggestion': i.suggestion}
                for i in r.issues
            ],
            'processing_notes': r.processing_notes,
        }
        for r in results
    ]
    
    return redirect(url_for('results'))


@app.route('/results')
def results():
    if 'calculated_results' not in session:
        return redirect(url_for('calculate_all'))
    
    return render_template('results.html',
                         results=session['calculated_results'],
                         summary=session.get('summary', {}))


@app.route('/diff', methods=['GET', 'POST'])
def diff_view():
    if request.method == 'POST':
        if 'baseline_file' not in request.files:
            return render_template('diff.html', error="请选择基线文件")
        
        baseline_file = request.files['baseline_file']
        if baseline_file.filename:
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], f"baseline_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{baseline_file.filename}")
            baseline_file.save(filepath)
            
            try:
                baseline_preview = importer.preview_file(filepath)
                session['baseline_filepath'] = filepath
                session['baseline_preview'] = {
                    'filename': baseline_preview.filename,
                    'total_rows': baseline_preview.total_rows,
                    'total_columns': baseline_preview.total_columns,
                    'source_columns': baseline_preview.source_columns,
                    'sample_data': baseline_preview.sample_data,
                    'suggested_mappings': [
                        {
                            'source_column': m.source_column,
                            'target_column': m.target_column,
                            'confidence': m.confidence,
                            'is_custom': m.is_custom,
                        }
                        for m in baseline_preview.suggested_mappings
                    ],
                    'column_warnings': getattr(baseline_preview, 'column_warnings', []),
                }
                return redirect(url_for('diff_mapping'))
            except Exception as e:
                return render_template('diff.html', error=f"基线文件读取失败: {str(e)}")
    
    return render_template('diff.html')


@app.route('/diff/mapping', methods=['GET', 'POST'])
def diff_mapping():
    if 'baseline_preview' not in session:
        return redirect(url_for('diff_view'))
    
    preview = session['baseline_preview']
    
    if request.method == 'POST':
        mappings = []
        for source_col in preview['source_columns']:
            target = request.form.get(f"mapping_{source_col}", "")
            if target:
                mappings.append({
                    'source_column': source_col,
                    'target_column': target,
                    'confidence': 1.0,
                    'is_custom': True,
                })
        
        try:
            from tidal_power_predictor.importer.column_mapper import ColumnMapping
            mapping_objs = [
                ColumnMapping(
                    source_column=m['source_column'],
                    target_column=m['target_column'],
                    confidence=m['confidence'],
                    is_custom=m['is_custom'],
                )
                for m in mappings
            ]
            
            import_result = importer.import_file(
                session['baseline_filepath'],
                mapping_objs
            )
            
            if import_result.success:
                baseline_records = [serialize_record(r) for r in import_result.records]
                session['baseline_records'] = baseline_records
                
                baseline_inputs = [deserialize_record(r) for r in baseline_records]
                baseline_results, baseline_summary = processor.process_batch(baseline_inputs)
                
                session['baseline_calculated'] = [
                    {
                        'record_id': r.record_id,
                        'station_name': r.station_name,
                        'timestamp': r.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
                        'predicted_power': round(r.predicted_power, 2) if r.predicted_power else None,
                        'status': r.status,
                    }
                    for r in baseline_results
                ]
                
                return redirect(url_for('diff_result'))
            else:
                return render_template('diff_mapping.html',
                                     preview=preview,
                                     target_columns=list(TARGET_COLUMN_LABELS.items()),
                                     error="; ".join(import_result.errors))
        except Exception as e:
            return render_template('diff_mapping.html',
                                 preview=preview,
                                 target_columns=list(TARGET_COLUMN_LABELS.items()),
                                 error=f"基线导入失败: {str(e)}")
    
    return render_template('diff_mapping.html',
                         preview=preview,
                         target_columns=list(TARGET_COLUMN_LABELS.items()))


@app.route('/diff/result')
def diff_result():
    if 'calculated_results' not in session or 'baseline_calculated' not in session:
        return redirect(url_for('diff_view'))
    
    current_results = session['calculated_results']
    baseline_results = session['baseline_calculated']
    
    diff_items = []
    
    for curr in current_results:
        baseline = None
        for bl in baseline_results:
            if (bl['station_name'] and bl['station_name'] == curr['station_name']) or bl['record_id'] == curr['record_id']:
                baseline = bl
                break
        
        diff_item = {
            'record_id': curr['record_id'],
            'station_name': curr['station_name'],
            'current_power': curr['predicted_power'],
            'baseline_power': baseline['predicted_power'] if baseline else None,
            'current_status': curr['status'],
            'baseline_status': baseline['status'] if baseline else None,
            'diff_power': None,
            'diff_percent': None,
            'has_diff': False,
            'is_new': baseline is None,
            'status_diff': baseline is not None and curr['status'] != baseline['status'],
        }
        
        if curr['predicted_power'] is not None and baseline and baseline['predicted_power'] is not None:
            diff_item['diff_power'] = round(curr['predicted_power'] - baseline['predicted_power'], 2)
            if baseline['predicted_power'] != 0:
                diff_item['diff_percent'] = round(
                    (curr['predicted_power'] - baseline['predicted_power']) / abs(baseline['predicted_power']) * 100, 2
                )
            
            if abs(diff_item['diff_percent'] or 0) > 5:
                diff_item['has_diff'] = True
        
        if diff_item['status_diff'] or diff_item['is_new']:
            diff_item['has_diff'] = True
        
        diff_items.append(diff_item)
    
    for bl in baseline_results:
        found = False
        for curr in current_results:
            if (curr['station_name'] and curr['station_name'] == bl['station_name']) or curr['record_id'] == bl['record_id']:
                found = True
                break
        if not found:
            diff_items.append({
                'record_id': bl['record_id'],
                'station_name': bl['station_name'],
                'current_power': None,
                'baseline_power': bl['predicted_power'],
                'current_status': 'missing',
                'baseline_status': bl['status'],
                'diff_power': None,
                'diff_percent': None,
                'has_diff': True,
                'is_missing': True,
                'status_diff': True,
            })
    
    diff_count = sum(1 for d in diff_items if d['has_diff'])
    
    diff_summary = {
        'current_count': len(current_results),
        'baseline_count': len(baseline_results),
        'diff_count': diff_count,
        'baseline_file': session['baseline_preview'].get('filename', ''),
    }
    
    return render_template('diff_result.html',
                         diff_summary=diff_summary,
                         diff_items=diff_items)


@app.route('/generate_report')
def generate_report():
    if 'calculated_results' not in session:
        return redirect(url_for('calculate_all'))
    
    records_data = session['records']
    records = [deserialize_record(r) for r in records_data]
    
    results, summary = processor.process_batch(records)
    
    report_path = os.path.join(app.config['UPLOAD_FOLDER'], f"tidal_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.html")
    report_gen.generate_html_report(results, summary, report_path)
    
    return send_file(report_path, as_attachment=True, download_name="潮汐发电功率预测报告.html")


@app.route('/export_csv')
def export_csv():
    if 'calculated_results' not in session:
        return redirect(url_for('calculate_all'))
    
    records_data = session['records']
    records = [deserialize_record(r) for r in records_data]
    
    results, summary = processor.process_batch(records)
    
    csv_path = os.path.join(app.config['UPLOAD_FOLDER'], f"tidal_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv")
    processor.export_to_csv(results, csv_path)
    
    return send_file(csv_path, as_attachment=True, download_name="潮汐发电功率预测结果.csv")


@app.route('/load_sample')
def load_sample():
    samples = create_sample_dataset()
    session['records'] = [serialize_record(r) for r in samples]
    session['import_stats'] = {
        'total_rows': len(samples),
        'imported': len(samples),
        'skipped': 0,
        'source_file': '内置样例数据',
    }
    session['import_warnings'] = []
    return redirect(url_for('preview_data'))


@app.route('/reset')
def reset():
    session.clear()
    return redirect(url_for('upload'))


if __name__ == '__main__':
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    app.run(debug=True, host='0.0.0.0', port=5001)
