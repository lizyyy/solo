import os
import sys
import tempfile
import csv
import yaml
import json

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from data_importer import load_show_data, ShowData
from channel_mapper import ChannelMapper
from interpolator import Interpolator
from risk_detector import RiskDetector


def create_test_patch(file_path):
    with open(file_path, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=['fixture_id', 'fixture_name', 'dmx_channel', 'channel_name', 'channel_type'])
        writer.writeheader()
        writer.writerow({
            'fixture_id': 'TEST1',
            'fixture_name': 'Test Light 1',
            'dmx_channel': '1',
            'channel_name': 'Dimmer',
            'channel_type': 'Intensity'
        })
        writer.writerow({
            'fixture_id': 'TEST1',
            'fixture_name': 'Test Light 1',
            'dmx_channel': '2',
            'channel_name': 'Red',
            'channel_type': 'Color'
        })
        writer.writerow({
            'fixture_id': 'TEST2',
            'fixture_name': 'Test Light 2',
            'dmx_channel': '3',
            'channel_name': 'Dimmer',
            'channel_type': 'Intensity'
        })


def create_test_cues(file_path):
    cues = [
        {
            'cue_id': 'CUE1',
            'name': 'Test Cue 1',
            'fixture_values': {
                'TEST1': {
                    'Dimmer': 200,
                    'Red': 100
                },
                'TEST2': {
                    'Dimmer': 150
                }
            },
            'fade_in': 2.0,
            'fade_out': 1.0
        },
        {
            'cue_id': 'CUE2',
            'name': 'Test Cue 2',
            'fixture_values': {
                'TEST1': {
                    'Dimmer': 255,
                    'Red': 255
                },
                'TEST2': {
                    'Dimmer': 50
                }
            },
            'fade_in': 1.0,
            'fade_out': 0.5
        }
    ]
    with open(file_path, 'w', encoding='utf-8') as f:
        yaml.dump(cues, f, allow_unicode=True)


def create_test_timeline(file_path):
    timeline = {
        'show_name': 'Test Show',
        'total_duration': 20.0,
        'cues': [
            {
                'cue_id': 'CUE1',
                'start_time': 0.0,
                'end_time': 10.0
            },
            {
                'cue_id': 'CUE2',
                'start_time': 8.0,
                'end_time': 20.0
            }
        ]
    }
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(timeline, f, indent=2)


def test_data_import():
    with tempfile.TemporaryDirectory() as tmpdir:
        patch_path = os.path.join(tmpdir, 'patch.csv')
        cues_path = os.path.join(tmpdir, 'cues.yaml')
        timeline_path = os.path.join(tmpdir, 'timeline.json')

        create_test_patch(patch_path)
        create_test_cues(cues_path)
        create_test_timeline(timeline_path)

        show_data = load_show_data(patch_path, cues_path, timeline_path)

        assert isinstance(show_data, ShowData)
        assert show_data.show_name == 'Test Show'
        assert show_data.total_duration == 20.0
        assert len(show_data.patch) == 3
        assert len(show_data.cues) == 2
        assert len(show_data.timeline) == 2
        print("✓ test_data_import passed")


def test_channel_mapper():
    with tempfile.TemporaryDirectory() as tmpdir:
        patch_path = os.path.join(tmpdir, 'patch.csv')
        cues_path = os.path.join(tmpdir, 'cues.yaml')
        timeline_path = os.path.join(tmpdir, 'timeline.json')

        create_test_patch(patch_path)
        create_test_cues(cues_path)
        create_test_timeline(timeline_path)

        show_data = load_show_data(patch_path, cues_path, timeline_path)
        mapper = ChannelMapper(show_data)

        assert mapper.get_dmx_channel('TEST1', 'Dimmer') == 1
        assert mapper.get_dmx_channel('TEST1', 'Red') == 2
        assert mapper.get_dmx_channel('TEST2', 'Dimmer') == 3
        assert sorted(mapper.get_all_fixture_ids()) == ['TEST1', 'TEST2']
        assert sorted(mapper.get_all_dmx_channels()) == [1, 2, 3]
        assert mapper.get_cue('CUE1') is not None
        print("✓ test_channel_mapper passed")


