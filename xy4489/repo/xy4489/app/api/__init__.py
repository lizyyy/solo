from flask import Blueprint, jsonify, request
from datetime import datetime, date, timedelta
import json

from app import db
from app.models import (
    Student, Instructor, Certificate, MedicalRecord,
    Cylinder, CylinderFillRecord, DiveSite, WeatherForecast,
    CourseSchedule, CourseParticipation, RiskAssessment, ReviewRecord
)
from app.risk_engine import RiskEngine
from app.exporters import MarkdownExporter, AuditExporter

api_bp = Blueprint('api', __name__)
risk_engine = RiskEngine()

@api_bp.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "ok", "timestamp": datetime.utcnow().isoformat()})

@api_bp.route('/students', methods=['GET', 'POST'])
def students():
    if request.method == 'GET':
        students = Student.query.all()
        return jsonify([{
            'id': s.id,
            'name': s.name,
            'id_number': s.id_number,
            'phone': s.phone,
            'email': s.email,
            'created_at': s.created_at.isoformat()
        } for s in students])
    
    data = request.get_json()
    student = Student(
        name=data['name'],
        id_number=data['id_number'],
        phone=data.get('phone'),
        email=data.get('email')
    )
    db.session.add(student)
    db.session.commit()
    return jsonify({'id': student.id, 'message': 'Student created successfully'}), 201

@api_bp.route('/students/<int:id>', methods=['GET', 'PUT', 'DELETE'])
def student_detail(id):
    student = Student.query.get_or_404(id)
    
    if request.method == 'GET':
        return jsonify({
            'id': student.id,
            'name': student.name,
            'id_number': student.id_number,
            'phone': student.phone,
            'email': student.email,
            'certificates': [{
                'id': c.id,
                'cert_type': c.cert_type,
                'cert_number': c.cert_number,
                'issue_date': c.issue_date.isoformat(),
                'expiry_date': c.expiry_date.isoformat()
            } for c in student.certificates.all()],
            'medical_records': [{
                'id': m.id,
                'exam_date': m.exam_date.isoformat(),
                'expiry_date': m.expiry_date.isoformat(),
                'fit_for_diving': m.fit_for_diving
            } for m in student.medical_records.all()]
        })
    
    elif request.method == 'PUT':
        data = request.get_json()
        student.name = data.get('name', student.name)
        student.phone = data.get('phone', student.phone)
        student.email = data.get('email', student.email)
        db.session.commit()
        return jsonify({'message': 'Student updated successfully'})
    
    elif request.method == 'DELETE':
        db.session.delete(student)
        db.session.commit()
        return jsonify({'message': 'Student deleted successfully'})

@api_bp.route('/certificates', methods=['GET', 'POST'])
def certificates():
    if request.method == 'GET':
        certs = Certificate.query.all()
        return jsonify([{
            'id': c.id,
            'student_id': c.student_id,
            'cert_type': c.cert_type,
            'cert_number': c.cert_number,
            'issue_date': c.issue_date.isoformat(),
            'expiry_date': c.expiry_date.isoformat()
        } for c in certs])
    
    data = request.get_json()
    cert = Certificate(
        student_id=data['student_id'],
        cert_type=data['cert_type'],
        cert_number=data['cert_number'],
        issue_date=datetime.strptime(data['issue_date'], '%Y-%m-%d').date(),
        expiry_date=datetime.strptime(data['expiry_date'], '%Y-%m-%d').date(),
        issuing_organization=data.get('issuing_organization')
    )
    db.session.add(cert)
    db.session.commit()
    return jsonify({'id': cert.id, 'message': 'Certificate created successfully'}), 201

@api_bp.route('/medical-records', methods=['GET', 'POST'])
def medical_records():
    if request.method == 'GET':
        records = MedicalRecord.query.all()
        return jsonify([{
            'id': r.id,
            'student_id': r.student_id,
            'exam_date': r.exam_date.isoformat(),
            'expiry_date': r.expiry_date.isoformat(),
            'fit_for_diving': r.fit_for_diving
        } for r in records])
    
    data = request.get_json()
    record = MedicalRecord(
        student_id=data['student_id'],
        exam_date=datetime.strptime(data['exam_date'], '%Y-%m-%d').date(),
        expiry_date=datetime.strptime(data['expiry_date'], '%Y-%m-%d').date(),
        doctor_name=data.get('doctor_name'),
        hospital=data.get('hospital'),
        fit_for_diving=data.get('fit_for_diving', True),
        notes=data.get('notes')
    )
    db.session.add(record)
    db.session.commit()
    return jsonify({'id': record.id, 'message': 'Medical record created successfully'}), 201

