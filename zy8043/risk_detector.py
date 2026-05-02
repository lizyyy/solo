from typing import Dict, List, Set, Tuple
from dataclasses import dataclass
from data_importer import ShowData, ChannelInfo
from channel_mapper import ChannelMapper


@dataclass
class Risk:
    severity: str
    type: str
    message: str
    time_range: Tuple[float, float] = None
    dmx_channel: int = None
    fixture_id: str = None
    cue_id: str = None


class RiskDetector:
    def __init__(self, show_data: ShowData, mapper: ChannelMapper):
        self.show_data = show_data
        self.mapper = mapper

    def detect_all_risks(self) -> List[Risk]:
        risks = []
        risks.extend(self._detect_channel_conflicts())
        risks.extend(self._detect_unknown_fixtures())
        risks.extend(self._detect_timeline_overlaps())
        return risks

    def _detect_channel_conflicts(self) -> List[Risk]:
        risks = []
        channel_groups: Dict[int, List[ChannelInfo]] = {}

        for channel in self.show_data.patch:
            if channel.dmx_channel not in channel_groups:
                channel_groups[channel.dmx_channel] = []
            channel_groups[channel.dmx_channel].append(channel)

        for dmx_channel, channels in channel_groups.items():
            if len(channels) > 1:
                fixture_names = ", ".join(f"{ch.fixture_id} ({ch.channel_name})" for ch in channels)
                risks.append(Risk(
                    severity="HIGH",
                    type="CHANNEL_CONFLICT",
                    message=f"DMX 通道 {dmx_channel} 被多个灯具/通道占用: {fixture_names}",
                    dmx_channel=dmx_channel
                ))
        return risks

    def _detect_unknown_fixtures(self) -> List[Risk]:
        risks = []
        known_fixtures = set(self.mapper.get_all_fixture_ids())

        for cue in self.show_data.cues:
            for fixture_id in cue.fixture_values:
                if fixture_id not in known_fixtures:
                    risks.append(Risk(
                        severity="MEDIUM",
                        type="UNKNOWN_FIXTURE",
                        message=f"Cue {cue.cue_id} 引用了未知灯具: {fixture_id}",
                        cue_id=cue.cue_id,
                        fixture_id=fixture_id
                    ))
        return risks

    def _detect_timeline_overlaps(self) -> List[Risk]:
        risks = []
        timeline = self.show_data.timeline

        for i in range(len(timeline)):
            for j in range(i + 1, len(timeline)):
                item1 = timeline[i]
                item2 = timeline[j]

                overlap_start = max(item1.start_time, item2.start_time)
                overlap_end = min(item1.end_time, item2.end_time)

                if overlap_start < overlap_end:
                    risks.append(Risk(
                        severity="INFO",
                        type="TIME_OVERLAP",
                        message=f"Cues {item1.cue_id} 和 {item2.cue_id} 时间重叠: {overlap_start:.1f}s - {overlap_end:.1f}s",
                        time_range=(overlap_start, overlap_end),
                        cue_id=f"{item1.cue_id}+{item2.cue_id}"
                    ))
        return risks

    def get_risks_at_time(self, time: float) -> List[Risk]:
        all_risks = self.detect_all_risks()
        relevant_risks = []

        for risk in all_risks:
            if risk.type == "TIME_OVERLAP" and risk.time_range:
                if risk.time_range[0] <= time <= risk.time_range[1]:
                    relevant_risks.append(risk)
            else:
                relevant_risks.append(risk)

        return relevant_risks

    def export_risks_csv(self, file_path: str):
        import csv
        risks = self.detect_all_risks()

        with open(file_path, 'w', encoding='utf-8', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=[
                'severity', 'type', 'message', 'time_range', 'dmx_channel', 'fixture_id', 'cue_id'
            ])
            writer.writeheader()
            for risk in risks:
                writer.writerow({
                    'severity': risk.severity,
                    'type': risk.type,
                    'message': risk.message,
                    'time_range': f"{risk.time_range[0]:.1f}-{risk.time_range[1]:.1f}" if risk.time_range else '',
                    'dmx_channel': risk.dmx_channel or '',
                    'fixture_id': risk.fixture_id or '',
                    'cue_id': risk.cue_id or ''
                })

    def export_summary_md(self, file_path: str):
        risks = self.detect_all_risks()
        high = sum(1 for r in risks if r.severity == "HIGH")
        medium = sum(1 for r in risks if r.severity == "MEDIUM")
        info = sum(1 for r in risks if r.severity == "INFO")

        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(f"# {self.show_data.show_name} - 演出预演报告\n\n")
            f.write(f"## 风险统计\n\n")
            f.write(f"- 严重 (HIGH): {high}\n")
            f.write(f"- 中等 (MEDIUM): {medium}\n")
            f.write(f"- 提示 (INFO): {info}\n\n")
            f.write("## 详细风险\n\n")

            for risk in risks:
                f.write(f"### [{risk.severity}] {risk.type}\n\n")
                f.write(f"{risk.message}\n\n")
