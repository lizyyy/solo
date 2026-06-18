from datetime import datetime, timedelta
from typing import List
from models import SeagrassRecord


def generate_sample_records() -> List[SeagrassRecord]:
    base_time = datetime(2026, 6, 15, 9, 0, 0)

    records = [
        SeagrassRecord(
            record_id="REC-001",
            bottle_id="HC-2026-0001",
            sampling_time=base_time,
            lab_time=base_time + timedelta(hours=1),
            seagrass_coverage=45.2,
            biomass=520,
            species="Zostera marina",
            location={"lat": 22.1, "lon": 113.8},
            raw_data={"remote_sensing": {"cloud_cover": 15}}
        ),
        SeagrassRecord(
            record_id="REC-002",
            bottle_id="HC-2026-0002",
            sampling_time=base_time + timedelta(hours=2),
            lab_time=base_time + timedelta(hours=5),
            seagrass_coverage=62.8,
            biomass=480,
            species="Zostera marina",
            location={"lat": 22.15, "lon": 113.85},
            raw_data={"remote_sensing": {"cloud_cover": 20}}
        ),
        SeagrassRecord(
            record_id="REC-003",
            bottle_id=None,
            sampling_time=base_time + timedelta(hours=4),
            lab_time=base_time + timedelta(hours=5),
            seagrass_coverage=38.5,
            biomass=510,
            species="Halophila ovalis",
            location={"lat": 22.2, "lon": 113.9},
            raw_data={"remote_sensing": {"cloud_cover": 10}}
        ),
        SeagrassRecord(
            record_id="REC-004",
            bottle_id="HC-2026-0004",
            sampling_time=base_time + timedelta(hours=6),
            lab_time=base_time + timedelta(hours=10),
            seagrass_coverage=55.0,
            biomass=490,
            species="Zostera japonica",
            location={"lat": 22.25, "lon": 113.95},
            raw_data={"remote_sensing": {"cloud_cover": 25}}
        ),
        SeagrassRecord(
            record_id="REC-005",
            bottle_id="HC-2026-0005",
            sampling_time=base_time + timedelta(hours=8),
            lab_time=base_time + timedelta(hours=9),
            seagrass_coverage=2.3,
            biomass=980,
            species="Zostera marina",
            location={"lat": 22.3, "lon": 114.0},
            raw_data={"remote_sensing": {"cloud_cover": 18}}
        ),
        SeagrassRecord(
            record_id="REC-006",
            bottle_id="HC-2026-0006",
            sampling_time=base_time + timedelta(hours=10),
            lab_time=base_time + timedelta(hours=11),
            seagrass_coverage=70.5,
            biomass=470,
            species="Halophila ovalis",
            location={"lat": 22.35, "lon": 114.05},
            raw_data={"remote_sensing": {"cloud_cover": 45}}
        ),
        SeagrassRecord(
            record_id="REC-007",
            bottle_id="HC-2026-0007",
            sampling_time=base_time + timedelta(hours=12),
            lab_time=base_time + timedelta(hours=13),
            seagrass_coverage=97.2,
            biomass=20,
            species="Zostera marina",
            location={"lat": 22.4, "lon": 114.1},
            raw_data={"remote_sensing": {"cloud_cover": 8}}
        ),
        SeagrassRecord(
            record_id="REC-008",
            bottle_id="HC-2026-0008",
            sampling_time=None,
            lab_time=base_time + timedelta(hours=15),
            seagrass_coverage=48.9,
            biomass=500,
            species="Zostera japonica",
            location={"lat": 22.45, "lon": 114.15},
            raw_data={"remote_sensing": {"cloud_cover": 55}}
        ),
        SeagrassRecord(
            record_id="REC-009",
            bottle_id="BAD-FORMAT",
            sampling_time=base_time + timedelta(hours=16),
            lab_time=base_time + timedelta(hours=17),
            seagrass_coverage=52.1,
            biomass=515,
            species="Zostera marina",
            location={"lat": 21.81, "lon": 113.51},
            raw_data={"remote_sensing": {"cloud_cover": 12}}
        ),
        SeagrassRecord(
            record_id="REC-010",
            bottle_id="HC-2026-0010",
            sampling_time=base_time + timedelta(hours=18),
            lab_time=base_time + timedelta(hours=19),
            seagrass_coverage=65.4,
            biomass=485,
            species="Halophila ovalis",
            location={"lat": 22.18, "lon": 113.88},
            raw_data={"remote_sensing": {"cloud_cover": 5}}
        ),
    ]

    return records


def generate_edge_case_records() -> List[SeagrassRecord]:
    base_time = datetime(2026, 6, 16, 9, 0, 0)

    return [
        SeagrassRecord(
            record_id="EDGE-001",
            bottle_id="HC-2026-0101",
            sampling_time=base_time,
            lab_time=base_time + timedelta(minutes=30),
            seagrass_coverage=99.9,
            biomass=990,
            species="Zostera marina",
            location={"lat": 21.801, "lon": 113.501},
            raw_data={"remote_sensing": {"cloud_cover": 0}}
        ),
        SeagrassRecord(
            record_id="EDGE-002",
            bottle_id="HC-2026-0102",
            sampling_time=base_time,
            lab_time=base_time + timedelta(minutes=45),
            seagrass_coverage=0.1,
            biomass=5,
            species="Zostera marina",
            location={"lat": 22.499, "lon": 114.199},
            raw_data={"remote_sensing": {"cloud_cover": 0}}
        ),
    ]
