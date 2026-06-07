from datetime import datetime
from models import db, WorkflowState, ManualCorrectionSheet, ReviewSample
from config import Config


class WorkflowService:
    
    @staticmethod
    def init_workflow(sheet_id):
        existing = WorkflowState.query.filter_by(sheet_id=sheet_id).first()
        if existing:
            return existing
        
        workflow = WorkflowState(
            sheet_id=sheet_id,
            current_step='step1_import'
        )
        db.session.add(workflow)
        db.session.commit()
        return workflow
    
    @staticmethod
    def get_workflow(sheet_id):
        return WorkflowState.query.filter_by(sheet_id=sheet_id).first()
    
    @staticmethod
    def can_advance_step(sheet_id, target_step, user_role):
        workflow = WorkflowService.get_workflow(sheet_id)
        if not workflow:
            return False, '工作流未初始化'
        
        step_order = Config.REVIEW_WORKFLOW_STEPS
        current_idx = step_order.index(workflow.current_step)
        target_idx = step_order.index(target_step)
        
        if target_idx != current_idx + 1:
            return False, f'必须按顺序推进：当前是第{current_idx+1}步，不能直接跳到第{target_idx+1}步'
        
        if target_step == 'step1_import':
            if user_role not in ['annotator', 'lead_annotator']:
                return False, '只有标注人员可以完成导入步骤'
        elif target_step == 'step2_review_prompt':
            if user_role != 'lead_annotator':
                return False, '只有标注负责人（周姐）可以完成提示词补看步骤'
        elif target_step == 'step3_model_update':
            if user_role not in ['kb_editor', 'lead_annotator']:
                return False, '只有知识库编辑或标注负责人可以完成模型更新步骤'
        
        return True, '可以推进'
    
    @staticmethod
    def complete_step(sheet_id, step_name, completed_by, user_role):
        can_advance, message = WorkflowService.can_advance_step(
            sheet_id, step_name, user_role
        )
        if not can_advance:
            return False, message
        
        workflow = WorkflowService.get_workflow(sheet_id)
        if not workflow:
            return False, '工作流未初始化'
        
        if step_name == 'step1_import':
            workflow.step1_completed = True
            workflow.step1_completed_by = completed_by
            workflow.step1_completed_at = datetime.utcnow()
            workflow.current_step = 'step2_review_prompt'
        elif step_name == 'step2_review_prompt':
            low_conf_samples = ReviewSample.query.filter_by(
                correction_sheet_id=sheet_id,
                status='low_confidence'
            ).all()
            unreviewed = [s for s in low_conf_samples if not s.kb_reviewed]
            if unreviewed:
                return False, f'还有{len(unreviewed)}条低置信度样本未经过知识库编辑复核，请先处理'
            
            workflow.step2_completed = True
            workflow.step2_completed_by = completed_by
            workflow.step2_completed_at = datetime.utcnow()
            workflow.current_step = 'step3_model_update'
        elif step_name == 'step3_model_update':
            workflow.step3_completed = True
            workflow.step3_completed_by = completed_by
            workflow.step3_completed_at = datetime.utcnow()
            workflow.current_step = 'completed'
        
        workflow.updated_at = datetime.utcnow()
        db.session.commit()
        
        return True, f'已完成{step_name}，当前进入{workflow.current_step}'
    
    @staticmethod
    def get_workflow_progress(sheet_id):
        workflow = WorkflowService.get_workflow(sheet_id)
        if not workflow:
            return None
        
        steps_info = []
        for step in Config.REVIEW_WORKFLOW_STEPS:
            step_data = {
                'step_name': step,
                'completed': False,
                'completed_by': None,
                'completed_at': None
            }
            
            if step == 'step1_import':
                step_data['completed'] = workflow.step1_completed
                step_data['completed_by'] = workflow.step1_completed_by
                step_data['completed_at'] = workflow.step1_completed_at
            elif step == 'step2_review_prompt':
                step_data['completed'] = workflow.step2_completed
                step_data['completed_by'] = workflow.step2_completed_by
                step_data['completed_at'] = workflow.step2_completed_at
            elif step == 'step3_model_update':
                step_data['completed'] = workflow.step3_completed
                step_data['completed_by'] = workflow.step3_completed_by
                step_data['completed_at'] = workflow.step3_completed_at
            
            steps_info.append(step_data)
        
        return {
            'current_step': workflow.current_step,
            'steps': steps_info,
            'updated_at': workflow.updated_at
        }
    
    @staticmethod
    def list_workflows(status_filter=None):
        query = WorkflowState.query
        if status_filter:
            query = query.filter_by(current_step=status_filter)
        return query.order_by(WorkflowState.updated_at.desc()).all()
