from abc import ABC, abstractmethod
from collections import Counter
from datetime import date, datetime
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple

from podcast_checker.config import settings
from podcast_checker.models.schemas import (
    Episode,
    EpisodeCheckResult,
    CheckStatus,
    Issue,
    IssueType,
    LoudnessCheckResult,
    AdAuthorization,
    MusicAuthorization,
    CoverImage,
)


class Checker(ABC):
    @abstractmethod
    def check(self, episode: Episode, *args, **kwargs) -> Tuple[CheckStatus, List[Issue]]:
        pass


class LoudnessChecker(Checker):
    def __init__(
        self,
        target_lufs: Optional[float] = None,
        tolerance: Optional[float] = None,
        min_lufs: Optional[float] = None,
        max_lufs: Optional[float] = None,
    ):
        self.target_lufs = target_lufs or settings.LOUDNESS_TARGET
        self.tolerance = tolerance or settings.LOUDNESS_TOLERANCE
        self.min_lufs = min_lufs or settings.LOUDNESS_MIN
        self.max_lufs = max_lufs or settings.LOUDNESS_MAX
    
    def check(
        self, 
        episode: Episode, 
        loudness_results: Dict[str, LoudnessCheckResult]
    ) -> Tuple[CheckStatus, List[Issue]]:
        issues: List[Issue] = []
        status = CheckStatus.PASS
        
        if not episode.audio_file:
            return CheckStatus.PENDING, issues
        
        loudness = loudness_results.get(episode.audio_file)
        if not loudness:
            for alt_key in loudness_results.keys():
                if Path(alt_key).name == Path(episode.audio_file).name:
                    loudness = loudness_results[alt_key]
                    break
        
        if not loudness:
            return CheckStatus.PENDING, issues
        
        lufs = loudness.integrated_lufs
        
        if lufs < self.min_lufs:
            issues.append(Issue(
                issue_type=IssueType.LOUDNESS_TOO_LOW,
                severity=CheckStatus.FAIL,
                message=f"响度过低: {lufs:.1f} LUFS (最小值要求: {self.min_lufs} LUFS)",
                details={
                    "measured": lufs,
                    "min_allowed": self.min_lufs,
                    "target": self.target_lufs,
                },
                affected_field="audio_file",
            ))
            status = CheckStatus.FAIL
        elif lufs > self.max_lufs:
            issues.append(Issue(
                issue_type=IssueType.LOUDNESS_TOO_HIGH,
                severity=CheckStatus.FAIL,
                message=f"响度过高: {lufs:.1f} LUFS (最大值要求: {self.max_lufs} LUFS)",
                details={
                    "measured": lufs,
                    "max_allowed": self.max_lufs,
                    "target": self.target_lufs,
                },
                affected_field="audio_file",
            ))
            status = CheckStatus.FAIL
        
        lower = self.target_lufs - self.tolerance
        upper = self.target_lufs + self.tolerance
        if status == CheckStatus.PASS and (lufs < lower or lufs > upper):
            issues.append(Issue(
                issue_type=IssueType.LOUDNESS_OUT_OF_RANGE,
                severity=CheckStatus.WARNING,
                message=f"响度偏离目标值: {lufs:.1f} LUFS (目标: {self.target_lufs} ±{self.tolerance} LUFS)",
                details={
                    "measured": lufs,
                    "target": self.target_lufs,
                    "tolerance": self.tolerance,
                },
                affected_field="audio_file",
            ))
            status = CheckStatus.WARNING
        
        return status, issues


