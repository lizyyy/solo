from __future__ import annotations

import math
from datetime import datetime

import pytest
from httpx import ASGITransport, AsyncClient

from doppler.models import (
    AnomalyType,
    CalibrationParams,
    Direction,
    NoiseLabel,
    RadarSample,
    ResultStatus,
    SpeedResult,
)
from doppler.converter import frequency_shift_to_speed
from doppler.calibration import CalibrationStore, validate_calibration
from doppler.anomaly import (
    check_direction_sign,
    check_lane_mismatch,
    check_noise_peak,
    determine_status,
    run_anomaly_checks,
)
from doppler.engine import process_sample, process_batch
from doppler.report import generate_batch_report
from doppler.audit import AuditLog
from main import app


_CAL_V1 = CalibrationParams(
    version="v1.0",
    radar_freq_hz=24150000000.0,
    angle_deg=30.0,
    speed_of_light=299792458.0,
    offset_mps=0.0,
    scale_factor=1.0,
)


def _make_sample(
    sample_id: str = "S001",
    frequency_shift_hz: float = 1000.0,
    lane_id: int = 1,
    direction: Direction = Direction.APPROACHING,
    noise_label: NoiseLabel = NoiseLabel.CLEAN,
    snr_db: float | None = None,
    expected_lane: int | None = None,
    supplementary: bool = False,
) -> RadarSample:
    return RadarSample(
        sample_id=sample_id,
        frequency_shift_hz=frequency_shift_hz,
        lane_id=lane_id,
        direction=direction,
        noise_label=noise_label,
        sampling_time=datetime(2026, 5, 29, 10, 0, 0),
        snr_db=snr_db,
        expected_lane=expected_lane,
        supplementary=supplementary,
    )


class TestFrequencyShiftConversion:

    def test_basic_conversion_approaching(self):
        speed, steps = frequency_shift_to_speed(1000.0, _CAL_V1)
        assert speed > 0
        assert len(steps) == 7
        f0 = _CAL_V1.radar_freq_hz
        c = _CAL_V1.speed_of_light
        theta = math.radians(30.0)
        expected = abs(1000.0) * c / (2.0 * f0 * math.cos(theta))
        assert abs(speed - expected) < 1e-6

    def test_negative_shift_receding(self):
        speed, steps = frequency_shift_to_speed(-2000.0, _CAL_V1)
        assert speed > 0
        f0 = _CAL_V1.radar_freq_hz
        c = _CAL_V1.speed_of_light
        theta = math.radians(30.0)
        expected = abs(-2000.0) * c / (2.0 * f0 * math.cos(theta))
        assert abs(speed - expected) < 1e-6

    def test_zero_shift(self):
        speed, steps = frequency_shift_to_speed(0.0, _CAL_V1)
        assert speed == 0.0

    def test_90_degree_raises(self):
        cal = CalibrationParams(
            version="bad", radar_freq_hz=24.15e9, angle_deg=90.0
        )
        with pytest.raises(ValueError, match="cos"):
            frequency_shift_to_speed(1000.0, cal)

    def test_calibration_offset_and_scale(self):
        cal = CalibrationParams(
            version="v1.1",
            radar_freq_hz=24150000000.0,
            angle_deg=30.0,
            offset_mps=-0.15,
            scale_factor=1.002,
        )
        speed, steps = frequency_shift_to_speed(1000.0, cal)
        f0 = cal.radar_freq_hz
        c = cal.speed_of_light
        theta = math.radians(30.0)
        raw = abs(1000.0) * c / (2.0 * f0 * math.cos(theta))
        expected = raw * 1.002 + (-0.15)
        assert abs(speed - expected) < 1e-4

    def test_steps_are_ordered(self):
        _, steps = frequency_shift_to_speed(500.0, _CAL_V1)
        numbers = [s.step_number for s in steps]
        assert numbers == list(range(1, len(steps) + 1))


class TestCalibration:

    def test_default_versions_exist(self):
        store = CalibrationStore()
        assert "v1.0" in store.list_versions()
        assert "v1.1" in store.list_versions()
        assert "v2.0" in store.list_versions()

    def test_get_existing(self):
        store = CalibrationStore()
        cal = store.get("v1.0")
        assert cal is not None
        assert cal.version == "v1.0"

    def test_get_missing(self):
        store = CalibrationStore()
        assert store.get("v9.9") is None

    def test_register_new(self):
        store = CalibrationStore()
        new_cal = CalibrationParams(
            version="v3.0", radar_freq_hz=10e9, angle_deg=20.0
        )
        store.register(new_cal)
        assert store.get("v3.0") is not None

    def test_validate_good(self):
        valid, steps = validate_calibration(_CAL_V1)
        assert valid is True
        assert any("通过" in s.output_value for s in steps)

    def test_validate_returns_steps(self):
        valid, steps = validate_calibration(_CAL_V1)
        assert valid is True
        assert len(steps) > 0
        assert any("校验" in s.step_name for s in steps)


