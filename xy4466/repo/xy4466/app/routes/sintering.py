from flask import request, jsonify
from app.routes import api
from app import db
from app.models import SinteringLog, Case
from datetime import datetime
import json
from app.utils.risk_calculator import calculate_case_risk

@api.route('/sintering', methods=['GET'])
def get_sintering_logs():
    """获取烧结炉日志列表"""
    logs = SinteringLog.query.order_by(SinteringLog.start_time.desc()).all()
    return jsonify([log.to_dict() for log in logs])

@api.route('/sintering/<int:log_id>', methods=['GET'])
def get_sintering_log(log_id):
    """获取单个烧结炉日志详情"""
    log = SinteringLog.query.get_or_404(log_id)
    return jsonify(log.to_dict())

@api.route('/sintering/import', methods=['POST'])
def import_sintering_logs():
    """导入烧结炉温度日志"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No JSON data provided'}), 400
        
        # 支持单个日志或日志数组
        if isinstance(data, dict):
            logs_data = [data]
        elif isinstance(data, list):
            logs_data = data
        else:
            return jsonify({'error': 'Invalid JSON format'}), 400
        
        imported_count = 0
        updated_count = 0
        errors = []
        
        for log_data in logs_data:
            try:
                # 检查必要字段
                required_fields = ['log_number', 'start_time']
                missing_fields = [field for field in required_fields if field not in log_data]
                if missing_fields:
                    errors.append(f"Missing fields: {', '.join(missing_fields)}")
                    continue
                
                # 检查日志是否已存在
                existing_log = SinteringLog.query.filter_by(log_number=log_data['log_number']).first()
                
                # 解析日期
                start_time = datetime.strptime(log_data['start_time'], '%Y-%m-%dT%H:%M:%S')
                end_time = datetime.strptime(log_data['end_time'], '%Y-%m-%dT%H:%M:%S') if log_data.get('end_time') else None
                
                # 计算温度统计
                temperature_data = log_data.get('temperature_data', [])
                if temperature_data:
                    temperatures = [point.get('temperature', 0) for point in temperature_data]
                    max_temp = max(temperatures) if temperatures else None
                    min_temp = min(temperatures) if temperatures else None
                    avg_temp = sum(temperatures) / len(temperatures) if temperatures else None
                else:
                    max_temp = log_data.get('max_temperature')
                    min_temp = log_data.get('min_temperature')
                    avg_temp = log_data.get('avg_temperature')
                
                # 确定状态
                status = 'completed'
                if log_data.get('status'):
                    status = log_data['status']
                elif max_temp:
                    # 简单的温度异常检测
                    if max_temp < 1000 or max_temp > 1100:
                        status = 'warning'
                
                if existing_log:
                    # 更新现有日志
                    existing_log.furnace_id = log_data.get('furnace_id', existing_log.furnace_id)
                    existing_log.start_time = start_time
                    existing_log.end_time = end_time
                    existing_log.max_temperature = max_temp
                    existing_log.min_temperature = min_temp
                    existing_log.avg_temperature = avg_temp
                    existing_log.temperature_data = json.dumps(temperature_data, ensure_ascii=False) if temperature_data else existing_log.temperature_data
                    existing_log.status = status
                    existing_log.notes = log_data.get('notes', existing_log.notes)
                    updated_count += 1
                else:
                    # 创建新日志
                    new_log = SinteringLog(
                        log_number=log_data['log_number'],
                        furnace_id=log_data.get('furnace_id'),
                        start_time=start_time,
                        end_time=end_time,
                        max_temperature=max_temp,
                        min_temperature=min_temp,
                        avg_temperature=avg_temp,
                        temperature_data=json.dumps(temperature_data, ensure_ascii=False) if temperature_data else None,
                        status=status,
                        notes=log_data.get('notes')
                    )
                    db.session.add(new_log)
                    imported_count += 1
                
                # 关联病例并重新计算风险
                if 'case_numbers' in log_data:
                    for case_number in log_data['case_numbers']:
                        case = Case.query.filter_by(case_number=case_number).first()
                        if case:
                            case.sintering_log_id = log_data['log_number']
                            calculate_case_risk(case)
                
            except Exception as e:
                errors.append(f"Error processing log {log_data.get('log_number', 'unknown')}: {str(e)}")
        
        db.session.commit()
        
        return jsonify({
            'message': 'Import completed',
            'imported_count': imported_count,
            'updated_count': updated_count,
            'errors': errors
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@api.route('/sintering/<int:log_id>/cases', methods=['GET'])
def get_sintering_cases(log_id):
    """获取烧结日志关联的所有病例"""
    log = SinteringLog.query.get_or_404(log_id)
    cases = Case.query.filter_by(sintering_log_id=log.log_number).all()
    return jsonify([case.to_dict() for case in cases])
