from models import ReviewSample, ManualCorrectionSheet, PromptVersion
from config import Config


class VisualizationService:
    
    @staticmethod
    def get_confidence_distribution(sheet_id=None):
        query = ReviewSample.query
        if sheet_id:
            query = query.filter_by(correction_sheet_id=sheet_id)
        
        samples = query.all()
        
        bins = {
            '0.0-0.3': [],
            '0.3-0.5': [],
            '0.5-0.7': [],
            '0.7-0.9': [],
            '0.9-1.0': []
        }
        
        for sample in samples:
            if sample.model_confidence is None:
                continue
            
            conf = sample.model_confidence
            sample_data = VisualizationService._get_sample_evidence_link(sample)
            
            if conf < 0.3:
                bins['0.0-0.3'].append(sample_data)
            elif conf < 0.5:
                bins['0.3-0.5'].append(sample_data)
            elif conf < 0.7:
                bins['0.5-0.7'].append(sample_data)
            elif conf < 0.9:
                bins['0.7-0.9'].append(sample_data)
            else:
                bins['0.9-1.0'].append(sample_data)
        
        return {
            'bins': {k: {'count': len(v), 'samples': v} for k, v in bins.items()},
            'total_samples': len(samples),
            'threshold': Config.LOW_CONFIDENCE_THRESHOLD
        }
    
    @staticmethod
    def get_status_summary(sheet_id=None):
        query = ReviewSample.query
        if sheet_id:
            query = query.filter_by(correction_sheet_id=sheet_id)
        
        samples = query.all()
        
        status_counts = {}
        for status, label in Config.SAMPLE_STATUS.items():
            status_samples = [s for s in samples if s.status == status]
            status_counts[status] = {
                'label': label,
                'count': len(status_samples),
                'samples': [VisualizationService._get_sample_evidence_link(s) for s in status_samples]
            }
        
        masked_count = len([s for s in samples if s.masked_by_average])
        
        return {
            'status_counts': status_counts,
            'masked_by_average_count': masked_count,
            'total': len(samples)
        }
    
    @staticmethod
    def get_masked_samples_detail(sheet_id):
        samples = ReviewSample.query.filter_by(
            correction_sheet_id=sheet_id,
            masked_by_average=True
        ).all()
        
        return [VisualizationService._get_sample_evidence_link(s) for s in samples]
    
    @staticmethod
    def _get_sample_evidence_link(sample):
        evidence = {
            'sample_id': sample.id,
            'id': sample.id,
            'unique_key': sample.unique_key,
            'original_text': sample.original_text,
            'model_prediction': sample.model_prediction,
            'model_confidence': sample.model_confidence,
            'manual_label': sample.manual_label,
            'status': sample.status,
            'status_label': Config.SAMPLE_STATUS.get(sample.status, sample.status),
            'is_false_negative': sample.is_false_negative,
            'is_low_confidence': sample.is_low_confidence,
            'masked_by_average': sample.masked_by_average,
            'kb_reviewed': sample.kb_reviewed,
            'kb_reviewed_by': sample.kb_reviewed_by,
            'reviewed_by': sample.reviewed_by,
            'raw_remark': sample.raw_remark,
            'correction_sheet_id': sample.correction_sheet_id,
            'prompt_version_id': sample.prompt_version_id,
            'created_at': sample.created_at.isoformat() if sample.created_at else None,
            'updated_at': sample.updated_at.isoformat() if sample.updated_at else None,
            'links': {
                'correction_sheet': f'/api/sheets/{sample.correction_sheet_id}' if sample.correction_sheet_id else None,
                'prompt_version': f'/api/prompts/{sample.prompt_version_id}' if sample.prompt_version_id else None,
                'change_history': f'/api/samples/{sample.id}/history',
                'rollback': f'/api/samples/{sample.id}/rollback'
            }
        }
        
        if sample.correction_sheet_id:
            sheet = ManualCorrectionSheet.query.get(sample.correction_sheet_id)
            if sheet:
                evidence['sheet_name'] = sheet.sheet_name
                evidence['sheet_version'] = sheet.version
        
        if sample.prompt_version_id:
            prompt = PromptVersion.query.get(sample.prompt_version_id)
            if prompt:
                evidence['prompt_version_number'] = prompt.version_number
                evidence['prompt_remark'] = prompt.remark
        
        return evidence
    
    @staticmethod
    def get_workflow_overview():
        from services.workflow_service import WorkflowService
        workflows = WorkflowService.list_workflows()
        
        overview = {
            'total': len(workflows),
            'by_step': {},
            'workflows': []
        }
        
        for wf in workflows:
            step = wf.current_step
            if step not in overview['by_step']:
                overview['by_step'][step] = 0
            overview['by_step'][step] += 1
            
            sheet = ManualCorrectionSheet.query.get(wf.sheet_id)
            overview['workflows'].append({
                'workflow_id': wf.id,
                'sheet_id': wf.sheet_id,
                'sheet_name': sheet.sheet_name if sheet else 'Unknown',
                'current_step': wf.current_step,
                'step1_done': wf.step1_completed,
                'step2_done': wf.step2_completed,
                'step3_done': wf.step3_completed,
                'updated_at': wf.updated_at
            })
        
        return overview
