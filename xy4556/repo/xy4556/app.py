import os
import csv
import json
from datetime import datetime, date
from flask import Flask, request, jsonify, Response
from flask_sqlalchemy import SQLAlchemy
from dateutil import parser as date_parser

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///maintenance.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

class WorkCard(db.Model):
    __tablename__ = 'work_cards'
    
    id = db.Column(db.Integer, primary_key=True)
    card_number = db.Column(db.String(50), unique=True, nullable=False)
    title = db.Column(db.String(200), nullable=False)
    aircraft_registration = db.Column(db.String(20), nullable=False)
    status = db.Column(db.String(20), default='active')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    tool_checkouts = db.relationship('ToolCheckout', backref='work_card', lazy=True)
    reviews = db.relationship('Review', backref='work_card', lazy=True)

class Tool(db.Model):
    __tablename__ = 'tools'
    
    id = db.Column(db.Integer, primary_key=True)
    tool_number = db.Column(db.String(50), unique=True, nullable=False)
    name = db.Column(db.String(100), nullable=False)
    category = db.Column(db.String(50))
    status = db.Column(db.String(20), default='available')
    location = db.Column(db.String(100))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    checkouts = db.relationship('ToolCheckout', backref='tool', lazy=True)
    calibrations = db.relationship('Calibration', backref='tool', lazy=True)

class Calibration(db.Model):
    __tablename__ = 'calibrations'
    
    id = db.Column(db.Integer, primary_key=True)
    tool_id = db.Column(db.Integer, db.ForeignKey('tools.id'), nullable=False)
    certificate_number = db.Column(db.String(50), unique=True, nullable=False)
    calibration_date = db.Column(db.Date, nullable=False)
    expiry_date = db.Column(db.Date, nullable=False)
    status = db.Column(db.String(20), default='valid')
    calibrated_by = db.Column(db.String(100))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Material(db.Model):
    __tablename__ = 'materials'
    
    id = db.Column(db.Integer, primary_key=True)
    part_number = db.Column(db.String(50), nullable=False)
    batch_number = db.Column(db.String(50), nullable=False)
    description = db.Column(db.String(200))
    quantity = db.Column(db.Integer, default=0)
    aircraft_registration = db.Column(db.String(20))
    expiry_date = db.Column(db.Date)
    status = db.Column(db.String(20), default='available')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    __table_args__ = (db.UniqueConstraint('part_number', 'batch_number', name='_part_batch_uc'),)

class ToolCheckout(db.Model):
    __tablename__ = 'tool_checkouts'
    
    id = db.Column(db.Integer, primary_key=True)
    tool_id = db.Column(db.Integer, db.ForeignKey('tools.id'), nullable=False)
    work_card_id = db.Column(db.Integer, db.ForeignKey('work_cards.id'), nullable=False)
    checkout_by = db.Column(db.String(100), nullable=False)
    checkout_time = db.Column(db.DateTime, default=datetime.utcnow)
    return_time = db.Column(db.DateTime)
    return_by = db.Column(db.String(100))
    status = db.Column(db.String(20), default='checked_out')
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Review(db.Model):
    __tablename__ = 'reviews'
    
    id = db.Column(db.Integer, primary_key=True)
    work_card_id = db.Column(db.Integer, db.ForeignKey('work_cards.id'), nullable=False)
    reviewer = db.Column(db.String(100), nullable=False)
    review_time = db.Column(db.DateTime, default=datetime.utcnow)
    risk_level = db.Column(db.String(20), default='low')
    risk_score = db.Column(db.Float, default=0.0)
    status = db.Column(db.String(20), default='pending')
    notes = db.Column(db.Text)
    risk_factors = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

with app.app_context():
    db.create_all()

def parse_date(value):
    if not value or value.strip() == '':
        return None
    try:
        return date_parser.parse(value).date()
    except:
        return None

def parse_datetime(value):
    if not value or value.strip() == '':
        return None
    try:
        return date_parser.parse(value)
    except:
        return None

