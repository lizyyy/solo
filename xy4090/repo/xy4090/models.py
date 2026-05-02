from dataclasses import dataclass, field
from datetime import datetime, time
from enum import Enum
from typing import Optional, List, Dict, Any
from uuid import uuid4
import json


class MarkType(Enum):
    STUCK = "stuck"
    MISTRANSLATION = "mistranslation"
    CONFIRMED = "confirmed"


@dataclass
class Term:
    id: str
    chinese: str
    english: str
    category: str = ""
    notes: str = ""
    difficulty: int = 1
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "chinese": self.chinese,
            "english": self.english,
            "category": self.category,
            "notes": self.notes,
            "difficulty": self.difficulty
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Term":
        return cls(
            id=data.get("id", str(uuid4())),
            chinese=data.get("chinese", ""),
            english=data.get("english", ""),
            category=data.get("category", ""),
            notes=data.get("notes", ""),
            difficulty=data.get("difficulty", 1)
        )


@dataclass
class AgendaItem:
    id: str
    start_time: time
    end_time: time
    title: str
    speaker: str = ""
    topic: str = ""
    related_terms: List[str] = field(default_factory=list)
    notes: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "start_time": self.start_time.strftime("%H:%M:%S"),
            "end_time": self.end_time.strftime("%H:%M:%S"),
            "title": self.title,
            "speaker": self.speaker,
            "topic": self.topic,
            "related_terms": self.related_terms,
            "notes": self.notes
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "AgendaItem":
        start_time = cls._parse_time(data.get("start_time", "00:00:00"))
        end_time = cls._parse_time(data.get("end_time", "00:00:00"))
        return cls(
            id=data.get("id", str(uuid4())),
            start_time=start_time,
            end_time=end_time,
            title=data.get("title", ""),
            speaker=data.get("speaker", ""),
            topic=data.get("topic", ""),
            related_terms=data.get("related_terms", []),
            notes=data.get("notes", "")
        )
    
    @staticmethod
    def _parse_time(time_str: str) -> time:
        try:
            return datetime.strptime(time_str, "%H:%M:%S").time()
        except ValueError:
            try:
                return datetime.strptime(time_str, "%H:%M").time()
            except ValueError:
                return time(0, 0, 0)


@dataclass
class Mark:
    id: str
    mark_type: MarkType
    timestamp: datetime
    term_id: Optional[str] = None
    term_text: Optional[str] = None
    agenda_item_id: Optional[str] = None
    agenda_item_title: Optional[str] = None
    speaker: Optional[str] = None
    notes: str = ""
    correction: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "mark_type": self.mark_type.value,
            "timestamp": self.timestamp.isoformat(),
            "term_id": self.term_id,
            "term_text": self.term_text,
            "agenda_item_id": self.agenda_item_id,
            "agenda_item_title": self.agenda_item_title,
            "speaker": self.speaker,
            "notes": self.notes,
            "correction": self.correction
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Mark":
        try:
            mark_type = MarkType(data.get("mark_type", "stuck"))
        except ValueError:
            mark_type = MarkType.STUCK
        
        try:
            timestamp = datetime.fromisoformat(data.get("timestamp", datetime.now().isoformat()))
        except ValueError:
            timestamp = datetime.now()
        
        return cls(
            id=data.get("id", str(uuid4())),
            mark_type=mark_type,
            timestamp=timestamp,
            term_id=data.get("term_id"),
            term_text=data.get("term_text"),
            agenda_item_id=data.get("agenda_item_id"),
            agenda_item_title=data.get("agenda_item_title"),
            speaker=data.get("speaker"),
            notes=data.get("notes", ""),
            correction=data.get("correction", "")
        )


@dataclass
class ConferenceProject:
    id: str
    name: str
    created_at: datetime
    updated_at: datetime
    terms: List[Term] = field(default_factory=list)
    agenda: List[AgendaItem] = field(default_factory=list)
    marks: List[Mark] = field(default_factory=list)
    speakers: List[str] = field(default_factory=list)
    topics: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "terms": [t.to_dict() for t in self.terms],
            "agenda": [a.to_dict() for a in self.agenda],
            "marks": [m.to_dict() for m in self.marks],
            "speakers": self.speakers,
            "topics": self.topics
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ConferenceProject":
        try:
            created_at = datetime.fromisoformat(data.get("created_at", datetime.now().isoformat()))
        except ValueError:
            created_at = datetime.now()
        
        try:
            updated_at = datetime.fromisoformat(data.get("updated_at", datetime.now().isoformat()))
        except ValueError:
            updated_at = datetime.now()
        
        return cls(
            id=data.get("id", str(uuid4())),
            name=data.get("name", "未命名项目"),
            created_at=created_at,
            updated_at=updated_at,
            terms=[Term.from_dict(t) for t in data.get("terms", [])],
            agenda=[AgendaItem.from_dict(a) for a in data.get("agenda", [])],
            marks=[Mark.from_dict(m) for m in data.get("marks", [])],
            speakers=data.get("speakers", []),
            topics=data.get("topics", [])
        )
    
    def get_term_by_id(self, term_id: str) -> Optional[Term]:
        for term in self.terms:
            if term.id == term_id:
                return term
        return None
    
    def get_agenda_item_by_id(self, agenda_id: str) -> Optional[AgendaItem]:
        for item in self.agenda:
            if item.id == agenda_id:
                return item
        return None
    
    def get_current_agenda_item(self, current_time: Optional[time] = None) -> Optional[AgendaItem]:
        if current_time is None:
            current_time = datetime.now().time()
        
        for item in self.agenda:
            if item.start_time <= current_time <= item.end_time:
                return item
        
        for item in self.agenda:
            if item.start_time >= current_time:
                return item
        
        if self.agenda:
            return self.agenda[-1]
        return None
    
    def add_mark(self, mark: Mark) -> None:
        self.marks.append(mark)
        self.updated_at = datetime.now()
    
    def get_marks_by_type(self, mark_type: MarkType) -> List[Mark]:
        return [m for m in self.marks if m.mark_type == mark_type]
    
    def get_marks_by_speaker(self, speaker: str) -> List[Mark]:
        return [m for m in self.marks if m.speaker == speaker]
    
    def get_marks_by_topic(self, topic: str) -> List[Mark]:
        return [m for m in self.marks if m.agenda_item_title and topic in m.agenda_item_title]
    
    def get_unique_speakers(self) -> List[str]:
        speakers = set()
        for item in self.agenda:
            if item.speaker:
                speakers.add(item.speaker)
        for mark in self.marks:
            if mark.speaker:
                speakers.add(mark.speaker)
        return sorted(list(speakers))
    
    def get_unique_topics(self) -> List[str]:
        topics = set()
        for item in self.agenda:
            if item.topic:
                topics.add(item.topic)
            if item.title:
                topics.add(item.title)
        return sorted(list(topics))


@dataclass
class ValidationError:
    field: str
    message: str
    row_number: Optional[int] = None
    severity: str = "error"
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "field": self.field,
            "message": self.message,
            "row_number": self.row_number,
            "severity": self.severity
        }


@dataclass
class ImportResult:
    success: bool
    data: Any = None
    errors: List[ValidationError] = field(default_factory=list)
    warnings: List[ValidationError] = field(default_factory=list)
    count: int = 0
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "success": self.success,
            "errors": [e.to_dict() for e in self.errors],
            "warnings": [w.to_dict() for w in self.warnings],
            "count": self.count
        }
