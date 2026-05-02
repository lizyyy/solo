from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple
from datetime import datetime, timedelta
from .parser import KDMInfo, Showtime, Schedule, TheaterScreen


@dataclass
class CoverageGap:
    screen_id: str
    screen_name: str
    title: str
    cpl_uuid: str
    show_datetime: datetime
    gap_type: str
    details: str


@dataclass
class ScreenCoverage:
    screen_id: str
    screen_name: str
    total_shows: int
    covered_shows: int
    gaps: list
    coverage_percentage: float


class ScheduleCoverageAnalyzer:
    def __init__(self, schedule: Schedule, kdms: List[KDMInfo],
                 screens: List[TheaterScreen]):
        self.schedule = schedule
        self.kdms = kdms
        self.screens = {s.screen_id: s for s in screens}

    def analyze(self) -> Dict:
        kdm_map = self._build_kdm_map()
        coverage_by_screen = self._analyze_coverage_by_screen(kdm_map)
        overall_gaps = self._find_coverage_gaps(kdm_map)

        return {
            'coverage_by_screen': coverage_by_screen,
            'overall_gaps': overall_gaps,
            'summary': self._generate_summary(coverage_by_screen, overall_gaps)
        }

    def _build_kdm_map(self) -> Dict[str, List[KDMInfo]]:
        kdm_map: Dict[str, List[KDMInfo]] = {}

        for kdm in self.kdms:
            key = kdm.CPL_uuid or kdm.CPL_id or kdm.content_title_text
            if key not in kdm_map:
                kdm_map[key] = []
            kdm_map[key].append(kdm)

        return kdm_map

    def _find_matching_kdm(self, show: Showtime, kdm_map: Dict[str, List[KDMInfo]]) -> Optional[KDMInfo]:
        if show.cpl_uuid in kdm_map:
            return kdm_map[show.cpl_uuid][0]

        if show.cpl_id in kdm_map:
            return kdm_map[show.cpl_id][0]

        for kdm_key, kdm_list in kdm_map.items():
            if show.title.lower() in kdm_key.lower():
                return kdm_list[0]

        return None

    def _is_kdm_valid_for_show(self, kdm: KDMInfo, show_dt: datetime) -> Tuple[bool, str]:
        try:
            kdm_start = datetime.strptime(
                kdm.kdm_validity_start[:19],
                '%Y-%m-%dT%H:%M:%S'
            )
            kdm_end = datetime.strptime(
                kdm.kdm_validity_end[:19],
                '%Y-%m-%dT%H:%M:%S'
            )

            if show_dt < kdm_start:
                return False, f'KDM not yet valid (starts {kdm.kdm_validity_start})'
            if show_dt > kdm_end:
                return False, f'KDM expired (ended {kdm.kdm_validity_end})'

            screen = self.screens.get(show.screen_id)
            if screen and kdm.server_fingerprint:
                if screen.server_fingerprint != kdm.server_fingerprint:
                    return False, f'Server fingerprint mismatch'

            return True, 'Valid'

        except (ValueError, TypeError) as e:
            return False, f'Date parse error: {str(e)}'

    def _analyze_coverage_by_screen(self, kdm_map: Dict[str, List[KDMInfo]]) -> Dict[str, ScreenCoverage]:
        coverage = {}

        for show in self.schedule.showtimes:
            screen_id = show.screen_id
            if screen_id not in coverage:
                screen_info = self.screens.get(screen_id)
                coverage[screen_id] = ScreenCoverage(
                    screen_id=screen_id,
                    screen_name=screen_info.screen_name if screen_info else 'Unknown',
                    total_shows=0,
                    covered_shows=0,
                    gaps=[],
                    coverage_percentage=0.0
                )

            coverage[screen_id].total_shows += 1

            matching_kdm = self._find_matching_kdm(show, kdm_map)
            if not matching_kdm:
                coverage[screen_id].gaps.append(CoverageGap(
                    screen_id=show.screen_id,
                    screen_name=show.screen_name,
                    title=show.title,
                    cpl_uuid=show.cpl_uuid,
                    show_datetime=datetime.strptime(
                        f"{show.show_date} {show.show_time}",
                        '%Y-%m-%d %H:%M'
                    ),
                    gap_type='MISSING_KDM',
                    details=f'No KDM found for CPL {show.cpl_id}'
                ))
                continue

            show_dt = datetime.strptime(
                f"{show.show_date} {show.show_time}",
                '%Y-%m-%d %H:%M'
            )

            is_valid, reason = self._is_kdm_valid_for_show(matching_kdm, show_dt)
            if is_valid:
                coverage[screen_id].covered_shows += 1
            else:
                coverage[screen_id].gaps.append(CoverageGap(
                    screen_id=show.screen_id,
                    screen_name=show.screen_name,
                    title=show.title,
                    cpl_uuid=show.cpl_uuid,
                    show_datetime=show_dt,
                    gap_type='KDM_INVALID',
                    details=reason
                ))

        for sc in coverage.values():
            if sc.total_shows > 0:
                sc.coverage_percentage = (sc.covered_shows / sc.total_shows) * 100

        return coverage

    def _find_coverage_gaps(self, kdm_map: Dict[str, List[KDMInfo]]) -> List[CoverageGap]:
        gaps = []

        for screen_id, sc in self._analyze_coverage_by_screen(kdm_map).items():
            gaps.extend(sc.gaps)

        return gaps

    def _generate_summary(self, coverage_by_screen: Dict[str, ScreenCoverage],
                         overall_gaps: List[CoverageGap]) -> Dict:
        total_shows = sum(sc.total_shows for sc in coverage_by_screen.values())
        covered_shows = sum(sc.covered_shows for sc in coverage_by_screen.values())
        overall_percentage = (covered_shows / total_shows * 100) if total_shows > 0 else 0

        errors = [g for g in overall_gaps if g.gap_type in ('MISSING_KDM', 'KDM_INVALID')]
        warnings = [g for g in overall_gaps if g.gap_type not in ('MISSING_KDM', 'KDM_INVALID')]

        return {
            'total_shows': total_shows,
            'covered_shows': covered_shows,
            'overall_coverage_percentage': overall_percentage,
            'error_count': len(errors),
            'warning_count': len(warnings),
            'screens_analyzed': len(coverage_by_screen),
            'kdm_count': len(self.kdms)
        }

    def get_timeline_data(self) -> List[Dict]:
        timeline = []

        for show in self.schedule.showtimes:
            show_dt = datetime.strptime(
                f"{show.show_date} {show.show_time}",
                '%Y-%m-%d %H:%M'
            )

            matching_kdm = self._find_matching_kdm(
                show,
                self._build_kdm_map()
            )

            status = 'OK'
            details = ''

            if not matching_kdm:
                status = 'MISSING_KDM'
                details = 'No KDM found'
            else:
                is_valid, reason = self._is_kdm_valid_for_show(matching_kdm, show_dt)
                if not is_valid:
                    status = 'KDM_INVALID'
                    details = reason

            timeline.append({
                'screen_id': show.screen_id,
                'screen_name': show.screen_name,
                'title': show.title,
                'show_datetime': show_dt.isoformat(),
                'cpl_id': show.cpl_id,
                'cpl_uuid': show.cpl_uuid,
                'status': status,
                'details': details,
                'kdm_title': matching_kdm.content_title_text if matching_kdm else '',
                'kdm_valid_start': matching_kdm.kdm_validity_start if matching_kdm else '',
                'kdm_valid_end': matching_kdm.kdm_validity_end if matching_kdm else ''
            })

        timeline.sort(key=lambda x: x['show_datetime'])

        return timeline
