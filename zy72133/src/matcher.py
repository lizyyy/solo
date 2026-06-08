import re
import difflib
from datetime import datetime
from pathlib import Path as FilePath
from typing import List, Dict, Optional
from collections import defaultdict

from .models import TrackRecord, AudioFile, MatchResult, TrackStatus, ExceptionType
from .audit_log import AuditLog


class TrackMatcher:
    VERSION_SUFFIXES = [
        r'remix', r'radio\s*edit', r'extended', r'club\s*mix',
        r'dub\s*mix', r'instrumental', r'acoustic', r'live',
        r'原版', r'新版', r'母带', r'混音',
    ]

    VERSION_PAREN_CONTENT = [
        r'old\s*version', r'final\s*master', r'original\s*mix',
        r'radio\s*edit', r'extended\s*mix', r'club\s*mix',
        r'remix', r'demo', r'preview',
        r'原版', r'新版', r'母带', r'混音版',
    ]

    def __init__(self, config: Dict, audit_log: AuditLog):
        self.config = config
        self.audit_log = audit_log
        self.fuzzy_threshold = config.get('matching', {}).get('fuzzy_match_threshold', 0.60)
        self.version_patterns = config.get('matching', {}).get('version_patterns', [])
        self.license_keywords = config.get('exceptions', {}).get('license_keywords', [])

    def match_tracks(self, tracks: List[TrackRecord], audio_files: List[AudioFile],
                     operator: str = "系统") -> List[MatchResult]:

        self.audit_log.log(
            operator=operator,
            action="开始匹配",
            reason=f"开始匹配 {len(tracks)} 条曲目与 {len(audio_files)} 个音频文件",
            source="匹配器"
        )

        results = []
        used_files = set()

        for track in tracks:
            match_result = self._match_single_track(track, audio_files, used_files)
            results.append(match_result)

            if match_result.audio_file:
                used_files.add(match_result.audio_file.file_path)

        unmatched_files = [af for af in audio_files if af.file_path not in used_files]
        for af in unmatched_files:
            orphan_result = MatchResult(
                track=TrackRecord(
                    track_id=f"unknown_{af.file_name}",
                    title=af.title or af.file_name,
                    artist=af.artist or "未知"
                ),
                audio_file=af,
                status=TrackStatus.UNMATCHED,
                match_confidence=0.0,
                match_notes=f"音频文件无对应曲目记录: {af.file_name}"
            )
            results.append(orphan_result)

        self._detect_version_families(results)

        self._assign_final_status(results)

        matched_count = sum(1 for r in results if r.status == TrackStatus.MATCHED)
        self.audit_log.log(
            operator=operator,
            action="匹配完成",
            reason=f"匹配完成: 成功匹配 {matched_count} 条, 异常 {len(results) - matched_count} 条",
            source="匹配器"
        )

        return results

    def _match_single_track(self, track: TrackRecord, audio_files: List[AudioFile],
                            used_files: set) -> MatchResult:

        best_match = None
        best_score = 0.0
        exceptions = []
        exception_details = {}

        for af in audio_files:
            if af.file_path in used_files:
                continue

            score = self._calculate_match_score(track, af)

            if score > best_score:
                best_score = score
                best_match = af

        result = MatchResult(
            track=track,
            audio_file=best_match,
            status=TrackStatus.UNMATCHED,
            match_confidence=best_score,
            exceptions=[],
            exception_details={}
        )

        if best_match and best_score >= self.fuzzy_threshold:
            result.status = TrackStatus.MATCHED
            result.match_notes = f"匹配成功，置信度: {best_score:.2f}"

            filename_match = self._check_filename_match(track, best_match)
            if not filename_match:
                exceptions.append(ExceptionType.FILENAME_MISMATCH)
                exception_details['filename_mismatch'] = {
                    'expected': f"{track.artist} - {track.title}",
                    'actual': best_match.file_name,
                    'suggestion': "文件名与曲名不匹配，检查是否人工改名"
                }

                has_rename_evidence = (
                    (track.notes and '改名' in track.notes) or
                    not self._title_in_filename(track, best_match)
                )
                if has_rename_evidence:
                    exceptions.append(ExceptionType.RENAMED)
                    exception_details['renamed'] = {
                        'fuzzy_score': best_score,
                        'evidence': (
                            f"曲名 '{track.title}' 在文件名 '{best_match.file_name}' 中"
                            f"找不到对应文本"
                        ),
                        'suggestion': "确认是否为人工改名，建议统一命名"
                    }

            if not self._check_license(track):
                exceptions.append(ExceptionType.MISSING_LICENSE)
                exception_details['missing_license'] = {
                    'license_info': track.license_info or "(空)",
                    'suggestion': "请确认授权状态后再使用"
                }

        else:
            result.match_notes = "未找到匹配的音频文件"

        result.exceptions = exceptions
        result.exception_details = exception_details

        return result

    def _title_in_filename(self, track: TrackRecord, audio: AudioFile) -> bool:
        base_title = self._normalize_text(self._compute_base_name(track.title))
        filename_norm = self._normalize_text(FilePath(audio.file_name).stem)
        if base_title and base_title in filename_norm:
            return True
        full_title_norm = self._normalize_text(track.title)
        return full_title_norm in filename_norm

    OLD_INDICATORS = {'old', '旧版', '原版', '旧', 'old version'}
    NEW_INDICATORS = {'new', 'final', 'master', '新版', '母带', 'final master', 'new version'}
    VARIANT_INDICATORS = {'remix', 'edit', 'live', 'acoustic', 'instrumental',
                          'club mix', 'dub mix', 'extended', 'radio edit',
                          '混音', '混音版', '电台版'}

    def _detect_version_families(self, results: List[MatchResult]):
        family_groups = defaultdict(list)

        for result in results:
            if result.audio_file and result.status != TrackStatus.UNMATCHED:
                base_name = self._compute_base_name(result.track.title)
                key = self._normalize_text(base_name)
                family_groups[key].append(result)

        for key, group in family_groups.items():
            if len(group) < 2:
                continue

            group.sort(
                key=lambda r: r.audio_file.modified_at if r.audio_file else datetime.min,
                reverse=True
            )

            family_type = self._classify_version_family(group)

            if family_type == 'old_to_new':
                newest = group[0]
                for result in group:
                    is_newest = (result is newest)
                    if is_newest:
                        if ExceptionType.DUPLICATE not in result.exceptions:
                            result.exceptions.append(ExceptionType.DUPLICATE)
                        result.exception_details['duplicate'] = {
                            'duplicate_count': len(group),
                            'duplicate_tracks': [r.track.track_id for r in group],
                            'newest_track': newest.track.track_id,
                            'suggestion': "同曲多版本中的最新版，保留此版本，归档旧版"
                        }
                    else:
                        if ExceptionType.OLD_VERSION not in result.exceptions:
                            result.exceptions.append(ExceptionType.OLD_VERSION)
                        result.exception_details['old_version'] = {
                            'newest_track': newest.track.track_id,
                            'newest_file': newest.audio_file.file_name if newest.audio_file else None,
                            'newest_date': (
                                newest.audio_file.modified_at.isoformat()
                                if newest.audio_file else None
                            ),
                            'suggestion': "存在更新版本，建议使用新版母带替代"
                        }

            elif family_type == 'variant':
                for result in group:
                    if ExceptionType.DUPLICATE not in result.exceptions:
                        result.exceptions.append(ExceptionType.DUPLICATE)
                    result.exception_details['duplicate'] = {
                        'duplicate_count': len(group),
                        'duplicate_tracks': [r.track.track_id for r in group],
                        'suggestion': "同曲不同版本（如原版/Remix），请确认是否都需要保留"
                    }

            else:
                for result in group:
                    if ExceptionType.DUPLICATE not in result.exceptions:
                        result.exceptions.append(ExceptionType.DUPLICATE)
                    result.exception_details['duplicate'] = {
                        'duplicate_count': len(group),
                        'duplicate_tracks': [r.track.track_id for r in group],
                        'suggestion': "完全重复，保留最新版本，删除其余"
                    }

    def _classify_version_family(self, group: List[MatchResult]) -> str:
        tags_per_track = []
        for result in group:
            tags = self._extract_version_tag(result.track.title)
            tag_set = set(tags.split('|')) if tags else set()
            tags_per_track.append(tag_set)

        all_tags = set()
        for ts in tags_per_track:
            all_tags.update(ts)

        has_old = bool(all_tags & self.OLD_INDICATORS)
        has_new = bool(all_tags & self.NEW_INDICATORS)

        if has_old and has_new:
            return 'old_to_new'

        has_variant = bool(all_tags & self.VARIANT_INDICATORS)
        if has_variant and len(group) > 1:
            return 'variant'

        return 'exact_duplicate'

    def _assign_final_status(self, results: List[MatchResult]):
        status_priority = [
            TrackStatus.OLD_VERSION,
            TrackStatus.DUPLICATE,
            TrackStatus.MISSING_LICENSE,
            TrackStatus.RENAMED,
        ]

        for result in results:
            if result.status == TrackStatus.UNMATCHED:
                continue

            for status in status_priority:
                exc_type = self._status_to_exception(status)
                if exc_type and exc_type in result.exceptions:
                    result.status = status
                    break

    def _status_to_exception(self, status: TrackStatus) -> Optional[ExceptionType]:
        mapping = {
            TrackStatus.OLD_VERSION: ExceptionType.OLD_VERSION,
            TrackStatus.DUPLICATE: ExceptionType.DUPLICATE,
            TrackStatus.MISSING_LICENSE: ExceptionType.MISSING_LICENSE,
            TrackStatus.RENAMED: ExceptionType.RENAMED,
        }
        return mapping.get(status)

    def _compute_base_name(self, title: str) -> str:
        base = title

        base = re.sub(r'\([^)]*\)', '', base)

        base = re.sub(r'_[^_]*$', '', base)

        for pattern in self.version_patterns:
            base = re.sub(pattern, '', base, flags=re.IGNORECASE)

        for suffix in self.VERSION_SUFFIXES:
            base = re.sub(r'[_\s-]+' + suffix, '', base, flags=re.IGNORECASE)

        base = re.sub(r'\s+', ' ', base).strip()
        base = base.rstrip('_').rstrip('-').strip()

        return base

    def _extract_version_tag(self, title: str) -> str:
        tags = []

        paren_match = re.findall(r'\(([^)]*)\)', title)
        tags.extend(paren_match)

        underscore_parts = title.split('_')
        if len(underscore_parts) > 1:
            tags.extend(underscore_parts[1:])

        for pattern in self.version_patterns:
            matches = re.findall(pattern, title, flags=re.IGNORECASE)
            tags.extend(matches)

        for suffix in self.VERSION_SUFFIXES:
            matches = re.findall(suffix, title, flags=re.IGNORECASE)
            tags.extend(m.lower() for m in matches)

        return '|'.join(sorted(set(t.strip().lower() for t in tags if t.strip())))

    def _calculate_match_score(self, track: TrackRecord, audio: AudioFile) -> float:
        scores = []

        track_title = self._normalize_text(track.title)
        audio_title = self._normalize_text(audio.title or audio.file_name)

        title_sim = difflib.SequenceMatcher(None, track_title, audio_title).ratio()

        if track_title and (track_title in audio_title or audio_title in track_title):
            title_sim = max(title_sim, 0.85)

        translation_map = {
            '电子脉冲': ['electric', 'pulse'],
            'electric pulse': ['电子脉冲'],
        }
        for key, values in translation_map.items():
            if key in track_title:
                for v in values:
                    if v in audio_title:
                        title_sim = max(title_sim, 0.80)
                        break

        scores.append(('title', title_sim, 0.5))

        if track.artist and audio.artist:
            track_artist = self._normalize_text(track.artist)
            audio_artist = self._normalize_text(audio.artist)
            artist_sim = difflib.SequenceMatcher(None, track_artist, audio_artist).ratio()
            scores.append(('artist', artist_sim, 0.3))
        elif track.artist:
            track_artist = self._normalize_text(track.artist)
            audio_full = self._normalize_text(audio.file_name)
            if track_artist in audio_full:
                scores.append(('artist', 0.8, 0.3))

        if track.duration and audio.duration:
            duration_diff = abs(track.duration - audio.duration)
            duration_score = max(0, 1 - duration_diff / 10)
            scores.append(('duration', duration_score, 0.15))

        if track.bpm and audio.bpm:
            bpm_diff = abs(track.bpm - audio.bpm)
            bpm_score = max(0, 1 - bpm_diff / 20)
            scores.append(('bpm', bpm_score, 0.05))

        total_score = sum(score * weight for _, score, weight in scores)
        total_weight = sum(weight for _, _, weight in scores)

        return total_score / total_weight if total_weight > 0 else 0

    def _normalize_text(self, text: str) -> str:
        text = text.lower()
        text = text.replace('_', ' ')
        text = re.sub(r'[^\w\s\u4e00-\u9fff]', '', text)
        text = re.sub(r'\s+', ' ', text).strip()
        return text

    def _check_filename_match(self, track: TrackRecord, audio: AudioFile) -> bool:
        stem = FilePath(audio.file_name).stem

        expected_patterns = [
            f"{track.artist} - {track.title}",
            f"{track.title} - {track.artist}",
            track.title,
            f"{track.track_id}_{track.title}",
        ]

        for expected in expected_patterns:
            expected_norm = self._normalize_text(expected)
            stem_norm = self._normalize_text(stem)
            if expected_norm in stem_norm or stem_norm in expected_norm:
                return True

        base_title = self._compute_base_name(track.title)
        base_norm = self._normalize_text(base_title)
        stem_norm = self._normalize_text(stem)
        if base_norm and base_norm in stem_norm:
            return True

        return False

    def _check_license(self, track: TrackRecord) -> bool:
        if not track.license_info:
            return False

        license_lower = track.license_info.lower()
        for keyword in self.license_keywords:
            if keyword.lower() in license_lower:
                return True
        return False
