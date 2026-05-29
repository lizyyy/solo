import json
import os
from datetime import datetime
from typing import Dict, List, Optional

from .models import StudentProfile, load_json, save_json, _gen_id, _now_iso


class ProfileManager:
    def __init__(self, output_dir: str):
        self.profiles_dir = os.path.join(output_dir, "profiles")
        os.makedirs(self.profiles_dir, exist_ok=True)

    def _profile_path(self, student_id: str) -> str:
        return os.path.join(self.profiles_dir, f"{student_id}.json")

    def create_or_update(
        self,
        student_id: str,
        student_name: Optional[str] = None,
        age: Optional[int] = None,
        level: Optional[str] = None,
        session_id: Optional[str] = None,
    ) -> StudentProfile:
        path = self._profile_path(student_id)
        if os.path.exists(path):
            data = load_json(path)
            profile = StudentProfile.from_dict(data)
            if student_name is not None:
                profile.student_name = student_name
            if age is not None:
                profile.age = age
            if level is not None:
                profile.level = level
            if session_id and session_id not in profile.session_ids:
                profile.session_ids.append(session_id)
        else:
            profile = StudentProfile(
                student_id=student_id,
                student_name=student_name or "",
                age=age,
                level=level,
                session_ids=[session_id] if session_id else [],
            )
        save_json(profile.to_dict(masked=False), path)
        return profile

    def get(self, student_id: str) -> Optional[StudentProfile]:
        path = self._profile_path(student_id)
        if not os.path.exists(path):
            return None
        data = load_json(path)
        return StudentProfile.from_dict(data)

    def add_session(self, student_id: str, session_id: str) -> bool:
        profile = self.get(student_id)
        if profile is None:
            return False
        if session_id not in profile.session_ids:
            profile.session_ids.append(session_id)
            save_json(profile.to_dict(masked=False), self._profile_path(student_id))
        return True

    def list_profiles(self) -> List[Dict]:
        results = []
        if not os.path.exists(self.profiles_dir):
            return results
        for fname in sorted(os.listdir(self.profiles_dir)):
            if fname.endswith(".json"):
                data = load_json(os.path.join(self.profiles_dir, fname))
                results.append(data)
        return results

    def get_history(self, student_id: str, sessions_dir: str) -> List[Dict]:
        profile = self.get(student_id)
        if profile is None:
            return []
        history = []
        for session_id in profile.session_ids:
            session_meta = os.path.join(sessions_dir, session_id, "metadata.json")
            if os.path.exists(session_meta):
                history.append(load_json(session_meta))
        return history
