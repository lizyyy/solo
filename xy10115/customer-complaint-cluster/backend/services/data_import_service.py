import os
import pandas as pd
from datetime import datetime
from werkzeug.utils import secure_filename
from flask import current_app
from backend.models.models import db, Complaint, Version, OperationLog


class DataImportService:
    
    @staticmethod
    def import_from_file(file_path, text_column='text', tag_column='tags', id_column=None):
        ext = os.path.splitext(file_path)[1].lower()
        
        if ext == '.csv':
            df = pd.read_csv(file_path, encoding='utf-8')
        elif ext in ['.xlsx', '.xls']:
            df = pd.read_excel(file_path)
        else:
            raise ValueError('Unsupported file format. Only CSV and Excel files are supported.')
        
        if text_column not in df.columns:
            raise ValueError(f'Text column "{text_column}" not found in file')
        
        complaints = []
        for index, row in df.iterrows():
            text = str(row[text_column]).strip()
            if not text:
                continue
            
            original_id = None
            if id_column and id_column in df.columns:
                original_id = str(row[id_column])
            
            original_tags = None
            if tag_column in df.columns and pd.notna(row[tag_column]):
                original_tags = str(row[tag_column])
            
            complaint = Complaint(
                original_id=original_id,
                text=text,
                original_tags=original_tags,
                import_time=datetime.utcnow()
            )
            complaints.append(complaint)
        
        db.session.bulk_save_objects(complaints)
        db.session.commit()
        
        version = Version(
            name=f'数据导入-{datetime.now().strftime("%Y%m%d%H%M%S")}',
            description=f'从文件 {os.path.basename(file_path)} 导入了 {len(complaints)} 条投诉数据',
            type='import',
            is_current=True
        )
        db.session.add(version)
        db.session.commit()
        
        return {
            'total': len(complaints),
            'version_id': version.id,
            'version_name': version.name
        }
    
    @staticmethod
    def get_complaints(page=1, per_page=20, cluster_id=None, version_id=None):
        query = Complaint.query
        
        if cluster_id:
            query = query.filter_by(current_cluster_id=cluster_id)
        
        complaints = query.order_by(Complaint.id.desc()).paginate(page=page, per_page=per_page, error_out=False)
        
        return {
            'items': [c.to_dict() for c in complaints.items],
            'total': complaints.total,
            'page': page,
            'per_page': per_page,
            'pages': complaints.pages
        }
    
    @staticmethod
    def get_complaint(complaint_id):
        complaint = Complaint.query.get(complaint_id)
        if not complaint:
            return None
        
        from backend.models.models import ClusterAssignment, Cluster
        
        assignments = ClusterAssignment.query.filter_by(complaint_id=complaint_id).order_by(ClusterAssignment.created_at.desc()).all()
        
        assignment_details = []
        for assn in assignments:
            cluster = Cluster.query.get(assn.cluster_id)
            assignment_details.append({
                **assn.to_dict(),
                'cluster_name': cluster.name if cluster else None
            })
        
        return {
            **complaint.to_dict(),
            'assignment_history': assignment_details
        }
    
    @staticmethod
    def save_uploaded_file(file):
        filename = secure_filename(file.filename)
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
        filename = f'{timestamp}_{filename}'
        file_path = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
        file.save(file_path)
        return file_path
    
    @staticmethod
    def get_stats():
        total_complaints = Complaint.query.count()
        with_cluster = Complaint.query.filter(Complaint.current_cluster_id.isnot(None)).count()
        without_cluster = total_complaints - with_cluster
        versions = Version.query.count()
        
        return {
            'total_complaints': total_complaints,
            'with_cluster': with_cluster,
            'without_cluster': without_cluster,
            'versions': versions
        }
