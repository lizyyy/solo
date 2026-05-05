import os
import json
import sqlite3
import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field, asdict
from contextlib import contextmanager


@dataclass
class FailedSample:
    sample_id: str
    validation_id: str
    case_id: str
    case_name: str
    original_sql: str
    optimized_sql: str
    error_type: str
    error_message: str
    sample_data: str
    created_at: datetime
    resolved: bool = False
    resolved_at: Optional[datetime] = None
    resolver_note: str = ''
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'sample_id': self.sample_id,
            'validation_id': self.validation_id,
            'case_id': self.case_id,
            'case_name': self.case_name,
            'original_sql': self.original_sql,
            'optimized_sql': self.optimized_sql,
            'error_type': self.error_type,
            'error_message': self.error_message,
            'sample_data': self.sample_data,
            'resolved': self.resolved,
            'resolver_note': self.resolver_note,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'resolved_at': self.resolved_at.isoformat() if self.resolved_at else None
        }


@dataclass
class ManualConfirmation:
    confirmation_id: str
    validation_id: str
    case_id: str
    confirmed_by: str
    confirmed_at: datetime
    confirmation_type: str
    notes: str = ''
    is_valid: bool = True
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'confirmation_id': self.confirmation_id,
            'validation_id': self.validation_id,
            'case_id': self.case_id,
            'confirmed_by': self.confirmed_by,
            'confirmed_at': self.confirmed_at.isoformat() if self.confirmed_at else None,
            'confirmation_type': self.confirmation_type,
            'notes': self.notes,
            'is_valid': self.is_valid
        }


@dataclass
class OptimizationSuggestion:
    suggestion_id: str
    validation_id: str
    case_id: str
    suggestion_text: str
    category: str
    priority: str
    created_at: datetime
    applied: bool = False
    applied_at: Optional[datetime] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'suggestion_id': self.suggestion_id,
            'validation_id': self.validation_id,
            'case_id': self.case_id,
            'suggestion_text': self.suggestion_text,
            'category': self.category,
            'priority': self.priority,
            'applied': self.applied,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'applied_at': self.applied_at.isoformat() if self.applied_at else None
        }


