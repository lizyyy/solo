import os
import uuid
import csv
from datetime import datetime, date
from flask import Flask, request, jsonify, send_file, render_template
from flask_cors import CORS
from werkzeug.utils import secure_filename
from config import Config
from models import db, InspectionBatch, Point, TemperatureRecord, DeviceLog, Photo, RiskRecord, ReviewRecord
from risk_analyzer import RiskAnalyzer

app = Flask(__name__)
app.config.from_object(Config)
CORS(app)
db.init_app(app)

with app.app_context():
    db.create_all()

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_EXTENSIONS']

def parse_date(date_str):
    if not date_str:
        return None
    formats = ['%Y-%m-%d', '%Y/%m/%d', '%d-%m-%Y', '%d/%m/%Y', '%Y%m%d']
    for fmt in formats:
        try:
            return datetime.strptime(date_str.strip(), fmt).date()
        except ValueError:
            continue
    return None

def parse_datetime(dt_str):
    if not dt_str:
        return None
    formats = [
        '%Y-%m-%d %H:%M:%S', '%Y-%m-%d %H:%M',
        '%Y/%m/%d %H:%M:%S', '%Y/%m/%d %H:%M',
        '%Y%m%d %H:%M:%S', '%Y-%m-%dT%H:%M:%S'
    ]
    for fmt in formats:
        try:
            return datetime.strptime(dt_str.strip(), fmt)
        except ValueError:
            continue
    return None

def parse_float(value):
    if value is None or value == '':
        return None
    try:
        return float(value)
    except ValueError:
        return None

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/batches', methods=['GET'])
def get_batches():
    batches = InspectionBatch.query.order_by(InspectionBatch.inspection_date.desc()).all()
    return jsonify([b.to_dict() for b in batches])

