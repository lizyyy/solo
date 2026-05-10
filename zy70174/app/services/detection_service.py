import hashlib
import json
from datetime import datetime
from typing import List, Dict, Tuple, Optional
from app import db
from app.models import (
    EvaluationSet,
    EvaluationItem,
    TrainingDataFingerprint,
    DetectionTask,
    PollutionMatch,
    ExemptionRecord,
    DetectionReport,
    EXEMPTION_REASONS
)
from app.services.state_manager import StateManager, StateTransitionError


class DuplicateSubmissionError(Exception):
    def __init__(self, message: str, existing_task: DetectionTask):
        self.message = message
        self.existing_task = existing_task
        super().__init__(message)


class FingerprintService:
    
    @staticmethod
    def compute_sha256(content: str) -> str:
        return hashlib.sha256(content.encode('utf-8')).hexdigest()
    
    @staticmethod
    def normalize_content(content: str) -> str:
        lines = content.strip().split('\n')
        normalized_lines = [line.strip() for line in lines if line.strip()]
        return '\n'.join(normalized_lines)
    
    @staticmethod
    def compute_fingerprint(content: str, normalize: bool = True) -> str:
        if normalize:
            content = FingerprintService.normalize_content(content)
        return FingerprintService.compute_sha256(content)
    
    @staticmethod
    def compute_similarity_hash(content: str, n_gram: int = 3) -> str:
        normalized = FingerprintService.normalize_content(content)
        tokens = [normalized[i:i+n_gram] for i in range(len(normalized) - n_gram + 1)]
        unique_tokens = sorted(set(tokens))
        return FingerprintService.compute_sha256('|'.join(unique_tokens))


