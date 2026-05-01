from typing import Dict, List, Tuple
from data_importer import Cue, ShowData, TimelineItem
from channel_mapper import ChannelMapper


class Interpolator:
    def __init__(self, show_data: ShowData, mapper: ChannelMapper):
        self.show_data = show_data
        self.mapper = mapper

    def get_active_cues(self, time: float) -> List[Tuple[TimelineItem, Cue]]:
        active = []
        for item in self.show_data.timeline:
            if item.start_time <= time <= item.end_time:
                cue = self.mapper.get_cue(item.cue_id)
                if cue:
                    active.append((item, cue))
        return active

    def calculate_cue_weight(self, item: TimelineItem, cue: Cue, time: float) -> float:
        time_in_cue = time - item.start_time
        cue_duration = item.end_time - item.start_time

        if time_in_cue <= cue.fade_in:
            return time_in_cue / cue.fade_in if cue.fade_in > 0 else 1.0

        if time_in_cue >= cue_duration - cue.fade_out:
            if cue.fade_out > 0:
                return max(0.0, 1.0 - (time_in_cue - (cue_duration - cue.fade_out)) / cue.fade_out)
            return 1.0

        return 1.0

    def interpolate_channel_value(self, cue: Cue, fixture_id: str, channel_name: str, weight: float) -> int:
        if fixture_id in cue.fixture_values and channel_name in cue.fixture_values[fixture_id]:
            target_value = cue.fixture_values[fixture_id][channel_name]
            return int(round(target_value * weight))
        return 0

    def get_channel_value_at_time(self, fixture_id: str, channel_name: str, time: float) -> int:
        active_items = self.get_active_cues(time)
        if not active_items:
            return 0

        values = []
        for item, cue in active_items:
            weight = self.calculate_cue_weight(item, cue, time)
            val = self.interpolate_channel_value(cue, fixture_id, channel_name, weight)
            if weight > 0:
                values.append((val, weight))

        if not values:
            return 0

        total_weight = sum(w for _, w in values)
        if total_weight == 0:
            return 0

        weighted_value = sum(v * w for v, w in values) / total_weight
        return int(round(weighted_value))

    def get_all_channel_values_at_time(self, time: float) -> Dict[str, Dict[str, int]]:
        result = {}
        for fixture_id in self.mapper.get_all_fixture_ids():
            result[fixture_id] = {}
            for channel_name in self.mapper.get_fixture_channel_names(fixture_id):
                result[fixture_id][channel_name] = self.get_channel_value_at_time(
                    fixture_id, channel_name, time
                )
        return result