@app.route('/api/batches', methods=['POST'])
def create_batch():
    data = request.json
    try:
        inspection_date = parse_date(data.get('inspection_date')) or date.today()
        batch = InspectionBatch(
            batch_name=data.get('batch_name', f'巡检批次_{inspection_date.strftime("%Y%m%d")}'),
            inspection_date=inspection_date,
            inspector=data.get('inspector'),
            weather=data.get('weather'),
            notes=data.get('notes')
        )
        db.session.add(batch)
        db.session.commit()
        return jsonify(batch.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400

@app.route('/api/batches/<int:batch_id>', methods=['GET'])
def get_batch(batch_id):
    batch = InspectionBatch.query.get_or_404(batch_id)
    return jsonify(batch.to_dict())

@app.route('/api/batches/<int:batch_id>', methods=['DELETE'])
def delete_batch(batch_id):
    batch = InspectionBatch.query.get_or_404(batch_id)
    try:
        db.session.delete(batch)
        db.session.commit()
        return jsonify({'message': '批次已删除'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400

@app.route('/api/batches/<int:batch_id>/import/csv', methods=['POST'])
def import_temperature_csv(batch_id):
    batch = InspectionBatch.query.get_or_404(batch_id)
    
    if 'file' not in request.files:
        return jsonify({'error': '没有上传文件'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': '没有选择文件'}), 400
    
    if not (file and allowed_file(file.filename) and file.filename.lower().endswith('.csv')):
        return jsonify({'error': '文件类型不支持，请上传CSV文件'}), 400
    
    try:
        content = file.read().decode('utf-8-sig')
        lines = content.splitlines()
        if not lines:
            return jsonify({'error': 'CSV文件为空'}), 400
        
        import_count = 0
        header_row = None
        
        reader = csv.DictReader(lines)
        fieldnames = reader.fieldnames
        
        for row in reader:
            point_code = row.get('点位代码') or row.get('point_code') or row.get('point_code')
            if not point_code:
                point_code = row.get('code') or row.get('编号') or ''
            
            if not point_code:
                continue
            
            point = Point.query.filter_by(batch_id=batch_id, point_code=point_code).first()
            if not point:
                point = Point(
                    batch_id=batch_id,
                    point_code=point_code,
                    point_name=row.get('点位名称') or row.get('point_name') or row.get('name'),
                    point_type=row.get('点位类型') or row.get('point_type') or row.get('type'),
                    location=row.get('位置') or row.get('location'),
                    section=row.get('区域') or row.get('section') or row.get('area'),
                    x_coordinate=parse_float(row.get('X坐标') or row.get('x_coordinate') or row.get('x')),
                    y_coordinate=parse_float(row.get('Y坐标') or row.get('y_coordinate') or row.get('y')),
                    description=row.get('描述') or row.get('description')
                )
                db.session.add(point)
                db.session.flush()
            
            temp_value = parse_float(row.get('温度') or row.get('temperature') or row.get('temp') or row.get('当前温度'))
            if temp_value is not None:
                record_time = parse_datetime(row.get('时间') or row.get('record_time') or row.get('time')) or datetime.now()
                temp_record = TemperatureRecord(
                    batch_id=batch_id,
                    point_id=point.id,
                    record_time=record_time,
                    temperature=temp_value,
                    ambient_temperature=parse_float(row.get('环境温度') or row.get('ambient_temperature') or row.get('ambient')),
                    max_temperature=parse_float(row.get('最高温度') or row.get('max_temperature') or row.get('max_temp')),
                    min_temperature=parse_float(row.get('最低温度') or row.get('min_temperature') or row.get('min_temp')),
                    temperature_difference=parse_float(row.get('温差') or row.get('temperature_difference') or row.get('diff')),
                    emissivity=parse_float(row.get('发射率') or row.get('emissivity')),
                    distance=parse_float(row.get('距离') or row.get('distance')),
                    notes=row.get('备注') or row.get('notes')
                )
                db.session.add(temp_record)
                import_count += 1
        
        db.session.commit()
        return jsonify({
            'message': f'成功导入 {import_count} 条温度记录',
            'import_count': import_count
        }), 200
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'导入失败: {str(e)}'}), 500

@app.route('/api/batches/<int:batch_id>/import/logs', methods=['POST'])
def import_device_logs(batch_id):
    batch = InspectionBatch.query.get_or_404(batch_id)
    
    if 'file' not in request.files:
        return jsonify({'error': '没有上传文件'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': '没有选择文件'}), 400
    
    try:
        content = file.read().decode('utf-8-sig')
        lines = content.splitlines()
        
        import_count = 0
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            parts = line.split('\t') if '\t' in line else line.split(',')
            
            if len(parts) >= 3:
                log_time = parse_datetime(parts[0]) or datetime.now()
                device_code = parts[1].strip() if len(parts) > 1 else ''
                log_level = parts[2].strip().upper() if len(parts) > 2 else 'INFO'
                message = parts[3].strip() if len(parts) > 3 else ' '.join(parts[2:])
                
                is_alert = log_level in ['ERROR', 'WARN', 'WARNING', 'ALERT', 'CRITICAL']
                
                device_log = DeviceLog(
                    batch_id=batch_id,
                    log_time=log_time,
                    device_code=device_code,
                    device_name=f'设备_{device_code}',
                    log_level=log_level,
                    message=message,
                    is_alert=is_alert,
                    is_closed=False
                )
                db.session.add(device_log)
                import_count += 1
        
        db.session.commit()
        return jsonify({
            'message': f'成功导入 {import_count} 条设备日志',
            'import_count': import_count
        }), 200
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'导入失败: {str(e)}'}), 500

@app.route('/api/batches/<int:batch_id>/import/photos', methods=['POST'])
def upload_photos(batch_id):
    batch = InspectionBatch.query.get_or_404(batch_id)
    
    if 'files' not in request.files:
        return jsonify({'error': '没有上传文件'}), 400
    
    files = request.files.getlist('files')
    if not files or files[0].filename == '':
        return jsonify({'error': '没有选择文件'}), 400
    
    import_count = 0
    errors = []
    
    for file in files:
        if file and allowed_file(file.filename):
            original_name = secure_filename(file.filename)
            ext = os.path.splitext(original_name)[1]
            filename = f"{uuid.uuid4().hex}{ext}"
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            
            try:
                point_code = request.form.get('point_code') or ''
                point = None
                if point_code:
                    point = Point.query.filter_by(batch_id=batch_id, point_code=point_code).first()
                
                file.save(file_path)
                
                photo = Photo(
                    batch_id=batch_id,
                    point_id=point.id if point else None,
                    filename=filename,
                    original_name=original_name,
                    file_path=file_path,
                    photo_type=request.form.get('photo_type') or '现场照片',
                    notes=request.form.get('notes')
                )
                db.session.add(photo)
                import_count += 1
            
            except Exception as e:
                errors.append(f'{original_name}: {str(e)}')
                if os.path.exists(file_path):
                    os.remove(file_path)
    
    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'保存失败: {str(e)}'}), 500
    
    result = {'import_count': import_count}
    if errors:
        result['errors'] = errors
        result['message'] = f'成功导入 {import_count} 张照片，{len(errors)} 个失败'
    else:
        result['message'] = f'成功导入 {import_count} 张照片'
    
    return jsonify(result), 200

@app.route('/api/points', methods=['GET'])
def get_points():
    batch_id = request.args.get('batch_id', type=int)
    query = Point.query
    if batch_id:
        query = query.filter_by(batch_id=batch_id)
    points = query.all()
    return jsonify([p.to_dict() for p in points])

@app.route('/api/points/<int:point_id>', methods=['GET'])
def get_point(point_id):
    point = Point.query.get_or_404(point_id)
    return jsonify(point.to_dict())

@app.route('/api/points/<int:point_id>/temperatures', methods=['GET'])
def get_point_temperatures(point_id):
    point = Point.query.get_or_404(point_id)
    records = TemperatureRecord.query.filter_by(point_id=point_id).order_by(
        TemperatureRecord.record_time
    ).all()
    return jsonify([r.to_dict() for r in records])

@app.route('/api/points/<int:point_id>/photos', methods=['GET'])
def get_point_photos(point_id):
    point = Point.query.get_or_404(point_id)
    photos = Photo.query.filter_by(point_id=point_id).all()
    return jsonify([p.to_dict() for p in photos])

@app.route('/api/photos/<filename>')
def get_photo(filename):
    photo = Photo.query.filter_by(filename=filename).first_or_404()
    return send_file(photo.file_path)

@app.route('/api/risks', methods=['GET'])
def get_risks():
    batch_id = request.args.get('batch_id', type=int)
    risk_level = request.args.get('risk_level')
    is_closed = request.args.get('is_closed', type=bool)
    
    query = RiskRecord.query.join(Point)
    
    if batch_id:
        query = query.filter(Point.batch_id == batch_id)
    if risk_level:
        query = query.filter(RiskRecord.risk_level == risk_level)
    if is_closed is not None:
        query = query.filter(RiskRecord.is_closed == is_closed)
    
    risks = query.order_by(
        RiskRecord.risk_level.desc(),
        RiskRecord.detected_at.desc()
    ).all()
    
    result = []
    for risk in risks:
        risk_dict = risk.to_dict()
        point = risk.point
        if point:
            risk_dict['point_code'] = point.point_code
            risk_dict['point_name'] = point.point_name
            risk_dict['point_type'] = point.point_type
            risk_dict['batch_id'] = point.batch_id
        result.append(risk_dict)
    
    return jsonify(result)

@app.route('/api/risks/<int:risk_id>', methods=['GET'])
def get_risk(risk_id):
    risk = RiskRecord.query.get_or_404(risk_id)
    risk_dict = risk.to_dict()
    point = risk.point
    if point:
        risk_dict['point'] = point.to_dict()
        temps = TemperatureRecord.query.filter_by(point_id=point.id).order_by(
            TemperatureRecord.record_time
        ).all()
        risk_dict['temperature_history'] = [t.to_dict() for t in temps]
    return jsonify(risk_dict)

@app.route('/api/risks/<int:risk_id>/judge', methods=['POST'])
def judge_risk(risk_id):
    risk = RiskRecord.query.get_or_404(risk_id)
    data = request.json
    
    try:
        risk.manual_judgment = data.get('judgment')
        risk.judgment_notes = data.get('notes')
        risk.judged_by = data.get('judged_by', '系统管理员')
        risk.judged_at = datetime.utcnow()
        
        review = ReviewRecord(
            risk_id=risk.id,
            reviewer=risk.judged_by,
            review_result=risk.manual_judgment,
            review_notes=risk.judgment_notes,
            follow_up_actions=data.get('follow_up_actions'),
            recommended_review_date=parse_date(data.get('recommended_review_date'))
        )
        db.session.add(review)
        db.session.commit()
        
        return jsonify({
            'message': '复核成功',
            'risk': risk.to_dict(),
            'review': review.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400

@app.route('/api/risks/<int:risk_id>/close', methods=['POST'])
def close_risk(risk_id):
    risk = RiskRecord.query.get_or_404(risk_id)
    data = request.json
    
    try:
        risk.is_closed = True
        risk.closed_by = data.get('closed_by', '系统管理员')
        risk.closed_at = datetime.utcnow()
        
        review = ReviewRecord(
            risk_id=risk.id,
            reviewer=risk.closed_by,
            review_result='closed',
            review_notes=data.get('close_reason', '风险已闭环')
        )
        db.session.add(review)
        db.session.commit()
        
        return jsonify({'message': '风险已闭环', 'risk': risk.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400

@app.route('/api/reviews', methods=['GET'])
def get_reviews():
    risk_id = request.args.get('risk_id', type=int)
    query = ReviewRecord.query
    if risk_id:
        query = query.filter_by(risk_id=risk_id)
    reviews = query.order_by(ReviewRecord.review_time.desc()).all()
    return jsonify([r.to_dict() for r in reviews])

@app.route('/api/batches/<int:batch_id>/analyze', methods=['POST'])
def analyze_batch(batch_id):
    batch = InspectionBatch.query.get_or_404(batch_id)
    
    try:
        result = RiskAnalyzer.run_full_analysis(db, batch_id)
        return jsonify({
            'message': '分析完成',
            'result': result
        }), 200
    except Exception as e:
        return jsonify({'error': f'分析失败: {str(e)}'}), 500

@app.route('/api/export/risk_list/<int:batch_id>', methods=['GET'])
def export_risk_list(batch_id):
    from io import StringIO
    import tempfile
    
    risks = RiskRecord.query.join(Point).filter(
        Point.batch_id == batch_id
    ).order_by(
        RiskRecord.risk_level.desc(),
        RiskRecord.detected_at
    ).all()
    
    output = StringIO()
    writer = csv.writer(output)
    
    writer.writerow([
        '风险ID', '点位代码', '点位名称', '风险类型', '风险等级',
        '描述', '温度值', '检测时间', '人工判定', '是否闭环',
        '判定人', '判定时间'
    ])
    
    for risk in risks:
        point = risk.point
        writer.writerow([
            risk.id,
            point.point_code if point else '',
            point.point_name if point else '',
            risk.risk_type,
            risk.risk_level,
            risk.description,
            risk.temperature_value if risk.temperature_value else '',
            risk.detected_at.strftime('%Y-%m-%d %H:%M:%S') if risk.detected_at else '',
            risk.manual_judgment if risk.manual_judgment else '',
            '是' if risk.is_closed else '否',
            risk.judged_by if risk.judged_by else '',
            risk.judged_at.strftime('%Y-%m-%d %H:%M:%S') if risk.judged_at else ''
        ])
    
    output.seek(0)
    
    temp_file = tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8')
    temp_file.write(output.getvalue())
    temp_file.close()
    
    return send_file(
        temp_file.name,
        as_attachment=True,
        download_name=f'风险清单_{date.today().strftime("%Y%m%d")}.csv',
        mimetype='text/csv'
    )

@app.route('/api/export/report/<int:batch_id>', methods=['GET'])
def export_report(batch_id):
    import tempfile
    
    batch = InspectionBatch.query.get_or_404(batch_id)
    
    points = Point.query.filter_by(batch_id=batch_id).all()
    total_points = len(points)
    
    temp_records = TemperatureRecord.query.join(Point).filter(
        Point.batch_id == batch_id
    ).all()
    total_temps = len(temp_records)
    
    risks = RiskRecord.query.join(Point).filter(
        Point.batch_id == batch_id
    ).order_by(
        RiskRecord.risk_level.desc(),
        RiskRecord.detected_at
    ).all()
    
    high_risks = [r for r in risks if r.risk_level == 'high']
    medium_risks = [r for r in risks if r.risk_level == 'medium']
    closed_risks = [r for r in risks if r.is_closed]
    
    device_logs = DeviceLog.query.filter_by(batch_id=batch_id).all()
    alert_logs = [l for l in device_logs if l.is_alert and not l.is_closed]
    
    report_content = f"""# 热像异常复盘报告

## 一、巡检批次信息

| 项目 | 内容 |
|------|------|
| 批次名称 | {batch.batch_name} |
| 巡检日期 | {batch.inspection_date.strftime('%Y-%m-%d') if batch.inspection_date else '-'} |
| 巡检人员 | {batch.inspector or '-'} |
| 天气情况 | {batch.weather or '-'} |
| 备注 | {batch.notes or '-'} |

## 二、巡检数据概览

| 统计项 | 数量 |
|--------|------|
| 巡检点位 | {total_points} 个 |
| 温度记录 | {total_temps} 条 |
| 设备日志 | {len(device_logs)} 条 |
| 未闭环告警 | {len(alert_logs)} 条 |

## 三、风险分析结果

### 3.1 风险统计

| 风险等级 | 数量 | 已闭环 | 待处理 |
|----------|------|--------|--------|
| 高风险 | {len(high_risks)} | {len([r for r in high_risks if r.is_closed])} | {len([r for r in high_risks if not r.is_closed])} |
| 中风险 | {len(medium_risks)} | {len([r for r in medium_risks if r.is_closed])} | {len([r for r in medium_risks if not r.is_closed])} |
| 低风险 | {len(risks) - len(high_risks) - len(medium_risks)} | {len([r for r in risks if r.risk_level == 'low' and r.is_closed])} | {len([r for r in risks if r.risk_level == 'low' and not r.is_closed])} |

### 3.2 高风险详情

"""
    
    if high_risks:
        for i, risk in enumerate(high_risks, 1):
            point = risk.point
            report_content += f"""#### 高风险 {i}: {risk.risk_type}

- **点位代码**: {point.point_code if point else '-'}
- **点位名称**: {point.point_name if point else '-'}
- **风险等级**: {risk.risk_level}
- **检测时间**: {risk.detected_at.strftime('%Y-%m-%d %H:%M:%S') if risk.detected_at else '-'}
- **温度值**: {risk.temperature_value if risk.temperature_value else '-'} °C
- **描述**: {risk.description or '-'}
- **人工判定**: {risk.manual_judgment or '未判定'}
- **状态**: {'已闭环' if risk.is_closed else '待处理'}

"""
    else:
        report_content += "无高风险项。\n\n"
    
    report_content += """### 3.3 风险类型分布

"""
    
    risk_types = {}
    for risk in risks:
        risk_types[risk.risk_type] = risk_types.get(risk.risk_type, 0) + 1
    
    for risk_type, count in risk_types.items():
        report_content += f"- {risk_type}: {count} 项\n"
    
    report_content += """
## 四、复核记录

"""
    
    reviews = ReviewRecord.query.join(RiskRecord).join(Point).filter(
        Point.batch_id == batch_id
    ).order_by(ReviewRecord.review_time.desc()).all()
    
    if reviews:
        for review in reviews:
            risk = review.risk
            point = risk.point if risk else None
            report_content += f"""### 复核记录 {review.id}

- **复核时间**: {review.review_time.strftime('%Y-%m-%d %H:%M:%S') if review.review_time else '-'}
- **复核人**: {review.reviewer or '-'}
- **点位**: {point.point_code if point else '-'}
- **复核结果**: {review.review_result or '-'}
- **复核备注**: {review.review_notes or '-'}
- **跟进措施**: {review.follow_up_actions or '-'}
- **建议复查日期**: {review.recommended_review_date.strftime('%Y-%m-%d') if review.recommended_review_date else '-'}

"""
    else:
        report_content += "暂无复核记录。\n"
    
    report_content += f"""
---

**报告生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

**说明**: 本报告基于热像异常复盘系统自动生成，风险等级判定规则如下：
- 高风险: 温度 >= 70°C 或 温升突变 >= 15°C 或 设备告警未闭环
- 中风险: 温度 >= 55°C 或 连续3天高温 或 重复点位
- 低风险: 其他异常情况
"""
    
    temp_file = tempfile.NamedTemporaryFile(mode='w', suffix='.md', delete=False, encoding='utf-8')
    temp_file.write(report_content)
    temp_file.close()
    
    return send_file(
        temp_file.name,
        as_attachment=True,
        download_name=f'复盘报告_{batch.batch_name}_{date.today().strftime("%Y%m%d")}.md',
        mimetype='text/markdown'
    )

@app.route('/api/stats/<int:batch_id>', methods=['GET'])
def get_stats(batch_id):
    batch = InspectionBatch.query.get_or_404(batch_id)
    
    points = Point.query.filter_by(batch_id=batch_id).all()
    total_points = len(points)
    
    temp_records = TemperatureRecord.query.join(Point).filter(
        Point.batch_id == batch_id
    ).all()
    
    temps = [r.temperature for r in temp_records if r.temperature is not None]
    avg_temp = sum(temps) / len(temps) if temps else 0
    max_temp = max(temps) if temps else 0
    min_temp = min(temps) if temps else 0
    
    risks = RiskRecord.query.join(Point).filter(
        Point.batch_id == batch_id
    ).all()
    
    high_risks = len([r for r in risks if r.risk_level == 'high' and not r.is_closed])
    medium_risks = len([r for r in risks if r.risk_level == 'medium' and not r.is_closed])
    closed_risks = len([r for r in risks if r.is_closed])
    
    device_logs = DeviceLog.query.filter_by(batch_id=batch_id).all()
    alert_logs = len([l for l in device_logs if l.is_alert and not l.is_closed])
    
    photos = Photo.query.filter_by(batch_id=batch_id).all()
    
    return jsonify({
        'batch': batch.to_dict(),
        'points': {
            'total': total_points
        },
        'temperatures': {
            'total_records': len(temp_records),
            'average': round(avg_temp, 2),
            'max': round(max_temp, 2),
            'min': round(min_temp, 2)
        },
        'risks': {
            'total': len(risks),
            'high_pending': high_risks,
            'medium_pending': medium_risks,
            'closed': closed_risks
        },
        'logs': {
            'total': len(device_logs),
            'open_alerts': alert_logs
        },
        'photos': {
            'total': len(photos)
        }
    })

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True, host='0.0.0.0', port=8080)
