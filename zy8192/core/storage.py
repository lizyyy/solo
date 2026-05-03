import json
import os
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple
from contextlib import contextmanager

from core.models import (
    Case, CaseData, VitalSign, DrugAdministration, RiskEvent,
    TimelineEvent, DrugRule, Species, WeightUnit,
    RiskType, RiskSeverity
)


class Storage:
    
    def __init__(self, db_path: str = None):
        if db_path is None:
            home = Path.home()
            app_dir = home / ".anesthesia_review"
            app_dir.mkdir(exist_ok=True)
            db_path = str(app_dir / "data.db")
        
        self.db_path = db_path
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
            cursor = conn.cursor()
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS cases (
                    case_id TEXT PRIMARY KEY,
                    patient_name TEXT,
                    species TEXT,
                    weight REAL,
                    weight_unit TEXT,
                    surgery_type TEXT,
                    start_time TEXT,
                    end_time TEXT,
                    anesthesiologist TEXT,
                    notes TEXT,
                    post_op_notes TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS vital_signs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    case_id TEXT,
                    timestamp TEXT,
                    heart_rate REAL,
                    respiratory_rate REAL,
                    systolic_bp REAL,
                    diastolic_bp REAL,
                    mean_bp REAL,
                    temperature REAL,
                    spo2 REAL,
                    etco2 REAL,
                    source TEXT,
                    FOREIGN KEY (case_id) REFERENCES cases(case_id)
                )
            ''')
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS drugs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    case_id TEXT,
                    timestamp TEXT,
                    drug_name TEXT,
                    dose REAL,
                    dose_unit TEXT,
                    route TEXT,
                    notes TEXT,
                    FOREIGN KEY (case_id) REFERENCES cases(case_id)
                )
            ''')
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS risks (
                    risk_id TEXT PRIMARY KEY,
                    case_id TEXT,
                    risk_type TEXT,
                    severity TEXT,
                    start_time TEXT,
                    end_time TEXT,
                    description TEXT,
                    confirmed INTEGER DEFAULT 0,
                    confirmed_by TEXT,
                    confirmed_time TEXT,
                    data_points TEXT,
                    FOREIGN KEY (case_id) REFERENCES cases(case_id)
                )
            ''')
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS import_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    case_id TEXT,
                    file_type TEXT,
                    file_path TEXT,
                    import_time TEXT,
                    FOREIGN KEY (case_id) REFERENCES cases(case_id)
                )
            ''')
            
            conn.commit()
    
    def save_case(self, case_data: CaseData) -> bool:
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                
                case = case_data.case
                cursor.execute('''
                    INSERT OR REPLACE INTO cases 
                    (case_id, patient_name, species, weight, weight_unit, 
                     surgery_type, start_time, end_time, anesthesiologist, 
                     notes, post_op_notes, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    case.case_id,
                    case.patient_name,
                    case.species.value,
                    case.weight,
                    case.weight_unit.value,
                    case.surgery_type,
                    case.start_time.isoformat(),
                    case.end_time.isoformat() if case.end_time else None,
                    case.anesthesiologist,
                    case.notes,
                    case_data.post_op_notes,
                    datetime.now().isoformat()
                ))
                
                cursor.execute('DELETE FROM vital_signs WHERE case_id = ?', (case.case_id,))
                for vital in case_data.vital_signs:
                    cursor.execute('''
                        INSERT INTO vital_signs 
                        (case_id, timestamp, heart_rate, respiratory_rate, systolic_bp,
                         diastolic_bp, mean_bp, temperature, spo2, etco2, source)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (
                        case.case_id,
                        vital.timestamp.isoformat(),
                        vital.heart_rate,
                        vital.respiratory_rate,
                        vital.systolic_bp,
                        vital.diastolic_bp,
                        vital.mean_bp,
                        vital.temperature,
                        vital.spo2,
                        vital.etco2,
                        vital.source
                    ))
                
                cursor.execute('DELETE FROM drugs WHERE case_id = ?', (case.case_id,))
                for drug in case_data.drug_administrations:
                    cursor.execute('''
                        INSERT INTO drugs 
                        (case_id, timestamp, drug_name, dose, dose_unit, route, notes)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    ''', (
                        case.case_id,
                        drug.timestamp.isoformat(),
                        drug.drug_name,
                        drug.dose,
                        drug.dose_unit,
                        drug.route,
                        drug.notes
                    ))
                
                cursor.execute('DELETE FROM risks WHERE case_id = ?', (case.case_id,))
                for risk in case_data.risks:
                    cursor.execute('''
                        INSERT INTO risks 
                        (risk_id, case_id, risk_type, severity, start_time, end_time,
                         description, confirmed, confirmed_by, confirmed_time, data_points)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (
                        risk.risk_id,
                        risk.case_id,
                        risk.risk_type.value,
                        risk.severity.value,
                        risk.start_time.isoformat(),
                        risk.end_time.isoformat() if risk.end_time else None,
                        risk.description,
                        1 if risk.confirmed else 0,
                        risk.confirmed_by,
                        risk.confirmed_time.isoformat() if risk.confirmed_time else None,
                        json.dumps(risk.data_points, ensure_ascii=False)
                    ))
                
                conn.commit()
                return True
        except Exception as e:
            print(f"保存病例失败: {e}")
            return False
    
    def load_case(self, case_id: str) -> Optional[CaseData]:
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                
                cursor.execute('SELECT * FROM cases WHERE case_id = ?', (case_id,))
                case_row = cursor.fetchone()
                
                if not case_row:
                    return None
                
                case = Case(
                    case_id=case_row['case_id'],
                    patient_name=case_row['patient_name'],
                    species=Species(case_row['species']),
                    weight=case_row['weight'],
                    weight_unit=WeightUnit(case_row['weight_unit']),
                    surgery_type=case_row['surgery_type'],
                    start_time=datetime.fromisoformat(case_row['start_time']),
                    end_time=datetime.fromisoformat(case_row['end_time']) if case_row['end_time'] else None,
                    anesthesiologist=case_row['anesthesiologist'] or '',
                    notes=case_row['notes'] or ''
                )
                
                cursor.execute('SELECT * FROM vital_signs WHERE case_id = ? ORDER BY timestamp', (case_id,))
                vital_rows = cursor.fetchall()
                vitals = []
                for row in vital_rows:
                    vitals.append(VitalSign(
                        timestamp=datetime.fromisoformat(row['timestamp']),
                        heart_rate=row['heart_rate'],
                        respiratory_rate=row['respiratory_rate'],
                        systolic_bp=row['systolic_bp'],
                        diastolic_bp=row['diastolic_bp'],
                        mean_bp=row['mean_bp'],
                        temperature=row['temperature'],
                        spo2=row['spo2'],
                        etco2=row['etco2'],
                        source=row['source'] or ''
                    ))
                
                cursor.execute('SELECT * FROM drugs WHERE case_id = ? ORDER BY timestamp', (case_id,))
                drug_rows = cursor.fetchall()
                drugs = []
                for row in drug_rows:
                    drugs.append(DrugAdministration(
                        timestamp=datetime.fromisoformat(row['timestamp']),
                        drug_name=row['drug_name'],
                        dose=row['dose'],
                        dose_unit=row['dose_unit'],
                        route=row['route'] or '',
                        notes=row['notes'] or ''
                    ))
                
                cursor.execute('SELECT * FROM risks WHERE case_id = ? ORDER BY start_time', (case_id,))
                risk_rows = cursor.fetchall()
                risks = []
                for row in risk_rows:
                    data_points = json.loads(row['data_points']) if row['data_points'] else []
                    risks.append(RiskEvent(
                        risk_id=row['risk_id'],
                        case_id=row['case_id'],
                        risk_type=RiskType(row['risk_type']),
                        severity=RiskSeverity(row['severity']),
                        start_time=datetime.fromisoformat(row['start_time']),
                        end_time=datetime.fromisoformat(row['end_time']) if row['end_time'] else None,
                        description=row['description'] or '',
                        confirmed=bool(row['confirmed']),
                        confirmed_by=row['confirmed_by'] or '',
                        confirmed_time=datetime.fromisoformat(row['confirmed_time']) if row['confirmed_time'] else None,
                        data_points=data_points
                    ))
                
                case_data = CaseData(
                    case=case,
                    vital_signs=vitals,
                    drug_administrations=drugs,
                    risks=risks,
                    post_op_notes=case_row['post_op_notes'] or ''
                )
                
                return case_data
        except Exception as e:
            print(f"加载病例失败: {e}")
            return None
    
    def list_cases(self) -> List[Dict[str, Any]]:
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT case_id, patient_name, species, surgery_type, 
                           start_time, end_time, anesthesiologist, updated_at
                    FROM cases
                    ORDER BY start_time DESC
                ''')
                rows = cursor.fetchall()
                
                cases = []
                for row in rows:
                    cases.append({
                        'case_id': row['case_id'],
                        'patient_name': row['patient_name'],
                        'species': row['species'],
                        'surgery_type': row['surgery_type'],
                        'start_time': row['start_time'],
                        'end_time': row['end_time'],
                        'anesthesiologist': row['anesthesiologist'],
                        'updated_at': row['updated_at']
                    })
                
                return cases
        except Exception as e:
            print(f"列出病例失败: {e}")
            return []
    
    def confirm_risk(self, risk_id: str, confirmed_by: str = "") -> bool:
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    UPDATE risks 
                    SET confirmed = 1, confirmed_by = ?, confirmed_time = ?
                    WHERE risk_id = ?
                ''', (confirmed_by, datetime.now().isoformat(), risk_id))
                conn.commit()
                return cursor.rowcount > 0
        except Exception as e:
            print(f"确认风险失败: {e}")
            return False
    
    def delete_case(self, case_id: str) -> bool:
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute('DELETE FROM risks WHERE case_id = ?', (case_id,))
                cursor.execute('DELETE FROM drugs WHERE case_id = ?', (case_id,))
                cursor.execute('DELETE FROM vital_signs WHERE case_id = ?', (case_id,))
                cursor.execute('DELETE FROM cases WHERE case_id = ?', (case_id,))
                conn.commit()
                return True
        except Exception as e:
            print(f"删除病例失败: {e}")
            return False
    
    def save_import_history(self, case_id: str, file_type: str, file_path: str) -> bool:
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    INSERT INTO import_history (case_id, file_type, file_path, import_time)
                    VALUES (?, ?, ?, ?)
                ''', (case_id, file_type, file_path, datetime.now().isoformat()))
                conn.commit()
                return True
        except Exception as e:
            print(f"保存导入历史失败: {e}")
            return False
