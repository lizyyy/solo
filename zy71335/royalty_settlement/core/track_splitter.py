from typing import List, Tuple
from ..models import Track, TrackSplit, Issue, IssueCategory, IssueSeverity


class TrackSplitter:
    def __init__(self):
        self.issues: List[Issue] = []

    def split(self, tracks: List[Track], total_duration: int) -> Tuple[List[Track], List[Issue]]:
        self.issues = []
        split_tracks: List[Track] = []

        for track in tracks:
            if track.is_medley and track.medley_tracks:
                split_tracks.extend(self._split_medley(track, total_duration))
            else:
                split_tracks.append(track)

        return split_tracks, self.issues

    def _split_medley(self, medley_track: Track, total_duration: int) -> List[Track]:
        sub_tracks: List[Track] = []
        medley_total = sum(t.duration_seconds for t in medley_track.medley_tracks)

        if medley_total == 0:
            self.issues.append(Issue(
                category=IssueCategory.MEDLEY_SPLIT,
                severity=IssueSeverity.ERROR,
                message=f"串烧曲目[{medley_track.name}]子曲目总时长为0，无法拆分",
                reason="子曲目时长数据缺失或全部为0",
                affected_items=[medley_track.name],
                impact="该串烧曲目将被跳过，相关作者无法获得分账",
                next_steps=[
                    "检查并补全串烧子曲目时长数据",
                    "确认各子曲目实际演出时长",
                    "重新提交分账计算"
                ]
            ))
            return []

        for idx, sub in enumerate(medley_track.medley_tracks):
            ratio = sub.duration_seconds / medley_total if medley_total > 0 else 0
            actual_ratio = sub.duration_seconds / total_duration if total_duration > 0 else 0

            sub_track = Track(
                name=sub.track_name,
                isrc="",
                duration_seconds=sub.duration_seconds,
                is_medley=False,
                authors=medley_track.authors,
                notes=f"来自串烧[{medley_track.name}]，原串烧占比: {ratio:.4f}",
            )
            sub_track.id = f"{medley_track.id}_sub_{idx}"

            sub_tracks.append(sub_track)

        self.issues.append(Issue(
            category=IssueCategory.MEDLEY_SPLIT,
            severity=IssueSeverity.INFO,
            message=f"串烧曲目[{medley_track.name}]已拆分为{len(sub_tracks)}首子曲目",
            reason="串烧曲目需要按子曲目实际时长拆分计算",
            affected_items=[t.name for t in sub_tracks],
            impact=f"拆分后每首子曲目按时长占比参与分账，原串烧总时长{medley_total}秒",
            next_steps=[
                "核对拆分后的子曲目列表是否完整",
                "确认各子曲目作者分成比例是否正确"
            ]
        ))

        return sub_tracks
