import pytest
import json
import csv
import tempfile
import os
from pathlib import Path

from dcp_checker.parser import (
    parse_dcp_manifest, parse_cpl_xml, parse_pkl_xml,
    parse_kdm_xml, parse_screens_csv, parse_schedule_yaml
)
from dcp_checker.rules import Validator, Issue
from dcp_checker.coverage import ScheduleCoverageAnalyzer
from dcp_checker.reporter import (
    generate_kdm_audit_markdown,
    generate_issues_csv,
    generate_timeline_html
)


class TestParser:
    def test_parse_dcp_manifest(self):
        manifest = {
            "Id": "urn:uuid:test-manifest",
            "Assets": [
                {"Id": "urn:uuid:asset1", "Type": "video/mxf"}
            ],
            "CPLs": [
                {
                    "Id": "urn:uuid:cpl1",
                    "UUID": "urn:uuid:cpl1",
                    "ContentTitleText": "Test Movie",
                    "ContentKind": "feature",
                    "RequiredAssets": ["urn:uuid:asset1"]
                }
            ],
            "PKLs": []
        }

        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump(manifest, f)
            f.flush()
            result = parse_dcp_manifest(f.name)

        assert len(result['assets']) == 1
        assert len(result['cpls']) == 1
        assert result['cpls'][0].content_title_text == 'Test Movie'
        os.unlink(f.name)

    def test_parse_screens_csv(self):
        csv_content = """screen_id,screen_name,server_type,server_serial,server_fingerprint,projector_type,projector_serial,lamp_hours
SCREEN01,Main Hall,Barco S4,SN001,AA:BB:CC:DD:EE:FF,Barco DP4K,PN001,100"""

        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
            f.write(csv_content)
            f.flush()
            screens = parse_screens_csv(f.name)

        assert len(screens) == 1
        assert screens[0].screen_id == 'SCREEN01'
        assert screens[0].server_fingerprint == 'AA:BB:CC:DD:EE:FF'
        os.unlink(f.name)

    def test_parse_schedule_yaml(self):
        yaml_content = """showtimes:
  - screen_id: SCREEN01
    screen_name: Main Hall
    title: Test Movie
    show_date: "2026-05-15"
    show_time: "14:00"
    cpl_id: "urn:uuid:cpl1"
    cpl_uuid: "urn:uuid:cpl1"
    required_assets: []
    duration_seconds: 7200
"""

        with tempfile.NamedTemporaryFile(mode='w', suffix='.yaml', delete=False) as f:
            f.write(yaml_content)
            f.flush()
            schedule = parse_schedule_yaml(f.name)

        assert schedule.total_shows == 1
        assert schedule.showtimes[0].title == 'Test Movie'
        os.unlink(f.name)


