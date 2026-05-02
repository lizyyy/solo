from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import List, Dict, Optional
from ..parser.tap_events import TapEvent
from ..parser.calendar_config import get_operating_day, CalendarConfig


@dataclass
class TripLeg:
    tap_in: TapEvent
    tap_out: Optional[TapEvent] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None


@dataclass
class Trip:
    card_id: str
    legs: List[TripLeg] = field(default_factory=list)
    anomalies: List[str] = field(default_factory=list)
    calculated_fare: int = 0
    operating_day: Optional[datetime] = None


def reconstruct_trips(
    events: List[TapEvent],
    calendar_config: CalendarConfig,
) -> Dict[str, List[Trip]]:
    card_events: Dict[str, List[TapEvent]] = {}
    
    for event in events:
        if event.card_id not in card_events:
            card_events[event.card_id] = []
        card_events[event.card_id].append(event)
    
    all_trips: Dict[str, List[Trip]] = {}
    
    for card_id, card_event_list in card_events.items():
        sorted_events = sorted(card_event_list, key=lambda e: e.timestamp)
        trips = _reconstruct_card_trips(sorted_events, calendar_config)
        all_trips[card_id] = trips
    
    return all_trips


def _reconstruct_card_trips(
    events: List[TapEvent],
    calendar_config: CalendarConfig,
) -> List[Trip]:
    trips: List[Trip] = []
    current_trip: Optional[Trip] = None
    current_leg: Optional[TripLeg] = None
    last_tap_time: Optional[datetime] = None
    
    for i, event in enumerate(events):
        operating_day = get_operating_day(event.timestamp, calendar_config.operating_day_cutoff)
        
        if current_trip is None:
            current_trip = Trip(card_id=event.card_id, operating_day=operating_day)
            trips.append(current_trip)
        
        if event.tap_type == 'entry':
            if current_leg is not None and current_leg.tap_out is None:
                current_trip.anomalies.append("missing_exit")
                current_trip.legs.append(current_leg)
            
            current_leg = TripLeg(tap_in=event, start_time=event.timestamp)
            
            if (i > 0 and 
                events[i-1].tap_type == 'entry' and 
                events[i-1].card_id == event.card_id):
                current_trip.anomalies.append("duplicate_entry")
            
            if last_tap_time is not None:
                time_since_last_tap = (event.timestamp - last_tap_time).total_seconds()
                if time_since_last_tap < 60:
                    current_trip.anomalies.append("duplicate_tap")
        
        elif event.tap_type == 'exit':
            if current_leg is None or current_leg.tap_in is None:
                current_trip.anomalies.append("missing_entry")
                current_leg = TripLeg(
                    tap_in=TapEvent(
                        card_id=event.card_id,
                        tap_type='entry',
                        station_id='UNKNOWN',
                        timestamp=event.timestamp - timedelta(minutes=30),
                        device_id='',
                        transaction_id='',
                    )
                )
            
            current_leg.tap_out = event
            current_leg.end_time = event.timestamp
            current_trip.legs.append(current_leg)
            
            trip_duration = (event.timestamp - current_leg.tap_in.timestamp).total_seconds()
            if trip_duration > 7200:
                current_trip.anomalies.append("trip_timeout")
            
            current_leg = None
        
        last_tap_time = event.timestamp
    
    if current_leg is not None:
        if current_leg.tap_out is None:
            current_trip.anomalies.append("missing_exit")
        current_trip.legs.append(current_leg)
    
    return trips