class TestAnomalyDetection:

    def test_clean_sample_no_anomaly(self):
        sample = _make_sample(noise_label=NoiseLabel.CLEAN, snr_db=20.0)
        anomalies, steps = run_anomaly_checks(sample)
        assert len(anomalies) == 0

    def test_peak_noise_flagged(self):
        sample = _make_sample(noise_label=NoiseLabel.PEAK_NOISE)
        flag = check_noise_peak(sample)
        assert flag is not None
        assert flag.anomaly_type == AnomalyType.NOISE_PEAK
        assert "待确认" in flag.suggestion

    def test_high_noise_low_snr_flagged(self):
        sample = _make_sample(noise_label=NoiseLabel.HIGH_NOISE, snr_db=5.0)
        flag = check_noise_peak(sample)
        assert flag is not None
        assert flag.severity == "critical"

    def test_high_noise_without_snr_flagged_warning(self):
        sample = _make_sample(noise_label=NoiseLabel.HIGH_NOISE)
        flag = check_noise_peak(sample)
        assert flag is not None
        assert flag.severity == "warning"

    def test_clean_low_snr_flagged(self):
        sample = _make_sample(noise_label=NoiseLabel.CLEAN, snr_db=3.0)
        flag = check_noise_peak(sample)
        assert flag is not None
        assert "信噪比偏低" in flag.suggestion

    def test_lane_mismatch_flagged(self):
        sample = _make_sample(lane_id=2, expected_lane=3)
        flag = check_lane_mismatch(sample)
        assert flag is not None
        assert flag.anomaly_type == AnomalyType.LANE_MISMATCH
        assert "待确认" in flag.suggestion

    def test_lane_match_no_flag(self):
        sample = _make_sample(lane_id=2, expected_lane=2)
        flag = check_lane_mismatch(sample)
        assert flag is None

    def test_lane_no_expected_no_flag(self):
        sample = _make_sample(lane_id=2, expected_lane=None)
        flag = check_lane_mismatch(sample)
        assert flag is None

    def test_direction_sign_reversal_approaching_negative(self):
        sample = _make_sample(frequency_shift_hz=-500.0, direction=Direction.APPROACHING)
        flag = check_direction_sign(sample)
        assert flag is not None
        assert flag.anomaly_type == AnomalyType.DIRECTION_SIGN_REVERSAL
        assert flag.severity == "critical"
        assert "待确认" in flag.suggestion

    def test_direction_sign_reversal_receding_positive(self):
        sample = _make_sample(frequency_shift_hz=500.0, direction=Direction.RECEDING)
        flag = check_direction_sign(sample)
        assert flag is not None
        assert flag.anomaly_type == AnomalyType.DIRECTION_SIGN_REVERSAL

    def test_direction_sign_correct_approaching(self):
        sample = _make_sample(frequency_shift_hz=500.0, direction=Direction.APPROACHING)
        flag = check_direction_sign(sample)
        assert flag is None

    def test_direction_sign_correct_receding(self):
        sample = _make_sample(frequency_shift_hz=-500.0, direction=Direction.RECEDING)
        flag = check_direction_sign(sample)
        assert flag is None

    def test_determine_status_confirmed(self):
        assert determine_status([]) == "confirmed"

    def test_determine_status_pending_review(self):
        from doppler.models import AnomalyFlag
        flags = [AnomalyFlag(anomaly_type=AnomalyType.LANE_MISMATCH, detail="x", severity="warning")]
        assert determine_status(flags) == "pending_review"

    def test_determine_status_rejected(self):
        from doppler.models import AnomalyFlag
        flags = [AnomalyFlag(anomaly_type=AnomalyType.NOISE_PEAK, detail="x", severity="critical")]
        assert determine_status(flags) == "rejected"

    def test_multiple_anomalies_critical_wins(self):
        sample = _make_sample(
            frequency_shift_hz=-100.0,
            direction=Direction.APPROACHING,
            noise_label=NoiseLabel.PEAK_NOISE,
            lane_id=1,
            expected_lane=2,
        )
        anomalies, steps = run_anomaly_checks(sample)
        assert len(anomalies) == 3
        status = determine_status(anomalies)
        assert status == "rejected"

    def test_anomaly_steps_order(self):
        sample = _make_sample(noise_label=NoiseLabel.PEAK_NOISE)
        _, steps = run_anomaly_checks(sample)
        numbers = [s.step_number for s in steps]
        assert numbers == [1, 2, 3]


