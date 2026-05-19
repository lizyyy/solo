from datetime import datetime
from typing import Optional, Tuple
from packaging.version import Version, InvalidVersion
from .models import (
    PackageVersion,
    SyncWindow,
    VersionGapResult,
    FreshnessStatus,
    FreshnessCheckResult,
    BlockReason,
)


class VersionGapCalculator:
    @staticmethod
    def parse_version(version_str: str) -> Optional[Version]:
        try:
            return Version(version_str)
        except InvalidVersion:
            return None

    @staticmethod
    def calculate_version_gap(
        upstream_version: str,
        mirror_version: Optional[str]
    ) -> Tuple[bool, Optional[str], int, int, int]:
        if not mirror_version:
            return True, upstream_version, 999, 999, 999

        upstream = VersionGapCalculator.parse_version(upstream_version)
        mirror = VersionGapCalculator.parse_version(mirror_version)

        if not upstream or not mirror:
            return True, f"{upstream_version} vs {mirror_version}", 0, 0, 0

        if upstream <= mirror:
            return False, None, 0, 0, 0

        upstream_parts = upstream.release
        mirror_parts = mirror.release

        max_len = max(len(upstream_parts), len(mirror_parts))
        upstream_padded = list(upstream_parts) + [0] * (max_len - len(upstream_parts))
        mirror_padded = list(mirror_parts) + [0] * (max_len - len(mirror_parts))

        major_gap = upstream_padded[0] - mirror_padded[0]
        minor_gap = upstream_padded[1] - mirror_padded[1] if len(upstream_padded) > 1 else 0
        patch_gap = upstream_padded[2] - mirror_padded[2] if len(upstream_padded) > 2 else 0

        has_gap = major_gap > 0 or minor_gap > 0 or patch_gap > 0
        version_gap_str = f"{mirror_version} -> {upstream_version}" if has_gap else None

        return has_gap, version_gap_str, abs(major_gap), abs(minor_gap), abs(patch_gap)

    @staticmethod
    def calculate_time_delay(
        upstream_updated_at: Optional[datetime],
        mirror_updated_at: Optional[datetime]
    ) -> Optional[float]:
        if not upstream_updated_at or not mirror_updated_at:
            return None
        delay = upstream_updated_at - mirror_updated_at
        return max(0.0, delay.total_seconds() / 3600.0)

    @classmethod
    def analyze_package(cls, package: PackageVersion) -> VersionGapResult:
        has_gap, version_gap, major_gap, minor_gap, patch_gap = cls.calculate_version_gap(
            package.upstream_version,
            package.mirror_version
        )
        time_delay = cls.calculate_time_delay(
            package.upstream_updated_at,
            package.mirror_updated_at
        )
        return VersionGapResult(
            package_name=package.name,
            has_gap=has_gap,
            version_gap=version_gap,
            major_gap=major_gap,
            minor_gap=minor_gap,
            patch_gap=patch_gap,
            time_delay_hours=time_delay
        )


class SyncWindowChecker:
    @staticmethod
    def is_within_sync_window(
        sync_window: Optional[SyncWindow],
        check_time: Optional[datetime] = None
    ) -> bool:
        if not sync_window:
            return True

        check_time = check_time or datetime.now()
        current_time_str = check_time.strftime("%H:%M")

        try:
            current = datetime.strptime(current_time_str, "%H:%M")
            start = datetime.strptime(sync_window.start_time, "%H:%M")
            end = datetime.strptime(sync_window.end_time, "%H:%M")

            if start <= end:
                return start <= current <= end
            else:
                return current >= start or current <= end
        except ValueError:
            return True

    @staticmethod
    def is_delay_acceptable(
        delay_hours: Optional[float],
        sync_window: Optional[SyncWindow]
    ) -> bool:
        if delay_hours is None:
            return True
        if not sync_window:
            return delay_hours < 24.0
        return delay_hours <= sync_window.max_delay_hours


