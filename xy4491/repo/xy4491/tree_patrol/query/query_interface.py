from datetime import datetime
from typing import List, Optional, Dict, Any
from collections import defaultdict

from tree_patrol.models import (
    TreeStatus,
    TreeRecord,
    PatrolRecord,
    WeatherAlert,
    PruningOrder,
    Complaint,
    TreeAssessment,
    ReviewRecord
)
from tree_patrol.core import DataLoader, AssessmentEngine
from tree_patrol.database import DatabaseManager


class QueryInterface:
    def __init__(
        self,
        data_loader: DataLoader = None,
        assessment_engine: AssessmentEngine = None,
        db_manager: DatabaseManager = None
    ):
        self.data_loader = data_loader or DataLoader()
        self.assessment_engine = assessment_engine or AssessmentEngine()
        self.db_manager = db_manager or DatabaseManager()
        
        self._cached_data = None
        self._cached_assessments = None

    def _load_data(self) -> Dict[str, Any]:
        if self._cached_data is None:
            self._cached_data = self.data_loader.load_all_data()
        return self._cached_data

    def _get_assessments(self, assessment_date: datetime = None) -> List[TreeAssessment]:
        if self._cached_assessments is None:
            data = self._load_data()
            self._cached_assessments = self.assessment_engine.assess_all_trees(
                trees=data['trees'],
                patrols=data['patrols'],
                alerts=data['alerts'],
                pruning_orders=data['pruning_orders'],
                complaints=data['complaints'],
                assessment_date=assessment_date
            )
        return self._cached_assessments

    def get_tree_by_id(self, tree_id: str) -> Optional[TreeRecord]:
        data = self._load_data()
        for tree in data['trees']:
            if tree.id == tree_id:
                return tree
        return None

    def get_assessment_by_tree_id(
        self, 
        tree_id: str, 
        assessment_date: datetime = None
    ) -> Optional[TreeAssessment]:
        assessments = self._get_assessments(assessment_date)
        for assessment in assessments:
            if assessment.tree_id == tree_id:
                return assessment
        return None

    def get_all_assessments(self, assessment_date: datetime = None) -> List[TreeAssessment]:
        return self._get_assessments(assessment_date)

    def get_assessments_by_status(
        self, 
        status: TreeStatus, 
        assessment_date: datetime = None
    ) -> List[TreeAssessment]:
        assessments = self._get_assessments(assessment_date)
        return [a for a in assessments if a.status == status]

    def get_trees_with_high_risk(self, assessment_date: datetime = None) -> List[Dict[str, Any]]:
        data = self._load_data()
        assessments = self._get_assessments(assessment_date)
        
        high_risk_statuses = [TreeStatus.CLOSED, TreeStatus.NEEDS_REINFORCEMENT]
        high_risk_trees = []
        
        for assessment in assessments:
            if assessment.status in high_risk_statuses:
                tree = self.get_tree_by_id(assessment.tree_id)
                if tree:
                    high_risk_trees.append({
                        'tree': tree,
                        'assessment': assessment
                    })
        
        return high_risk_trees

    def get_patrols_by_tree_id(self, tree_id: str) -> List[PatrolRecord]:
        data = self._load_data()
        return [p for p in data['patrols'] if p.tree_id == tree_id]

    def get_complaints_by_tree_id(self, tree_id: str) -> List[Complaint]:
        data = self._load_data()
        return [c for c in data['complaints'] if c.tree_id == tree_id]

    def get_pruning_orders_by_tree_id(self, tree_id: str) -> List[PruningOrder]:
        data = self._load_data()
        return [po for po in data['pruning_orders'] if po.tree_id == tree_id]

    def get_alerts_by_location(self, location: str) -> List[WeatherAlert]:
        data = self._load_data()
        return [a for a in data['alerts'] if location in a.affected_areas]

    def get_review_history(self, tree_id: str) -> List[ReviewRecord]:
        return self.db_manager.get_reviews_by_tree_id(tree_id)

    def get_daily_summary(self, assessment_date: datetime = None) -> Dict[str, Any]:
        assessments = self._get_assessments(assessment_date)
        summary = self.assessment_engine.get_assessment_summary(assessments)
        
        review_stats = self.db_manager.get_review_statistics()
        
        return {
            'assessment_summary': summary,
            'review_statistics': review_stats,
            'generated_at': datetime.now().isoformat()
        }

    def get_tree_detail(self, tree_id: str, assessment_date: datetime = None) -> Optional[Dict[str, Any]]:
        tree = self.get_tree_by_id(tree_id)
        if not tree:
            return None
        
        assessment = self.get_assessment_by_tree_id(tree_id, assessment_date)
        patrols = self.get_patrols_by_tree_id(tree_id)
        complaints = self.get_complaints_by_tree_id(tree_id)
        pruning_orders = self.get_pruning_orders_by_tree_id(tree_id)
        alerts = self.get_alerts_by_location(tree.location)
        review_history = self.get_review_history(tree_id)
        
        return {
            'tree': tree,
            'assessment': assessment,
            'patrols': patrols,
            'complaints': complaints,
            'pruning_orders': pruning_orders,
            'alerts': alerts,
            'review_history': review_history
        }

    def search_trees(
        self,
        keyword: str = None,
        status: TreeStatus = None,
        location: str = None,
        assessment_date: datetime = None
    ) -> List[Dict[str, Any]]:
        data = self._load_data()
        assessments = self._get_assessments(assessment_date)
        
        results = []
        
        for tree in data['trees']:
            match = True
            
            if keyword:
                keyword_lower = keyword.lower()
                if not (
                    keyword_lower in tree.id.lower() or
                    keyword_lower in tree.name.lower() or
                    keyword_lower in tree.species.lower() or
                    keyword_lower in tree.location.lower()
                ):
                    match = False
            
            if location:
                if location.lower() not in tree.location.lower():
                    match = False
            
            if match:
                assessment = None
                for a in assessments:
                    if a.tree_id == tree.id:
                        assessment = a
                        break
                
                if status and assessment:
                    if assessment.status != status:
                        match = False
                
                if match:
                    results.append({
                        'tree': tree,
                        'assessment': assessment
                    })
        
        return results

    def clear_cache(self):
        self._cached_data = None
        self._cached_assessments = None