@api_bp.route('/instructors', methods=['GET', 'POST'])
def instructors():
    if request.method == 'GET':
        instructors = Instructor.query.all()
        return jsonify([{
            'id': i.id,
            'name': i.name,
            'id_number': i.id_number,
            'phone': i.phone,
            'email': i.email,
            'license_number': i.license_number,
            'license_expiry': i.license_expiry.isoformat(),
            'max_students_per_dive': i.max_students_per_dive
        } for i in instructors])
    
    data = request.get_json()
    instructor = Instructor(
        name=data['name'],
        id_number=data['id_number'],
        phone=data.get('phone'),
        email=data.get('email'),
        license_number=data['license_number'],
        license_expiry=datetime.strptime(data['license_expiry'], '%Y-%m-%d').date(),
        max_students_per_dive=data.get('max_students_per_dive', 4)
    )
    db.session.add(instructor)
    db.session.commit()
    return jsonify({'id': instructor.id, 'message': 'Instructor created successfully'}), 201

@api_bp.route('/cylinders', methods=['GET', 'POST'])
def cylinders():
    if request.method == 'GET':
        cylinders = Cylinder.query.all()
        return jsonify([{
            'id': c.id,
            'serial_number': c.serial_number,
            'capacity_liters': c.capacity_liters,
            'material': c.material,
            'last_inspection_date': c.last_inspection_date.isoformat(),
            'next_inspection_date': c.next_inspection_date.isoformat(),
            'status': c.status
        } for c in cylinders])
    
    data = request.get_json()
    cylinder = Cylinder(
        serial_number=data['serial_number'],
        capacity_liters=data['capacity_liters'],
        material=data.get('material'),
        manufacture_date=datetime.strptime(data['manufacture_date'], '%Y-%m-%d').date() if data.get('manufacture_date') else None,
        last_inspection_date=datetime.strptime(data['last_inspection_date'], '%Y-%m-%d').date(),
        next_inspection_date=datetime.strptime(data['next_inspection_date'], '%Y-%m-%d').date(),
        status=data.get('status', 'available')
    )
    db.session.add(cylinder)
    db.session.commit()
    return jsonify({'id': cylinder.id, 'message': 'Cylinder created successfully'}), 201

@api_bp.route('/cylinders/<int:id>/fill', methods=['POST'])
def fill_cylinder(id):
    cylinder = Cylinder.query.get_or_404(id)
    data = request.get_json()
    
    fill_record = CylinderFillRecord(
        cylinder_id=cylinder.id,
        pressure_bar=data['pressure_bar'],
        gas_type=data.get('gas_type', 'Air'),
        filler_name=data.get('filler_name'),
        notes=data.get('notes')
    )
    db.session.add(fill_record)
    db.session.commit()
    
    return jsonify({'id': fill_record.id, 'message': 'Cylinder fill record created successfully'}), 201

@api_bp.route('/dive-sites', methods=['GET', 'POST'])
def dive_sites():
    if request.method == 'GET':
        sites = DiveSite.query.all()
        return jsonify([{
            'id': s.id,
            'name': s.name,
            'location': s.location,
            'max_depth_meters': s.max_depth_meters,
            'difficulty_level': s.difficulty_level,
            'description': s.description
        } for s in sites])
    
    data = request.get_json()
    site = DiveSite(
        name=data['name'],
        location=data.get('location'),
        max_depth_meters=data.get('max_depth_meters'),
        difficulty_level=data.get('difficulty_level'),
        description=data.get('description')
    )
    db.session.add(site)
    db.session.commit()
    return jsonify({'id': site.id, 'message': 'Dive site created successfully'}), 201