class TestEngine:

    def test_normal_sample_confirmed(self):
        sample = _make_sample(
            frequency_shift_hz=1000.0,
            direction=Direction.APPROACHING,
            noise_label=NoiseLabel.CLEAN,
            snr_db=25.0,
        )
        result = process_sample(sample, _CAL_V1)
        assert result.status == ResultStatus.CONFIRMED
        assert result.speed_kmh is not None
        assert result.speed_kmh > 0
        assert len(result.processing_steps) > 0

    def test_critical_anomaly_rejected(self):
        sample = _make_sample(
            frequency_shift_hz=-1000.0,
            direction=Direction.APPROACHING,
            noise_label=NoiseLabel.PEAK_NOISE,
        )
        result = process_sample(sample, _CAL_V1)
        assert result.status == ResultStatus.REJECTED
        assert len(result.anomalies) > 0

    def test_warning_anomaly_pending_review(self):
        sample = _make_sample(
            frequency_shift_hz=1000.0,
            direction=Direction.APPROACHING,
            noise_label=NoiseLabel.CLEAN,
            lane_id=1,
            expected_lane=3,
        )
        result = process_sample(sample, _CAL_V1)
        assert result.status == ResultStatus.PENDING_REVIEW

    def test_supplementary_data_handled(self):
        sample = _make_sample(
            sample_id="S-SUPP-001",
            frequency_shift_hz=-800.0,
            direction=Direction.RECEDING,
            noise_label=NoiseLabel.LOW_NOISE,
            supplementary=True,
        )
        result = process_sample(sample, _CAL_V1)
        assert result.status == ResultStatus.CONFIRMED
        assert result.speed_kmh is not None

    def test_processing_steps_show_full_pipeline(self):
        sample = _make_sample(noise_label=NoiseLabel.CLEAN, snr_db=20.0)
        result = process_sample(sample, _CAL_V1)
        step_names = [s.step_name for s in result.processing_steps]
        assert "校准参数校验" in step_names
        assert "确认物理常量" in step_names
        assert "多普勒频移换算速度" in step_names
        assert "噪声峰检测" in step_names
        assert "车道错配检测" in step_names
        assert "方向符号反检测" in step_names

    def test_batch_processing(self):
        samples = [
            _make_sample(sample_id="B001", frequency_shift_hz=1000.0, direction=Direction.APPROACHING, noise_label=NoiseLabel.CLEAN),
            _make_sample(sample_id="B002", frequency_shift_hz=-500.0, direction=Direction.APPROACHING, noise_label=NoiseLabel.PEAK_NOISE),
            _make_sample(sample_id="B003", frequency_shift_hz=-2000.0, direction=Direction.RECEDING, noise_label=NoiseLabel.MODERATE_NOISE, expected_lane=5, lane_id=3),
        ]
        results = process_batch(samples, _CAL_V1)
        assert len(results) == 3
        assert results[0].status == ResultStatus.CONFIRMED
        assert results[1].status == ResultStatus.REJECTED
        assert results[2].status == ResultStatus.PENDING_REVIEW


class TestReport:

    def test_generate_report_counts(self):
        r1 = SpeedResult(sample_id="A", status=ResultStatus.CONFIRMED, speed_kmh=100.0)
        r2 = SpeedResult(sample_id="B", status=ResultStatus.PENDING_REVIEW)
        r3 = SpeedResult(sample_id="C", status=ResultStatus.REJECTED)
        report = generate_batch_report([r1, r2, r3])
        assert report.total_samples == 3
        assert report.confirmed_count == 1
        assert report.pending_count == 1
        assert report.rejected_count == 1
        assert report.report_id.startswith("RPT-")


class TestAuditLog:

    def test_log_and_query(self):
        log = AuditLog()
        log.log("/test", "GET", "req", "resp")
        log.log("/test", "POST", "req2", "resp2")
        records = log.query()
        assert len(records) == 2

    def test_query_by_endpoint(self):
        log = AuditLog()
        log.log("/a", "GET", "r", "r")
        log.log("/b", "GET", "r", "r")
        records = log.query(endpoint="/a")
        assert len(records) == 1

    def test_count(self):
        log = AuditLog()
        assert log.count() == 0
        log.log("/x", "GET", "r", "r")
        assert log.count() == 1


@pytest.fixture
def client():
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


