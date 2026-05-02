#!/usr/bin/env python3
"""Quick test script to verify the track cleaner project."""

import sys
sys.path.insert(0, '.')

from datetime import datetime
from pathlib import Path

print("=" * 70)
print("TRACK CLEANER - PROJECT VERIFICATION TEST")
print("=" * 70)

# Test 1: Basic imports
print("\n[1/7] Testing basic imports...")
try:
    from track_cleaner import __version__
    from track_cleaner.models.track import TrackPoint, TrackSegment, Track
    from track_cleaner.config import AppConfig, get_default_config
    from track_cleaner.geo import haversine_distance, calculate_speed
    from track_cleaner.rules import apply_all_rules, DuplicateTimestampRule
    from track_cleaner.parsers import SUPPORTED_FORMATS, GPXParser
    from track_cleaner.cleaning import create_clean_plan, execute_clean_plan
    from track_cleaner.reports import calculate_summary
    from track_cleaner.storage import HistoryDatabase, ImportStore
    print(f"   ✓ All modules imported successfully")
    print(f"   ✓ Version: {__version__}")
    print(f"   ✓ Supported formats: {SUPPORTED_FORMATS}")
except Exception as e:
    print(f"   ✗ Import failed: {e}")
    sys.exit(1)

# Test 2: Data models
print("\n[2/7] Testing data models...")
try:
    p1 = TrackPoint(
        latitude=39.9945,
        longitude=116.2080,
        elevation=100.0,
        timestamp=datetime(2024, 10, 15, 8, 0, 0)
    )
    p2 = TrackPoint(
        latitude=39.9955,
        longitude=116.2090,
        elevation=150.0,
        timestamp=datetime(2024, 10, 15, 8, 2, 30)
    )
    print(f"   ✓ TrackPoint created")
    
    segment = TrackSegment(points=[p1, p2], name="Test Segment")
    print(f"   ✓ TrackSegment created: {len(segment.points)} points")
    
    track = Track(name="Test Hike", segments=[segment])
    print(f"   ✓ Track created: {track.name}, {len(track.all_points)} points")
except Exception as e:
    print(f"   ✗ Model test failed: {e}")
    sys.exit(1)

# Test 3: Geo calculations
print("\n[3/7] Testing geo calculations...")
try:
    dist = haversine_distance(p1, p2)
    print(f"   ✓ Distance between 2 points: {dist:.2f} meters")
    
    speed = calculate_speed(p1, p2)
    if speed is not None:
        print(f"   ✓ Speed: {speed:.2f} km/h")
    else:
        print(f"   ⚠ Speed calculation returned None (may be expected)")
except Exception as e:
    print(f"   ✗ Geo calculation failed: {e}")
    sys.exit(1)

# Test 4: Configuration
print("\n[4/7] Testing configuration...")
try:
    config = get_default_config()
    print(f"   ✓ Default config loaded")
    print(f"     - Timezone: {config.timezone}")
    print(f"     - Speed threshold: {config.speed_threshold} km/h")
    print(f"     - Breakpoint threshold: {config.breakpoint_threshold} sec")
    print(f"     - Elevation spike threshold: {config.elevation_spike_threshold} m")
except Exception as e:
    print(f"   ✗ Config test failed: {e}")
    sys.exit(1)

# Test 5: Anomaly rules
print("\n[5/7] Testing anomaly rules...")
try:
    points = [
        TrackPoint(latitude=39.9945, longitude=116.2080, elevation=100.0, timestamp=datetime(2024, 10, 15, 8, 0, 0)),
        TrackPoint(latitude=39.9955, longitude=116.2090, elevation=150.0, timestamp=datetime(2024, 10, 15, 8, 2, 30)),
        TrackPoint(latitude=39.9955, longitude=116.2090, elevation=150.0, timestamp=datetime(2024, 10, 15, 8, 2, 30)),  # Duplicate
        TrackPoint(latitude=39.9965, longitude=116.2100, elevation=200.0, timestamp=datetime(2024, 10, 15, 8, 5, 0)),
        TrackPoint(latitude=39.9975, longitude=116.2110, elevation=500.0, timestamp=datetime(2024, 10, 15, 8, 7, 30)),  # Spike
        TrackPoint(latitude=39.9985, longitude=116.2120, elevation=250.0, timestamp=datetime(2024, 10, 15, 8, 10, 0)),
        TrackPoint(latitude=40.0005, longitude=116.2140, elevation=350.0, timestamp=datetime(2024, 10, 15, 9, 0, 0)),  # Break
    ]
    track = Track(name="Test", segments=[TrackSegment(points=points)])
    
    rule_results = apply_all_rules(track, config)
    print(f"   ✓ Rules applied, {len(rule_results)} issues detected")
    
    for result in rule_results:
        print(f"     - {result.rule_name}: {result.message[:60]}...")
except Exception as e:
    print(f"   ✗ Rules test failed: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# Test 6: Cleaning
print("\n[6/7] Testing cleaning...")
try:
    plan = create_clean_plan(track, config, rule_results)
    summary = plan.get_summary()
    print(f"   ✓ Clean plan created")
    print(f"     - Original points: {summary['original_points']}")
    print(f"     - Points to remove: {summary['points_to_remove']}")
    print(f"     - Split points: {summary['split_points']}")
    
    cleaned = execute_clean_plan(plan)
    print(f"   ✓ Cleaned track: {len(cleaned.segments)} segments, {len(cleaned.all_points)} points")
except Exception as e:
    print(f"   ✗ Cleaning test failed: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# Test 7: Summary calculation
print("\n[7/7] Testing summary calculation...")
try:
    track_summary = calculate_summary(track)
    print(f"   ✓ Summary calculated")
    print(f"     - Track: {track_summary.track_name}")
    print(f"     - Total distance: {track_summary.total_distance_km:.3f} km")
    print(f"     - Total time: {track_summary.total_time_hours:.2f} hours")
    print(f"     - Moving time: {track_summary.moving_time_hours:.2f} hours")
    print(f"     - Elevation gain: {track_summary.elevation_gain_m:.1f} m")
    print(f"     - Elevation loss: {track_summary.elevation_loss_m:.1f} m")
    print(f"     - Average speed: {track_summary.average_speed_kmh:.2f} km/h")
except Exception as e:
    print(f"   ✗ Summary test failed: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print("\n" + "=" * 70)
print("ALL TESTS PASSED!")
print("=" * 70)
print("\nProject structure:")
print("  track_cleaner/")
print("  ├── cli/main.py          (CLI entry point)")
print("  ├── models/              (Data models)")
print("  ├── config/              (Configuration)")
print("  ├── geo/                 (Geo calculations)")
print("  ├── parsers/             (GPX/KML/CSV parsers)")
print("  ├── rules/               (Anomaly detection rules)")
print("  ├── cleaning/            (Cleaning plan & execution)")
print("  ├── reports/             (Summary, comparison, export)")
print("  └── storage/             (History database, import store)")
print("\nAvailable commands (after pip install):")
print("  track-cleaner init      - Initialize project config")
print("  track-cleaner import    - Import track files")
print("  track-cleaner clean     - Clean track anomalies")
print("  track-cleaner summary   - Calculate trip summary")
print("  track-cleaner compare   - Compare planned vs actual")
print("  track-cleaner export    - Export cleaned track & reports")
print("  track-cleaner history   - Query history records")
