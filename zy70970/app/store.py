from typing import Dict, List, Optional
from datetime import datetime
import uuid

from .models import (
    SprayJob, Pesticide, WeatherRecord, ValidationResult,
    ReviewRecord, ReconciliationSession, ReviewStatus
)


class DataStore:
    def __init__(self):
        self._pesticides: Dict[str, Pesticide] = {}
        self._weather_records: Dict[str, WeatherRecord] = {}
        self._spray_jobs: Dict[str, SprayJob] = {}
        self._validation_results: Dict[str, ValidationResult] = {}
        self._review_records: Dict[str, ReviewRecord] = {}
        self._sessions: Dict[str, ReconciliationSession] = {}

    def clear_all(self):
        self._pesticides.clear()
        self._weather_records.clear()
        self._spray_jobs.clear()
        self._validation_results.clear()
        self._review_records.clear()
        self._sessions.clear()

    def add_pesticides(self, pesticides: List[Pesticide]):
        for p in pesticides:
            self._pesticides[p.id] = p

    def get_pesticide(self, pesticide_id: str) -> Optional[Pesticide]:
        return self._pesticides.get(pesticide_id)

    def get_all_pesticides(self) -> List[Pesticide]:
        return list(self._pesticides.values())

    def add_weather_records(self, records: List[WeatherRecord]):
        for r in records:
            self._weather_records[r.id] = r

    def get_weather_by_date_area(self, date_str: str, area: str) -> Optional[WeatherRecord]:
        for r in self._weather_records.values():
            if str(r.date) == date_str and r.area == area:
                return r
        return None

    def get_all_weather_records(self) -> List[WeatherRecord]:
        return list(self._weather_records.values())

    def add_spray_jobs(self, jobs: List[SprayJob]):
        for j in jobs:
            self._spray_jobs[j.id] = j

    def get_spray_job(self, job_id: str) -> Optional[SprayJob]:
        return self._spray_jobs.get(job_id)

    def get_all_spray_jobs(self) -> List[SprayJob]:
        return list(self._spray_jobs.values())

    def update_spray_job(self, job_id: str, **kwargs) -> Optional[SprayJob]:
        if job_id in self._spray_jobs:
            job = self._spray_jobs[job_id]
            for key, value in kwargs.items():
                if hasattr(job, key):
                    setattr(job, key, value)
            return job
        return None

    def add_validation_result(self, result: ValidationResult):
        self._validation_results[result.job_id] = result

    def get_validation_result(self, job_id: str) -> Optional[ValidationResult]:
        return self._validation_results.get(job_id)

    def get_all_validation_results(self) -> List[ValidationResult]:
        return list(self._validation_results.values())

    def add_review_record(self, record: ReviewRecord):
        self._review_records[record.id] = record

    def get_review_record(self, record_id: str) -> Optional[ReviewRecord]:
        return self._review_records.get(record_id)

    def get_review_by_job_id(self, job_id: str) -> Optional[ReviewRecord]:
        for r in self._review_records.values():
            if r.job_id == job_id:
                return r
        return None

    def get_all_review_records(self) -> List[ReviewRecord]:
        return list(self._review_records.values())

    def create_session(self, name: str) -> ReconciliationSession:
        session_id = str(uuid.uuid4())
        session = ReconciliationSession(
            id=session_id,
            name=name,
            created_at=datetime.now(),
            status="active"
        )
        self._sessions[session_id] = session
        return session

    def get_session(self, session_id: str) -> Optional[ReconciliationSession]:
        return self._sessions.get(session_id)

    def get_job_review_status(self, job_id: str) -> ReviewStatus:
        review = self.get_review_by_job_id(job_id)
        if review:
            return review.status
        return ReviewStatus.PENDING


store = DataStore()
