import uuid
import difflib
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple, Set
from dataclasses import dataclass

from .models import (
    Article, ArticleChange, BusinessImpact, RemediationTask,
    ChangeType, RiskLevel, TaskStatus, Mapping, BusinessItem,
    Responsible, ConfirmationHistory, CorrectionHistory
)
from .storage import Storage


class ArticleComparator:
    @staticmethod
    def compute_similarity(article1: Article, article2: Article) -> float:
        content1 = f"{article1.title} {article1.content}"
        content2 = f"{article2.title} {article2.content}"
        return difflib.SequenceMatcher(None, content1, content2).ratio()

    @staticmethod
    def compare_versions(old_articles: Dict[str, Article], new_articles: Dict[str, Article]) -> List[ArticleChange]:
        changes: List[ArticleChange] = []
        
        old_numbers = set(old_articles.keys())
        new_numbers = set(new_articles.keys())
        
        # Handle directly matched by number
        for num in old_numbers & new_numbers:
            old = old_articles[num]
            new = new_articles[num]
            similarity = ArticleComparator.compute_similarity(old, new)
            
            if similarity == 1.0:
                changes.append(ArticleChange(
                    old_article=old,
                    new_article=new,
                    change_type=ChangeType.UNCHANGED,
                    similarity=1.0
                ))
            else:
                changes.append(ArticleChange(
                    old_article=old,
                    new_article=new,
                    change_type=ChangeType.MODIFIED,
                    similarity=similarity
                ))
        
        # Handle removed articles
        for num in old_numbers - new_numbers:
            old = old_articles[num]
            matched = []
            
            # Search for similar content in new articles
            for new_num, new in new_articles.items():
                if new_num not in old_numbers:
                    similarity = ArticleComparator.compute_similarity(old, new)
                    if similarity > 0.7:
                        matched.append((new_num, similarity))
            
            if matched:
                # Sort by similarity descending
                matched.sort(key=lambda x: x[1], reverse=True)
                best_num, best_sim = matched[0]
                new = new_articles[best_num]
                
                changes.append(ArticleChange(
                    old_article=old,
                    new_article=new,
                    change_type=ChangeType.RENUMBERED,
                    similarity=best_sim,
                    matched_articles=[m[0] for m in matched]
                ))
            else:
                changes.append(ArticleChange(
                    old_article=old,
                    new_article=None,
                    change_type=ChangeType.REMOVED,
                    similarity=0.0
                ))
        
        # Handle added articles
        for num in new_numbers - old_numbers:
            new = new_articles[num]
            matched = []
            
            for old_num, old in old_articles.items():
                if old_num not in new_numbers:
                    similarity = ArticleComparator.compute_similarity(old, new)
                    if similarity > 0.7:
                        matched.append((old_num, similarity))
            
            if not matched:
                changes.append(ArticleChange(
                    old_article=None,
                    new_article=new,
                    change_type=ChangeType.ADDED,
                    similarity=0.0
                ))
        
        return changes


