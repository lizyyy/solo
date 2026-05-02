import csv
import json
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Dict, Any, Callable
from collections import Counter

from models import ConferenceProject, Mark, MarkType, Term, AgendaItem


class MarkdownExporter:
    def __init__(self, project: ConferenceProject):
        self.project = project
    
    def export(self, 
               filter_speaker: Optional[str] = None,
               filter_topic: Optional[str] = None,
               filter_mark_type: Optional[List[MarkType]] = None) -> str:
        
        marks = self._filter_marks(filter_speaker, filter_topic, filter_mark_type)
        
        lines = []
        
        lines.append(f"# {self.project.name}")
        lines.append("")
        lines.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"**会议日期**: {self.project.created_at.strftime('%Y-%m-%d')}")
        lines.append("")
        
        lines.append("## 概览")
        lines.append("")
        
        total_stuck = len([m for m in self.project.marks if m.mark_type == MarkType.STUCK])
        total_mistranslation = len([m for m in self.project.marks if m.mark_type == MarkType.MISTRANSLATION])
        total_confirmed = len([m for m in self.project.marks if m.mark_type == MarkType.CONFIRMED])
        
        lines.append("| 统计项 | 数量 |")
        lines.append("|--------|------|")
        lines.append(f"| 术语总数 | {len(self.project.terms)} |")
        lines.append(f"| 议程项数 | {len(self.project.agenda)} |")
        lines.append(f"| 卡词次数 | {total_stuck} |")
        lines.append(f"| 误译次数 | {total_mistranslation} |")
        lines.append(f"| 已确认 | {total_confirmed} |")
        lines.append("")
        
        if marks:
            lines.append("## 问题汇总")
            lines.append("")
            
            stuck_marks = [m for m in marks if m.mark_type == MarkType.STUCK]
            mistranslation_marks = [m for m in marks if m.mark_type == MarkType.MISTRANSLATION]
            
            if stuck_marks:
                lines.append("### 卡词记录")
                lines.append("")
                lines.append("| 时间 | 术语/内容 | 嘉宾 | 议程 | 备注 |")
                lines.append("|------|----------|------|------|------|")
                
                for mark in stuck_marks:
                    time_str = mark.timestamp.strftime('%H:%M:%S')
                    term_text = mark.term_text or "-"
                    speaker = mark.speaker or "-"
                    agenda = mark.agenda_item_title or "-"
                    notes = mark.notes or "-"
                    lines.append(f"| {time_str} | {term_text} | {speaker} | {agenda} | {notes} |")
                lines.append("")
            
            if mistranslation_marks:
                lines.append("### 误译记录")
                lines.append("")
                lines.append("| 时间 | 术语/内容 | 正确译法 | 嘉宾 | 议程 | 备注 |")
                lines.append("|------|----------|----------|------|------|------|")
                
                for mark in mistranslation_marks:
                    time_str = mark.timestamp.strftime('%H:%M:%S')
                    term_text = mark.term_text or "-"
                    correction = mark.correction or "-"
                    speaker = mark.speaker or "-"
                    agenda = mark.agenda_item_title or "-"
                    notes = mark.notes or "-"
                    lines.append(f"| {time_str} | {term_text} | {correction} | {speaker} | {agenda} | {notes} |")
                lines.append("")
        
        lines.append("## 高频问题分析")
        lines.append("")
        
        term_counter = Counter()
        speaker_counter = Counter()
        
        for mark in self.project.marks:
            if mark.mark_type in [MarkType.STUCK, MarkType.MISTRANSLATION]:
                if mark.term_text:
                    term_counter[mark.term_text] += 1
                if mark.speaker:
                    speaker_counter[mark.speaker] += 1
        
        if term_counter:
            lines.append("### 高频问题术语")
            lines.append("")
            lines.append("| 术语 | 出现次数 |")
            lines.append("|------|----------|")
            for term, count in term_counter.most_common(10):
                lines.append(f"| {term} | {count} |")
            lines.append("")
        
        if speaker_counter:
            lines.append("### 按嘉宾统计")
            lines.append("")
            lines.append("| 嘉宾 | 问题次数 |")
            lines.append("|------|----------|")
            for speaker, count in speaker_counter.most_common():
                lines.append(f"| {speaker} | {count} |")
            lines.append("")
        
        lines.append("## 术语表")
        lines.append("")
        
        categories = set(t.category for t in self.project.terms if t.category)
        
        if categories:
            for category in sorted(categories):
                lines.append(f"### {category}")
                lines.append("")
                lines.append("| 中文 | 英文 | 难度 | 备注 |")
                lines.append("|------|------|------|------|")
                
                for term in self.project.terms:
                    if term.category == category:
                        difficulty = "★" * term.difficulty
                        notes = term.notes or "-"
                        lines.append(f"| {term.chinese} | {term.english} | {difficulty} | {notes} |")
                lines.append("")
        else:
            lines.append("| 中文 | 英文 | 难度 | 备注 |")
            lines.append("|------|------|------|------|")
            for term in self.project.terms:
                difficulty = "★" * term.difficulty
                notes = term.notes or "-"
                lines.append(f"| {term.chinese} | {term.english} | {difficulty} | {notes} |")
            lines.append("")
        
        lines.append("## 会议议程")
        lines.append("")
        lines.append("| 时间 | 议程 | 嘉宾 | 主题 |")
        lines.append("|------|------|------|------|")
        
        for item in self.project.agenda:
            start_str = item.start_time.strftime('%H:%M')
            end_str = item.end_time.strftime('%H:%M')
            time_range = f"{start_str} - {end_str}"
            speaker = item.speaker or "-"
            topic = item.topic or "-"
            lines.append(f"| {time_range} | {item.title} | {speaker} | {topic} |")
        
        lines.append("")
        
        return "\n".join(lines)
    
    def _filter_marks(self,
                       filter_speaker: Optional[str],
                       filter_topic: Optional[str],
                       filter_mark_type: Optional[List[MarkType]]) -> List[Mark]:
        
        marks = self.project.marks
        
        if filter_speaker:
            marks = [m for m in marks if m.speaker == filter_speaker]
        
        if filter_topic:
            marks = [m for m in marks if m.agenda_item_title and filter_topic in m.agenda_item_title]
        
        if filter_mark_type:
            marks = [m for m in marks if m.mark_type in filter_mark_type]
        
        return marks
    
    def save_to_file(self, file_path: str, **kwargs) -> bool:
        try:
            content = self.export(**kwargs)
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(content)
            return True
        except Exception as e:
            print(f"Error saving Markdown: {e}")
            return False