class TestRules:
    def test_missing_asset_detection(self):
        dcp_data = {
            'assets': [
                type('Asset', (), {'id': 'urn:uuid:asset1', 'type': 'video/mxf'})()
            ],
            'cpls': [
                type('CPL', (), {
                    'id': 'urn:uuid:cpl1',
                    'uuid': 'urn:uuid:cpl1',
                    'content_title_text': 'Test',
                    'required_assets_cpl': ['urn:uuid:missing-asset']
                })()
            ],
            'pkls': []
        }

        screens = [type('Screen', (), {
            'screen_id': 'SCREEN01',
            'screen_name': 'Hall 1',
            'server_fingerprint': 'AA:BB:CC:DD:EE:FF'
        })()]

        schedule = type('Schedule', (), {
            'showtimes': [],
            'total_shows': 0
        })()

        kdms = []

        validator = Validator(dcp_data, screens, schedule, kdms)
        issues = validator.validate()

        missing_assets = [i for i in issues if i.category == 'MISSING_ASSET']
        assert len(missing_assets) == 1
        assert 'missing-asset' in missing_assets[0].description

    def test_fingerprint_mismatch(self):
        dcp_data = {'assets': [], 'cpls': [], 'pkls': []}

        screens = [type('Screen', (), {
            'screen_id': 'SCREEN01',
            'screen_name': 'Hall 1',
            'server_fingerprint': 'AA:BB:CC:DD:EE:FF'
        })()]

        schedule = type('Schedule', (), {'showtimes': [], 'total_shows': 0})()

        kdm = type('KDM', (), {
            'content_title_text': 'Test',
            'server_fingerprint': 'ZZ:ZZ:ZZ:ZZ:ZZ:ZZ',
            'device_fingerprint_list': [],
            'screen_list': ['SCREEN01'],
            'CPL_id': None,
            'CPL_uuid': None
        })()

        validator = Validator(dcp_data, screens, schedule, [kdm])
        issues = validator.validate()

        fp_issues = [i for i in issues if i.category == 'FINGERPRINT_MISMATCH']
        assert len(fp_issues) == 1

    def test_kdm_validity_check(self):
        dcp_data = {'assets': [], 'cpls': [], 'pkls': []}

        screens = [type('Screen', (), {
            'screen_id': 'SCREEN01',
            'screen_name': 'Hall 1',
            'server_fingerprint': 'AA:BB:CC:DD:EE:FF'
        })()]

        show = type('Show', (), {
            'screen_id': 'SCREEN01',
            'screen_name': 'Hall 1',
            'title': 'Test Movie',
            'show_date': '2026-05-15',
            'show_time': '14:00',
            'cpl_id': 'urn:uuid:cpl1',
            'cpl_uuid': 'urn:uuid:cpl1',
            'required_assets': []
        })()

        schedule = type('Schedule', (), {
            'showtimes': [show],
            'total_shows': 1
        })()

        kdm = type('KDM', (), {
            'content_title_text': 'Test Movie',
            'CPL_uuid': 'urn:uuid:cpl1',
            'CPL_id': 'urn:uuid:cpl1',
            'kdm_validity_start': '2026-06-01T00:00:00',
            'kdm_validity_end': '2026-06-30T23:59:59',
            'server_fingerprint': 'AA:BB:CC:DD:EE:FF',
            'device_fingerprint_list': [],
            'screen_list': ['SCREEN01']
        })()

        validator = Validator(dcp_data, screens, schedule, [kdm])
        issues = validator.validate()

        validity_issues = [i for i in issues if i.category in ('KDM_NOT_YET_VALID', 'KDM_EXPIRED')]
        assert len(validity_issues) == 1

    def test_version_mixing_detection(self):
        dcp_data = {'assets': [], 'cpls': [], 'pkls': []}

        screens = [type('Screen', (), {
            'screen_id': 'SCREEN01',
            'screen_name': 'Hall 1',
            'server_fingerprint': 'AA:BB:CC:DD:EE:FF'
        })()]

        show1 = type('Show', (), {
            'screen_id': 'SCREEN01',
            'screen_name': 'Hall 1',
            'title': 'Movie A',
            'show_date': '2026-05-15',
            'show_time': '14:00',
            'cpl_id': 'urn:uuid:cpl1',
            'cpl_uuid': 'urn:uuid:cpl1',
            'required_assets': []
        })()

        show2 = type('Show', (), {
            'screen_id': 'SCREEN01',
            'screen_name': 'Hall 1',
            'title': 'Movie B',
            'show_date': '2026-05-15',
            'show_time': '14:00',
            'cpl_id': 'urn:uuid:cpl2',
            'cpl_uuid': 'urn:uuid:cpl2',
            'required_assets': []
        })()

        schedule = type('Schedule', (), {
            'showtimes': [show1, show2],
            'total_shows': 2
        })()

        validator = Validator(dcp_data, screens, schedule, [])
        issues = validator.validate()

        mixing_issues = [i for i in issues if i.category == 'VERSION_MIXING']
        assert len(mixing_issues) == 1


class TestCoverage:
    def test_coverage_analysis(self):
        show = type('Show', (), {
            'screen_id': 'SCREEN01',
            'screen_name': 'Hall 1',
            'title': 'Test Movie',
            'show_date': '2026-05-15',
            'show_time': '14:00',
            'cpl_id': 'urn:uuid:cpl1',
            'cpl_uuid': 'urn:uuid:cpl1',
            'required_assets': []
        })()

        schedule = type('Schedule', (), {
            'showtimes': [show],
            'total_shows': 1
        })()

        screen = type('Screen', (), {
            'screen_id': 'SCREEN01',
            'screen_name': 'Hall 1',
            'server_fingerprint': 'AA:BB:CC:DD:EE:FF'
        })()

        kdm = type('KDM', (), {
            'content_title_text': 'Test Movie',
            'CPL_uuid': 'urn:uuid:cpl1',
            'CPL_id': 'urn:uuid:cpl1',
            'kdm_validity_start': '2026-01-01T00:00:00',
            'kdm_validity_end': '2026-12-31T23:59:59',
            'server_fingerprint': 'AA:BB:CC:DD:EE:FF',
            'screen_list': ['SCREEN01']
        })()

        analyzer = ScheduleCoverageAnalyzer(schedule, [kdm], [screen])
        result = analyzer.analyze()

        assert result['summary']['total_shows'] == 1
        assert result['summary']['covered_shows'] == 1


