import os
import sqlite3
from pathlib import Path
from typing import Optional, List
from datetime import datetime

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

from db.models import Base, Project, Episode, AudioFile, ValidationIssue, TaskQueue, TaskHistory


class DatabaseManager:
    _instance = None
    _session = None
    _engine = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        if self._engine is None:
            self._db_path = None
            self._session_local = None
    
    def init_database(self, db_path: str) -> bool:
        try:
            self._db_path = db_path
            db_dir = Path(db_path).parent
            db_dir.mkdir(parents=True, exist_ok=True)
            
            self._engine = create_engine(f"sqlite:///{db_path}", echo=False)
            Base.metadata.create_all(self._engine)
            self._session_local = sessionmaker(autocommit=False, autoflush=False, bind=self._engine)
            
            return True
        except Exception as e:
            print(f"数据库初始化失败: {e}")
            return False
    
    def get_session(self) -> Session:
        if self._session_local is None:
            raise RuntimeError("数据库未初始化，请先调用 init_database()")
        return self._session_local()
    
    def close(self):
        if self._engine:
            self._engine.dispose()
    
    def create_project(self, name: str, folder_path: str) -> Optional[Project]:
        with self.get_session() as session:
            try:
                existing = session.query(Project).filter_by(folder_path=folder_path).first()
                if existing:
                    return existing
                
                project = Project(name=name, folder_path=folder_path)
                session.add(project)
                session.commit()
                session.refresh(project)
                return project
            except Exception as e:
                session.rollback()
                print(f"创建项目失败: {e}")
                return None
    
    def get_project_by_id(self, project_id: int) -> Optional[Project]:
        with self.get_session() as session:
            return session.query(Project).filter_by(id=project_id).first()
    
    def get_project_by_path(self, folder_path: str) -> Optional[Project]:
        with self.get_session() as session:
            return session.query(Project).filter_by(folder_path=folder_path).first()
    
    def get_all_projects(self) -> List[Project]:
        with self.get_session() as session:
            return session.query(Project).order_by(Project.updated_at.desc()).all()
    
    def create_episode(self, project_id: int, episode_number: str, title: str = None) -> Optional[Episode]:
        with self.get_session() as session:
            try:
                episode = Episode(
                    project_id=project_id,
                    episode_number=episode_number,
                    title=title
                )
                session.add(episode)
                session.commit()
                session.refresh(episode)
                return episode
            except Exception as e:
                session.rollback()
                print(f"创建集数失败: {e}")
                return None
    
    def get_episodes_by_project(self, project_id: int) -> List[Episode]:
        with self.get_session() as session:
            return session.query(Episode).filter_by(project_id=project_id).order_by(Episode.episode_number).all()
    
    def create_audio_file(self, audio_data: dict) -> Optional[AudioFile]:
        with self.get_session() as session:
            try:
                existing = session.query(AudioFile).filter_by(file_path=audio_data.get("file_path")).first()
                if existing:
                    for key, value in audio_data.items():
                        if hasattr(existing, key) and value is not None:
                            setattr(existing, key, value)
                    session.commit()
                    session.refresh(existing)
                    return existing
                
                audio_file = AudioFile(**audio_data)
                session.add(audio_file)
                session.commit()
                session.refresh(audio_file)
                return audio_file
            except Exception as e:
                session.rollback()
                print(f"创建音频文件记录失败: {e}")
                return None
    
    def get_audio_files_by_project(self, project_id: int) -> List[AudioFile]:
        with self.get_session() as session:
            return session.query(AudioFile).filter_by(project_id=project_id).all()
    
    def get_audio_file_by_path(self, file_path: str) -> Optional[AudioFile]:
        with self.get_session() as session:
            return session.query(AudioFile).filter_by(file_path=file_path).first()
    
    def update_audio_file(self, audio_file_id: int, updates: dict) -> bool:
        with self.get_session() as session:
            try:
                audio_file = session.query(AudioFile).filter_by(id=audio_file_id).first()
                if not audio_file:
                    return False
                
                for key, value in updates.items():
                    if hasattr(audio_file, key):
                        setattr(audio_file, key, value)
                
                session.commit()
                return True
            except Exception as e:
                session.rollback()
                print(f"更新音频文件失败: {e}")
                return False
    
    def create_validation_issue(self, audio_file_id: int, issue_type: str, 
                                  description: str, severity: str = "warning") -> Optional[ValidationIssue]:
        with self.get_session() as session:
            try:
                issue = ValidationIssue(
                    audio_file_id=audio_file_id,
                    issue_type=issue_type,
                    severity=severity,
                    description=description
                )
                session.add(issue)
                session.commit()
                session.refresh(issue)
                return issue
            except Exception as e:
                session.rollback()
                print(f"创建校验问题失败: {e}")
                return None
    
    def get_issues_by_project(self, project_id: int) -> List[ValidationIssue]:
        with self.get_session() as session:
            return session.query(ValidationIssue).join(AudioFile).filter(
                AudioFile.project_id == project_id
            ).all()
    
    def get_issues_by_audio_file(self, audio_file_id: int) -> List[ValidationIssue]:
        with self.get_session() as session:
            return session.query(ValidationIssue).filter_by(audio_file_id=audio_file_id).all()
    
    def clear_issues_for_project(self, project_id: int) -> bool:
        with self.get_session() as session:
            try:
                session.query(ValidationIssue).join(AudioFile).filter(
                    AudioFile.project_id == project_id
                ).delete(synchronize_session=False)
                session.commit()
                return True
            except Exception as e:
                session.rollback()
                print(f"清除校验问题失败: {e}")
                return False
    
    def create_task(self, project_id: int, task_type: str, audio_file_id: int = None,
                    parameters: str = None, priority: int = 0) -> Optional[TaskQueue]:
        with self.get_session() as session:
            try:
                task = TaskQueue(
                    project_id=project_id,
                    audio_file_id=audio_file_id,
                    task_type=task_type,
                    parameters=parameters,
                    priority=priority
                )
                session.add(task)
                session.commit()
                session.refresh(task)
                return task
            except Exception as e:
                session.rollback()
                print(f"创建任务失败: {e}")
                return None
    
    def get_pending_tasks(self, project_id: int = None) -> List[TaskQueue]:
        with self.get_session() as session:
            query = session.query(TaskQueue).filter_by(status="pending")
            if project_id:
                query = query.filter_by(project_id=project_id)
            return query.order_by(TaskQueue.priority.desc(), TaskQueue.created_at).all()
    
    def update_task_status(self, task_id: int, status: str, started_at: datetime = None,
                            completed_at: datetime = None) -> bool:
        with self.get_session() as session:
            try:
                task = session.query(TaskQueue).filter_by(id=task_id).first()
                if not task:
                    return False
                
                task.status = status
                if started_at:
                    task.started_at = started_at
                if completed_at:
                    task.completed_at = completed_at
                
                session.commit()
                return True
            except Exception as e:
                session.rollback()
                print(f"更新任务状态失败: {e}")
                return False
    
    def create_task_history(self, project_id: int, task_type: str, source_file: str = None,
                            target_file: str = None, status: str = "completed", 
                            duration_seconds: float = None, error_message: str = None) -> Optional[TaskHistory]:
        with self.get_session() as session:
            try:
                history = TaskHistory(
                    project_id=project_id,
                    task_type=task_type,
                    source_file=source_file,
                    target_file=target_file,
                    status=status,
                    duration_seconds=duration_seconds,
                    error_message=error_message
                )
                session.add(history)
                session.commit()
                session.refresh(history)
                return history
            except Exception as e:
                session.rollback()
                print(f"创建任务历史失败: {e}")
                return None
    
    def get_task_history(self, project_id: int, limit: int = 50) -> List[TaskHistory]:
        with self.get_session() as session:
            return session.query(TaskHistory).filter_by(project_id=project_id).order_by(
                TaskHistory.created_at.desc()
            ).limit(limit).all()


db_manager = DatabaseManager()