class CSVExporter:
    def __init__(self, project: ConferenceProject):
        self.project = project
    
    def export_error_terms(self, 
                            filter_speaker: Optional[str] = None,
                            filter_topic: Optional[str] = None) -> List[Dict[str, Any]]:
        
        marks = [m for m in self.project.marks 
                 if m.mark_type in [MarkType.STUCK, MarkType.MISTRANSLATION]]
        
        if filter_speaker:
            marks = [m for m in marks if m.speaker == filter_speaker]
        
        if filter_topic:
            marks = [m for m in marks if m.agenda_item_title and filter_topic in m.agenda_item_title]
        
        rows = []
        for mark in marks:
            term = None
            if mark.term_id:
                term = self.project.get_term_by_id(mark.term_id)
            
            row = {
                "timestamp": mark.timestamp.strftime('%Y-%m-%d %H:%M:%S'),
                "mark_type": mark.mark_type.value,
                "term_id": mark.term_id or "",
                "term_text": mark.term_text or "",
                "term_chinese": term.chinese if term else "",
                "term_english": term.english if term else "",
                "correction": mark.correction or "",
                "speaker": mark.speaker or "",
                "agenda_item_id": mark.agenda_item_id or "",
                "agenda_item_title": mark.agenda_item_title or "",
                "notes": mark.notes or ""
            }
            rows.append(row)
        
        return rows
    
    def export_terms(self) -> List[Dict[str, Any]]:
        rows = []
        for term in self.project.terms:
            row = {
                "id": term.id,
                "chinese": term.chinese,
                "english": term.english,
                "category": term.category,
                "difficulty": term.difficulty,
                "notes": term.notes
            }
            rows.append(row)
        return rows
    
    def export_agenda(self) -> List[Dict[str, Any]]:
        rows = []
        for item in self.project.agenda:
            row = {
                "id": item.id,
                "start_time": item.start_time.strftime('%H:%M:%S'),
                "end_time": item.end_time.strftime('%H:%M:%S'),
                "title": item.title,
                "speaker": item.speaker,
                "topic": item.topic,
                "notes": item.notes
            }
            rows.append(row)
        return rows
    
    def export_marks(self) -> List[Dict[str, Any]]:
        rows = []
        for mark in self.project.marks:
            row = {
                "id": mark.id,
                "timestamp": mark.timestamp.strftime('%Y-%m-%d %H:%M:%S'),
                "mark_type": mark.mark_type.value,
                "term_id": mark.term_id or "",
                "term_text": mark.term_text or "",
                "agenda_item_id": mark.agenda_item_id or "",
                "agenda_item_title": mark.agenda_item_title or "",
                "speaker": mark.speaker or "",
                "notes": mark.notes or "",
                "correction": mark.correction or ""
            }
            rows.append(row)
        return rows
    
    def save_to_file(self, rows: List[Dict[str, Any]], file_path: str) -> bool:
        if not rows:
            return False
        
        try:
            fieldnames = list(rows[0].keys())
            with open(file_path, "w", encoding="utf-8-sig", newline="") as f:
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()
                writer.writerows(rows)
            return True
        except Exception as e:
            print(f"Error saving CSV: {e}")
            return False