@app.route('/api/import/csv', methods=['POST'])
def import_csv():
    data = request.get_json()
    if not data or 'file_path' not in data or 'type' not in data:
        return jsonify({'error': 'Missing file_path or type parameter'}), 400
    
    file_path = data['file_path']
    import_type = data['type']
    
    if not os.path.exists(file_path):
        return jsonify({'error': f'File not found: {file_path}'}), 404
    
    imported_count = 0
    errors = []
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            
            for row_num, row in enumerate(reader, start=2):
                try:
                    if import_type == 'work_cards':
                        wc = WorkCard(
                            card_number=row.get('card_number', '').strip(),
                            title=row.get('title', '').strip(),
                            aircraft_registration=row.get('aircraft_registration', '').strip(),
                            status=row.get('status', 'active').strip()
                        )
                        db.session.add(wc)
                    
                    elif import_type == 'tools':
                        tool = Tool(
                            tool_number=row.get('tool_number', '').strip(),
                            name=row.get('name', '').strip(),
                            category=row.get('category', '').strip(),
                            location=row.get('location', '').strip(),
                            status=row.get('status', 'available').strip()
                        )
                        db.session.add(tool)
                    
                    elif import_type == 'calibrations':
                        tool_number = row.get('tool_number', '').strip()
                        tool = Tool.query.filter_by(tool_number=tool_number).first()
                        if not tool:
                            errors.append(f'Row {row_num}: Tool not found: {tool_number}')
                            continue
                        
                        cal = Calibration(
                            tool_id=tool.id,
                            certificate_number=row.get('certificate_number', '').strip(),
                            calibration_date=parse_date(row.get('calibration_date', '')),
                            expiry_date=parse_date(row.get('expiry_date', '')),
                            status=row.get('status', 'valid').strip(),
                            calibrated_by=row.get('calibrated_by', '').strip()
                        )
                        db.session.add(cal)
                    
                    elif import_type == 'materials':
                        mat = Material(
                            part_number=row.get('part_number', '').strip(),
                            batch_number=row.get('batch_number', '').strip(),
                            description=row.get('description', '').strip(),
                            quantity=int(row.get('quantity', 0) or 0),
                            aircraft_registration=row.get('aircraft_registration', '').strip(),
                            expiry_date=parse_date(row.get('expiry_date', '')),
                            status=row.get('status', 'available').strip()
                        )
                        db.session.add(mat)
                    
                    elif import_type == 'checkouts':
                        tool_number = row.get('tool_number', '').strip()
                        card_number = row.get('card_number', '').strip()
                        
                        tool = Tool.query.filter_by(tool_number=tool_number).first()
                        work_card = WorkCard.query.filter_by(card_number=card_number).first()
                        
                        if not tool:
                            errors.append(f'Row {row_num}: Tool not found: {tool_number}')
                            continue
                        if not work_card:
                            errors.append(f'Row {row_num}: Work card not found: {card_number}')
                            continue
                        
                        checkout = ToolCheckout(
                            tool_id=tool.id,
                            work_card_id=work_card.id,
                            checkout_by=row.get('checkout_by', '').strip(),
                            checkout_time=parse_datetime(row.get('checkout_time', '')) or datetime.utcnow(),
                            return_time=parse_datetime(row.get('return_time', '')),
                            return_by=row.get('return_by', '').strip() if row.get('return_by') else None,
                            status=row.get('status', 'checked_out').strip(),
                            notes=row.get('notes', '').strip()
                        )
                        db.session.add(checkout)
                    
                    imported_count += 1
                except Exception as e:
                    errors.append(f'Row {row_num}: {str(e)}')
        
        db.session.commit()
        return jsonify({
            'success': True,
            'imported': imported_count,
            'errors': errors,
            'type': import_type
        })
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/import/json', methods=['POST'])
def import_json():
    data = request.get_json()
    if not data or 'file_path' not in data or 'type' not in data:
        return jsonify({'error': 'Missing file_path or type parameter'}), 400
    
    file_path = data['file_path']
    import_type = data['type']
    
    if not os.path.exists(file_path):
        return jsonify({'error': f'File not found: {file_path}'}), 404
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            json_data = json.load(f)
        
        if not isinstance(json_data, list):
            return jsonify({'error': 'JSON data must be a list'}), 400
        
        imported_count = 0
        errors = []
        
        for item_num, item in enumerate(json_data, start=1):
            try:
                if import_type == 'work_cards':
                    wc = WorkCard(
                        card_number=item.get('card_number', '').strip(),
                        title=item.get('title', '').strip(),
                        aircraft_registration=item.get('aircraft_registration', '').strip(),
                        status=item.get('status', 'active').strip()
                    )
                    db.session.add(wc)
                
                elif import_type == 'tools':
                    tool = Tool(
                        tool_number=item.get('tool_number', '').strip(),
                        name=item.get('name', '').strip(),
                        category=item.get('category', '').strip(),
                        location=item.get('location', '').strip(),
                        status=item.get('status', 'available').strip()
                    )
                    db.session.add(tool)
                
                elif import_type == 'calibrations':
                    tool_number = item.get('tool_number', '').strip()
                    tool = Tool.query.filter_by(tool_number=tool_number).first()
                    if not tool:
                        errors.append(f'Item {item_num}: Tool not found: {tool_number}')
                        continue
                    
                    cal = Calibration(
                        tool_id=tool.id,
                        certificate_number=item.get('certificate_number', '').strip(),
                        calibration_date=parse_date(item.get('calibration_date', '')),
                        expiry_date=parse_date(item.get('expiry_date', '')),
                        status=item.get('status', 'valid').strip(),
                        calibrated_by=item.get('calibrated_by', '').strip()
                    )
                    db.session.add(cal)
                
                elif import_type == 'materials':
                    mat = Material(
                        part_number=item.get('part_number', '').strip(),
                        batch_number=item.get('batch_number', '').strip(),
                        description=item.get('description', '').strip(),
                        quantity=int(item.get('quantity', 0) or 0),
                        aircraft_registration=item.get('aircraft_registration', '').strip(),
                        expiry_date=parse_date(item.get('expiry_date', '')),
                        status=item.get('status', 'available').strip()
                    )
                    db.session.add(mat)
                
                imported_count += 1
            except Exception as e:
                errors.append(f'Item {item_num}: {str(e)}')
        
        db.session.commit()
        return jsonify({
            'success': True,
            'imported': imported_count,
            'errors': errors,
            'type': import_type
        })
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

