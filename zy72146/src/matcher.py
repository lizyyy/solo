from typing import List, Dict
from collections import defaultdict
from .models import TrackRecord, AudioFile, TrackStatus, AnomalyType


class TrackMatcher:
    def __init__(self, tracks: List[TrackRecord], audio_files: List[AudioFile]):
        self.tracks = tracks
        self.audio_files = audio_files
        self.all_audios_by_id: Dict[str, List[AudioFile]] = self._build_audio_index()

    def _build_audio_index(self) -> Dict[str, List[AudioFile]]:
        index: Dict[str, List[AudioFile]] = defaultdict(list)
        for af in self.audio_files:
            if af.parsed_track_id:
                index[af.parsed_track_id].append(af)
        return dict(index)

    @staticmethod
    def _score_audio(track: TrackRecord, audio: AudioFile) -> int:
        score = 0
        if audio.is_valid:
            score += 1000
        if audio.parsed_track_name and track.track_name and audio.parsed_track_name == track.track_name:
            score += 100
        if audio.parsed_student_name and track.student_name and audio.parsed_student_name == track.student_name:
            score += 50
        return score

    def _sorted_candidate_audios(self, track: TrackRecord,
                                  available_audios: set) -> List[AudioFile]:
        candidates = [
            af for af in self.all_audios_by_id.get(track.track_id, [])
            if id(af) in available_audios
        ]
        candidates.sort(key=lambda af: (-self._score_audio(track, af), -af.file_size))
        return candidates

    def match_all(self) -> List[TrackRecord]:
        available_audios = {id(af) for af in self.audio_files}

        track_audios_count = [
            (len(self.all_audios_by_id.get(t.track_id, [])), i, t)
            for i, t in enumerate(self.tracks)
        ]
        track_audios_count.sort(key=lambda x: (x[0], x[1]))

        for _, _, track in track_audios_count:
            self._match_track(track, available_audios)

        for track in self.tracks:
            if not track.audio_file:
                all_candidates = self.all_audios_by_id.get(track.track_id, [])
                if all_candidates:
                    already_used = [af for af in all_candidates if id(af) not in available_audios]
                    if already_used:
                        track.add_anomaly(
                            AnomalyType.DUPLICATE_TRACK,
                            f"找到 {len(all_candidates)} 个候选音频，但已被其他曲目占用（可能是编号重复）"
                        )

        return self.tracks

    def _match_track(self, track: TrackRecord, available_audios: set):
        track.log(f"开始匹配曲目: {track.track_id} (曲目='{track.track_name}', 学生='{track.student_name}')")

        all_candidates = self.all_audios_by_id.get(track.track_id, [])
        candidates = self._sorted_candidate_audios(track, available_audios)

        if not all_candidates:
            track.status = TrackStatus.UNMATCHED
            track.add_anomaly(AnomalyType.MISSING_AUDIO, "未找到对应的音频文件")
            track.log("匹配结果: 未找到音频文件")
            return

        if len(all_candidates) > 1:
            names = ", ".join([f"{af.file_name}({'可用' if af.is_valid else '损坏'})" for af in all_candidates])
            track.log(f"  候选音频共 {len(all_candidates)} 个: {names}")

        if not candidates:
            track.status = TrackStatus.UNMATCHED
            track.add_anomaly(
                AnomalyType.MISSING_AUDIO,
                f"同编号有 {len(all_candidates)} 个音频，但已全部分配给其他曲目（编号重复）"
            )
            track.log("匹配结果: 候选音频已被其他曲目占用")
            return

        best_match = candidates[0]

        score_detail = []
        if best_match.is_valid:
            score_detail.append("可用音频")
        if best_match.parsed_track_name and best_match.parsed_track_name == track.track_name:
            score_detail.append("曲目名匹配")
        if best_match.parsed_student_name and best_match.parsed_student_name == track.student_name:
            score_detail.append("学生名匹配")

        track.audio_file = best_match.file_path
        track.matched_audio_name = best_match.file_name + best_match.extension
        track.matched_audio_size = best_match.file_size
        track.matched_audio_valid = best_match.is_valid
        track.status = TrackStatus.MATCHED

        available_audios.discard(id(best_match))

        track.log(
            f"匹配结果: 选中 '{track.matched_audio_name}' "
            f"(大小={best_match.file_size}字节, {'可用' if best_match.is_valid else '损坏'}) "
            f"评分理由: {', '.join(score_detail) if score_detail else '默认选择'}"
        )

        if not best_match.is_valid:
            track.add_anomaly(
                AnomalyType.CORRUPTED_FILE,
                f"音频文件可能损坏: {track.matched_audio_name} (大小={best_match.file_size}字节)"
            )

        if (best_match.parsed_track_name
                and track.track_name
                and best_match.parsed_track_name != track.track_name):
            track.add_anomaly(
                AnomalyType.NAME_MISMATCH,
                f"Excel曲目名称 '{track.track_name}' vs 文件名解析 '{best_match.parsed_track_name}'"
            )

        if (best_match.parsed_student_name
                and track.student_name
                and best_match.parsed_student_name != track.student_name):
            track.add_anomaly(
                AnomalyType.NAME_MISMATCH,
                f"Excel学生姓名 '{track.student_name}' vs 文件名解析 '{best_match.parsed_student_name}'"
            )

        if "old" in best_match.file_name.lower() or "旧版" in best_match.file_name:
            track.add_anomaly(AnomalyType.OLD_MASTER, "音频文件名包含旧版标识")