class TestReporter:
    def test_generate_issues_csv(self):
        issue = Issue(
            severity='ERROR',
            category='MISSING_KDM',
            screen_id='SCREEN01',
            title='Test Movie',
            description='No KDM found',
            cpl_id='urn:uuid:cpl1',
            cpl_uuid='urn:uuid:cpl1',
            recommended_action='Add KDM'
        )

        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
            generate_issues_csv([issue], f.name)
            f.flush()

            with open(f.name, 'r') as rf:
                reader = csv.DictReader(rf)
                rows = list(reader)

        assert len(rows) == 1
        assert rows[0]['severity'] == 'ERROR'
        assert rows[0]['category'] == 'MISSING_KDM'
        os.unlink(f.name)

    def test_generate_timeline_html(self):
        timeline_data = [
            {
                'screen_id': 'SCREEN01',
                'screen_name': 'Main Hall',
                'title': 'Test Movie',
                'show_datetime': '2026-05-15T14:00:00',
                'cpl_id': 'urn:uuid:cpl1',
                'cpl_uuid': 'urn:uuid:cpl1',
                'status': 'OK',
                'details': '',
                'kdm_title': 'Test KDM',
                'kdm_valid_start': '2026-01-01T00:00:00',
                'kdm_valid_end': '2026-12-31T23:59:59'
            }
        ]

        with tempfile.NamedTemporaryFile(mode='w', suffix='.html', delete=False) as f:
            generate_timeline_html(timeline_data, f.name)
            html_content = open(f.name).read()

        assert 'KDM Playback Timeline' in html_content
        assert 'Test Movie' in html_content
        assert 'OK' in html_content
        os.unlink(f.name)


class TestIntegration:
    def test_end_to_end_workflow(self):
        from dcp_checker.cli import run_precheck

        manifest_data = {
            "Id": "urn:uuid:test",
            "Assets": [
                {"Id": "urn:uuid:asset1", "Type": "video/mxf"}
            ],
            "CPLs": [
                {
                    "Id": "urn:uuid:cpl1",
                    "UUID": "urn:uuid:cpl1",
                    "ContentTitleText": "Test Movie",
                    "ContentKind": "feature",
                    "RequiredAssets": ["urn:uuid:asset1"]
                }
            ],
            "PKLs": []
        }

        kdm_xml = """<?xml version="1.0" encoding="UTF-8"?>
<KDM xmlns="http://www.smpte-ra.org/standards/429-10/2007/KDM"
      Id="urn:uuid:kdm1" uuid="urn:uuid:kdm1">
  <ContentTitleText>Test Movie</ContentTitleText>
  <ContentAuthenticator>
    <ContentKeys><ContentKey><Private>KEY</Private></ContentKey></ContentKeys>
    <AuthenticatedPermissions>cinema</AuthenticatedPermissions>
  </ContentAuthenticator>
  <KDMValidityStart>2026-01-01T00:00:00</KDMValidityStart>
  <KDMValidityEnd>2026-12-31T23:59:59</KDMValidityEnd>
  <ServerFingerprint>AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99</ServerFingerprint>
  <ScreenList><Screen ScreenName="SCREEN01"/></ScreenList>
  <CPL Id="urn:uuid:cpl1" UUID="urn:uuid:cpl1">Test Movie</CPL>
</KDM>
"""

        csv_content = """screen_id,screen_name,server_type,server_serial,server_fingerprint,projector_type,projector_serial,lamp_hours
SCREEN01,Main Hall,Barco S4,SN001,AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99,Barco DP4K,PN001,100"""

        yaml_content = """showtimes:
  - screen_id: SCREEN01
    screen_name: Main Hall
    title: Test Movie
    show_date: "2026-05-15"
    show_time: "14:00"
    cpl_id: "urn:uuid:cpl1"
    cpl_uuid: "urn:uuid:cpl1"
    required_assets: ["urn:uuid:asset1"]
    duration_seconds: 7200
"""

        with tempfile.TemporaryDirectory() as tmpdir:
            manifest_path = os.path.join(tmpdir, 'manifest.json')
            kdm_path = os.path.join(tmpdir, 'kdm.xml')
            csv_path = os.path.join(tmpdir, 'screens.csv')
            yaml_path = os.path.join(tmpdir, 'schedule.yaml')
            output_dir = os.path.join(tmpdir, 'output')

            with open(manifest_path, 'w') as f:
                json.dump(manifest_data, f)

            with open(kdm_path, 'w') as f:
                f.write(kdm_xml)

            with open(csv_path, 'w') as f:
                f.write(csv_content)

            with open(yaml_path, 'w') as f:
                f.write(yaml_content)

            result = run_precheck(
                manifest_path=manifest_path,
                kdm_paths=[kdm_path],
                screens_csv=csv_path,
                schedule_yaml=yaml_path,
                output_dir=output_dir
            )

            assert result == 0
            assert os.path.exists(os.path.join(output_dir, 'kdm_audit.md'))
            assert os.path.exists(os.path.join(output_dir, 'issues.csv'))
            assert os.path.exists(os.path.join(output_dir, 'timeline.html'))
