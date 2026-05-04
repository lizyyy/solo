import os
import json
import shutil
import subprocess
import threading
from pathlib import Path
from typing import List, Dict, Any, Optional, Callable
from datetime import datetime
from enum import Enum
from queue import Queue, Empty

from db.database import db_manager
from db.models import TaskQueue, TaskHistory
from utils.audio_utils import check_ffprobe_available


class TaskType(Enum):
    TRANSCODE = "transcode"
    ARCHIVE = "archive"
    COPY = "copy"
    CONVERT_FORMAT = "convert_format"


class TaskStatus(Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class TaskParameters:
    def __init__(self):
        self.target_format: str = "wav"
        self.target_sample_rate: Optional[int] = None
        self.target_channels: Optional[int] = None
        self.target_bit_rate: Optional[int] = None
        self.output_folder: Optional[str] = None
        self.keep_original: bool = True
        self.compress: bool = False
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "target_format": self.target_format,
            "target_sample_rate": self.target_sample_rate,
            "target_channels": self.target_channels,
            "target_bit_rate": self.target_bit_rate,
            "output_folder": self.output_folder,
            "keep_original": self.keep_original,
            "compress": self.compress,
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "TaskParameters":
        params = cls()
        params.target_format = data.get("target_format", "wav")
        params.target_sample_rate = data.get("target_sample_rate")
        params.target_channels = data.get("target_channels")
        params.target_bit_rate = data.get("target_bit_rate")
        params.output_folder = data.get("output_folder")
        params.keep_original = data.get("keep_original", True)
        params.compress = data.get("compress", False)
        return params


class TaskWorker(threading.Thread):
    def __init__(self, task_queue: Queue, 
                 progress_callback: Callable[[int, str, float], None] = None,
                 complete_callback: Callable[[int, bool, str], None] = None):
        super().__init__(daemon=True)
        self._task_queue = task_queue
        self._progress_callback = progress_callback
        self._complete_callback = complete_callback
        self._running = True
        self._ffmpeg_available = self._check_ffmpeg_available()
    
    def _check_ffmpeg_available(self) -> bool:
        try:
            result = subprocess.run(
                ["ffmpeg", "-version"],
                capture_output=True,
                text=True,
                timeout=5
            )
            return result.returncode == 0
        except (FileNotFoundError, subprocess.TimeoutExpired):
            return False
    
    def run(self):
        while self._running:
            try:
                task_id = self._task_queue.get(timeout=1)
                self._process_task(task_id)
                self._task_queue.task_done()
            except Empty:
                continue
            except Exception as e:
                print(f"任务处理异常: {e}")
    
    def stop(self):
        self._running = False
    
    def _process_task(self, task_id: int):
        db_manager.update_task_status(task_id, TaskStatus.RUNNING.value, started_at=datetime.now())
        
        with db_manager.get_session() as session:
            task = session.query(TaskQueue).filter_by(id=task_id).first()
            if not task:
                self._record_history(task_id, "unknown", TaskStatus.FAILED.value, error_message="任务不存在")
                return
            
            task_type = task.task_type
            audio_file_id = task.audio_file_id
            parameters = {}
            
            if task.parameters:
                try:
                    parameters = json.loads(task.parameters)
                except json.JSONDecodeError:
                    pass
            
            params = TaskParameters.from_dict(parameters)
            
            audio_file = None
            if audio_file_id:
                from db.models import AudioFile
                audio_file = session.query(AudioFile).filter_by(id=audio_file_id).first()
            
            try:
                success = False
                error_message = None
                duration_seconds = 0.0
                source_file = audio_file.file_path if audio_file else None
                target_file = None
                
                start_time = datetime.now()
                
                if task_type == TaskType.TRANSCODE.value:
                    success, target_file, error_message = self._transcode_file(source_file, params)
                elif task_type == TaskType.ARCHIVE.value:
                    success, target_file, error_message = self._archive_file(source_file, params)
                elif task_type == TaskType.COPY.value:
                    success, target_file, error_message = self._copy_file(source_file, params)
                elif task_type == TaskType.CONVERT_FORMAT.value:
                    success, target_file, error_message = self._convert_format(source_file, params)
                
                end_time = datetime.now()
                duration_seconds = (end_time - start_time).total_seconds()
                
                if success:
                    db_manager.update_task_status(task_id, TaskStatus.COMPLETED.value, completed_at=datetime.now())
                    self._record_history(task.project_id, task_type, TaskStatus.COMPLETED.value,
                                        source_file, target_file, duration_seconds)
                    
                    if self._complete_callback:
                        self._complete_callback(task_id, True, "")
                else:
                    db_manager.update_task_status(task_id, TaskStatus.FAILED.value)
                    self._record_history(task.project_id, task_type, TaskStatus.FAILED.value,
                                        source_file, target_file, duration_seconds, error_message or "未知错误")
                    
                    if self._complete_callback:
                        self._complete_callback(task_id, False, error_message or "未知错误")
                    
            except Exception as e:
                error_message = str(e)
                db_manager.update_task_status(task_id, TaskStatus.FAILED.value)
                self._record_history(task.project_id, task_type, TaskStatus.FAILED.value,
                                    source_file, None, 0, error_message)
                
                if self._complete_callback:
                    self._complete_callback(task_id, False, error_message)
    
    def _transcode_file(self, source_file: str, params: TaskParameters) -> tuple:
        if not source_file or not os.path.exists(source_file):
            return False, None, "源文件不存在"
        
        if not self._ffmpeg_available:
            return False, None, "ffmpeg 未安装，无法进行转码"
        
        source_path = Path(source_file)
        output_folder = params.output_folder or str(source_path.parent)
        output_name = f"{source_path.stem}.{params.target_format}"
        target_file = str(Path(output_folder) / output_name)
        
        Path(output_folder).mkdir(parents=True, exist_ok=True)
        
        cmd = ["ffmpeg", "-i", source_file, "-y"]
        
        if params.target_sample_rate:
            cmd.extend(["-ar", str(params.target_sample_rate)])
        
        if params.target_channels:
            cmd.extend(["-ac", str(params.target_channels)])
        
        if params.target_bit_rate:
            cmd.extend(["-b:a", f"{params.target_bit_rate}k"])
        
        cmd.append(target_file)
        
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=300
            )
            
            if result.returncode == 0:
                return True, target_file, None
            else:
                return False, None, result.stderr or "转码失败"
                
        except subprocess.TimeoutExpired:
            return False, None, "转码超时"
        except Exception as e:
            return False, None, str(e)
    
    def _archive_file(self, source_file: str, params: TaskParameters) -> tuple:
        if not source_file or not os.path.exists(source_file):
            return False, None, "源文件不存在"
        
        source_path = Path(source_file)
        output_folder = params.output_folder or str(source_path.parent / "archive")
        target_file = str(Path(output_folder) / source_path.name)
        
        Path(output_folder).mkdir(parents=True, exist_ok=True)
        
        try:
            if params.keep_original:
                shutil.copy2(source_file, target_file)
            else:
                shutil.move(source_file, target_file)
            
            return True, target_file, None
        except Exception as e:
            return False, None, str(e)
    
    def _copy_file(self, source_file: str, params: TaskParameters) -> tuple:
        if not source_file or not os.path.exists(source_file):
            return False, None, "源文件不存在"
        
        source_path = Path(source_file)
        output_folder = params.output_folder
        if not output_folder:
            return False, None, "未指定输出文件夹"
        
        target_file = str(Path(output_folder) / source_path.name)
        
        Path(output_folder).mkdir(parents=True, exist_ok=True)
        
        try:
            shutil.copy2(source_file, target_file)
            return True, target_file, None
        except Exception as e:
            return False, None, str(e)
    
    def _convert_format(self, source_file: str, params: TaskParameters) -> tuple:
        return self._transcode_file(source_file, params)
    
    def _record_history(self, project_id: int, task_type: str, status: str,
                        source_file: str = None, target_file: str = None,
                        duration_seconds: float = 0, error_message: str = None):
        db_manager.create_task_history(
            project_id=project_id,
            task_type=task_type,
            source_file=source_file,
            target_file=target_file,
            status=status,
            duration_seconds=duration_seconds,
            error_message=error_message
        )


