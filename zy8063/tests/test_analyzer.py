import pytest
import pandas as pd
from datetime import datetime
from pathlib import Path
from loom_analyzer.parser import parse_downtime_events, parse_shift_schedule, parse_yarn_batches, parse_sensor_data
from loom_analyzer.validator import remove_duplicate_events, validate_time_order, flag_overlapping_events
from loom_analyzer.aligner import align_events_to_shifts
from loom_analyzer.root_cause import classify_root_causes
from loom_analyzer.statistics import calculate_summary_statistics


@pytest.fixture
def sample_data_dir():
    return Path(__file__).parent.parent / "sample_data"


def test_parse_downtime_events(sample_data_dir):
    csv_path = sample_data_dir / "downtime_events.csv"
    df = parse_downtime_events(str(csv_path))
    
    assert len(df) == 10
    assert 'machine_id' in df.columns
    assert 'start_time' in df.columns
    assert 'end_time' in df.columns
    assert 'duration_minutes' in df.columns
    assert pd.api.types.is_datetime64_any_dtype(df['start_time'])


def test_parse_shift_schedule(sample_data_dir):
    json_path = sample_data_dir / "shifts.json"
    shifts = parse_shift_schedule(str(json_path))
    
    assert len(shifts) == 4
    assert 'id' in shifts[0]
    assert 'name' in shifts[0]
    assert isinstance(shifts[0]['start_time'], datetime)


def test_parse_yarn_batches(sample_data_dir):
    yaml_path = sample_data_dir / "yarn_batches.yaml"
    batches = parse_yarn_batches(str(yaml_path))
    
    assert len(batches) == 3
    assert 'batch_id' in batches[0]


def test_parse_sensor_data(sample_data_dir):
    jsonl_path = sample_data_dir / "sensors.jsonl"
    sensors = parse_sensor_data(str(jsonl_path))
    
    assert len(sensors) == 13
    assert 'machine_id' in sensors[0]
    assert isinstance(sensors[0]['timestamp'], datetime)


def test_remove_duplicate_events():
    data = {
        'machine_id': ['Loom-001', 'Loom-001', 'Loom-002'],
        'start_time': [
            datetime(2024, 5, 1, 8, 15),
            datetime(2024, 5, 1, 8, 15),
            datetime(2024, 5, 1, 10, 0)
        ],
        'end_time': [
            datetime(2024, 5, 1, 8, 25),
            datetime(2024, 5, 1, 8, 25),
            datetime(2024, 5, 1, 10, 18)
        ],
        'event_code': ['E001', 'E001', 'E002'],
        'description': ['断经', '断经', '换轴']
    }
    df = pd.DataFrame(data)
    
    df_clean, removed = remove_duplicate_events(df)
    
    assert removed == 1
    assert len(df_clean) == 2


def test_validate_time_order():
    data = {
        'machine_id': ['Loom-001', 'Loom-001'],
        'start_time': [
            datetime(2024, 5, 1, 9, 30), datetime(2024, 5, 1, 8, 15)],
        'end_time': [
            datetime(2024, 5, 1, 9, 40), datetime(2024, 5, 1, 8, 25)],
        'event_code': ['E002', 'E001'],
        'description': ['纬停', '断经']
    }
    df = pd.DataFrame(data)
    
    df_sorted = validate_time_order(df)
    
    assert df_sorted.iloc[0]['start_time'] < df_sorted.iloc[1]['start_time']


def test_classify_root_causes():
    data = {
        'machine_id': ['Loom-001', 'Loom-002', 'Loom-003', 'Loom-004'],
        'start_time': [
            datetime(2024, 5, 1, 8, 15),
            datetime(2024, 5, 1, 10, 0),
            datetime(2024, 5, 1, 14, 20),
            datetime(2024, 5, 1, 15, 30)
        ],
        'end_time': [
            datetime(2024, 5, 1, 8, 25),
            datetime(2024, 5, 1, 10, 18),
            datetime(2024, 5, 1, 14, 32),
            datetime(2024, 5, 1, 16, 0)
        ],
        'event_code': ['E001', 'E003', 'E004', 'E005'],
        'description': ['断经停台', '换轴', '传感器误报', '机械故障'],
        'duration_minutes': [10.0, 18.0, 12.0, 30.0]
    }
    df = pd.DataFrame(data)
    
    df_classified = classify_root_causes(df, [])
    
    assert 'root_cause' in df_classified.columns
    assert 'root_cause_category' in df_classified.columns
    
    causes = df_classified['root_cause_category'].tolist()
    assert '断经' in causes
    assert '换轴' in causes
    assert '传感器误报' in causes
    assert '机械' in causes


def test_calculate_summary_statistics():
    data = {
        'machine_id': ['Loom-001', 'Loom-001', 'Loom-002'],
        'shift_name': ['早班', '早班', '早班'],
        'shift_date': ['2024-05-01', '2024-05-01', '2024-05-01'],
        'root_cause_category': ['断经', '纬停', '换轴'],
        'root_cause': ['断经停台', '纬纱停台', '经轴更换'],
        'start_time': [
            datetime(2024, 5, 1, 8, 15), datetime(2024, 5, 1, 9, 30), datetime(2024, 5, 1, 10, 0)],
        'end_time': [
            datetime(2024, 5, 1, 8, 25), datetime(2024, 5, 1, 9, 40), datetime(2024, 5, 1, 10, 18)],
        'duration_minutes': [10.0, 10.0, 18.0]
    }
    df = pd.DataFrame(data)
    
    stats = calculate_summary_statistics(df)
    
    assert stats['total_events'] == 3
    assert stats['total_downtime_min'] == 38.0
    assert 'by_machine' in stats
    assert 'by_cause' in stats
    assert 'by_shift' in stats
