"""
排烟联动复核分析模块
"""

from typing import Dict, List, Optional
from datetime import datetime, timedelta
from collections import defaultdict

from smoke_cli.models import (
    Zone, Fan, DamperEvent, SensorMinute, ZoneAnalysis,
    TimelineEvent, EventType, IssueType
)


class SmokeReviewer:
    MAX_START_DELAY_SECONDS = 30
    SENSOR_GAP_THRESHOLD_MINUTES = 5

    def __init__(
        self,
        zones: List[Zone],
        fans: List[Fan],
        damper_events: List[DamperEvent],
        sensor_minutes: List[SensorMinute],
    ):
        self.zones = zones
        self.fans = {f.fan_id: f for f in fans}
        self.damper_events = damper_events
        self.sensor_minutes = sensor_minutes

        self.zone_map = {z.zone_id: z for z in zones}
        self._organize_events_by_zone()

    def _organize_events_by_zone(self):
        self.zone_damper_events: Dict[str, List[DamperEvent]] = defaultdict(list)
        self.zone_sensor_data: Dict[str, List[SensorMinute]] = defaultdict(list)
        self.damper_to_zone: Dict[str, str] = {}

        for zone in self.zones:
            for damper_id in zone.assigned_dampers:
                self.damper_to_zone[damper_id] = zone.zone_id

        for event in self.damper_events:
            if event.zone_id:
                self.zone_damper_events[event.zone_id].append(event)
            elif event.damper_id in self.damper_to_zone:
                zone_id = self.damper_to_zone[event.damper_id]
                self.zone_damper_events[zone_id].append(event)

        sensor_to_zone: Dict[str, str] = {}
        for zone in self.zones:
            for sensor_id in zone.sensors:
                sensor_to_zone[sensor_id] = zone.zone_id

        for sm in self.sensor_minutes:
            if sm.sensor_id in sensor_to_zone:
                zone_id = sensor_to_zone[sm.sensor_id]
                self.zone_sensor_data[zone_id].append(sm)

    def analyze_all_zones(self) -> List[ZoneAnalysis]:
        analyses = []
        for zone in self.zones:
            analysis = self.analyze_zone(zone)
            analyses.append(analysis)
        return analyses

    def analyze_zone(self, zone: Zone) -> ZoneAnalysis:
        analysis = ZoneAnalysis(
            zone_id=zone.zone_id,
            zone_name=zone.zone_name,
            floor=zone.floor,
        )

        timeline = self._build_timeline(zone)
        analysis.timeline = timeline

        self._calculate_start_delay(analysis, timeline)
        self._calculate_effective_exhaust(analysis, zone, timeline)
        self._detect_sensor_gaps(analysis, zone)
        self._detect_fan_damper_issues(analysis, timeline)
        self._detect_midnight_issues(analysis, timeline)

        return analysis

    def _build_timeline(self, zone: Zone) -> List[TimelineEvent]:
        events = []

        damper_events = self.zone_damper_events.get(zone.zone_id, [])
        for event in damper_events:
            event_type = self._map_damper_event_type(event.event_type)
            if event_type:
                events.append(TimelineEvent(
                    time=event.event_time,
                    event_type=event_type,
                    device_id=event.damper_id,
                    raw_data={"original_event": event.raw_line} if event.raw_line else {},
                ))

        for fan_id in zone.assigned_fans:
            if fan_id in self.fans:
                fan = self.fans[fan_id]
                fan_events = self._extract_fan_events_from_dampers(damper_events, fan_id)
                events.extend(fan_events)

        sensor_data = self.zone_sensor_data.get(zone.zone_id, [])
        for reading in sensor_data:
            if reading.smoke is not None:
                events.append(TimelineEvent(
                    time=reading.timestamp,
                    event_type=EventType.SENSOR_READING,
                    device_id=reading.sensor_id,
                    value=reading.smoke,
                    raw_data={"co2": reading.co2, "temp": reading.temp},
                ))

        events.sort(key=lambda x: x.time)
        return events

    def _map_damper_event_type(self, event_type: str) -> Optional[EventType]:
        et_lower = event_type.lower()
        if "open" in et_lower:
            return EventType.DAMPER_OPEN
        elif "close" in et_lower:
            return EventType.DAMPER_CLOSE
        elif "start" in et_lower or "fan_start" in et_lower:
            return EventType.FAN_START
        elif "stop" in et_lower or "fan_stop" in et_lower:
            return EventType.FAN_STOP
        elif "alarm" in et_lower:
            return EventType.ALARM
        return None

    def _extract_fan_events_from_dampers(
        self,
        damper_events: List[DamperEvent],
        fan_id: str,
    ) -> List[TimelineEvent]:
        events = []
        for event in damper_events:
            et_lower = event.event_type.lower()
            if "fan" in et_lower:
                if "start" in et_lower:
                    events.append(TimelineEvent(
                        time=event.event_time,
                        event_type=EventType.FAN_START,
                        device_id=fan_id,
                        device_name=self.fans[fan_id].fan_name if fan_id in self.fans else "",
                        raw_data={"from_damper_event": event.raw_line} if event.raw_line else {},
                    ))
                elif "stop" in et_lower:
                    events.append(TimelineEvent(
                        time=event.event_time,
                        event_type=EventType.FAN_STOP,
                        device_id=fan_id,
                        device_name=self.fans[fan_id].fan_name if fan_id in self.fans else "",
                    ))
        return events

    def _calculate_start_delay(
        self,
        analysis: ZoneAnalysis,
        timeline: List[TimelineEvent],
    ):
        alarm_time = None
        fan_start_time = None
        damper_open_time = None

        for event in timeline:
            if event.event_type == EventType.ALARM and alarm_time is None:
                alarm_time = event.time
            elif event.event_type == EventType.FAN_START and fan_start_time is None:
                fan_start_time = event.time
            elif event.event_type == EventType.DAMPER_OPEN and damper_open_time is None:
                damper_open_time = event.time

        if alarm_time:
            if fan_start_time:
                delay = (fan_start_time - alarm_time).total_seconds()
                analysis.start_delay_seconds = delay

                if delay > self.MAX_START_DELAY_SECONDS:
                    analysis.add_issue(
                        issue_type=IssueType.DELAY_EXCEEDED,
                        description=f"风机启动延迟超过阈值 {self.MAX_START_DELAY_SECONDS} 秒，实际延迟 {delay:.1f} 秒",
                        time=fan_start_time,
                        delay_seconds=delay,
                        threshold=self.MAX_START_DELAY_SECONDS,
                    )
            else:
                analysis.add_issue(
                    issue_type=IssueType.FAN_NO_DAMPER,
                    description="报警后未检测到风机启动事件",
                    time=alarm_time,
                )

    def _calculate_effective_exhaust(
        self,
        analysis: ZoneAnalysis,
        zone: Zone,
        timeline: List[TimelineEvent],
    ):
        fan_start_time = None
        fan_stop_time = None
        damper_open_time = None
        damper_close_time = None

        for event in timeline:
            if event.event_type == EventType.FAN_START and fan_start_time is None:
                fan_start_time = event.time
            elif event.event_type == EventType.FAN_STOP and fan_stop_time is None:
                fan_stop_time = event.time
            elif event.event_type == EventType.DAMPER_OPEN and damper_open_time is None:
                damper_open_time = event.time
            elif event.event_type == EventType.DAMPER_CLOSE and damper_close_time is None:
                damper_close_time = event.time

        if fan_start_time and damper_open_time:
            effective_start = max(fan_start_time, damper_open_time)

            if fan_stop_time and damper_close_time:
                effective_end = min(fan_stop_time, damper_close_time)
            elif fan_stop_time:
                effective_end = fan_stop_time
            elif damper_close_time:
                effective_end = damper_close_time
            else:
                effective_end = effective_start + timedelta(hours=1)

            duration_minutes = (effective_end - effective_start).total_seconds() / 60

            total_rated_flow = 0
            for fan_id in zone.assigned_fans:
                if fan_id in self.fans:
                    total_rated_flow += self.fans[fan_id].rated_flow

            if total_rated_flow > 0:
                volume = total_rated_flow * duration_minutes / 60
                analysis.effective_exhaust_volume = volume

    def _detect_sensor_gaps(self, analysis: ZoneAnalysis, zone: Zone):
        sensor_data = self.zone_sensor_data.get(zone.zone_id, [])
        if not sensor_data:
            return

        sensors: Dict[str, List[SensorMinute]] = defaultdict(list)
        for sm in sensor_data:
            sensors[sm.sensor_id].append(sm)

        for sensor_id, readings in sensors.items():
            readings.sort(key=lambda x: x.timestamp)

            for i in range(1, len(readings)):
                prev = readings[i - 1]
                curr = readings[i]
                gap = curr.timestamp - prev.timestamp

                if gap > timedelta(minutes=self.SENSOR_GAP_THRESHOLD_MINUTES):
                    gap_minutes = gap.total_seconds() / 60
                    analysis.sensor_gaps.append({
                        "sensor_id": sensor_id,
                        "start_time": prev.timestamp.isoformat(),
                        "end_time": curr.timestamp.isoformat(),
                        "gap_minutes": gap_minutes,
                    })
                    analysis.add_issue(
                        issue_type=IssueType.SENSOR_GAP,
                        description=f"传感器 {sensor_id} 存在数据断采，断采时长 {gap_minutes:.1f} 分钟",
                        time=prev.timestamp,
                        sensor_id=sensor_id,
                        gap_minutes=gap_minutes,
                    )

    def _detect_fan_damper_issues(self, analysis: ZoneAnalysis, timeline: List[TimelineEvent]):
        fan_starts = [e for e in timeline if e.event_type == EventType.FAN_START]
        damper_opens = [e for e in timeline if e.event_type == EventType.DAMPER_OPEN]

        for fan_start in fan_starts:
            has_damper_open_after = any(
                d.time <= fan_start.time + timedelta(seconds=self.MAX_START_DELAY_SECONDS)
                and d.time >= fan_start.time - timedelta(seconds=self.MAX_START_DELAY_SECONDS)
                for d in damper_opens
            )

            if not has_damper_open_after and not damper_opens:
                analysis.add_issue(
                    issue_type=IssueType.FAN_NO_DAMPER,
                    description=f"风机 {fan_start.device_id} 已启动，但未检测到对应阀门打开事件",
                    time=fan_start.time,
                    fan_id=fan_start.device_id,
                )

    def _detect_midnight_issues(self, analysis: ZoneAnalysis, timeline: List[TimelineEvent]):
        if not timeline:
            return

        min_time = min(e.time for e in timeline)
        max_time = max(e.time for e in timeline)
        time_span = max_time - min_time

        if time_span > timedelta(hours=24):
            return

        midnight_events = [
            e for e in timeline
            if e.time.hour == 0 and e.time.minute < 10
        ]

        for event in midnight_events:
            analysis.add_issue(
                issue_type=IssueType.MIDNIGHT_EVENT_MISASSIGNMENT,
                description=f"跨午夜事件可能存在归属错误，请核实事件时间: {event.time}",
                time=event.time,
                event_type=event.event_type.value,
                device_id=event.device_id,
            )


def run_review(
    zones: List[Zone],
    fans: List[Fan],
    damper_events: List[DamperEvent],
    sensor_minutes: List[SensorMinute],
) -> List[ZoneAnalysis]:
    reviewer = SmokeReviewer(zones, fans, damper_events, sensor_minutes)
    return reviewer.analyze_all_zones()
