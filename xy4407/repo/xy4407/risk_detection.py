from datetime import datetime, date, time, timedelta
from typing import List, Dict, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from models import (
    Auditorium, Film, KDM, Schedule, Event,
    AuditoriumStatus, ScheduleStatus, EventStatus,
    EventType, EventPriority
)


def time_to_seconds(t: time) -> int:
    return t.hour * 3600 + t.minute * 60 + t.second


def times_overlap(
    start1: time, end1: time,
    start2: time, end2: time
) -> bool:
    s1 = time_to_seconds(start1)
    e1 = time_to_seconds(end1)
    s2 = time_to_seconds(start2)
    e2 = time_to_seconds(end2)
    return s1 < e2 and s2 < e1


class RiskDetector:
    def __init__(self, db: Session):
        self.db = db
        self.events_created: List[Event] = []

    def _create_event(
        self,
        event_type: EventType,
        priority: EventPriority,
        title: str,
        description: str,
        film_id: Optional[int] = None,
        auditorium_id: Optional[int] = None,
        schedule_id: Optional[int] = None,
        kdm_id: Optional[int] = None
    ) -> Event:
        existing = self.db.query(Event).filter(
            Event.event_type == event_type,
            Event.film_id == film_id,
            Event.auditorium_id == auditorium_id,
            Event.schedule_id == schedule_id,
            Event.kdm_id == kdm_id,
            Event.status != EventStatus.RESOLVED
        ).first()
        
        if existing:
            return existing
        
        event = Event(
            event_type=event_type,
            priority=priority,
            title=title,
            description=description,
            film_id=film_id,
            auditorium_id=auditorium_id,
            schedule_id=schedule_id,
            kdm_id=kdm_id,
            status=EventStatus.PENDING,
            detected_at=datetime.utcnow()
        )
        self.db.add(event)
        self.events_created.append(event)
        return event

    def check_key_expiry(
        self,
        schedule: Schedule,
        kdm: KDM,
        film: Film,
        auditorium: Auditorium,
        show_datetime: datetime
    ) -> Optional[Event]:
        now = datetime.utcnow()
        hours_to_show = (show_datetime - now).total_seconds() / 3600
        
        if hours_to_show < 0:
            return None
        
        if show_datetime > kdm.valid_to:
            return self._create_event(
                event_type=EventType.KEY_EXPIRED,
                priority=EventPriority.CRITICAL,
                title=f"{film.title} - 密钥已过期",
                description=f"影片《{film.title}》在影厅\"{auditorium.name}\"的排片时间（{show_datetime.strftime('%Y-%m-%d %H:%M')}）"
                           f"已超出KDM密钥有效期（{kdm.valid_to.strftime('%Y-%m-%d %H:%M')}）。"
                           f"请立即申请新密钥。",
                film_id=film.id,
                auditorium_id=auditorium.id,
                schedule_id=schedule.id,
                kdm_id=kdm.id
            )
        
        hours_until_expiry = (kdm.valid_to - show_datetime).total_seconds() / 3600
        
        if hours_until_expiry < 24:
            return self._create_event(
                event_type=EventType.KEY_EXPIRING,
                priority=EventPriority.CRITICAL if hours_until_expiry < 6 else EventPriority.HIGH,
                title=f"{film.title} - 密钥即将过期",
                description=f"影片《{film.title}》在影厅\"{auditorium.name}\"的KDM密钥"
                           f"将于排片开始后 {hours_until_expiry:.1f} 小时过期（过期时间：{kdm.valid_to.strftime('%Y-%m-%d %H:%M')}）。"
                           f"请及时申请新密钥。",
                film_id=film.id,
                auditorium_id=auditorium.id,
                schedule_id=schedule.id,
                kdm_id=kdm.id
            )
        
        return None

    def check_server_mismatch(
        self,
        schedule: Schedule,
        kdm: KDM,
        film: Film,
        auditorium: Auditorium
    ) -> Optional[Event]:
        if kdm.auditorium_id is None:
            return None
        
        if kdm.auditorium_id != auditorium.id:
            kdm_auditorium = self.db.query(Auditorium).filter(
                Auditorium.id == kdm.auditorium_id
            ).first()
            kdm_aud_name = kdm_auditorium.name if kdm_auditorium else "未知影厅"
            
            return self._create_event(
                event_type=EventType.SERVER_MISMATCH,
                priority=EventPriority.CRITICAL,
                title=f"{film.title} - 服务器不匹配",
                description=f"影片《{film.title}》的KDM密钥绑定到影厅\"{kdm_aud_name}\"，"
                           f"但排片安排在影厅\"{auditorium.name}\"。"
                           f"服务器ID不匹配，将无法正常放映。"
                           f"请申请正确的密钥或改派影厅。",
                film_id=film.id,
                auditorium_id=auditorium.id,
                schedule_id=schedule.id,
                kdm_id=kdm.id
            )
        
        return None

    def check_time_conflict(
        self,
        schedule: Schedule,
        auditorium: Auditorium,
        film: Film
    ) -> List[Event]:
        events = []
        
        overlapping = self.db.query(Schedule).filter(
            Schedule.id != schedule.id,
            Schedule.auditorium_id == auditorium.id,
            Schedule.show_date == schedule.show_date,
            Schedule.status.in_([ScheduleStatus.SCHEDULED, ScheduleStatus.RUNNING])
        ).all()
        
        for other in overlapping:
            if times_overlap(schedule.start_time, schedule.end_time, other.start_time, other.end_time):
                other_film = self.db.query(Film).filter(Film.id == other.film_id).first()
                other_title = other_film.title if other_film else "未知影片"
                
                events.append(self._create_event(
                    event_type=EventType.TIME_CONFLICT,
                    priority=EventPriority.HIGH,
                    title=f"{auditorium.name} - 排片时间冲突",
                    description=f"影厅\"{auditorium.name}\"存在排片时间冲突："
                               f"《{film.title}》({schedule.start_time.strftime('%H:%M')}-{schedule.end_time.strftime('%H:%M')})"
                               f" 与 《{other_title}》({other.start_time.strftime('%H:%M')}-{other.end_time.strftime('%H:%M')})"
                               f"在 {schedule.show_date} 冲突。",
                    film_id=film.id,
                    auditorium_id=auditorium.id,
                    schedule_id=schedule.id
                ))
        
        return events

    def check_not_ready(
        self,
        schedule: Schedule,
        film: Film,
        auditorium: Auditorium,
        show_datetime: datetime
    ) -> Optional[Event]:
        now = datetime.utcnow()
        
        if show_datetime <= now:
            return None
        
        hours_to_show = (show_datetime - now).total_seconds() / 3600
        
        if hours_to_show > 4:
            return None
        
        valid_kdms = self.db.query(KDM).filter(
            KDM.film_id == film.id,
            KDM.valid_from <= show_datetime,
            KDM.valid_to >= show_datetime,
            or_(
                KDM.auditorium_id == auditorium.id,
                KDM.auditorium_id.is_(None)
            )
        ).all()
        
        if not valid_kdms:
            urgency = "紧急" if hours_to_show < 1 else f"约{hours_to_show:.0f}小时后"
            return self._create_event(
                event_type=EventType.NOT_READY,
                priority=EventPriority.CRITICAL if hours_to_show < 1 else EventPriority.HIGH,
                title=f"{film.title} - 临开场未就绪",
                description=f"影片《{film.title}》在影厅\"{auditorium.name}\"的排片"
                           f"将于{urgency}开始（{show_datetime.strftime('%Y-%m-%d %H:%M')}），"
                           f"但未找到有效的KDM密钥。请立即检查密钥导入情况。",
                film_id=film.id,
                auditorium_id=auditorium.id,
                schedule_id=schedule.id
            )
        
        return None

    def check_dcp_missing(
        self,
        schedule: Schedule,
        film: Film,
        auditorium: Auditorium
    ) -> Optional[Event]:
        films = self.db.query(Film).filter(Film.id == film.id).all()
        if not films:
            return self._create_event(
                event_type=EventType.DCP_MISSING,
                priority=EventPriority.CRITICAL,
                title=f"{film.title} - DCP未导入",
                description=f"影片《{film.title}》的DCP内容未在系统中登记。"
                           f"请确认DCP是否已导入影厅服务器。",
                film_id=film.id,
                auditorium_id=auditorium.id,
                schedule_id=schedule.id
            )
        return None

    def check_kdm_missing(
        self,
        schedule: Schedule,
        film: Film,
        auditorium: Auditorium,
        show_datetime: datetime
    ) -> Optional[Event]:
        valid_kdms = self.db.query(KDM).filter(
            KDM.film_id == film.id,
            KDM.valid_from <= show_datetime,
            KDM.valid_to >= show_datetime
        ).all()
        
        if not valid_kdms:
            return self._create_event(
                event_type=EventType.KDM_MISSING,
                priority=EventPriority.CRITICAL,
                title=f"{film.title} - KDM缺失",
                description=f"影片《{film.title}》在排片时间（{show_datetime.strftime('%Y-%m-%d %H:%M')}）"
                           f"没有有效的KDM密钥。请立即申请并导入密钥。",
                film_id=film.id,
                auditorium_id=auditorium.id,
                schedule_id=schedule.id
            )
        
        has_auditorium_specific = any(kdm.auditorium_id == auditorium.id for kdm in valid_kdms)
        has_generic = any(kdm.auditorium_id is None for kdm in valid_kdms)
        
        if not (has_auditorium_specific or has_generic):
            return self._create_event(
                event_type=EventType.KDM_MISSING,
                priority=EventPriority.HIGH,
                title=f"{film.title} - KDM不适用于此影厅",
                description=f"影片《{film.title}》有KDM密钥，但不适用于影厅\"{auditorium.name}\"。"
                           f"现有密钥绑定到其他影厅或服务器。",
                film_id=film.id,
                auditorium_id=auditorium.id,
                schedule_id=schedule.id
            )
        
        return None

    def check_schedule(self, schedule: Schedule) -> List[Event]:
        events = []
        
        film = self.db.query(Film).filter(Film.id == schedule.film_id).first()
        if not film:
            return events
        
        auditorium = self.db.query(Auditorium).filter(Auditorium.id == schedule.auditorium_id).first()
        if not auditorium:
            return events
        
        show_datetime = datetime.combine(schedule.show_date, schedule.start_time)
        
        kdms = self.db.query(KDM).filter(
            KDM.film_id == film.id,
            KDM.valid_from <= show_datetime,
            KDM.valid_to >= show_datetime
        ).all()
        
        if not kdms:
            kdm_missing_event = self.check_kdm_missing(schedule, film, auditorium, show_datetime)
            if kdm_missing_event:
                events.append(kdm_missing_event)
        else:
            for kdm in kdms:
                expiry_event = self.check_key_expiry(schedule, kdm, film, auditorium, show_datetime)
                if expiry_event:
                    events.append(expiry_event)
                
                mismatch_event = self.check_server_mismatch(schedule, kdm, film, auditorium)
                if mismatch_event:
                    events.append(mismatch_event)
        
        time_conflict_events = self.check_time_conflict(schedule, auditorium, film)
        events.extend(time_conflict_events)
        
        not_ready_event = self.check_not_ready(schedule, film, auditorium, show_datetime)
        if not_ready_event:
            events.append(not_ready_event)
        
        return events

    def check_all_upcoming(self, days: int = 7) -> List[Event]:
        self.events_created = []
        
        today = date.today()
        end_date = today + timedelta(days=days)
        
        schedules = self.db.query(Schedule).filter(
            Schedule.show_date >= today,
            Schedule.show_date <= end_date,
            Schedule.status.in_([ScheduleStatus.SCHEDULED, ScheduleStatus.RUNNING])
        ).all()
        
        for schedule in schedules:
            self.check_schedule(schedule)
        
        self.db.commit()
        return self.events_created

    def run_detection(self, schedule_ids: List[int] = None) -> List[Event]:
        self.events_created = []
        
        if schedule_ids:
            schedules = self.db.query(Schedule).filter(
                Schedule.id.in_(schedule_ids)
            ).all()
        else:
            today = date.today()
            schedules = self.db.query(Schedule).filter(
                Schedule.show_date >= today,
                Schedule.status.in_([ScheduleStatus.SCHEDULED, ScheduleStatus.RUNNING])
            ).all()
        
        for schedule in schedules:
            self.check_schedule(schedule)
        
        self.db.commit()
        return self.events_created