class AdChecker(Checker):
    def __init__(self, check_date: Optional[date] = None):
        self.check_date = check_date or date.today()
    
    def check(
        self, 
        episode: Episode, 
        ad_authorizations: List[AdAuthorization]
    ) -> Tuple[CheckStatus, List[Issue]]:
        issues: List[Issue] = []
        status = CheckStatus.PASS
        
        if not episode.sponsors:
            return CheckStatus.PASS, issues
        
        for sponsor in episode.sponsors:
            sponsor_auths = [
                auth for auth in ad_authorizations 
                if auth.sponsor_id == sponsor and auth.is_active
            ]
            
            if not sponsor_auths:
                issues.append(Issue(
                    issue_type=IssueType.AD_AUTHORIZATION_MISSING,
                    severity=CheckStatus.FAIL,
                    message=f"缺少广告授权: 赞助商 '{sponsor}'",
                    details={"sponsor": sponsor},
                    affected_field="sponsors",
                ))
                status = CheckStatus.FAIL
                continue
            
            episode_covered = False
            within_date = False
            
            for auth in sponsor_auths:
                if episode.episode_number in auth.episode_numbers or not auth.episode_numbers:
                    episode_covered = True
                    if auth.valid_from <= self.check_date <= auth.valid_to:
                        within_date = True
                        break
            
            if not episode_covered:
                issues.append(Issue(
                    issue_type=IssueType.AD_NOT_COVERED,
                    severity=CheckStatus.FAIL,
                    message=f"广告口播未覆盖: 赞助商 '{sponsor}' 的授权未包含本集",
                    details={
                        "sponsor": sponsor,
                        "episode": episode.episode_number,
                        "authorized_episodes": [
                            a.episode_numbers for a in sponsor_auths
                        ],
                    },
                    affected_field="sponsors",
                ))
                status = CheckStatus.FAIL
                continue
            
            if not within_date:
                active_auth = next(
                    (a for a in sponsor_auths 
                     if a.episode_numbers and episode.episode_number in a.episode_numbers),
                    None
                )
                if active_auth:
                    issues.append(Issue(
                        issue_type=IssueType.AD_AUTHORIZATION_EXPIRED,
                        severity=CheckStatus.FAIL,
                        message=f"广告授权过期: 赞助商 '{sponsor}' 的授权不在有效日期范围内",
                        details={
                            "sponsor": sponsor,
                            "check_date": self.check_date.isoformat(),
                            "valid_from": active_auth.valid_from.isoformat(),
                            "valid_to": active_auth.valid_to.isoformat(),
                        },
                        affected_field="sponsors",
                    ))
                    status = CheckStatus.FAIL
        
        return status, issues


class MusicChecker(Checker):
    def __init__(self, check_date: Optional[date] = None):
        self.check_date = check_date or date.today()
    
    def check(
        self, 
        episode: Episode, 
        music_authorizations: List[MusicAuthorization]
    ) -> Tuple[CheckStatus, List[Issue]]:
        issues: List[Issue] = []
        status = CheckStatus.PASS
        
        if not episode.music_tracks:
            return CheckStatus.PASS, issues
        
        for track_id in episode.music_tracks:
            track_auths = [
                auth for auth in music_authorizations 
                if auth.track_id == track_id and auth.is_active
            ]
            
            if not track_auths:
                issues.append(Issue(
                    issue_type=IssueType.MUSIC_AUTHORIZATION_MISSING,
                    severity=CheckStatus.FAIL,
                    message=f"缺少音乐授权: 音轨 '{track_id}'",
                    details={"track_id": track_id},
                    affected_field="music_tracks",
                ))
                status = CheckStatus.FAIL
                continue
            
            episode_covered = False
            within_date = False
            
            for auth in track_auths:
                if episode.episode_number in auth.episode_numbers or not auth.episode_numbers:
                    episode_covered = True
                    if auth.valid_from <= self.check_date <= auth.valid_to:
                        within_date = True
                        break
            
            if not episode_covered:
                issues.append(Issue(
                    issue_type=IssueType.MUSIC_AUTHORIZATION_MISSING,
                    severity=CheckStatus.WARNING,
                    message=f"音乐授权未明确覆盖本集: 音轨 '{track_id}'",
                    details={
                        "track_id": track_id,
                        "episode": episode.episode_number,
                    },
                    affected_field="music_tracks",
                ))
                if status == CheckStatus.PASS:
                    status = CheckStatus.WARNING
                continue
            
            if not within_date:
                active_auth = next(
                    (a for a in track_auths 
                     if a.episode_numbers and episode.episode_number in a.episode_numbers),
                    None
                )
                if active_auth:
                    issues.append(Issue(
                        issue_type=IssueType.MUSIC_AUTHORIZATION_EXPIRED,
                        severity=CheckStatus.FAIL,
                        message=f"音乐授权过期: 音轨 '{track_id}' 的授权不在有效日期范围内",
                        details={
                            "track_id": track_id,
                            "check_date": self.check_date.isoformat(),
                            "valid_from": active_auth.valid_from.isoformat(),
                            "valid_to": active_auth.valid_to.isoformat(),
                        },
                        affected_field="music_tracks",
                    ))
                    status = CheckStatus.FAIL
        
        return status, issues


