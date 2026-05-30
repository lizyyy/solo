from flask import render_template, request, jsonify, send_file, redirect, url_for
from app import app, db
from models import Rental, Student, Equipment, DamageRecord, Anomaly, Reminder, ImportLog
from excel_importer import ExcelImporter
from rental_service import RentalService
from anomaly_detector import AnomalyDetector
from reminder_service import ReminderService
from report_exporter import ReportExporter
from datetime import datetime
import os

@app.route('/')
def index():
    stats = {
        'total_rentals': Rental.query.count(),
        'active_rentals': Rental.query.filter_by(status='active').count(),
        'overdue_rentals': Rental.query.filter_by(status='overdue').count(),
        'pending_anomalies': Anomaly.query.filter_by(resolved=False).count(),
        'pending_reminders': Reminder.query.filter_by(acknowledged=False).count(),
        'total_equipment': Equipment.query.count(),
        'total_students': Student.query.count()
    }
    
    recent_rentals = Rental.query.order_by(Rental.created_at.desc()).limit(5).all()
    pending_anomalies = Anomaly.query.filter_by(resolved=False).order_by(Anomaly.severity.desc()).limit(5).all()
    pending_reminders = ReminderService.get_pending_reminders(10)
    
    return render_template('index.html', 
                         stats=stats, 
                         recent_rentals=recent_rentals,
                         pending_anomalies=pending_anomalies,
                         pending_reminders=pending_reminders)

@app.route('/rentals')
def rentals():
    status_filter = request.args.get('status', '')
    student_filter = request.args.get('student', '')
    
    query = Rental.query
    
    if status_filter:
        query = query.filter(Rental.status == status_filter)
    if student_filter:
        query = query.join(Student).filter(Student.name.contains(student_filter))
    
    rental_list = query.order_by(Rental.created_at.desc()).all()
    
    for r in rental_list:
        if r.status == 'overdue' and r.due_date:
            r.overdue_days = (datetime.now() - r.due_date).days
        r.deposit_balance = r.deposit_paid - r.deposit_refunded - r.rental_fee - r.damage_fee
    
    return render_template('rentals.html', rentals=rental_list, 
                         status_filter=status_filter, student_filter=student_filter)

@app.route('/rental/<int:rental_id>')
def rental_detail(rental_id):
    rental = Rental.query.get_or_404(rental_id)
    deposit_balance = rental.deposit_paid - rental.deposit_refunded - rental.rental_fee - rental.damage_fee
    
    if rental.status == 'overdue' and rental.due_date:
        rental.overdue_days = (datetime.now() - rental.due_date).days
    
    return render_template('rental_detail.html', rental=rental, deposit_balance=deposit_balance)

@app.route('/rental/<int:rental_id>/confirm', methods=['POST'])
def confirm_rental(rental_id):
    result = RentalService.confirm_rental(rental_id, request.form.get('confirmed_by', 'system'))
    return jsonify(result)

@app.route('/rental/<int:rental_id>/return', methods=['POST'])
def return_rental(rental_id):
    result = RentalService.process_return(
        rental_id,
        return_date=datetime.now(),
        damage_notes=request.form.get('damage_notes'),
        damage_severity=request.form.get('damage_severity', 'minor'),
        damage_cost=float(request.form.get('damage_cost', 0) or 0),
        operator=request.form.get('operator', 'system')
    )
    return jsonify(result)

@app.route('/students')
def students():
    student_list = Student.query.order_by(Student.name).all()
    return render_template('students.html', students=student_list)

@app.route('/equipment')
def equipment_list():
    eq_list = Equipment.query.order_by(Equipment.type, Equipment.name).all()
    return render_template('equipment.html', equipment=eq_list)

@app.route('/anomalies')
def anomalies():
    unresolved = Anomaly.query.filter_by(resolved=False).order_by(Anomaly.severity.desc()).all()
    resolved = Anomaly.query.filter_by(resolved=True).order_by(Anomaly.detected_at.desc()).limit(50).all()
    return render_template('anomalies.html', unresolved=unresolved, resolved=resolved)

@app.route('/anomalies/run_checks', methods=['POST'])
def run_anomaly_checks():
    anomalies = AnomalyDetector.run_all_checks()
    return jsonify({'success': True, 'count': len(anomalies), 'anomalies': [
        {'id': a.id, 'type': a.type, 'description': a.description, 'severity': a.severity}
        for a in anomalies
    ]})

