from datetime import datetime
from models import db, ReviewSample, SampleChangeHistory
from config import Config


class ConfidenceService:
    
    @staticmethod
    def detect_low_confidence_samples(sheet_id=None, threshold=None):
        threshold = threshold or Config.LOW_CONFIDENCE_THRESHOLD
        
        query = ReviewSample.query.filter(
            ReviewSample.model_confidence.isnot(None),
            ReviewSample.model_confidence < threshold
        )
        
        if sheet_id:
            query = query.filter_by(correction_sheet_id=sheet_id)
        
        samples = query.all()
        
        for sample in samples:
            if sample.status != 'low_confidence':
                ConfidenceService._mark_low_confidence(sample, 'system_detect')
        
        db.session.commit()
        return samples
    
    @staticmethod
    def _mark_low_confidence(sample, marked_by):
        history = SampleChangeHistory(
            sample_id=sample.id,
            changed_by=marked_by,
            change_type='status_change',
            old_status=sample.status,
            new_status='low_confidence'
        )
        db.session.add(history)
        sample.status = 'low_confidence'
        sample.is_low_confidence = True
    
    @staticmethod
    def check_average_masking(sheet_id):
        samples = ReviewSample.query.filter_by(correction_sheet_id=sheet_id).all()
        if not samples:
            return []
        
        confidences = [s.model_confidence for s in samples if s.model_confidence is not None]
        if not confidences:
            return []
        
        avg_confidence = sum(confidences) / len(confidences)
        
        masked_samples = []
        for sample in samples:
            if sample.model_confidence is None:
                continue
            
            is_masked = (
                sample.is_low_confidence and
                sample.model_confidence < Config.LOW_CONFIDENCE_THRESHOLD and
                avg_confidence >= Config.LOW_CONFIDENCE_THRESHOLD and
                not sample.kb_reviewed
            )
            
            if is_masked and not sample.masked_by_average:
                sample.masked_by_average = True
                history = SampleChangeHistory(
                    sample_id=sample.id,
                    changed_by='system',
                    change_type='masking_detect',
                    field_name='masked_by_average',
                    old_value='False',
                    new_value='True'
                )
                db.session.add(history)
            
            if sample.masked_by_average:
                masked_samples.append(sample)
        
        db.session.commit()
        return masked_samples
    
    @staticmethod
    def kb_review_sample(sample_id, kb_editor, decision, remark=None):
        sample = ReviewSample.query.get(sample_id)
        if not sample:
            return None
        
        old_status = sample.status
        
        history = SampleChangeHistory(
            sample_id=sample.id,
            changed_by=kb_editor,
            change_type='kb_review',
            old_status=old_status,
            new_status=decision
        )
        db.session.add(history)
        
        sample.status = decision
        sample.kb_reviewed = True
        sample.kb_reviewed_by = kb_editor
        sample.kb_reviewed_at = datetime.utcnow()
        
        if decision == 'false_negative':
            sample.is_false_negative = True
        elif decision == 'normal':
            sample.is_false_negative = False
            sample.masked_by_average = False
        
        db.session.commit()
        return sample
    
    @staticmethod
    def rollback_sample(sample_id, rolled_by, reason=None):
        sample = ReviewSample.query.get(sample_id)
        if not sample:
            return None
        
        last_history = SampleChangeHistory.query.filter_by(
            sample_id=sample_id
        ).order_by(SampleChangeHistory.changed_at.desc()).first()
        
        if not last_history or not last_history.old_status:
            return None
        
        old_status = sample.status
        rollback_to = last_history.old_status
        
        history = SampleChangeHistory(
            sample_id=sample.id,
            changed_by=rolled_by,
            change_type='rollback',
            old_status=old_status,
            new_status=rollback_to,
            rollback_from_id=last_history.id,
            new_value=reason or ''
        )
        db.session.add(history)
        
        sample.status = rollback_to
        sample.kb_reviewed = False
        sample.reviewed_by = None
        sample.reviewed_at = None
        
        db.session.commit()
        return sample
    
    @staticmethod
    def get_low_confidence_samples(sheet_id=None, include_masked=True):
        query = ReviewSample.query.filter_by(status='low_confidence')
        
        if sheet_id:
            query = query.filter_by(correction_sheet_id=sheet_id)
        
        if not include_masked:
            query = query.filter_by(masked_by_average=False)
        
        return query.all()
    
    @staticmethod
    def get_sample_change_history(sample_id):
        return SampleChangeHistory.query.filter_by(
            sample_id=sample_id
        ).order_by(SampleChangeHistory.changed_at.asc()).all()
