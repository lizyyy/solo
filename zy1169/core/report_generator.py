import os
import json
from datetime import datetime
from models import (
    db, Project, DatasetVersion, CleaningTask, FeatureVersion,
    TrainingRun, Validation, DeploymentRequest, ApprovalRecord,
    DataQualityCheck, FeatureCheck, AuditLog
)

class ReportGenerator:
    def __init__(self, reports_folder):
        self.reports_folder = reports_folder
    
    def generate_markdown_report(self, project_id, include_all=True):
        project = Project.query.get(project_id)
        if not project:
            return None, "Project not found"
        
        lines = []
        
        lines.append(f"# ML Pipeline Report: {project.name}")
        lines.append("")
        lines.append(f"**Generated:** {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}")
        lines.append("")
        lines.append("---")
        lines.append("")
        
        lines.append("## 1. Project Overview")
        lines.append("")
        lines.append(f"- **Name:** {project.name}")
        lines.append(f"- **Description:** {project.description or 'N/A'}")
        lines.append(f"- **Created:** {project.created_at}")
        lines.append("")
        
        lines.append("## 2. Dataset Versions")
        lines.append("")
        
        datasets = DatasetVersion.query.filter_by(project_id=project_id).all()
        if datasets:
            lines.append("| Version | Rows | Columns | Created |")
            lines.append("|---------|------|---------|---------|")
            for ds in datasets:
                lines.append(f"| {ds.version} | {ds.row_count or 'N/A'} | {ds.column_count or 'N/A'} | {ds.created_at} |")
        else:
            lines.append("*No dataset versions found.*")
        lines.append("")
        
        lines.append("## 3. Data Quality Checks")
        lines.append("")
        
        all_checks = []
        for ds in datasets:
            checks = DataQualityCheck.query.filter_by(dataset_id=ds.id).all()
            all_checks.extend([(ds.version, c) for c in checks])
        
        if all_checks:
            lines.append("| Dataset | Check Type | Column | Status | Message |")
            lines.append("|---------|------------|--------|--------|---------|")
            for version, check in all_checks:
                status_icon = self._get_status_icon(check.status)
                lines.append(f"| {version} | {check.check_type} | {check.column_name or 'N/A'} | {status_icon} {check.status} | {check.message} |")
        else:
            lines.append("*No quality checks performed.*")
        lines.append("")
        
        lines.append("## 4. Cleaning Tasks")
        lines.append("")
        
        cleaning_tasks = CleaningTask.query.filter_by(project_id=project_id).all()
        if cleaning_tasks:
            lines.append("| Version | Status | Rows Before | Rows After | Duration |")
            lines.append("|---------|--------|-------------|------------|----------|")
            for ct in cleaning_tasks:
                duration = self._calculate_duration(ct.started_at, ct.completed_at)
                lines.append(f"| {ct.version} | {ct.status} | {ct.row_count_before or 'N/A'} | {ct.row_count_after or 'N/A'} | {duration} |")
        else:
            lines.append("*No cleaning tasks found.*")
        lines.append("")
        
        lines.append("## 5. Feature Engineering")
        lines.append("")
        
        feature_versions = FeatureVersion.query.filter_by(project_id=project_id).all()
        if feature_versions:
            lines.append("| Version | Status | Features | Rows |")
            lines.append("|---------|--------|----------|------|")
            for fv in feature_versions:
                lines.append(f"| {fv.version} | {fv.status} | {fv.feature_count or 'N/A'} | {fv.row_count or 'N/A'} |")
        else:
            lines.append("*No feature versions found.*")
        lines.append("")
        
        lines.append("## 6. Training Runs")
        lines.append("")
        
        training_runs = TrainingRun.query.filter_by(project_id=project_id, status='completed').all()
        if training_runs:
            for run in training_runs:
                lines.append(f"### Training Run: {run.version}")
                lines.append("")
                lines.append(f"- **Model Type:** {run.model_type or 'N/A'}")
                lines.append(f"- **Train Rows:** {run.train_rows or 'N/A'}")
                lines.append(f"- **Test Rows:** {run.test_rows or 'N/A'}")
                lines.append("")
                
                lines.append("#### Validation Metrics")
                lines.append("")
                validations = Validation.query.filter_by(training_run_id=run.id).all()
                if validations:
                    lines.append("| Metric | Value | Threshold | Status |")
                    lines.append("|--------|-------|-----------|--------|")
                    for v in validations:
                        status_icon = self._get_status_icon(v.status)
                        lines.append(f"| {v.metric_name} | {v.value:.4f} | {v.threshold or 'N/A'} | {status_icon} {v.status} |")
                else:
                    lines.append("*No validation metrics found.*")
                lines.append("")
        else:
            lines.append("*No completed training runs found.*")
        lines.append("")
        
        lines.append("## 7. Deployment History")
        lines.append("")
        
        deployments = DeploymentRequest.query.filter_by(project_id=project_id).all()
        if deployments:
            lines.append("| Version | Title | Status | Traffic | Created |")
            lines.append("|---------|-------|--------|---------|---------|")
            for d in deployments:
                traffic = f"{d.traffic_percentage}%" if d.deployment_type == 'canary' else '100%'
                lines.append(f"| {d.version} | {d.title} | {d.status} | {traffic} | {d.created_at} |")
        else:
            lines.append("*No deployment requests found.*")
        lines.append("")
        
        lines.append("## 8. Audit Log")
        lines.append("")
        
        audit_logs = AuditLog.query.order_by(AuditLog.created_at.desc()).limit(50).all()
        if audit_logs:
            lines.append("| Time | Actor | Action | Details |")
            lines.append("|------|-------|--------|---------|")
            for log in audit_logs:
                lines.append(f"| {log.created_at} | {log.actor or 'system'} | {log.action} | {log.details or 'N/A'} |")
        else:
            lines.append("*No audit logs found.*")
        lines.append("")
        
        report_content = "\n".join(lines)
        
        filename = f"report_{project_id}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.md"
        filepath = os.path.join(self.reports_folder, filename)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(report_content)
        
        return filepath, report_content
    
    def generate_json_report(self, project_id):
        project = Project.query.get(project_id)
        if not project:
            return None, "Project not found"
        
        report = {
            'generated_at': datetime.utcnow().isoformat(),
            'project': {
                'id': project.id,
                'name': project.name,
                'description': project.description,
                'created_at': project.created_at.isoformat() if project.created_at else None
            },
            'datasets': [],
            'cleaning_tasks': [],
            'feature_versions': [],
            'training_runs': [],
            'deployments': [],
            'audit_logs': []
        }
        
        datasets = DatasetVersion.query.filter_by(project_id=project_id).all()
        for ds in datasets:
            quality_checks = DataQualityCheck.query.filter_by(dataset_id=ds.id).all()
            report['datasets'].append({
                'id': ds.id,
                'version': ds.version,
                'row_count': ds.row_count,
                'column_count': ds.column_count,
                'columns': ds.columns.split(',') if ds.columns else [],
                'created_at': ds.created_at.isoformat() if ds.created_at else None,
                'quality_checks': [{
                    'check_type': qc.check_type,
                    'column_name': qc.column_name,
                    'status': qc.status,
                    'message': qc.message,
                    'value': qc.value,
                    'threshold': qc.threshold
                } for qc in quality_checks]
            })
        
        cleaning_tasks = CleaningTask.query.filter_by(project_id=project_id).all()
        for ct in cleaning_tasks:
            report['cleaning_tasks'].append({
                'id': ct.id,
                'version': ct.version,
                'status': ct.status,
                'row_count_before': ct.row_count_before,
                'row_count_after': ct.row_count_after,
                'column_count_before': ct.column_count_before,
                'column_count_after': ct.column_count_after,
                'error_message': ct.error_message,
                'started_at': ct.started_at.isoformat() if ct.started_at else None,
                'completed_at': ct.completed_at.isoformat() if ct.completed_at else None
            })
        
        feature_versions = FeatureVersion.query.filter_by(project_id=project_id).all()
        for fv in feature_versions:
            feature_checks = FeatureCheck.query.filter_by(feature_version_id=fv.id).all()
            report['feature_versions'].append({
                'id': fv.id,
                'version': fv.version,
                'status': fv.status,
                'feature_count': fv.feature_count,
                'feature_names': fv.feature_names.split(',') if fv.feature_names else [],
                'row_count': fv.row_count,
                'error_message': fv.error_message,
                'started_at': fv.started_at.isoformat() if fv.started_at else None,
                'completed_at': fv.completed_at.isoformat() if fv.completed_at else None,
                'feature_checks': [{
                    'check_type': fc.check_type,
                    'feature_name': fc.feature_name,
                    'status': fc.status,
                    'message': fc.message,
                    'value': fc.value
                } for fc in feature_checks]
            })
        
        training_runs = TrainingRun.query.filter_by(project_id=project_id).all()
        for tr in training_runs:
            validations = Validation.query.filter_by(training_run_id=tr.id).all()
            report['training_runs'].append({
                'id': tr.id,
                'version': tr.version,
                'status': tr.status,
                'model_type': tr.model_type,
                'hyperparameters': tr.hyperparameters,
                'train_rows': tr.train_rows,
                'test_rows': tr.test_rows,
                'error_message': tr.error_message,
                'started_at': tr.started_at.isoformat() if tr.started_at else None,
                'completed_at': tr.completed_at.isoformat() if tr.completed_at else None,
                'metrics': [{
                    'metric_name': v.metric_name,
                    'value': v.value,
                    'threshold': v.threshold,
                    'status': v.status
                } for v in validations]
            })
        
        deployments = DeploymentRequest.query.filter_by(project_id=project_id).all()
        for d in deployments:
            approvals = ApprovalRecord.query.filter_by(deployment_request_id=d.id).all()
            report['deployments'].append({
                'id': d.id,
                'version': d.version,
                'title': d.title,
                'description': d.description,
                'status': d.status,
                'deployment_type': d.deployment_type,
                'traffic_percentage': d.traffic_percentage,
                'requester': d.requester,
                'created_at': d.created_at.isoformat() if d.created_at else None,
                'deployed_at': d.deployed_at.isoformat() if d.deployed_at else None,
                'approvals': [{
                    'approver': a.approver,
                    'action': a.action,
                    'comment': a.comment,
                    'created_at': a.created_at.isoformat() if a.created_at else None
                } for a in approvals]
            })
        
        audit_logs = AuditLog.query.order_by(AuditLog.created_at.desc()).limit(100).all()
        for log in audit_logs:
            report['audit_logs'].append({
                'id': log.id,
                'action': log.action,
                'actor': log.actor,
                'details': log.details,
                'ip_address': log.ip_address,
                'created_at': log.created_at.isoformat() if log.created_at else None
            })
        
        filename = f"report_{project_id}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.json"
        filepath = os.path.join(self.reports_folder, filename)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2)
        
        return filepath, report
    
    def _get_status_icon(self, status):
        status = status.lower()
        if status == 'passed' or status == 'success' or status == 'completed':
            return '✅'
        elif status == 'failed' or status == 'danger' or status == 'error':
            return '❌'
        elif status == 'warning':
            return '⚠️'
        elif status == 'info':
            return 'ℹ️'
        elif status == 'running' or status == 'pending':
            return '⏳'
        else:
            return ''
    
    def _calculate_duration(self, start, end):
        if not start or not end:
            return 'N/A'
        delta = end - start
        return str(delta)


