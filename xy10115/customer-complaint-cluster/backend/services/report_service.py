import os
import pandas as pd
from datetime import datetime
from flask import current_app
from backend.models.models import (
    Cluster, Complaint, ClusterAssignment, 
    Version, OperationLog, Rule
)


class ReportService:
    
    @staticmethod
    def generate_summary():
        total_complaints = Complaint.query.count()
        with_cluster = Complaint.query.filter(Complaint.current_cluster_id.isnot(None)).count()
        without_cluster = total_complaints - with_cluster
        total_clusters = Cluster.query.count()
        
        clusters = Cluster.query.all()
        cluster_sizes = []
        for c in clusters:
            count = Complaint.query.filter_by(current_cluster_id=c.id).count()
            cluster_sizes.append({
                'cluster_id': c.id,
                'cluster_name': c.name,
                'count': count,
                'is_manual': c.is_manual,
                'keywords': c.keywords
            })
        
        cluster_sizes.sort(key=lambda x: x['count'], reverse=True)
        
        total_versions = Version.query.count()
        current_version = Version.query.filter_by(is_current=True).first()
        
        total_operations = OperationLog.query.count()
        operation_types = {}
        ops = OperationLog.query.all()
        for op in ops:
            operation_types[op.operation_type] = operation_types.get(op.operation_type, 0) + 1
        
        manual_clusters = sum(1 for c in clusters if c.is_manual)
        auto_clusters = total_clusters - manual_clusters
        
        return {
            'summary': {
                'total_complaints': total_complaints,
                'with_cluster': with_cluster,
                'without_cluster': without_cluster,
                'cluster_rate': round(with_cluster / total_complaints * 100, 2) if total_complaints > 0 else 0,
                'total_clusters': total_clusters,
                'manual_clusters': manual_clusters,
                'auto_clusters': auto_clusters,
                'total_versions': total_versions,
                'current_version': current_version.to_dict() if current_version else None,
                'total_operations': total_operations,
                'operation_types': operation_types
            },
            'top_clusters': cluster_sizes[:10],
            'all_clusters': cluster_sizes
        }
    
    @staticmethod
    def export_clusters(format='csv'):
        clusters = Cluster.query.all()
        data = []
        
        for cluster in clusters:
            complaints = Complaint.query.filter_by(current_cluster_id=cluster.id).all()
            
            for complaint in complaints:
                assignment = ClusterAssignment.query.filter_by(
                    complaint_id=complaint.id,
                    cluster_id=cluster.id
                ).order_by(ClusterAssignment.created_at.desc()).first()
                
                data.append({
                    'cluster_id': cluster.id,
                    'cluster_name': cluster.name,
                    'cluster_description': cluster.description,
                    'cluster_keywords': cluster.keywords,
                    'is_manual_cluster': cluster.is_manual,
                    'complaint_id': complaint.id,
                    'original_id': complaint.original_id or '',
                    'complaint_text': complaint.text,
                    'original_tags': complaint.original_tags or '',
                    'assignment_confidence': assignment.confidence if assignment else None,
                    'assignment_reason': assignment.reason if assignment else '',
                    'is_manual_assignment': assignment.is_manual if assignment else None
                })
        
        df = pd.DataFrame(data)
        
        export_dir = current_app.config['EXPORT_FOLDER']
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
        
        if format == 'csv':
            filename = f'clusters_{timestamp}.csv'
            filepath = os.path.join(export_dir, filename)
            df.to_csv(filepath, index=False, encoding='utf-8-sig')
        else:
            filename = f'clusters_{timestamp}.xlsx'
            filepath = os.path.join(export_dir, filename)
            df.to_excel(filepath, index=False)
        
        return filepath, filename
    
    @staticmethod
    def export_operations(format='csv'):
        operations = OperationLog.query.order_by(OperationLog.created_at.desc()).all()
        
        data = []
        for op in operations:
            version = Version.query.get(op.version_id) if op.version_id else None
            data.append({
                'operation_id': op.id,
                'version_id': op.version_id,
                'version_name': version.name if version else '',
                'operation_type': op.operation_type,
                'target_type': op.target_type,
                'target_id': op.target_id,
                'old_value': op.old_value or '',
                'new_value': op.new_value or '',
                'reason': op.reason or '',
                'created_at': op.created_at.strftime('%Y-%m-%d %H:%M:%S') if op.created_at else ''
            })
        
        df = pd.DataFrame(data)
        
        export_dir = current_app.config['EXPORT_FOLDER']
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
        
        if format == 'csv':
            filename = f'operations_{timestamp}.csv'
            filepath = os.path.join(export_dir, filename)
            df.to_csv(filepath, index=False, encoding='utf-8-sig')
        else:
            filename = f'operations_{timestamp}.xlsx'
            filepath = os.path.join(export_dir, filename)
            df.to_excel(filepath, index=False)
        
        return filepath, filename
    
    @staticmethod
    def get_operations_log(page=1, per_page=50):
        operations = OperationLog.query.order_by(OperationLog.created_at.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        items = []
        for op in operations.items:
            version = Version.query.get(op.version_id) if op.version_id else None
            items.append({
                **op.to_dict(),
                'version_name': version.name if version else ''
            })
        
        return {
            'items': items,
            'total': operations.total,
            'page': page,
            'per_page': per_page,
            'pages': operations.pages
        }
