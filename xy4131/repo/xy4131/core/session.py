import pandas as pd
import numpy as np
from pathlib import Path
from typing import Dict, List, Optional
from datetime import datetime
import json
import pickle
import pytz

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from config.settings import Settings
from utils.helpers import generate_id, format_datetime


class SessionManager:
    def __init__(self):
        Settings.ensure_dirs()
        self.sessions_dir = Settings.SESSIONS_DIR
        self.current_session: Optional[Dict] = None
    
    def create_session(self, name: str = None) -> Dict:
        session_id = generate_id()
        now = datetime.now(pytz.timezone(Settings.TIMEZONE))
        
        session = {
            'session_id': session_id,
            'name': name or f"复盘会话 {session_id}",
            'created_at': now,
            'updated_at': now,
            'raw_data_info': {},
            'risks': [],
            'risk_summary': {},
            'notes': '',
            'metadata': {}
        }
        
        self.current_session = session
        return session
    
    def save_session(self, session_data: Dict = None, 
                     normalized_data: Dict[str, pd.DataFrame] = None,
                     risks: pd.DataFrame = None,
                     risk_summary: Dict = None) -> str:
        if session_data is None:
            if self.current_session is None:
                raise ValueError("没有活动的会话，请先创建会话")
            session_data = self.current_session
        
        session_id = session_data['session_id']
        session_data['updated_at'] = datetime.now(pytz.timezone(Settings.TIMEZONE))
        
        if risk_summary:
            session_data['risk_summary'] = risk_summary
        
        if risks is not None and not risks.empty:
            risks_json = risks.copy()
            for col in risks_json.columns:
                if risks_json[col].dtype == 'datetime64[ns]' or risks_json[col].dtype == 'datetime64[ns, Asia/Shanghai]':
                    risks_json[col] = risks_json[col].apply(lambda x: x.isoformat() if pd.notna(x) else None)
            session_data['risks'] = risks_json.to_dict('records')
        
        session_file = self.sessions_dir / f"{session_id}.json"
        
        def default_converter(obj):
            if isinstance(obj, datetime):
                return obj.isoformat()
            if isinstance(obj, pd.Timestamp):
                return obj.isoformat()
            raise TypeError(f"Object of type {type(obj)} is not JSON serializable")
        
        with open(session_file, 'w', encoding='utf-8') as f:
            json.dump(session_data, f, ensure_ascii=False, indent=2, default=default_converter)
        
        if normalized_data:
            data_file = self.sessions_dir / f"{session_id}_data.pkl"
            with open(data_file, 'wb') as f:
                pickle.dump(normalized_data, f)
        
        return session_id
    
    def load_session(self, session_id: str) -> Dict:
        session_file = self.sessions_dir / f"{session_id}.json"
        
        if not session_file.exists():
            raise FileNotFoundError(f"会话不存在: {session_id}")
        
        with open(session_file, 'r', encoding='utf-8') as f:
            session_data = json.load(f)
        
        if 'created_at' in session_data and isinstance(session_data['created_at'], str):
            session_data['created_at'] = datetime.fromisoformat(session_data['created_at'])
        if 'updated_at' in session_data and isinstance(session_data['updated_at'], str):
            session_data['updated_at'] = datetime.fromisoformat(session_data['updated_at'])
        
        data_file = self.sessions_dir / f"{session_id}_data.pkl"
        if data_file.exists():
            with open(data_file, 'rb') as f:
                session_data['normalized_data'] = pickle.load(f)
        
        self.current_session = session_data
        return session_data
    
    def list_sessions(self) -> List[Dict]:
        sessions = []
        
        for session_file in self.sessions_dir.glob("*.json"):
            if session_file.stem.endswith('_data'):
                continue
            
            try:
                with open(session_file, 'r', encoding='utf-8') as f:
                    session_data = json.load(f)
                
                sessions.append({
                    'session_id': session_data.get('session_id', session_file.stem),
                    'name': session_data.get('name', session_file.stem),
                    'created_at': session_data.get('created_at'),
                    'updated_at': session_data.get('updated_at'),
                    'risk_count': len(session_data.get('risks', [])),
                    'total_risks': session_data.get('risk_summary', {}).get('total_risks', 0),
                })
            except Exception:
                continue
        
        sessions.sort(key=lambda x: x.get('updated_at', x.get('created_at', '')), reverse=True)
        return sessions
    
    def delete_session(self, session_id: str) -> bool:
        session_file = self.sessions_dir / f"{session_id}.json"
        data_file = self.sessions_dir / f"{session_id}_data.pkl"
        
        deleted = False
        if session_file.exists():
            session_file.unlink()
            deleted = True
        
        if data_file.exists():
            data_file.unlink()
            deleted = True
        
        if self.current_session and self.current_session.get('session_id') == session_id:
            self.current_session = None
        
        return deleted
    
    def update_session_notes(self, session_id: str, notes: str) -> Dict:
        session = self.load_session(session_id)
        session['notes'] = notes
        self.save_session(session)
        return session
    
    def get_current_session(self) -> Optional[Dict]:
        return self.current_session
    
    def clear_current_session(self) -> None:
        self.current_session = None
