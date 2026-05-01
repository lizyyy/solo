import json
from datetime import datetime
from typing import List, Optional, Dict, Any, TypeVar, Generic, Type
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent.parent))

from persistence.database import DatabaseManager, get_db
from models.drill import Drill, DrillStatus
from models.area import Area, DEFAULT_AREAS
from models.observer import Observer, DEFAULT_OBSERVERS
from models.event_type import EventType, DEFAULT_EVENT_TYPES
from models.timeline import StandardTimeline, TimelineNode, DEFAULT_STANDARD_TIMELINES
from models.event import Event, MergedEvent, MergeStatus
from models.risk_level import RiskLevel
from importer.import_batch import ImportBatch, ImportStatus
from detector.issue_detector import Issue, IssueType, IssueSeverity, IssueStatus


T = TypeVar('T')


class BaseRepository(Generic[T]):
    def __init__(self, db: Optional[DatabaseManager] = None):
        self._db = db or get_db()
    
    def _row_to_model(self, row, model_class: Type[T]) -> T:
        data = dict(row)
        return model_class.from_dict(data)


class DrillRepository(BaseRepository[Drill]):
    def create(self, drill: Drill) -> Drill:
        sql = '''
            INSERT INTO drills (
                name, code, drill_type, description,
                planned_start_time, actual_start_time, actual_end_time,
                status, standard_timeline_code,
                area_codes, observer_codes, event_type_codes,
                created_at, updated_at, created_by, metadata
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        '''
        
        now = datetime.now()
        if drill.created_at is None:
            drill.created_at = now
        if drill.updated_at is None:
            drill.updated_at = now
        
        import json
        params = (
            drill.name,
            drill.code,
            drill.drill_type,
            drill.description,
            drill.planned_start_time,
            drill.actual_start_time,
            drill.actual_end_time,
            str(drill.status),
            drill.standard_timeline_code,
            json.dumps(drill.area_codes, ensure_ascii=False),
            json.dumps(drill.observer_codes, ensure_ascii=False),
            json.dumps(drill.event_type_codes, ensure_ascii=False),
            drill.created_at,
            drill.updated_at,
            drill.created_by,
            json.dumps(drill.metadata, ensure_ascii=False),
        )
        
        cursor = self._db.execute(sql, params)
        drill.id = cursor.lastrowid
        return drill
    
    def update(self, drill: Drill) -> Drill:
        sql = '''
            UPDATE drills SET
                name = ?, code = ?, drill_type = ?, description = ?,
                planned_start_time = ?, actual_start_time = ?, actual_end_time = ?,
                status = ?, standard_timeline_code = ?,
                area_codes = ?, observer_codes = ?, event_type_codes = ?,
                updated_at = ?, created_by = ?, metadata = ?
            WHERE id = ?
        '''
        
        import json
        params = (
            drill.name,
            drill.code,
            drill.drill_type,
            drill.description,
            drill.planned_start_time,
            drill.actual_start_time,
            drill.actual_end_time,
            str(drill.status),
            drill.standard_timeline_code,
            json.dumps(drill.area_codes, ensure_ascii=False),
            json.dumps(drill.observer_codes, ensure_ascii=False),
            json.dumps(drill.event_type_codes, ensure_ascii=False),
            datetime.now(),
            drill.created_by,
            json.dumps(drill.metadata, ensure_ascii=False),
            drill.id,
        )
        
        self._db.execute(sql, params)
        return drill
    
    def get_by_id(self, drill_id: int) -> Optional[Drill]:
        sql = 'SELECT * FROM drills WHERE id = ?'
        row = self._db.fetch_one(sql, (drill_id,))
        if row:
            return self._row_to_model(row, Drill)
        return None
    
    def get_by_code(self, code: str) -> Optional[Drill]:
        sql = 'SELECT * FROM drills WHERE code = ?'
        row = self._db.fetch_one(sql, (code,))
        if row:
            return self._row_to_model(row, Drill)
        return None
    
    def get_all(self, include_archived: bool = False) -> List[Drill]:
        if include_archived:
            sql = 'SELECT * FROM drills ORDER BY created_at DESC'
            rows = self._db.fetch_all(sql)
        else:
            sql = "SELECT * FROM drills WHERE status != '已归档' ORDER BY created_at DESC"
            rows = self._db.fetch_all(sql)
        return [self._row_to_model(row, Drill) for row in rows]
    
    def delete(self, drill_id: int) -> bool:
        sql = 'DELETE FROM drills WHERE id = ?'
        cursor = self._db.execute(sql, (drill_id,))
        return cursor.rowcount > 0


