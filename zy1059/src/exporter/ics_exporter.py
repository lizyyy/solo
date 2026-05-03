import os
from datetime import datetime, timedelta
from typing import List, Optional
from icalendar import Calendar, Event as ICalEvent, vDatetime, vDate
import pytz

from src.models import Event


DEFAULT_PRODID = "-//Schedule Cleaner//CN"
DEFAULT_VERSION = "2.0"


class ICSExporter:
    def __init__(self, prodid: str = DEFAULT_PRODID, version: str = DEFAULT_VERSION):
        self.prodid = prodid
        self.version = version

    def export(self, events: List[Event], output_path: str) -> str:
        cal = Calendar()
        cal.add('prodid', self.prodid)
        cal.add('version', self.version)
        cal.add('x-wr-calname', 'Schedule Cleaner - Cleaned Events')
        cal.add('x-wr-timezone', 'Asia/Shanghai')
        
        for event in events:
            ical_event = self._event_to_ical(event)
            if ical_event:
                cal.add_component(ical_event)
        
        output_dir = os.path.dirname(output_path)
        if output_dir and not os.path.exists(output_dir):
            os.makedirs(output_dir, exist_ok=True)
        
        with open(output_path, 'wb') as f:
            f.write(cal.to_ical())
        
        return output_path

    def _event_to_ical(self, event: Event) -> Optional[ICalEvent]:
        if not event.start or not event.end:
            return None
        
        ical_event = ICalEvent()
        
        ical_event.add('uid', event.uid)
        
        if event.title:
            ical_event.add('summary', event.title)
        
        if event.all_day:
            start_date = event.start.date()
            end_date = event.end.date()
            if end_date == start_date:
                end_date = end_date + timedelta(days=1)
            ical_event.add('dtstart', vDate(start_date))
            ical_event.add('dtend', vDate(end_date))
        else:
            ical_event.add('dtstart', vDatetime(event.start))
            ical_event.add('dtend', vDatetime(event.end))
        
        now = datetime.now(pytz.UTC)
        ical_event.add('dtstamp', vDatetime(now))
        
        if event.location:
            ical_event.add('location', event.location)
        
        if event.description:
            ical_event.add('description', event.description)
        
        status_map = {
            'active': 'CONFIRMED',
            'tentative': 'TENTATIVE',
            'cancelled': 'CANCELLED',
        }
        ical_event.add('status', status_map.get(event.status.value, 'CONFIRMED'))
        
        if event.organizer:
            ical_event.add('organizer', event.organizer)
        
        for attendee in event.attendees:
            ical_event.add('attendee', attendee)
        
        if event.merged_from:
            merged_info = f"Merged from: {'; '.join(event.merged_from)}"
            if event.description:
                ical_event['description'] = f"{event.description}\n\n{merged_info}"
            else:
                ical_event.add('description', merged_info)
            
            ical_event.add('x-schedule-cleaner-merged', 'TRUE')
            for source in event.merged_from:
                ical_event.add('x-schedule-cleaner-source', source)
        
        return ical_event