@api_bp.route('/weather-forecasts', methods=['GET', 'POST'])
def weather_forecasts():
    if request.method == 'GET':
        forecasts = WeatherForecast.query.all()
        return jsonify([{
            'id': f.id,
            'dive_site_id': f.dive_site_id,
            'forecast_date': f.forecast_date.isoformat(),
            'wind_speed_kmh': f.wind_speed_kmh,
            'wind_direction': f.wind_direction,
            'wave_height_m': f.wave_height_m,
            'water_temp_c': f.water_temp_c,
            'visibility_m': f.visibility_m,
            'current_strength': f.current_strength
        } for f in forecasts])
    
    data = request.get_json()
    forecast = WeatherForecast(
        dive_site_id=data['dive_site_id'],
        forecast_date=datetime.strptime(data['forecast_date'], '%Y-%m-%d').date(),
        wind_speed_kmh=data['wind_speed_kmh'],
        wind_direction=data.get('wind_direction'),
        wave_height_m=data['wave_height_m'],
        water_temp_c=data.get('water_temp_c'),
        visibility_m=data.get('visibility_m'),
        current_strength=data.get('current_strength'),
        forecast_source=data.get('forecast_source')
    )
    db.session.add(forecast)
    db.session.commit()
    return jsonify({'id': forecast.id, 'message': 'Weather forecast created successfully'}), 201

@api_bp.route('/courses', methods=['GET', 'POST'])
def courses():
    if request.method == 'GET':
        courses = CourseSchedule.query.all()
        return jsonify([{
            'id': c.id,
            'course_name': c.course_name,
            'course_date': c.course_date.isoformat(),
            'start_time': str(c.start_time),
            'end_time': str(c.end_time),
            'instructor_id': c.instructor_id,
            'dive_site_id': c.dive_site_id,
            'max_students': c.max_students,
            'status': c.status
        } for c in courses])
    
    data = request.get_json()
    course = CourseSchedule(
        course_name=data['course_name'],
        course_date=datetime.strptime(data['course_date'], '%Y-%m-%d').date(),
        start_time=datetime.strptime(data['start_time'], '%H:%M').time(),
        end_time=datetime.strptime(data['end_time'], '%H:%M').time(),
        instructor_id=data['instructor_id'],
        dive_site_id=data['dive_site_id'],
        max_students=data.get('max_students', 4),
        notes=data.get('notes')
    )
    db.session.add(course)
    db.session.commit()
    return jsonify({'id': course.id, 'message': 'Course schedule created successfully'}), 201

@api_bp.route('/courses/<int:id>', methods=['GET', 'PUT', 'DELETE'])
def course_detail(id):
    course = CourseSchedule.query.get_or_404(id)
    
    if request.method == 'GET':
        participations = CourseParticipation.query.filter_by(course_id=course.id).all()
        return jsonify({
            'id': course.id,
            'course_name': course.course_name,
            'course_date': course.course_date.isoformat(),
            'start_time': str(course.start_time),
            'end_time': str(course.end_time),
            'instructor': {
                'id': course.instructor.id,
                'name': course.instructor.name
            } if course.instructor else None,
            'dive_site': {
                'id': course.dive_site.id,
                'name': course.dive_site.name
            } if course.dive_site else None,
            'max_students': course.max_students,
            'status': course.status,
            'students': [{
                'participation_id': p.id,
                'student_id': p.student_id,
                'student_name': p.student.name,
                'cylinder_id': p.cylinder_id,
                'status': p.status
            } for p in participations]
        })
    
    elif request.method == 'PUT':
        data = request.get_json()
        course.course_name = data.get('course_name', course.course_name)
        course.status = data.get('status', course.status)
        course.notes = data.get('notes', course.notes)
        db.session.commit()
        return jsonify({'message': 'Course updated successfully'})
    
    elif request.method == 'DELETE':
        db.session.delete(course)
        db.session.commit()
        return jsonify({'message': 'Course deleted successfully'})

@api_bp.route('/courses/<int:course_id>/enroll', methods=['POST'])
def enroll_student(course_id):
    course = CourseSchedule.query.get_or_404(course_id)
    data = request.get_json()
    
    participation = CourseParticipation(
        course_id=course.id,
        student_id=data['student_id'],
        cylinder_id=data.get('cylinder_id'),
        status='registered'
    )
    db.session.add(participation)
    db.session.commit()
    
    return jsonify({'id': participation.id, 'message': 'Student enrolled successfully'}), 201

