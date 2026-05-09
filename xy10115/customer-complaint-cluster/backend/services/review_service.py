from datetime import datetime
from backend.models.models import (
    db, Complaint, Cluster, ClusterAssignment, 
    Version, OperationLog
)


class ReviewService:
    
    @staticmethod
    def move_complaint(complaint_id, target_cluster_id, reason=None):
        complaint = Complaint.query.get(complaint_id)
        if not complaint:
            raise ValueError('Complaint not found')
        
        target_cluster = Cluster.query.get(target_cluster_id)
        if not target_cluster:
            raise ValueError('Target cluster not found')
        
        old_cluster_id = complaint.current_cluster_id
        old_cluster = Cluster.query.get(old_cluster_id) if old_cluster_id else None
        
        current_version = Version.query.filter_by(is_current=True).first()
        
        new_version = Version(
            name=f'人工修正-{datetime.now().strftime("%Y%m%d%H%M%S")}',
            description=reason or f'将投诉 #{complaint.id} 从 "{old_cluster.name if old_cluster else "未分类"}" 移动到 "{target_cluster.name}"',
            type='manual',
            parent_version_id=current_version.id if current_version else None,
            is_current=True
        )
        db.session.add(new_version)
        db.session.flush()
        
        if current_version:
            current_version.is_current = False
        
        assignment = ClusterAssignment(
            complaint_id=complaint.id,
            cluster_id=target_cluster.id,
            version_id=new_version.id,
            confidence=1.0,
            reason=reason or '人工复核修正',
            is_manual=True
        )
        db.session.add(assignment)
        
        complaint.current_cluster_id = target_cluster.id
        
        op_log = OperationLog(
            version_id=new_version.id,
            operation_type='manual_move',
            target_type='complaint',
            target_id=complaint.id,
            old_value=f"簇ID: {old_cluster_id}, 簇名: {old_cluster.name if old_cluster else '未分类'}",
            new_value=f"簇ID: {target_cluster.id}, 簇名: {target_cluster.name}",
            reason=reason or '人工复核修正'
        )
        db.session.add(op_log)
        
        db.session.commit()
        
        return {
            'version_id': new_version.id,
            'version_name': new_version.name,
            'complaint_id': complaint.id,
            'old_cluster_id': old_cluster_id,
            'old_cluster_name': old_cluster.name if old_cluster else None,
            'new_cluster_id': target_cluster.id,
            'new_cluster_name': target_cluster.name
        }
    
    @staticmethod
    def create_cluster(name, description=None, complaint_ids=None, reason=None):
        current_version = Version.query.filter_by(is_current=True).first()
        
        new_version = Version(
            name=f'新建聚类-{datetime.now().strftime("%Y%m%d%H%M%S")}',
            description=reason or f'手动创建新聚类: {name}',
            type='manual',
            parent_version_id=current_version.id if current_version else None,
            is_current=True
        )
        db.session.add(new_version)
        db.session.flush()
        
        if current_version:
            current_version.is_current = False
        
        cluster = Cluster(
            name=name,
            description=description,
            version_id=new_version.id,
            is_manual=True
        )
        db.session.add(cluster)
        db.session.flush()
        
        moved_count = 0
        if complaint_ids:
            for complaint_id in complaint_ids:
                complaint = Complaint.query.get(complaint_id)
                if not complaint:
                    continue
                
                old_cluster_id = complaint.current_cluster_id
                old_cluster = Cluster.query.get(old_cluster_id) if old_cluster_id else None
                
                assignment = ClusterAssignment(
                    complaint_id=complaint.id,
                    cluster_id=cluster.id,
                    version_id=new_version.id,
                    confidence=1.0,
                    reason=reason or '手动创建新聚类并移入',
                    is_manual=True
                )
                db.session.add(assignment)
                
                complaint.current_cluster_id = cluster.id
                
                op_log = OperationLog(
                    version_id=new_version.id,
                    operation_type='manual_create_and_move',
                    target_type='complaint',
                    target_id=complaint.id,
                    old_value=f"簇ID: {old_cluster_id}, 簇名: {old_cluster.name if old_cluster else '未分类'}",
                    new_value=f"簇ID: {cluster.id}, 簇名: {cluster.name}",
                    reason=reason or '手动创建新聚类并移入'
                )
                db.session.add(op_log)
                moved_count += 1
        
        db.session.commit()
        
        return {
            'version_id': new_version.id,
            'version_name': new_version.name,
            'cluster_id': cluster.id,
            'cluster_name': cluster.name,
            'moved_complaints': moved_count
        }
    
    @staticmethod
    def update_cluster(cluster_id, name=None, description=None, reason=None):
        cluster = Cluster.query.get(cluster_id)
        if not cluster:
            raise ValueError('Cluster not found')
        
        current_version = Version.query.filter_by(is_current=True).first()
        
        old_name = cluster.name
        old_desc = cluster.description
        
        new_version = Version(
            name=f'修改聚类-{datetime.now().strftime("%Y%m%d%H%M%S")}',
            description=reason or f'修改聚类 "{old_name}" 的信息',
            type='manual',
            parent_version_id=current_version.id if current_version else None,
            is_current=True
        )
        db.session.add(new_version)
        db.session.flush()
        
        if current_version:
            current_version.is_current = False
        
        if name:
            cluster.name = name
        if description is not None:
            cluster.description = description
        
        op_log = OperationLog(
            version_id=new_version.id,
            operation_type='cluster_update',
            target_type='cluster',
            target_id=cluster.id,
            old_value=f"名称: {old_name}, 描述: {old_desc}",
            new_value=f"名称: {cluster.name}, 描述: {cluster.description}",
            reason=reason or '手动修改聚类信息'
        )
        db.session.add(op_log)
        
        db.session.commit()
        
        return {
            'version_id': new_version.id,
            'version_name': new_version.name,
            'cluster_id': cluster.id,
            'cluster_name': cluster.name
        }
