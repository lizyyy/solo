import pytest
import numpy as np
import json
import tempfile
import os
from datetime import datetime

from seismic_review.picker import (
    STA_LTA_Picker, pick_arrivals, compare_arrivals,
    ArrivalPick, ArrivalComparison
)
from seismic_review.data_loader import Event, WaveformData


class TestSTALTAPicker:
    def test_picker_initialization(self):
        picker = STA_LTA_Picker(
            sta_length=1.0,
            lta_length=15.0,
            threshold_on=3.0,
            threshold_off=1.5
        )
        assert picker.sta_length == 1.0
        assert picker.lta_length == 15.0
        assert picker.threshold_on == 3.0
        assert picker.threshold_off == 1.5

    def test_picker_with_synthetic_signal(self):
        picker = STA_LTA_Picker(
            sta_length=0.5,
            lta_length=5.0,
            threshold_on=2.0,
            threshold_off=1.0,
            min_sta_duration=0.2
        )

        fs = 100.0
        n = 3000
        data = np.random.randn(n) * 0.01
        data[1000:1500] += 0.5 * np.sin(2 * np.pi * 5 * np.linspace(0, 5, 500))

        waveform = WaveformData(
            network="HB",
            station="TEST",
            channel="BHZ",
            start_time="2025-05-01T10:30:00",
            sampling_rate=fs,
            data=data
        )

        origin_time = 10.0
        picks = picker.pick(waveform, origin_time)

        assert isinstance(picks, list)


class TestPickArrivals:
    def test_pick_arrivals_returns_dict(self):
        event = Event(
            event_id="E001",
            origin_time="2025-05-01T10:30:00",
            latitude=31.8,
            longitude=113.5,
            depth=10.0,
            magnitude=3.2,
            arrivals=[]
        )

        picker = STA_LTA_Picker()

        waveforms = {}
        picks = pick_arrivals(waveforms, event, picker)

        assert isinstance(picks, dict)


class TestCompareArrivals:
    def test_compare_arrivals_no_picks(self):
        event = Event(
            event_id="E001",
            origin_time="2025-05-01T10:30:00",
            latitude=31.8,
            longitude=113.5,
            depth=10.0,
            magnitude=3.2,
            arrivals=[
                {"station": "QISH", "phase": "P", "time": "2025-05-01T10:30:05.2"}
            ]
        )

        picks = {}
        anomalies, matched = compare_arrivals(picks, event, tolerance=2.0)

        assert len(anomalies) == 1
        assert anomalies[0]["reason"] == "no_picks"

    def test_compare_arrivals_with_match(self):
        import dateutil.parser

        event = Event(
            event_id="E001",
            origin_time="2025-05-01T10:30:00",
            latitude=31.8,
            longitude=113.5,
            depth=10.0,
            magnitude=3.2,
            arrivals=[
                {"station": "QISH", "phase": "P", "time": "2025-05-01T10:30:05.2"}
            ]
        )

        event_time = dateutil.parser.parse(event.origin_time)
        origin_timestamp = event_time.timestamp()

        pick_time = origin_timestamp + 5.0

        picks = {
            "HB.QISH": {
                "BHZ": [
                    ArrivalPick(
                        phase="P",
                        time=pick_time,
                        snr=10.0,
                        sta=5.0,
                        lta=1.0,
                        channel="BHZ"
                    )
                ]
            }
        }

        anomalies, matched = compare_arrivals(picks, event, tolerance=2.0)

        assert len(matched) == 1


class TestArrivalPick:
    def test_arrival_pick_creation(self):
        pick = ArrivalPick(
            phase="P",
            time=1234567890.0,
            snr=10.5,
            sta=3.2,
            lta=1.0,
            channel="BHZ"
        )

        assert pick.phase == "P"
        assert pick.time == 1234567890.0
        assert pick.snr == 10.5
