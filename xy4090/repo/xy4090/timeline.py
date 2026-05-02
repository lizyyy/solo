import threading
import time
from dataclasses import dataclass, field
from datetime import datetime, timedelta, time as dt_time
from enum import Enum
from typing import List, Optional, Callable, Dict, Any
from uuid import uuid4

from models import AgendaItem, Term, ConferenceProject


class ReminderType(Enum):
    AGENDA_START = "agenda_start"
    AGENDA_END = "agenda_end"
    TERM_REMINDER = "term_reminder"
    CUSTOM = "custom"


@dataclass
class Reminder:
    id: str
    reminder_type: ReminderType
    trigger_time: dt_time
    agenda_item_id: Optional[str] = None
    agenda_item_title: Optional[str] = None
    term_id: Optional[str] = None
    term_text: Optional[str] = None
    message: str = ""
    is_triggered: bool = False
    triggered_at: Optional[datetime] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "reminder_type": self.reminder_type.value,
            "trigger_time": self.trigger_time.strftime("%H:%M:%S"),
            "agenda_item_id": self.agenda_item_id,
            "agenda_item_title": self.agenda_item_title,
            "term_id": self.term_id,
            "term_text": self.term_text,
            "message": self.message,
            "is_triggered": self.is_triggered,
            "triggered_at": self.triggered_at.isoformat() if self.triggered_at else None
        }


class TimelineScheduler:
    def __init__(self, project: Optional[ConferenceProject] = None):
        self.project = project
        self.reminders: List[Reminder] = []
        self._is_running = False
        self._scheduler_thread: Optional[threading.Thread] = None
        self._lock = threading.Lock()
        
        self.on_reminder: Optional[Callable[[Reminder], None]] = None
        self.on_agenda_change: Optional[Callable[[Optional[AgendaItem], Optional[AgendaItem]], None]] = None
        self.on_time_update: Optional[Callable[[datetime], None]] = None
        
        self._current_agenda_item: Optional[AgendaItem] = None
        self._check_interval = 1.0
    
    def set_project(self, project: ConferenceProject) -> None:
        with self._lock:
            self.project = project
            self._generate_reminders()
    
    def _generate_reminders(self) -> None:
        if not self.project:
            return
        
        self.reminders = []
        
        for item in self.project.agenda:
            start_reminder = Reminder(
                id=str(uuid4()),
                reminder_type=ReminderType.AGENDA_START,
                trigger_time=item.start_time,
                agenda_item_id=item.id,
                agenda_item_title=item.title,
                message=f"议程开始: {item.title}"
            )
            self.reminders.append(start_reminder)
            
            end_reminder = Reminder(
                id=str(uuid4()),
                reminder_type=ReminderType.AGENDA_END,
                trigger_time=item.end_time,
                agenda_item_id=item.id,
                agenda_item_title=item.title,
                message=f"议程结束: {item.title}"
            )
            self.reminders.append(end_reminder)
            
            if item.speaker:
                mid_seconds = self._time_to_seconds(item.start_time) + \
                             (self._time_to_seconds(item.end_time) - self._time_to_seconds(item.start_time)) // 2
                mid_time = self._seconds_to_time(mid_seconds)
                
                speaker_terms = [t for t in self.project.terms if item.speaker in (t.notes or "") or item.topic in (t.category or "")]
                if speaker_terms:
                    for i, term in enumerate(speaker_terms[:3]):
                        offset_seconds = mid_seconds - 300 + (i * 120)
                        if offset_seconds > self._time_to_seconds(item.start_time):
                            reminder_time = self._seconds_to_time(offset_seconds)
                            term_reminder = Reminder(
                                id=str(uuid4()),
                                reminder_type=ReminderType.TERM_REMINDER,
                                trigger_time=reminder_time,
                                agenda_item_id=item.id,
                                agenda_item_title=item.title,
                                term_id=term.id,
                                term_text=f"{term.chinese} - {term.english}",
                                message=f"术语提醒: {term.chinese} = {term.english}"
                            )
                            self.reminders.append(term_reminder)
        
        self.reminders.sort(key=lambda r: r.trigger_time)
    
    @staticmethod
    def _time_to_seconds(t: dt_time) -> int:
        return t.hour * 3600 + t.minute * 60 + t.second
    
    @staticmethod
    def _seconds_to_time(seconds: int) -> dt_time:
        seconds = max(0, seconds)
        hours = seconds // 3600
        minutes = (seconds % 3600) // 60
        secs = seconds % 60
        return dt_time(hours % 24, minutes, secs)
    
    def start(self) -> None:
        if self._is_running:
            return
        
        self._is_running = True
        self._scheduler_thread = threading.Thread(target=self._run_loop, daemon=True)
        self._scheduler_thread.start()
    
    def stop(self) -> None:
        self._is_running = False
        if self._scheduler_thread:
            self._scheduler_thread.join(timeout=2.0)
    
    def _run_loop(self) -> None:
        while self._is_running:
            try:
                now = datetime.now()
                current_time = now.time()
                
                if self.on_time_update:
                    self.on_time_update(now)
                
                with self._lock:
                    if self.project:
                        new_agenda_item = self.project.get_current_agenda_item(current_time)
                        if new_agenda_item != self._current_agenda_item:
                            old_item = self._current_agenda_item
                            self._current_agenda_item = new_agenda_item
                            if self.on_agenda_change:
                                self.on_agenda_change(old_item, new_agenda_item)
                    
                    for reminder in self.reminders:
                        if not reminder.is_triggered:
                            if self._is_time_passed(reminder.trigger_time, current_time):
                                reminder.is_triggered = True
                                reminder.triggered_at = now
                                if self.on_reminder:
                                    self.on_reminder(reminder)
                
                time.sleep(self._check_interval)
            except Exception as e:
                print(f"Timeline scheduler error: {e}")
                time.sleep(self._check_interval)
    
    @staticmethod
    def _is_time_passed(target: dt_time, current: dt_time) -> bool:
        target_seconds = TimelineScheduler._time_to_seconds(target)
        current_seconds = TimelineScheduler._time_to_seconds(current)
        return current_seconds >= target_seconds
    
    def get_upcoming_reminders(self, count: int = 5) -> List[Reminder]:
        with self._lock:
            now = datetime.now().time()
            upcoming = [r for r in self.reminders if not r.is_triggered and r.trigger_time >= now]
            upcoming.sort(key=lambda r: r.trigger_time)
            return upcoming[:count]
    
    def get_past_reminders(self) -> List[Reminder]:
        with self._lock:
            past = [r for r in self.reminders if r.is_triggered]
            past.sort(key=lambda r: r.triggered_at or datetime.min, reverse=True)
            return past
    
    def get_current_agenda_item(self) -> Optional[AgendaItem]:
        return self._current_agenda_item
    
    def get_next_agenda_item(self) -> Optional[AgendaItem]:
        if not self.project:
            return None
        
        current = self._current_agenda_item
        if not current:
            return self.project.agenda[0] if self.project.agenda else None
        
        found_current = False
        for item in self.project.agenda:
            if found_current:
                return item
            if item.id == current.id:
                found_current = True
        
        return None
    
    def get_agenda_progress(self) -> Dict[str, Any]:
        if not self.project or not self.project.agenda:
            return {
                "total_items": 0,
                "completed_items": 0,
                "current_item_index": -1,
                "progress_percent": 0.0
            }
        
        now = datetime.now().time()
        now_seconds = self._time_to_seconds(now)
        
        first_item = self.project.agenda[0]
        last_item = self.project.agenda[-1]
        
        total_seconds = self._time_to_seconds(last_item.end_time) - self._time_to_seconds(first_item.start_time)
        elapsed_seconds = now_seconds - self._time_to_seconds(first_item.start_time)
        
        if total_seconds <= 0:
            progress_percent = 0.0
        else:
            progress_percent = min(100.0, max(0.0, (elapsed_seconds / total_seconds) * 100))
        
        completed_count = 0
        current_index = -1
        
        for i, item in enumerate(self.project.agenda):
            if now >= item.end_time:
                completed_count += 1
            elif item.start_time <= now <= item.end_time:
                current_index = i
        
        return {
            "total_items": len(self.project.agenda),
            "completed_items": completed_count,
            "current_item_index": current_index,
            "progress_percent": progress_percent
        }
    
    def reset_reminders(self) -> None:
        with self._lock:
            for reminder in self.reminders:
                reminder.is_triggered = False
                reminder.triggered_at = None


