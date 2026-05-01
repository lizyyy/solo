import pytest
import numpy as np
import tempfile
import os
from datetime import datetime
from pathlib import Path

from seismic_review.report import (
    ReportGenerator, generate_markdown_report, plot_waveform_preview
)
from seismic_review.data_loader import Event, WaveformData
from seismic_review.picker import ArrivalPick


class TestReportGenerator:
    def test_report_generator_initialization(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            gen = ReportGenerator(tmpdir)
            assert gen.output_dir == Path(tmpdir)
            assert gen.output_dir.exists()

    def test_generate_event_report(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            gen = ReportGenerator(tmpdir)

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

            anomalies = [
                {"station": "HB.XIAN", "reason": "arrival_mismatch", "details": "test"}
            ]
            matched_stations = [
                {"station": "HB.QISH", "pick": None, "matches": []}
            ]

            report_path = gen.generate_event_report(event, anomalies, matched_stations)

            assert os.path.exists(report_path)
            with open(report_path, 'r') as f:
                content = f.read()
                assert "E001" in content
                assert "31.8" in content

    def test_generate_anomalies_csv(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            gen = ReportGenerator(tmpdir)

            event = Event(
                event_id="E001",
                origin_time="2025-05-01T10:30:00",
                latitude=31.8,
                longitude=113.5,
                depth=10.0,
                magnitude=3.2,
                arrivals=[]
            )

            anomalies = [
                {"station": "HB.XIAN", "reason": "arrival_mismatch", "details": "test details"}
            ]

            csv_path = gen.generate_anomalies_csv(anomalies, event)

            assert os.path.exists(csv_path)
            with open(csv_path, 'r') as f:
                content = f.read()
                assert "station" in content
                assert "E001" in content


class TestGenerateMarkdownReport:
    def test_generate_markdown_report(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            event = Event(
                event_id="E001",
                origin_time="2025-05-01T10:30:00",
                latitude=31.8,
                longitude=113.5,
                depth=10.0,
                magnitude=3.2,
                arrivals=[]
            )

            output_path = os.path.join(tmpdir, "report.md")
            result_path = generate_markdown_report(event, [], [], output_path)

            assert os.path.exists(result_path)
            with open(result_path, 'r') as f:
                content = f.read()
                assert "E001" in content


class TestPlotWaveformPreview:
    def test_plot_waveform_preview_basic(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            waveform = WaveformData(
                network="HB",
                station="QISH",
                channel="BHZ",
                start_time="2025-05-01T10:30:00",
                sampling_rate=100.0,
                data=np.random.randn(1000) * 0.01
            )

            picks = []
            event_origin = 30.0
            output_path = os.path.join(tmpdir, "preview.png")

            result = plot_waveform_preview(
                waveform, picks, event_origin, output_path,
                title="Test Plot"
            )

            assert os.path.exists(result)
            assert result.endswith('.png')

    def test_plot_waveform_preview_with_picks(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            fs = 100.0
            n = 5000
            data = np.random.randn(n) * 0.01
            for i in range(n):
                t = i / fs
                data[i] += 0.5 * np.exp(-abs(t - 30) * 10) * np.sin(2 * np.pi * 5 * t)

            waveform = WaveformData(
                network="HB",
                station="QISH",
                channel="BHZ",
                start_time="2025-05-01T10:30:00",
                sampling_rate=fs,
                data=data
            )

            import dateutil.parser
            origin_dt = dateutil.parser.parse(waveform.start_time).timestamp()
            pick_time = origin_dt + 30.0

            picks = [
                ArrivalPick(
                    phase="P",
                    time=pick_time,
                    snr=10.0,
                    sta=5.0,
                    lta=1.0,
                    channel="BHZ"
                )
            ]

            event_origin = origin_dt
            output_path = os.path.join(tmpdir, "preview_with_picks.png")

            result = plot_waveform_preview(
                waveform, picks, event_origin, output_path
            )

            assert os.path.exists(result)
