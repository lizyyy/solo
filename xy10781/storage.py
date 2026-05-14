import json
import os
from datetime import datetime
from typing import Dict, List, Any, Optional

DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')

def ensure_data_dir():
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR)

def get_file_path(filename: str) -> str:
    ensure_data_dir()
    return os.path.join(DATA_DIR, filename)

def read_json(filename: str, default: Any = None) -> Any:
    file_path = get_file_path(filename)
    if not os.path.exists(file_path):
        return default if default is not None else {}
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError):
        return default if default is not None else {}

def write_json(filename: str, data: Any) -> None:
    file_path = get_file_path(filename)
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2, default=str)

def generate_id() -> str:
    return datetime.now().strftime('%Y%m%d%H%M%S%f')[:-3]

class Storage:
    @staticmethod
    def get_videos() -> Dict[str, Dict]:
        return read_json('videos.json', {})
    
    @staticmethod
    def save_video(video_id: str, video_data: Dict) -> None:
        videos = Storage.get_videos()
        videos[video_id] = video_data
        write_json('videos.json', videos)
    
    @staticmethod
    def delete_video(video_id: str) -> None:
        videos = Storage.get_videos()
        if video_id in videos:
            del videos[video_id]
            write_json('videos.json', videos)

    @staticmethod
    def get_bitrate_templates() -> Dict[str, Dict]:
        return read_json('bitrate_templates.json', {})
    
    @staticmethod
    def save_bitrate_template(template_id: str, template_data: Dict) -> None:
        templates = Storage.get_bitrate_templates()
        templates[template_id] = template_data
        write_json('bitrate_templates.json', templates)
    
    @staticmethod
    def delete_bitrate_template(template_id: str) -> None:
        templates = Storage.get_bitrate_templates()
        if template_id in templates:
            del templates[template_id]
            write_json('bitrate_templates.json', templates)

    @staticmethod
    def get_transcode_tasks() -> Dict[str, Dict]:
        return read_json('transcode_tasks.json', {})
    
    @staticmethod
    def save_transcode_task(task_id: str, task_data: Dict) -> None:
        tasks = Storage.get_transcode_tasks()
        tasks[task_id] = task_data
        write_json('transcode_tasks.json', tasks)
    
    @staticmethod
    def delete_transcode_task(task_id: str) -> None:
        tasks = Storage.get_transcode_tasks()
        if task_id in tasks:
            del tasks[task_id]
            write_json('transcode_tasks.json', tasks)

    @staticmethod
    def get_retry_records() -> Dict[str, Dict]:
        return read_json('retry_records.json', {})
    
    @staticmethod
    def save_retry_record(record_id: str, record_data: Dict) -> None:
        records = Storage.get_retry_records()
        records[record_id] = record_data
        write_json('retry_records.json', records)

    @staticmethod
    def get_playback_urls() -> Dict[str, Dict]:
        return read_json('playback_urls.json', {})
    
    @staticmethod
    def save_playback_url(url_id: str, url_data: Dict) -> None:
        urls = Storage.get_playback_urls()
        urls[url_id] = url_data
        write_json('playback_urls.json', urls)

    @staticmethod
    def get_subtitle_files() -> Dict[str, Dict]:
        return read_json('subtitle_files.json', {})
    
    @staticmethod
    def save_subtitle_file(subtitle_id: str, subtitle_data: Dict) -> None:
        subtitles = Storage.get_subtitle_files()
        subtitles[subtitle_id] = subtitle_data
        write_json('subtitle_files.json', subtitles)
    
    @staticmethod
    def delete_subtitle_file(subtitle_id: str) -> None:
        subtitles = Storage.get_subtitle_files()
        if subtitle_id in subtitles:
            del subtitles[subtitle_id]
            write_json('subtitle_files.json', subtitles)
