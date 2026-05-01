from typing import Dict, List, Tuple
from data_importer import ChannelInfo, Cue, ShowData


class ChannelMapper:
    def __init__(self, show_data: ShowData):
        self.show_data = show_data
        self.patch_map = self._build_patch_map()
        self.cue_map = self._build_cue_map()

    def _build_patch_map(self) -> Dict[str, Dict[str, int]]:
        patch_map = {}
        for channel in self.show_data.patch:
            if channel.fixture_id not in patch_map:
                patch_map[channel.fixture_id] = {}
            patch_map[channel.fixture_id][channel.channel_name] = channel.dmx_channel
        return patch_map

    def _build_cue_map(self) -> Dict[str, Cue]:
        return {cue.cue_id: cue for cue in self.show_data.cues}

    def get_dmx_channel(self, fixture_id: str, channel_name: str) -> int:
        if fixture_id in self.patch_map and channel_name in self.patch_map[fixture_id]:
            return self.patch_map[fixture_id][channel_name]
        return -1

    def get_channel_info(self, dmx_channel: int) -> List[ChannelInfo]:
        return [ch for ch in self.show_data.patch if ch.dmx_channel == dmx_channel]

    def get_fixture_channel_names(self, fixture_id: str) -> List[str]:
        if fixture_id in self.patch_map:
            return list(self.patch_map[fixture_id].keys())
        return []

    def get_all_fixture_ids(self) -> List[str]:
        return list(self.patch_map.keys())

    def get_all_dmx_channels(self) -> List[int]:
        return sorted(list(set(ch.dmx_channel for ch in self.show_data.patch)))

    def get_cue(self, cue_id: str) -> Cue:
        return self.cue_map.get(cue_id)

    def get_all_cue_ids(self) -> List[str]:
        return list(self.cue_map.keys())
