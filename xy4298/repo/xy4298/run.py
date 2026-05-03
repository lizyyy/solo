from app import create_app, db
from app.models import Scaffold, ErectionApplication, AcceptanceRecord, RectificationRecord, WorkPermit
from datetime import datetime, timedelta

app = create_app()

@app.cli.command()
def initdb():
    """Initialize the database."""
    db.create_all()
    print('Database initialized.')

@app.cli.command()
def load_samples():
    """Load sample data into the database."""
    _load_sample_scaffolds()
    _load_sample_erection_applications()
    _load_sample_acceptance_records()
    _load_sample_rectification_records()
    _load_sample_work_permits()
    print('Sample data loaded successfully.')

def _load_sample_scaffolds():
    scaffolds = [
        {'scaffold_no': 'SF-2026-001', 'area': '船坞A区', 'location': '1号货舱左舷', 'height': 15.5, 'type': '门式脚手架', 'status': 'accepted'},
        {'scaffold_no': 'SF-2026-002', 'area': '船坞A区', 'location': '1号货舱右舷', 'height': 18.0, 'type': '门式脚手架', 'status': 'overdue'},
        {'scaffold_no': 'SF-2026-003', 'area': '船坞B区', 'location': '主机舱上部', 'height': 8.0, 'type': '扣件式脚手架', 'status': 'rectifying'},
        {'scaffold_no': 'SF-2026-004', 'area': '舾装码头', 'location': '上层建筑前端', 'height': 25.0, 'type': '悬挑式脚手架', 'status': 'accepted'},
        {'scaffold_no': 'SF-2026-005', 'area': '船坞A区', 'location': '2号货舱底部', 'height': 5.0, 'type': '移动式脚手架', 'status': 'disabled'},
    ]
    
    for sc in scaffolds:
        existing = Scaffold.query.filter_by(scaffold_no=sc['scaffold_no']).first()
        if not existing:
            scaffold = Scaffold(**sc)
            db.session.add(scaffold)
    db.session.commit()

def _load_sample_erection_applications():
    applications = [
        {'application_no': 'EA-2026-0428', 'scaffold_no': 'SF-2026-001', 'applicant': '张三', 'department': '船体车间', 'application_date': datetime(2026, 4, 20), 'expected_erection_date': datetime(2026, 4, 25), 'description': '1号货舱左舷外板涂装作业脚手架', 'status': 'approved'},
        {'application_no': 'EA-2026-0429', 'scaffold_no': 'SF-2026-002', 'applicant': '李四', 'department': '船体车间', 'application_date': datetime(2026, 3, 15), 'expected_erection_date': datetime(2026, 3, 20), 'description': '1号货舱右舷结构检查脚手架', 'status': 'approved'},
        {'application_no': 'EA-2026-0430', 'scaffold_no': 'SF-2026-003', 'applicant': '王五', 'department': '轮机车间', 'application_date': datetime(2026, 4, 10), 'expected_erection_date': datetime(2026, 4, 15), 'description': '主机舱上部管道安装脚手架', 'status': 'approved'},
        {'application_no': 'EA-2026-0431', 'scaffold_no': 'SF-2026-004', 'applicant': '赵六', 'department': '舾装车间', 'application_date': datetime(2026, 4, 25), 'expected_erection_date': datetime(2026, 4, 28), 'description': '上层建筑外部装修脚手架', 'status': 'approved'},
    ]
    
    for app in applications:
        scaffold = Scaffold.query.filter_by(scaffold_no=app['scaffold_no']).first()
        if scaffold:
            existing = ErectionApplication.query.filter_by(application_no=app['application_no']).first()
            if not existing:
                app_data = app.copy()
                app_data['scaffold_id'] = scaffold.id
                del app_data['scaffold_no']
                application = ErectionApplication(**app_data)
                db.session.add(application)
    db.session.commit()

def _load_sample_acceptance_records():
    today = datetime.utcnow()
    records = [
        {
            'acceptance_no': 'AC-2026-0428', 'scaffold_no': 'SF-2026-001',
            'acceptance_date': datetime(2026, 4, 28),
            'next_reinspection_date': today + timedelta(days=25),
            'inspector': '验收员甲',
            'photos': ['photo_001.jpg', 'photo_002.jpg'],
            'issues_found': '',
            'status': 'accepted'
        },
        {
            'acceptance_no': 'AC-2026-0320', 'scaffold_no': 'SF-2026-002',
            'acceptance_date': datetime(2026, 3, 20),
            'next_reinspection_date': datetime(2026, 4, 19),
            'inspector': '验收员乙',
            'photos': ['photo_003.jpg'],
            'issues_found': '',
            'status': 'accepted'
        },
        {
            'acceptance_no': 'AC-2026-0415', 'scaffold_no': 'SF-2026-003',
            'acceptance_date': datetime(2026, 4, 15),
            'next_reinspection_date': today + timedelta(days=10),
            'inspector': '验收员丙',
            'photos': ['photo_004.jpg', 'photo_005.jpg'],
            'issues_found': '部分扣件松动，需整改',
            'status': 'accepted'
        },
        {
            'acceptance_no': 'AC-2026-0429', 'scaffold_no': 'SF-2026-004',
            'acceptance_date': datetime(2026, 4, 29),
            'next_reinspection_date': today + timedelta(days=29),
            'inspector': '验收员甲',
            'photos': ['photo_006.jpg', 'photo_007.jpg', 'photo_008.jpg'],
            'issues_found': '',
            'status': 'accepted'
        },
        {
            'acceptance_no': 'AC-2026-0401', 'scaffold_no': 'SF-2026-005',
            'acceptance_date': datetime(2026, 4, 1),
            'next_reinspection_date': datetime(2026, 5, 1),
            'inspector': '验收员丁',
            'photos': ['photo_009.jpg'],
            'issues_found': '底部轮架损坏，存在安全隐患',
            'status': 'accepted'
        },
    ]
    
    for rec in records:
        scaffold = Scaffold.query.filter_by(scaffold_no=rec['scaffold_no']).first()
        if scaffold:
            existing = AcceptanceRecord.query.filter_by(acceptance_no=rec['acceptance_no']).first()
            if not existing:
                rec_data = rec.copy()
                rec_data['scaffold_id'] = scaffold.id
                del rec_data['scaffold_no']
                acceptance = AcceptanceRecord(**rec_data)
                db.session.add(acceptance)
    db.session.commit()

