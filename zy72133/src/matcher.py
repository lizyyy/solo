import re
import difflib
from datetime import datetime, timedelta
from typing import List, Dict, Tuple, Optional
from collections import defaultdict

from .models import TrackRecord, AudioFile, MatchResult, TrackStatus, ExceptionType
from .audit_log import AuditLog


class TrackMatcher:
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
        
        audio_by_hash = defaultdict(list)
        for af in audio_files:
            if af.md5_hash:
                audio_by_hash[af.md5_hash].append(af)
        
        for track in tracks:
            match_result = self._match_single_track(track, audio_files, audio_by_hash, used_files)
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
            
        self._detect_duplicates(results)
        self._detect_old_versions(results)
        
        matched_count = sum(1 for r in results if r.status == TrackStatus.MATCHED)
        self.audit_log.log(
            operator=operator,
            action="匹配完成",
            reason=f"匹配完成: 成功匹配 {matched_count} 条, 异常 {len(results) - matched_count} 条",
            source="匹配器"
        )
        
        return results
    
    def _match_single_track(self, track: TrackRecord, audio_files: List[AudioFile],
                            audio_by_hash: Dict[str, List[AudioFile]], 
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
                    'suggestion': "检查是否人工改名"
                }
            
            if best_score < 0.95:
                exceptions.append(ExceptionType.RENAMED)
                exception_details['renamed'] = {
                    'fuzzy_score': best_score,
                    'suggestion': "确认是否为人工改名"
                }
                
            if not self._check_license(track):
                exceptions.append(ExceptionType.MISSING_LICENSE)
                exception_details['missing_license'] = {
                    'license_info': track.license_info,
                    'suggestion': "请确认授权状态"
                }
                
        else:
            result.match_notes = "未找到匹配的音频文件"
            
        result.exceptions = exceptions
        result.exception_details = exception_details
        
        if exceptions:
            if ExceptionType.MISSING_LICENSE in exceptions:
                result.status = TrackStatus.MISSING_LICENSE
            elif ExceptionType.RENAMED in exceptions:
                result.status = TrackStatus.RENAMED
                
        return result
    
    def _calculate_match_score(self, track: TrackRecord, audio: AudioFile) -> float:
        scores = []
        
        track_title = self._normalize_text(track.title)
        audio_title = self._normalize_text(audio.title or audio.file_name)
        
        title_sim = difflib.SequenceMatcher(None, track_title, audio_title).ratio()
        
        if track_title and (track_title in audio_title or audio_title in track_title):
            title_sim = max(title_sim, 0.85)
        
        translation_map = {
            '电子脉冲': ['electric', 'pulse', '电音脉冲'],
            'electric pulse': ['电子脉冲'],
        }
        for key, values in translation_map.items():
            if key in track_title:
                for v in values:
                    if v in audio_title:
                        title_sim = max(title_sim, 0.8)
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
        text = re.sub(r'[^\w\s\u4e00-\u9fff]', '', text)
        text = re.sub(r'\s+', ' ', text).strip()
        return text
    
    def _check_filename_match(self, track: TrackRecord, audio: AudioFile) -> bool:
        expected_patterns = [
            f"{track.artist} - {track.title}",
            f"{track.title} - {track.artist}",
            track.title,
            f"{track.track_id}_{track.title}"
        ]
        
        audio_name = audio.file_name.lower().replace(audio.file_path.split('.')[-1], '').lower()
        
        for expected in expected_patterns:
            expected_norm = self._normalize_text(expected)
            audio_norm = self._normalize_text(audio_name)
            if expected_norm in audio_norm or audio_norm in expected_norm:
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
    
    def _detect_duplicates(self, results: List[MatchResult]):
        track_groups = defaultdict(list)
        
        for result in results:
            if result.audio_file:
                key = self._normalize_text(result.track.title)
                track_groups[key].append(result)
        
        for key, group in track_groups.items():
            if len(group) > 1:
                for result in group:
                    if TrackStatus.MATCHED == result.status:
                        result.status = TrackStatus.DUPLICATE
                    if ExceptionType.DUPLICATE not in result.exceptions:
                        result.exceptions.append(ExceptionType.DUPLICATE)
                    result.exception_details['duplicate'] = {
                        'duplicate_count': len(group),
                        'duplicate_tracks': [r.track.track_id for r in group],
                        'suggestion': "保留最新版本，删除重复"
                    }
    
    def _detect_old_versions(self, results: List[MatchResult]):
        track_groups = defaultdict(list)
        
        for result in results:
            if result.audio_file:
                base_name = self._strip_version_info(result.track.title)
                key = self._normalize_text(base_name)
                track_groups[key].append(result)
        
        for key, group in track_groups.items():
            if len(group) > 1:
                group.sort(key=lambda r: r.audio_file.modified_at if r.audio_file else datetime.min, reverse=True)
                
                newest = group[0]
                for result in group[1:]:
                    if self._is_version_different(result.track.title, newest.track.title):
                        result.status = TrackStatus.OLD_VERSION
                        if ExceptionType.OLD_VERSION not in result.exceptions:
                            result.exceptions.append(ExceptionType.OLD_VERSION)
                        result.exception_details['old_version'] = {
                            'newest_track': newest.track.track_id,
                            'newest_file': newest.audio_file.file_name if newest.audio_file else None,
                            'newest_date': newest.audio_file.modified_at.isoformat() if newest.audio_file else None,
                            'suggestion': "使用新版母带，归档旧版"
                        }
    
    def _strip_version_info(self, title: str) -> str:
        for pattern in self.version_patterns:
            title = re.sub(pattern, '', title, flags=re.IGNORECASE)
        return title.strip()
    
    def _is_version_different(self, title1: str, title2: str) -> bool:
        t1_ver = self._extract_version(title1)
        t2_ver = self._extract_version(title2)
        return t1_ver != t2_ver
    
    def _extract_version(self, title: str) -> str:
        versions = []
        for pattern in self.version_patterns:
            matches = re.findall(pattern, title, flags=re.IGNORECASE)
            versions.extend(matches)
        return '|'.join(versions)
