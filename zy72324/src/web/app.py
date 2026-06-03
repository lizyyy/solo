from flask import Flask, render_template, request, jsonify, redirect, url_for
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from src.models.database import SessionLocal, init_db
from src.utils.data_importer import DataImporter
from src.utils.matching_engine import VolunteerMatchingEngine, get_admission_traceability
from src.utils.workflow import BorderlineReviewManager, ThreeStepWorkflow

app = Flask(__name__)
app.config['SECRET_KEY'] = 'dev-key-for-demo'


@app.route('/')
def index():
    db = SessionLocal()
    
    from src.models.database import SampleList, AdmissionRecord, BorderlineCase, TeacherComment
    
    total_samples = db.query(SampleList).count()
    total_admissions = db.query(AdmissionRecord).count()
    pending_borderline = db.query(BorderlineCase).filter(
        BorderlineCase.status == 'pending'
    ).count()
    total_comments = db.query(TeacherComment).count()
    
    borderline_cases = db.query(BorderlineCase).filter(
        BorderlineCase.status == 'pending'
    ).limit(5).all()
    
    case_list = []
    for bc in borderline_cases:
        case_list.append({
            'id': bc.id,
            'student_id': bc.sample.student_id,
            'student_name': bc.sample.student_name,
            'case_type': bc.case_type,
            'original_value': bc.original_value
        })
    
    db.close()
    
    return render_template('index.html', 
                         total_samples=total_samples,
                         total_admissions=total_admissions,
                         pending_borderline=pending_borderline,
                         total_comments=total_comments,
                         borderline_cases=case_list)


@app.route('/samples')
def sample_list():
    db = SessionLocal()
    from src.models.database import SampleList
    
    samples = db.query(SampleList).limit(50).all()
    
    sample_list = []
    for s in samples:
        sample_list.append({
            'id': s.id,
            'student_id': s.student_id,
            'student_name': s.student_name,
            'raw_score': s.raw_score,
            'score': s.score,
            'remark': s.remark,
            'is_negative': s.is_negative,
            'is_missing': s.is_missing,
            'needs_review': s.needs_review
        })
    
    db.close()
    return render_template('samples.html', samples=sample_list)


@app.route('/sample/<int:sample_id>')
def sample_detail(sample_id):
    db = SessionLocal()
    trace = get_admission_traceability(db, sample_id)
    db.close()
    return render_template('sample_detail.html', trace=trace, sample_id=sample_id)


@app.route('/borderline')
def borderline_list():
    db = SessionLocal()
    manager = BorderlineReviewManager(db)
    cases = manager.get_pending_cases()
    db.close()
    return render_template('borderline.html', cases=cases)


@app.route('/borderline/<int:case_id>', methods=['GET', 'POST'])
def borderline_detail(case_id):
    db = SessionLocal()
    manager = BorderlineReviewManager(db)
    
    if request.method == 'POST':
        resolution = request.form.get('resolution')
        custom_value = request.form.get('custom_value')
        result = manager.resolve_case(case_id, resolution, 'web_user', custom_value)
        db.close()
        return redirect(url_for('borderline_list'))
    
    history = manager.get_case_history(case_id)
    db.close()
    return render_template('borderline_detail.html', case_id=case_id, history=history)


@app.route('/admission')
def admission_list():
    db = SessionLocal()
    from src.models.database import AdmissionRecord
    
    admissions = db.query(AdmissionRecord).limit(50).all()
    
    adm_list = []
    for a in admissions:
        adm_list.append({
            'id': a.id,
            'sample_id': a.sample_id,
            'student_id': a.sample.student_id,
            'student_name': a.sample.student_name,
            'matched_volunteer': a.matched_volunteer,
            'matched_major': a.matched_major,
            'is_borderline': a.is_borderline,
            'status': a.admission_status
        })
    
    db.close()
    return render_template('admission.html', admissions=adm_list)


@app.route('/run-matching', methods=['POST'])
def run_matching():
    db = SessionLocal()
    engine = VolunteerMatchingEngine(db)
    result = engine.run_matching()
    db.close()
    
    return jsonify({
        'total': result.total_samples,
        'matched': result.matched_samples,
        'borderline': result.borderline_samples,
        'skipped': result.skipped_samples
    })


@app.route('/api/trace/<int:sample_id>')
def api_trace(sample_id):
    db = SessionLocal()
    trace = get_admission_traceability(db, sample_id)
    db.close()
    return jsonify(trace)


if __name__ == '__main__':
    init_db()
    os.makedirs('src/web/templates', exist_ok=True)
    app.run(debug=True, port=5000)