def is_tool_calibrated(tool_id):
    today = date.today()
    latest_cal = Calibration.query.filter_by(tool_id=tool_id).order_by(Calibration.expiry_date.desc()).first()
    if not latest_cal:
        return False, 'No calibration record'
    if latest_cal.expiry_date < today:
        return False, f'Calibration expired on {latest_cal.expiry_date}'
    if latest_cal.status != 'valid':
        return False, f'Calibration status: {latest_cal.status}'
    return True, 'Calibration valid'

def check_tool_double_booking(tool_id, exclude_checkout_id=None):
    all_active = ToolCheckout.query.filter(
        ToolCheckout.tool_id == tool_id,
        ToolCheckout.status == 'checked_out'
    ).count()
    
    if all_active > 1:
        return True, all_active
    return False, 0

def check_material_aircraft_match(part_number, batch_number, aircraft_registration):
    if not aircraft_registration:
        return True, None
    
    material = Material.query.filter_by(
        part_number=part_number,
        batch_number=batch_number
    ).first()
    
    if not material:
        return False, 'Material not found'
    
    if material.aircraft_registration and material.aircraft_registration != aircraft_registration:
        return False, f'Material allocated to {material.aircraft_registration}, not {aircraft_registration}'
    
    return True, None

def calculate_risk(work_card_id):
    work_card = WorkCard.query.get(work_card_id)
    if not work_card:
        return None
    
    risk_score = 0.0
    risk_factors = []
    
    checkouts = ToolCheckout.query.filter_by(work_card_id=work_card_id, status='checked_out').all()
    
    for checkout in checkouts:
        tool = Tool.query.get(checkout.tool_id)
        if not tool:
            continue
        
        calibrated, cal_msg = is_tool_calibrated(tool.id)
        if not calibrated:
            risk_score += 50.0
            risk_factors.append({
                'type': 'uncalibrated_tool',
                'tool_number': tool.tool_number,
                'tool_name': tool.name,
                'message': cal_msg,
                'severity': 'critical'
            })
        
        double_booked, count = check_tool_double_booking(tool.id, checkout.id)
        if double_booked:
            risk_score += 40.0
            risk_factors.append({
                'type': 'double_booking',
                'tool_number': tool.tool_number,
                'tool_name': tool.name,
                'active_checkouts': count,
                'severity': 'high'
            })
    
    materials = Material.query.filter_by(aircraft_registration=work_card.aircraft_registration).all()
    for material in materials:
        if material.expiry_date and material.expiry_date < date.today():
            risk_score += 30.0
            risk_factors.append({
                'type': 'expired_material',
                'part_number': material.part_number,
                'batch_number': material.batch_number,
                'expiry_date': str(material.expiry_date),
                'severity': 'high'
            })
    
    if risk_score >= 50:
        risk_level = 'critical'
    elif risk_score >= 30:
        risk_level = 'high'
    elif risk_score >= 10:
        risk_level = 'medium'
    else:
        risk_level = 'low'
    
    return {
        'work_card_id': work_card_id,
        'card_number': work_card.card_number,
        'risk_score': risk_score,
        'risk_level': risk_level,
        'risk_factors': risk_factors,
        'checked_out_tools': len(checkouts)
    }

