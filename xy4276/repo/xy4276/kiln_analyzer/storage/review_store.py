import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

from kiln_analyzer.models import ReviewNote, ReviewSession


class ReviewSessionStore:
    def __init__(self, storage_dir: Path):
        self.storage_dir = storage_dir
        self.storage_dir.mkdir(parents=True, exist_ok=True)
        self.sessions_dir = self.storage_dir / "sessions"
        self.sessions_dir.mkdir(parents=True, exist_ok=True)

    def create_session(
        self,
        batch_id: str,
        author: Optional[str] = None,
    ) -> ReviewSession:
        session_id = str(uuid.uuid4())[:8]
        now = datetime.now()

        session = ReviewSession(
            session_id=session_id,
            batch_id=batch_id,
            created_at=now,
            updated_at=now,
            reviewers=[author] if author else [],
            notes=[],
            conclusion=None,
            recommendations=[],
        )

        self._save_session(session)
        return session

    def get_session(self, session_id: str) -> Optional[ReviewSession]:
        session_file = self.sessions_dir / f"{session_id}.json"
        if not session_file.exists():
            return None

        try:
            with open(session_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            return self._dict_to_session(data)
        except Exception:
            return None

    def get_sessions_by_batch(self, batch_id: str) -> List[ReviewSession]:
        sessions: List[ReviewSession] = []

        for session_file in self.sessions_dir.glob("*.json"):
            try:
                with open(session_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                if data.get("batch_id") == batch_id:
                    sessions.append(self._dict_to_session(data))
            except Exception:
                continue

        sessions.sort(key=lambda s: s.created_at, reverse=True)
        return sessions

    def list_all_sessions(self) -> List[Dict[str, str]]:
        sessions_info: List[Dict[str, str]] = []

        for session_file in self.sessions_dir.glob("*.json"):
            try:
                with open(session_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                sessions_info.append(
                    {
                        "session_id": data.get("session_id", ""),
                        "batch_id": data.get("batch_id", ""),
                        "created_at": data.get("created_at", ""),
                        "updated_at": data.get("updated_at", ""),
                        "note_count": str(len(data.get("notes", []))),
                    }
                )
            except Exception:
                continue

        sessions_info.sort(key=lambda s: s["created_at"], reverse=True)
        return sessions_info

    def add_note(
        self,
        session_id: str,
        content: str,
        category: str = "观察",
        author: Optional[str] = None,
        related_layer: Optional[str] = None,
        related_phase: Optional[str] = None,
    ) -> Optional[ReviewNote]:
        session = self.get_session(session_id)
        if not session:
            return None

        note = ReviewNote(
            note_id=str(uuid.uuid4())[:6],
            created_at=datetime.now(),
            author=author,
            category=category,
            content=content,
            related_layer=related_layer,
            related_phase=related_phase,
        )

        session.notes.append(note)
        session.updated_at = datetime.now()

        if author and author not in session.reviewers:
            session.reviewers.append(author)

        self._save_session(session)
        return note

    def update_conclusion(
        self,
        session_id: str,
        conclusion: str,
        recommendations: Optional[List[str]] = None,
    ) -> bool:
        session = self.get_session(session_id)
        if not session:
            return False

        session.conclusion = conclusion
        session.updated_at = datetime.now()

        if recommendations:
            session.recommendations = recommendations

        self._save_session(session)
        return True

    def delete_session(self, session_id: str) -> bool:
        session_file = self.sessions_dir / f"{session_id}.json"
        if session_file.exists():
            session_file.unlink()
            return True
        return False

    def _save_session(self, session: ReviewSession) -> None:
        session_file = self.sessions_dir / f"{session.session_id}.json"
        data = self._session_to_dict(session)
        with open(session_file, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2, default=str)

    def _session_to_dict(self, session: ReviewSession) -> Dict:
        return {
            "session_id": session.session_id,
            "batch_id": session.batch_id,
            "created_at": session.created_at.isoformat(),
            "updated_at": session.updated_at.isoformat(),
            "reviewers": session.reviewers,
            "notes": [self._note_to_dict(n) for n in session.notes],
            "conclusion": session.conclusion,
            "recommendations": session.recommendations,
        }

    def _note_to_dict(self, note: ReviewNote) -> Dict:
        return {
            "note_id": note.note_id,
            "created_at": note.created_at.isoformat(),
            "author": note.author,
            "category": note.category,
            "content": note.content,
            "related_layer": note.related_layer,
            "related_phase": note.related_phase.value if note.related_phase else None,
            "attachments": note.attachments,
        }

    def _dict_to_session(self, data: Dict) -> ReviewSession:
        notes = [self._dict_to_note(n) for n in data.get("notes", [])]

        return ReviewSession(
            session_id=data["session_id"],
            batch_id=data["batch_id"],
            created_at=datetime.fromisoformat(data["created_at"]),
            updated_at=datetime.fromisoformat(data["updated_at"]),
            reviewers=data.get("reviewers", []),
            notes=notes,
            conclusion=data.get("conclusion"),
            recommendations=data.get("recommendations", []),
        )

    def _dict_to_note(self, data: Dict) -> ReviewNote:
        from kiln_analyzer.models import PhaseType

        related_phase = data.get("related_phase")
        if related_phase:
            try:
                related_phase = PhaseType(related_phase)
            except ValueError:
                related_phase = None

        return ReviewNote(
            note_id=data["note_id"],
            created_at=datetime.fromisoformat(data["created_at"]),
            author=data.get("author"),
            category=data.get("category", "观察"),
            content=data["content"],
            related_layer=data.get("related_layer"),
            related_phase=related_phase,
            attachments=data.get("attachments"),
        )
