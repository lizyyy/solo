from datetime import datetime
from models import db, PromptVersion, ReviewSample, SampleChangeHistory


class PromptService:
    
    @staticmethod
    def create_prompt_version(version_number, prompt_text, created_by, remark=None, model_version=None):
        prompt = PromptVersion(
            version_number=version_number,
            prompt_text=prompt_text,
            remark=remark,
            created_by=created_by,
            model_version=model_version
        )
        db.session.add(prompt)
        db.session.commit()
        return prompt
    
    @staticmethod
    def get_prompt_version(version_id):
        return PromptVersion.query.get(version_id)
    
    @staticmethod
    def list_prompt_versions(limit=50):
        return PromptVersion.query.order_by(PromptVersion.created_at.desc()).limit(limit).all()
    
    @staticmethod
    def link_samples_to_prompt(sample_ids, prompt_version_id, linked_by):
        samples = ReviewSample.query.filter(ReviewSample.id.in_(sample_ids)).all()
        linked_count = 0
        
        for sample in samples:
            old_prompt_id = sample.prompt_version_id
            if old_prompt_id != prompt_version_id:
                history = SampleChangeHistory(
                    sample_id=sample.id,
                    changed_by=linked_by,
                    change_type='prompt_link',
                    field_name='prompt_version_id',
                    old_value=str(old_prompt_id) if old_prompt_id else '',
                    new_value=str(prompt_version_id)
                )
                db.session.add(history)
                sample.prompt_version_id = prompt_version_id
                linked_count += 1
        
        db.session.commit()
        return linked_count
    
    @staticmethod
    def get_samples_with_prompt_version(prompt_version_id):
        return ReviewSample.query.filter_by(
            prompt_version_id=prompt_version_id
        ).all()
