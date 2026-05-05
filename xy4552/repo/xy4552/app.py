import os
from flask import Flask, request, jsonify, send_file
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from datetime import datetime
import pandas as pd
import numpy as np
import json
import io

app = Flask(__name__)
CORS(app)

basedir = os.path.abspath(os.path.dirname(__file__))
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(basedir, 'cow.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)


class Cow(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    cow_number = db.Column(db.String(20), unique=True, nullable=False)
    group = db.Column(db.String(50))
    notes = db.Column(db.Text)
    
    milk_records = db.relationship('MilkRecord', backref='cow', lazy=True)
    somatic_records = db.relationship('SomaticRecord', backref='cow', lazy=True)


class MilkRecord(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    cow_id = db.Column(db.Integer, db.ForeignKey('cow.id'), nullable=False)
    date = db.Column(db.Date, nullable=False)
    milk_yield = db.Column(db.Float)
    tank_number = db.Column(db.String(20))
    milking_time = db.Column(db.String(20))
    pump_pressure = db.Column(db.Float)


class SomaticRecord(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    cow_id = db.Column(db.Integer, db.ForeignKey('cow.id'), nullable=False)
    date = db.Column(db.Date, nullable=False)
    somatic_count = db.Column(db.Integer)
    test_type = db.Column(db.String(50))


class VetNote(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    cow_number = db.Column(db.String(20), nullable=False)
    date = db.Column(db.Date, nullable=False)
    note = db.Column(db.Text, nullable=False)


class DetectionResult(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    cow_number = db.Column(db.String(20), nullable=False)
    date = db.Column(db.Date, nullable=False)
    detection_type = db.Column(db.String(50), nullable=False)
    severity = db.Column(db.String(20))
    evidence = db.Column(db.Text)
    status = db.Column(db.String(20), default='pending')
    human_verdict = db.Column(db.String(20))
    human_note = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


with app.app_context():
    db.create_all()


class AnomalyDetector:
    def __init__(self):
        self.somatic_threshold_high = 400000
        self.somatic_threshold_critical = 1000000
        self.yield_drop_threshold = 0.3
        self.pump_normal_min = 40
        self.pump_normal_max = 50
    
    def detect_mastitis(self, cow_records, somatic_records):
        results = []
        
        if somatic_records:
            latest = max(somatic_records, key=lambda x: x.date)
            if latest.somatic_count >= self.somatic_threshold_critical:
                results.append({
                    'type': 'mastitis',
                    'severity': 'critical',
                    'evidence': f'体细胞计数过高: {latest.somatic_count} (阈值: {self.somatic_threshold_critical})，检测日期: {latest.date}'
                })
            elif latest.somatic_count >= self.somatic_threshold_high:
                results.append({
                    'type': 'mastitis',
                    'severity': 'warning',
                    'evidence': f'体细胞计数偏高: {latest.somatic_count} (阈值: {self.somatic_threshold_high})，检测日期: {latest.date}'
                })
        
        if len(cow_records) >= 2:
            sorted_records = sorted(cow_records, key=lambda x: x.date, reverse=True)
            latest = sorted_records[0]
            previous = sorted_records[1]
            
            if previous.milk_yield > 0:
                drop_ratio = (previous.milk_yield - latest.milk_yield) / previous.milk_yield
                if drop_ratio >= self.yield_drop_threshold:
                    results.append({
                        'type': 'mastitis',
                        'severity': 'warning',
                        'evidence': f'产奶量骤降: 昨日{previous.milk_yield}kg → 今日{latest.milk_yield}kg，下降{drop_ratio*100:.1f}%'
                    })
        
        return results
    
    def detect_pump_anomaly(self, milk_records):
        results = []
        
        for record in milk_records:
            if record.pump_pressure is not None:
                if record.pump_pressure < self.pump_normal_min:
                    results.append({
                        'type': 'pump_anomaly',
                        'severity': 'warning',
                        'evidence': f'真空泵压力过低: {record.pump_pressure}kPa (正常范围: {self.pump_normal_min}-{self.pump_normal_max})，日期: {record.date}'
                    })
                elif record.pump_pressure > self.pump_normal_max:
                    results.append({
                        'type': 'pump_anomaly',
                        'severity': 'warning',
                        'evidence': f'真空泵压力过高: {record.pump_pressure}kPa (正常范围: {self.pump_normal_min}-{self.pump_normal_max})，日期: {record.date}'
                    })
        
        return results
    
    def detect_milk_mixing_risk(self, all_milk_records, somatic_records):
        results = []
        
        high_somatic_cows = set()
        for sr in somatic_records:
            if sr.somatic_count and sr.somatic_count >= self.somatic_threshold_high:
                high_somatic_cows.add(sr.cow_id)
        
        tank_groups = {}
        for record in all_milk_records:
            if record.tank_number:
                if record.tank_number not in tank_groups:
                    tank_groups[record.tank_number] = []
                tank_groups[record.tank_number].append(record)
        
        for tank, records in tank_groups.items():
            has_high_somatic = any(r.cow_id in high_somatic_cows for r in records)
            if has_high_somatic and len(records) > 1:
                high_cows = [r.cow.cow_number for r in records if r.cow_id in high_somatic_cows]
                results.append({
                    'type': 'milk_mixing_risk',
                    'severity': 'warning',
                    'evidence': f'奶罐{tank}存在混奶风险: 体细胞偏高的牛{high_cows}与其他牛混装，建议单独处理'
                })
        
        return results
    
    def detect_retest_needed(self, somatic_records):
        results = []
        
        if not somatic_records:
            return results
        
        latest = max(somatic_records, key=lambda x: x.date)
        if latest.somatic_count and self.somatic_threshold_high <= latest.somatic_count < self.somatic_threshold_critical:
            results.append({
                'type': 'retest_needed',
                'severity': 'info',
                'evidence': f'建议复检: 体细胞计数{latest.somatic_count}处于临界范围，建议3日内复查，检测日期: {latest.date}'
            })
        
        return results


detector = AnomalyDetector()


@app.route('/api/import/cows', methods=['POST'])
def import_cows():
    if 'file' not in request.files:
        return jsonify({'error': '没有文件'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': '没有选择文件'}), 400
    
    try:
        df = pd.read_csv(file)
        for _, row in df.iterrows():
            cow = Cow.query.filter_by(cow_number=str(row['牛号'])).first()
            if not cow:
                cow = Cow(
                    cow_number=str(row['牛号']),
                    group=row.get('分栏'),
                    notes=row.get('备注')
                )
                db.session.add(cow)
            else:
                if pd.notna(row.get('分栏')):
                    cow.group = row.get('分栏')
                if pd.notna(row.get('备注')):
                    cow.notes = row.get('备注')
        
        db.session.commit()
        return jsonify({'message': f'成功导入 {len(df)} 条牛群分栏记录'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/import/milk', methods=['POST'])
def import_milk():
    if 'file' not in request.files:
        return jsonify({'error': '没有文件'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': '没有选择文件'}), 400
    
    try:
        df = pd.read_csv(file)
        count = 0
        for _, row in df.iterrows():
            cow = Cow.query.filter_by(cow_number=str(row['牛号'])).first()
            if not cow:
                cow = Cow(cow_number=str(row['牛号']))
                db.session.add(cow)
                db.session.flush()
            
            date = pd.to_datetime(row['日期']).date()
            existing = MilkRecord.query.filter_by(cow_id=cow.id, date=date).first()
            
            if not existing:
                record = MilkRecord(
                    cow_id=cow.id,
                    date=date,
                    milk_yield=float(row['产奶量(kg)']) if pd.notna(row.get('产奶量(kg)')) else None,
                    tank_number=str(row.get('奶罐号')) if pd.notna(row.get('奶罐号')) else None,
                    milking_time=str(row.get('挤奶时间')) if pd.notna(row.get('挤奶时间')) else None,
                    pump_pressure=float(row['真空泵压力(kPa)']) if pd.notna(row.get('真空泵压力(kPa)')) else None
                )
                db.session.add(record)
                count += 1
        
        db.session.commit()
        return jsonify({'message': f'成功导入 {count} 条产奶量记录'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/import/somatic', methods=['POST'])
def import_somatic():
    if 'file' not in request.files:
        return jsonify({'error': '没有文件'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': '没有选择文件'}), 400
    
    try:
        df = pd.read_csv(file)
        count = 0
        for _, row in df.iterrows():
            cow = Cow.query.filter_by(cow_number=str(row['牛号'])).first()
            if not cow:
                cow = Cow(cow_number=str(row['牛号']))
                db.session.add(cow)
                db.session.flush()
            
            date = pd.to_datetime(row['日期']).date()
            existing = SomaticRecord.query.filter_by(cow_id=cow.id, date=date).first()
            
            if not existing:
                record = SomaticRecord(
                    cow_id=cow.id,
                    date=date,
                    somatic_count=int(row['体细胞计数']) if pd.notna(row.get('体细胞计数')) else None,
                    test_type=str(row.get('检测类型')) if pd.notna(row.get('检测类型')) else None
                )
                db.session.add(record)
                count += 1
        
        db.session.commit()
        return jsonify({'message': f'成功导入 {count} 条体细胞记录'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/import/vet-notes', methods=['POST'])
def import_vet_notes():
    if 'file' not in request.files:
        return jsonify({'error': '没有文件'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': '没有选择文件'}), 400
    
    try:
        df = pd.read_csv(file)
        count = 0
        for _, row in df.iterrows():
            cow = Cow.query.filter_by(cow_number=str(row['牛号'])).first()
            if not cow:
                cow = Cow(cow_number=str(row['牛号']))
                db.session.add(cow)
                db.session.flush()
            
            date = pd.to_datetime(row['日期']).date()
            note = VetNote(
                cow_number=str(row['牛号']),
                date=date,
                note=str(row.get('备注', ''))
            )
            db.session.add(note)
            count += 1
        
        db.session.commit()
        return jsonify({'message': f'成功导入 {count} 条兽医备注'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/detect', methods=['POST'])
def run_detection():
    try:
        cows = Cow.query.all()
        all_milk_records = MilkRecord.query.all()
        all_somatic_records = SomaticRecord.query.all()
        
        results = []
        
        for cow in cows:
            cow_milk = [r for r in all_milk_records if r.cow_id == cow.id]
            cow_somatic = [r for r in all_somatic_records if r.cow_id == cow.id]
            
            mastitis = detector.detect_mastitis(cow_milk, cow_somatic)
            pump = detector.detect_pump_anomaly(cow_milk)
            retest = detector.detect_retest_needed(cow_somatic)
            
            for r in mastitis + pump + retest:
                existing = DetectionResult.query.filter_by(
                    cow_number=cow.cow_number,
                    detection_type=r['type'],
                    date=datetime.today().date()
                ).first()
                
                if not existing:
                    result = DetectionResult(
                        cow_number=cow.cow_number,
                        date=datetime.today().date(),
                        detection_type=r['type'],
                        severity=r['severity'],
                        evidence=r['evidence'],
                        status='pending'
                    )
                    db.session.add(result)
                    results.append(result)
        
        mixing_risk = detector.detect_milk_mixing_risk(all_milk_records, all_somatic_records)
        for r in mixing_risk:
            existing = DetectionResult.query.filter_by(
                cow_number='TANK_CHECK',
                detection_type=r['type'],
                date=datetime.today().date()
            ).first()
            
            if not existing:
                result = DetectionResult(
                    cow_number='TANK_CHECK',
                    date=datetime.today().date(),
                    detection_type=r['type'],
                    severity=r['severity'],
                    evidence=r['evidence'],
                    status='pending'
                )
                db.session.add(result)
                results.append(result)
        
        db.session.commit()
        return jsonify({'message': f'检测完成，发现 {len(results)} 个异常'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/results', methods=['GET'])
def get_results():
    results = DetectionResult.query.order_by(DetectionResult.date.desc()).all()
    
    return jsonify([{
        'id': r.id,
        'cow_number': r.cow_number,
        'date': str(r.date),
        'detection_type': r.detection_type,
        'severity': r.severity,
        'evidence': r.evidence,
        'status': r.status,
        'human_verdict': r.human_verdict,
        'human_note': r.human_note
    } for r in results])


@app.route('/api/results/<int:result_id>', methods=['PUT'])
def update_result(result_id):
    result = DetectionResult.query.get_or_404(result_id)
    data = request.json
    
    if 'human_verdict' in data:
        result.human_verdict = data['human_verdict']
    if 'human_note' in data:
        result.human_note = data['human_note']
    if 'status' in data:
        result.status = data['status']
    
    db.session.commit()
    return jsonify({'message': '更新成功'})


@app.route('/api/cows', methods=['GET'])
def get_cows():
    cows = Cow.query.all()
    return jsonify([{
        'id': c.id,
        'cow_number': c.cow_number,
        'group': c.group,
        'notes': c.notes
    } for c in cows])


@app.route('/api/cows/<cow_number>/details', methods=['GET'])
def get_cow_details(cow_number):
    cow = Cow.query.filter_by(cow_number=cow_number).first()
    if not cow:
        return jsonify({'error': '牛号不存在'}), 404
    
    milk_records = MilkRecord.query.filter_by(cow_id=cow.id).order_by(MilkRecord.date.desc()).all()
    somatic_records = SomaticRecord.query.filter_by(cow_id=cow.id).order_by(SomaticRecord.date.desc()).all()
    vet_notes = VetNote.query.filter_by(cow_number=cow_number).order_by(VetNote.date.desc()).all()
    
    return jsonify({
        'cow': {
            'cow_number': cow.cow_number,
            'group': cow.group,
            'notes': cow.notes
        },
        'milk_records': [{
            'date': str(m.date),
            'milk_yield': m.milk_yield,
            'tank_number': m.tank_number,
            'milking_time': m.milking_time,
            'pump_pressure': m.pump_pressure
        } for m in milk_records],
        'somatic_records': [{
            'date': str(s.date),
            'somatic_count': s.somatic_count,
            'test_type': s.test_type
        } for s in somatic_records],
        'vet_notes': [{
            'date': str(v.date),
            'note': v.note
        } for v in vet_notes]
    })


@app.route('/api/export/markdown', methods=['GET'])
def export_markdown():
    results = DetectionResult.query.order_by(DetectionResult.date.desc()).all()
    
    md = f"""# 早班挤奶交班单
生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

---

## 检测结果汇总

"""
    
    type_names = {
        'mastitis': '疑似乳房炎',
        'pump_anomaly': '真空泵异常',
        'milk_mixing_risk': '混奶风险',
        'retest_needed': '需要复检'
    }
    
    by_type = {}
    for r in results:
        if r.detection_type not in by_type:
            by_type[r.detection_type] = []
        by_type[r.detection_type].append(r)
    
    for dtype, items in by_type.items():
        md += f"### {type_names.get(dtype, dtype)} ({len(items)} 条)\n\n"
        for r in items:
            cow_info = r.cow_number if r.cow_number != 'TANK_CHECK' else '奶罐检查'
            status_map = {
                'pending': '待处理',
                'confirmed': '已确认',
                'dismissed': '已驳回'
            }
            status = status_map.get(r.status, r.status)
            
            md += f"- **{cow_info}** ({r.date})\n"
            md += f"  - 严重程度: {r.severity}\n"
            md += f"  - 证据: {r.evidence}\n"
            md += f"  - 状态: {status}\n"
            if r.human_verdict:
                md += f"  - 人工判定: {r.human_verdict}\n"
            if r.human_note:
                md += f"  - 备注: {r.human_note}\n"
            md += "\n"
    
    output = io.BytesIO(md.encode('utf-8'))
    output.seek(0)
    
    return send_file(
        output,
        mimetype='text/markdown',
        as_attachment=True,
        download_name=f'交班单_{datetime.now().strftime("%Y%m%d")}.md'
    )


@app.route('/api/export/json', methods=['GET'])
def export_json():
    results = DetectionResult.query.order_by(DetectionResult.date.desc()).all()
    
    data = {
        'export_time': datetime.now().isoformat(),
        'results': [{
            'id': r.id,
            'cow_number': r.cow_number,
            'date': str(r.date),
            'detection_type': r.detection_type,
            'severity': r.severity,
            'evidence': r.evidence,
            'status': r.status,
            'human_verdict': r.human_verdict,
            'human_note': r.human_note
        } for r in results]
    }
    
    output = io.BytesIO(json.dumps(data, ensure_ascii=False, indent=2).encode('utf-8'))
    output.seek(0)
    
    return send_file(
        output,
        mimetype='application/json',
        as_attachment=True,
        download_name=f'检测结果_{datetime.now().strftime("%Y%m%d")}.json'
    )


@app.route('/')
def index():
    return send_file('templates/index.html')


if __name__ == '__main__':
    app.run(debug=True, port=5000)