class AreaRepository(BaseRepository[Area]):
    def create(self, area: Area) -> Area:
        sql = '''
            INSERT INTO areas (
                name, code, description, parent_id,
                sort_order, is_active, created_at, updated_at, metadata
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        '''
        
        import json
        now = datetime.now()
        params = (
            area.name,
            area.code,
            area.description,
            area.parent_id,
            area.sort_order,
            1 if area.is_active else 0,
            now,
            now,
            json.dumps(area.metadata, ensure_ascii=False),
        )
        
        cursor = self._db.execute(sql, params)
        area.id = cursor.lastrowid
        return area
    
    def get_all(self, only_active: bool = True) -> List[Area]:
        if only_active:
            sql = 'SELECT * FROM areas WHERE is_active = 1 ORDER BY sort_order'
        else:
            sql = 'SELECT * FROM areas ORDER BY sort_order'
        rows = self._db.fetch_all(sql)
        return [self._row_to_model(row, Area) for row in rows]
    
    def get_by_code(self, code: str) -> Optional[Area]:
        sql = 'SELECT * FROM areas WHERE code = ?'
        row = self._db.fetch_one(sql, (code,))
        if row:
            return self._row_to_model(row, Area)
        return None
    
    def initialize_defaults(self):
        existing = self.get_all(only_active=False)
        existing_codes = {a.code for a in existing}
        
        for area in DEFAULT_AREAS:
            if area.code not in existing_codes:
                self.create(area)


class ObserverRepository(BaseRepository[Observer]):
    def create(self, observer: Observer) -> Observer:
        sql = '''
            INSERT INTO observers (
                name, code, role, assigned_area_codes,
                contact, is_active, time_offset_seconds,
                created_at, updated_at, metadata
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        '''
        
        import json
        now = datetime.now()
        params = (
            observer.name,
            observer.code,
            observer.role,
            json.dumps(observer.assigned_area_codes, ensure_ascii=False),
            observer.contact,
            1 if observer.is_active else 0,
            observer.time_offset_seconds,
            now,
            now,
            json.dumps(observer.metadata, ensure_ascii=False),
        )
        
        cursor = self._db.execute(sql, params)
        observer.id = cursor.lastrowid
        return observer
    
    def get_all(self, only_active: bool = True) -> List[Observer]:
        if only_active:
            sql = 'SELECT * FROM observers WHERE is_active = 1 ORDER BY name'
        else:
            sql = 'SELECT * FROM observers ORDER BY name'
        rows = self._db.fetch_all(sql)
        return [self._row_to_model(row, Observer) for row in rows]
    
    def get_by_code(self, code: str) -> Optional[Observer]:
        sql = 'SELECT * FROM observers WHERE code = ?'
        row = self._db.fetch_one(sql, (code,))
        if row:
            return self._row_to_model(row, Observer)
        return None
    
    def initialize_defaults(self):
        existing = self.get_all(only_active=False)
        existing_codes = {o.code for o in existing}
        
        for observer in DEFAULT_OBSERVERS:
            if observer.code not in existing_codes:
                self.create(observer)


