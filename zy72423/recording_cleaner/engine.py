import json
import os
import uuid
from typing import Dict, List, Tuple
from datetime import datetime
from .models import (
    Song, Track, WechatSignup, ReviewLog, SongStatus, WeeklyReportItem
)


class RecordingCleanerEngine:
    def __init__(self, data_dir: str = "data"):
        self.data_dir = data_dir
        self.songs: Dict[str, Song] = {}
        self.signups: Dict[str, WechatSignup] = {}
        self.review_logs: List[ReviewLog] = []
        self._ensure_dirs()

    def _ensure_dirs(self):
        os.makedirs(self.data_dir, exist_ok=True)
        os.makedirs(os.path.join(self.data_dir, "contracts"), exist_ok=True)

    def _uid(self) -> str:
        return uuid.uuid4().hex[:8]

    def _log(self, song_id: str, action: str, operator: str, note: str):
        log = ReviewLog(
            log_id=self._uid(),
            song_id=song_id,
            action=action,
            operator=operator,
            note=note
        )
        self.review_logs.append(log)

    def import_wechat_signup(self, raw_text: str, date: str = None) -> WechatSignup:
        if date is None:
            date = datetime.now().strftime("%Y-%m-%d")

        signup = WechatSignup(
            signup_id=self._uid(),
            raw_text=raw_text,
            date=date,
            songs_raw=[]
        )

        lines = [l.strip() for l in raw_text.strip().split("\n") if l.strip()]
        for line in lines:
            parts = [p.strip() for p in line.split("|") if p.strip()]
            if len(parts) >= 2:
                song_name = parts[0]
                track_info = parts[1] if len(parts) > 1 else ""
                signup.songs_raw.append({
                    "song_name": song_name,
                    "track_info": track_info,
                    "raw_line": line
                })

        self.signups[signup.signup_id] = signup
        return signup

    def process_signup(self, signup_id: str) -> List[Song]:
        signup = self.signups[signup_id]
        created_songs = []

        for item in signup.songs_raw:
            song_name_raw = item["song_name"]
            scene_name, copyright_name = self._parse_dual_name(song_name_raw)

            existing_song = None
            for s in self.songs.values():
                if s.scene_name == scene_name or (s.copyright_name and s.copyright_name == scene_name):
                    existing_song = s
                    break

            track = Track(
                track_id=self._uid(),
                track_name=item["track_info"] or "主音轨",
                song_name_raw=song_name_raw,
                song_name_scene=scene_name,
                song_name_copyright=copyright_name,
                source=f"接龙-{signup.date}"
            )

            if existing_song:
                existing_song.tracks.append(track)
                if copyright_name and not existing_song.copyright_name:
                    existing_song.copyright_name = copyright_name
                if scene_name and copyright_name and scene_name != copyright_name:
                    existing_song.has_dual_name = True
                    if existing_song.status == SongStatus.NORMAL:
                        existing_song.status = SongStatus.PENDING_REVIEW
                    self._log(
                        existing_song.song_id,
                        "检测到同名异名",
                        "系统",
                        f"现场名「{scene_name}」与版权名「{copyright_name}」对应同一首歌，待音乐老师复核"
                    )
            else:
                has_dual = scene_name != copyright_name if copyright_name else False
                status = SongStatus.PENDING_REVIEW if has_dual else SongStatus.NORMAL

                song = Song(
                    song_id=self._uid(),
                    scene_name=scene_name,
                    copyright_name=copyright_name,
                    tracks=[track],
                    status=status,
                    has_dual_name=has_dual
                )
                self.songs[song.song_id] = song
                created_songs.append(song)

                if has_dual:
                    self._log(
                        song.song_id,
                        "新建并标记同名",
                        "系统",
                        f"导入时检测到现场名「{scene_name}」和版权名「{copyright_name}」，已标记待复核"
                    )

        return created_songs

    def _parse_dual_name(self, name: str) -> Tuple[str, str]:
        name = name.strip()
        scene_name = name
        copyright_name = None

        if "又名" in name:
            parts = name.split("又名", 1)
            scene_name = parts[0].strip()
            copyright_name = parts[1].strip()
            copyright_name = self._clean_copyright_name(copyright_name)
            return scene_name, copyright_name

        bracket_patterns = [
            ("（", "）"),
            ("(", ")"),
            ("【", "】"),
            ("[", "]"),
        ]

        for left, right in bracket_patterns:
            if left in name and right in name:
                start = name.index(left)
                end = name.rindex(right)
                if start > 0 and end > start:
                    scene_name = name[:start].strip()
                    in_bracket = name[start+1:end].strip()
                    clean = self._extract_copyright_from_text(in_bracket)
                    if clean:
                        copyright_name = clean
                        return scene_name, copyright_name

        if "/" in name:
            parts = name.split("/", 1)
            scene_name = parts[0].strip()
            rest = parts[1].strip()
            clean = self._clean_copyright_name(rest)
            if clean:
                copyright_name = clean

        if "／" in name:
            parts = name.split("／", 1)
            scene_name = parts[0].strip()
            rest = parts[1].strip()
            clean = self._clean_copyright_name(rest)
            if clean:
                copyright_name = clean

        return scene_name, copyright_name

    def _extract_copyright_from_text(self, text: str) -> str:
        text = text.strip()
        prefixes = ["版权名：", "版权名:", "版权登记名：", "版权登记名:", "版权：", "版权:"]
        for prefix in prefixes:
            if prefix in text:
                text = text.split(prefix, 1)[1].strip()
                break
        return self._clean_copyright_name(text)

    def _clean_copyright_name(self, name: str) -> str:
        if not name:
            return ""
        name = name.strip()
        name = name.strip("《》「」""''")
        name = name.rstrip("）)】]")
        return name.strip()

    def teacher_review(self, song_id: str, approved: bool, reviewer: str, note: str = ""):
        song = self.songs[song_id]
        if approved:
            song.status = SongStatus.PENDING_CONTRACT
            song.reviewer = reviewer
            song.review_note = note
            self._log(song_id, "音乐老师复核通过", reviewer, note or "确认现场名与版权名对应同一首歌")
        else:
            song.status = SongStatus.NORMAL
            song.has_dual_name = False
            song.reviewer = reviewer
            song.review_note = note
            self._log(song_id, "音乐老师驳回", reviewer, note or "经核实并非同一首歌")

    def add_contract_screenshot(self, song_id: str, screenshot_path: str, operator: str = "小鹿"):
        song = self.songs[song_id]
        song.contract_screenshot = screenshot_path
        if song.status == SongStatus.PENDING_CONTRACT:
            song.status = SongStatus.COMPLETED
        self._log(song_id, "补录合同页截图", operator, f"已上传合同截图：{screenshot_path}")

    def manual_fix_song_name(self, song_id: str, scene_name: str = None, copyright_name: str = None, operator: str = "小鹿"):
        song = self.songs[song_id]
        old_scene = song.scene_name
        old_copy = song.copyright_name
        if scene_name:
            song.scene_name = scene_name
        if copyright_name:
            song.copyright_name = copyright_name
        song.has_dual_name = song.scene_name != (song.copyright_name or "")
        self._log(
            song_id,
            "人工修正歌名",
            operator,
            f"现场名「{old_scene}」→「{song.scene_name}」，版权名「{old_copy}」→「{song.copyright_name}」"
        )

    def rerun_processing(self):
        for song in self.songs.values():
            scene, copy_ = song.scene_name, song.copyright_name
            if copy_ and scene != copy_:
                song.has_dual_name = True
                if song.status == SongStatus.NORMAL:
                    song.status = SongStatus.PENDING_REVIEW
                    self._log(song.song_id, "重跑检测到同名", "系统", "重跑后发现现场名与版权名不一致")

    def generate_weekly_report(self) -> List[WeeklyReportItem]:
        items = []
        for song in self.songs.values():
            why_kept = self._why_kept(song)
            missing = self._missing_materials(song)
            next_person, next_detail = self._next_step(song)

            items.append(WeeklyReportItem(
                song_scene_name=song.scene_name,
                song_copyright_name=song.copyright_name,
                status=song.status,
                why_kept=why_kept,
                missing_materials=missing,
                next_step_person=next_person,
                next_step_detail=next_detail
            ))
        return items

    def _why_kept(self, song: Song) -> str:
        if song.status == SongStatus.COMPLETED:
            if song.has_dual_name:
                return "材料齐全，音乐老师已确认同名关系，合同截图已补录，已完成备注清洗"
            return "材料齐全，已完成备注清洗，可以正常使用"
        if song.status == SongStatus.PENDING_CONTRACT:
            return "音乐老师已确认同名对应关系，但合同页截图尚未补录"
        if song.status == SongStatus.PENDING_REVIEW:
            return "同一首歌同时存在现场用名和版权登记名，需音乐老师确认后才能归为正常入库"
        return "单名歌曲，无特殊清洗需求"

    def _missing_materials(self, song: Song) -> List[str]:
        missing = []
        if song.has_dual_name and song.status == SongStatus.PENDING_REVIEW:
            missing.append("音乐老师复核签字")
        if not song.contract_screenshot:
            missing.append("版权合同页截图")
        if not song.review_note and song.has_dual_name:
            missing.append("复核意见记录")
        return missing

    def _next_step(self, song: Song) -> Tuple[str, str]:
        if song.status == SongStatus.PENDING_REVIEW:
            return "音乐老师", "请尽快复核现场名与版权名是否为同一首歌，确认后小鹿补合同"
        if song.status == SongStatus.PENDING_CONTRACT:
            return "版权运营小鹿", "音乐老师已复核通过，请查找并补录对应歌曲的版权合同页截图"
        if song.status == SongStatus.COMPLETED:
            return "无需处理", "所有材料齐全，已完成清洗流程"
        return "无需处理", "正常歌曲，无后续步骤"

    def save_state(self, path: str = None):
        if path is None:
            path = os.path.join(self.data_dir, "state.json")

        songs_data = {}
        for sid, song in self.songs.items():
            songs_data[sid] = {
                "song_id": song.song_id,
                "scene_name": song.scene_name,
                "copyright_name": song.copyright_name,
                "tracks": [
                    {
                        "track_id": t.track_id,
                        "track_name": t.track_name,
                        "song_name_raw": t.song_name_raw,
                        "song_name_scene": t.song_name_scene,
                        "song_name_copyright": t.song_name_copyright,
                        "remark": t.remark,
                        "source": t.source
                    } for t in song.tracks
                ],
                "status": song.status.value,
                "has_dual_name": song.has_dual_name,
                "contract_screenshot": song.contract_screenshot,
                "review_note": song.review_note,
                "reviewer": song.reviewer,
                "created_at": song.created_at.isoformat()
            }

        signups_data = {}
        for sid, signup in self.signups.items():
            signups_data[sid] = {
                "signup_id": signup.signup_id,
                "raw_text": signup.raw_text,
                "date": signup.date,
                "songs_raw": signup.songs_raw
            }

        logs_data = []
        for log in self.review_logs:
            logs_data.append({
                "log_id": log.log_id,
                "song_id": log.song_id,
                "action": log.action,
                "operator": log.operator,
                "note": log.note,
                "timestamp": log.timestamp.isoformat()
            })

        state = {
            "songs": songs_data,
            "signups": signups_data,
            "review_logs": logs_data
        }

        with open(path, "w", encoding="utf-8") as f:
            json.dump(state, f, ensure_ascii=False, indent=2)

    def load_state(self, path: str = None):
        if path is None:
            path = os.path.join(self.data_dir, "state.json")
        if not os.path.exists(path):
            return

        with open(path, "r", encoding="utf-8") as f:
            state = json.load(f)

        for sid, sdata in state["songs"].items():
            sdata["status"] = SongStatus(sdata["status"])
            if "created_at" in sdata:
                sdata["created_at"] = datetime.fromisoformat(sdata["created_at"])
            tracks = []
            for t in sdata.get("tracks", []):
                tracks.append(Track(**t))
            sdata["tracks"] = tracks
            self.songs[sid] = Song(**sdata)

        for sid, sdata in state["signups"].items():
            self.signups[sid] = WechatSignup(**sdata)

        for ldata in state["review_logs"]:
            if "timestamp" in ldata:
                ldata["timestamp"] = datetime.fromisoformat(ldata["timestamp"])
            self.review_logs.append(ReviewLog(**ldata))
