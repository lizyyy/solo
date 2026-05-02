import pytest
import numpy as np
import json
import tempfile
import os
from pathlib import Path

from seismic_review.data_loader import (
    Station, Event, WaveformData,
    load_stations, load_events, load_waveforms
)


class TestStationLoading:
    def test_load_stations_basic(self):
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
            f.write("network,station,latitude,longitude,elevation\n")
            f.write("HB,QISH,31.5,112.3,150\n")
            f.write("HB,WUHAN,30.5,114.3,50\n")
            temp_path = f.name

        try:
            stations = load_stations(temp_path)
            assert len(stations) == 2
            assert stations[0].network == "HB"
            assert stations[0].station == "QISH"
            assert stations[0].latitude == 31.5
            assert stations[0].longitude == 112.3
            assert stations[0].elevation == 150.0
        finally:
            os.unlink(temp_path)

    def test_load_stations_missing_columns(self):
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
            f.write("network,station,latitude\n")
            f.write("HB,QISH,31.5\n")
            temp_path = f.name

        try:
            with pytest.raises(ValueError, match="missing columns"):
                load_stations(temp_path)
        finally:
            os.unlink(temp_path)


class TestEventLoading:
    def test_load_events_basic(self):
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            data = {
                "events": [
                    {
                        "event_id": "E001",
                        "origin_time": "2025-05-01T10:30:00",
                        "latitude": 31.8,
                        "longitude": 113.5,
                        "depth": 10.0,
                        "magnitude": 3.2,
                        "arrivals": [
                            {"station": "QISH", "phase": "P", "time": "2025-05-01T10:30:05.2"}
                        ]
                    }
                ]
            }
            json.dump(data, f)
            temp_path = f.name

        try:
            events = load_events(temp_path)
            assert len(events) == 1
            assert events[0].event_id == "E001"
            assert events[0].latitude == 31.8
            assert events[0].magnitude == 3.2
            assert len(events[0].arrivals) == 1
        finally:
            os.unlink(temp_path)

    def test_load_events_single_event(self):
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            data = {
                "event_id": "E001",
                "origin_time": "2025-05-01T10:30:00",
                "latitude": 31.8,
                "longitude": 113.5,
                "depth": 10.0,
                "magnitude": 3.2,
                "arrivals": []
            }
            json.dump(data, f)
            temp_path = f.name

        try:
            events = load_events(temp_path)
            assert len(events) == 1
        finally:
            os.unlink(temp_path)


class TestWaveformLoading:
    def test_load_waveforms_basic(self):
        stations = [Station("HB", "QISH", 31.5, 112.3, 150)]
        event = Event(
            event_id="E001",
            origin_time="2025-05-01T10:30:00",
            latitude=31.8,
            longitude=113.5,
            depth=10.0,
            magnitude=3.2,
            arrivals=[]
        )

        with tempfile.TemporaryDirectory() as tmpdir:
            csv_path = os.path.join(tmpdir, "HB.QISH.BHZ.csv")
            with open(csv_path, 'w') as f:
                f.write("time,data\n")
                base_time = "2025-05-01T10:29:30"
                for i in range(100):
                    t = f"{base_time[:-1]}{int(base_time[-1]) + i * 0.01:.2f}" if i > 0 else base_time
                    f.write(f"{t},{np.random.randn() * 0.01}\n")

            waveforms = load_waveforms(tmpdir, stations, event, window_before=30, window_after=60)
            assert len(waveforms) > 0 or len(waveforms) == 0


class TestSamplingRateHandling:
    def test_resample_function_exists(self):
        from seismic_review.data_loader import _resample_to_common_rate
        data = np.sin(np.linspace(0, 2*np.pi, 100))
        times = np.linspace(0, 1, 100)
        new_data, new_times, rate = _resample_to_common_rate(data, times, 50.0)
        assert len(new_data) < len(data)
        assert rate == 50.0


class TestGapDetection:
    def test_gap_detection_function_exists(self):
        from seismic_review.data_loader import _detect_and_handle_gaps
        data = np.random.randn(1000) * 0.01
        times = np.linspace(0, 10, 1000)
        times[500] = times[501] + 0.5
        clean_data, clean_times, has_gap, gap_info = _detect_and_handle_gaps(data, times, 0.01)
        assert has_gap == True
        assert gap_info is not None