class ImpactAnalyzer:
    def __init__(self, storage: Storage):
        self.storage = storage

    def analyze_impact(self, changes: List[ArticleChange], old_version: str, new_version: str) -> Tuple[List[BusinessImpact], List[RemediationTask]]:
        mappings = self.storage.get_mappings()
        business_items = self.storage.get_business_items()
        
        # Group mappings by article
        article_to_business: Dict[str, List[Mapping]] = {}
        for m in mappings:
            if m.article_number not in article_to_business:
                article_to_business[m.article_number] = []
            article_to_business[m.article_number].append(m)
        
        impacts: List[BusinessImpact] = []
        tasks: List[RemediationTask] = []
        
        for change in changes:
            if change.change_type == ChangeType.UNCHANGED:
                continue
            
            affected_article_nums: Set[str] = set()
            
            if change.old_article:
                affected_article_nums.add(change.old_article.number)
            if change.new_article:
                affected_article_nums.add(change.new_article.number)
            if change.matched_articles:
                affected_article_nums.update(change.matched_articles)
            
            # Collect all affected businesses
            affected_businesses: Dict[str, List[str]] = {}
            for art_num in affected_article_nums:
                if art_num in article_to_business:
                    for m in article_to_business[art_num]:
                        if m.business_code not in affected_businesses:
                            affected_businesses[m.business_code] = []
                        if art_num not in affected_businesses[m.business_code]:
                            affected_businesses[m.business_code].append(art_num)
            
            # Create impacts and tasks
            for business_code, articles in affected_businesses.items():
                if business_code not in business_items:
                    continue
                
                business = business_items[business_code]
                risk = self._calculate_risk(change, business)
                
                impact = BusinessImpact(
                    business_code=business_code,
                    business_name=business.name,
                    department=business.department,
                    affected_articles=articles,
                    risk_level=risk,
                    description=self._generate_description(change, business)
                )
                impacts.append(impact)
                
                # Create remediation task
                responsible = self.storage.get_responsible_by_business(business_code)
                task = RemediationTask(
                    id=str(uuid.uuid4()),
                    business_code=business_code,
                    business_name=business.name,
                    article_number=change.new_article.number if change.new_article else change.old_article.number,
                    responsible_code=responsible.code if responsible else None,
                    responsible_name=responsible.name if responsible else None,
                    deadline=datetime.now() + timedelta(days=30),
                    status=TaskStatus.PENDING,
                    notes=f"自动创建整改任务 - {change.change_type.value}"
                )
                tasks.append(task)
        
        return impacts, tasks

    def _calculate_risk(self, change: ArticleChange, business: BusinessItem) -> RiskLevel:
        if change.change_type in [ChangeType.ADDED, ChangeType.REMOVED]:
            return RiskLevel.HIGH
        elif change.change_type == ChangeType.MODIFIED:
            if change.similarity < 0.5:
                return RiskLevel.HIGH
            elif change.similarity < 0.8:
                return RiskLevel.MEDIUM
            else:
                return RiskLevel.LOW
        elif change.change_type == ChangeType.RENUMBERED:
            return RiskLevel.MEDIUM
        return RiskLevel.LOW

    def _generate_description(self, change: ArticleChange, business: BusinessItem) -> str:
        descriptions = {
            ChangeType.ADDED: f"新增条款可能影响业务: {business.name}",
            ChangeType.REMOVED: f"条款删除，需确认对业务 {business.name} 的影响",
            ChangeType.MODIFIED: f"条款内容变更，需评估对 {business.name} 的影响 (相似度: {change.similarity:.2f})",
            ChangeType.RENUMBERED: f"条款编号变更，需确认 {business.name} 的对应关系",
            ChangeType.UNCHANGED: f"条款无变化"
        }
        return descriptions.get(change.change_type, "未知变更类型")


class TaskManager:
    def __init__(self, storage: Storage):
        self.storage = storage

    def update_task_status(self, business_code: str, article_number: str, new_status: TaskStatus, operator: str, comment: str = "") -> bool:
        task = self.storage.get_task(business_code, article_number)
        if not task:
            return False
        
        before_state = {
            "status": task.status.value,
            "responsible": task.responsible_name,
            "deadline": task.deadline.isoformat() if task.deadline else None
        }
        
        if new_status == TaskStatus.COMPLETED:
            task.closed_at = datetime.now()
        task.status = new_status
        
        was_changed = self.storage.save_task(task)
        
        if was_changed or new_status != TaskStatus(task.status):
            after_state = {
                "status": new_status.value,
                "responsible": task.responsible_name,
                "deadline": task.deadline.isoformat() if task.deadline else None
            }
            
            confirmation = ConfirmationHistory(
                id=str(uuid.uuid4()),
                article_number=article_number,
                business_code=business_code,
                operator=operator,
                action=f"状态变更: {task.status.value} -> {new_status.value}",
                timestamp=datetime.now(),
                before_state=before_state,
                after_state=after_state,
                comment=comment
            )
            self.storage.save_confirmation(confirmation)
        
        return was_changed

    def assign_responsible(self, business_code: str, article_number: str, responsible_code: str, operator: str, comment: str = "") -> bool:
        task = self.storage.get_task(business_code, article_number)
        if not task:
            return False
        
        responsibles = self.storage.get_responsibles()
        if responsible_code not in responsibles:
            return False
        
        before_state = {
            "status": task.status.value,
            "responsible": task.responsible_name,
            "deadline": task.deadline.isoformat() if task.deadline else None
        }
        
        responsible = responsibles[responsible_code]
        task.responsible_code = responsible_code
        task.responsible_name = responsible.name
        
        was_changed = self.storage.save_task(task)
        
        if was_changed:
            after_state = {
                "status": task.status.value,
                "responsible": responsible.name,
                "deadline": task.deadline.isoformat() if task.deadline else None
            }
            
            confirmation = ConfirmationHistory(
                id=str(uuid.uuid4()),
                article_number=article_number,
                business_code=business_code,
                operator=operator,
                action="责任人变更",
                timestamp=datetime.now(),
                before_state=before_state,
                after_state=after_state,
                comment=comment
            )
            self.storage.save_confirmation(confirmation)
        
        return was_changed

    def update_deadline(self, business_code: str, article_number: str, new_deadline: datetime, operator: str, comment: str = "") -> bool:
        task = self.storage.get_task(business_code, article_number)
        if not task:
            return False
        
        before_state = {
            "status": task.status.value,
            "responsible": task.responsible_name,
            "deadline": task.deadline.isoformat() if task.deadline else None
        }
        
        task.deadline = new_deadline
        
        was_changed = self.storage.save_task(task)
        
        if was_changed:
            after_state = {
                "status": task.status.value,
                "responsible": task.responsible_name,
                "deadline": new_deadline.isoformat()
            }
            
            confirmation = ConfirmationHistory(
                id=str(uuid.uuid4()),
                article_number=article_number,
                business_code=business_code,
                operator=operator,
                action="整改期限变更",
                timestamp=datetime.now(),
                before_state=before_state,
                after_state=after_state,
                comment=comment
            )
            self.storage.save_confirmation(confirmation)
        
        return was_changed

    def check_overdue_tasks(self) -> List[RemediationTask]:
        now = datetime.now()
        tasks = self.storage.get_tasks()
        overdue = []
        
        for task in tasks.values():
            if (task.status in [TaskStatus.PENDING, TaskStatus.IN_PROGRESS] 
                and task.deadline 
                and task.deadline < now):
                if task.status != TaskStatus.OVERDUE:
                    self.update_task_status(
                        task.business_code,
                        task.article_number,
                        TaskStatus.OVERDUE,
                        "system",
                        "系统自动标记为逾期"
                    )
                overdue.append(task)
        
        return overdue

    def confirm_impact(self, business_code: str, article_number: str, operator: str, comment: str = "") -> bool:
        task = self.storage.get_task(business_code, article_number)
        if not task:
            return False
        
        # Check for duplicate confirmation within 24 hours
        confirmations = self.storage.get_confirmations(article_number, business_code)
        if confirmations:
            last_conf = confirmations[-1]
            if (datetime.now() - last_conf.timestamp) < timedelta(hours=24):
                return False
        
        before_state = {"confirmed": False}
        after_state = {"confirmed": True}
        
        confirmation = ConfirmationHistory(
            id=str(uuid.uuid4()),
            article_number=article_number,
            business_code=business_code,
            operator=operator,
            action="影响确认",
            timestamp=datetime.now(),
            before_state=before_state,
            after_state=after_state,
            comment=comment
        )
        self.storage.save_confirmation(confirmation)
        
        if task.status == TaskStatus.PENDING:
            self.update_task_status(
                business_code,
                article_number,
                TaskStatus.IN_PROGRESS,
                operator,
                "已确认影响，开始整改"
            )
        
        return True


