import pytest
import pandas as pd
from datetime import datetime, timedelta
from modules.data_parser import (
    parse_flights, parse_bag_scans, parse_carousel_allocations,
    parse_interventions, get_flight_bag_times, get_carousel_for_flight
)
from modules.rule_calculator import (
    calculate_flight_metrics, detect_carousel_conflicts,
    calculate_reassignment_impact, get_summary_stats
)


@pytest.fixture
def sample_flights_path():
    return "sample_data/flights.csv"


@pytest.fixture
def sample_bag_scans_path():
    return "sample_data/bag_scans.csv"


@pytest.fixture
def sample_carousel_path():
    return "sample_data/carousel_allocations.json"


@pytest.fixture
def sample_interventions_path():
    return "sample_data/interventions.yaml"


def test_parse_flights(sample_flights_path):
    df = parse_flights(sample_flights_path)
    assert not df.empty
    assert 'flight_num' in df.columns
    assert 'arrival_datetime' in df.columns
    assert 'expected_first_bag' in df.columns
    assert 'expected_last_bag' in df.columns
    assert len(df) == 8


def test_cross_midnight_flight(sample_flights_path):
    df = parse_flights(sample_flights_path)
    ca707 = df[df['flight_num'] == 'CA707'].iloc[0]
    assert ca707['expected_first_bag'] > ca707['arrival_datetime']


def test_parse_bag_scans(sample_bag_scans_path):
    df = parse_bag_scans(sample_bag_scans_path)
    assert not df.empty
    assert 'flight_num' in df.columns
    assert 'scan_datetime' in df.columns


def test_get_flight_bag_times(sample_bag_scans_path):
    df = parse_bag_scans(sample_bag_scans_path)
    first, last = get_flight_bag_times(df, 'CA101')
    assert first is not None
    assert last is not None
    assert first < last


def test_get_flight_bag_times_missing(sample_bag_scans_path):
    df = parse_bag_scans(sample_bag_scans_path)
    first, last = get_flight_bag_times(df, 'MU505')
    assert first is not None
    assert last is None


def test_parse_carousel_allocations(sample_carousel_path):
    allocations = parse_carousel_allocations(sample_carousel_path)
    assert '2026-05-01' in allocations
    assert 'T1' in allocations['2026-05-01']
    assert 'CA101' in allocations['2026-05-01']['T1']


def test_get_carousel_for_flight(sample_carousel_path):
    allocations = parse_carousel_allocations(sample_carousel_path)
    carousel = get_carousel_for_flight(allocations, 'CA101', '2026-05-01', 'T1')
    assert carousel == 'C1'


def test_parse_interventions(sample_interventions_path):
    interventions = parse_interventions(sample_interventions_path)
    assert len(interventions) == 2
    assert interventions[0]['type'] == 'carousel_reassign'


def test_calculate_flight_metrics(sample_flights_path, sample_bag_scans_path, sample_carousel_path, sample_interventions_path):
    flights_df = parse_flights(sample_flights_path)
    bag_scans_df = parse_bag_scans(sample_bag_scans_path)
    allocations = parse_carousel_allocations(sample_carousel_path)
    interventions = parse_interventions(sample_interventions_path)
    
    metrics_df = calculate_flight_metrics(flights_df, bag_scans_df, allocations, interventions)
    assert not metrics_df.empty
    assert 'first_delay_minutes' in metrics_df.columns
    assert 'last_overtime_minutes' in metrics_df.columns


def test_calculate_first_delay(sample_flights_path, sample_bag_scans_path, sample_carousel_path, sample_interventions_path):
    flights_df = parse_flights(sample_flights_path)
    bag_scans_df = parse_bag_scans(sample_bag_scans_path)
    allocations = parse_carousel_allocations(sample_carousel_path)
    interventions = parse_interventions(sample_interventions_path)
    
    metrics_df = calculate_flight_metrics(flights_df, bag_scans_df, allocations, interventions)
    ca101 = metrics_df[metrics_df['flight_num'] == 'CA101'].iloc[0]
    assert ca101['first_delay_minutes'] == 3


def test_detect_carousel_conflicts(sample_flights_path, sample_bag_scans_path, sample_carousel_path, sample_interventions_path):
    flights_df = parse_flights(sample_flights_path)
    bag_scans_df = parse_bag_scans(sample_bag_scans_path)
    allocations = parse_carousel_allocations(sample_carousel_path)
    interventions = parse_interventions(sample_interventions_path)
    
    metrics_df = calculate_flight_metrics(flights_df, bag_scans_df, allocations, interventions)
    conflicts = detect_carousel_conflicts(metrics_df)
    assert len(conflicts) > 0


def test_get_summary_stats(sample_flights_path, sample_bag_scans_path, sample_carousel_path, sample_interventions_path):
    flights_df = parse_flights(sample_flights_path)
    bag_scans_df = parse_bag_scans(sample_bag_scans_path)
    allocations = parse_carousel_allocations(sample_carousel_path)
    interventions = parse_interventions(sample_interventions_path)
    
    metrics_df = calculate_flight_metrics(flights_df, bag_scans_df, allocations, interventions)
    stats = get_summary_stats(metrics_df)
    assert 'total_flights' in stats
    assert 'avg_first_delay_minutes' in stats
    assert stats['total_flights'] == 8


def test_calculate_reassignment_impact(sample_flights_path, sample_bag_scans_path, sample_carousel_path, sample_interventions_path):
    flights_df = parse_flights(sample_flights_path)
    bag_scans_df = parse_bag_scans(sample_bag_scans_path)
    allocations = parse_carousel_allocations(sample_carousel_path)
    interventions = parse_interventions(sample_interventions_path)
    
    metrics_df = calculate_flight_metrics(flights_df, bag_scans_df, allocations, interventions)
    impacts = calculate_reassignment_impact(metrics_df, interventions)
    assert len(impacts) == 1
    assert impacts[0]['flight_num'] == 'MU505'
