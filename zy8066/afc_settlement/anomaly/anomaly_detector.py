from typing import Dict, List
from datetime import datetime, timedelta
from ..state_machine.trip_reconstructor import Trip
from ..parser.calendar_config import CalendarConfig, get_operating_day


def detect_anomalies(
    all_trips: Dict[str, List[Trip]],
    calendar_config: CalendarConfig,
) -> Dict[str, List[Trip]]:
    for card_id, trips in all_trips.items():
        for trip in trips:
            _detect_trip_anomalies(trip, calendar_config)
    
    return all_trips


def _detect_trip_anomalies(
    trip: Trip,
    calendar_config: CalendarConfig,
) -> None:
    if not trip.legs:
        return
    
    for i, leg in enumerate(trip.legs):
        if leg.tap_in and leg.tap_out:
            trip_duration = (leg.tap_out.timestamp - leg.tap_in.timestamp).total_seconds()
            if trip_duration > 7200:
                if "trip_timeout" not in trip.anomalies:
                    trip.anomalies.append("trip_timeout")
    
    if len(trip.legs) > 1:
        for i in range(1, len(trip.legs)):
            prev_leg = trip.legs[i-1]
            curr_leg = trip.legs[i]
            
            if prev_leg.tap_out and curr_leg.tap_in:
                transfer_time = (curr_leg.tap_in.timestamp - prev_leg.tap_out.timestamp).total_seconds()
                if transfer_time > 1800:
                    trip.anomalies.append("transfer_break")
    
    first_leg = trip.legs[0]
    last_leg = trip.legs[-1]
    
    if first_leg.tap_in:
        first_op_day = get_operating_day(first_leg.tap_in.timestamp, calendar_config.operating_day_cutoff)
    else:
        first_op_day = None
    
    if last_leg.tap_out:
        last_op_day = get_operating_day(last_leg.tap_out.timestamp, calendar_config.operating_day_cutoff)
    elif last_leg.tap_in:
        last_op_day = get_operating_day(last_leg.tap_in.timestamp, calendar_config.operating_day_cutoff)
    else:
        last_op_day = None
    
    if first_op_day and last_op_day and first_op_day != last_op_day:
        trip.anomalies.append("cross_operating_day")