class EventTypeRepository(BaseRepository[EventType]):
    def create(self, event_type: EventType) -> EventType:
        sql = '''
            INSERT INTO event_types (
                name, code, description, default_risk_level,
                is_key_node, created_at, updated_at, metadata
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        '''
        
        import json
        now = datetime.now()
        params = (
            event_type.name,
            event_type.code,
            event_type.description,
            str(event_type.default_risk_level),
            1 if event_type.is_key_node else 0,
            now,
            now,
            json.dumps(event_type.metadata, ensure_ascii=False),
        )
        
        cursor = self._db.execute(sql, params)
        event_type.id = cursor.lastrowid
        return event_type
    
    def get_all(self) -> List[EventType]:
        sql = 'SELECT * FROM event_types ORDER BY is_key_node DESC, name'
        rows = self._db.fetch_all(sql)
        return [self._row_to_model(row, EventType) for row in rows]
    
    def get_by_code(self, code: str) -> Optional[EventType]:
        sql = 'SELECT * FROM event_types WHERE code = ?'
        row = self._db.fetch_one(sql, (code,))
        if row:
            return self._row_to_model(row, EventType)
        return None
    
    def initialize_defaults(self):
        existing = self.get_all()
        existing_codes = {et.code for et in existing}
        
        for event_type in DEFAULT_EVENT_TYPES:
            if event_type.code not in existing_codes:
                self.create(event_type)


class StandardTimelineRepository(BaseRepository[StandardTimeline]):
    def create(self, timeline: StandardTimeline) -> StandardTimeline:
        sql = '''
            INSERT INTO standard_timelines (
                name, code, description, drill_type,
                nodes, created_at, updated_at, metadata
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        '''
        
        import json
        now = datetime.now()
        nodes_json = json.dumps([n.to_dict() for n in timeline.nodes], ensure_ascii=False)
        
        params = (
            timeline.name,
            timeline.code,
            timeline.description,
            timeline.drill_type,
            nodes_json,
            now,
            now,
            json.dumps(timeline.metadata, ensure_ascii=False),
        )
        
        cursor = self._db.execute(sql, params)
        timeline.id = cursor.lastrowid
        return timeline
    
    def get_all(self) -> List[StandardTimeline]:
        sql = 'SELECT * FROM standard_timelines ORDER BY name'
        rows = self._db.fetch_all(sql)
        results = []
        for row in rows:
            data = dict(row)
            try:
                nodes_data = data.get('nodes', '[]')
                if isinstance(nodes_data, str):
                    import json
                    nodes_data = json.loads(nodes_data)
                data['nodes'] = [TimelineNode.from_dict(n) for n in nodes_data]
            except (json.JSONDecodeError, TypeError):
                data['nodes'] = []
            results.append(StandardTimeline.from_dict(data))
        return results
    
    def get_by_code(self, code: str) -> Optional[StandardTimeline]:
        sql = 'SELECT * FROM standard_timelines WHERE code = ?'
        row = self._db.fetch_one(sql, (code,))
        if row:
            data = dict(row)
            try:
                nodes_data = data.get('nodes', '[]')
                if isinstance(nodes_data, str):
                    import json
                    nodes_data = json.loads(nodes_data)
                data['nodes'] = [TimelineNode.from_dict(n) for n in nodes_data]
            except (json.JSONDecodeError, TypeError):
                data['nodes'] = []
            return StandardTimeline.from_dict(data)
        return None
    
    def initialize_defaults(self):
        existing = self.get_all()
        existing_codes = {st.code for st in existing}
        
        for timeline in DEFAULT_STANDARD_TIMELINES:
            if timeline.code not in existing_codes:
                self.create(timeline)


