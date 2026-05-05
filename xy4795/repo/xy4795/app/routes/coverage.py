from flask import Blueprint, request, jsonify
from app.models import CoverageReport, CoverageFile
from app.services.coverage_parser import import_coverage_report
from app import db

coverage_bp = Blueprint('coverage', __name__)


@coverage_bp.route('', methods=['GET'])
def get_coverage_reports():
    module = request.args.get('module')
    owner = request.args.get('owner')
    limit = request.args.get('limit', 10, type=int)
    
    query = CoverageReport.query
    
    if module:
        query = query.filter(CoverageReport.module == module)
    if owner:
        query = query.filter(CoverageReport.owner == owner)
    
    reports = query.order_by(CoverageReport.timestamp.desc()).limit(limit).all()
    
    return jsonify({
        'count': len(reports),
        'reports': [r.to_dict() for r in reports]
    })


@coverage_bp.route('/<int:report_id>', methods=['GET'])
def get_coverage_report(report_id):
    report = CoverageReport.query.get_or_404(report_id)
    return jsonify(report.to_dict())


@coverage_bp.route('/<int:report_id>/files', methods=['GET'])
def get_coverage_files(report_id):
    report = CoverageReport.query.get_or_404(report_id)
    module = request.args.get('module')
    owner = request.args.get('owner')
    below_target = request.args.get('below_target', type=float)
    
    query = CoverageFile.query.filter_by(coverage_report_id=report_id)
    
    if module:
        query = query.filter(CoverageFile.module == module)
    if owner:
        query = query.filter(CoverageFile.owner == owner)
    if below_target is not None:
        query = query.filter(CoverageFile.line_coverage < below_target)
    
    files = query.order_by(CoverageFile.line_coverage.asc()).all()
    
    return jsonify({
        'report_id': report_id,
        'count': len(files),
        'files': [f.to_dict() for f in files]
    })


@coverage_bp.route('/import', methods=['POST'])
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
        
        report = import_coverage_report(xml_content, report_name, module, owner)
        
        return jsonify({
            'success': True,
            'message': 'Coverage report imported successfully',
            'report': report.to_dict()
        }), 201
    except Exception as e:
        return jsonify({'error': f'Failed to import coverage report: {str(e)}'}), 500


@coverage_bp.route('/<int:report_id>', methods=['DELETE'])
def delete_report(report_id):
    report = CoverageReport.query.get_or_404(report_id)
    
    db.session.delete(report)
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': f'Coverage report {report_id} deleted successfully'
    })


@coverage_bp.route('/files/<int:file_id>', methods=['GET'])
def get_coverage_file(file_id):
    file = CoverageFile.query.get_or_404(file_id)
    return jsonify(file.to_dict())


@coverage_bp.route('/latest', methods=['GET'])
def get_latest_coverage():
    module = request.args.get('module')
    owner = request.args.get('owner')
    
    query = CoverageReport.query
    
    if module:
        query = query.filter(CoverageReport.module == module)
    if owner:
        query = query.filter(CoverageReport.owner == owner)
    
    latest = query.order_by(CoverageReport.timestamp.desc()).first()
    
    if not latest:
        return jsonify({'error': 'No coverage reports found'}), 404
    
    return jsonify(latest.to_dict())