@app.route('/api/tool/checkout', methods=['POST'])
def checkout_tool():
    data = request.get_json()
    required_fields = ['tool_number', 'card_number', 'checkout_by']
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'Missing required field: {field}'}), 400
    
    tool = Tool.query.filter_by(tool_number=data['tool_number']).first()
    if not tool:
        return jsonify({'error': 'Tool not found'}), 404
    
    work_card = WorkCard.query.filter_by(card_number=data['card_number']).first()
    if not work_card:
        return jsonify({'error': 'Work card not found'}), 404
    
    active_checkout = ToolCheckout.query.filter_by(
        tool_id=tool.id,
        status='checked_out'
    ).first()
    
    warnings = []
    
    if active_checkout:
        warnings.append({
            'type': 'double_booking_warning',
            'message': f'Tool {tool.tool_number} is already checked out on another work card'
        })
    
    calibrated, cal_msg = is_tool_calibrated(tool.id)
    if not calibrated:
        warnings.append({
            'type': 'calibration_warning',
            'message': cal_msg
        })
    
    checkout = ToolCheckout(
        tool_id=tool.id,
        work_card_id=work_card.id,
        checkout_by=data['checkout_by'],
        notes=data.get('notes', '')
    )
    
    db.session.add(checkout)
    tool.status = 'checked_out'
    db.session.commit()
    
    return jsonify({
        'success': True,
        'checkout_id': checkout.id,
        'tool_number': tool.tool_number,
        'card_number': work_card.card_number,
        'warnings': warnings,
        'checkout_time': checkout.checkout_time.isoformat()
    }), 201

@app.route('/api/tool/return', methods=['POST'])
def return_tool():
    data = request.get_json()
    required_fields = ['checkout_id', 'return_by']
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'Missing required field: {field}'}), 400
    
    checkout = ToolCheckout.query.get(data['checkout_id'])
    if not checkout:
        return jsonify({'error': 'Checkout record not found'}), 404
    
    if checkout.status == 'returned':
        return jsonify({'error': 'Tool already returned'}), 400
    
    checkout.return_time = datetime.utcnow()
    checkout.return_by = data['return_by']
    checkout.status = 'returned'
    checkout.notes = data.get('notes', checkout.notes or '')
    
    tool = Tool.query.get(checkout.tool_id)
    other_active_checkouts = ToolCheckout.query.filter(
        ToolCheckout.tool_id == tool.id,
        ToolCheckout.status == 'checked_out',
        ToolCheckout.id != checkout.id
    ).count()
    
    if other_active_checkouts == 0:
        tool.status = 'available'
    
    db.session.commit()
    
    return jsonify({
        'success': True,
        'checkout_id': checkout.id,
        'tool_number': tool.tool_number,
        'return_time': checkout.return_time.isoformat(),
        'tool_status': tool.status
    })