class EventRepository(BaseRepository[Event]):
    def create(self, event: Event) -> Event:
        sql = '''
            INSERT INTO events (
                drill_id, import_batch_id, source,
                original_time_str, original_time, time_offset_seconds,
                area_code, event_type_code, risk_level,
                description, person_count, photo_numbers, notes,
                review_tags, merge_status, merged_event_id,
                is_valid, validation_errors,
                created_at, updated_at, metadata
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        '''
        
        import json
        now = datetime.now()
        params = (
            event.drill_id,
            event.import_batch_id,
            event.source,
            event.original_time_str,
            event.original_time,
            event.time_offset_seconds,
            event.area_code,
            event.event_type_code,
            str(event.risk_level),
            event.description,
            event.person_count,
            json.dumps(event.photo_numbers, ensure_ascii=False),
            event.notes,
            json.dumps(event.review_tags, ensure_ascii=False),
            str(event.merge_status),
            event.merged_event_id,
            1 if event.is_valid else 0,
            json.dumps([e.to_dict() for e in event.validation_errors], ensure_ascii=False) if hasattr(event.validation_errors, '__iter__') and not isinstance(event.validation_errors, str) else '[]',
            now,
            now,
            json.dumps(event.metadata, ensure_ascii=False),
        )
        
        cursor = self._db.execute(sql, params)
        event.id = cursor.lastrowid
        return event
    
    def create_many(self, events: List[Event]) -> List[Event]:
        for event in events:
            self.create(event)
        return events
    
    def get_by_drill(self, drill_id: int, only_valid: bool = True) -> List[Event]:
        if only_valid:
            sql = 'SELECT * FROM events WHERE drill_id = ? AND is_valid = 1 ORDER BY original_time'
        else:
            sql = 'SELECT * FROM events WHERE drill_id = ? ORDER BY original_time'
        rows = self._db.fetch_all(sql, (drill_id,))
        return [self._row_to_model(row, Event) for row in rows]
    
    def get_by_id(self, event_id: int) -> Optional[Event]:
        sql = 'SELECT * FROM events WHERE id = ?'
        row = self._db.fetch_one(sql, (event_id,))
        if row:
            return self._row_to_model(row, Event)
        return None
    
    def update(self, event: Event) -> Event:
        sql = '''
            UPDATE events SET
                source = ?, original_time_str = ?, original_time = ?,
                time_offset_seconds = ?, area_code = ?, event_type_code = ?,
                risk_level = ?, description = ?, person_count = ?,
                photo_numbers = ?, notes = ?, review_tags = ?,
                merge_status = ?, merged_event_id = ?,
                is_valid = ?, updated_at = ?, metadata = ?
            WHERE id = ?
        '''
        
        import json
        params = (
            event.source,
            event.original_time_str,
            event.original_time,
            event.time_offset_seconds,
            event.area_code,
            event.event_type_code,
            str(event.risk_level),
            event.description,
            event.person_count,
            json.dumps(event.photo_numbers, ensure_ascii=False),
            event.notes,
            json.dumps(event.review_tags, ensure_ascii=False),
            str(event.merge_status),
            event.merged_event_id,
            1 if event.is_valid else 0,
            datetime.now(),
            json.dumps(event.metadata, ensure_ascii=False),
            event.id,
        )
        
        self._db.execute(sql, params)
        return event