class CoverChecker(Checker):
    def __init__(
        self,
        min_width: Optional[int] = None,
        max_width: Optional[int] = None,
        min_height: Optional[int] = None,
        max_height: Optional[int] = None,
        aspect_ratio_tolerance: Optional[float] = None,
    ):
        self.min_width = min_width or settings.COVER_MIN_WIDTH
        self.max_width = max_width or settings.COVER_MAX_WIDTH
        self.min_height = min_height or settings.COVER_MIN_HEIGHT
        self.max_height = max_height or settings.COVER_MAX_HEIGHT
        self.aspect_ratio_tolerance = aspect_ratio_tolerance or settings.COVER_ASPECT_RATIO_TOLERANCE
    
    def check(
        self, 
        episode: Episode, 
        covers: Dict[str, CoverImage]
    ) -> Tuple[CheckStatus, List[Issue]]:
        issues: List[Issue] = []
        status = CheckStatus.PASS
        
        if not episode.cover_file:
            episode_covers = [
                c for c in covers.values() 
                if c.episode_number == episode.episode_number
            ]
            if not episode_covers:
                issues.append(Issue(
                    issue_type=IssueType.COVER_MISSING,
                    severity=CheckStatus.FAIL,
                    message="缺少封面图",
                    details={"episode": episode.episode_number},
                    affected_field="cover_file",
                ))
                return CheckStatus.FAIL, issues
            cover = episode_covers[0]
        else:
            cover = covers.get(episode.cover_file)
            if not cover:
                for cover_name, cover_info in covers.items():
                    if (
                        cover_name == episode.cover_file
                        or Path(cover_name).name == Path(episode.cover_file).name
                        or (cover_info.episode_number == episode.episode_number)
                    ):
                        cover = cover_info
                        break
            
            if not cover:
                issues.append(Issue(
                    issue_type=IssueType.COVER_MISSING,
                    severity=CheckStatus.FAIL,
                    message=f"封面图不存在: {episode.cover_file}",
                    details={"cover_file": episode.cover_file},
                    affected_field="cover_file",
                ))
                return CheckStatus.FAIL, issues
        
        if cover.width < self.min_width or cover.height < self.min_height:
            issues.append(Issue(
                issue_type=IssueType.COVER_SIZE_TOO_SMALL,
                severity=CheckStatus.FAIL,
                message=f"封面尺寸过小: {cover.width}x{cover.height} (最小要求: {self.min_width}x{self.min_height})",
                details={
                    "width": cover.width,
                    "height": cover.height,
                    "min_width": self.min_width,
                    "min_height": self.min_height,
                },
                affected_field="cover_file",
            ))
            status = CheckStatus.FAIL
        
        if cover.width > self.max_width or cover.height > self.max_height:
            issues.append(Issue(
                issue_type=IssueType.COVER_SIZE_TOO_LARGE,
                severity=CheckStatus.WARNING,
                message=f"封面尺寸过大: {cover.width}x{cover.height} (建议最大: {self.max_width}x{self.max_height})",
                details={
                    "width": cover.width,
                    "height": cover.height,
                    "max_width": self.max_width,
                    "max_height": self.max_height,
                },
                affected_field="cover_file",
            ))
            if status == CheckStatus.PASS:
                status = CheckStatus.WARNING
        
        if cover.width > 0 and cover.height > 0:
            aspect_ratio = cover.width / cover.height
            if abs(aspect_ratio - 1.0) > self.aspect_ratio_tolerance:
                issues.append(Issue(
                    issue_type=IssueType.COVER_ASPECT_RATIO_INVALID,
                    severity=CheckStatus.FAIL,
                    message=f"封面比例不正确: {aspect_ratio:.3f}:1 (要求 1:1 正方形)",
                    details={
                        "width": cover.width,
                        "height": cover.height,
                        "aspect_ratio": aspect_ratio,
                    },
                    affected_field="cover_file",
                ))
                status = CheckStatus.FAIL
        
        return status, issues