def _load_sample_rectification_records():
    records = [
        {
            'rectification_no': 'REC-2026-001', 'scaffold_no': 'SF-2026-003',
            'issue_description': '主机舱脚手架3处扣件松动，脚手板有探头板',
            'issue_date': datetime(2026, 4, 26),
            'responsible_person': '王五',
            'deadline': datetime(2026, 4, 29),
            'rectification_date': None,
            'rectification_measures': '',
            'verifier': '',
            'status': 'pending'
        },
        {
            'rectification_no': 'REC-2026-002', 'scaffold_no': 'SF-2026-005',
            'issue_description': '移动式脚手架轮架损坏，无法正常移动，需更换',
            'issue_date': datetime(2026, 4, 20),
            'responsible_person': '钱七',
            'deadline': datetime(2026, 4, 25),
            'rectification_date': None,
            'rectification_measures': '',
            'verifier': '',
            'status': 'pending'
        },
        {
            'rectification_no': 'REC-2026-003', 'scaffold_no': 'SF-2026-002',
            'issue_description': '脚手架超期未复验，存在安全风险',
            'issue_date': datetime(2026, 4, 20),
            'responsible_person': '李四',
            'deadline': datetime(2026, 5, 5),
            'rectification_date': None,
            'rectification_measures': '',
            'verifier': '',
            'status': 'pending'
        },
    ]
    
    for rec in records:
        scaffold = Scaffold.query.filter_by(scaffold_no=rec['scaffold_no']).first()
        existing = RectificationRecord.query.filter_by(rectification_no=rec['rectification_no']).first()
        if not existing:
            rec_data = rec.copy()
            if scaffold:
                rec_data['scaffold_id'] = scaffold.id
            del rec_data['scaffold_no']
            rectification = RectificationRecord(**rec_data)
            db.session.add(rectification)
    db.session.commit()

def _load_sample_work_permits():
    today = datetime.utcnow()
    permits = [
        {
            'permit_no': 'WP-2026-001', 'scaffold_no': 'SF-2026-001',
            'work_type': 'high_altitude', 'area': '船坞A区',
            'location': '1号货舱左舷',
            'start_time': today.replace(hour=8, minute=0),
            'end_time': today.replace(hour=17, minute=0),
            'applicant': '张三', 'supervisor': '刘工长',
            'safety_measures': '系安全带，设监护人',
            'status': 'active'
        },
        {
            'permit_no': 'WP-2026-002', 'scaffold_no': 'SF-2026-001',
            'work_type': 'hot_work', 'area': '船坞A区',
            'location': '1号货舱左舷附近',
            'start_time': today.replace(hour=9, minute=0),
            'end_time': today.replace(hour=16, minute=0),
            'applicant': '焊工甲', 'supervisor': '王工长',
            'safety_measures': '配备灭火器，清理易燃物',
            'status': 'active'
        },
        {
            'permit_no': 'WP-2026-003', 'scaffold_no': 'SF-2026-004',
            'work_type': 'high_altitude', 'area': '舾装码头',
            'location': '上层建筑前端',
            'start_time': today.replace(hour=8, minute=30),
            'end_time': today.replace(hour=17, minute=30),
            'applicant': '赵六', 'supervisor': '陈工长',
            'safety_measures': '双钩安全带，生命线防护',
            'status': 'active'
        },
        {
            'permit_no': 'WP-2026-004', 'scaffold_no': 'SF-2026-003',
            'work_type': 'confined_space', 'area': '船坞B区',
            'location': '主机舱内部',
            'start_time': today.replace(hour=7, minute=30),
            'end_time': today.replace(hour=18, minute=0),
            'applicant': '王五', 'supervisor': '李工长',
            'safety_measures': '气体检测，通风，双人监护',
            'status': 'active'
        },
        {
            'permit_no': 'WP-2026-005', 'scaffold_no': 'SF-2026-002',
            'work_type': 'lifting', 'area': '船坞A区',
            'location': '1号货舱右舷上方',
            'start_time': today.replace(hour=10, minute=0),
            'end_time': today.replace(hour=15, minute=0),
            'applicant': '吊车司机', 'supervisor': '张工长',
            'safety_measures': '设警戒区，信号工指挥',
            'status': 'active'
        },
    ]
    
    for per in permits:
        scaffold = Scaffold.query.filter_by(scaffold_no=per['scaffold_no']).first()
        existing = WorkPermit.query.filter_by(permit_no=per['permit_no']).first()
        if not existing:
            per_data = per.copy()
            if scaffold:
                per_data['scaffold_id'] = scaffold.id
            del per_data['scaffold_no']
            permit = WorkPermit(**per_data)
            db.session.add(permit)
    db.session.commit()

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5001)
