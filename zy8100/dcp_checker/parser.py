import json
import csv
import xml.etree.ElementTree as ET
from pathlib import Path
from dataclasses import dataclass, field
from typing import Optional
import yaml


@dataclass
class DCPAsset:
    id: str
    type: str
    hash: Optional[str] = None
    size: Optional[int] = None
    language: Optional[str] = None
    annotation_text: Optional[str] = None


@dataclass
class CPLInfo:
    id: str
    uuid: str
    annotation_text: str
    content_title_text: str
    content_kind: str
    rating: Optional[str]
    reel_ids: list
    asset_ids: list
    required_assets_cpl: list
    edit_rate: Optional[str] = None
    version: Optional[str] = None


@dataclass
class PKLInfo:
    id: str
    uuid: str
    annotation_text: str
    asset_list: list
    hash: Optional[str] = None
    size: Optional[int] = None


@dataclass
class KDMInfo:
    content_title_text: str
    uuid: str
    content_authenticator: dict
    kdm_validity_start: str
    kdm_validity_end: str
    server_fingerprint: str
    screen_list: list
    device_fingerprint_list: list
    CPL_id: Optional[str] = None
    CPL_uuid: Optional[str] = None
    CPL_annotations: Optional[str] = None


@dataclass
class TheaterScreen:
    screen_id: str
    screen_name: str
    server_type: str
    server_serial: str
    server_fingerprint: str
    projector_type: str
    projector_serial: str
    lamp_hours: Optional[int] = None


@dataclass
class Showtime:
    screen_id: str
    screen_name: str
    title: str
    show_date: str
    show_time: str
    cpl_id: str
    cpl_uuid: str
    required_assets: list
    duration_seconds: Optional[int] = None


@dataclass
class Schedule:
    showtimes: list
    total_shows: int = 0


