import os
from flask import Flask, render_template, request, redirect, url_for, flash, jsonify, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import json

from config import config
from models import db, Project, PipelineStage
from core.data_uploader import save_file, process_raw_data, load_yaml_file, validate_yaml_file
from core.data_cleaner import run_cleaning_task
from core.feature_engineer import run_feature_engineering
from core.model_trainer import run_training, compare_models, run_test_set_playback
from core.quality_checker import run_data_quality_check, get_quality_summary
from core.pipeline_manager import PipelineManager
from core.report_generator import ReportGenerator, generate_model_comparison_report

def create_app(config_name='default'):
    app = Flask(__name__)
    app.config.from_object(config[config_name])
    config[config_name].init_app(app)
    
    db.init_app(app)
    
    with app.app_context():
        db.create_all()
        
        if Project.query.count() == 0:
            sample_project = Project(
                name='Sample Project',
                description='一个示例ML流水线项目，用于演示平台功能'
            )
            db.session.add(sample_project)
            db.session.commit()
    
    @app.route('/')
    def index():
        projects = Project.query.order_by(Project.updated_at.desc()).all()
        return render_template('index.html', projects=projects)
    
    @app.route('/project/create', methods=['GET', 'POST'])
    def create_project():
        if request.method == 'POST':
            name = request.form.get('name')
            description = request.form.get('description')
            
            if not name:
                flash('项目名称不能为空', 'danger')
                return redirect(url_for('create_project'))
            
            project = Project(name=name, description=description)
            db.session.add(project)
            db.session.commit()
            
            flash('项目创建成功', 'success')
            return redirect(url_for('project_detail', project_id=project.id))
        
        return render_template('create_project.html')
    
    @app.route('/project/<int:project_id>')
    def project_detail(project_id):
        project = Project.query.get_or_404(project_id)
        manager = PipelineManager(app.config)
        pipeline_status = manager.get_pipeline_status(project_id)
        
        from models import DatasetVersion, CleaningTask, FeatureVersion, TrainingRun, DeploymentRequest
        
        datasets = DatasetVersion.query.filter_by(project_id=project_id).order_by(DatasetVersion.created_at.desc()).all()
        cleaning_tasks = CleaningTask.query.filter_by(project_id=project_id).order_by(CleaningTask.created_at.desc()).all()
        feature_versions = FeatureVersion.query.filter_by(project_id=project_id).order_by(FeatureVersion.created_at.desc()).all()
        training_runs = TrainingRun.query.filter_by(project_id=project_id).order_by(TrainingRun.created_at.desc()).all()
        deployments = DeploymentRequest.query.filter_by(project_id=project_id).order_by(DeploymentRequest.created_at.desc()).all()
        
        return render_template('project_detail.html',
                             project=project,
                             pipeline_status=pipeline_status,
                             datasets=datasets,
                             cleaning_tasks=cleaning_tasks,
                             feature_versions=feature_versions,
                             training_runs=training_runs,
                             deployments=deployments,
                             stages=PipelineStage.get_stages())
    
    @app.route('/project/<int:project_id>/upload_data', methods=['GET', 'POST'])
    def upload_data(project_id):
        project = Project.query.get_or_404(project_id)
        
        if request.method == 'POST':
            if 'data_file' not in request.files:
                flash('请选择文件', 'danger')
                return redirect(request.url)
            
            file = request.files['data_file']
            if file.filename == '':
                flash('请选择文件', 'danger')
                return redirect(request.url)
            
            try:
                file_path, filename = save_file(file, app.config['UPLOAD_FOLDER'], 'raw_data')
                dataset = process_raw_data(file_path, project_id)
                run_data_quality_check(dataset.id)
                
                flash(f'数据上传成功，版本: {dataset.version}', 'success')
                return redirect(url_for('dataset_detail', dataset_id=dataset.id))
            except Exception as e:
                flash(f'上传失败: {str(e)}', 'danger')
                return redirect(request.url)
        
        return render_template('upload_data.html', project=project)
    
    @app.route('/dataset/<int:dataset_id>')
    def dataset_detail(dataset_id):
        from models import DatasetVersion, DataQualityCheck
        
        dataset = DatasetVersion.query.get_or_404(dataset_id)
        quality_checks = DataQualityCheck.query.filter_by(dataset_id=dataset_id).all()
        
        import pandas as pd
        preview = None
        try:
            df = pd.read_csv(dataset.file_path, nrows=20)
            preview = {
                'columns': df.columns.tolist(),
                'data': df.head(10).to_dict('records')
            }
        except:
            pass
        
        return render_template('dataset_detail.html',
                             dataset=dataset,
                             quality_checks=quality_checks,
                             preview=preview)
    
    @app.route('/project/<int:project_id>/create_cleaning', methods=['GET', 'POST'])
    def create_cleaning_task(project_id):
        from models import DatasetVersion
        
        project = Project.query.get_or_404(project_id)
        datasets = DatasetVersion.query.filter_by(project_id=project_id).order_by(DatasetVersion.created_at.desc()).all()
        
        if request.method == 'POST':
            dataset_version_id = request.form.get('dataset_version_id')
            
            if 'rules_file' not in request.files:
                flash('请上传清洗规则文件', 'danger')
                return redirect(request.url)
            
            rules_file = request.files['rules_file']
            if rules_file.filename == '':
                flash('请选择文件', 'danger')
                return redirect(request.url)
            
            try:
                rules_path, rules_name = save_file(rules_file, app.config['UPLOAD_FOLDER'], 'cleaning_rules')
                valid, error = validate_yaml_file(rules_path, ['rules'])
                if not valid:
                    flash(f'规则文件格式错误: {error}', 'danger')
                    return redirect(request.url)
                
                version = f"v{datetime.now().strftime('%Y%m%d%H%M%S')}"
                from models import CleaningTask
                task = CleaningTask(
                    project_id=project_id,
                    dataset_version_id=dataset_version_id,
                    version=version,
                    rules_file_path=rules_path,
                    rules_file_name=rules_name
                )
                db.session.add(task)
                db.session.commit()
                
                flash(f'清洗任务创建成功，版本: {version}', 'success')
                return redirect(url_for('cleaning_task_detail', cleaning_task_id=task.id))
            except Exception as e:
                flash(f'创建失败: {str(e)}', 'danger')
                return redirect(request.url)
        
        return render_template('create_cleaning.html', project=project, datasets=datasets)
    
    @app.route('/cleaning/<int:cleaning_task_id>')
    def cleaning_task_detail(cleaning_task_id):
        from models import CleaningTask, CleaningLog
        
        task = CleaningTask.query.get_or_404(cleaning_task_id)
        logs = CleaningLog.query.filter_by(cleaning_task_id=cleaning_task_id).order_by(CleaningLog.created_at.asc()).all()
        
        return render_template('cleaning_detail.html', task=task, logs=logs)
    
    @app.route('/cleaning/<int:cleaning_task_id>/run', methods=['POST'])
    def run_cleaning(cleaning_task_id):
        data_folder = app.config['DATA_FOLDER']
        success, message = run_cleaning_task(cleaning_task_id, data_folder)
        
        if success:
            flash(message, 'success')
        else:
            flash(message, 'danger')
        
        return redirect(url_for('cleaning_task_detail', cleaning_task_id=cleaning_task_id))
    
    @app.route('/project/<int:project_id>/create_features', methods=['GET', 'POST'])
    def create_feature_version(project_id):
        from models import CleaningTask
        
        project = Project.query.get_or_404(project_id)
        cleaning_tasks = CleaningTask.query.filter_by(project_id=project_id, status='completed').order_by(CleaningTask.created_at.desc()).all()
        
        if request.method == 'POST':
            cleaning_task_id = request.form.get('cleaning_task_id')
            
            if 'spec_file' not in request.files:
                flash('请上传特征规格文件', 'danger')
                return redirect(request.url)
            
            spec_file = request.files['spec_file']
            if spec_file.filename == '':
                flash('请选择文件', 'danger')
                return redirect(request.url)
            
            try:
                spec_path, spec_name = save_file(spec_file, app.config['UPLOAD_FOLDER'], 'feature_specs')
                valid, error = validate_yaml_file(spec_path, ['features'])
                if not valid:
                    flash(f'规格文件格式错误: {error}', 'danger')
                    return redirect(request.url)
                
                version = f"v{datetime.now().strftime('%Y%m%d%H%M%S')}"
                from models import FeatureVersion
                feature_version = FeatureVersion(
                    project_id=project_id,
                    cleaning_task_id=cleaning_task_id,
                    version=version,
                    spec_file_path=spec_path,
                    spec_file_name=spec_name
                )
                db.session.add(feature_version)
                db.session.commit()
                
                flash(f'特征版本创建成功，版本: {version}', 'success')
                return redirect(url_for('feature_detail', feature_id=feature_version.id))
            except Exception as e:
                flash(f'创建失败: {str(e)}', 'danger')
                return redirect(request.url)
        
        return render_template('create_features.html', project=project, cleaning_tasks=cleaning_tasks)
    
    @app.route('/features/<int:feature_id>')
    def feature_detail(feature_id):
        from models import FeatureVersion, FeatureCheck
        
        feature = FeatureVersion.query.get_or_404(feature_id)
        checks = FeatureCheck.query.filter_by(feature_version_id=feature_id).all()
        
        return render_template('feature_detail.html', feature=feature, checks=checks)
    
    @app.route('/features/<int:feature_id>/run', methods=['POST'])
    def run_feature_engineering(feature_id):
        data_folder = app.config['DATA_FOLDER']
        success, message = run_feature_engineering(feature_id, data_folder)
        
        if success:
            flash(message, 'success')
        else:
            flash(message, 'danger')
        
        return redirect(url_for('feature_detail', feature_id=feature_id))
    
    @app.route('/project/<int:project_id>/create_training', methods=['GET', 'POST'])
    def create_training_run(project_id):
        from models import FeatureVersion
        
        project = Project.query.get_or_404(project_id)
        feature_versions = FeatureVersion.query.filter_by(project_id=project_id, status='completed').order_by(FeatureVersion.created_at.desc()).all()
        
        if request.method == 'POST':
            feature_version_id = request.form.get('feature_version_id')
            
            if 'config_file' not in request.files:
                flash('请上传训练配置文件', 'danger')
                return redirect(request.url)
            
            config_file = request.files['config_file']
            if config_file.filename == '':
                flash('请选择文件', 'danger')
                return redirect(request.url)
            
            try:
                config_path, config_name = save_file(config_file, app.config['UPLOAD_FOLDER'], 'train_configs')
                valid, error = validate_yaml_file(config_path)
                if not valid:
                    flash(f'配置文件格式错误: {error}', 'danger')
                    return redirect(request.url)
                
                version = f"v{datetime.now().strftime('%Y%m%d%H%M%S')}"
                from models import TrainingRun
                training_run = TrainingRun(
                    project_id=project_id,
                    feature_version_id=feature_version_id,
                    version=version,
                    config_file_path=config_path,
                    config_file_name=config_name
                )
                db.session.add(training_run)
                db.session.commit()
                
                flash(f'训练任务创建成功，版本: {version}', 'success')
                return redirect(url_for('training_detail', training_id=training_run.id))
            except Exception as e:
                flash(f'创建失败: {str(e)}', 'danger')
                return redirect(request.url)
        
        return render_template('create_training.html', project=project, feature_versions=feature_versions)
    
    @app.route('/training/<int:training_id>')
    def training_detail(training_id):
        from models import TrainingRun, Validation
        
        training = TrainingRun.query.get_or_404(training_id)
        validations = Validation.query.filter_by(training_run_id=training_id).all()
        
        return render_template('training_detail.html', training=training, validations=validations)
    
    @app.route('/training/<int:training_id>/run', methods=['POST'])
    def run_train_model(training_id):
        data_folder = app.config['DATA_FOLDER']
        models_folder = app.config['MODELS_FOLDER']
        success, message = run_training(training_id, data_folder, models_folder)
        
        if success:
            flash(message, 'success')
        else:
            flash(message, 'danger')
        
        return redirect(url_for('training_detail', training_id=training_id))
    
    @app.route('/project/<int:project_id>/create_deployment', methods=['GET', 'POST'])
    def create_deployment_request(project_id):
        from models import TrainingRun
        
        project = Project.query.get_or_404(project_id)
        training_runs = TrainingRun.query.filter_by(project_id=project_id, status='completed').order_by(TrainingRun.created_at.desc()).all()
        
        if request.method == 'POST':
            training_run_id = request.form.get('training_run_id')
            title = request.form.get('title')
            description = request.form.get('description')
            deployment_type = request.form.get('deployment_type', 'full')
            traffic_percentage = float(request.form.get('traffic_percentage', 100))
            requester = request.form.get('requester', 'system')
            
            if not title:
                flash('请输入标题', 'danger')
                return redirect(request.url)
            
            version = f"v{datetime.now().strftime('%Y%m%d%H%M%S')}"
            from models import DeploymentRequest
            deployment = DeploymentRequest(
                project_id=project_id,
                training_run_id=training_run_id,
                version=version,
                title=title,
                description=description,
                deployment_type=deployment_type,
                traffic_percentage=traffic_percentage,
                requester=requester,
                status='pending'
            )
            db.session.add(deployment)
            db.session.commit()
            
            flash(f'上线申请创建成功，版本: {version}', 'success')
            return redirect(url_for('deployment_detail', deployment_id=deployment.id))
        
        return render_template('create_deployment.html', project=project, training_runs=training_runs)
    
    @app.route('/deployment/<int:deployment_id>')
    def deployment_detail(deployment_id):
        from models import DeploymentRequest, ApprovalRecord
        
        deployment = DeploymentRequest.query.get_or_404(deployment_id)
        approvals = ApprovalRecord.query.filter_by(deployment_request_id=deployment_id).order_by(ApprovalRecord.created_at.asc()).all()
        
        return render_template('deployment_detail.html', deployment=deployment, approvals=approvals)
    
    @app.route('/deployment/<int:deployment_id>/approve', methods=['POST'])
    def approve_deployment(deployment_id):
        from models import DeploymentRequest, ApprovalRecord, AuditLog
        
        deployment = DeploymentRequest.query.get_or_404(deployment_id)
        approver = request.form.get('approver', 'admin')
        comment = request.form.get('comment')
        
        approval = ApprovalRecord(
            deployment_request_id=deployment_id,
            approver=approver,
            action='approve',
            comment=comment
        )
        db.session.add(approval)
        
        deployment.status = 'approved'
        db.session.commit()
        
        audit = AuditLog(
            deployment_request_id=deployment_id,
            action='approve',
            actor=approver,
            details=f"Approved deployment {deployment.version}"
        )
        db.session.add(audit)
        db.session.commit()
        
        flash('上线申请已批准', 'success')
        return redirect(url_for('deployment_detail', deployment_id=deployment_id))
    
    @app.route('/deployment/<int:deployment_id>/reject', methods=['POST'])
    def reject_deployment(deployment_id):
        from models import DeploymentRequest, ApprovalRecord, AuditLog
        
        deployment = DeploymentRequest.query.get_or_404(deployment_id)
        approver = request.form.get('approver', 'admin')
        comment = request.form.get('comment')
        
        approval = ApprovalRecord(
            deployment_request_id=deployment_id,
            approver=approver,
            action='reject',
            comment=comment
        )
        db.session.add(approval)
        
        deployment.status = 'rejected'
        db.session.commit()
        
        audit = AuditLog(
            deployment_request_id=deployment_id,
            action='reject',
            actor=approver,
            details=f"Rejected deployment {deployment.version}"
        )
        db.session.add(audit)
        db.session.commit()
        
        flash('上线申请已拒绝', 'warning')
        return redirect(url_for('deployment_detail', deployment_id=deployment_id))
    
    @app.route('/deployment/<int:deployment_id>/deploy', methods=['POST'])
    def deploy_model(deployment_id):
        from models import DeploymentRequest, AuditLog
        
        deployment = DeploymentRequest.query.get_or_404(deployment_id)
        
        if deployment.status != 'approved':
            flash('只有已批准的申请才能上线', 'danger')
            return redirect(url_for('deployment_detail', deployment_id=deployment_id))
        
        deployment.status = 'deployed'
        deployment.deployed_at = datetime.utcnow()
        db.session.commit()
        
        audit = AuditLog(
            deployment_request_id=deployment_id,
            action='deploy',
            actor='system',
            details=f"Deployed {deployment.deployment_type} with {deployment.traffic_percentage}% traffic"
        )
        db.session.add(audit)
        db.session.commit()
        
        flash(f'模型已上线，类型: {deployment.deployment_type}, 流量: {deployment.traffic_percentage}%', 'success')
        return redirect(url_for('deployment_detail', deployment_id=deployment_id))
    
    @app.route('/project/<int:project_id>/rollback', methods=['POST'])
    def rollback_pipeline(project_id):
        target_stage = request.form.get('target_stage')
        actor = request.form.get('actor', 'system')
        
        if not target_stage or target_stage not in PipelineStage.get_stages():
            flash('无效的阶段', 'danger')
            return redirect(url_for('project_detail', project_id=project_id))
        
        manager = PipelineManager(app.config)
        success, results = manager.rollback_to_stage(project_id, target_stage, actor)
        
        if success:
            flash(f'回滚成功到阶段: {target_stage}', 'success')
        else:
            flash(f'回滚失败: {results}', 'danger')
        
        return redirect(url_for('project_detail', project_id=project_id))
    
    @app.route('/project/<int:project_id>/generate_report', methods=['POST'])
    def generate_report(project_id):
        report_type = request.form.get('report_type', 'markdown')
        generator = ReportGenerator(app.config['REPORTS_FOLDER'])
        
        try:
            if report_type == 'json':
                filepath, content = generator.generate_json_report(project_id)
            else:
                filepath, content = generator.generate_markdown_report(project_id)
            
            flash(f'报告已生成: {os.path.basename(filepath)}', 'success')
            return redirect(url_for('list_reports', project_id=project_id))
        except Exception as e:
            flash(f'报告生成失败: {str(e)}', 'danger')
            return redirect(url_for('project_detail', project_id=project_id))
    
    @app.route('/project/<int:project_id>/reports')
    def list_reports(project_id):
        project = Project.query.get_or_404(project_id)
        
        reports_dir = app.config['REPORTS_FOLDER']
        reports = []
        
        if os.path.exists(reports_dir):
            for filename in sorted(os.listdir(reports_dir), reverse=True):
                if filename.endswith('.md') or filename.endswith('.json'):
                    filepath = os.path.join(reports_dir, filename)
                    reports.append({
                        'filename': filename,
                        'size': os.path.getsize(filepath),
                        'created': datetime.fromtimestamp(os.path.getctime(filepath))
                    })
        
        return render_template('reports.html', project=project, reports=reports)
    
    @app.route('/reports/<filename>')
    def download_report(filename):
        return send_from_directory(app.config['REPORTS_FOLDER'], filename, as_attachment=True)
    
    @app.route('/project/<int:project_id>/compare_models', methods=['GET', 'POST'])
    def compare_models_view(project_id):
        from models import TrainingRun
        
        project = Project.query.get_or_404(project_id)
        training_runs = TrainingRun.query.filter_by(project_id=project_id, status='completed').order_by(TrainingRun.created_at.desc()).all()
        
        if request.method == 'POST':
            selected_runs = request.form.getlist('training_runs')
            
            if len(selected_runs) < 2:
                flash('请选择至少2个模型进行对比', 'danger')
                return redirect(request.url)
            
            try:
                selected_ids = [int(r) for r in selected_runs]
                filepath, content = generate_model_comparison_report(selected_ids, app.config['REPORTS_FOLDER'])
                
                flash(f'对比报告已生成: {os.path.basename(filepath)}', 'success')
                return redirect(url_for('list_reports', project_id=project_id))
            except Exception as e:
                flash(f'生成对比报告失败: {str(e)}', 'danger')
                return redirect(request.url)
        
        return render_template('compare_models.html', project=project, training_runs=training_runs)
    
    @app.route('/training/<int:training_id>/playback', methods=['GET', 'POST'])
    def test_playback(training_id):
        from models import TrainingRun
        
        training = TrainingRun.query.get_or_404(training_id)
        
        if request.method == 'POST':
            if 'test_file' not in request.files:
                flash('请上传测试文件', 'danger')
                return redirect(request.url)
            
            file = request.files['test_file']
            if file.filename == '':
                flash('请选择文件', 'danger')
                return redirect(request.url)
            
            try:
                file_path, filename = save_file(file, app.config['UPLOAD_FOLDER'], 'test_data')
                result, message = run_test_set_playback(training_id, file_path)
                
                if result:
                    return render_template('playback_result.html',
                                         training=training,
                                         result=result,
                                         message=message)
                else:
                    flash(message, 'danger')
                    return redirect(request.url)
            except Exception as e:
                flash(f'回放失败: {str(e)}', 'danger')
                return redirect(request.url)
        
        return render_template('playback.html', training=training)
    
    return app

if __name__ == '__main__':
    app = create_app('development')
    app.run(debug=True, host='0.0.0.0', port=5000)