@app.route('/api/checkout/<int:checkout_id>/revise', methods=['POST'])
def revise_checkout(checkout_id):
    data = request.get_json()
    
    checkout = ToolCheckout.query.get(checkout_id)
    if not checkout:
        return jsonify({'error': 'Checkout record not found'}), 404
    
    changed_fields = []
    
    if 'notes' in data:
        old_notes = checkout.notes
        checkout.notes = data['notes']
        changed_fields.append({
            'field': 'notes',
            'old': old_notes,
            'new': data['notes']
        })
    
    if 'status' in data:
        if data['status'] in ['checked_out', 'returned', 'void']:
            old_status = checkout.status
            checkout.status = data['status']
            changed_fields.append({
                'field': 'status',
                'old': old_status,
                'new': data['status']
            })
            
            if data['status'] == 'void':
                tool = Tool.query.get(checkout.tool_id)
                other_active_checkouts = ToolCheckout.query.filter(
                    ToolCheckout.tool_id == tool.id,
                    ToolCheckout.status == 'checked_out',
                    ToolCheckout.id != checkout.id
                ).count()
                if other_active_checkouts == 0:
                    tool.status = 'available'
    
    db.session.commit()
    
    return jsonify({
        'success': True,
        'checkout_id': checkout.id,
        'changes': changed_fields
    })

@app.route('/api/work-card/<int:work_card_id>/recalculate-risk', methods=['POST'])
def recalculate_risk(work_card_id):
    risk_result = calculate_risk(work_card_id)
    
    if not risk_result:
        return jsonify({'error': 'Work card not found'}), 404
    
    data = request.get_json() or {}
    reviewer = data.get('reviewer', 'system')
    
    review = Review(
        work_card_id=work_card_id,
        reviewer=reviewer,
        review_time=datetime.utcnow(),
        risk_level=risk_result['risk_level'],
        risk_score=risk_result['risk_score'],
        status='completed',
        risk_factors=json.dumps(risk_result['risk_factors'], ensure_ascii=False),
        notes=data.get('notes', '')
    )
    
    db.session.add(review)
    db.session.commit()
    
    return jsonify({
        'success': True,
        'review_id': review.id,
        'risk_analysis': risk_result,
        'review_time': review.review_time.isoformat()
    })

