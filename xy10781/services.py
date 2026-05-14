from datetime import datetime
from typing import Dict, List, Optional, Tuple
from storage import Storage, generate_id


class VideoService:
    @staticmethod
    def create_video(name: str, size: int, duration: int, format: str,
                     has_subtitle: bool = False, subtitle_languages: List[str] = None,
                     created_by: str = "客服主管") -> Dict:
        video_id = f"vid_{generate_id()}"
        video_data = {
            "id": video_id,
            "name": name,
            "size": size,
            "duration": duration,
            "format": format,
            "status": "pending",
            "has_subtitle": has_subtitle,
            "subtitle_languages": subtitle_languages or [],
            "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "created_by": created_by
        }
        Storage.save_video(video_id, video_data)
        return video_data

    @staticmethod
    def get_all_videos() -> List[Dict]:
        return list(Storage.get_videos().values())

    @staticmethod
    def get_video(video_id: str) -> Optional[Dict]:
        return Storage.get_videos().get(video_id)

    @staticmethod
    def update_video_status(video_id: str, status: str) -> bool:
        video = VideoService.get_video(video_id)
        if video:
            video["status"] = status
            Storage.save_video(video_id, video)
            return True
        return False


class BitrateTemplateService:
    @staticmethod
    def create_template(name: str, bitrate: int, resolution: str,
                        require_subtitle: bool = False, subtitle_languages: List[str] = None) -> Dict:
        template_id = f"tpl_{generate_id()}"
        template_data = {
            "id": template_id,
            "name": name,
            "bitrate": bitrate,
            "resolution": resolution,
            "require_subtitle": require_subtitle,
            "subtitle_languages": subtitle_languages or [],
            "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        Storage.save_bitrate_template(template_id, template_data)
        BitrateTemplateService.recalculate_related_tasks(template_id)
        return template_data

    @staticmethod
    def get_all_templates() -> List[Dict]:
        return list(Storage.get_bitrate_templates().values())

    @staticmethod
    def get_template(template_id: str) -> Optional[Dict]:
        return Storage.get_bitrate_templates().get(template_id)

    @staticmethod
    def update_template(template_id: str, **kwargs) -> bool:
        template = BitrateTemplateService.get_template(template_id)
        if template:
            template.update(kwargs)
            Storage.save_bitrate_template(template_id, template)
            BitrateTemplateService.recalculate_related_tasks(template_id)
            return True
        return False

    @staticmethod
    def recalculate_related_tasks(template_id: str) -> None:
        template = BitrateTemplateService.get_template(template_id)
        if not template:
            return
        
        tasks = Storage.get_transcode_tasks()
        for task_id, task in tasks.items():
            if task.get("template_id") == template_id:
                video = VideoService.get_video(task.get("video_id"))
                if video and template.get("require_subtitle"):
                    has_required_subs = all(
                        lang in video.get("subtitle_languages", [])
                        for lang in template.get("subtitle_languages", [])
                    )
                    if not has_required_subs and task.get("status") in ["queued", "pending"]:
                        task["status"] = "blocked"
                        task["block_reason"] = f"缺少字幕语言: {template.get('subtitle_languages', [])}"
                        Storage.save_transcode_task(task_id, task)

    @staticmethod
    def check_subtitle_requirement(template_id: str, video_id: str) -> Tuple[bool, str]:
        template = BitrateTemplateService.get_template(template_id)
        video = VideoService.get_video(video_id)
        
        if not template or not video:
            return False, "模板或视频不存在"
        
        if not template.get("require_subtitle"):
            return True, "该模板不需要字幕"
        
        required_langs = set(template.get("subtitle_languages", []))
        video_langs = set(video.get("subtitle_languages", []))
        
        if not required_langs:
            return True, "未指定字幕语言要求"
        
        missing_langs = required_langs - video_langs
        if missing_langs:
            return False, f"缺少字幕语言: {', '.join(missing_langs)}"
        
        return True, "字幕要求满足"


class TranscodeTaskService:
    @staticmethod
    def create_task(video_id: str, template_id: str) -> Dict:
        template_ok, msg = BitrateTemplateService.check_subtitle_requirement(template_id, video_id)
        if not template_ok and "不需要" not in msg:
            return {"error": True, "message": msg}
        
        task_id = f"task_{generate_id()}"
        task_data = {
            "id": task_id,
            "video_id": video_id,
            "template_id": template_id,
            "status": "queued",
            "progress": 0,
            "output_path": None,
            "started_at": None,
            "completed_at": None,
            "error_message": None,
            "retry_count": 0
        }
        Storage.save_transcode_task(task_id, task_data)
        return task_data

    @staticmethod
    def get_all_tasks() -> List[Dict]:
        return list(Storage.get_transcode_tasks().values())

    @staticmethod
    def get_task(task_id: str) -> Optional[Dict]:
        return Storage.get_transcode_tasks().get(task_id)

    @staticmethod
    def start_task(task_id: str) -> bool:
        task = TranscodeTaskService.get_task(task_id)
        if task and task["status"] in ["queued", "pending"]:
            task["status"] = "processing"
            task["started_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            Storage.save_transcode_task(task_id, task)
            return True
        return False

    @staticmethod
    def complete_task(task_id: str, output_path: str) -> bool:
        task = TranscodeTaskService.get_task(task_id)
        if task and task["status"] == "processing":
            task["status"] = "completed"
            task["progress"] = 100
            task["output_path"] = output_path
            task["completed_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            Storage.save_transcode_task(task_id, task)
            PlaybackService.generate_playback_url(task_id)
            return True
        return False

    @staticmethod
    def fail_task(task_id: str, error_message: str) -> bool:
        task = TranscodeTaskService.get_task(task_id)
        if task:
            task["status"] = "failed"
            task["error_message"] = error_message
            Storage.save_transcode_task(task_id, task)
            return True
        return False

    @staticmethod
    def retry_task(task_id: str, reason: str, operator: str = "技术支持") -> Dict:
        task = TranscodeTaskService.get_task(task_id)
        if not task or task["status"] != "failed":
            return {"error": True, "message": "只有失败的任务可以重试"}
        
        retry_id = f"retry_{generate_id()}"
        retry_record = {
            "id": retry_id,
            "task_id": task_id,
            "reason": reason,
            "operator": operator,
            "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "status": "pending"
        }
        Storage.save_retry_record(retry_id, retry_record)
        
        task["status"] = "queued"
        task["error_message"] = None
        task["progress"] = 0
        task["retry_count"] = task.get("retry_count", 0) + 1
        task["started_at"] = None
        task["completed_at"] = None
        Storage.save_transcode_task(task_id, task)
        
        return {"task": task, "retry_record": retry_record}

    @staticmethod
    def get_failed_tasks() -> List[Dict]:
        return [task for task in TranscodeTaskService.get_all_tasks() if task["status"] == "failed"]


class PlaybackService:
    @staticmethod
    def generate_playback_url(task_id: str) -> Optional[Dict]:
        task = TranscodeTaskService.get_task(task_id)
        if not task or task["status"] != "completed":
            return None
        
        template = BitrateTemplateService.get_template(task["template_id"])
        quality = template.get("resolution", "unknown").split("x")[-1] if template else "unknown"
        
        url_id = f"url_{generate_id()}"
        url_data = {
            "id": url_id,
            "task_id": task_id,
            "url": f"https://cdn.example.com/videos/{task_id}/playlist.m3u8",
            "quality": f"{quality}p",
            "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        Storage.save_playback_url(url_id, url_data)
        return url_data

    @staticmethod
    def get_all_urls() -> List[Dict]:
        return list(Storage.get_playback_urls().values())

    @staticmethod
    def get_urls_by_task(task_id: str) -> List[Dict]:
        return [url for url in PlaybackService.get_all_urls() if url["task_id"] == task_id]


class SubtitleService:
    @staticmethod
    def create_subtitle(video_id: str, language: str, name: str) -> Dict:
        subtitle_id = f"sub_{generate_id()}"
        subtitle_data = {
            "id": subtitle_id,
            "video_id": video_id,
            "language": language,
            "name": name,
            "status": "pending",
            "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        Storage.save_subtitle_file(subtitle_id, subtitle_data)
        return subtitle_data

    @staticmethod
    def get_all_subtitles() -> List[Dict]:
        return list(Storage.get_subtitle_files().values())

    @staticmethod
    def get_subtitles_by_video(video_id: str) -> List[Dict]:
        return [sub for sub in SubtitleService.get_all_subtitles() if sub["video_id"] == video_id]

    @staticmethod
    def approve_subtitle(subtitle_id: str) -> bool:
        subtitles = Storage.get_subtitle_files()
        if subtitle_id in subtitles:
            subtitles[subtitle_id]["status"] = "approved"
            Storage.save_subtitle_file(subtitle_id, subtitles[subtitle_id])
            
            video_id = subtitles[subtitle_id]["video_id"]
            video = VideoService.get_video(video_id)
            if video:
                langs = set(video.get("subtitle_languages", []))
                langs.add(subtitles[subtitle_id]["language"])
                video["subtitle_languages"] = list(langs)
                video["has_subtitle"] = True
                Storage.save_video(video_id, video)
            
            return True
        return False


class StatisticsService:
    @staticmethod
    def get_statistics() -> Dict:
        tasks = TranscodeTaskService.get_all_tasks()
        videos = VideoService.get_all_videos()
        
        status_counts = {"queued": 0, "processing": 0, "completed": 0, "failed": 0, "blocked": 0}
        for task in tasks:
            status = task.get("status", "unknown")
            if status in status_counts:
                status_counts[status] += 1
        
        total_retry_count = sum(task.get("retry_count", 0) for task in tasks)
        playback_count = len(PlaybackService.get_all_urls())
        
        return {
            "total_videos": len(videos),
            "total_tasks": len(tasks),
            "status_counts": status_counts,
            "total_retry_count": total_retry_count,
            "playback_count": playback_count,
            "success_rate": round(status_counts["completed"] / len(tasks) * 100, 2) if tasks else 0
        }

    @staticmethod
    def get_daily_stats() -> List[Dict]:
        tasks = TranscodeTaskService.get_all_tasks()
        daily_data = {}
        
        for task in tasks:
            date_key = task.get("started_at", "").split()[0] if task.get("started_at") else "unknown"
            if date_key not in daily_data:
                daily_data[date_key] = {"date": date_key, "completed": 0, "failed": 0, "total": 0}
            daily_data[date_key]["total"] += 1
            if task["status"] == "completed":
                daily_data[date_key]["completed"] += 1
            elif task["status"] == "failed":
                daily_data[date_key]["failed"] += 1
        
        return sorted(daily_data.values(), key=lambda x: x["date"])


class InitializationService:
    @staticmethod
    def initialize_from_sample() -> bool:
        import json
        import os
        
        init_file = os.path.join(os.path.dirname(__file__), 'data', 'init_data.json')
        if not os.path.exists(init_file):
            return False
        
        try:
            with open(init_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            for key, value in data.get("bitrate_templates", {}).items():
                Storage.save_bitrate_template(key, value)
            
            for key, value in data.get("videos", {}).items():
                Storage.save_video(key, value)
            
            for key, value in data.get("subtitle_files", {}).items():
                Storage.save_subtitle_file(key, value)
            
            for key, value in data.get("transcode_tasks", {}).items():
                Storage.save_transcode_task(key, value)
            
            for key, value in data.get("retry_records", {}).items():
                Storage.save_retry_record(key, value)
            
            for key, value in data.get("playback_urls", {}).items():
                Storage.save_playback_url(key, value)
            
            return True
        except Exception:
            return False

    @staticmethod
    def clear_all_data() -> None:
        Storage.write_json('videos.json', {})
        Storage.write_json('bitrate_templates.json', {})
        Storage.write_json('transcode_tasks.json', {})
        Storage.write_json('retry_records.json', {})
        Storage.write_json('playback_urls.json', {})
        Storage.write_json('subtitle_files.json', {})
