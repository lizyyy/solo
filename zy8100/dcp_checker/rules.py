from dataclasses import dataclass
from typing import List, Optional
from datetime import datetime
from .parser import (
    DCPAsset, CPLInfo, PKLInfo, KDMInfo,
    TheaterScreen, Showtime, Schedule
)


@dataclass
class Issue:
    severity: str
    category: str
    screen_id: str
    title: str
    description: str
    cpl_id: str
    cpl_uuid: str
    recommended_action: str


class Validator:
    def __init__(self, dcp_data: dict, screens: List[TheaterScreen],
                 schedule: Schedule, kdms: List[KDMInfo]):
        self.dcp_data = dcp_data
        self.screens = screens
        self.schedule = schedule
        self.kdms = kdms
        self.issues: List[Issue] = []

    def validate(self) -> List[Issue]:
        self._check_asset_references()
        self._check_fingerprint_match()
        self._check_kdm_validity()
        self._check_version_mixing()
        return self.issues

    def _check_asset_references(self):
        manifest_assets = {a.id: a for a in self.dcp_data.get('assets', [])}
        manifest_asset_ids = set(manifest_assets.keys())

        for cpl in self.dcp_data.get('cpls', []):
            for req_asset_id in cpl.required_assets_cpl:
                if req_asset_id not in manifest_asset_ids:
                    self.issues.append(Issue(
                        severity='ERROR',
                        category='MISSING_ASSET',
                        screen_id='N/A',
                        title=cpl.content_title_text,
                        description=f'CPL references asset {req_asset_id} which is missing from manifest',
                        cpl_id=cpl.id,
                        cpl_uuid=cpl.uuid,
                        recommended_action=f'Add asset {req_asset_id} to DCP package or verify CPL is correct'
                    ))

        for pkl in self.dcp_data.get('pkls', []):
            for asset in pkl.asset_list:
                if asset['id'] not in manifest_asset_ids:
                    self.issues.append(Issue(
                        severity='ERROR',
                        category='MISSING_ASSET',
                        screen_id='N/A',
                        title=pkl.annotation_text,
                        description=f'PKL references asset {asset["id"]} which is missing from manifest',
                        cpl_id=pkl.id,
                        cpl_uuid=pkl.uuid,
                        recommended_action=f'Add asset {asset["id"]} to DCP package'
                    ))

    def _check_fingerprint_match(self):
        server_fingerprints = {s.server_fingerprint: s for s in self.screens}

        for kdm in self.kdms:
            if kdm.server_fingerprint:
                if kdm.server_fingerprint not in server_fingerprints:
                    self.issues.append(Issue(
                        severity='ERROR',
                        category='FINGERPRINT_MISMATCH',
                        screen_id=', '.join(kdm.screen_list) if kdm.screen_list else 'UNKNOWN',
                        title=kdm.content_title_text,
                        description=f'KDM server fingerprint {kdm.server_fingerprint} does not match any server in theater equipment CSV',
                        cpl_id=kdm.CPL_id or 'N/A',
                        cpl_uuid=kdm.CPL_uuid or 'N/A',
                        recommended_action='Verify server certificate fingerprints in theater CSV match projection equipment'
                    ))

            for dfp in kdm.device_fingerprint_list:
                if dfp not in server_fingerprints:
                    self.issues.append(Issue(
                        severity='WARNING',
                        category='DEVICE_FINGERPRINT_MISMATCH',
                        screen_id=', '.join(kdm.screen_list) if kdm.screen_list else 'UNKNOWN',
                        title=kdm.content_title_text,
                        description=f'KDM device fingerprint {dfp} does not match any device in theater CSV',
                        cpl_id=kdm.CPL_id or 'N/A',
                        cpl_uuid=kdm.CPL_uuid or 'N/A',
                        recommended_action='Verify projector/device certificates match'
                    ))

    def _check_kdm_validity(self):
        for show in self.schedule.showtimes:
            matching_kdm = None
            for kdm in self.kdms:
                if kdm.CPL_uuid == show.cpl_uuid or kdm.CPL_id == show.cpl_id:
                    matching_kdm = kdm
                    break
                if show.title.lower() in kdm.content_title_text.lower():
                    matching_kdm = kdm
                    break

            if not matching_kdm:
                self.issues.append(Issue(
                    severity='ERROR',
                    category='MISSING_KDM',
                    screen_id=show.screen_id,
                    title=show.title,
                    description=f'No KDM found for scheduled showtime (CPL: {show.cpl_id})',
                    cpl_id=show.cpl_id,
                    cpl_uuid=show.cpl_uuid,
                    recommended_action='Obtain valid KDM for this content and screen'
                ))
                continue

            show_dt = datetime.strptime(
                f"{show.show_date} {show.show_time}",
                '%Y-%m-%d %H:%M'
            )

            try:
                kdm_start = datetime.strptime(
                    matching_kdm.kdm_validity_start[:19],
                    '%Y-%m-%dT%H:%M:%S'
                )
                kdm_end = datetime.strptime(
                    matching_kdm.kdm_validity_end[:19],
                    '%Y-%m-%dT%H:%M:%S'
                )

                if show_dt < kdm_start:
                    self.issues.append(Issue(
                        severity='ERROR',
                        category='KDM_NOT_YET_VALID',
                        screen_id=show.screen_id,
                        title=show.title,
                        description=f'Show scheduled before KDM validity starts (KDM valid from {matching_kdm.kdm_validity_start})',
                        cpl_id=show.cpl_id,
                        cpl_uuid=show.cpl_uuid,
                        recommended_action=f'Wait until {matching_kdm.kdm_validity_start} or request earlier KDM'
                    ))

                if show_dt > kdm_end:
                    self.issues.append(Issue(
                        severity='ERROR',
                        category='KDM_EXPIRED',
                        screen_id=show.screen_id,
                        title=show.title,
                        description=f'Show scheduled after KDM validity ends (KDM valid until {matching_kdm.kdm_validity_end})',
                        cpl_id=show.cpl_id,
                        cpl_uuid=show.cpl_uuid,
                        recommended_action='Request new KDM with extended validity'
                    ))
            except (ValueError, TypeError):
                self.issues.append(Issue(
                    severity='WARNING',
                    category='KDM_DATE_PARSE_ERROR',
                    screen_id=show.screen_id,
                    title=show.title,
                    description='Could not parse KDM validity dates',
                    cpl_id=show.cpl_id,
                    cpl_uuid=show.cpl_uuid,
                    recommended_action='Verify KDM XML dates are in correct format'
                ))

    def _check_version_mixing(self):
        shows_by_screen_time = {}

        for show in self.schedule.showtimes:
            key = (show.screen_id, show.show_date, show.show_time)
            if key not in shows_by_screen_time:
                shows_by_screen_time[key] = []
            shows_by_screen_time[key].append(show)

        for (screen_id, show_date, show_time), shows in shows_by_screen_time.items():
            if len(shows) > 1:
                titles = [s.title for s in shows]
                cpl_ids = [s.cpl_id for s in shows]
                if len(set(cpl_ids)) > 1:
                    self.issues.append(Issue(
                        severity='ERROR',
                        category='VERSION_MIXING',
                        screen_id=screen_id,
                        title=', '.join(titles),
                        description=f'Multiple different CPLs scheduled at same time on screen {screen_id}: {cpl_ids}',
                        cpl_id=', '.join(cpl_ids),
                        cpl_uuid=', '.join(s.cpl_uuid for s in shows),
                        recommended_action='Ensure only one CPL per screen per showtime; remove duplicate or verify schedule'
                    ))
                elif len(set(titles)) > 1:
                    self.issues.append(Issue(
                        severity='WARNING',
                        category='VERSION_MIXING',
                        screen_id=screen_id,
                        title=', '.join(titles),
                        description=f'Multiple versions of same title at same time on screen {screen_id}',
                        cpl_id=cpl_ids[0],
                        cpl_uuid=shows[0].cpl_uuid,
                        recommended_action='Verify if different versions (3D/2D, ratings) are intentional'
                    ))
