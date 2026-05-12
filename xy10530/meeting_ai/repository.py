from typing import List, Optional, Dict, Any
from datetime import datetime, date

from .models import (
    Participant, Role, ParticipantRole, Meeting, ActionItem,
    ActionItemStatus, AuditLog, OperationType, ImportRecord
)
from .database import (
    get_connection, serialize_list, deserialize_list,
    parse_date, format_date, parse_datetime, format_datetime,
    log_audit
)


class ParticipantRepository:
    @staticmethod
    def add(name: str, email: Optional[str] = None, operator: str = "system") -> int:
        with get_connection() as conn:
            cursor = conn.execute('''
                INSERT INTO participants (name, email, created_at)
                VALUES (?, ?, ?)
            ''', (name, email, datetime.now().isoformat()))
            participant_id = cursor.lastrowid
            conn.commit()
            log_audit("participant", participant_id, OperationType.CREATE, operator,
                     new_value={"name": name, "email": email})
            return participant_id
    
    @staticmethod
    def get_all() -> List[Participant]:
        with get_connection() as conn:
            cursor = conn.execute('SELECT id, name, email, created_at FROM participants')
            return [Participant(
                id=row[0], name=row[1], email=row[2],
                created_at=parse_datetime(row[3])
            ) for row in cursor.fetchall()]
    
    @staticmethod
    def exists(name: str) -> bool:
        with get_connection() as conn:
            cursor = conn.execute('SELECT 1 FROM participants WHERE name = ?', (name,))
            return cursor.fetchone() is not None
    
    @staticmethod
    def get_by_name(name: str) -> Optional[Participant]:
        with get_connection() as conn:
            cursor = conn.execute('''
                SELECT id, name, email, created_at FROM participants WHERE name = ?
            ''', (name,))
            row = cursor.fetchone()
            if row is None:
                return None
            return Participant(
                id=row[0], name=row[1], email=row[2],
                created_at=parse_datetime(row[3])
            )


class RoleRepository:
    @staticmethod
    def add(name: str, description: Optional[str] = None, operator: str = "system") -> int:
        with get_connection() as conn:
            cursor = conn.execute('''
                INSERT INTO roles (name, description, created_at)
                VALUES (?, ?, ?)
            ''', (name, description, datetime.now().isoformat()))
            role_id = cursor.lastrowid
            conn.commit()
            log_audit("role", role_id, OperationType.CREATE, operator,
                       new_value={"name": name, "description": description})
            return role_id
    
    @staticmethod
    def get_all() -> List[Role]:
        with get_connection() as conn:
            cursor = conn.execute('SELECT id, name, description, created_at FROM roles')
            return [Role(
                id=row[0], name=row[1], description=row[2],
                created_at=parse_datetime(row[3])
            ) for row in cursor.fetchall()]
    
    @staticmethod
    def exists(name: str) -> bool:
        with get_connection() as conn:
            cursor = conn.execute('SELECT 1 FROM roles WHERE name = ?', (name,))
            return cursor.fetchone() is not None
    
    @staticmethod
    def get_by_name(name: str) -> Optional[Role]:
        with get_connection() as conn:
            cursor = conn.execute('''
                SELECT id, name, description, created_at FROM roles WHERE name = ?
            ''', (name,))
            row = cursor.fetchone()
            if row is None:
                return None
            return Role(
                id=row[0], name=row[1], description=row[2],
                created_at=parse_datetime(row[3])
            )