def parse_dcp_manifest(manifest_path: str) -> dict:
    with open(manifest_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    assets = []
    cpls = []
    pkls = []

    for asset in data.get('Assets', []):
        assets.append(DCPAsset(
            id=asset.get('Id', ''),
            type=asset.get('Type', ''),
            hash=asset.get('Hash'),
            size=asset.get('Size'),
            language=asset.get('Language'),
            annotation_text=asset.get('AnnotationText')
        ))

    for cpl_data in data.get('CPLs', []):
        cpls.append(CPLInfo(
            id=cpl_data.get('Id', ''),
            uuid=cpl_data.get('UUID', ''),
            annotation_text=cpl_data.get('AnnotationText', ''),
            content_title_text=cpl_data.get('ContentTitleText', ''),
            content_kind=cpl_data.get('ContentKind', ''),
            rating=cpl_data.get('Rating'),
            reel_ids=cpl_data.get('ReelIds', []),
            asset_ids=cpl_data.get('AssetIds', []),
            required_assets_cpl=cpl_data.get('RequiredAssets', [])
        ))

    for pkl_data in data.get('PKLs', []):
        pkls.append(PKLInfo(
            id=pkl_data.get('Id', ''),
            uuid=pkl_data.get('UUID', ''),
            annotation_text=pkl_data.get('AnnotationText', ''),
            asset_list=pkl_data.get('AssetList', []),
            hash=pkl_data.get('Hash'),
            size=pkl_data.get('Size')
        ))

    return {
        'assets': assets,
        'cpls': cpls,
        'pkls': pkls,
        'manifest_id': data.get('Id', ''),
        'annotation_text': data.get('AnnotationText', '')
    }


def parse_cpl_xml(cpl_path: str) -> CPLInfo:
    tree = ET.parse(cpl_path)
    root = tree.getroot()

    ns = {
        'dsig': 'http://www.w3.org/2000/09/xmldsig#',
        'xmldsig': 'http://www.w3.org/2000/09/xmldsig#',
        'smpte': 'http://www.smpte-ra.org/schemas/429-9/2008/PKL/',
        'cpl': 'http://www.smpte-ra.org/schemas/429-7/2006/CPL',
        'dc': 'http://purl.org/dc/elements/1.1/',
        'amber": "http://www.digicine.com/amber/20100727#',
    }

    for elem in root.iter():
        tag_local = elem.tag.split('}')[-1] if '}' in elem.tag else elem.tag
        elem.tag = tag_local

    cpl_id = root.get('Id', '')
    cpl_uuid = root.get('UUID', '')

    content_title = ''
    content_kind = ''
    rating = None
    edit_rate = None
    version = None
    annotation_text = ''
    reel_ids = []
    asset_ids = []

    for child in root:
        if child.tag == 'ContentTitleText':
            content_title = child.text or ''
        elif child.tag == 'ContentKind':
            content_kind = child.text or ''
        elif child.tag == 'Rating':
            for rchild in child:
                if rchild.tag == 'AuthenticatedPrivacy':
                    rating = rchild.text
        elif child.tag == 'EditRate':
            edit_rate = child.text
        elif child.tag == 'Version':
            version = child.text
        elif child.tag == 'AnnotationText':
            annotation_text = child.text or ''
        elif child.tag == 'ReelList':
            for reel in child:
                if 'Reel' in reel.tag:
                    reel_id = reel.get('Id', '')
                    if reel_id:
                        reel_ids.append(reel_id)
                    for rchild in reel:
                        if rchild.tag == 'Asset':
                            asset_id = rchild.get('id', '')
                            if asset_id:
                                asset_ids.append(asset_id)

    return CPLInfo(
        id=cpl_id,
        uuid=cpl_uuid,
        annotation_text=annotation_text,
        content_title_text=content_title,
        content_kind=content_kind,
        rating=rating,
        reel_ids=reel_ids,
        asset_ids=asset_ids,
        required_assets_cpl=asset_ids,
        edit_rate=edit_rate,
        version=version
    )


def parse_pkl_xml(pkl_path: str) -> PKLInfo:
    tree = ET.parse(pkl_path)
    root = tree.getroot()

    for elem in root.iter():
        tag_local = elem.tag.split('}')[-1] if '}' in elem.tag else elem.tag
        elem.tag = tag_local

    pkl_id = root.get('Id', '')
    pkl_uuid = root.get('UUID', '')

    annotation_text = ''
    hash_val = None
    size = None
    asset_list = []

    for child in root:
        if child.tag == 'AnnotationText':
            annotation_text = child.text or ''
        elif child.tag == 'Signer':
            pass
        elif child.tag == 'AssetList':
            for asset in child:
                asset_id = asset.get('id', '')
                asset_hash = None
                asset_size = None
                for achild in asset:
                    if achild.tag == 'Hash':
                        asset_hash = achild.text
                    elif achild.tag == 'Size':
                        asset_size = achild.text
                asset_list.append({
                    'id': asset_id,
                    'hash': asset_hash,
                    'size': asset_size
                })
        elif child.tag == 'Hash':
            hash_val = child.text
        elif child.tag == 'Size':
            size = child.text

    return PKLInfo(
        id=pkl_id,
        uuid=pkl_uuid,
        annotation_text=annotation_text,
        asset_list=asset_list,
        hash=hash_val,
        size=size
    )


def parse_kdm_xml(kdm_path: str) -> KDMInfo:
    tree = ET.parse(kdm_path)
    root = tree.getroot()

    for elem in root.iter():
        tag_local = elem.tag.split('}')[-1] if '}' in elem.tag else elem.tag
        elem.tag = tag_local

    kdm_uuid = root.get('ID', '') or root.get('uuid', '')

    content_title = ''
    validity_start = ''
    validity_end = ''
    server_fingerprint = ''
    screen_list = []
    device_fingerprint_list = []
    cpl_id = None
    cpl_uuid = None
    cpl_annotations = None
    content_auth = {}

    for child in root:
        if child.tag == 'ContentTitleText':
            content_title = child.text or ''
        elif child.tag == 'ContentAuthenticator':
            for cchild in child:
                if cchild.tag == 'ContentKeys':
                    for ck in cchild:
                        pass
                elif cchild.tag == 'AuthenticatedPermissions':
                    content_auth['permissions'] = cchild.text
        elif child.tag == 'KDMValidityStart':
            validity_start = child.text or ''
        elif child.tag == 'KDMValidityEnd':
            validity_end = child.text or ''
        elif child.tag == 'ServerFingerprint':
            server_fingerprint = child.text or ''
        elif child.tag == 'ScreenList':
            for screen in child:
                screen_id = screen.get('ScreenName', '')
                if screen_id:
                    screen_list.append(screen_id)
        elif child.tag == 'DeviceFingerprintList':
            for dfp in child:
                fp = dfp.get('DeviceFingerprint', '')
                if fp:
                    device_fingerprint_list.append(fp)
        elif child.tag == 'CPL':
            cpl_id = child.get('Id', None)
            cpl_uuid = child.get('UUID', None)
            cpl_annotations = child.text

    return KDMInfo(
        content_title_text=content_title,
        uuid=kdm_uuid,
        content_authenticator=content_auth,
        kdm_validity_start=validity_start,
        kdm_validity_end=validity_end,
        server_fingerprint=server_fingerprint,
        screen_list=screen_list,
        device_fingerprint_list=device_fingerprint_list,
        CPL_id=cpl_id,
        CPL_uuid=cpl_uuid,
        CPL_annotations=cpl_annotations
    )


def parse_screens_csv(csv_path: str) -> list:
    screens = []
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            screens.append(TheaterScreen(
                screen_id=row.get('screen_id', ''),
                screen_name=row.get('screen_name', ''),
                server_type=row.get('server_type', ''),
                server_serial=row.get('server_serial', ''),
                server_fingerprint=row.get('server_fingerprint', ''),
                projector_type=row.get('projector_type', ''),
                projector_serial=row.get('projector_serial', ''),
                lamp_hours=int(row['lamp_hours']) if row.get('lamp_hours', '').isdigit() else None
            ))
    return screens


def parse_schedule_yaml(yaml_path: str) -> Schedule:
    with open(yaml_path, 'r', encoding='utf-8') as f:
        data = yaml.safe_load(f)

    showtimes = []
    for item in data.get('showtimes', []):
        showtimes.append(Showtime(
            screen_id=item.get('screen_id', ''),
            screen_name=item.get('screen_name', ''),
            title=item.get('title', ''),
            show_date=item.get('show_date', ''),
            show_time=item.get('show_time', ''),
            cpl_id=item.get('cpl_id', ''),
            cpl_uuid=item.get('cpl_uuid', ''),
            required_assets=item.get('required_assets', []),
            duration_seconds=item.get('duration_seconds')
        ))

    return Schedule(
        showtimes=showtimes,
        total_shows=len(showtimes)
    )