class DetectionService:
    
    @staticmethod
    def generate_task_key(evaluation_set_id: int, training_data_signature: str) -> str:
        return f"eval_{evaluation_set_id}_train_{hashlib.md5(training_data_signature.encode()).hexdigest()}"
    
    @staticmethod
    def check_duplicate_submission(
        evaluation_set_id: int,
        training_data_signature: str
    ) -> Optional[DetectionTask]:
        task_key = DetectionService.generate_task_key(evaluation_set_id, training_data_signature)
        return DetectionTask.query.filter_by(task_key=task_key).first()
    
    @staticmethod
    def create_task(
        evaluation_set_id: int,
        training_data_signature: str,
        training_data_description: str = None,
        created_by: str = None,
        force: bool = False
    ) -> Tuple[DetectionTask, bool]:
        
        existing_task = DetectionService.check_duplicate_submission(
            evaluation_set_id, 
            training_data_signature
        )
        
        if existing_task and not force:
            raise DuplicateSubmissionError(
                message=(
                    f"检测到重复提交！同一训练数据针对评测集 {evaluation_set_id} 已存在检测任务。\n"
                    f"现有任务状态：{existing_task.status}\n"
                    f"任务ID：{existing_task.id}\n"
                    f"如需重新检测，请使用 force=True 参数或查看现有任务详情。"
                ),
                existing_task=existing_task
            )
        
        base_key = DetectionService.generate_task_key(evaluation_set_id, training_data_signature)
        if force and existing_task:
            task_key = f"{base_key}_retry_{int(datetime.utcnow().timestamp())}"
        else:
            task_key = base_key
        
        task = DetectionTask(
            task_key=task_key,
            evaluation_set_id=evaluation_set_id,
            training_data_description=training_data_description,
            status='pending',
            created_by=created_by,
            last_updated_by=created_by
        )
        
        db.session.add(task)
        db.session.flush()
        
        return task, True
    
    @staticmethod
    def add_training_fingerprints(
        task: DetectionTask,
        fingerprints_data: List[Dict]
    ) -> List[TrainingDataFingerprint]:
        
        created_fingerprints = []
        for fp_data in fingerprints_data:
            content = fp_data.get('content', '')
            fingerprint = fp_data.get('fingerprint') or FingerprintService.compute_fingerprint(content)
            
            fp = TrainingDataFingerprint(
                task_id=task.id,
                data_source=fp_data.get('data_source'),
                content_hash=fingerprint,
                hash_type='sha256',
                raw_content_preview=content[:500] if len(content) > 500 else content,
                meta_info=fp_data.get('meta_info')
            )
            db.session.add(fp)
            created_fingerprints.append(fp)
        
        db.session.flush()
        return created_fingerprints
    
    @staticmethod
    def run_detection(task: DetectionTask) -> List[PollutionMatch]:
        
        if not StateManager.can_start_scanning(task):
            raise StateTransitionError(
                message=StateManager.get_readable_error_message(task.status, 'scanning'),
                from_status=task.status,
                to_status='scanning',
                next_steps=StateManager.get_next_allowed_states(task.status)
            )
        
        StateManager.transition(
            task, 
            'scanning',
            changed_by='system',
            reason='开始执行污染检测'
        )
        db.session.flush()
        
        try:
            eval_set = EvaluationSet.query.get(task.evaluation_set_id)
            if not eval_set:
                raise ValueError(f"评测集 {task.evaluation_set_id} 不存在")
            
            matches = []
            training_fps = TrainingDataFingerprint.query.filter_by(task_id=task.id).all()
            eval_items = EvaluationItem.query.filter_by(evaluation_set_id=task.evaluation_set_id).all()
            
            eval_fingerprint_map = {item.fingerprint: item for item in eval_items}
            
            for training_fp in training_fps:
                if training_fp.content_hash in eval_fingerprint_map:
                    eval_item = eval_fingerprint_map[training_fp.content_hash]
                    
                    match = PollutionMatch(
                        task_id=task.id,
                        training_fingerprint_id=training_fp.id,
                        evaluation_item_id=eval_item.id,
                        match_score=1.0,
                        match_type='exact_hash_match',
                        match_details={
                            'match_method': 'exact_hash',
                            'training_fingerprint': training_fp.content_hash,
                            'evaluation_fingerprint': eval_item.fingerprint
                        }
                    )
                    db.session.add(match)
                    matches.append(match)
            
            db.session.flush()
            
            if matches:
                new_status = 'needs_confirmation'
                reason = f'检测完成，发现 {len(matches)} 个潜在污染匹配，需要人工确认'
            else:
                new_status = 'completed'
                reason = '检测完成，未发现污染匹配'
            
            StateManager.transition(
                task,
                new_status,
                changed_by='system',
                reason=reason,
                meta_info={'match_count': len(matches)}
            )
            db.session.commit()
            
            return matches
            
        except Exception as e:
            StateManager.transition(
                task,
                'failed',
                changed_by='system',
                reason=f'检测过程失败: {str(e)}'
            )
            db.session.commit()
            raise
    
    @staticmethod
    def confirm_match(
        task: DetectionTask,
        match_id: int,
        is_polluted: bool,
        confirmed_by: str,
        comment: str = None
    ) -> Tuple[DetectionTask, str]:
        
        if not StateManager.can_confirm(task):
            raise StateTransitionError(
                message=StateManager.get_readable_error_message(task.status, 'confirmed_polluted'),
                from_status=task.status,
                to_status='confirmed_polluted',
                next_steps=StateManager.get_next_allowed_states(task.status)
            )
        
        match = PollutionMatch.query.get(match_id)
        if not match or match.task_id != task.id:
            raise ValueError(f"匹配记录 {match_id} 不存在或不属于当前任务")
        
        all_matches = PollutionMatch.query.filter_by(task_id=task.id).all()
        exempted_match_ids = [
            e.match_id for e in ExemptionRecord.query.filter_by(task_id=task.id).all()
            if e.match_id is not None
        ]
        
        if is_polluted:
            final_status = 'confirmed_polluted'
            reason = f'人工确认为污染，由 {confirmed_by} 确认'
        else:
            pending_matches = [
                m for m in all_matches 
                if m.id != match_id and m.id not in exempted_match_ids
            ]
            if pending_matches:
                final_status = task.status
                reason = f'已确认该匹配为非污染，仍有 {len(pending_matches)} 个匹配待处理'
            else:
                final_status = 'confirmed_clean'
                reason = f'所有匹配已确认，确认为干净，由 {confirmed_by} 确认'
        
        if final_status != task.status:
            StateManager.transition(
                task,
                final_status,
                changed_by=confirmed_by,
                reason=reason,
                meta_info={'confirmed_match_id': match_id, 'comment': comment}
            )
        
        db.session.commit()
        return task, reason
    
    @staticmethod
    def create_exemption(
        task: DetectionTask,
        reason: str,
        justification: str,
        exempted_by: str,
        match_id: int = None,
        expires_at: datetime = None
    ) -> ExemptionRecord:
        
        if reason not in EXEMPTION_REASONS:
            raise ValueError(
                f"无效的豁免原因。允许的原因：{', '.join(EXEMPTION_REASONS)}"
            )
        
        if not StateManager.can_exempt(task):
            raise StateTransitionError(
                message=StateManager.get_readable_error_message(task.status, 'exempted'),
                from_status=task.status,
                to_status='exempted',
                next_steps=StateManager.get_next_allowed_states(task.status)
            )
        
        if match_id is not None:
            existing = ExemptionRecord.query.filter_by(
                task_id=task.id, 
                match_id=match_id
            ).first()
            if existing:
                raise ValueError(f"该匹配记录 {match_id} 已存在豁免记录")
        
        exemption = ExemptionRecord(
            task_id=task.id,
            match_id=match_id,
            reason=reason,
            justification=justification,
            exempted_by=exempted_by,
            expires_at=expires_at
        )
        
        db.session.add(exemption)
        
        if match_id is None:
            StateManager.transition(
                task,
                'exempted',
                changed_by=exempted_by,
                reason=f'任务整体豁免：{reason}',
                meta_info={'exemption_id': exemption.id}
            )
        
        db.session.commit()
        return exemption
    
    @staticmethod
    def generate_report(
        task: DetectionTask,
        report_type: str = 'summary',
        generated_by: str = None
    ) -> DetectionReport:
        
        matches = PollutionMatch.query.filter_by(task_id=task.id).all()
        exemptions = ExemptionRecord.query.filter_by(task_id=task.id).all()
        exempted_match_ids = {e.match_id for e in exemptions if e.match_id is not None}
        
        active_matches = [m for m in matches if m.id not in exempted_match_ids]
        
        findings = {
            'total_matches': len(matches),
            'active_matches': len(active_matches),
            'exempted_matches': len(exempted_match_ids),
            'task_exempted': task.status == 'exempted' or any(e.match_id is None for e in exemptions),
            'matches_detail': [m.to_dict() for m in active_matches],
            'exemptions_detail': [e.to_dict() for e in exemptions],
            'history': [h.to_dict() for h in task.history]
        }
        
        if task.status == 'confirmed_polluted':
            summary = f"检测确认污染：发现 {len(active_matches)} 个污染匹配未被豁免"
        elif task.status == 'confirmed_clean':
            summary = "检测确认干净：所有潜在匹配已被确认为非污染或已豁免"
        elif task.status == 'exempted':
            summary = f"任务已豁免：{len(matches)} 个匹配中 {len(exempted_match_ids)} 个已被豁免"
        elif task.status == 'needs_confirmation':
            summary = f"待确认：发现 {len(active_matches)} 个潜在污染匹配需要人工确认"
        elif task.status == 'completed':
            summary = "检测完成：未发现污染匹配"
        elif task.status == 'failed':
            summary = "检测失败"
        else:
            summary = f"检测进行中，当前状态：{task.status}"
        
        report = DetectionReport(
            task_id=task.id,
            report_type=report_type,
            summary=summary,
            findings=findings,
            generated_by=generated_by
        )
        
        db.session.add(report)
        db.session.commit()
        
        return report
    
    @staticmethod
    def get_task_summary(task: DetectionTask) -> Dict:
        
        matches = PollutionMatch.query.filter_by(task_id=task.id).all()
        exemptions = ExemptionRecord.query.filter_by(task_id=task.id).all()
        exempted_match_ids = {e.match_id for e in exemptions if e.match_id is not None}
        
        return {
            'task': task.to_dict(include_history=True),
            'matches_count': len(matches),
            'active_matches_count': len([m for m in matches if m.id not in exempted_match_ids]),
            'exemptions_count': len(exemptions),
            'next_allowed_states': StateManager.get_next_allowed_states(task.status),
            'is_terminal': StateManager.is_terminal_state(task.status)
        }
