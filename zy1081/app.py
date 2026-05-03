import os
import sys
from flask import Flask, jsonify, request, render_template_string, send_file
from flask_cors import CORS
import io
from datetime import datetime

sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from data_parser import DataParser
from metrics_calculator import MetricsCalculator
from rules_engine import RulesEngine, RuleThresholds
from report_exporter import ReportExporter

app = Flask(__name__)
CORS(app)

DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')

_global_data = None
_global_metrics = None
_global_rules_result = None
_global_thresholds = RuleThresholds()


def _load_and_process_data():
    global _global_data, _global_metrics, _global_rules_result
    
    parser = DataParser(DATA_DIR)
    validation_results = parser.load_all_data()
    raw_data = parser.get_all_data()
    
    calculator = MetricsCalculator(raw_data)
    metrics = calculator.get_all_metrics()
    
    rules_engine = RulesEngine(metrics, _global_thresholds)
    rules_result = rules_engine.run_all_rules()
    
    _global_data = {
        'raw': raw_data,
        'validation': validation_results
    }
    _global_metrics = metrics
    _global_rules_result = rules_result
    
    return {
        'validation': raw_data.get('validation_results', {}),
        'metrics': metrics,
        'rules': rules_result
    }


@app.route('/')
def index():
    return send_file(os.path.join('static', 'index.html'))


@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'data_loaded': _global_data is not None
    })


@app.route('/api/data/load', methods=['POST'])
def load_data():
    try:
        result = _load_and_process_data()
        return jsonify({
            'success': True,
            'message': '数据加载成功',
            'data': result
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'数据加载失败: {str(e)}'
        }), 500


@app.route('/api/data/status', methods=['GET'])
def get_data_status():
    if _global_data is None:
        return jsonify({
            'loaded': False,
            'message': '数据尚未加载'
        })
    
    return jsonify({
        'loaded': True,
        'validation': _global_data.get('raw', {}).get('validation_results', {}),
        'stats': {
            'bookings_count': len(_global_data.get('raw', {}).get('bookings', [])),
            'checkins_count': len(_global_data.get('raw', {}).get('checkins', [])),
            'complaints_count': len(_global_data.get('raw', {}).get('complaints', [])),
            'seats_count': len(_global_data.get('raw', {}).get('seats_config', {}).get('seats', []))
        }
    })


@app.route('/api/metrics/overview', methods=['GET'])
def get_overview_metrics():
    if _global_metrics is None:
        return jsonify({
            'success': False,
            'message': '请先加载数据'
        }), 400
    
    return jsonify({
        'success': True,
        'data': _global_metrics.get('overall', {})
    })


@app.route('/api/metrics/by-zone', methods=['GET'])
def get_zone_metrics():
    if _global_metrics is None:
        return jsonify({
            'success': False,
            'message': '请先加载数据'
        }), 400
    
    return jsonify({
        'success': True,
        'data': _global_metrics.get('by_zone', {})
    })


@app.route('/api/metrics/by-time-slot', methods=['GET'])
def get_time_slot_metrics():
    if _global_metrics is None:
        return jsonify({
            'success': False,
            'message': '请先加载数据'
        }), 400
    
    return jsonify({
        'success': True,
        'data': _global_metrics.get('by_time_slot', {})
    })


@app.route('/api/metrics/by-member', methods=['GET'])
def get_member_metrics():
    if _global_metrics is None:
        return jsonify({
            'success': False,
            'message': '请先加载数据'
        }), 400
    
    member_type = request.args.get('type', 'all')
    members = _global_metrics.get('by_member', {})
    
    if member_type == 'high_risk':
        high_risk = []
        for member_id, member in members.items():
            if (member['no_show_rate'] >= _global_thresholds.high_no_show_rate or
                member['late_rate'] >= _global_thresholds.high_late_rate or
                member['complaints_about'] >= _global_thresholds.member_complaints_about):
                high_risk.append({member_id: member})
        return jsonify({
            'success': True,
            'data': high_risk
        })
    
    return jsonify({
        'success': True,
        'data': members
    })


@app.route('/api/metrics/heatmap', methods=['GET'])
def get_heatmap():
    if _global_metrics is None:
        return jsonify({
            'success': False,
            'message': '请先加载数据'
        }), 400
    
    return jsonify({
        'success': True,
        'data': _global_metrics.get('seat_heatmap', {})
    })


@app.route('/api/metrics/daily-trend', methods=['GET'])
def get_daily_trend():
    if _global_metrics is None:
        return jsonify({
            'success': False,
            'message': '请先加载数据'
        }), 400
    
    return jsonify({
        'success': True,
        'data': _global_metrics.get('daily_trend', [])
    })