class DuplicateChecker:
    @staticmethod
    def check(episodes: List[Episode]) -> Dict[int, List[Issue]]:
        issues_by_episode: Dict[int, List[Issue]] = {}
        
        episode_numbers = [e.episode_number for e in episodes]
        counts = Counter(episode_numbers)
        
        for ep_num, count in counts.items():
            if count > 1:
                if ep_num not in issues_by_episode:
                    issues_by_episode[ep_num] = []
                issues_by_episode[ep_num].append(Issue(
                    issue_type=IssueType.DUPLICATE_EPISODE,
                    severity=CheckStatus.FAIL,
                    message=f"重复集号: 第 {ep_num} 集出现了 {count} 次",
                    details={
                        "episode_number": ep_num,
                        "duplicate_count": count,
                    },
                    affected_field="episode_number",
                ))
        
        return issues_by_episode


class EpisodeChecker:
    def __init__(
        self,
        loudness_checker: Optional[LoudnessChecker] = None,
        ad_checker: Optional[AdChecker] = None,
        music_checker: Optional[MusicChecker] = None,
        cover_checker: Optional[CoverChecker] = None,
    ):
        self.loudness_checker = loudness_checker or LoudnessChecker()
        self.ad_checker = ad_checker or AdChecker()
        self.music_checker = music_checker or MusicChecker()
        self.cover_checker = cover_checker or CoverChecker()
    
    def check_episode(
        self,
        episode: Episode,
        loudness_results: Dict[str, LoudnessCheckResult],
        ad_authorizations: List[AdAuthorization],
        music_authorizations: List[MusicAuthorization],
        covers: Dict[str, CoverImage],
    ) -> EpisodeCheckResult:
        all_issues: List[Issue] = []
        
        loudness_status, loudness_issues = self.loudness_checker.check(episode, loudness_results)
        all_issues.extend(loudness_issues)
        
        ad_status, ad_issues = self.ad_checker.check(episode, ad_authorizations)
        all_issues.extend(ad_issues)
        
        music_status, music_issues = self.music_checker.check(episode, music_authorizations)
        all_issues.extend(music_issues)
        
        cover_status, cover_issues = self.cover_checker.check(episode, covers)
        all_issues.extend(cover_issues)
        
        if CheckStatus.FAIL in [loudness_status, ad_status, music_status, cover_status]:
            overall_status = CheckStatus.FAIL
        elif CheckStatus.WARNING in [loudness_status, ad_status, music_status, cover_status]:
            overall_status = CheckStatus.WARNING
        elif CheckStatus.PENDING in [loudness_status, ad_status, music_status, cover_status]:
            pending_checks = [
                s for s in [loudness_status, ad_status, music_status, cover_status]
                if s == CheckStatus.PENDING
            ]
            if len(pending_checks) == 4:
                overall_status = CheckStatus.PENDING
            else:
                overall_status = CheckStatus.WARNING
        else:
            overall_status = CheckStatus.PASS
        
        return EpisodeCheckResult(
            episode_number=episode.episode_number,
            title=episode.title,
            overall_status=overall_status,
            issues=all_issues,
            loudness_status=loudness_status,
            ad_status=ad_status,
            music_status=music_status,
            cover_status=cover_status,
            checked_at=datetime.now(),
        )
    
    def check_all(
        self,
        episodes: List[Episode],
        loudness_results: List[LoudnessCheckResult],
        ad_authorizations: List[AdAuthorization],
        music_authorizations: List[MusicAuthorization],
        covers: List[CoverImage],
    ) -> List[EpisodeCheckResult]:
        loudness_dict: Dict[str, LoudnessCheckResult] = {
            r.audio_file: r for r in loudness_results
        }
        
        covers_dict: Dict[str, CoverImage] = {
            c.file_name: c for c in covers
        }
        
        duplicate_issues = DuplicateChecker.check(episodes)
        
        results: List[EpisodeCheckResult] = []
        
        for episode in episodes:
            result = self.check_episode(
                episode=episode,
                loudness_results=loudness_dict,
                ad_authorizations=ad_authorizations,
                music_authorizations=music_authorizations,
                covers=covers_dict,
            )
            
            if episode.episode_number in duplicate_issues:
                result.issues.extend(duplicate_issues[episode.episode_number])
                result.overall_status = CheckStatus.FAIL
            
            results.append(result)
        
        return results
