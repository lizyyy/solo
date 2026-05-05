from app import db
from datetime import datetime
import json


class TestReport(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    report_name = db.Column(db.String(255), nullable=False)
    test_suite = db.Column(db.String(255))
    module = db.Column(db.String(255))
    owner = db.Column(db.String(100))
    total_tests = db.Column(db.Integer, default=0)
    passed = db.Column(db.Integer, default=0)
    failed = db.Column(db.Integer, default=0)
    skipped = db.Column(db.Integer, default=0)
    errors = db.Column(db.Integer, default=0)
    duration = db.Column(db.Float, default=0.0)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    test_cases = db.relationship('TestCase', backref='test_report', lazy='dynamic', cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'report_name': self.report_name,
            'test_suite': self.test_suite,
            'module': self.module,
            'owner': self.owner,
            'total_tests': self.total_tests,
            'passed': self.passed,
            'failed': self.failed,
            'skipped': self.skipped,
            'errors': self.errors,
            'duration': self.duration,
            'timestamp': self.timestamp.isoformat() if self.timestamp else None,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class TestCase(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    test_report_id = db.Column(db.Integer, db.ForeignKey('test_report.id'), nullable=False)
    classname = db.Column(db.String(500))
    name = db.Column(db.String(500), nullable=False)
    full_name = db.Column(db.String(1000))
    module = db.Column(db.String(255))
    owner = db.Column(db.String(100))
    status = db.Column(db.String(50), nullable=False)
    duration = db.Column(db.Float, default=0.0)
    message = db.Column(db.Text)
    error_type = db.Column(db.String(255))
    error_message = db.Column(db.Text)
    error_traceback = db.Column(db.Text)
    stdout = db.Column(db.Text)
    stderr = db.Column(db.Text)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'test_report_id': self.test_report_id,
            'classname': self.classname,
            'name': self.name,
            'full_name': self.full_name,
            'module': self.module,
            'owner': self.owner,
            'status': self.status,
            'duration': self.duration,
            'message': self.message,
            'error_type': self.error_type,
            'error_message': self.error_message,
            'stdout': self.stdout,
            'stderr': self.stderr,
            'timestamp': self.timestamp.isoformat() if self.timestamp else None
        }


class CoverageReport(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    report_name = db.Column(db.String(255), nullable=False)
    module = db.Column(db.String(255))
    owner = db.Column(db.String(100))
    total_lines = db.Column(db.Integer, default=0)
    covered_lines = db.Column(db.Integer, default=0)
    missed_lines = db.Column(db.Integer, default=0)
    line_coverage = db.Column(db.Float, default=0.0)
    total_branches = db.Column(db.Integer, default=0)
    covered_branches = db.Column(db.Integer, default=0)
    branch_coverage = db.Column(db.Float, default=0.0)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    files = db.relationship('CoverageFile', backref='coverage_report', lazy='dynamic', cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'report_name': self.report_name,
            'module': self.module,
            'owner': self.owner,
            'total_lines': self.total_lines,
            'covered_lines': self.covered_lines,
            'missed_lines': self.missed_lines,
            'line_coverage': self.line_coverage,
            'total_branches': self.total_branches,
            'covered_branches': self.covered_branches,
            'branch_coverage': self.branch_coverage,
            'timestamp': self.timestamp.isoformat() if self.timestamp else None
        }


class CoverageFile(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    coverage_report_id = db.Column(db.Integer, db.ForeignKey('coverage_report.id'), nullable=False)
    file_path = db.Column(db.String(500), nullable=False)
    module = db.Column(db.String(255))
    owner = db.Column(db.String(100))
    total_lines = db.Column(db.Integer, default=0)
    covered_lines = db.Column(db.Integer, default=0)
    missed_lines = db.Column(db.Integer, default=0)
    line_coverage = db.Column(db.Float, default=0.0)
    total_branches = db.Column(db.Integer, default=0)
    covered_branches = db.Column(db.Integer, default=0)
    branch_coverage = db.Column(db.Float, default=0.0)
    missed_lines_list = db.Column(db.Text)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    
    def set_missed_lines(self, lines):
        self.missed_lines_list = json.dumps(lines) if lines else None
    
    def get_missed_lines(self):
        return json.loads(self.missed_lines_list) if self.missed_lines_list else []
    
    def to_dict(self):
        return {
            'id': self.id,
            'coverage_report_id': self.coverage_report_id,
            'file_path': self.file_path,
            'module': self.module,
            'owner': self.owner,
            'total_lines': self.total_lines,
            'covered_lines': self.covered_lines,
            'missed_lines': self.missed_lines,
            'line_coverage': self.line_coverage,
            'total_branches': self.total_branches,
            'covered_branches': self.covered_branches,
            'branch_coverage': self.branch_coverage,
            'missed_lines_list': self.get_missed_lines(),
            'timestamp': self.timestamp.isoformat() if self.timestamp else None
        }


class FlakyRun(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    test_name = db.Column(db.String(1000), nullable=False)
    full_name = db.Column(db.String(1000))
    module = db.Column(db.String(255))
    owner = db.Column(db.String(100))
    run_count = db.Column(db.Integer, default=0)
    pass_count = db.Column(db.Integer, default=0)
    fail_count = db.Column(db.Integer, default=0)
    flaky_rate = db.Column(db.Float, default=0.0)
    first_attempt_status = db.Column(db.String(50))
    last_attempt_status = db.Column(db.String(50))
    retry_count = db.Column(db.Integer, default=0)
    max_retry_count = db.Column(db.Integer, default=0)
    error_messages = db.Column(db.Text)
    ci_run_id = db.Column(db.String(255))
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def set_error_messages(self, errors):
        self.error_messages = json.dumps(errors) if errors else None
    
    def get_error_messages(self):
        return json.loads(self.error_messages) if self.error_messages else []
    
    def to_dict(self):
        return {
            'id': self.id,
            'test_name': self.test_name,
            'full_name': self.full_name,
            'module': self.module,
            'owner': self.owner,
            'run_count': self.run_count,
            'pass_count': self.pass_count,
            'fail_count': self.fail_count,
            'flaky_rate': self.flaky_rate,
            'first_attempt_status': self.first_attempt_status,
            'last_attempt_status': self.last_attempt_status,
            'retry_count': self.retry_count,
            'max_retry_count': self.max_retry_count,
            'error_messages': self.get_error_messages(),
            'ci_run_id': self.ci_run_id,
            'timestamp': self.timestamp.isoformat() if self.timestamp else None
        }


class Quarantine(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    test_name = db.Column(db.String(1000), nullable=False, unique=True)
    full_name = db.Column(db.String(1000))
    module = db.Column(db.String(255))
    owner = db.Column(db.String(100))
    reason = db.Column(db.Text, nullable=False)
    reason_category = db.Column(db.String(100))
    added_by = db.Column(db.String(100))
    added_at = db.Column(db.DateTime, default=datetime.utcnow)
    expected_fix_date = db.Column(db.DateTime)
    is_active = db.Column(db.Boolean, default=True)
    deactivated_at = db.Column(db.DateTime)
    deactivated_by = db.Column(db.String(100))
    deactivation_reason = db.Column(db.Text)
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'test_name': self.test_name,
            'full_name': self.full_name,
            'module': self.module,
            'owner': self.owner,
            'reason': self.reason,
            'reason_category': self.reason_category,
            'added_by': self.added_by,
            'added_at': self.added_at.isoformat() if self.added_at else None,
            'expected_fix_date': self.expected_fix_date.isoformat() if self.expected_fix_date else None,
            'is_active': self.is_active,
            'deactivated_at': self.deactivated_at.isoformat() if self.deactivated_at else None,
            'deactivated_by': self.deactivated_by,
            'deactivation_reason': self.deactivation_reason,
            'notes': self.notes
        }