class PersistenceManager:
    SCHEMA_SQL = '''
    CREATE TABLE IF NOT EXISTS validations (
        validation_id TEXT PRIMARY KEY,
        name TEXT,
        status TEXT,
        total_cases INTEGER,
        passed_count INTEGER,
        failed_count INTEGER,
        error_count INTEGER,
        schema_imported BOOLEAN,
        data_imported BOOLEAN,
        error_message TEXT,
        started_at TEXT,
        completed_at TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS validation_cases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        validation_id TEXT,
        case_id TEXT,
        name TEXT,
        original_sql TEXT,
        optimized_sql TEXT,
        description TEXT,
        tags TEXT,
        status TEXT,
        error_message TEXT,
        comparison_result TEXT,
        suggestions TEXT,
        started_at TEXT,
        completed_at TEXT,
        FOREIGN KEY (validation_id) REFERENCES validations(validation_id)
    );
    
    CREATE TABLE IF NOT EXISTS failed_samples (
        sample_id TEXT PRIMARY KEY,
        validation_id TEXT,
        case_id TEXT,
        case_name TEXT,
        original_sql TEXT,
        optimized_sql TEXT,
        error_type TEXT,
        error_message TEXT,
        sample_data TEXT,
        resolved BOOLEAN DEFAULT 0,
        resolver_note TEXT,
        created_at TEXT,
        resolved_at TEXT,
        FOREIGN KEY (validation_id) REFERENCES validations(validation_id)
    );
    
    CREATE TABLE IF NOT EXISTS manual_confirmations (
        confirmation_id TEXT PRIMARY KEY,
        validation_id TEXT,
        case_id TEXT,
        confirmed_by TEXT,
        confirmed_at TEXT,
        confirmation_type TEXT,
        notes TEXT,
        is_valid BOOLEAN DEFAULT 1,
        FOREIGN KEY (validation_id) REFERENCES validations(validation_id)
    );
    
    CREATE TABLE IF NOT EXISTS optimization_suggestions (
        suggestion_id TEXT PRIMARY KEY,
        validation_id TEXT,
        case_id TEXT,
        suggestion_text TEXT,
        category TEXT,
        priority TEXT,
        applied BOOLEAN DEFAULT 0,
        created_at TEXT,
        applied_at TEXT,
        FOREIGN KEY (validation_id) REFERENCES validations(validation_id)
    );
    
    CREATE INDEX IF NOT EXISTS idx_validations_status ON validations(status);
    CREATE INDEX IF NOT EXISTS idx_validations_created ON validations(created_at);
    CREATE INDEX IF NOT EXISTS idx_cases_validation ON validation_cases(validation_id);
    CREATE INDEX IF NOT EXISTS idx_samples_validation ON failed_samples(validation_id);
    CREATE INDEX IF NOT EXISTS idx_samples_resolved ON failed_samples(resolved);
    '''
    
    def __init__(self, storage_dir: str):
        self.storage_dir = storage_dir
        os.makedirs(storage_dir, exist_ok=True)
        self.db_path = os.path.join(storage_dir, 'validator_storage.db')
        self._init_db()
    
    @contextmanager
    def _get_connection(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()
    
    def _init_db(self):
        with self._get_connection() as conn:
            conn.executescript(self.SCHEMA_SQL)
            conn.commit()
    
    def save_validation(self, validation_result: Dict[str, Any]) -> str:
        validation_id = validation_result['validation_id']
        
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            cursor.execute('''
                INSERT OR REPLACE INTO validations 
                (validation_id, name, status, total_cases, passed_count, failed_count,
                 error_count, schema_imported, data_imported, error_message, started_at, completed_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                validation_id,
                validation_result.get('name', 'Unnamed'),
                validation_result.get('status', 'pending'),
                validation_result.get('total_cases', 0),
                validation_result.get('passed_count', 0),
                validation_result.get('failed_count', 0),
                validation_result.get('error_count', 0),
                validation_result.get('schema_imported', False),
                validation_result.get('data_imported', False),
                validation_result.get('error_message'),
                validation_result.get('started_at'),
                validation_result.get('completed_at')
            ))
            
            cursor.execute('DELETE FROM validation_cases WHERE validation_id = ?', (validation_id,))
            
            for case in validation_result.get('cases', []):
                cursor.execute('''
                    INSERT INTO validation_cases
                    (validation_id, case_id, name, original_sql, optimized_sql, description,
                     tags, status, error_message, comparison_result, suggestions, started_at, completed_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    validation_id,
                    case.get('case_id'),
                    case.get('name'),
                    case.get('original_sql'),
                    case.get('optimized_sql'),
                    case.get('description'),
                    json.dumps(case.get('tags', [])),
                    case.get('status'),
                    case.get('error_message'),
                    json.dumps(case.get('comparison_result')) if case.get('comparison_result') else None,
                    json.dumps(case.get('suggestions', [])),
                    case.get('started_at'),
                    case.get('completed_at')
                ))
            
            conn.commit()
        
        return validation_id
    
    def get_validation(self, validation_id: str) -> Optional[Dict[str, Any]]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM validations WHERE validation_id = ?', (validation_id,))
            row = cursor.fetchone()
            
            if not row:
                return None
            
            validation = dict(row)
            
            cursor.execute('SELECT * FROM validation_cases WHERE validation_id = ?', (validation_id,))
            cases = []
            for case_row in cursor.fetchall():
                case = dict(case_row)
                case['tags'] = json.loads(case['tags']) if case['tags'] else []
                case['comparison_result'] = json.loads(case['comparison_result']) if case['comparison_result'] else None
                case['suggestions'] = json.loads(case['suggestions']) if case['suggestions'] else []
                cases.append(case)
            
            validation['cases'] = cases
            validation['total_cases'] = len(cases)
            
            return validation
    
    def list_validations(self, limit: int = 100, offset: int = 0, status: Optional[str] = None) -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            if status:
                cursor.execute('''
                    SELECT * FROM validations 
                    WHERE status = ?
                    ORDER BY created_at DESC
                    LIMIT ? OFFSET ?
                ''', (status, limit, offset))
            else:
                cursor.execute('''
                    SELECT * FROM validations 
                    ORDER BY created_at DESC
                    LIMIT ? OFFSET ?
                ''', (limit, offset))
            
            return [dict(row) for row in cursor.fetchall()]
    
    def save_failed_sample(self, sample: FailedSample) -> str:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            cursor.execute('''
                INSERT OR REPLACE INTO failed_samples
                (sample_id, validation_id, case_id, case_name, original_sql, optimized_sql,
                 error_type, error_message, sample_data, resolved, resolver_note, created_at, resolved_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                sample.sample_id,
                sample.validation_id,
                sample.case_id,
                sample.case_name,
                sample.original_sql,
                sample.optimized_sql,
                sample.error_type,
                sample.error_message,
                sample.sample_data,
                sample.resolved,
                sample.resolver_note,
                sample.created_at.isoformat() if sample.created_at else None,
                sample.resolved_at.isoformat() if sample.resolved_at else None
            ))
            
            conn.commit()
        
        return sample.sample_id
    
    def get_failed_sample(self, sample_id: str) -> Optional[FailedSample]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM failed_samples WHERE sample_id = ?', (sample_id,))
            row = cursor.fetchone()
            
            if not row:
                return None
            
            data = dict(row)
            return FailedSample(
                sample_id=data['sample_id'],
                validation_id=data['validation_id'],
                case_id=data['case_id'],
                case_name=data['case_name'],
                original_sql=data['original_sql'],
                optimized_sql=data['optimized_sql'],
                error_type=data['error_type'],
                error_message=data['error_message'],
                sample_data=data['sample_data'],
                resolved=data['resolved'],
                resolver_note=data['resolver_note'] or '',
                created_at=datetime.fromisoformat(data['created_at']) if data['created_at'] else None,
                resolved_at=datetime.fromisoformat(data['resolved_at']) if data['resolved_at'] else None
            )
    
    def list_failed_samples(
        self, 
        limit: int = 100, 
        offset: int = 0, 
        resolved: Optional[bool] = None,
        validation_id: Optional[str] = None
    ) -> List[FailedSample]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            query = 'SELECT * FROM failed_samples WHERE 1=1'
            params = []
            
            if resolved is not None:
                query += ' AND resolved = ?'
                params.append(resolved)
            
            if validation_id:
                query += ' AND validation_id = ?'
                params.append(validation_id)
            
            query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
            params.extend([limit, offset])
            
            cursor.execute(query, params)
            
            samples = []
            for row in cursor.fetchall():
                data = dict(row)
                samples.append(FailedSample(
                    sample_id=data['sample_id'],
                    validation_id=data['validation_id'],
                    case_id=data['case_id'],
                    case_name=data['case_name'],
                    original_sql=data['original_sql'],
                    optimized_sql=data['optimized_sql'],
                    error_type=data['error_type'],
                    error_message=data['error_message'],
                    sample_data=data['sample_data'],
                    resolved=data['resolved'],
                    resolver_note=data['resolver_note'] or '',
                    created_at=datetime.fromisoformat(data['created_at']) if data['created_at'] else None,
                    resolved_at=datetime.fromisoformat(data['resolved_at']) if data['resolved_at'] else None
                ))
            
            return samples
    
    def resolve_failed_sample(self, sample_id: str, note: str = '') -> bool:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            cursor.execute('''
                UPDATE failed_samples 
                SET resolved = 1, resolved_at = ?, resolver_note = ?
                WHERE sample_id = ?
            ''', (datetime.now().isoformat(), note, sample_id))
            
            conn.commit()
            return cursor.rowcount > 0
    
    def save_manual_confirmation(self, confirmation: ManualConfirmation) -> str:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            cursor.execute('''
                INSERT OR REPLACE INTO manual_confirmations
                (confirmation_id, validation_id, case_id, confirmed_by, confirmed_at,
                 confirmation_type, notes, is_valid)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                confirmation.confirmation_id,
                confirmation.validation_id,
                confirmation.case_id,
                confirmation.confirmed_by,
                confirmation.confirmed_at.isoformat() if confirmation.confirmed_at else None,
                confirmation.confirmation_type,
                confirmation.notes,
                confirmation.is_valid
            ))
            
            conn.commit()
        
        return confirmation.confirmation_id
    
    def list_manual_confirmations(
        self, 
        limit: int = 100, 
        offset: int = 0,
        validation_id: Optional[str] = None
    ) -> List[ManualConfirmation]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            if validation_id:
                cursor.execute('''
                    SELECT * FROM manual_confirmations 
                    WHERE validation_id = ?
                    ORDER BY confirmed_at DESC LIMIT ? OFFSET ?
                ''', (validation_id, limit, offset))
            else:
                cursor.execute('''
                    SELECT * FROM manual_confirmations 
                    ORDER BY confirmed_at DESC LIMIT ? OFFSET ?
                ''', (limit, offset))
            
            confirmations = []
            for row in cursor.fetchall():
                data = dict(row)
                confirmations.append(ManualConfirmation(
                    confirmation_id=data['confirmation_id'],
                    validation_id=data['validation_id'],
                    case_id=data['case_id'],
                    confirmed_by=data['confirmed_by'],
                    confirmed_at=datetime.fromisoformat(data['confirmed_at']) if data['confirmed_at'] else None,
                    confirmation_type=data['confirmation_type'],
                    notes=data['notes'] or '',
                    is_valid=data['is_valid']
                ))
            
            return confirmations
    
    def save_optimization_suggestion(self, suggestion: OptimizationSuggestion) -> str:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            cursor.execute('''
                INSERT OR REPLACE INTO optimization_suggestions
                (suggestion_id, validation_id, case_id, suggestion_text, category,
                 priority, applied, created_at, applied_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                suggestion.suggestion_id,
                suggestion.validation_id,
                suggestion.case_id,
                suggestion.suggestion_text,
                suggestion.category,
                suggestion.priority,
                suggestion.applied,
                suggestion.created_at.isoformat() if suggestion.created_at else None,
                suggestion.applied_at.isoformat() if suggestion.applied_at else None
            ))
            
            conn.commit()
        
        return suggestion.suggestion_id
    
    def list_optimization_suggestions(
        self, 
        limit: int = 100, 
        offset: int = 0,
        validation_id: Optional[str] = None,
        applied: Optional[bool] = None
    ) -> List[OptimizationSuggestion]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            query = 'SELECT * FROM optimization_suggestions WHERE 1=1'
            params = []
            
            if validation_id:
                query += ' AND validation_id = ?'
                params.append(validation_id)
            
            if applied is not None:
                query += ' AND applied = ?'
                params.append(applied)
            
            query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
            params.extend([limit, offset])
            
            cursor.execute(query, params)
            
            suggestions = []
            for row in cursor.fetchall():
                data = dict(row)
                suggestions.append(OptimizationSuggestion(
                    suggestion_id=data['suggestion_id'],
                    validation_id=data['validation_id'],
                    case_id=data['case_id'],
                    suggestion_text=data['suggestion_text'],
                    category=data['category'],
                    priority=data['priority'],
                    applied=data['applied'],
                    created_at=datetime.fromisoformat(data['created_at']) if data['created_at'] else None,
                    applied_at=datetime.fromisoformat(data['applied_at']) if data['applied_at'] else None
                ))
            
            return suggestions
    
    def get_statistics(self) -> Dict[str, Any]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT 
                    COUNT(*) as total_validations,
                    SUM(CASE WHEN status = 'passed' THEN 1 ELSE 0 END) as passed_validations,
                    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_validations,
                    SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error_validations
                FROM validations
            ''')
            validation_stats = dict(cursor.fetchone())
            
            cursor.execute('''
                SELECT 
                    COUNT(*) as total_samples,
                    SUM(CASE WHEN resolved = 1 THEN 1 ELSE 0 END) as resolved_samples
                FROM failed_samples
            ''')
            sample_stats = dict(cursor.fetchone())
            
            cursor.execute('''
                SELECT 
                    COUNT(*) as total_suggestions,
                    SUM(CASE WHEN applied = 1 THEN 1 ELSE 0 END) as applied_suggestions
                FROM optimization_suggestions
            ''')
            suggestion_stats = dict(cursor.fetchone())
            
            return {
                'validations': validation_stats,
                'failed_samples': sample_stats,
                'suggestions': suggestion_stats
            }
