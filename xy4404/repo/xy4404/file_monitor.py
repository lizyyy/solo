import os
import time
import logging
from typing import Callable, Optional
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler, FileCreatedEvent, FileModifiedEvent
from config import Config

logger = logging.getLogger(__name__)

class MaterialFileHandler(FileSystemEventHandler):
    def __init__(self, on_new_file: Callable[[str], None]):
        self.on_new_file = on_new_file
        self._pending_files = set()
        self._last_modified = {}
    
    def on_created(self, event):
        if event.is_directory:
            return
        self._check_file(event.src_path)
    
    def on_modified(self, event):
        if event.is_directory:
            return
        self._check_file(event.src_path)
    
    def _check_file(self, file_path: str):
        if not self._is_valid_file(file_path):
            return
        
        file_name = os.path.basename(file_path)
        if file_name.startswith('.'):
            return
        
        current_time = time.time()
        self._last_modified[file_path] = current_time
        
        if file_path not in self._pending_files:
            self._pending_files.add(file_path)
            logger.info(f"检测到新文件: {file_name}")
    
    def _is_valid_file(self, file_path: str) -> bool:
        ext = os.path.splitext(file_path)[1].lower()
        return (ext in Config.AUDIO_EXTENSIONS or 
                ext in Config.TRANSCRIPT_EXTENSIONS or 
                ext in Config.LICENSE_EXTENSIONS)
    
    def process_pending_files(self):
        current_time = time.time()
        ready_files = []
        
        for file_path in list(self._pending_files):
            last_mod = self._last_modified.get(file_path, 0)
            if current_time - last_mod > 1.0:
                try:
                    if os.path.exists(file_path) and os.path.getsize(file_path) > 0:
                        ready_files.append(file_path)
                except (OSError, IOError):
                    continue
                
                self._pending_files.discard(file_path)
        
        for file_path in ready_files:
            try:
                self.on_new_file(file_path)
            except Exception as e:
                logger.error(f"处理文件时出错 {file_path}: {e}")

class FileMonitor:
    def __init__(self, folder_path: str = None, on_new_file: Callable[[str], None] = None):
        self.folder_path = folder_path or Config.MATERIALS_FOLDER
        self.on_new_file = on_new_file
        self.observer: Optional[Observer] = None
        self.event_handler: Optional[MaterialFileHandler] = None
        self._running = False
        
        self._ensure_folder_exists()
    
    def _ensure_folder_exists(self):
        if not os.path.exists(self.folder_path):
            os.makedirs(self.folder_path)
            logger.info(f"创建素材文件夹: {self.folder_path}")
    
    def set_on_new_file_callback(self, callback: Callable[[str], None]):
        self.on_new_file = callback
    
    def start(self):
        if self._running:
            return
        
        if not self.on_new_file:
            raise ValueError("必须先设置 on_new_file 回调函数")
        
        self.event_handler = MaterialFileHandler(self.on_new_file)
        self.observer = Observer()
        self.observer.schedule(self.event_handler, self.folder_path, recursive=False)
        self.observer.start()
        self._running = True
        
        logger.info(f"文件监听已启动: {self.folder_path}")
        self._scan_existing_files()
    
    def _scan_existing_files(self):
        logger.info("扫描现有文件...")
        for file_name in os.listdir(self.folder_path):
            if file_name.startswith('.'):
                continue
            
            file_path = os.path.join(self.folder_path, file_name)
            if os.path.isfile(file_path):
                ext = os.path.splitext(file_path)[1].lower()
                if (ext in Config.AUDIO_EXTENSIONS or 
                    ext in Config.TRANSCRIPT_EXTENSIONS or 
                    ext in Config.LICENSE_EXTENSIONS):
                    try:
                        self.on_new_file(file_path)
                    except Exception as e:
                        logger.error(f"处理现有文件时出错 {file_path}: {e}")
    
    def stop(self):
        if not self._running:
            return
        
        if self.observer:
            self.observer.stop()
            self.observer.join()
        
        self._running = False
        logger.info("文件监听已停止")
    
    def process_pending(self):
        if self.event_handler:
            self.event_handler.process_pending_files()