@app.route('/anomaly/<int:anomaly_id>/resolve', methods=['POST'])
def resolve_anomaly(anomaly_id):
    result = AnomalyDetector.resolve_anomaly(
        anomaly_id,
        resolved_by=request.form.get('resolved_by', 'system'),
        resolution=request.form.get('resolution', '')
    )
    return jsonify(result)

@app.route('/reminders')
def reminders():
    pending = ReminderService.get_pending_reminders()
    return render_template('reminders.html', reminders=pending)

@app.route('/reminders/generate', methods=['POST'])
def generate_reminders():
    reminders = ReminderService.generate_all_reminders()
    return jsonify({'success': True, 'count': len(reminders)})

@app.route('/reminder/<int:reminder_id>/acknowledge', methods=['POST'])
def acknowledge_reminder(reminder_id):
    result = ReminderService.acknowledge_reminder(
        reminder_id,
        acknowledged_by=request.form.get('acknowledged_by', 'system')
    )
    return jsonify(result)

@app.route('/import')
def import_page():
    import_logs = ImportLog.query.order_by(ImportLog.imported_at.desc()).limit(20).all()
    return render_template('import.html', import_logs=import_logs)

@app.route('/import/upload', methods=['POST'])
def upload_excel():
    if 'file' not in request.files:
        return jsonify({'success': False, 'error': '未选择文件'})
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'success': False, 'error': '未选择文件'})
    
    if file:
        filename = f"upload_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{file.filename}"
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        
        importer = ExcelImporter()
        result = importer.import_excel(
            filepath,
            sheet_name=request.form.get('sheet_name'),
            imported_by=request.form.get('imported_by', 'system')
        )
        
        return jsonify(result)

@app.route('/export')
def export_page():
    return render_template('export.html')

@app.route('/export/<report_type>', methods=['GET', 'POST'])
def export_report(report_type):
    filter_params = {}
    if request.method == 'POST':
        filter_params = request.form.to_dict()
    
    try:
        if report_type == 'rental':
            filepath, count = ReportExporter.export_rental_report(filter_params)
        elif report_type == 'deposit':
            filepath, count = ReportExporter.export_deposit_tracking_report()
        elif report_type == 'anomaly':
            filepath, count = ReportExporter.export_anomaly_report()
        elif report_type == 'damage':
            filepath, count = ReportExporter.export_damage_report()
        elif report_type == 'full':
            filepath = ReportExporter.export_full_report()
            count = '完整报告'
        else:
            return jsonify({'success': False, 'error': '未知报告类型'})
        
        return send_file(filepath, as_attachment=True)
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/damage/<int:damage_id>/resolve', methods=['POST'])
def resolve_damage(damage_id):
    damage = DamageRecord.query.get(damage_id)
    if not damage:
        return jsonify({'success': False, 'error': '损坏记录不存在'})
    
    damage.resolved = True
    damage.resolved_date = datetime.now()
    damage.resolution_notes = request.form.get('resolution_notes', '')
    db.session.commit()
    
    return jsonify({'success': True, 'damage': damage.id})

@app.route('/api/students')
def api_students():
    students = Student.query.all()
    return jsonify([{'id': s.id, 'name': s.name, 'student_id': s.student_id} for s in students])

@app.route('/api/equipment')
def api_equipment():
    equipment = Equipment.query.all()
    return jsonify([{'id': e.id, 'name': e.name, 'serial_number': e.serial_number, 'type': e.type} for e in equipment])

@app.route('/rental/new', methods=['GET', 'POST'])
def new_rental():
    if request.method == 'POST':
        try:
            student_id = request.form.get('student_id')
            equipment_id = request.form.get('equipment_id')
            rent_date = datetime.strptime(request.form.get('rent_date'), '%Y-%m-%d')
            due_date = datetime.strptime(request.form.get('due_date'), '%Y-%m-%d') if request.form.get('due_date') else None
            deposit_paid = float(request.form.get('deposit_paid', 0) or 0)
            notes = request.form.get('notes', '')
            
            eq = Equipment.query.get(equipment_id)
            if eq:
                eq.status = 'rented'
            
            rental = Rental(
                student_id=student_id,
                equipment_id=equipment_id,
                rent_date=rent_date,
                due_date=due_date,
                deposit_paid=deposit_paid,
                notes=notes,
                status='active'
            )
            db.session.add(rental)
            db.session.commit()
            
            return redirect(url_for('rental_detail', rental_id=rental.id))
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)})
    
    students = Student.query.all()
    available_equipment = Equipment.query.filter_by(status='available').all()
    return render_template('new_rental.html', students=students, equipment=available_equipment)
