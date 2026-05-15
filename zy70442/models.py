import json
import uuid
from datetime import datetime
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any
from enum import Enum


class Status(Enum):
    PENDING = "pending"
    SUCCESS = "success"
    FAILED = "failed"
    PARTIAL = "partial"
    NEEDS_REVIEW = "needs_review"


class CompActionStatus(Enum):
    NOT_EXECUTED = "not_executed"
    EXECUTED = "executed"
    SKIPPED = "skipped"


@dataclass
class ManualNote:
    id: str
    author: str
    content: str
    created_at: str
    original_value: Optional[Dict[str, Any]] = None


@dataclass
class EvidenceField:
    key: str
    value: Any
    original_source: str
    trace_id: str


@dataclass
class FailureItem:
    id: str
    item_id: str
    item_type: str
    reason: str
    details: Dict[str, Any]
    created_at: str
    assignee: Optional[str] = None


@dataclass
class ModelReview:
    id: str
    snippet_id: str
    snippet_content: str
    model_name: str
    model_result: Dict[str, Any]
    human_confirmed: bool = False
    confirmer: Optional[str] = None
    confirmed_at: Optional[str] = None
    confirmation_notes: Optional[str] = None


@dataclass
class ReleaseItem:
    id: str
    file_summary: str
    file_path: str
    status: Status
    comp_action_status: CompActionStatus
    evidence_fields: List[EvidenceField]
    failure_reason: Optional[str] = None
    model_review: Optional[ModelReview] = None
    manual_notes: List[ManualNote] = field(default_factory=list)


@dataclass
class ReleaseRecord:
    id: str
    version: str
    release_date: str
    description: str
    items: List[ReleaseItem]
    overall_status: Status
    created_at: str
    updated_at: str
    failure_items: List[FailureItem] = field(default_factory=list)
    material_summary: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "version": self.version,
            "release_date": self.release_date,
            "description": self.description,
            "items": [
                {
                    "id": item.id,
                    "file_summary": item.file_summary,
                    "file_path": item.file_path,
                    "status": item.status.value,
                    "comp_action_status": item.comp_action_status.value,
                    "evidence_fields": [
                        {
                            "key": ef.key,
                            "value": ef.value,
                            "original_source": ef.original_source,
                            "trace_id": ef.trace_id
                        }
                        for ef in item.evidence_fields
                    ],
                    "failure_reason": item.failure_reason,
                    "model_review": {
                        "id": item.model_review.id,
                        "snippet_id": item.model_review.snippet_id,
                        "snippet_content": item.model_review.snippet_content,
                        "model_name": item.model_review.model_name,
                        "model_result": item.model_review.model_result,
                        "human_confirmed": item.model_review.human_confirmed,
                        "confirmer": item.model_review.confirmer,
                        "confirmed_at": item.model_review.confirmed_at,
                        "confirmation_notes": item.model_review.confirmation_notes
                    } if item.model_review else None,
                    "manual_notes": [
                        {
                            "id": mn.id,
                            "author": mn.author,
                            "content": mn.content,
                            "created_at": mn.created_at,
                            "original_value": mn.original_value
                        }
                        for mn in item.manual_notes
                    ]
                }
                for item in self.items
            ],
            "overall_status": self.overall_status.value,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "failure_items": [
                {
                    "id": fi.id,
                    "item_id": fi.item_id,
                    "item_type": fi.item_type,
                    "reason": fi.reason,
                    "details": fi.details,
                    "created_at": fi.created_at,
                    "assignee": fi.assignee
                }
                for fi in self.failure_items
            ],
            "material_summary": self.material_summary
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'ReleaseRecord':
        items = []
        for item_data in data['items']:
            evidence_fields = [
                EvidenceField(**ef) for ef in item_data['evidence_fields']
            ]
            mr_data = item_data.get('model_review')
            model_review = ModelReview(**mr_data) if mr_data else None
            manual_notes = [
                ManualNote(**mn) for mn in item_data.get('manual_notes', [])
            ]
            items.append(
                ReleaseItem(
                    id=item_data['id'],
                    file_summary=item_data['file_summary'],
                    file_path=item_data['file_path'],
                    status=Status(item_data['status']),
                    comp_action_status=CompActionStatus(item_data['comp_action_status']),
                    evidence_fields=evidence_fields,
                    failure_reason=item_data.get('failure_reason'),
                    model_review=model_review,
                    manual_notes=manual_notes
                )
            )
        
        failure_items = [
            FailureItem(**fi) for fi in data.get('failure_items', [])
        ]
        
        return cls(
            id=data['id'],
            version=data['version'],
            release_date=data['release_date'],
            description=data['description'],
            items=items,
            overall_status=Status(data['overall_status']),
            created_at=data['created_at'],
            updated_at=data['updated_at'],
            failure_items=failure_items,
            material_summary=data.get('material_summary', '')
        )


def generate_id() -> str:
    return str(uuid.uuid4())


def get_current_time() -> str:
    return datetime.now().isoformat()
