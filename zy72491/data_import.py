import json
from datetime import datetime
from typing import List, Dict, Any
from models import (
    EvaluationRecord, SamplingPoint, RampRecord,
    DataSource, RecordStatus
)


class DataImporter:
    @staticmethod
    def import_sampling_point(data: Dict[str, Any]) -> SamplingPoint:
        return SamplingPoint(
            id=data.get("id", ""),
            name=data.get("name", ""),
            data_source=DataSource(data.get("data_source", "白天正式表")),
            permeability_rate=float(data.get("permeability_rate", 0)),
            has_remarks=bool(data.get("remarks")),
            remarks=data.get("remarks"),
            collected_at=datetime.fromisoformat(data["collected_at"]) if data.get("collected_at") else None
        )

    @staticmethod
    def import_ramp(data: Dict[str, Any]) -> RampRecord:
        return RampRecord(
            id=data.get("id", ""),
            location=data.get("location", ""),
            has_ramp=bool(data.get("has_ramp")),
            ramp_slope=float(data["ramp_slope"]) if data.get("ramp_slope") else None,
            ramp_remarks=data.get("ramp_remarks")
        )

    @staticmethod
    def import_record(data: Dict[str, Any]) -> EvaluationRecord:
        sampling_points = [
            DataImporter.import_sampling_point(p)
            for p in data.get("sampling_points", [])
        ]
        ramp = DataImporter.import_ramp(data["ramp"]) if data.get("ramp") else None
        
        return EvaluationRecord(
            id=data.get("id", ""),
            road_name=data.get("road_name", ""),
            district=data.get("district", ""),
            score=float(data.get("score", 0)),
            sampling_points=sampling_points,
            ramp=ramp
        )

    @staticmethod
    def load_from_json(file_path: str) -> List[EvaluationRecord]:
        with open(file_path, 'r', encoding='utf-8') as f:
            data_list = json.load(f)
        return [DataImporter.import_record(data) for data in data_list]


def create_demo_data() -> List[EvaluationRecord]:
    case1_points = [
        SamplingPoint(
            id="p1-1",
            name="主路中段测点",
            data_source=DataSource.DAY_FORMAL,
            permeability_rate=0.85,
            collected_at=datetime(2025, 6, 1, 10, 30)
        ),
        SamplingPoint(
            id="p1-2",
            name="人行道入口测点",
            data_source=DataSource.DAY_FORMAL,
            permeability_rate=0.78,
            collected_at=datetime(2025, 6, 1, 10, 45)
        )
    ]
    case1_ramp = RampRecord(
        id="r1",
        location="主路东侧路口",
        has_ramp=True,
        ramp_slope=1.2
    )
    case1 = EvaluationRecord(
        id="REC-2025-001",
        road_name="幸福路",
        district="城东区",
        score=0,
        sampling_points=case1_points,
        ramp=case1_ramp
    )

    case2_points = [
        SamplingPoint(
            id="p2-1",
            name="公交站旁测点",
            data_source=DataSource.DAY_FORMAL,
            permeability_rate=0.72,
            collected_at=datetime(2025, 6, 2, 9, 15)
        ),
        SamplingPoint(
            id="p2-2",
            name="小区门口测点",
            data_source=DataSource.DAY_FORMAL,
            permeability_rate=0.68,
            collected_at=datetime(2025, 6, 2, 9, 30)
        )
    ]
    case2_ramp_initial = RampRecord(
        id="r2-initial",
        location="未记录",
        has_ramp=True,
        ramp_remarks="坡道信息不完整，待现场补录"
    )
    case2 = EvaluationRecord(
        id="REC-2025-002",
        road_name="建设路",
        district="城西区",
        score=0,
        sampling_points=case2_points,
        ramp=case2_ramp_initial
    )

    case3_points = [
        SamplingPoint(
            id="p3-1",
            name="商业街北口测点",
            data_source=DataSource.DAY_FORMAL,
            permeability_rate=0.55,
            collected_at=datetime(2025, 6, 3, 11, 0)
        ),
        SamplingPoint(
            id="p3-2",
            name="商业街南口测点",
            data_source=DataSource.DAY_FORMAL,
            permeability_rate=0.52,
            collected_at=datetime(2025, 6, 3, 11, 20)
        )
    ]
    case3_ramp = RampRecord(
        id="r3",
        location="商业街北口",
        has_ramp=True,
        ramp_slope=1.5
    )
    case3 = EvaluationRecord(
        id="REC-2025-003",
        road_name="人民路",
        district="城南区",
        score=0,
        sampling_points=case3_points,
        ramp=case3_ramp
    )

    return [case1, case2, case3]


def create_night_supplement_points() -> List[SamplingPoint]:
    return [
        SamplingPoint(
            id="p3-night-1",
            name="商业街中段夜间测点",
            data_source=DataSource.NIGHT_SAMPLING,
            permeability_rate=0.35,
            has_remarks=True,
            remarks="晚高峰后发现油污渗漏，透水层疑似堵塞，需环卫冲洗后复测",
            collected_at=datetime(2025, 6, 3, 22, 15)
        ),
        SamplingPoint(
            id="p3-night-2",
            name="地铁口夜间测点",
            data_source=DataSource.NIGHT_SAMPLING,
            permeability_rate=0.42,
            has_remarks=True,
            remarks="夜间洒水车冲洗后数据，白天可能因浮尘影响略低",
            collected_at=datetime(2025, 6, 3, 23, 0)
        )
    ]


def create_ramp_supplement() -> RampRecord:
    return RampRecord(
        id="r2-supplement",
        location="建设路公交站西侧",
        has_ramp=True,
        ramp_slope=1.8,
        ramp_remarks="坡道存在，但表面有磨损，防滑条部分脱落"
    )
