import os
from flask import Flask, request, jsonify, render_template, send_from_directory
from config import Config
from models import db, ManualCorrectionSheet, ReviewSample, PromptVersion
from services.import_service import ImportService
from services.prompt_service import PromptService
from services.confidence_service import ConfidenceService
from services.workflow_service import WorkflowService
from services.visualization_service import VisualizationService


def create_app():
    app = Flask(__name__, 
                template_folder='templates',
                static_folder='static')
    app.config.from_object(Config)
    
    db.init_app(app)
    
    with app.app_context():
        db.create_all()
    
    @app.route('/')
    def index():
        return render_template('index.html')
    
    @app.route('/api/sheets', methods=['GET'])
    def list_sheets():
        sheets = ManualCorrectionSheet.query.order_by(
            ManualCorrectionSheet.imported_at.desc()
        ).all()
        return jsonify([{
            'id': s.id,
            'sheet_name': s.sheet_name,
            'version': s.version,
            'imported_by': s.imported_by,
            'imported_at': s.imported_at.isoformat(),
            'total_samples': s.total_samples,
            'is_current': s.is_current,
            'change_history_count': len(s.change_history)
        } for s in sheets])
    
    @app.route('/api/sheets/<int:sheet_id>', methods=['GET'])
    def get_sheet(sheet_id):
        sheet = ManualCorrectionSheet.query.get_or_404(sheet_id)
        workflow = WorkflowService.get_workflow(sheet_id)
        progress = WorkflowService.get_workflow_progress(sheet_id) if workflow else None
        
        return jsonify({
            'id': sheet.id,
            'sheet_name': sheet.sheet_name,
            'version': sheet.version,
            'file_hash': sheet.file_hash,
            'imported_by': sheet.imported_by,
            'imported_at': sheet.imported_at.isoformat(),
            'total_samples': sheet.total_samples,
            'workflow_progress': progress,
            'change_history': [{
                'id': h.id,
                'changed_by': h.changed_by,
                'changed_at': h.changed_at.isoformat(),
                'change_type': h.change_type,
                'change_summary': h.change_summary
            } for h in sheet.change_history]
        })
    
    @app.route('/api/sheets/import', methods=['POST'])
    def import_sheet():
        if 'file' not in request.files:
            return jsonify({'error': '未上传文件'}), 400
        
        file = request.files['file']
        sheet_name = request.form.get('sheet_name', file.filename)
        imported_by = request.form.get('imported_by', 'system')
        
        temp_path = f'/tmp/{file.filename}'
        file.save(temp_path)
        
        try:
            result = ImportService.import_correction_sheet(
                temp_path, sheet_name, imported_by
            )
            
            if result['success']:
                sheet_id = result['sheet_id']
                WorkflowService.init_workflow(sheet_id)
                ConfidenceService.detect_low_confidence_samples(sheet_id)
                ConfidenceService.check_average_masking(sheet_id)
            
            return jsonify(result)
        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)
    
    @app.route('/api/sheets/<int:sheet_id>/samples', methods=['GET'])
    def list_samples(sheet_id):
        status = request.args.get('status')
        only_low_conf = request.args.get('only_low_conf', 'false').lower() == 'true'
        only_masked = request.args.get('only_masked', 'false').lower() == 'true'
        
        query = ReviewSample.query.filter_by(correction_sheet_id=sheet_id)
        
        if status:
            query = query.filter_by(status=status)
        if only_low_conf:
            query = query.filter_by(is_low_confidence=True)
        if only_masked:
            query = query.filter_by(masked_by_average=True)
        
        samples = query.all()
        
        return jsonify([{
            'id': s.id,
            'unique_key': s.unique_key,
            'original_text': s.original_text,
            'model_prediction': s.model_prediction,
            'model_confidence': s.model_confidence,
            'manual_label': s.manual_label,
            'status': s.status,
            'is_low_confidence': s.is_low_confidence,
            'masked_by_average': s.masked_by_average,
            'kb_reviewed': s.kb_reviewed,
            'raw_remark': s.raw_remark,
            'prompt_version_id': s.prompt_version_id
        } for s in samples])
    
    @app.route('/api/samples/<int:sample_id>', methods=['GET'])
    def get_sample(sample_id):
        sample = ReviewSample.query.get_or_404(sample_id)
        return jsonify(VisualizationService._get_sample_evidence_link(sample))
    
    @app.route('/api/samples/<int:sample_id>/history', methods=['GET'])
    def get_sample_history(sample_id):
        history = ConfidenceService.get_sample_change_history(sample_id)
        return jsonify([{
            'id': h.id,
            'changed_by': h.changed_by,
            'changed_at': h.changed_at.isoformat(),
            'change_type': h.change_type,
            'field_name': h.field_name,
            'old_value': h.old_value,
            'new_value': h.new_value,
            'old_status': h.old_status,
            'new_status': h.new_status,
            'rollback_from_id': h.rollback_from_id
        } for h in history])
    
    @app.route('/api/samples/<int:sample_id>/kb-review', methods=['POST'])
    def kb_review_sample(sample_id):
        data = request.json
        kb_editor = data.get('kb_editor', 'unknown')
        decision = data.get('decision')
        remark = data.get('remark')
        
        if decision not in Config.SAMPLE_STATUS:
            return jsonify({'error': f'无效的状态: {decision}'}), 400
        
        result = ConfidenceService.kb_review_sample(sample_id, kb_editor, decision, remark)
        if not result:
            return jsonify({'error': '样本不存在'}), 404
        
        return jsonify({'success': True, 'sample': VisualizationService._get_sample_evidence_link(result)})
    
    @app.route('/api/samples/<int:sample_id>/rollback', methods=['POST'])
    def rollback_sample(sample_id):
        data = request.json or {}
        rolled_by = data.get('rolled_by', 'unknown')
        reason = data.get('reason')
        
        result = ConfidenceService.rollback_sample(sample_id, rolled_by, reason)
        if not result:
            return jsonify({'error': '无法回滚：历史记录不足或样本不存在'}), 400
        
        return jsonify({'success': True, 'sample': VisualizationService._get_sample_evidence_link(result)})
    
    @app.route('/api/samples/<int:sample_id>/link-prompt', methods=['POST'])
    def link_prompt(sample_id):
        data = request.json
        prompt_version_id = data.get('prompt_version_id')
        linked_by = data.get('linked_by', 'unknown')
        
        if not prompt_version_id:
            return jsonify({'error': '缺少prompt_version_id'}), 400
        
        count = PromptService.link_samples_to_prompt([sample_id], prompt_version_id, linked_by)
        return jsonify({'success': True, 'linked_count': count})
    
    @app.route('/api/prompts', methods=['GET'])
    def list_prompts():
        prompts = PromptService.list_prompt_versions()
        return jsonify([{
            'id': p.id,
            'version_number': p.version_number,
            'prompt_text': p.prompt_text,
            'remark': p.remark,
            'created_by': p.created_by,
            'created_at': p.created_at.isoformat(),
            'model_version': p.model_version
        } for p in prompts])
    
    @app.route('/api/prompts', methods=['POST'])
    def create_prompt():
        data = request.json
        prompt = PromptService.create_prompt_version(
            version_number=data['version_number'],
            prompt_text=data['prompt_text'],
            created_by=data.get('created_by', 'unknown'),
            remark=data.get('remark'),
            model_version=data.get('model_version')
        )
        return jsonify({'success': True, 'prompt_id': prompt.id})
    
    @app.route('/api/prompts/<int:prompt_id>', methods=['GET'])
    def get_prompt(prompt_id):
        prompt = PromptService.get_prompt_version(prompt_id)
        if not prompt:
            return jsonify({'error': '提示词版本不存在'}), 404
        
        samples = PromptService.get_samples_with_prompt_version(prompt_id)
        
        return jsonify({
            'id': prompt.id,
            'version_number': prompt.version_number,
            'prompt_text': prompt.prompt_text,
            'remark': prompt.remark,
            'created_by': prompt.created_by,
            'created_at': prompt.created_at.isoformat(),
            'model_version': prompt.model_version,
            'linked_samples_count': len(samples),
            'linked_samples': [{'id': s.id, 'unique_key': s.unique_key} for s in samples]
        })
    
    @app.route('/api/workflows/<int:sheet_id>', methods=['GET'])
    def get_workflow(sheet_id):
        progress = WorkflowService.get_workflow_progress(sheet_id)
        if not progress:
            return jsonify({'error': '工作流不存在'}), 404
        return jsonify(progress)
    
    @app.route('/api/workflows/<int:sheet_id>/complete-step', methods=['POST'])
    def complete_workflow_step(sheet_id):
        data = request.json
        step_name = data.get('step_name')
        completed_by = data.get('completed_by', 'unknown')
        user_role = data.get('user_role', 'annotator')
        
        if step_name == 'step2_review_prompt':
            ConfidenceService.detect_low_confidence_samples(sheet_id)
            ConfidenceService.check_average_masking(sheet_id)
        
        success, message = WorkflowService.complete_step(
            sheet_id, step_name, completed_by, user_role
        )
        return jsonify({'success': success, 'message': message})
    
    @app.route('/api/visualization/confidence-distribution/<int:sheet_id>', methods=['GET'])
    def viz_confidence_distribution(sheet_id):
        return jsonify(VisualizationService.get_confidence_distribution(sheet_id))
    
    @app.route('/api/visualization/status-summary/<int:sheet_id>', methods=['GET'])
    def viz_status_summary(sheet_id):
        return jsonify(VisualizationService.get_status_summary(sheet_id))
    
    @app.route('/api/visualization/masked-samples/<int:sheet_id>', methods=['GET'])
    def viz_masked_samples(sheet_id):
        return jsonify(VisualizationService.get_masked_samples_detail(sheet_id))
    
    @app.route('/api/visualization/workflow-overview', methods=['GET'])
    def viz_workflow_overview():
        return jsonify(VisualizationService.get_workflow_overview())
    
    return app


if __name__ == '__main__':
    app = create_app()
    app.run(debug=True, host='0.0.0.0', port=5001)