class FlashCardManager:
    def __init__(self, project: Optional[ConferenceProject] = None):
        self.project = project
        self._current_card_index = 0
        self._shuffled_indices: List[int] = []
        self._history: List[int] = []
        self._lock = threading.Lock()
    
    def set_project(self, project: ConferenceProject) -> None:
        with self._lock:
            self.project = project
            self._current_card_index = 0
            self._shuffled_indices = list(range(len(project.terms)))
            self._history = []
    
    def get_current_term(self) -> Optional[Term]:
        if not self.project or not self.project.terms:
            return None
        
        with self._lock:
            if not self._shuffled_indices:
                self._shuffled_indices = list(range(len(self.project.terms)))
            
            if self._current_card_index < len(self._shuffled_indices):
                term_index = self._shuffled_indices[self._current_card_index]
                return self.project.terms[term_index]
            return None
    
    def next_card(self) -> Optional[Term]:
        if not self.project or not self.project.terms:
            return None
        
        with self._lock:
            if self._current_card_index < len(self._shuffled_indices) - 1:
                self._history.append(self._current_card_index)
                self._current_card_index += 1
                term_index = self._shuffled_indices[self._current_card_index]
                return self.project.terms[term_index]
            return None
    
    def previous_card(self) -> Optional[Term]:
        if not self.project or not self._history:
            return self.get_current_term()
        
        with self._lock:
            self._current_card_index = self._history.pop()
            term_index = self._shuffled_indices[self._current_card_index]
            return self.project.terms[term_index]
    
    def shuffle_cards(self) -> None:
        if not self.project:
            return
        
        import random
        with self._lock:
            self._shuffled_indices = list(range(len(self.project.terms)))
            random.shuffle(self._shuffled_indices)
            self._current_card_index = 0
            self._history = []
    
    def get_terms_by_category(self, category: str) -> List[Term]:
        if not self.project:
            return []
        return [t for t in self.project.terms if t.category == category]
    
    def get_terms_by_difficulty(self, difficulty: int) -> List[Term]:
        if not self.project:
            return []
        return [t for t in self.project.terms if t.difficulty == difficulty]
    
    def search_terms(self, query: str) -> List[Term]:
        if not self.project or not query:
            return []
        
        query_lower = query.lower()
        results = []
        for term in self.project.terms:
            if query_lower in term.chinese.lower() or query_lower in term.english.lower():
                results.append(term)
        return results
    
    def get_card_progress(self) -> Dict[str, Any]:
        if not self.project:
            return {
                "total": 0,
                "current": 0,
                "remaining": 0,
                "percent": 0.0
            }
        
        with self._lock:
            total = len(self.project.terms)
            current = self._current_card_index + 1 if total > 0 else 0
            remaining = total - current
            percent = (current / total * 100) if total > 0 else 0.0
            
            return {
                "total": total,
                "current": current,
                "remaining": remaining,
                "percent": percent
            }