@app.route('/api/rules/thresholds', methods=['GET', 'PUT'])
def thresholds():
    global _global_thresholds
    
    if request.method == 'GET':
        return jsonify({
            'success': True,
            'data': _global_thresholds.to_dict()
        })
    
    if request.method == 'PUT':
        try:
            data = request.get_json()
            _global_thresholds = RuleThresholds.from_dict(data)
            
            if _global_metrics is not None:
                rules_engine = RulesEngine(_global_metrics, _global_thresholds)
                global _global_rules_result
                _global_rules_result = rules_engine.run_all_rules()
            
            return jsonify({
                'success': True,
                'message': '阈值更新成功',
                'data': _global_thresholds.to_dict()
            })
        except Exception as e:
            return jsonify({
                'success': False,
                'message': f'更新失败: {str(e)}'
            }), 400


@app.route('/api/rules/analysis', methods=['GET'])
def get_rules_analysis():
    if _global_rules_result is None:
        return jsonify({
            'success': False,
            'message': '请先加载数据'
        }), 400
    
    risk_level = request.args.get('level', 'all')
    risk_items = _global_rules_result.get('risk_items', [])
    
    if risk_level != 'all':
        risk_items = [r for r in risk_items if r.get('risk_level') == risk_level]
    
    return jsonify({
        'success': True,
        'data': {
            'summary': _global_rules_result.get('summary', {}),
            'risk_items': risk_items,
            'suggestions': _global_rules_result.get('suggestions', [])
        }
    })


@app.route('/api/rules/simulate', methods=['POST'])
def simulate_adjustment():
    if _global_metrics is None:
        return jsonify({
            'success': False,
            'message': '请先加载数据'
        }), 400
    
    try:
        data = request.get_json()
        adjustment_type = data.get('adjustment_type')
        params = data.get('params', {})
        
        rules_engine = RulesEngine(_global_metrics, _global_thresholds)
        simulation = rules_engine.simulate_adjustment(adjustment_type, params)
        
        return jsonify({
            'success': True,
            'data': simulation
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'模拟失败: {str(e)}'
        }), 400


@app.route('/api/report/export', methods=['POST'])
def export_report():
    if _global_data is None or _global_metrics is None or _global_rules_result is None:
        return jsonify({
            'success': False,
            'message': '请先加载数据'
        }), 400
    
    try:
        data = request.get_json() or {}
        format_type = data.get('format', 'json')
        
        validation_results = _global_data.get('raw', {}).get('validation_results', {})
        
        exporter = ReportExporter(
            validation_results=validation_results,
            metrics=_global_metrics,
            rules_result=_global_rules_result
        )
        
        if format_type == 'json':
            report_content = exporter.export_json()
            return jsonify({
                'success': True,
                'format': 'json',
                'content': json.loads(report_content)
            })
        
        elif format_type == 'markdown':
            report_content = exporter.export_markdown()
            return jsonify({
                'success': True,
                'format': 'markdown',
                'content': report_content
            })
        
        elif format_type == 'html':
            report_content = exporter.export_html()
            return jsonify({
                'success': True,
                'format': 'html',
                'content': report_content
            })
        
        else:
            return jsonify({
                'success': False,
                'message': f'不支持的格式: {format_type}'
            }), 400
            
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'导出失败: {str(e)}'
        }), 500


@app.route('/api/report/download/<format_type>', methods=['GET'])
def download_report(format_type):
    if _global_data is None or _global_metrics is None or _global_rules_result is None:
        return jsonify({
            'success': False,
            'message': '请先加载数据'
        }), 400
    
    try:
        validation_results = _global_data.get('raw', {}).get('validation_results', {})
        
        exporter = ReportExporter(
            validation_results=validation_results,
            metrics=_global_metrics,
            rules_result=_global_rules_result
        )
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        
        if format_type == 'json':
            content = exporter.export_json()
            filename = f'study_room_report_{timestamp}.json'
            mimetype = 'application/json'
        elif format_type == 'markdown':
            content = exporter.export_markdown()
            filename = f'study_room_report_{timestamp}.md'
            mimetype = 'text/markdown'
        elif format_type == 'html':
            content = exporter.export_html()
            filename = f'study_room_report_{timestamp}.html'
            mimetype = 'text/html'
        else:
            return jsonify({
                'success': False,
                'message': f'不支持的格式: {format_type}'
            }), 400
        
        buf = io.BytesIO()
        buf.write(content.encode('utf-8'))
        buf.seek(0)
        
        return send_file(
            buf,
            mimetype=mimetype,
            as_attachment=True,
            download_name=filename
        )
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'下载失败: {str(e)}'
        }), 500


@app.route('/api/all', methods=['GET'])
def get_all_data():
    if _global_data is None:
        return jsonify({
            'success': False,
            'message': '请先加载数据'
        }), 400
    
    return jsonify({
        'success': True,
        'data': {
            'validation': _global_data.get('raw', {}).get('validation_results', {}),
            'metrics': _global_metrics,
            'rules': _global_rules_result
        }
    })


if __name__ == '__main__':
    print('正在加载示例数据...')
    try:
        _load_and_process_data()
        print('数据加载成功!')
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f'数据加载失败: {e}')
    
    print('启动服务器...')
    print('请在浏览器中访问: http://localhost:5001')
    app.run(debug=True, host='0.0.0.0', port=5001)