@api_bp.route('/risk-assessment/<int:course_id>', methods=['GET', 'POST'])
def risk_assessment(course_id):
    course = CourseSchedule.query.get_or_404(course_id)
    
    if request.method == 'GET':
        latest_assessment = RiskAssessment.query.filter_by(
            course_id=course.id
        ).order_by(RiskAssessment.assessment_date.desc()).first()
        
        if latest_assessment:
            return jsonify({
                'id': latest_assessment.id,
                'course_id': latest_assessment.course_id,
                'assessment_date': latest_assessment.assessment_date.isoformat(),
                'overall_status': latest_assessment.overall_status,
                'risks': json.loads(latest_assessment.risks) if latest_assessment.risks else [],
                'warnings': json.loads(latest_assessment.warnings) if latest_assessment.warnings else [],
                'reviews': [{
                    'id': r.id,
                    'reviewer_name': r.reviewer_name,
                    'review_date': r.review_date.isoformat(),
                    'original_status': r.original_status,
                    'revised_status': r.revised_status,
                    'reason': r.reason,
                    'notes': r.notes
                } for r in latest_assessment.reviews.all()]
            })
        else:
            return jsonify({'message': 'No assessment found for this course'}), 404
    
    assessment_result = risk_engine.assess_course(course)
    
    assessment = RiskAssessment(
        course_id=course.id,
        overall_status=assessment_result['overall_status'],
        risks=json.dumps(assessment_result['risks'], ensure_ascii=False),
        warnings=json.dumps(assessment_result['warnings'], ensure_ascii=False)
    )
    db.session.add(assessment)
    db.session.commit()
    
    return jsonify({
        'assessment_id': assessment.id,
        **assessment_result
    })

@api_bp.route('/risk-assessment/<int:assessment_id>/review', methods=['POST'])
def review_assessment(assessment_id):
    assessment = RiskAssessment.query.get_or_404(assessment_id)
    data = request.get_json()
    
    original_status = assessment.overall_status
    revised_status = data['revised_status']
    
    if revised_status not in ['approved', 'denied', 'pending_review']:
        return jsonify({'error': 'Invalid revised_status'}), 400
    
    review = ReviewRecord(
        risk_assessment_id=assessment.id,
        reviewer_name=data['reviewer_name'],
        original_status=original_status,
        revised_status=revised_status,
        reason=data['reason'],
        notes=data.get('notes')
    )
    
    assessment.overall_status = revised_status
    db.session.add(review)
    db.session.commit()
    
    return jsonify({
        'review_id': review.id,
        'message': 'Review recorded successfully',
        'original_status': original_status,
        'revised_status': revised_status
    })

@api_bp.route('/export/markdown/<int:course_id>', methods=['GET'])
def export_markdown(course_id):
    course = CourseSchedule.query.get_or_404(course_id)
    assessment = RiskAssessment.query.filter_by(
        course_id=course.id
    ).order_by(RiskAssessment.assessment_date.desc()).first()
    
    if not assessment:
        return jsonify({'error': 'No risk assessment found for this course'}), 400
    
    exporter = MarkdownExporter()
    markdown_content = exporter.export_course(course, assessment)
    
    return jsonify({
        'course_id': course.id,
        'course_name': course.course_name,
        'markdown': markdown_content,
        'status': assessment.overall_status
    })

@api_bp.route('/export/audit/<int:course_id>', methods=['GET'])
def export_audit(course_id):
    course = CourseSchedule.query.get_or_404(course_id)
    
    exporter = AuditExporter()
    audit_package = exporter.export_course(course)
    
    return jsonify(audit_package)

@api_bp.route('/daily-summary', methods=['GET'])
def daily_summary():
    target_date = request.args.get('date')
    if target_date:
        target_date = datetime.strptime(target_date, '%Y-%m-%d').date()
    else:
        target_date = date.today()
    
    courses = CourseSchedule.query.filter_by(course_date=target_date).all()
    
    results = []
    for course in courses:
        assessment = RiskAssessment.query.filter_by(
            course_id=course.id
        ).order_by(RiskAssessment.assessment_date.desc()).first()
        
        participations = CourseParticipation.query.filter_by(course_id=course.id).all()
        
        results.append({
            'course_id': course.id,
            'course_name': course.course_name,
            'instructor': course.instructor.name if course.instructor else None,
            'dive_site': course.dive_site.name if course.dive_site else None,
            'student_count': len(participations),
            'assessment_status': assessment.overall_status if assessment else 'not_assessed',
            'course_status': course.status
        })
    
    return jsonify({
        'date': target_date.isoformat(),
        'total_courses': len(results),
        'courses': results
    })
