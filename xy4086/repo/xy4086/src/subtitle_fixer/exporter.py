from datetime import datetime
from typing import List, Optional, Dict, Any
from dataclasses import asdict
import json
import os

from .models import SubtitleItem, Speaker, Chapter
from .utils import timedelta_to_srt_time


class Exporter:
    def __init__(self):
        pass
    
    def export_srt(
        self,
        subtitles: List[SubtitleItem],
        output_path: str,
        include_speaker: bool = True,
        speaker_prefix: str = "【{speaker}】"
    ) -> str:
        lines = []
        
        for sub in subtitles:
            lines.append(str(sub.index))
            
            start_str = timedelta_to_srt_time(sub.start_time)
            end_str = timedelta_to_srt_time(sub.end_time)
            lines.append(f"{start_str} --> {end_str}")
            
            text = sub.text
            if include_speaker and sub.speaker:
                prefix = speaker_prefix.format(speaker=sub.speaker)
                if not text.startswith(prefix):
                    text = prefix + text
            
            lines.append(text)
            lines.append("")
        
        content = "\n".join(lines)
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(content)
        
        return output_path
    
    def export_srt_to_string(
        self,
        subtitles: List[SubtitleItem],
        include_speaker: bool = True,
        speaker_prefix: str = "【{speaker}】"
    ) -> str:
        lines = []
        
        for sub in subtitles:
            lines.append(str(sub.index))
            
            start_str = timedelta_to_srt_time(sub.start_time)
            end_str = timedelta_to_srt_time(sub.end_time)
            lines.append(f"{start_str} --> {end_str}")
            
            text = sub.text
            if include_speaker and sub.speaker:
                prefix = speaker_prefix.format(speaker=sub.speaker)
                if not text.startswith(prefix):
                    text = prefix + text
            
            lines.append(text)
            lines.append("")
        
        return "\n".join(lines)
    
    def export_markdown_chapters(
        self,
        chapters: List[Chapter],
        output_path: str,
        title: str = "章节大纲",
        include_speaker: bool = True
    ) -> str:
        lines = []
        
        lines.append(f"# {title}")
        lines.append("")
        lines.append(f"*生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}*")
        lines.append("")
        lines.append("---")
        lines.append("")
        
        sorted_chapters = sorted(chapters, key=lambda c: c.start_time)
        
        for idx, chapter in enumerate(sorted_chapters, start=1):
            time_str = self._format_chapter_time(chapter.start_time, chapter.end_time)
            
            lines.append(f"## {idx}. {chapter.title}")
            lines.append("")
            lines.append(f"**时间**: {time_str}")
            lines.append("")
            
            if include_speaker and chapter.speaker:
                lines.append(f"**说话人**: {chapter.speaker}")
                lines.append("")
            
            if chapter.description:
                lines.append(chapter.description)
                lines.append("")
            
            lines.append("---")
            lines.append("")
        
        content = "\n".join(lines)
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(content)
        
        return output_path
    
    def export_markdown_chapters_to_string(
        self,
        chapters: List[Chapter],
        title: str = "章节大纲",
        include_speaker: bool = True
    ) -> str:
        lines = []
        
        lines.append(f"# {title}")
        lines.append("")
        lines.append(f"*生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}*")
        lines.append("")
        lines.append("---")
        lines.append("")
        
        sorted_chapters = sorted(chapters, key=lambda c: c.start_time)
        
        for idx, chapter in enumerate(sorted_chapters, start=1):
            time_str = self._format_chapter_time(chapter.start_time, chapter.end_time)
            
            lines.append(f"## {idx}. {chapter.title}")
            lines.append("")
            lines.append(f"**时间**: {time_str}")
            lines.append("")
            
            if include_speaker and chapter.speaker:
                lines.append(f"**说话人**: {chapter.speaker}")
                lines.append("")
            
            if chapter.description:
                lines.append(chapter.description)
                lines.append("")
            
            lines.append("---")
            lines.append("")
        
        return "\n".join(lines)
    
    def _format_chapter_time(
        self,
        start_time: datetime,
        end_time: Optional[datetime]
    ) -> str:
        start_str = self._timedelta_to_hms(start_time)
        
        if end_time:
            end_str = self._timedelta_to_hms(end_time)
            return f"{start_str} - {end_str}"
        
        return start_str
    
    def _timedelta_to_hms(self, td) -> str:
        total_seconds = int(td.total_seconds())
        hours = total_seconds // 3600
        minutes = (total_seconds % 3600) // 60
        seconds = total_seconds % 60
        
        if hours > 0:
            return f"{hours}:{minutes:02d}:{seconds:02d}"
        return f"{minutes}:{seconds:02d}"
    
    def export_audit_json(
        self,
        output_path: str,
        subtitles: Optional[List[SubtitleItem]] = None,
        speakers: Optional[List[Speaker]] = None,
        chapters: Optional[List[Chapter]] = None,
        validation_result: Optional[Dict] = None,
        fix_actions: Optional[List[Dict]] = None,
        review_summary: Optional[Dict] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        audit_data = {
            "audit_version": "1.0",
            "generated_at": datetime.now().isoformat(),
            "metadata": metadata or {}
        }
        
        if subtitles:
            audit_data["subtitles"] = {
                "count": len(subtitles),
                "items": [self._subtitle_to_dict(s) for s in subtitles]
            }
        
        if speakers:
            audit_data["speakers"] = {
                "count": len(speakers),
                "items": [self._speaker_to_dict(s) for s in speakers]
            }
        
        if chapters:
            audit_data["chapters"] = {
                "count": len(chapters),
                "items": [self._chapter_to_dict(c) for c in chapters]
            }
        
        if validation_result:
            audit_data["validation"] = validation_result
        
        if fix_actions:
            audit_data["fix_actions"] = {
                "count": len(fix_actions),
                "actions": fix_actions
            }
        
        if review_summary:
            audit_data["review"] = review_summary
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(audit_data, f, ensure_ascii=False, indent=2, default=str)
        
        return output_path
    
    def export_audit_json_to_string(
        self,
        subtitles: Optional[List[SubtitleItem]] = None,
        speakers: Optional[List[Speaker]] = None,
        chapters: Optional[List[Chapter]] = None,
        validation_result: Optional[Dict] = None,
        fix_actions: Optional[List[Dict]] = None,
        review_summary: Optional[Dict] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        audit_data = {
            "audit_version": "1.0",
            "generated_at": datetime.now().isoformat(),
            "metadata": metadata or {}
        }
        
        if subtitles:
            audit_data["subtitles"] = {
                "count": len(subtitles),
                "items": [self._subtitle_to_dict(s) for s in subtitles]
            }
        
        if speakers:
            audit_data["speakers"] = {
                "count": len(speakers),
                "items": [self._speaker_to_dict(s) for s in speakers]
            }
        
        if chapters:
            audit_data["chapters"] = {
                "count": len(chapters),
                "items": [self._chapter_to_dict(c) for c in chapters]
            }
        
        if validation_result:
            audit_data["validation"] = validation_result
        
        if fix_actions:
            audit_data["fix_actions"] = {
                "count": len(fix_actions),
                "actions": fix_actions
            }
        
        if review_summary:
            audit_data["review"] = review_summary
        
        return json.dumps(audit_data, ensure_ascii=False, indent=2, default=str)
    
    def _subtitle_to_dict(self, sub: SubtitleItem) -> Dict[str, Any]:
        return {
            "index": sub.index,
            "start_time": str(sub.start_time),
            "end_time": str(sub.end_time),
            "duration_seconds": sub.duration_seconds,
            "text": sub.text,
            "speaker": sub.speaker,
            "original_text": sub.original_text,
            "metadata": sub.metadata
        }
    
    def _speaker_to_dict(self, speaker: Speaker) -> Dict[str, Any]:
        return {
            "name": speaker.name,
            "alias": speaker.alias,
            "role": speaker.role,
            "is_guest": speaker.is_guest
        }
    
    def _chapter_to_dict(self, chapter: Chapter) -> Dict[str, Any]:
        return {
            "title": chapter.title,
            "start_time": str(chapter.start_time),
            "end_time": str(chapter.end_time) if chapter.end_time else None,
            "description": chapter.description,
            "speaker": chapter.speaker
        }
    
    def export_all(
        self,
        output_dir: str,
        base_filename: str,
        subtitles: List[SubtitleItem],
        speakers: Optional[List[Speaker]] = None,
        chapters: Optional[List[Chapter]] = None,
        validation_result: Optional[Dict] = None,
        fix_actions: Optional[List[Dict]] = None,
        review_summary: Optional[Dict] = None,
        include_speaker_in_srt: bool = True
    ) -> Dict[str, str]:
        os.makedirs(output_dir, exist_ok=True)
        
        outputs = {}
        
        srt_path = os.path.join(output_dir, f"{base_filename}.srt")
        outputs["srt"] = self.export_srt(
            subtitles, srt_path, include_speaker=include_speaker_in_srt
        )
        
        if chapters:
            md_path = os.path.join(output_dir, f"{base_filename}_chapters.md")
            outputs["markdown_chapters"] = self.export_markdown_chapters(
                chapters, md_path
            )
        
        audit_path = os.path.join(output_dir, f"{base_filename}_audit.json")
        outputs["audit_json"] = self.export_audit_json(
            audit_path,
            subtitles=subtitles,
            speakers=speakers,
            chapters=chapters,
            validation_result=validation_result,
            fix_actions=fix_actions,
            review_summary=review_summary
        )
        
        return outputs
