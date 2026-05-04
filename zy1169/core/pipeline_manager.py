import os
import shutil
from datetime import datetime
from models import (
    db, Project, DatasetVersion, CleaningTask, FeatureVersion,
    TrainingRun, DeploymentRequest, ApprovalRecord, AuditLog,
    PipelineStage
)

class PipelineManager:
    def __init__(self, app_config):
        self.data_folder = app_config['DATA_FOLDER']
        self.models_folder = app_config['MODELS_FOLDER']
        self.uploads_folder = app_config['UPLOAD_FOLDER']
    
    def get_pipeline_status(self, project_id):
        project = Project.query.get(project_id)
        if not project:
            return None
        
        status = {
            'project': project,
            'stages': {}
        }
        
        for stage in PipelineStage.get_stages():
            status['stages'][stage] = {
                'completed': False,
                'latest': None,
                'count': 0
            }
        
        datasets = DatasetVersion.query.filter_by(project_id=project_id).all()
        if datasets:
            status['stages'][PipelineStage.RAW_DATA]['completed'] = True
            status['stages'][PipelineStage.RAW_DATA]['latest'] = max(datasets, key=lambda x: x.created_at)
            status['stages'][PipelineStage.RAW_DATA]['count'] = len(datasets)
        
        cleaning_tasks = CleaningTask.query.filter_by(
            project_id=project_id, status='completed'
        ).all()
        if cleaning_tasks:
            status['stages'][PipelineStage.CLEANING]['completed'] = True
            status['stages'][PipelineStage.CLEANING]['latest'] = max(
                cleaning_tasks, key=lambda x: x.completed_at
            )
            status['stages'][PipelineStage.CLEANING]['count'] = len(cleaning_tasks)
        
        feature_versions = FeatureVersion.query.filter_by(
            project_id=project_id, status='completed'
        ).all()
        if feature_versions:
            status['stages'][PipelineStage.FEATURE_ENGINEERING]['completed'] = True
            status['stages'][PipelineStage.FEATURE_ENGINEERING]['latest'] = max(
                feature_versions, key=lambda x: x.completed_at
            )
            status['stages'][PipelineStage.FEATURE_ENGINEERING]['count'] = len(feature_versions)
        
        training_runs = TrainingRun.query.filter_by(
            project_id=project_id, status='completed'
        ).all()
        if training_runs:
            status['stages'][PipelineStage.TRAINING]['completed'] = True
            status['stages'][PipelineStage.TRAINING]['latest'] = max(
                training_runs, key=lambda x: x.completed_at
            )
            status['stages'][PipelineStage.TRAINING]['count'] = len(training_runs)
        
        deployments = DeploymentRequest.query.filter(
            DeploymentRequest.project_id == project_id,
            DeploymentRequest.status.in_(['approved', 'deployed'])
        ).all()
        if deployments:
            status['stages'][PipelineStage.DEPLOYMENT_REQUEST]['completed'] = True
            status['stages'][PipelineStage.DEPLOYMENT_REQUEST]['latest'] = max(
                deployments, key=lambda x: x.created_at
            )
            status['stages'][PipelineStage.DEPLOYMENT_REQUEST]['count'] = len(deployments)
        
        deployed = DeploymentRequest.query.filter_by(
            project_id=project_id, status='deployed'
        ).all()
        if deployed:
            status['stages'][PipelineStage.DEPLOYED]['completed'] = True
            status['stages'][PipelineStage.DEPLOYED]['latest'] = max(
                deployed, key=lambda x: x.deployed_at
            )
            status['stages'][PipelineStage.DEPLOYED]['count'] = len(deployed)
        
        return status
    
    def can_proceed_to_stage(self, project_id, target_stage):
        status = self.get_pipeline_status(project_id)
        if not status:
            return False
        
        stage_order = PipelineStage.get_stages()
        target_index = stage_order.index(target_stage)
        
        for i in range(target_index):
            if not status['stages'][stage_order[i]]['completed']:
                return False
        
        return True
    
    def rollback_to_stage(self, project_id, target_stage, actor='system'):
        status = self.get_pipeline_status(project_id)
        if not status:
            return False, "Project not found"
        
        stage_order = PipelineStage.get_stages()
        target_index = stage_order.index(target_stage)
        
        rollback_results = []
        
        for i in range(len(stage_order) - 1, target_index, -1):
            stage = stage_order[i]
            result = self._rollback_stage(project_id, stage, actor)
            rollback_results.append({
                'stage': stage,
                'result': result
            })
        
        self._log_audit(
            action=f"rollback_to_{target_stage}",
            actor=actor,
            details=f"Rolled back project {project_id} to stage {target_stage}"
        )
        
        return True, rollback_results
    
    def _rollback_stage(self, project_id, stage, actor):
        if stage == PipelineStage.DEPLOYED:
            deployments = DeploymentRequest.query.filter_by(
                project_id=project_id, status='deployed'
            ).all()
            for d in deployments:
                d.status = 'approved'
                self._log_audit(
                    action='undeploy',
                    actor=actor,
                    details=f"Undeployed deployment request {d.id}"
                )
            db.session.commit()
            return f"Undeployed {len(deployments)} deployments"
        
        elif stage == PipelineStage.DEPLOYMENT_REQUEST:
            deployments = DeploymentRequest.query.filter_by(project_id=project_id).all()
            count = len(deployments)
            for d in deployments:
                db.session.delete(d)
            db.session.commit()
            return f"Deleted {count} deployment requests"
        
        elif stage == PipelineStage.TRAINING:
            training_runs = TrainingRun.query.filter_by(project_id=project_id).all()
            for run in training_runs:
                if run.model_file_path and os.path.exists(run.model_file_path):
                    os.remove(run.model_file_path)
                db.session.delete(run)
            db.session.commit()
            return f"Deleted {len(training_runs)} training runs"
        
        elif stage == PipelineStage.FEATURE_ENGINEERING:
            feature_versions = FeatureVersion.query.filter_by(project_id=project_id).all()
            for fv in feature_versions:
                if fv.output_file_path and os.path.exists(fv.output_file_path):
                    os.remove(fv.output_file_path)
                db.session.delete(fv)
            db.session.commit()
            return f"Deleted {len(feature_versions)} feature versions"
        
        elif stage == PipelineStage.CLEANING:
            cleaning_tasks = CleaningTask.query.filter_by(project_id=project_id).all()
            for ct in cleaning_tasks:
                if ct.output_file_path and os.path.exists(ct.output_file_path):
                    os.remove(ct.output_file_path)
                db.session.delete(ct)
            db.session.commit()
            return f"Deleted {len(cleaning_tasks)} cleaning tasks"
        
        elif stage == PipelineStage.RAW_DATA:
            datasets = DatasetVersion.query.filter_by(project_id=project_id).all()
            for ds in datasets:
                if ds.file_path and os.path.exists(ds.file_path):
                    os.remove(ds.file_path)
                db.session.delete(ds)
            db.session.commit()
            return f"Deleted {len(datasets)} dataset versions"
        
        return "No action taken"
    
    def create_snapshot(self, project_id, snapshot_name, actor='system'):
        status = self.get_pipeline_status(project_id)
        if not status:
            return False, "Project not found"
        
        snapshot = {
            'name': snapshot_name,
            'created_at': datetime.utcnow(),
            'actor': actor,
            'project_id': project_id,
            'stages': {}
        }
        
        for stage, stage_status in status['stages'].items():
            if stage_status['completed'] and stage_status['latest']:
                latest = stage_status['latest']
                snapshot['stages'][stage] = {
                    'id': latest.id,
                    'version': getattr(latest, 'version', None),
                    'file_path': getattr(latest, 'file_path', None) or 
                                 getattr(latest, 'output_file_path', None) or
                                 getattr(latest, 'model_file_path', None),
                    'created_at': getattr(latest, 'created_at', None) or 
                                  getattr(latest, 'completed_at', None)
                }
        
        self._log_audit(
            action='create_snapshot',
            actor=actor,
            details=f"Created snapshot '{snapshot_name}' for project {project_id}"
        )
        
        return True, snapshot
    
    def _log_audit(self, action, actor, details, ip_address=None, deployment_request_id=None):
        audit = AuditLog(
            deployment_request_id=deployment_request_id,
            action=action,
            actor=actor,
            details=details,
            ip_address=ip_address
        )
        db.session.add(audit)
        db.session.commit()
        return audit


