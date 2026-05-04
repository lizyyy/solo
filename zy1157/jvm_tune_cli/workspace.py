"""
Workspace Manager for JVM Tune CLI
"""

import os
import json
import shutil
from datetime import datetime
from typing import Dict, Any, Optional, List
from pathlib import Path
import logging

logger = logging.getLogger(__name__)


class WorkspaceManager:
    def __init__(self, workspace_dir: str = None):
        if workspace_dir is None:
            workspace_dir = os.path.join(os.getcwd(), ".jvm-tune")
        
        self.workspace_dir = Path(workspace_dir)
        self.data_dir = self.workspace_dir / "data"
        self.reports_dir = self.workspace_dir / "reports"
        self.config_dir = self.workspace_dir / "config"
        self.sessions_dir = self.workspace_dir / "sessions"
        
        self._metadata_file = self.workspace_dir / "metadata.json"
        self._current_session_file = self.workspace_dir / "current_session"
    
    def init(self, force: bool = False) -> bool:
        if self.workspace_dir.exists():
            if force:
                shutil.rmtree(self.workspace_dir)
            else:
                logger.warning(f"Workspace already exists at {self.workspace_dir}")
                return False
        
        self.workspace_dir.mkdir(parents=True)
        self.data_dir.mkdir()
        self.reports_dir.mkdir()
        self.config_dir.mkdir()
        self.sessions_dir.mkdir()
        
        metadata = {
            "created_at": datetime.now().isoformat(),
            "version": "0.1.0",
            "sessions": [],
            "current_session": None
        }
        
        with open(self._metadata_file, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, indent=2)
        
        logger.info(f"Initialized workspace at {self.workspace_dir}")
        return True
    
    def is_initialized(self) -> bool:
        return self.workspace_dir.exists() and self._metadata_file.exists()
    
    def create_session(self, name: str = None) -> str:
        if not self.is_initialized():
            raise RuntimeError("Workspace not initialized. Run 'init' first.")
        
        if name is None:
            name = f"session_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        session_id = name
        session_dir = self.sessions_dir / session_id
        session_dir.mkdir(parents=True, exist_ok=True)
        
        (session_dir / "imported").mkdir()
        (session_dir / "analysis").mkdir()
        (session_dir / "tuning").mkdir()
        (session_dir / "comparisons").mkdir()
        
        session_metadata = {
            "id": session_id,
            "name": name,
            "created_at": datetime.now().isoformat(),
            "imported_files": [],
            "analysis_results": [],
            "tuning_results": [],
            "comparisons": []
        }
        
        with open(session_dir / "session.json", 'w', encoding='utf-8') as f:
            json.dump(session_metadata, f, indent=2)
        
        with open(self._current_session_file, 'w', encoding='utf-8') as f:
            f.write(session_id)
        
        with open(self._metadata_file, 'r', encoding='utf-8') as f:
            metadata = json.load(f)
        
        metadata["sessions"].append({
            "id": session_id,
            "name": name,
            "created_at": datetime.now().isoformat()
        })
        metadata["current_session"] = session_id
        
        with open(self._metadata_file, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, indent=2)
        
        logger.info(f"Created session: {session_id}")
        return session_id
    
    def get_current_session(self) -> Optional[str]:
        if not self._current_session_file.exists():
            return None
        
        with open(self._current_session_file, 'r', encoding='utf-8') as f:
            return f.read().strip()
    
    def switch_session(self, session_id: str) -> bool:
        session_dir = self.sessions_dir / session_id
        if not session_dir.exists():
            logger.error(f"Session not found: {session_id}")
            return False
        
        with open(self._current_session_file, 'w', encoding='utf-8') as f:
            f.write(session_id)
        
        with open(self._metadata_file, 'r', encoding='utf-8') as f:
            metadata = json.load(f)
        
        metadata["current_session"] = session_id
        
        with open(self._metadata_file, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, indent=2)
        
        logger.info(f"Switched to session: {session_id}")
        return True
    
    def list_sessions(self) -> List[Dict[str, Any]]:
        if not self.is_initialized():
            return []
        
        with open(self._metadata_file, 'r', encoding='utf-8') as f:
            metadata = json.load(f)
        
        return metadata.get("sessions", [])
    
    def get_session_dir(self, session_id: str = None) -> Optional[Path]:
        if session_id is None:
            session_id = self.get_current_session()
        
        if session_id is None:
            return None
        
        session_dir = self.sessions_dir / session_id
        return session_dir if session_dir.exists() else None
    
    def save_imported_file(self, file_type: str, source_path: str, session_id: str = None) -> str:
        session_dir = self.get_session_dir(session_id)
        if session_dir is None:
            raise RuntimeError("No active session. Create or switch to a session first.")
        
        imported_dir = session_dir / "imported"
        filename = os.path.basename(source_path)
        dest_path = imported_dir / filename
        
        counter = 1
        while dest_path.exists():
            name, ext = os.path.splitext(filename)
            dest_path = imported_dir / f"{name}_{counter}{ext}"
            counter += 1
        
        shutil.copy2(source_path, dest_path)
        
        session_metadata_path = session_dir / "session.json"
        with open(session_metadata_path, 'r', encoding='utf-8') as f:
            session_metadata = json.load(f)
        
        imported_info = {
            "type": file_type,
            "original_path": source_path,
            "imported_path": str(dest_path),
            "filename": dest_path.name,
            "imported_at": datetime.now().isoformat()
        }
        
        session_metadata["imported_files"].append(imported_info)
        
        with open(session_metadata_path, 'w', encoding='utf-8') as f:
            json.dump(session_metadata, f, indent=2)
        
        logger.info(f"Imported {file_type}: {dest_path.name}")
        return str(dest_path)
    
    def get_imported_files(self, session_id: str = None) -> List[Dict[str, Any]]:
        session_dir = self.get_session_dir(session_id)
        if session_dir is None:
            return []
        
        session_metadata_path = session_dir / "session.json"
        with open(session_metadata_path, 'r', encoding='utf-8') as f:
            session_metadata = json.load(f)
        
        return session_metadata.get("imported_files", [])
    
    def save_analysis_result(self, result: Dict[str, Any], session_id: str = None) -> str:
        session_dir = self.get_session_dir(session_id)
        if session_dir is None:
            raise RuntimeError("No active session")
        
        analysis_dir = session_dir / "analysis"
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"analysis_{timestamp}.json"
        filepath = analysis_dir / filename
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(result, f, indent=2, default=str)
        
        session_metadata_path = session_dir / "session.json"
        with open(session_metadata_path, 'r', encoding='utf-8') as f:
            session_metadata = json.load(f)
        
        analysis_info = {
            "filename": filename,
            "path": str(filepath),
            "created_at": datetime.now().isoformat()
        }
        
        session_metadata["analysis_results"].append(analysis_info)
        
        with open(session_metadata_path, 'w', encoding='utf-8') as f:
            json.dump(session_metadata, f, indent=2)
        
        logger.info(f"Saved analysis result: {filename}")
        return str(filepath)
    
    def save_tuning_result(self, result: Dict[str, Any], session_id: str = None) -> str:
        session_dir = self.get_session_dir(session_id)
        if session_dir is None:
            raise RuntimeError("No active session")
        
        tuning_dir = session_dir / "tuning"
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"tuning_{timestamp}.json"
        filepath = tuning_dir / filename
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(result, f, indent=2, default=str)
        
        session_metadata_path = session_dir / "session.json"
        with open(session_metadata_path, 'r', encoding='utf-8') as f:
            session_metadata = json.load(f)
        
        tuning_info = {
            "filename": filename,
            "path": str(filepath),
            "created_at": datetime.now().isoformat()
        }
        
        session_metadata["tuning_results"].append(tuning_info)
        
        with open(session_metadata_path, 'w', encoding='utf-8') as f:
            json.dump(session_metadata, f, indent=2)
        
        logger.info(f"Saved tuning result: {filename}")
        return str(filepath)
    
    def save_comparison_result(self, result: Dict[str, Any], session_id: str = None) -> str:
        session_dir = self.get_session_dir(session_id)
        if session_dir is None:
            raise RuntimeError("No active session")
        
        comparisons_dir = session_dir / "comparisons"
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"comparison_{timestamp}.json"
        filepath = comparisons_dir / filename
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(result, f, indent=2, default=str)
        
        session_metadata_path = session_dir / "session.json"
        with open(session_metadata_path, 'r', encoding='utf-8') as f:
            session_metadata = json.load(f)
        
        comparison_info = {
            "filename": filename,
            "path": str(filepath),
            "created_at": datetime.now().isoformat()
        }
        
        session_metadata["comparisons"].append(comparison_info)
        
        with open(session_metadata_path, 'w', encoding='utf-8') as f:
            json.dump(session_metadata, f, indent=2)
        
        logger.info(f"Saved comparison result: {filename}")
        return str(filepath)
    
    def get_latest_analysis(self, session_id: str = None) -> Optional[Dict[str, Any]]:
        session_dir = self.get_session_dir(session_id)
        if session_dir is None:
            return None
        
        analysis_dir = session_dir / "analysis"
        if not analysis_dir.exists():
            return None
        
        json_files = sorted(analysis_dir.glob("analysis_*.json"), reverse=True)
        if not json_files:
            return None
        
        with open(json_files[0], 'r', encoding='utf-8') as f:
            return json.load(f)
    
    def get_latest_tuning(self, session_id: str = None) -> Optional[Dict[str, Any]]:
        session_dir = self.get_session_dir(session_id)
        if session_dir is None:
            return None
        
        tuning_dir = session_dir / "tuning"
        if not tuning_dir.exists():
            return None
        
        json_files = sorted(tuning_dir.glob("tuning_*.json"), reverse=True)
        if not json_files:
            return None
        
        with open(json_files[0], 'r', encoding='utf-8') as f:
            return json.load(f)
    
    def get_workspace_info(self) -> Dict[str, Any]:
        if not self.is_initialized():
            return {"initialized": False}
        
        with open(self._metadata_file, 'r', encoding='utf-8') as f:
            metadata = json.load(f)
        
        current_session = self.get_current_session()
        session_info = None
        
        if current_session:
            session_dir = self.get_session_dir(current_session)
            if session_dir:
                session_metadata_path = session_dir / "session.json"
                if session_metadata_path.exists():
                    with open(session_metadata_path, 'r', encoding='utf-8') as f:
                        session_info = json.load(f)
        
        return {
            "initialized": True,
            "workspace_dir": str(self.workspace_dir),
            "metadata": metadata,
            "current_session": current_session,
            "current_session_info": session_info
        }
