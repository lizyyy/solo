from datetime import datetime, timedelta
from flask import Flask, request, jsonify, Response
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import and_, or_
import csv
import io

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///dance_studio.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)


class Studio(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    room_number = db.Column(db.String(50), unique=True, nullable=False)
    capacity = db.Column(db.Integer, nullable=False)
    hourly_rate = db.Column(db.Float, nullable=False)
    overtime_rate_multiplier = db.Column(db.Float, default=1.5)
    is_active = db.Column(db.Boolean, default=True)


class Team(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    contact_person = db.Column(db.String(100))
    phone = db.Column(db.String(20))
    member_count = db.Column(db.Integer)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class Booking(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    studio_id = db.Column(db.Integer, db.ForeignKey('studio.id'), nullable=False)
    team_id = db.Column(db.Integer, db.ForeignKey('team.id'), nullable=False)
    booking_date = db.Column(db.Date, nullable=False)
    scheduled_start = db.Column(db.Time, nullable=False)
    scheduled_end = db.Column(db.Time, nullable=False)
    actual_start = db.Column(db.Time)
    actual_end = db.Column(db.Time)
    status = db.Column(db.String(20), default='scheduled')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    notes = db.Column(db.Text)
    studio = db.relationship('Studio', backref=db.backref('bookings', lazy=True))
    team = db.relationship('Team', backref=db.backref('bookings', lazy=True))


class BillingRecord(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    booking_id = db.Column(db.Integer, db.ForeignKey('booking.id'), nullable=False)
    scheduled_hours = db.Column(db.Float, nullable=False)
    scheduled_amount = db.Column(db.Float, nullable=False)
    overtime_minutes = db.Column(db.Integer, default=0)
    overtime_amount = db.Column(db.Float, default=0)
    total_amount = db.Column(db.Float, nullable=False)
    has_conflict = db.Column(db.Boolean, default=False)
    conflict_details = db.Column(db.Text)
    is_finalized = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    finalized_at = db.Column(db.DateTime)
    booking = db.relationship('Booking', backref=db.backref('billing_records', lazy=True))


class ImportLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    file_name = db.Column(db.String(200))
    row_number = db.Column(db.Integer)
    status = db.Column(db.String(20))
    error_message = db.Column(db.Text)
    row_data = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


def calculate_overtime_minutes(actual_end, scheduled_end):
    if not actual_end or not scheduled_end:
        return 0
    actual_dt = datetime.combine(datetime.today(), actual_end)
    scheduled_dt = datetime.combine(datetime.today(), scheduled_end)
    diff = actual_dt - scheduled_dt
    return max(0, int(diff.total_seconds() // 60))


def check_booking_conflict(studio_id, booking_date, scheduled_start, scheduled_end, exclude_booking_id=None):
    conflicts = []
    bookings = Booking.query.filter(
        Booking.studio_id == studio_id,
        Booking.booking_date == booking_date,
        Booking.id != exclude_booking_id if exclude_booking_id is not None else True
    ).all()
    
    new_start = datetime.combine(booking_date, scheduled_start)
    new_end = datetime.combine(booking_date, scheduled_end)
    
    for booking in bookings:
        b_start = datetime.combine(booking.booking_date, booking.scheduled_start)
        b_end = datetime.combine(booking.booking_date, booking.scheduled_end)
        
        if (new_start < b_end) and (new_end > b_start):
            conflicts.append({
                'booking_id': booking.id,
                'team_name': booking.team.name,
                'scheduled_start': booking.scheduled_start.strftime('%H:%M'),
                'scheduled_end': booking.scheduled_end.strftime('%H:%M')
            })
    return conflicts


def check_overtime_impact(booking):
    if not booking.actual_end:
        return []
    
    impacted = []
    actual_end_dt = datetime.combine(booking.booking_date, booking.actual_end)
    
    next_bookings = Booking.query.filter(
        Booking.studio_id == booking.studio_id,
        Booking.booking_date == booking.booking_date,
        Booking.scheduled_start > booking.scheduled_end
    ).order_by(Booking.scheduled_start).all()
    
    for next_booking in next_bookings:
        next_start_dt = datetime.combine(next_booking.booking_date, next_booking.scheduled_start)
        if actual_end_dt > next_start_dt:
            impact_minutes = int((actual_end_dt - next_start_dt).total_seconds() // 60)
            impacted.append({
                'next_booking_id': next_booking.id,
                'next_team_name': next_booking.team.name,
                'impacted_minutes': impact_minutes
            })
    return impacted


@app.errorhandler(400)
def bad_request(error):
    return jsonify({'error': 'Bad Request', 'message': str(error.description)}), 400

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Not Found', 'message': str(error.description)}), 404

@app.errorhandler(409)
def conflict(error):
    return jsonify({'error': 'Conflict', 'message': str(error.description)}), 409

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Internal Server Error', 'message': 'An unexpected error occurred'}), 500


@app.route('/api/studios', methods=['GET'])
def get_studios():
    studios = Studio.query.all()
    return jsonify([{
        'id': s.id,
        'name': s.name,
        'room_number': s.room_number,
        'capacity': s.capacity,
        'hourly_rate': s.hourly_rate,
        'overtime_rate_multiplier': s.overtime_rate_multiplier
    } for s in studios])


@app.route('/api/teams', methods=['GET'])
def get_teams():
    teams = Team.query.all()
    return jsonify([{
        'id': t.id,
        'name': t.name,
        'contact_person': t.contact_person,
        'phone': t.phone,
        'member_count': t.member_count
    } for t in teams])


@app.route('/api/bookings', methods=['GET'])
def get_bookings():
    bookings = Booking.query.order_by(Booking.booking_date.desc(), Booking.scheduled_start).all()
    return jsonify([{
        'id': b.id,
        'studio_name': b.studio.name,
        'team_name': b.team.name,
        'booking_date': b.booking_date.isoformat(),
        'scheduled_start': b.scheduled_start.strftime('%H:%M'),
        'scheduled_end': b.scheduled_end.strftime('%H:%M'),
        'actual_start': b.actual_start.strftime('%H:%M') if b.actual_start else None,
        'actual_end': b.actual_end.strftime('%H:%M') if b.actual_end else None,
        'status': b.status
    } for b in bookings])


@app.route('/api/bookings', methods=['POST'])
def create_booking():
    data = request.get_json()
    
    required_fields = ['studio_id', 'team_id', 'booking_date', 'scheduled_start', 'scheduled_end']
    for field in required_fields:
        if field not in data:
            return jsonify({'error': 'Missing required field', 'field': field}), 400
    
    try:
        booking_date = datetime.strptime(data['booking_date'], '%Y-%m-%d').date()
        scheduled_start = datetime.strptime(data['scheduled_start'], '%H:%M').time()
        scheduled_end = datetime.strptime(data['scheduled_end'], '%H:%M').time()
    except ValueError as e:
        return jsonify({'error': 'Invalid date/time format', 'details': str(e)}), 400
    
    if scheduled_start >= scheduled_end:
        return jsonify({'error': 'Invalid time range', 'message': 'End time must be after start time'}), 400
    
    conflicts = check_booking_conflict(
        data['studio_id'],
        booking_date,
        scheduled_start,
        scheduled_end
    )
    
    if conflicts:
        return jsonify({
            'error': 'Booking conflict detected',
            'message': 'This time slot overlaps with existing bookings',
            'conflicts': conflicts
        }), 409
    
    booking = Booking(
        studio_id=data['studio_id'],
        team_id=data['team_id'],
        booking_date=booking_date,
        scheduled_start=scheduled_start,
        scheduled_end=scheduled_end,
        status=data.get('status', 'scheduled'),
        notes=data.get('notes')
    )
    
    db.session.add(booking)
    db.session.commit()
    
    return jsonify({
        'message': 'Booking created successfully',
        'booking_id': booking.id
    }), 201


@app.route('/api/bookings/<int:booking_id>/checkin', methods=['POST'])
def checkin_booking(booking_id):
    booking = Booking.query.get_or_404(booking_id)
    
    data = request.get_json() or {}
    actual_start_str = data.get('actual_start')
    
    if actual_start_str:
        try:
            actual_start = datetime.strptime(actual_start_str, '%H:%M').time()
        except ValueError:
            return jsonify({'error': 'Invalid time format'}), 400
    else:
        actual_start = datetime.now().time()
    
    booking.actual_start = actual_start
    booking.status = 'in_progress'
    db.session.commit()
    
    return jsonify({'message': 'Check-in successful', 'actual_start': actual_start.strftime('%H:%M')})


@app.route('/api/bookings/<int:booking_id>/checkout', methods=['POST'])
def checkout_booking(booking_id):
    booking = Booking.query.get_or_404(booking_id)
    
    data = request.get_json() or {}
    actual_end_str = data.get('actual_end')
    
    if actual_end_str:
        try:
            actual_end = datetime.strptime(actual_end_str, '%H:%M').time()
        except ValueError:
            return jsonify({'error': 'Invalid time format'}), 400
    else:
        actual_end = datetime.now().time()
    
    booking.actual_end = actual_end
    booking.status = 'completed'
    
    overtime_impact = check_overtime_impact(booking)
    overtime_minutes = calculate_overtime_minutes(actual_end, booking.scheduled_end)
    
    start_dt = datetime.combine(datetime.today(), booking.scheduled_start)
    end_dt = datetime.combine(datetime.today(), booking.scheduled_end)
    scheduled_hours = (end_dt - start_dt).total_seconds() / 3600
    
    scheduled_amount = scheduled_hours * booking.studio.hourly_rate
    overtime_amount = (overtime_minutes / 60) * booking.studio.hourly_rate * booking.studio.overtime_rate_multiplier
    total_amount = scheduled_amount + overtime_amount
    
    has_conflict = len(overtime_impact) > 0
    conflict_details = str(overtime_impact) if has_conflict else None
    
    existing_billing = BillingRecord.query.filter_by(booking_id=booking.id, is_finalized=True).first()
    if existing_billing:
        db.session.rollback()
        return jsonify({
            'error': 'Billing record already finalized',
            'message': 'Cannot overwrite existing finalized billing record',
            'existing_billing_id': existing_billing.id
        }), 409
    
    billing = BillingRecord(
        booking_id=booking.id,
        scheduled_hours=scheduled_hours,
        scheduled_amount=scheduled_amount,
        overtime_minutes=overtime_minutes,
        overtime_amount=overtime_amount,
        total_amount=total_amount,
        has_conflict=has_conflict,
        conflict_details=conflict_details,
        is_finalized=True,
        finalized_at=datetime.utcnow()
    )
    
    db.session.add(billing)
    db.session.commit()
    
    response = {
        'message': 'Check-out successful',
        'actual_end': actual_end.strftime('%H:%M'),
        'overtime_minutes': overtime_minutes,
        'billing': {
            'id': billing.id,
            'scheduled_hours': scheduled_hours,
            'scheduled_amount': scheduled_amount,
            'overtime_minutes': overtime_minutes,
            'overtime_amount': overtime_amount,
            'total_amount': total_amount
        }
    }
    
    if overtime_impact:
        response['overtime_impact_warning'] = {
            'message': 'Overtime impacts subsequent bookings',
            'impacted_bookings': overtime_impact
        }
    
    return jsonify(response)


@app.route('/api/billing', methods=['GET'])
def get_billing():
    billings = BillingRecord.query.order_by(BillingRecord.created_at.desc()).all()
    return jsonify([{
        'id': b.id,
        'booking_id': b.booking_id,
        'studio_name': b.booking.studio.name,
        'team_name': b.booking.team.name,
        'booking_date': b.booking.booking_date.isoformat(),
        'scheduled_hours': b.scheduled_hours,
        'scheduled_amount': b.scheduled_amount,
        'overtime_minutes': b.overtime_minutes,
        'overtime_amount': b.overtime_amount,
        'total_amount': b.total_amount,
        'has_conflict': b.has_conflict,
        'is_finalized': b.is_finalized
    } for b in billings])


@app.route('/api/import', methods=['POST'])
def import_data():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    if not file.filename.endswith('.csv'):
        return jsonify({'error': 'Only CSV files are supported'}), 400
    
    stream = io.StringIO(file.stream.read().decode('UTF-8'))
    reader = csv.DictReader(stream)
    
    success_count = 0
    error_count = 0
    errors = []
    
    for row_num, row in enumerate(reader, start=2):
        try:
            booking_date = datetime.strptime(row['booking_date'], '%Y-%m-%d').date()
            scheduled_start = datetime.strptime(row['scheduled_start'], '%H:%M').time()
            scheduled_end = datetime.strptime(row['scheduled_end'], '%H:%M').time()
            
            studio = Studio.query.filter_by(room_number=row['studio_room']).first()
            if not studio:
                raise ValueError(f'Studio {row["studio_room"]} not found')
            
            team = Team.query.filter_by(name=row['team_name']).first()
            if not team:
                team = Team(name=row['team_name'])
                db.session.add(team)
                db.session.flush()
            
            conflicts = check_booking_conflict(studio.id, booking_date, scheduled_start, scheduled_end)
            
            if conflicts:
                raise ValueError(f'Booking conflict: {conflicts}')
            
            booking = Booking(
                studio_id=studio.id,
                team_id=team.id,
                booking_date=booking_date,
                scheduled_start=scheduled_start,
                scheduled_end=scheduled_end,
                status='scheduled'
            )
            db.session.add(booking)
            success_count += 1
            
            log = ImportLog(
                file_name=file.filename,
                row_number=row_num,
                status='success',
                row_data=str(row)
            )
            db.session.add(log)
            
        except Exception as e:
            error_count += 1
            errors.append({
                'row': row_num,
                'error': str(e),
                'data': row
            })
            
            log = ImportLog(
                file_name=file.filename,
                row_number=row_num,
                status='error',
                error_message=str(e),
                row_data=str(row)
            )
            db.session.add(log)
    
    db.session.commit()
    
    return jsonify({
        'message': 'Import completed',
        'success_count': success_count,
        'error_count': error_count,
        'errors': errors
    })


@app.route('/api/export', methods=['GET'])
def export_data():
    billings = BillingRecord.query.join(Booking).join(Studio).join(Team).order_by(Booking.booking_date).all()
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    writer.writerow([
        '计费ID', '预约ID', '排练室', '团队名称', '预约日期',
        '预定开始', '预定结束', '实际开始', '实际结束',
        '预定时长(小时)', '预定费用', '超时分钟', '超时费用',
        '总费用', '是否冲突', '冲突详情', '是否已结算'
    ])
    
    for b in billings:
        writer.writerow([
            b.id,
            b.booking_id,
            b.booking.studio.name,
            b.booking.team.name,
            b.booking.booking_date.isoformat(),
            b.booking.scheduled_start.strftime('%H:%M'),
            b.booking.scheduled_end.strftime('%H:%M'),
            b.booking.actual_start.strftime('%H:%M') if b.booking.actual_start else '',
            b.booking.actual_end.strftime('%H:%M') if b.booking.actual_end else '',
            b.scheduled_hours,
            round(b.scheduled_amount, 2),
            b.overtime_minutes,
            round(b.overtime_amount, 2),
            round(b.total_amount, 2),
            '是' if b.has_conflict else '否',
            b.conflict_details or '',
            '是' if b.is_finalized else '否'
        ])
    
    output.seek(0)
    return Response(
        output.getvalue(),
        mimetype='text/csv',
        headers={'Content-Disposition': 'attachment; filename=billing_export.csv'}
    )


@app.route('/api/import-logs', methods=['GET'])
def get_import_logs():
    logs = ImportLog.query.order_by(ImportLog.created_at.desc()).limit(50).all()
    return jsonify([{
        'id': l.id,
        'file_name': l.file_name,
        'row_number': l.row_number,
        'status': l.status,
        'error_message': l.error_message
    } for l in logs])


def init_data():
    if Studio.query.count() == 0:
        studios = [
            Studio(name='主排练厅', room_number='A101', capacity=30, hourly_rate=150.0, overtime_rate_multiplier=1.5),
            Studio(name='小型排练室', room_number='B202', capacity=15, hourly_rate=100.0, overtime_rate_multiplier=1.5),
            Studio(name='VIP排练室', room_number='C303', capacity=10, hourly_rate=200.0, overtime_rate_multiplier=2.0)
        ]
        db.session.add_all(studios)
    
    if Team.query.count() == 0:
        teams = [
            Team(name='天鹅湖舞团', contact_person='李老师', phone='13800138001', member_count=12),
            Team(name='青春舞蹈队', contact_person='王教练', phone='13800138002', member_count=8),
            Team(name='星光艺术团', contact_person='张导演', phone='13800138003', member_count=15),
            Team(name='梦之舞工作室', contact_person='陈老师', phone='13800138004', member_count=6)
        ]
        db.session.add_all(teams)
    
    db.session.commit()
    
    if Booking.query.count() == 0:
        studio1 = Studio.query.filter_by(room_number='A101').first()
        team1 = Team.query.filter_by(name='天鹅湖舞团').first()
        team2 = Team.query.filter_by(name='青春舞蹈队').first()
        team3 = Team.query.filter_by(name='星光艺术团').first()
        
        booking_date = datetime.now().date()
        
        booking1 = Booking(
            studio_id=studio1.id,
            team_id=team1.id,
            booking_date=booking_date,
            scheduled_start=datetime.strptime('09:00', '%H:%M').time(),
            scheduled_end=datetime.strptime('11:00', '%H:%M').time(),
            actual_start=datetime.strptime('09:05', '%H:%M').time(),
            actual_end=datetime.strptime('10:55', '%H:%M').time(),
            status='completed'
        )
        db.session.add(booking1)
        db.session.flush()
        
        billing1 = BillingRecord(
            booking_id=booking1.id,
            scheduled_hours=2.0,
            scheduled_amount=300.0,
            overtime_minutes=0,
            overtime_amount=0.0,
            total_amount=300.0,
            has_conflict=False,
            is_finalized=True,
            finalized_at=datetime.utcnow()
        )
        db.session.add(billing1)
        
        booking2 = Booking(
            studio_id=studio1.id,
            team_id=team2.id,
            booking_date=booking_date,
            scheduled_start=datetime.strptime('11:00', '%H:%M').time(),
            scheduled_end=datetime.strptime('13:00', '%H:%M').time(),
            actual_start=datetime.strptime('11:15', '%H:%M').time(),
            actual_end=datetime.strptime('13:30', '%H:%M').time(),
            status='completed'
        )
        db.session.add(booking2)
        db.session.flush()
        
        billing2 = BillingRecord(
            booking_id=booking2.id,
            scheduled_hours=2.0,
            scheduled_amount=300.0,
            overtime_minutes=30,
            overtime_amount=112.5,
            total_amount=412.5,
            has_conflict=True,
            conflict_details="超时30分钟，影响下一个预约",
            is_finalized=True,
            finalized_at=datetime.utcnow()
        )
        db.session.add(billing2)
        
        booking3 = Booking(
            studio_id=studio1.id,
            team_id=team3.id,
            booking_date=booking_date,
            scheduled_start=datetime.strptime('13:00', '%H:%M').time(),
            scheduled_end=datetime.strptime('15:00', '%H:%M').time(),
            status='scheduled'
        )
        db.session.add(booking3)
        
        db.session.commit()


def init_db():
    db.create_all()
    init_data()

if __name__ == '__main__':
    with app.app_context():
        init_db()
    app.run(debug=True, port=5000)
