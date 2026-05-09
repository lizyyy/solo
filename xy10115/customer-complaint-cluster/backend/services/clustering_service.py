import re
from collections import defaultdict
from datetime import datetime
from flask import current_app
from backend.models.models import (
    db, Complaint, Cluster, ClusterAssignment, 
    Version, OperationLog, Rule
)


class ClusteringService:
    _embedding_model = None
    
    @classmethod
    def _get_embedding_model(cls):
        if cls._embedding_model is None:
            try:
                from sentence_transformers import SentenceTransformer
                model_name = current_app.config.get('DEFAULT_CLUSTER_MODEL', 'all-MiniLM-L6-v2')
                cls._embedding_model = SentenceTransformer(model_name)
            except Exception as e:
                print(f"Warning: Failed to load embedding model: {e}")
                cls._embedding_model = None
        return cls._embedding_model
    
    @staticmethod
    def apply_rules(text, rules):
        active_rules = sorted(
            [r for r in rules if r.is_active],
            key=lambda r: r.priority,
            reverse=True
        )
        
        for rule in active_rules:
            matched = False
            if rule.pattern_type == 'keyword':
                keywords = [k.strip() for k in rule.pattern.split(',')]
                if any(keyword.lower() in text.lower() for keyword in keywords):
                    matched = True
            elif rule.pattern_type == 'regex':
                try:
                    if re.search(rule.pattern, text, re.IGNORECASE):
                        matched = True
                except re.error:
                    continue
            
            if matched:
                return {
                    'matched': True,
                    'rule': rule.to_dict(),
                    'cluster_name': rule.cluster_name or rule.name,
                    'reason': f'匹配规则: {rule.name} (优先级: {rule.priority})'
                }
        
        return {'matched': False}
    
    @staticmethod
    def vector_clustering(texts, min_cluster_size=2):
        from sklearn.cluster import KMeans, DBSCAN
        import numpy as np
        
        model = ClusteringService._get_embedding_model()
        
        if model is None:
            return None
        
        try:
            embeddings = model.encode(texts, show_progress_bar=False)
            
            n_clusters = min(max(2, len(texts) // 10), len(texts) // 2)
            n_clusters = max(1, n_clusters)
            
            if n_clusters > 1:
                kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
                labels = kmeans.fit_predict(embeddings)
            else:
                labels = [0] * len(texts)
            
            return labels, embeddings
        except Exception as e:
            print(f"Vector clustering error: {e}")
            return None
    
    @staticmethod
    def run_clustering(version_name=None, description=None):
        from datetime import datetime
        
        current_version = Version.query.filter_by(is_current=True).first()
        
        all_complaints = Complaint.query.all()
        if not all_complaints:
            raise ValueError('No complaints available for clustering')
        
        rules = Rule.query.all()
        
        new_version = Version(
            name=version_name or f'聚类分析-{datetime.now().strftime("%Y%m%d%H%M%S")}',
            description=description or f'自动聚类分析，共 {len(all_complaints)} 条投诉',
            type='clustering',
            parent_version_id=current_version.id if current_version else None,
            is_current=True
        )
        db.session.add(new_version)
        db.session.flush()
        
        if current_version:
            current_version.is_current = False
        
        rule_matches = defaultdict(list)
        unclassified = []
        
        for complaint in all_complaints:
            result = ClusteringService.apply_rules(complaint.text, rules)
            if result['matched']:
                cluster_name = result['cluster_name']
                rule_matches[cluster_name].append({
                    'complaint': complaint,
                    'reason': result['reason'],
                    'rule': result['rule']
                })
            else:
                unclassified.append(complaint)
        
        created_clusters = {}
        
        for cluster_name, items in rule_matches.items():
            cluster = Cluster(
                name=cluster_name,
                description=f'规则匹配聚类: {cluster_name}',
                version_id=new_version.id,
                is_manual=False,
                keywords=', '.join([item['rule']['pattern'] for item in items[:5]] if items else [])
            )
            db.session.add(cluster)
            db.session.flush()
            created_clusters[cluster_name] = cluster
            
            for item in items:
                complaint = item['complaint']
                old_cluster_id = complaint.current_cluster_id
                
                assignment = ClusterAssignment(
                    complaint_id=complaint.id,
                    cluster_id=cluster.id,
                    version_id=new_version.id,
                    confidence=1.0,
                    reason=item['reason'],
                    is_manual=False
                )
                db.session.add(assignment)
                
                complaint.current_cluster_id = cluster.id
                
                op_log = OperationLog(
                    version_id=new_version.id,
                    operation_type='rule_assign',
                    target_type='complaint',
                    target_id=complaint.id,
                    old_value=str(old_cluster_id) if old_cluster_id else None,
                    new_value=str(cluster.id),
                    reason=item['reason']
                )
                db.session.add(op_log)
        
        if unclassified:
            texts = [c.text for c in unclassified]
            clustering_result = ClusteringService.vector_clustering(texts)
            
            if clustering_result:
                labels, embeddings = clustering_result
                
                vector_clusters = defaultdict(list)
                for idx, complaint in enumerate(unclassified):
                    cluster_label = labels[idx]
                    vector_clusters[cluster_label].append(complaint)
                
                for label, complaints in vector_clusters.items():
                    if len(complaints) < current_app.config.get('MIN_CLUSTER_SIZE', 2):
                        continue
                    
                    keywords = ClusteringService._extract_keywords([c.text for c in complaints])
                    
                    cluster = Cluster(
                        name=f'聚类组{label + 1}',
                        description=f'向量聚类结果，共 {len(complaints)} 条投诉',
                        version_id=new_version.id,
                        is_manual=False,
                        keywords=', '.join(keywords[:5])
                    )
                    db.session.add(cluster)
                    db.session.flush()
                    
                    for complaint in complaints:
                        old_cluster_id = complaint.current_cluster_id
                        
                        assignment = ClusterAssignment(
                            complaint_id=complaint.id,
                            cluster_id=cluster.id,
                            version_id=new_version.id,
                            confidence=0.7,
                            reason=f'向量相似度聚类，关键词: {", ".join(keywords[:3])}',
                            is_manual=False
                        )
                        db.session.add(assignment)
                        
                        complaint.current_cluster_id = cluster.id
                        
                        op_log = OperationLog(
                            version_id=new_version.id,
                            operation_type='vector_assign',
                            target_type='complaint',
                            target_id=complaint.id,
                            old_value=str(old_cluster_id) if old_cluster_id else None,
                            new_value=str(cluster.id),
                            reason=f'向量相似度聚类'
                        )
                        db.session.add(op_log)
            else:
                for complaint in unclassified:
                    old_cluster_id = complaint.current_cluster_id
                    complaint.current_cluster_id = None
                    
                    if old_cluster_id:
                        op_log = OperationLog(
                            version_id=new_version.id,
                            operation_type='unassign',
                            target_type='complaint',
                            target_id=complaint.id,
                            old_value=str(old_cluster_id),
                            new_value=None,
                            reason='未匹配任何规则且无法进行向量聚类'
                        )
                        db.session.add(op_log)
        
        db.session.commit()
        
        return {
            'version_id': new_version.id,
            'version_name': new_version.name,
            'rule_clusters': len(rule_matches),
            'vector_clusters': len([c for c in Cluster.query.filter_by(version_id=new_version.id).all() if c.keywords and not c.is_manual]),
            'total_complaints': len(all_complaints),
            'rule_matched': sum(len(items) for items in rule_matches.values()),
            'unclassified': len(unclassified)
        }
    
    @staticmethod
    def _extract_keywords(texts):
        from collections import Counter
        import jieba
        
        all_words = []
        for text in texts:
            words = list(jieba.cut(text))
            words = [w for w in words if len(w) > 1 and w.strip()]
            all_words.extend(words)
        
        counter = Counter(all_words)
        return [word for word, count in counter.most_common(20)]
    
    @staticmethod
    def get_clusters(version_id=None):
        query = Cluster.query
        if version_id:
            query = query.filter_by(version_id=version_id)
        
        clusters = query.order_by(Cluster.id.desc()).all()
        
        result = []
        for cluster in clusters:
            count = Complaint.query.filter_by(current_cluster_id=cluster.id).count()
            result.append({
                **cluster.to_dict(),
                'complaint_count': count
            })
        
        return result
    
    @staticmethod
    def get_cluster(cluster_id):
        cluster = Cluster.query.get(cluster_id)
        if not cluster:
            return None
        
        complaints = Complaint.query.filter_by(current_cluster_id=cluster.id).all()
        assignments = ClusterAssignment.query.filter_by(cluster_id=cluster_id).all()
        
        return {
            **cluster.to_dict(),
            'complaints': [c.to_dict() for c in complaints],
            'assignments': [a.to_dict() for a in assignments]
        }