class ParticipantRoleRepository:
    @staticmethod
    def add(participant_id: int, role_id: int, operator: str = "system") -> None:
        with get_connection() as conn:
            conn.execute('''
                INSERT OR IGNORE INTO participant_roles (participant_id, role_id)
                VALUES (?, ?)
            ''', (participant_id, role_id))
            conn.commit()
    
    @staticmethod
    def get_participant_roles(participant_id: int) -> List[Role]:
        with get_connection() as conn:
            cursor = conn.execute('''
                SELECT r.id, r.name, r.description, r.created_at
                FROM roles r
                JOIN participant_roles pr ON r.id = pr.role_id
                WHERE pr.participant_id = ?
            ''', (participant_id,))
            return [Role(
                id=row[0], name=row[1], description=row[2],
                created_at=parse_datetime(row[3])
            ) for row in cursor.fetchall()]
    
    @staticmethod
    def get_role_participants(role_id: int) -> List[Participant]:
        with get_connection() as conn:
            cursor = conn.execute('''
                SELECT p.id, p.name, p.email, p.created_at
                FROM participants p
                JOIN participant_roles pr ON p.id = pr.participant_id
                WHERE pr.role_id = ?
            ''', (role_id,))
            return [Participant(
                id=row[0], name=row[1], email=row[2],
                created_at=parse_datetime(row[3])
            ) for row in cursor.fetchall()]


