from datetime import datetime
from typing import Dict, List, Any, Optional
from .models import (
    RaceConfig, Registration, TimingRecord, AidStationConsumption, MedicalEvent,
    RunnerStatus, AidStationCheck, MedicalEventCheck
)


class CheckpointValidator:
    def __init__(self, race_config: RaceConfig):
        self.race_config = race_config
        self.checkpoints = sorted(
            race_config.checkpoints,
            key=lambda cp: cp.distance_km
        )
        self.cp_order = [cp.cp_id for cp in self.checkpoints]
        self.cp_map = {cp.cp_id: cp for cp in self.checkpoints}

    def validate_runner(
        self,
        registration: Registration,
        timing_records: List[TimingRecord],
        medical_events: List[MedicalEvent]
    ) -> RunnerStatus:
        records_by_cp: Dict[str, TimingRecord] = {}
        for record in timing_records:
            if record.checkpoint_id not in records_by_cp:
                records_by_cp[record.checkpoint_id] = record
            else:
                if record.timestamp < records_by_cp[record.checkpoint_id].timestamp:
                    records_by_cp[record.checkpoint_id] = record

        visited_cps = list(records_by_cp.keys())
        missing_cps = [cp for cp in self.cp_order if cp not in visited_cps]

        start_record = records_by_cp.get("CP0")
        end_record = records_by_cp.get("CP4")

        cutoff_violations: List[str] = []
        for cp_id, record in records_by_cp.items():
            cp = self.cp_map.get(cp_id)
            if cp and record.timestamp > cp.cutoff_time:
                cutoff_violations.append(
                    f"{cp_id} ({cp.name}): 到达时间 {record.timestamp.strftime('%H:%M:%S')} "
                    f"超过关门时间 {cp.cutoff_time.strftime('%H:%M:%S')}"
                )

        race_status = "unknown"
        if not start_record:
            race_status = "未出发"
        elif end_record and not missing_cps and not cutoff_violations:
            race_status = "完赛"
        elif end_record and (missing_cps or cutoff_violations):
            race_status = "完赛(需复核)"
        elif not end_record and start_record:
            if cutoff_violations:
                race_status = "超时退赛"
            else:
                race_status = "未完成"

        total_time = None
        if start_record and end_record:
            total_time = (end_record.timestamp - start_record.timestamp).total_seconds()

        medical_event_ids = [event.event_id for event in medical_events]

        return RunnerStatus(
            bib=registration.bib,
            name=registration.name,
            category=registration.category,
            chip_id=registration.chip_id,
            registered=True,
            start_time=start_record.timestamp if start_record else None,
            end_time=end_record.timestamp if end_record else None,
            checkpoints_visited=visited_cps,
            checkpoints_missing=missing_cps,
            cutoff_violations=cutoff_violations,
            race_status=race_status,
            total_time_seconds=total_time,
            medical_events=medical_event_ids,
            review_status="pending",
            review_notes="",
        )

    def validate_all_runners(
        self,
        registrations: List[Registration],
        timing_records: List[TimingRecord],
        medical_events: List[MedicalEvent]
    ) -> List[RunnerStatus]:
        records_by_bib: Dict[str, List[TimingRecord]] = {}
        for record in timing_records:
            if record.bib not in records_by_bib:
                records_by_bib[record.bib] = []
            records_by_bib[record.bib].append(record)

        medical_by_bib: Dict[str, List[MedicalEvent]] = {}
        for event in medical_events:
            if event.bib not in medical_by_bib:
                medical_by_bib[event.bib] = []
            medical_by_bib[event.bib].append(event)

        results: List[RunnerStatus] = []
        for reg in registrations:
            runner_records = records_by_bib.get(reg.bib, [])
            runner_medical = medical_by_bib.get(reg.bib, [])
            results.append(self.validate_runner(reg, runner_records, runner_medical))

        return results


class AidStationValidator:
    def __init__(self, race_config: RaceConfig):
        self.race_config = race_config
        self.aid_stations = race_config.aid_stations
        self.station_map = {s.station_id: s for s in self.aid_stations}

    def validate_consumptions(
        self,
        consumptions: List[AidStationConsumption]
    ) -> List[AidStationCheck]:
        consumption_by_station: Dict[str, List[AidStationConsumption]] = {}
        for cons in consumptions:
            if cons.station_id not in consumption_by_station:
                consumption_by_station[cons.station_id] = []
            consumption_by_station[cons.station_id].append(cons)

        results: List[AidStationCheck] = []
        for station in self.aid_stations:
            station_consumptions = consumption_by_station.get(station.station_id, [])
            
            total_consumed: Dict[str, float] = {}
            for item_name in station.expected_items.keys():
                total_consumed[item_name] = 0.0

            anomalies: List[str] = []
            prev_consumed: Dict[str, float] = {}
            
            sorted_consumptions = sorted(station_consumptions, key=lambda c: c.recorded_at)
            
            for cons in sorted_consumptions:
                for item_name, amount in cons.consumed_items.items():
                    if item_name not in prev_consumed:
                        prev_consumed[item_name] = 0.0
                    
                    if amount < 0:
                        anomalies.append(
                            f"{cons.recorded_at.strftime('%H:%M')}: {item_name} 记录为负数 ({amount})"
                        )
                    
                    if amount < prev_consumed.get(item_name, 0):
                        anomalies.append(
                            f"{cons.recorded_at.strftime('%H:%M')}: {item_name} 消耗量减少 "
                            f"(从 {prev_consumed[item_name]} 到 {amount})"
                        )
                    
                    total_consumed[item_name] = max(total_consumed.get(item_name, 0), amount)
                    prev_consumed[item_name] = amount

            for item_name, expected in station.expected_items.items():
                actual = total_consumed.get(item_name, 0)
                if actual > expected * 1.2:
                    anomalies.append(
                        f"{item_name}: 实际消耗 {actual} 超过预期 {expected} 的20%"
                    )
                if actual > 0 and actual < expected * 0.3:
                    anomalies.append(
                        f"{item_name}: 实际消耗 {actual} 远低于预期 {expected} (不足30%)"
                    )

            results.append(AidStationCheck(
                station_id=station.station_id,
                station_name=station.name,
                expected_items=station.expected_items.copy(),
                total_consumed=total_consumed,
                anomalies=anomalies,
                review_status="pending" if anomalies else "ok",
            ))

        return results


class MedicalEventValidator:
    def __init__(self, race_config: RaceConfig):
        self.race_config = race_config

    def validate_events(
        self,
        medical_events: List[MedicalEvent],
        registrations: List[Registration]
    ) -> List[MedicalEventCheck]:
        reg_map = {reg.bib: reg for reg in registrations}

        results: List[MedicalEventCheck] = []
        for event in medical_events:
            runner_name = reg_map.get(event.bib, type("obj", (), {"name": "未知"})()).name
            
            review_status = "pending"
            if event.needs_follow_up:
                if event.severity == "severe":
                    review_status = "urgent"
                else:
                    review_status = "follow_up_needed"
            else:
                review_status = "ok"

            results.append(MedicalEventCheck(
                event_id=event.event_id,
                bib=event.bib,
                runner_name=runner_name,
                severity=event.severity,
                status=event.status,
                needs_follow_up=event.needs_follow_up,
                review_status=review_status,
                follow_up_contacted=False,
                follow_up_notes="",
            ))

        return results