class TestAPIEndpoints:

    @pytest.mark.asyncio
    async def test_health_check(self, client):
        resp = await client.get("/api/v1/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"

    @pytest.mark.asyncio
    async def test_list_calibrations(self, client):
        resp = await client.get("/api/v1/calibration/versions")
        assert resp.status_code == 200
        versions = resp.json()["versions"]
        assert "v1.0" in versions

    @pytest.mark.asyncio
    async def test_get_calibration(self, client):
        resp = await client.get("/api/v1/calibration/v1.0")
        assert resp.status_code == 200
        data = resp.json()
        assert data["version"] == "v1.0"

    @pytest.mark.asyncio
    async def test_get_missing_calibration(self, client):
        resp = await client.get("/api/v1/calibration/v99.0")
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_register_calibration(self, client):
        resp = await client.post("/api/v1/calibration/register", json={
            "params": {
                "version": "v3.0",
                "radar_freq_hz": 10000000000.0,
                "angle_deg": 25.0,
            }
        })
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_single_calculate_normal(self, client):
        resp = await client.post("/api/v1/speed/calculate", json={
            "sample": {
                "sample_id": "API-001",
                "frequency_shift_hz": 1500.0,
                "lane_id": 1,
                "direction": "approaching",
                "noise_label": "clean",
                "sampling_time": "2026-05-29T10:00:00",
                "snr_db": 22.0,
            },
            "calibration_version": "v1.0",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "confirmed"
        assert data["speed_kmh"] is not None
        assert len(data["processing_steps"]) > 0

    @pytest.mark.asyncio
    async def test_single_calculate_with_anomaly(self, client):
        resp = await client.post("/api/v1/speed/calculate", json={
            "sample": {
                "sample_id": "API-002",
                "frequency_shift_hz": -800.0,
                "lane_id": 2,
                "direction": "approaching",
                "noise_label": "peak_noise",
                "sampling_time": "2026-05-29T10:00:00",
            },
            "calibration_version": "v1.0",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "rejected"
        assert len(data["anomalies"]) >= 1

    @pytest.mark.asyncio
    async def test_batch_calculate(self, client):
        resp = await client.post("/api/v1/speed/batch", json={
            "samples": [
                {
                    "sample_id": "BATCH-001",
                    "frequency_shift_hz": 1000.0,
                    "lane_id": 1,
                    "direction": "approaching",
                    "noise_label": "clean",
                    "sampling_time": "2026-05-29T10:00:00",
                    "snr_db": 20.0,
                },
                {
                    "sample_id": "BATCH-002",
                    "frequency_shift_hz": 500.0,
                    "lane_id": 3,
                    "direction": "receding",
                    "noise_label": "high_noise",
                    "sampling_time": "2026-05-29T10:01:00",
                    "snr_db": 5.0,
                    "expected_lane": 3,
                },
                {
                    "sample_id": "BATCH-003",
                    "frequency_shift_hz": -2000.0,
                    "lane_id": 2,
                    "direction": "approaching",
                    "noise_label": "peak_noise",
                    "sampling_time": "2026-05-29T10:02:00",
                },
            ],
            "calibration_version": "v1.0",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_samples"] == 3
        assert data["confirmed_count"] >= 1
        assert data["rejected_count"] >= 1

    @pytest.mark.asyncio
    async def test_calculate_with_override(self, client):
        resp = await client.post("/api/v1/speed/calculate", json={
            "sample": {
                "sample_id": "OVR-001",
                "frequency_shift_hz": 1000.0,
                "lane_id": 1,
                "direction": "approaching",
                "noise_label": "clean",
                "sampling_time": "2026-05-29T10:00:00",
            },
            "calibration_version": "v1.0",
            "calibration_override": {
                "version": "custom",
                "radar_freq_hz": 24150000000.0,
                "angle_deg": 45.0,
                "offset_mps": 0.5,
                "scale_factor": 0.998,
            },
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["calibration_version"] == "custom"

    @pytest.mark.asyncio
    async def test_audit_trail(self, client):
        await client.get("/api/v1/health")
        resp = await client.get("/api/v1/audit/trail")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] >= 1

    @pytest.mark.asyncio
    async def test_audit_trail_filter(self, client):
        resp = await client.get("/api/v1/audit/trail", params={"endpoint": "/api/v1/health"})
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_missing_cal_version_404(self, client):
        resp = await client.post("/api/v1/speed/calculate", json={
            "sample": {
                "sample_id": "MISS-001",
                "frequency_shift_hz": 1000.0,
                "lane_id": 1,
                "direction": "approaching",
                "noise_label": "clean",
                "sampling_time": "2026-05-29T10:00:00",
            },
            "calibration_version": "v999.0",
        })
        assert resp.status_code == 404