class ImportBatchRepository(BaseRepository[ImportBatch]):
    def create(self, batch: ImportBatch) -> ImportBatch:
        sql = '''
            INSERT INTO import_batches (
                drill_id, file_name, file_path, file_type, file_hash,
                source_name, time_offset_seconds, status,
                total_records, valid_records, invalid_records,
                error_message, warnings,
                imported_at, completed_at, created_by, metadata
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        '''
        
        import json
        now = datetime.now()
        params = (
            batch.drill_id,
            batch.file_name,
            batch.file_path,
            batch.file_type,
            batch.file_hash,
            batch.source_name,
            batch.time_offset_seconds,
            str(batch.status),
            batch.total_records,
            batch.valid_records,
            batch.invalid_records,
            batch.error_message,
            json.dumps(batch.warnings, ensure_ascii=False),
            now,
            batch.completed_at,
            batch.created_by,
            json.dumps(batch.metadata, ensure_ascii=False),
        )
        
        cursor = self._db.execute(sql, params)
        batch.id = cursor.lastrowid
        return batch
    
    def update(self, batch: ImportBatch) -> ImportBatch:
        sql = '''
            UPDATE import_batches SET
                status = ?, total_records = ?, valid_records = ?,
                invalid_records = ?, error_message = ?, warnings = ?,
                completed_at = ?, metadata = ?
            WHERE id = ?
        '''
        
        import json
        params = (
            str(batch.status),
            batch.total_records,
            batch.valid_records,
            batch.invalid_records,
            batch.error_message,
            json.dumps(batch.warnings, ensure_ascii=False),
            batch.completed_at or datetime.now(),
            json.dumps(batch.metadata, ensure_ascii=False),
            batch.id,
        )
        
        self._db.execute(sql, params)
        return batch
    
    def get_by_drill(self, drill_id: int) -> List[ImportBatch]:
        sql = 'SELECT * FROM import_batches WHERE drill_id = ? ORDER BY imported_at DESC'
        rows = self._db.fetch_all(sql, (drill_id,))
        return [self._row_to_model(row, ImportBatch) for row in rows]
    
    def get_by_id(self, batch_id: int) -> Optional[ImportBatch]:
        sql = 'SELECT * FROM import_batches WHERE id = ?'
        row = self._db.fetch_one(sql, (batch_id,))
        if row:
            return self._row_to_model(row, ImportBatch)
        return None


class IssueRepository(BaseRepository[Issue]):
    def create(self, issue: Issue) -> Issue:
        sql = '''
            INSERT INTO issues (
                drill_id, issue_type, severity, status,
                title, description,
                related_event_ids, related_area_codes, related_sources,
                detected_at, resolved_at, resolved_by, resolution_notes, metadata
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        '''
        
        import json
        params = (
            issue.drill_id,
            str(issue.issue_type),
            str(issue.severity),
            str(issue.status),
            issue.title,
            issue.description,
            json.dumps(issue.related_event_ids, ensure_ascii=False),
            json.dumps(issue.related_area_codes, ensure_ascii=False),
            json.dumps(issue.related_sources, ensure_ascii=False),
            issue.detected_at or datetime.now(),
            issue.resolved_at,
            issue.resolved_by,
            issue.resolution_notes,
            json.dumps(issue.metadata, ensure_ascii=False),
        )
        
        cursor = self._db.execute(sql, params)
        issue.id = cursor.lastrowid
        return issue
    
    def create_many(self, issues: List[Issue]) -> List[Issue]:
        for issue in issues:
            self.create(issue)
        return issues
    
    def get_by_drill(self, drill_id: int, include_resolved: bool = False) -> List[Issue]:
        if include_resolved:
            sql = 'SELECT * FROM issues WHERE drill_id = ? ORDER BY detected_at'
        else:
            sql = "SELECT * FROM issues WHERE drill_id = ? AND status NOT IN ('已解决', '已忽略') ORDER BY detected_at"
        rows = self._db.fetch_all(sql, (drill_id,))
        results = []
        for row in rows:
            data = dict(row)
            results.append(Issue.from_dict(data))
        return results
    
    def update(self, issue: Issue) -> Issue:
        sql = '''
            UPDATE issues SET
                status = ?, resolved_at = ?, resolved_by = ?,
                resolution_notes = ?, metadata = ?
            WHERE id = ?
        '''
        
        import json
        params = (
            str(issue.status),
            issue.resolved_at,
            issue.resolved_by,
            issue.resolution_notes,
            json.dumps(issue.metadata, ensure_ascii=False),
            issue.id,
        )
        
        self._db.execute(sql, params)
        return issue
    
    def delete_by_drill(self, drill_id: int) -> int:
        sql = 'DELETE FROM issues WHERE drill_id = ?'
        cursor = self._db.execute(sql, (drill_id,))
        return cursor.rowcount


def initialize_default_data():
    AreaRepository().initialize_defaults()
    ObserverRepository().initialize_defaults()
    EventTypeRepository().initialize_defaults()
    StandardTimelineRepository().initialize_defaults()
