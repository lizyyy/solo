import json
from typing import Optional
from config import DATABASE_FILE
from models import WindTunnelDatabase, ExperimentSession


class Storage:
    def __init__(self):
        self.db: WindTunnelDatabase = self._load()

    def _load(self) -> WindTunnelDatabase:
        if DATABASE_FILE.exists():
            with open(DATABASE_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                return WindTunnelDatabase(**data)
        return WindTunnelDatabase()

    def _save(self):
        with open(DATABASE_FILE, "w", encoding="utf-8") as f:
            json.dump(self.db.model_dump(mode="json"), f, ensure_ascii=False, indent=2)

    def create_session(self, session: ExperimentSession) -> ExperimentSession:
        self.db.sessions[session.id] = session
        self.db.current_session_id = session.id
        self._save()
        return session

    def get_session(self, session_id: str) -> Optional[ExperimentSession]:
        return self.db.sessions.get(session_id)

    def get_current_session(self) -> Optional[ExperimentSession]:
        if self.db.current_session_id:
            return self.db.sessions.get(self.db.current_session_id)
        return None

    def update_session(self, session: ExperimentSession):
        self.db.sessions[session.id] = session
        self._save()

    def list_sessions(self) -> list:
        return [
            {"id": s.id, "name": s.name, "date": s.date, "status": s.status}
            for s in self.db.sessions.values()
        ]

    def set_current_session(self, session_id: str):
        if session_id in self.db.sessions:
            self.db.current_session_id = session_id
            self._save()


storage = Storage()