def generate_model_comparison_report(model_run_ids, reports_folder):
    comparisons = []
    
    for run_id in model_run_ids:
        training_run = TrainingRun.query.get(run_id)
        if not training_run:
            continue
        
        validations = Validation.query.filter_by(training_run_id=run_id).all()
        metrics = {v.metric_name: {'value': v.value, 'status': v.status} for v in validations}
        
        comparisons.append({
            'run_id': run_id,
            'version': training_run.version,
            'model_type': training_run.model_type,
            'train_rows': training_run.train_rows,
            'test_rows': training_run.test_rows,
            'metrics': metrics,
            'status': training_run.status,
            'created_at': training_run.created_at.isoformat() if training_run.created_at else None
        })
    
    lines = []
    lines.append("# Model Comparison Report")
    lines.append("")
    lines.append(f"**Generated:** {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}")
    lines.append("")
    lines.append("---")
    lines.append("")
    
    if comparisons:
        all_metrics = set()
        for comp in comparisons:
            all_metrics.update(comp['metrics'].keys())
        
        lines.append("## Summary")
        lines.append("")
        header = "| Version | Model Type |"
        separator = "|---------|------------|"
        for metric in sorted(all_metrics):
            header += f" {metric} |"
            separator += " " + "-" * len(metric) + " |"
        header += " Status |"
        separator += "--------|"
        
        lines.append(header)
        lines.append(separator)
        
        for comp in comparisons:
            row = f"| {comp['version']} | {comp['model_type'] or 'N/A'} |"
            for metric in sorted(all_metrics):
                if metric in comp['metrics']:
                    m = comp['metrics'][metric]
                    icon = '✅' if m['status'] == 'passed' else '❌'
                    row += f" {m['value']:.4f} {icon} |"
                else:
                    row += " N/A |"
            row += f" {comp['status']} |"
            lines.append(row)
    else:
        lines.append("*No models to compare.*")
    
    report_content = "\n".join(lines)
    
    filename = f"comparison_report_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.md"
    filepath = os.path.join(reports_folder, filename)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(report_content)
    
    return filepath, report_content
