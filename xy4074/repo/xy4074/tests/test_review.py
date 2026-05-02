import pytest

from classroom_cluster.models import QuestionCluster, ReviewStatus
from classroom_cluster.review import ReviewManager, ReviewActionType, ReviewSession


class TestReviewManager:
    def create_test_clusters(self):
        return [
            QuestionCluster(
                id="cluster1",
                representative_question="API接口的参数怎么理解？",
                questions=["q1", "q2"],
                confidence=0.85,
            ),
            QuestionCluster(
                id="cluster2",
                representative_question="认证流程具体是怎么执行的？",
                questions=["q3", "q4", "q5"],
                confidence=0.78,
            ),
            QuestionCluster(
                id="cluster3",
                representative_question="API参数应该怎么传？",
                questions=["q6"],
                confidence=0.92,
            ),
        ]
    
    def test_confirm_cluster(self):
        manager = ReviewManager()
        clusters = self.create_test_clusters()
        manager.load_clusters(clusters)
        
        result = manager.confirm_cluster("cluster1", "这个聚类看起来正确")
        
        assert result is True
        cluster = manager.get_cluster("cluster1")
        assert cluster.review_status == ReviewStatus.CONFIRMED
        assert cluster.review_notes == "这个聚类看起来正确"
    
    def test_resolve_cluster(self):
        manager = ReviewManager()
        clusters = self.create_test_clusters()
        manager.load_clusters(clusters)
        
        result = manager.resolve_cluster("cluster2", "已在下次培训中补充讲解")
        
        assert result is True
        cluster = manager.get_cluster("cluster2")
        assert cluster.review_status == ReviewStatus.RESOLVED
    
    def test_discard_cluster(self):
        manager = ReviewManager()
        clusters = self.create_test_clusters()
        manager.load_clusters(clusters)
        
        result = manager.discard_cluster("cluster3", "只有一个问题，不构成聚类")
        
        assert result is True
        cluster = manager.get_cluster("cluster3")
        assert cluster.review_status == ReviewStatus.DISCARDED
    
    def test_merge_clusters(self):
        manager = ReviewManager()
        clusters = self.create_test_clusters()
        manager.load_clusters(clusters)
        
        result = manager.merge_clusters(["cluster1", "cluster3"], "都是关于API参数的问题")
        
        assert result is not None
        assert len(result.questions) == 3
        
        cluster1 = manager.get_cluster("cluster1")
        cluster3 = manager.get_cluster("cluster3")
        
        assert cluster1.review_status == ReviewStatus.MERGED
        assert cluster3.review_status == ReviewStatus.MERGED
    
    def test_add_note(self):
        manager = ReviewManager()
        clusters = self.create_test_clusters()
        manager.load_clusters(clusters)
        
        result = manager.add_note("cluster1", "需要在下次培训中重点讲解")
        
        assert result is True
        cluster = manager.get_cluster("cluster1")
        assert "重点讲解" in cluster.review_notes
    
    def test_get_pending_clusters(self):
        manager = ReviewManager()
        clusters = self.create_test_clusters()
        manager.load_clusters(clusters)
        
        manager.confirm_cluster("cluster1")
        manager.resolve_cluster("cluster2")
        
        pending = manager.get_pending_clusters()
        
        assert len(pending) == 1
        assert pending[0].id == "cluster3"
    
    def test_get_statistics(self):
        manager = ReviewManager()
        clusters = self.create_test_clusters()
        manager.load_clusters(clusters)
        
        manager.confirm_cluster("cluster1")
        manager.resolve_cluster("cluster2")
        
        stats = manager.get_statistics()
        
        assert stats["total_clusters"] == 3
        assert stats["status_counts"]["confirmed"] == 1
        assert stats["status_counts"]["resolved"] == 1
        assert stats["status_counts"]["pending"] == 1


class TestReviewSession:
    def test_session_creation(self):
        session = ReviewSession()
        
        assert session.id is not None
        assert len(session.actions) == 0
    
    def test_to_dict_and_from_dict(self):
        session = ReviewSession()
        
        data = session.to_dict()
        
        assert "id" in data
        assert "created_at" in data
        assert "updated_at" in data
        assert "actions" in data
        
        restored = ReviewSession.from_dict(data)
        
        assert restored.id == session.id
        assert restored.created_at == session.created_at