@app.route('/api/work-card/<int:work_card_id>/export/markdown', methods=['GET'])
def export_markdown(work_card_id):
    work_card = WorkCard.query.get(work_card_id)
    if not work_card:
        return jsonify({'error': 'Work card not found'}), 404
    
    checkouts = ToolCheckout.query.filter_by(work_card_id=work_card_id).all()
    latest_review = Review.query.filter_by(work_card_id=work_card_id).order_by(Review.review_time.desc()).first()
    
    markdown_lines = []
    markdown_lines.append(f'# 航线维修交班单 - {work_card.card_number}')
    markdown_lines.append('')
    markdown_lines.append(f'**生成时间:** {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}')
    markdown_lines.append('')
    markdown_lines.append('---')
    markdown_lines.append('')
    markdown_lines.append('## 工卡信息')
    markdown_lines.append('')
    markdown_lines.append(f'- **工卡号:** {work_card.card_number}')
    markdown_lines.append(f'- **标题:** {work_card.title}')
    markdown_lines.append(f'- **机尾号:** {work_card.aircraft_registration}')
    markdown_lines.append(f'- **状态:** {work_card.status}')
    markdown_lines.append('')
    markdown_lines.append('---')
    markdown_lines.append('')
    
    if latest_review:
        markdown_lines.append('## 风险评估')
        markdown_lines.append('')
        markdown_lines.append(f'- **风险等级:** {latest_review.risk_level.upper()}')
        markdown_lines.append(f'- **风险分数:** {latest_review.risk_score}')
        markdown_lines.append(f'- **评估人:** {latest_review.reviewer}')
        markdown_lines.append(f'- **评估时间:** {latest_review.review_time.strftime("%Y-%m-%d %H:%M:%S")}')
        
        if latest_review.risk_factors:
            try:
                factors = json.loads(latest_review.risk_factors)
                if factors:
                    markdown_lines.append('')
                    markdown_lines.append('### 风险因子')
                    markdown_lines.append('')
                    for i, factor in enumerate(factors, 1):
                        markdown_lines.append(f'{i}. **[{factor.get("severity", "unknown").upper()}]** {factor.get("type", "unknown")}')
                        markdown_lines.append(f'   - {factor.get("message", "No details")}')
            except:
                pass
        
        if latest_review.notes:
            markdown_lines.append('')
            markdown_lines.append(f'**备注:** {latest_review.notes}')
        
        markdown_lines.append('')
        markdown_lines.append('---')
        markdown_lines.append('')
    
    markdown_lines.append('## 工具借出记录')
    markdown_lines.append('')
    
    if checkouts:
        for i, checkout in enumerate(checkouts, 1):
            tool = Tool.query.get(checkout.tool_id)
            cal_status, cal_msg = is_tool_calibrated(tool.id)
            
            markdown_lines.append(f'### {i}. {tool.tool_number} - {tool.name}')
            markdown_lines.append('')
            markdown_lines.append(f'- **状态:** {checkout.status}')
            markdown_lines.append(f'- **借出时间:** {checkout.checkout_time.strftime("%Y-%m-%d %H:%M:%S")}')
            markdown_lines.append(f'- **借出人:** {checkout.checkout_by}')
            markdown_lines.append(f'- **校准状态:** {"有效" if cal_status else "无效/过期"}')
            if checkout.return_time:
                markdown_lines.append(f'- **归还时间:** {checkout.return_time.strftime("%Y-%m-%d %H:%M:%S")}')
                markdown_lines.append(f'- **归还人:** {checkout.return_by}')
            if checkout.notes:
                markdown_lines.append(f'- **备注:** {checkout.notes}')
            markdown_lines.append('')
    else:
        markdown_lines.append('*暂无工具借出记录*')
        markdown_lines.append('')
    
    materials = Material.query.filter_by(aircraft_registration=work_card.aircraft_registration).all()
    if materials:
        markdown_lines.append('---')
        markdown_lines.append('')
        markdown_lines.append('## 关联航材')
        markdown_lines.append('')
        markdown_lines.append('| 件号 | 批次号 | 描述 | 数量 | 有效期 | 状态 |')
        markdown_lines.append('|------|--------|------|------|--------|------|')
        for mat in materials:
            expiry = str(mat.expiry_date) if mat.expiry_date else '-'
            markdown_lines.append(f'| {mat.part_number} | {mat.batch_number} | {mat.description or "-"} | {mat.quantity} | {expiry} | {mat.status} |')
        markdown_lines.append('')
    
    markdown_lines.append('---')
    markdown_lines.append('')
    markdown_lines.append('*此交班单由机务工具管理系统自动生成*')
    
    markdown_content = '\n'.join(markdown_lines)
    
    return Response(
        markdown_content,
        mimetype='text/markdown',
        headers={
            'Content-Disposition': f'attachment; filename=handover-{work_card.card_number}.md'
        }
    )