def run_pipeline_step(project_id, step_name, **kwargs):
    from core.data_uploader import process_raw_data
    from core.data_cleaner import run_cleaning_task
    from core.feature_engineer import run_feature_engineering
    from core.model_trainer import run_training
    from flask import current_app
    
    results = {
        'step': step_name,
        'success': False,
        'message': '',
        'data': None
    }
    
    try:
        if step_name == 'upload_data':
            file_path = kwargs.get('file_path')
            if not file_path:
                results['message'] = 'No file path provided'
                return results
            
            dataset = process_raw_data(file_path, project_id)
            results['success'] = True
            results['message'] = f"Dataset version {dataset.version} created"
            results['data'] = {'dataset_id': dataset.id, 'version': dataset.version}
        
        elif step_name == 'clean_data':
            cleaning_task_id = kwargs.get('cleaning_task_id')
            if not cleaning_task_id:
                results['message'] = 'No cleaning task ID provided'
                return results
            
            data_folder = current_app.config['DATA_FOLDER']
            success, message = run_cleaning_task(cleaning_task_id, data_folder)
            results['success'] = success
            results['message'] = message
        
        elif step_name == 'feature_engineering':
            feature_version_id = kwargs.get('feature_version_id')
            if not feature_version_id:
                results['message'] = 'No feature version ID provided'
                return results
            
            data_folder = current_app.config['DATA_FOLDER']
            success, message = run_feature_engineering(feature_version_id, data_folder)
            results['success'] = success
            results['message'] = message
        
        elif step_name == 'train_model':
            training_run_id = kwargs.get('training_run_id')
            if not training_run_id:
                results['message'] = 'No training run ID provided'
                return results
            
            data_folder = current_app.config['DATA_FOLDER']
            models_folder = current_app.config['MODELS_FOLDER']
            success, message = run_training(training_run_id, data_folder, models_folder)
            results['success'] = success
            results['message'] = message
        
        else:
            results['message'] = f"Unknown step: {step_name}"
    
    except Exception as e:
        results['message'] = str(e)
    
    return results
