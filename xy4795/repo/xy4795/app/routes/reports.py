from flask import Blueprint, request, jsonify
from app.models import TestReport, TestCase
from app.services.pytest_parser import import_pytest_report
from app import db
from datetime import datetime

reports_bp = Blueprint('reports', __name__)


@reports_bp.route('', methods=['GET'])
def get_reports():
    module = request.args.get('module')
    owner = request.args.get('owner')
    limit = request.args.get('limit', 20, type=int)
    
    query = TestReport.query
    
    if module:
        query = query.filter(TestReport.module == module)
    if owner:
        query = query.filter(TestReport.owner == owner)
    
    reports = query.order_by(TestReport.timestamp.desc()).limit(limit).all()
    
    return jsonify({
        'count': len(reports),
        'reports': [r.to_dict() for r in reports]
    })


@reports_bp.route('/<int:report_id>', methods=['GET'])
def get_report(report_id):
    report = TestReport.query.get_or_404(report_id)
    return jsonify(report.to_dict())


@reports_bp.route('/<int:report_id>/test-cases', methods=['GET'])
def get_report_test_cases(report_id):
    report = TestReport.query.get_or_404(report_id)
    status = request.args.get('status')
    
    query = TestCase.query.filter_by(test_report_id=report_id)
    
    if status:
        query = query.filter(TestCase.status == status)
    
    test_cases = query.all()
    
    return jsonify({
        'report_id': report_id,
        'count': len(test_cases),
        'test_cases': [tc.to_dict() for tc in test_cases]
    })


@reports_bp.route('/import', methods=['POST'])
def import_report():
    if 'file' in request.files:
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No selected file'}), 400
        
        xml_content = file.read()
    elif request.data:
        xml_content = request.data
    else:
        return jsonify({'error': 'No XML content provided'}), 400
    
    report_name = request.form.get('report_name') if request.form else None
    if not report_name:
        report_name = request.args.get('report_name')
    if not report_name and 'file' in request.files:
        report_name = request.files['file'].filename
    
    module = request.form.get('module') if request.form else None
    if not module:
        module = request.args.get('module')
    
    owner = request.form.get('owner') if request.form else None
    if not owner:
        owner = request.args.get('owner')
    
    try:
        if isinstance(xml_content, bytes):
            xml_content = xml_content.decode('utf-8')
        
        report = import_pytest_report(xml_content, report_name, module, owner)
        
        return jsonify({
            'success': True,
            'message': 'Test report imported successfully',
            'report': report.to_dict()
        }), 201
    except Exception as e:
        return jsonify({'error': f'Failed to import report: {str(e)}'}), 500


@reports_bp.route('/<int:report_id>', methods=['DELETE'])
def delete_report(report_id):
    report = TestReport.query.get_or_404(report_id)
    
    db.session.delete(report)
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': f'Report {report_id} deleted successfully'
    })


@reports_bp.route('/test-cases/<int:test_case_id>', methods=['GET'])
def get_test_case(test_case_id):
    test_case = TestCase.query.get_or_404(test_case_id)
    return jsonify(test_case.to_dict())