class TaskManager:
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        self._task_queue = Queue()
        self._worker: Optional[TaskWorker] = None
        self._progress_callback = None
        self._complete_callback = None
    
    def set_callbacks(self, progress_callback: Callable = None, complete_callback: Callable = None):
        self._progress_callback = progress_callback
        self._complete_callback = complete_callback
    
    def start_worker(self):
        if self._worker and self._worker.is_alive():
            return
        
        self._worker = TaskWorker(
            self._task_queue,
            self._progress_callback,
            self._complete_callback
        )
        self._worker.start()
    
    def stop_worker(self):
        if self._worker:
            self._worker.stop()
            self._worker.join(timeout=5)
            self._worker = None
    
    def add_transcode_task(self, project_id: int, audio_file_id: int,
                           target_format: str = "wav",
                           target_sample_rate: int = None,
                           target_channels: int = None,
                           output_folder: str = None,
                           priority: int = 0) -> Optional[int]:
        params = TaskParameters()
        params.target_format = target_format
        params.target_sample_rate = target_sample_rate
        params.target_channels = target_channels
        params.output_folder = output_folder
        
        task = db_manager.create_task(
            project_id=project_id,
            audio_file_id=audio_file_id,
            task_type=TaskType.TRANSCODE.value,
            parameters=json.dumps(params.to_dict()),
            priority=priority
        )
        
        if task:
            self._task_queue.put(task.id)
            self.start_worker()
            return task.id
        
        return None
    
    def add_archive_task(self, project_id: int, audio_file_id: int,
                         output_folder: str = None,
                         keep_original: bool = True,
                         priority: int = 0) -> Optional[int]:
        params = TaskParameters()
        params.output_folder = output_folder
        params.keep_original = keep_original
        
        task = db_manager.create_task(
            project_id=project_id,
            audio_file_id=audio_file_id,
            task_type=TaskType.ARCHIVE.value,
            parameters=json.dumps(params.to_dict()),
            priority=priority
        )
        
        if task:
            self._task_queue.put(task.id)
            self.start_worker()
            return task.id
        
        return None
    
    def add_copy_task(self, project_id: int, audio_file_id: int,
                      output_folder: str,
                      priority: int = 0) -> Optional[int]:
        params = TaskParameters()
        params.output_folder = output_folder
        
        task = db_manager.create_task(
            project_id=project_id,
            audio_file_id=audio_file_id,
            task_type=TaskType.COPY.value,
            parameters=json.dumps(params.to_dict()),
            priority=priority
        )
        
        if task:
            self._task_queue.put(task.id)
            self.start_worker()
            return task.id
        
        return None
    
    def get_pending_tasks(self, project_id: int = None) -> List[TaskQueue]:
        return db_manager.get_pending_tasks(project_id)
    
    def get_task_history(self, project_id: int, limit: int = 50) -> List[TaskHistory]:
        return db_manager.get_task_history(project_id, limit)
    
    def is_ffmpeg_available(self) -> bool:
        return check_ffprobe_available()


task_manager = TaskManager()
