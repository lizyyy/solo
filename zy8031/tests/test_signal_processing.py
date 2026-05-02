import pytest
import numpy as np

from seismic_review.signal_processing import (
    demean, bandpass_filter, process_waveform,
    calculate_sta_lta
)
from seismic_review.data_loader import WaveformData


class TestDemean:
    def test_demean_removes_mean(self):
        data = np.array([1.0, 2.0, 3.0, 4.0, 5.0])
        result = demean(data)
        assert np.abs(np.mean(result)) < 1e-10

    def test_demean_preserves_variance(self):
        data = np.array([1.0, 2.0, 3.0, 4.0, 5.0])
        result = demean(data)
        assert np.var(result) == np.var(data)


class TestBandpassFilter:
    def test_bandpass_basic(self):
        fs = 100.0
        t = np.linspace(0, 1, int(fs))
        data = np.sin(2 * np.pi * 5 * t) + np.sin(2 * np.pi * 10 * t)

        filtered = bandpass_filter(data, 1.0, 20.0, fs)

        assert len(filtered) == len(data)
        assert not np.any(np.isnan(filtered))

    def test_bandpass_invalid_frequencies(self):
        fs = 100.0
        data = np.random.randn(1000)

        with pytest.raises(ValueError):
            bandpass_filter(data, -1.0, 20.0, fs)

        with pytest.raises(ValueError):
            bandpass_filter(data, 1.0, 60.0, fs)

        with pytest.raises(ValueError):
            bandpass_filter(data, 20.0, 10.0, fs)


class TestProcessWaveform:
    def test_process_waveform_returns_processed(self):
        waveform = WaveformData(
            network="HB",
            station="QISH",
            channel="BHZ",
            start_time="2025-05-01T10:30:00",
            sampling_rate=100.0,
            data=np.random.randn(1000) * 0.01
        )

        result = process_waveform(waveform, lowcut=1.0, highcut=20.0)

        assert isinstance(result.processed_data, np.ndarray)
        assert len(result.processed_data) == len(waveform.data)
        assert result.processing_info["filtered"] == True
        assert result.processing_info["demeaned"] == True


class TestStaLta:
    def test_calculate_sta_lta(self):
        fs = 100.0
        n = 10000
        data = np.random.randn(n) * 0.01

        sta, lta = calculate_sta_lta(data, fs, sta_length=1.0, lta_length=15.0)

        assert len(sta) == n
        assert len(lta) == n
        assert np.all(sta >= 0)
        assert np.all(lta >= 0)

    def test_sta_lta_ratio_increases_at_signal(self):
        fs = 100.0
        n = 5000
        data = np.random.randn(n) * 0.01
        data[2000:2500] += 1.0

        sta, lta = calculate_sta_lta(data, fs, sta_length=1.0, lta_length=15.0)

        ratio = sta / (lta + 1e-10)
        assert np.max(ratio[2000:2500]) > np.max(ratio[:1000])