class JSONExporter:
    def __init__(self, project: ConferenceProject):
        self.project = project
    
    def export_audit_package(self, include_terms: bool = True, include_agenda: bool = True) -> Dict[str, Any]:
        package = {
            "version": "1.0",
            "exported_at": datetime.now().isoformat(),
            "project": {
                "id": self.project.id,
                "name": self.project.name,
                "created_at": self.project.created_at.isoformat(),
                "updated_at": self.project.updated_at.isoformat()
            },
            "marks": [m.to_dict() for m in self.project.marks],
            "statistics": self._calculate_statistics()
        }
        
        if include_terms:
            package["terms"] = [t.to_dict() for t in self.project.terms]
        
        if include_agenda:
            package["agenda"] = [a.to_dict() for a in self.project.agenda]
        
        return package
    
    def _calculate_statistics(self) -> Dict[str, Any]:
        total_marks = len(self.project.marks)
        stuck_count = len([m for m in self.project.marks if m.mark_type == MarkType.STUCK])
        mistranslation_count = len([m for m in self.project.marks if m.mark_type == MarkType.MISTRANSLATION])
        confirmed_count = len([m for m in self.project.marks if m.mark_type == MarkType.CONFIRMED])
        
        speaker_stats = {}
        for mark in self.project.marks:
            if mark.speaker:
                if mark.speaker not in speaker_stats:
                    speaker_stats[mark.speaker] = {"total": 0, "stuck": 0, "mistranslation": 0, "confirmed": 0}
                speaker_stats[mark.speaker]["total"] += 1
                if mark.mark_type == MarkType.STUCK:
                    speaker_stats[mark.speaker]["stuck"] += 1
                elif mark.mark_type == MarkType.MISTRANSLATION:
                    speaker_stats[mark.speaker]["mistranslation"] += 1
                elif mark.mark_type == MarkType.CONFIRMED:
                    speaker_stats[mark.speaker]["confirmed"] += 1
        
        term_stats = {}
        for mark in self.project.marks:
            if mark.term_text and mark.mark_type in [MarkType.STUCK, MarkType.MISTRANSLATION]:
                if mark.term_text not in term_stats:
                    term_stats[mark.term_text] = 0
                term_stats[mark.term_text] += 1
        
        sorted_terms = sorted(term_stats.items(), key=lambda x: x[1], reverse=True)
        
        return {
            "total_marks": total_marks,
            "stuck_count": stuck_count,
            "mistranslation_count": mistranslation_count,
            "confirmed_count": confirmed_count,
            "speaker_statistics": speaker_stats,
            "frequent_problem_terms": [{"term": t, "count": c} for t, c in sorted_terms[:20]]
        }
    
    def save_to_file(self, file_path: str, **kwargs) -> bool:
        try:
            content = self.export_audit_package(**kwargs)
            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(content, f, ensure_ascii=False, indent=2)
            return True
        except Exception as e:
            print(f"Error saving JSON: {e}")
            return False


class ExportManager:
    def __init__(self, project: ConferenceProject):
        self.project = project
        self._markdown_exporter = MarkdownExporter(project)
        self._csv_exporter = CSVExporter(project)
        self._json_exporter = JSONExporter(project)
    
    def export_markdown(self, file_path: str, **kwargs) -> bool:
        return self._markdown_exporter.save_to_file(file_path, **kwargs)
    
    def export_error_terms_csv(self, file_path: str, **kwargs) -> bool:
        rows = self._csv_exporter.export_error_terms(**kwargs)
        return self._csv_exporter.save_to_file(rows, file_path)
    
    def export_terms_csv(self, file_path: str) -> bool:
        rows = self._csv_exporter.export_terms()
        return self._csv_exporter.save_to_file(rows, file_path)
    
    def export_agenda_csv(self, file_path: str) -> bool:
        rows = self._csv_exporter.export_agenda()
        return self._csv_exporter.save_to_file(rows, file_path)
    
    def export_marks_csv(self, file_path: str) -> bool:
        rows = self._csv_exporter.export_marks()
        return self._csv_exporter.save_to_file(rows, file_path)
    
    def export_audit_json(self, file_path: str, **kwargs) -> bool:
        return self._json_exporter.save_to_file(file_path, **kwargs)
    
    def generate_markdown_content(self, **kwargs) -> str:
        return self._markdown_exporter.export(**kwargs)
    
    def generate_audit_package(self, **kwargs) -> Dict[str, Any]:
        return self._json_exporter.export_audit_package(**kwargs)