class MeetingRepository:
    @staticmethod
    def add(title: str, meeting_date: date, attendees: str, 
            content_hash: str, source_path: Optional[str] = None,
            operator: str = "system") -> int:
        with get_connection() as conn:
            cursor = conn.execute('''
                INSERT INTO meetings (title, meeting_date, attendees, 
                                      content_hash, source_path, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (title, meeting_date.isoformat(), attendees,
                  content_hash, source_path, datetime.now().isoformat()))
            meeting_id = cursor.lastrowid
            conn.commit()
            log_audit("meeting", meeting_id, OperationType.CREATE, operator,
                       new_value={"title": title, "meeting_date": meeting_date.isoformat()})
            return meeting_id
    
    @staticmethod
    def get_by_hash(content_hash: str) -> Optional[Meeting]:
        with get_connection() as conn:
            cursor = conn.execute('''
                SELECT id, title, meeting_date, attendees, content_hash, 
                       source_path, created_at
                FROM meetings WHERE content_hash = ?
            ''', (content_hash,))
            row = cursor.fetchone()
            if row is None:
                return None
            return Meeting(
                id=row[0], title=row[1], meeting_date=parse_date(row[2]),
                attendees=row[3], content_hash=row[4], source_path=row[5],
                created_at=parse_datetime(row[6])
            )
    
    @staticmethod
    def get_all() -> List[Meeting]:
        with get_connection() as conn:
            cursor = conn.execute('''
                SELECT id, title, meeting_date, attendees, content_hash, 
                       source_path, created_at
                FROM meetings ORDER BY meeting_date DESC
            ''')
            return [Meeting(
                id=row[0], title=row[1], meeting_date=parse_date(row[2]),
                attendees=row[3], content_hash=row[4], source_path=row[5],
                created_at=parse_datetime(row[6])
            ) for row in cursor.fetchall()]


class ActionItemRepository:
    @staticmethod
    def add(meeting_id: int, description: str, assignees: List[str],
             due_date: Optional[date], dependencies: List[int] = None,
             notes: Optional[str] = None, operator: str = "system") -> int:
        deps = dependencies or []
        status = ActionItemStatus.PENDING
        now = datetime.now().isoformat()
        
        with get_connection() as conn:
            cursor = conn.execute('''
                INSERT INTO action_items (
                    meeting_id, description, assignees, due_date, 
                    status, dependencies, notes, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                meeting_id, description, serialize_list(assignees),
                format_date(due_date), status.value,
                serialize_list(deps), notes, now, now
            ))
            action_id = cursor.lastrowid
            conn.commit()
            
            log_audit("action_item", action_id, OperationType.CREATE, operator,
                       new_value={
                           "description": description,
                           "assignees": assignees,
                           "due_date": format_date(due_date),
                           "dependencies": deps
                       })
            return action_id
    
    @staticmethod
    def get_all() -> List[ActionItem]:
        with get_connection() as conn:
            cursor = conn.execute('''
                SELECT id, meeting_id, description, assignees, due_date,
                       status, dependencies, notes, created_at, updated_at, completed_at
                FROM action_items
            ''')
            return [ActionItemRepository._row_to_obj(row) for row in cursor.fetchall()]
    
    @staticmethod
    def get_by_id(action_id: int) -> Optional[ActionItem]:
        with get_connection() as conn:
            cursor = conn.execute('''
                SELECT id, meeting_id, description, assignees, due_date,
                       status, dependencies, notes, created_at, updated_at, completed_at
                FROM action_items WHERE id = ?
            ''', (action_id,))
            row = cursor.fetchone()
            if row is None:
                return None
            return ActionItemRepository._row_to_obj(row)
    
    @staticmethod
    def get_by_meeting(meeting_id: int) -> List[ActionItem]:
        with get_connection() as conn:
            cursor = conn.execute('''
                SELECT id, meeting_id, description, assignees, due_date,
                       status, dependencies, notes, created_at, updated_at, completed_at
                FROM action_items WHERE meeting_id = ?
            ''', (meeting_id,))
            return [ActionItemRepository._row_to_obj(row) for row in cursor.fetchall()]
    
    @staticmethod
    def get_by_assignee(assignee_name: str) -> List[ActionItem]:
        with get_connection() as conn:
            cursor = conn.execute('''
                SELECT id, meeting_id, description, assignees, due_date,
                       status, dependencies, notes, created_at, updated_at, completed_at
                FROM action_items
            ''')
            items = [ActionItemRepository._row_to_obj(row) for row in cursor.fetchall()]
            return [item for item in items if assignee_name in item.assignees]
    
    @staticmethod
    def update_status(action_id: int, status: ActionItemStatus, operator: str, 
                     reason: Optional[str] = None) -> bool:
        item = ActionItemRepository.get_by_id(action_id)
        if item is None:
            return False
        
        old_status = item.status.value
        completed_at = datetime.now().isoformat() if status == ActionItemStatus.DONE else None
        
        with get_connection() as conn:
            if completed_at:
                conn.execute('''
                    UPDATE action_items 
                    SET status = ?, updated_at = ?, completed_at = ?
                    WHERE id = ?
                ''', (status.value, datetime.now().isoformat(), completed_at, action_id))
            else:
                conn.execute('''
                    UPDATE action_items 
                    SET status = ?, updated_at = ?
                    WHERE id = ?
                ''', (status.value, datetime.now().isoformat(), action_id))
            conn.commit()
        
        log_audit("action_item", action_id, OperationType.UPDATE, operator,
                   old_value={"status": old_status},
                   new_value={"status": status.value},
                   reason=reason)
        return True
    
    @staticmethod
    def update(action_id: int, description: Optional[str] = None,
               assignees: Optional[List[str]] = None,
               due_date: Optional[date] = None,
               dependencies: Optional[List[int]] = None,
               notes: Optional[str] = None,
               operator: str = "system",
               reason: Optional[str] = None) -> bool:
        item = ActionItemRepository.get_by_id(action_id)
        if item is None:
            return False
        
        old_value = {
            "description": item.description,
            "assignees": item.assignees,
            "due_date": format_date(item.due_date),
            "dependencies": item.dependencies,
            "notes": item.notes
        }
        
        new_value = {}
        updates = []
        params = []
        
        if description is not None:
            updates.append("description = ?")
            params.append(description)
            new_value["description"] = description
        
        if assignees is not None:
            updates.append("assignees = ?")
            params.append(serialize_list(assignees))
            new_value["assignees"] = assignees
        
        if due_date is not None:
            updates.append("due_date = ?")
            params.append(format_date(due_date))
            new_value["due_date"] = format_date(due_date)
        
        if dependencies is not None:
            updates.append("dependencies = ?")
            params.append(serialize_list(dependencies))
            new_value["dependencies"] = dependencies
        
        if notes is not None:
            updates.append("notes = ?")
            params.append(notes)
            new_value["notes"] = notes
        
        if not updates:
            return True
        
        updates.append("updated_at = ?")
        params.append(datetime.now().isoformat())
        params.append(action_id)
        
        with get_connection() as conn:
            conn.execute(f'''
                UPDATE action_items 
                SET {', '.join(updates)}
                WHERE id = ?
            ''', params)
            conn.commit()
        
        log_audit("action_item", action_id, OperationType.UPDATE, operator,
                   old_value=old_value, new_value=new_value, reason=reason)
        return True
    
    @staticmethod
    def _row_to_obj(row) -> ActionItem:
        return ActionItem(
            id=row[0], meeting_id=row[1], description=row[2],
            assignees=deserialize_list(row[3]),
            due_date=parse_date(row[4]),
            status=ActionItemStatus(row[5]),
            dependencies=deserialize_list(row[6]),
            notes=row[7],
            created_at=parse_datetime(row[8]),
            updated_at=parse_datetime(row[9]),
            completed_at=parse_datetime(row[10])
        )