def test_interpolator():
    with tempfile.TemporaryDirectory() as tmpdir:
        patch_path = os.path.join(tmpdir, 'patch.csv')
        cues_path = os.path.join(tmpdir, 'cues.yaml')
        timeline_path = os.path.join(tmpdir, 'timeline.json')

        create_test_patch(patch_path)
        create_test_cues(cues_path)
        create_test_timeline(timeline_path)

        show_data = load_show_data(patch_path, cues_path, timeline_path)
        mapper = ChannelMapper(show_data)
        interpolator = Interpolator(show_data, mapper)

        active = interpolator.get_active_cues(0.0)
        assert len(active) == 1
        assert active[0][1].cue_id == 'CUE1'

        value = interpolator.get_channel_value_at_time('TEST1', 'Dimmer', 1.0)
        assert 0 <= value <= 200

        value = interpolator.get_channel_value_at_time('TEST1', 'Dimmer', 5.0)
        assert value == 200

        all_values = interpolator.get_all_channel_values_at_time(5.0)
        assert 'TEST1' in all_values
        assert 'TEST2' in all_values
        print("✓ test_interpolator passed")


def test_risk_detector():
    with tempfile.TemporaryDirectory() as tmpdir:
        patch_path = os.path.join(tmpdir, 'patch.csv')
        cues_path = os.path.join(tmpdir, 'cues.yaml')
        timeline_path = os.path.join(tmpdir, 'timeline.json')

        create_test_patch(patch_path)
        create_test_cues(cues_path)
        create_test_timeline(timeline_path)

        show_data = load_show_data(patch_path, cues_path, timeline_path)
        mapper = ChannelMapper(show_data)
        risk_detector = RiskDetector(show_data, mapper)

        risks = risk_detector.detect_all_risks()

        overlap_found = any(r.type == 'TIME_OVERLAP' for r in risks)
        assert overlap_found

        current_risks = risk_detector.get_risks_at_time(9.0)
        assert len(current_risks) > 0

        risk_csv = os.path.join(tmpdir, 'risks.csv')
        risk_detector.export_risks_csv(risk_csv)
        assert os.path.exists(risk_csv)

        summary_md = os.path.join(tmpdir, 'summary.md')
        risk_detector.export_summary_md(summary_md)
        assert os.path.exists(summary_md)
        print("✓ test_risk_detector passed")


def test_conflict_detection():
    with tempfile.TemporaryDirectory() as tmpdir:
        patch_path = os.path.join(tmpdir, 'patch.csv')
        cues_path = os.path.join(tmpdir, 'cues.yaml')
        timeline_path = os.path.join(tmpdir, 'timeline.json')

        create_test_cues(cues_path)
        create_test_timeline(timeline_path)

        with open(patch_path, 'w', encoding='utf-8', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=['fixture_id', 'fixture_name', 'dmx_channel', 'channel_name', 'channel_type'])
            writer.writeheader()
            writer.writerow({
                'fixture_id': 'TEST1',
                'fixture_name': 'Test Light 1',
                'dmx_channel': '1',
                'channel_name': 'Dimmer',
                'channel_type': 'Intensity'
            })
            writer.writerow({
                'fixture_id': 'TEST2',
                'fixture_name': 'Test Light 2',
                'dmx_channel': '1',
                'channel_name': 'Dimmer',
                'channel_type': 'Intensity'
            })

        show_data = load_show_data(patch_path, cues_path, timeline_path)
        mapper = ChannelMapper(show_data)
        risk_detector = RiskDetector(show_data, mapper)

        risks = risk_detector.detect_all_risks()
        conflict_found = any(r.type == 'CHANNEL_CONFLICT' for r in risks)
        assert conflict_found
        print("✓ test_conflict_detection passed")


def main():
    print("Running DMX Preview Core Tests...\n")
    try:
        test_data_import()
        test_channel_mapper()
        test_interpolator()
        test_risk_detector()
        test_conflict_detection()
        print("\n🎉 All tests passed!")
    except Exception as e:
        print(f"\n❌ Test failed: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