class CorrectionManager:
    def __init__(self, storage: Storage):
        self.storage = storage

    def correct_article_mapping(self, old_article_num: str, new_article_num: str, operator: str, comment: str = "") -> bool:
        mappings = self.storage.get_mappings()
        old_mappings = [m for m in mappings if m.article_number == old_article_num]
        
        if not old_mappings:
            return False
        
        new_mappings = []
        for m in old_mappings:
            new_mappings.append(Mapping(
                article_number=new_article_num,
                business_code=m.business_code
            ))
        
        self.storage.save_mappings(new_mappings)
        
        correction = CorrectionHistory(
            id=str(uuid.uuid4()),
            entity_type="mapping",
            entity_id=f"{old_article_num}->{new_article_num}",
            operator=operator,
            before_value={"article_number": old_article_num, "business_codes": [m.business_code for m in old_mappings]},
            after_value={"article_number": new_article_num, "business_codes": [m.business_code for m in new_mappings]},
            timestamp=datetime.now(),
            comment=comment
        )
        self.storage.save_correction(correction)
        
        return True

    def update_task_manually(self, business_code: str, article_number: str, updates: dict, operator: str, comment: str = "") -> bool:
        task = self.storage.get_task(business_code, article_number)
        if not task:
            return False
        
        before_value = {
            "status": task.status.value,
            "responsible": task.responsible_name,
            "deadline": task.deadline.isoformat() if task.deadline else None,
            "notes": task.notes
        }
        
        if "status" in updates:
            task.status = TaskStatus(updates["status"])
        if "responsible_code" in updates:
            responsibles = self.storage.get_responsibles()
            if updates["responsible_code"] in responsibles:
                task.responsible_code = updates["responsible_code"]
                task.responsible_name = responsibles[updates["responsible_code"]].name
        if "deadline" in updates:
            task.deadline = updates["deadline"]
        if "notes" in updates:
            task.notes = updates["notes"]
        
        was_changed = self.storage.save_task(task)
        
        if was_changed:
            after_value = {
                "status": task.status.value,
                "responsible": task.responsible_name,
                "deadline": task.deadline.isoformat() if task.deadline else None,
                "notes": task.notes
            }
            
            correction = CorrectionHistory(
                id=str(uuid.uuid4()),
                entity_type="task",
                entity_id=f"{business_code}::{article_number}",
                operator=operator,
                before_value=before_value,
                after_value=after_value,
                timestamp=datetime.now(),
                comment=comment
            )
            self.storage.save_correction(correction)
        
        return was_changed