class ImportRecordRepository:
    @staticmethod
    def add(content_hash: str, source_path: str) -> int:
        with get_connection() as conn:
            cursor = conn.execute('''
                INSERT INTO import_records (content_hash, source_path, imported_at)
                VALUES (?, ?, ?)
            ''', (content_hash, source_path, datetime.now().isoformat()))
            record_id = cursor.lastrowid
            conn.commit()
            return record_id
    
    @staticmethod
    def exists(content_hash: str) -> bool:
        with get_connection() as conn:
            cursor = conn.execute('''
                SELECT 1 FROM import_records WHERE content_hash = ?
            ''', (content_hash,))
            return cursor.fetchone() is not None
    
    @staticmethod
    def get_all() -> List[ImportRecord]:
        with get_connection() as conn:
            cursor = conn.execute('''
                SELECT id, content_hash, source_path, imported_at
                FROM import_records ORDER BY imported_at DESC
            ''')
            return [ImportRecord(
                id=row[0], content_hash=row[1], source_path=row[2],
                imported_at=parse_datetime(row[3])
            ) for row in cursor.fetchall()]


class AuditLogRepository:
    @staticmethod
    def get_by_entity(entity_type: str, entity_id: Optional[int] = None) -> List[AuditLog]:
        with get_connection() as conn:
            if entity_id is not None:
                cursor = conn.execute('''
                    SELECT id, entity_type, entity_id, operation_type, 
                           operator, old_value, new_value, reason, created_at
                    FROM audit_logs 
                    WHERE entity_type = ? AND entity_id = ?
                    ORDER BY created_at DESC
                ''', (entity_type, entity_id))
            else:
                cursor = conn.execute('''
                    SELECT id, entity_type, entity_id, operation_type, 
                           operator, old_value, new_value, reason, created_at
                    FROM audit_logs 
                    WHERE entity_type = ?
                    ORDER BY created_at DESC
                ''', (entity_type,))
            
            return [AuditLog(
                id=row[0], entity_type=row[1], entity_id=row[2],
                operation_type=OperationType(row[3]),
                operator=row[4],
                old_value=row[5], new_value=row[6], reason=row[7],
                created_at=parse_datetime(row[8])
            ) for row in cursor.fetchall()]
    
    @staticmethod
    def get_all(limit: int = 100) -> List[AuditLog]:
        with get_connection() as conn:
            cursor = conn.execute('''
                SELECT id, entity_type, entity_id, operation_type, 
                       operator, old_value, new_value, reason, created_at
                FROM audit_logs 
                ORDER BY created_at DESC
                LIMIT ?
            ''', (limit,))
            return [AuditLog(
                id=row[0], entity_type=row[1], entity_id=row[2],
                operation_type=OperationType(row[3]),
                operator=row[4],
                old_value=row[5], new_value=row[6], reason=row[7],
                created_at=parse_datetime(row[8])
            ) for row in cursor.fetchall()]
