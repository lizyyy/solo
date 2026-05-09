from backend.models.models import (
    db, Version, Cluster, ClusterAssignment, 
    Complaint, OperationLog
)


class HistoryService:
    
    @staticmethod
    def get_versions(page=1, per_page=20):
        versions = Version.query.order_by(Version.created_at.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        items = []
        for v in versions.items:
            items.append({
                **v.to_dict(),
                'cluster_count': Cluster.query.filter_by(version_id=v.id).count(),
                'operation_count': OperationLog.query.filter_by(version_id=v.id).count()
            })
        
        return {
            'items': items,
            'total': versions.total,
            'page': page,
            'per_page': per_page,
            'pages': versions.pages
        }
    
    @staticmethod
    def get_version(version_id):
        version = Version.query.get(version_id)
        if not version:
            return None
        
        operations = OperationLog.query.filter_by(version_id=version_id).order_by(OperationLog.created_at.desc()).all()
        clusters = Cluster.query.filter_by(version_id=version_id).all()
        
        cluster_details = []
        for c in clusters:
            count = ClusterAssignment.query.filter_by(cluster_id=c.id, version_id=version_id).count()
            cluster_details.append({
                **c.to_dict(),
                'complaint_count': count
            })
        
        return {
            **version.to_dict(),
            'operations': [op.to_dict() for op in operations],
            'clusters': cluster_details,
            'parent': version.parent.to_dict() if version.parent else None,
            'children': [child.to_dict() for child in version.child_versions]
        }
    
    @staticmethod
    def rollback_to_version(version_id, reason=None):
        target_version = Version.query.get(version_id)
        if not target_version:
            raise ValueError('Target version not found')
        
        current_version = Version.query.filter_by(is_current=True).first()
        
        assignments = ClusterAssignment.query.filter_by(version_id=version_id).all()
        
        new_version = Version(
            name=f'回滚至版本{version_id}-{target_version.name}',
            description=reason or f'回滚至版本: {target_version.name}',
            type='rollback',
            parent_version_id=current_version.id if current_version else None,
            is_current=True
        )
        db.session.add(new_version)
        db.session.flush()
        
        if current_version:
            current_version.is_current = False
        
        target_assignments = {a.complaint_id: a for a in assignments}
        
        for complaint_id, old_assignment in target_assignments.items():
            complaint = Complaint.query.get(complaint_id)
            if not complaint:
                continue
            
            old_cluster_id = complaint.current_cluster_id
            old_cluster = Cluster.query.get(old_cluster_id) if old_cluster_id else None
            
            target_cluster = Cluster.query.get(old_assignment.cluster_id)
            
            new_assignment = ClusterAssignment(
                complaint_id=complaint.id,
                cluster_id=old_assignment.cluster_id,
                version_id=new_version.id,
                confidence=old_assignment.confidence,
                reason=reason or f'回滚至版本 {version_id}: {old_assignment.reason}',
                is_manual=True
            )
            db.session.add(new_assignment)
            
            complaint.current_cluster_id = old_assignment.cluster_id
            
            op_log = OperationLog(
                version_id=new_version.id,
                operation_type='rollback',
                target_type='complaint',
                target_id=complaint.id,
                old_value=f"簇ID: {old_cluster_id}, 簇名: {old_cluster.name if old_cluster else '未分类'}",
                new_value=f"簇ID: {old_assignment.cluster_id}, 簇名: {target_cluster.name if target_cluster else '未分类'}",
                reason=reason or f'回滚至版本 {version_id}'
            )
            db.session.add(op_log)
        
        db.session.commit()
        
        return {
            'version_id': new_version.id,
            'version_name': new_version.name,
            'restored_complaints': len(target_assignments),
            'target_version_id': version_id,
            'target_version_name': target_version.name
        }
    
    @staticmethod
    def get_complaint_history(complaint_id):
        complaint = Complaint.query.get(complaint_id)
        if not complaint:
            return None
        
        assignments = ClusterAssignment.query.filter_by(complaint_id=complaint_id).order_by(ClusterAssignment.created_at.asc()).all()
        
        history = []
        for assn in assignments:
            version = Version.query.get(assn.version_id)
            cluster = Cluster.query.get(assn.cluster_id)
            history.append({
                **assn.to_dict(),
                'version_name': version.name if version else None,
                'cluster_name': cluster.name if cluster else None
            })
        
        operations = OperationLog.query.filter_by(target_type='complaint', target_id=complaint_id).order_by(OperationLog.created_at.asc()).all()
        
        return {
            'complaint': complaint.to_dict(),
            'assignments': history,
            'operations': [op.to_dict() for op in operations]
        }
