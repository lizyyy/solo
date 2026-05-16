from flask import request, jsonify
from datetime import datetime
from app import db
from app.api import bp
from app.models import (
    Report, ReportEvidence, ExecutionBatch, ErrorSample,
    CompressionExecution, EvidenceChain, ManualCorrection
)
from app.utils import ApiResponse, ErrorCode, generate_report_code, generate_rerun_flag

@bp.route('/reports', methods=['POST'])
def generate_report():
    data = request.get_json()
    if not data or 'batch_id' not in data or 'report_type' not in data:
        return ApiResponse.error(ErrorCode.PARAM_MISSING)
    
    batch_id = data['batch_id']
    report_type = data['report_type']
    generated_by = data.get('generated_by', 'system')
    
    batch = ExecutionBatch.query.filter_by(batch_id=batch_id).first()
    if not batch:
        return ApiResponse.error(ErrorCode.BATCH_NOT_FOUND)
    
    report_code = generate_report_code()
    
    executions = CompressionExecution.query.filter_by(batch_id=batch_id).all()
    error_samples = ErrorSample.query.filter_by(batch_id=batch_id).all()
    corrections = ManualCorrection.query.filter_by(batch_id=batch_id).all()
    
    success_count = len([e for e in executions if e.status == 'success'])
    error_count = len([e for e in executions if e.status != 'success'])
    
    report = Report(
        report_code=report_code,
        batch_id=batch_id,
        report_type=report_type,
        report_title=f'{report_type}_{batch_id}',
        generated_by=generated_by,
        total_samples=len(executions),
        error_samples=len(error_samples),
        success_samples=success_count,
        status='generated',
        review_status='pending'
    )
    db.session.add(report)
    db.session.flush()
    
    rerun_flag = generate_rerun_flag(report.id)
    sequence = 1
    
    for error in error_samples:
        execution = CompressionExecution.query.filter_by(
            batch_id=batch_id,
            supplier_code=error.supplier_code,
            id=error.execution_id
        ).first()
        
        input_data = f"供应商代码: {error.supplier_code}, 错误类型: {error.error_type}, 错误消息: {error.error_message}"
        action_taken = f"检测到错误样本，执行ID: {error.execution_id}"
        conclusion = f"该样本在执行过程中检测到异常，已记录并报告。风险类型: {batch.risk_type}"
        
        evidence = ReportEvidence(
            report_id=report.id,
            rerun_flag=rerun_flag,
            sequence_no=sequence,
            input_data=input_data,
            action_taken=action_taken,
            conclusion=conclusion,
            is_legal_review_sample=(sequence == 1)
        )
        db.session.add(evidence)
        sequence += 1
    
    if sequence == 1:
        sample_execution = executions[0] if executions else None
        if sample_execution:
            input_data = f"供应商代码: {sample_execution.supplier_code}, 策略代码: {sample_execution.strategy_code}"
            action_taken = f"压缩执行成功，压缩比: {sample_execution.compression_ratio}"
            conclusion = "该样本成功完成压缩处理，所有证据链验证通过。"
            
            evidence = ReportEvidence(
                report_id=report.id,
                rerun_flag=rerun_flag,
                sequence_no=1,
                input_data=input_data,
                action_taken=action_taken,
                conclusion=conclusion,
                is_legal_review_sample=True
            )
            db.session.add(evidence)
    
    for error in error_samples:
        error.report_id = report.id
    
    db.session.commit()
    
    return ApiResponse.success({
        'report_code': report_code,
        'report_id': report.id,
        'batch_id': batch_id,
        'rerun_flag': rerun_flag,
        'evidence_count': sequence - 1
    }, '报告生成成功')

@bp.route('/reports/<report_id>', methods=['GET'])
def get_report(report_id):
    report = Report.query.get(report_id)
    if not report:
        return ApiResponse.error(ErrorCode.REPORT_NOT_FOUND)
    
    evidences = ReportEvidence.query.filter_by(report_id=report_id).order_by(ReportEvidence.sequence_no).all()
    
    legal_sample = next((e for e in evidences if e.is_legal_review_sample), None)
    
    result = {
        'report': report.to_dict(),
        'evidences': [e.to_dict() for e in evidences],
        'legal_review_sample': legal_sample.to_dict() if legal_sample else None
    }
    
    return ApiResponse.success(result)

@bp.route('/reports/<report_id>/review', methods=['POST'])
def review_report(report_id):
    data = request.get_json()
    if not data or 'reviewed_by' not in data:
        return ApiResponse.error(ErrorCode.PARAM_MISSING)
    
    report = Report.query.get(report_id)
    if not report:
        return ApiResponse.error(ErrorCode.REPORT_NOT_FOUND)
    
    report.review_status = 'reviewed'
    report.reviewed_by = data['reviewed_by']
    report.reviewed_at = datetime.utcnow()
    report.review_notes = data.get('review_notes')
    
    db.session.commit()
    
    return ApiResponse.success(report.to_dict(), '报告复核完成')

@bp.route('/reports/code/<report_code>', methods=['GET'])
def get_report_by_code(report_code):
    report = Report.query.filter_by(report_code=report_code).first()
    if not report:
        return ApiResponse.error(ErrorCode.REPORT_NOT_FOUND)
    
    return get_report(report.id)

@bp.route('/reports', methods=['GET'])
def list_reports():
    batch_id = request.args.get('batch_id')
    review_status = request.args.get('review_status')
    
    query = Report.query
    if batch_id:
        query = query.filter_by(batch_id=batch_id)
    if review_status:
        query = query.filter_by(review_status=review_status)
    
    reports = query.order_by(Report.generated_at.desc()).all()
    
    return ApiResponse.success([r.to_dict() for r in reports])

@bp.route('/reports/rerun/<rerun_flag>', methods=['GET'])
def get_evidences_by_rerun_flag(rerun_flag):
    evidences = ReportEvidence.query.filter_by(rerun_flag=rerun_flag).order_by(ReportEvidence.sequence_no).all()
    
    report = Report.query.get(evidences[0].report_id) if evidences else None
    
    return ApiResponse.success({
        'rerun_flag': rerun_flag,
        'report': report.to_dict() if report else None,
        'evidence_count': len(evidences),
        'evidences': [e.to_dict() for e in evidences]
    })