@app.route('/api/work-card/<int:work_card_id>/export/audit', methods=['GET'])
def export_audit(work_card_id):
    work_card = WorkCard.query.get(work_card_id)
    if not work_card:
        return jsonify({'error': 'Work card not found'}), 404
    
    checkouts = ToolCheckout.query.filter_by(work_card_id=work_card_id).all()
    reviews = Review.query.filter_by(work_card_id=work_card_id).order_by(Review.review_time).all()
    
    audit_package = {
        'export_time': datetime.utcnow().isoformat(),
        'work_card': {
            'id': work_card.id,
            'card_number': work_card.card_number,
            'title': work_card.title,
            'aircraft_registration': work_card.aircraft_registration,
            'status': work_card.status,
            'created_at': work_card.created_at.isoformat() if work_card.created_at else None,
            'updated_at': work_card.updated_at.isoformat() if work_card.updated_at else None
        },
        'tool_checkouts': [],
        'reviews': [],
        'risk_summary': None
    }
    
    for checkout in checkouts:
        tool = Tool.query.get(checkout.tool_id)
        calibrations = Calibration.query.filter_by(tool_id=tool.id).all()
        
        audit_package['tool_checkouts'].append({
            'checkout_id': checkout.id,
            'tool': {
                'id': tool.id,
                'tool_number': tool.tool_number,
                'name': tool.name,
                'category': tool.category,
                'location': tool.location,
                'status': tool.status
            },
            'calibration_history': [{
                'certificate_number': cal.certificate_number,
                'calibration_date': str(cal.calibration_date),
                'expiry_date': str(cal.expiry_date),
                'status': cal.status,
                'calibrated_by': cal.calibrated_by
            } for cal in calibrations],
            'checkout_by': checkout.checkout_by,
            'checkout_time': checkout.checkout_time.isoformat() if checkout.checkout_time else None,
            'return_time': checkout.return_time.isoformat() if checkout.return_time else None,
            'return_by': checkout.return_by,
            'status': checkout.status,
            'notes': checkout.notes
        })
    
    for review in reviews:
        risk_factors = None
        if review.risk_factors:
            try:
                risk_factors = json.loads(review.risk_factors)
            except:
                risk_factors = review.risk_factors
        
        audit_package['reviews'].append({
            'review_id': review.id,
            'reviewer': review.reviewer,
            'review_time': review.review_time.isoformat() if review.review_time else None,
            'risk_level': review.risk_level,
            'risk_score': review.risk_score,
            'status': review.status,
            'risk_factors': risk_factors,
            'notes': review.notes
        })
    
    if reviews:
        latest_review = reviews[-1]
        audit_package['risk_summary'] = {
            'latest_risk_level': latest_review.risk_level,
            'latest_risk_score': latest_review.risk_score,
            'total_reviews': len(reviews),
            'critical_factors_count': sum(
                1 for r in reviews 
                if r.risk_factors and isinstance(json.loads(r.risk_factors) if r.risk_factors else [], list)
                for f in (json.loads(r.risk_factors) if r.risk_factors else [])
                if f.get('severity') == 'critical'
            )
        }
    
    materials = Material.query.filter_by(aircraft_registration=work_card.aircraft_registration).all()
    if materials:
        audit_package['related_materials'] = [{
            'part_number': mat.part_number,
            'batch_number': mat.batch_number,
            'description': mat.description,
            'quantity': mat.quantity,
            'expiry_date': str(mat.expiry_date) if mat.expiry_date else None,
            'status': mat.status
        } for mat in materials]
    
    return Response(
        json.dumps(audit_package, ensure_ascii=False, indent=2),
        mimetype='application/json',
        headers={
            'Content-Disposition': f'attachment; filename=audit-{work_card.card_number}.json'
        }
    )

@app.route('/api/work-cards', methods=['GET'])
def list_work_cards():
    work_cards = WorkCard.query.all()
    return jsonify([{
        'id': wc.id,
        'card_number': wc.card_number,
        'title': wc.title,
        'aircraft_registration': wc.aircraft_registration,
        'status': wc.status
    } for wc in work_cards])

@app.route('/api/tools', methods=['GET'])
def list_tools():
    tools = Tool.query.all()
    result = []
    for tool in tools:
        calibrated, _ = is_tool_calibrated(tool.id)
        result.append({
            'id': tool.id,
            'tool_number': tool.tool_number,
            'name': tool.name,
            'category': tool.category,
            'status': tool.status,
            'location': tool.location,
            'calibrated': calibrated
        })
    return jsonify(result)

@app.route('/api/checkouts', methods=['GET'])
def list_checkouts():
    status = request.args.get('status')
    query = ToolCheckout.query
    if status:
        query = query.filter_by(status=status)
    checkouts = query.all()
    
    result = []
    for checkout in checkouts:
        tool = Tool.query.get(checkout.tool_id)
        work_card = WorkCard.query.get(checkout.work_card_id)
        result.append({
            'id': checkout.id,
            'tool_number': tool.tool_number,
            'tool_name': tool.name,
            'card_number': work_card.card_number,
            'checkout_by': checkout.checkout_by,
            'checkout_time': checkout.checkout_time.isoformat() if checkout.checkout_time else None,
            'return_time': checkout.return_time.isoformat() if checkout.return_time else None,
            'status': checkout.status
        })
    return jsonify(result)

@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.utcnow().isoformat(),
        'database': 'connected'
    })

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5000, debug=True)
