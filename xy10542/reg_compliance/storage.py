import json
import uuid
import hashlib
from pathlib import Path
from typing import Dict, List, Optional, Any, Callable
from datetime import datetime
from contextlib import contextmanager

from .models import (
    Article, BusinessItem, Mapping, Responsible, ArticleChange,
    ChangeType, RiskLevel, TaskStatus, RemediationTask,
    ConfirmationHistory, CorrectionHistory
)
from .config import AppConfig


class Storage:
    def __init__(self, config: AppConfig):
        self.config = config
        self.data_dir = config.data_dir
        self._ensure_storage()

    def _ensure_storage(self):
        self.data_dir.mkdir(parents=True, exist_ok=True)

    def _read_json(self, file_name: str) -> Dict[str, Any]:
        file_path = self.data_dir / file_name
        if not file_path.exists():
            return {}
        with open(file_path, "r", encoding="utf-8") as f:
            return json.load(f)

    def _write_json(self, file_name: str, data: Dict[str, Any]):
        file_path = self.data_dir / file_name
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2, default=str)

    def _compute_hash(self, data: Any) -> str:
        return hashlib.sha256(json.dumps(data, sort_keys=True, default=str).encode()).hexdigest()

    def save_articles(self, version: str, articles: List[Article]):
        data = self._read_json("articles.json")
        if version not in data:
            data[version] = {}
        
        for article in articles:
            article_dict = {
                "id": article.id,
                "number": article.number,
                "title": article.title,
                "content": article.content,
                "version": article.version,
                "tags": article.tags
            }
            data[version][article.number] = article_dict
        
        self._write_json("articles.json", data)

    def get_articles(self, version: str) -> Dict[str, Article]:
        data = self._read_json("articles.json")
        if version not in data:
            return {}
        result = {}
        for num, a in data[version].items():
            result[num] = Article(**a)
        return result

    def save_business_items(self, items: List[BusinessItem]):
        data = self._read_json("business.json")
        for item in items:
            data[item.code] = {
                "id": item.id,
                "name": item.name,
                "code": item.code,
                "department": item.department,
                "risk_level": item.risk_level.value,
                "tags": item.tags
            }
        self._write_json("business.json", data)

    def get_business_items(self) -> Dict[str, BusinessItem]:
        data = self._read_json("business.json")
        result = {}
        for code, item in data.items():
            result[code] = BusinessItem(
                id=item["id"],
                name=item["name"],
                code=item["code"],
                department=item["department"],
                risk_level=RiskLevel(item["risk_level"]),
                tags=item["tags"]
            )
        return result

    def save_mappings(self, mappings: List[Mapping]):
        data = self._read_json("mappings.json")
        for m in mappings:
            key = f"{m.article_number}::{m.business_code}"
            if key not in data:
                data[key] = {
                    "article_number": m.article_number,
                    "business_code": m.business_code,
                    "created_at": m.created_at.isoformat()
                }
        self._write_json("mappings.json", data)

    def get_mappings(self) -> List[Mapping]:
        data = self._read_json("mappings.json")
        result = []
        for key, m in data.items():
            result.append(Mapping(
                article_number=m["article_number"],
                business_code=m["business_code"],
                created_at=datetime.fromisoformat(m["created_at"])
            ))
        return result

    def get_mappings_by_article(self, article_number: str) -> List[Mapping]:
        return [m for m in self.get_mappings() if m.article_number == article_number]

    def get_mappings_by_business(self, business_code: str) -> List[Mapping]:
        return [m for m in self.get_mappings() if m.business_code == business_code]

    def save_responsibles(self, responsibles: List[Responsible]):
        data = self._read_json("responsibles.json")
        for r in responsibles:
            data[r.code] = {
                "code": r.code,
                "name": r.name,
                "role": r.role,
                "department": r.department,
                "email": r.email
            }
        self._write_json("responsibles.json", data)

    def get_responsibles(self) -> Dict[str, Responsible]:
        data = self._read_json("responsibles.json")
        result = {}
        for code, r in data.items():
            result[code] = Responsible(**r)
        return result

    def get_responsible_by_business(self, business_code: str) -> Optional[Responsible]:
        responsibles = self.get_responsibles()
        businesses = self.get_business_items()
        
        if business_code not in businesses:
            return None
        
        business = businesses[business_code]
        for code, r in responsibles.items():
            if r.department == business.department:
                return r
        return None

    def save_article_changes(self, old_version: str, new_version: str, changes: List[ArticleChange]):
        data = self._read_json("changes.json")
        key = f"{old_version}::{new_version}"
        data[key] = []
        for change in changes:
            change_dict = {
                "old_article": self._article_to_dict(change.old_article),
                "new_article": self._article_to_dict(change.new_article),
                "change_type": change.change_type.value,
                "similarity": change.similarity,
                "matched_articles": change.matched_articles
            }
            data[key].append(change_dict)
        self._write_json("changes.json", data)

    def get_article_changes(self, old_version: str, new_version: str) -> Optional[List[ArticleChange]]:
        data = self._read_json("changes.json")
        key = f"{old_version}::{new_version}"
        if key not in data:
            return None
        
        changes = []
        for c in data[key]:
            changes.append(ArticleChange(
                old_article=self._dict_to_article(c["old_article"]),
                new_article=self._dict_to_article(c["new_article"]),
                change_type=ChangeType(c["change_type"]),
                similarity=c["similarity"],
                matched_articles=c.get("matched_articles", [])
            ))
        return changes

    def _article_to_dict(self, article: Optional[Article]) -> Optional[dict]:
        if article is None:
            return None
        return {
            "id": article.id,
            "number": article.number,
            "title": article.title,
            "content": article.content,
            "version": article.version,
            "tags": article.tags
        }

    def _dict_to_article(self, data: Optional[dict]) -> Optional[Article]:
        if data is None:
            return None
        return Article(**data)

    def save_task(self, task: RemediationTask) -> bool:
        data = self._read_json("tasks.json")
        task_key = f"{task.business_code}::{task.article_number}"
        
        if task_key in data:
            existing = data[task_key]
            existing_hash = self._compute_hash({
                "status": existing.get("status"),
                "responsible_code": existing.get("responsible_code"),
                "deadline": existing.get("deadline")
            })
            new_hash = self._compute_hash({
                "status": task.status.value,
                "responsible_code": task.responsible_code,
                "deadline": task.deadline.isoformat() if task.deadline else None
            })
            
            if existing_hash == new_hash:
                return False
            
        task_dict = {
            "id": task.id,
            "business_code": task.business_code,
            "business_name": task.business_name,
            "article_number": task.article_number,
            "responsible_code": task.responsible_code,
            "responsible_name": task.responsible_name,
            "deadline": task.deadline.isoformat() if task.deadline else None,
            "status": task.status.value,
            "created_at": task.created_at.isoformat(),
            "closed_at": task.closed_at.isoformat() if task.closed_at else None,
            "notes": task.notes
        }
        data[task_key] = task_dict
        self._write_json("tasks.json", data)
        return True

    def get_tasks(self) -> Dict[str, RemediationTask]:
        data = self._read_json("tasks.json")
        result = {}
        for key, t in data.items():
            result[key] = RemediationTask(
                id=t["id"],
                business_code=t["business_code"],
                business_name=t["business_name"],
                article_number=t["article_number"],
                responsible_code=t["responsible_code"],
                responsible_name=t["responsible_name"],
                deadline=datetime.fromisoformat(t["deadline"]) if t["deadline"] else None,
                status=TaskStatus(t["status"]),
                created_at=datetime.fromisoformat(t["created_at"]),
                closed_at=datetime.fromisoformat(t["closed_at"]) if t["closed_at"] else None,
                notes=t.get("notes", "")
            )
        return result

    def get_task(self, business_code: str, article_number: str) -> Optional[RemediationTask]:
        tasks = self.get_tasks()
        key = f"{business_code}::{article_number}"
        return tasks.get(key)

    def save_confirmation(self, conf: ConfirmationHistory):
        data = self._read_json("confirmations.json")
        list_key = f"{conf.article_number}::{conf.business_code}"
        if list_key not in data:
            data[list_key] = []
        data[list_key].append({
            "id": conf.id,
            "article_number": conf.article_number,
            "business_code": conf.business_code,
            "operator": conf.operator,
            "action": conf.action,
            "timestamp": conf.timestamp.isoformat(),
            "before_state": conf.before_state,
            "after_state": conf.after_state,
            "comment": conf.comment
        })
        self._write_json("confirmations.json", data)

    def get_confirmations(self, article_number: str, business_code: str) -> List[ConfirmationHistory]:
        data = self._read_json("confirmations.json")
        list_key = f"{article_number}::{business_code}"
        if list_key not in data:
            return []
        
        result = []
        for c in data[list_key]:
            result.append(ConfirmationHistory(
                id=c["id"],
                article_number=c["article_number"],
                business_code=c["business_code"],
                operator=c["operator"],
                action=c["action"],
                timestamp=datetime.fromisoformat(c["timestamp"]),
                before_state=c["before_state"],
                after_state=c["after_state"],
                comment=c.get("comment", "")
            ))
        return result

    def save_correction(self, correction: CorrectionHistory):
        data = self._read_json("corrections.json")
        if "list" not in data:
            data["list"] = []
        data["list"].append({
            "id": correction.id,
            "entity_type": correction.entity_type,
            "entity_id": correction.entity_id,
            "operator": correction.operator,
            "before_value": correction.before_value,
            "after_value": correction.after_value,
            "timestamp": correction.timestamp.isoformat(),
            "comment": correction.comment
        })
        self._write_json("corrections.json", data)

    def get_corrections(self) -> List[CorrectionHistory]:
        data = self._read_json("corrections.json")
        if "list" not in data:
            return []
        result = []
        for c in data["list"]:
            result.append(CorrectionHistory(
                id=c["id"],
                entity_type=c["entity_type"],
                entity_id=c["entity_id"],
                operator=c["operator"],
                before_value=c["before_value"],
                after_value=c["after_value"],
                timestamp=datetime.fromisoformat(c["timestamp"]),
                comment=c.get("comment", "")
            ))
        return result

    def save_check_result(self, check_id: str, result: dict):
        data = self._read_json("check_history.json")
        if "checks" not in data:
            data["checks"] = {}
        data["checks"][check_id] = {
            "id": check_id,
            "timestamp": datetime.now().isoformat(),
            "result": result
        }
        self._write_json("check_history.json", data)

    def get_check_history(self) -> Dict[str, dict]:
        data = self._read_json("check_history.json")
        return data.get("checks", {})

    def get_state(self) -> dict:
        return {
            "articles_versions": list(self._read_json("articles.json").keys()),
            "business_count": len(self._read_json("business.json")),
            "mappings_count": len(self._read_json("mappings.json")),
            "responsibles_count": len(self._read_json("responsibles.json")),
            "tasks_count": len(self._read_json("tasks.json")),
            "checks_count": len(self.get_check_history())
        }