class FreshnessRulesEngine:
    def __init__(
        self,
        major_gap_warning: int = 1,
        major_gap_critical: int = 2,
        minor_gap_warning: int = 3,
        minor_gap_critical: int = 5,
        delay_warning_hours: float = 4.0,
        delay_critical_hours: float = 24.0
    ):
        self.major_gap_warning = major_gap_warning
        self.major_gap_critical = major_gap_critical
        self.minor_gap_warning = minor_gap_warning
        self.minor_gap_critical = minor_gap_critical
        self.delay_warning_hours = delay_warning_hours
        self.delay_critical_hours = delay_critical_hours

    def determine_status(
        self,
        gap_result: VersionGapResult,
        in_sync_window: bool
    ) -> Tuple[FreshnessStatus, Optional[BlockReason], str]:
        if not gap_result.has_gap:
            return FreshnessStatus.FRESH, None, "版本同步正常"

        status = FreshnessStatus.WARNING
        block_reason = None
        recommendation = ""

        if gap_result.major_gap >= self.major_gap_critical:
            status = FreshnessStatus.CRITICAL
            block_reason = BlockReason.VERSION_GAP_TOO_LARGE
            recommendation = f"主版本差距过大 ({gap_result.major_gap})，需要立即同步"
        elif gap_result.minor_gap >= self.minor_gap_critical:
            status = FreshnessStatus.CRITICAL
            block_reason = BlockReason.VERSION_GAP_TOO_LARGE
            recommendation = f"次版本差距过大 ({gap_result.minor_gap})，需要立即同步"
        elif gap_result.major_gap >= self.major_gap_warning:
            status = FreshnessStatus.WARNING
            recommendation = f"主版本有差距 ({gap_result.major_gap})，建议尽快同步"
        elif gap_result.minor_gap >= self.minor_gap_warning:
            status = FreshnessStatus.WARNING
            recommendation = f"次版本有差距 ({gap_result.minor_gap})，建议安排同步"

        if gap_result.time_delay_hours is not None:
            if gap_result.time_delay_hours >= self.delay_critical_hours:
                status = FreshnessStatus.CRITICAL
                block_reason = block_reason or BlockReason.VERSION_GAP_TOO_LARGE
                recommendation = f"同步延迟超过 {gap_result.time_delay_hours:.1f} 小时，需要紧急处理"
            elif gap_result.time_delay_hours >= self.delay_warning_hours:
                if status == FreshnessStatus.FRESH:
                    status = FreshnessStatus.WARNING
                recommendation = f"同步延迟 {gap_result.time_delay_hours:.1f} 小时，建议关注"

        if not in_sync_window:
            if status in [FreshnessStatus.CRITICAL, FreshnessStatus.WARNING]:
                block_reason = block_reason or BlockReason.OUTSIDE_SYNC_WINDOW
                recommendation += "（当前不在同步窗口期）"

        if status == FreshnessStatus.WARNING and not recommendation:
            recommendation = "存在版本差距，建议检查同步状态"

        return status, block_reason, recommendation

    def check_package(
        self,
        package: PackageVersion,
        sync_window: Optional[SyncWindow] = None,
        check_time: Optional[datetime] = None
    ) -> FreshnessCheckResult:
        if not package.is_available or not package.mirror_version:
            return FreshnessCheckResult(
                package_name=package.name,
                status=FreshnessStatus.CRITICAL,
                version_gap_result=VersionGapResult(
                    package_name=package.name,
                    has_gap=True,
                    version_gap=package.upstream_version,
                    time_delay_hours=None
                ),
                in_sync_window=SyncWindowChecker.is_within_sync_window(sync_window, check_time),
                block_reason=BlockReason.MIRROR_SYNC_FAILED,
                recommendation="镜像源中不存在该包，拉取失败",
                requires_manual_confirm=True
            )

        gap_result = VersionGapCalculator.analyze_package(package)
        in_sync_window = SyncWindowChecker.is_within_sync_window(sync_window, check_time)

        status, block_reason, recommendation = self.determine_status(gap_result, in_sync_window)

        delay_acceptable = SyncWindowChecker.is_delay_acceptable(
            gap_result.time_delay_hours,
            sync_window
        )

        requires_manual = (
            status in [FreshnessStatus.CRITICAL, FreshnessStatus.STALE] or
            not delay_acceptable or
            block_reason is not None
        )

        return FreshnessCheckResult(
            package_name=package.name,
            status=status,
            version_gap_result=gap_result,
            in_sync_window=in_sync_window,
            block_reason=block_reason,
            recommendation=recommendation,
            requires_manual_confirm=requires_manual
        )
