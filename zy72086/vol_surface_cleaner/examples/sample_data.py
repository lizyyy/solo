import uuid
import numpy as np
from datetime import datetime
from typing import List, Dict, Tuple, Any

from core.models import (
    VolatilitySurface,
    VolatilityPoint,
    DataSource,
    DataSourceType,
    RecordStatus
)


def generate_sample_surface(underlying: str = "50ETF",
                            trade_date: datetime = None,
                            has_anomaly: bool = False) -> Tuple[VolatilitySurface, Dict[str, float]]:
    if trade_date is None:
        trade_date = datetime(2026, 5, 30)

    surface_id = f"VOL_{underlying}_{trade_date.strftime('%Y%m%d')}_{str(uuid.uuid4())[:4]}"

    tenors = ["1M", "3M", "6M", "1Y", "2Y", "3Y"]
    maturities = [1/12, 3/12, 6/12, 1.0, 2.0, 3.0]
    strikes = [2.5, 2.6, 2.7, 2.8, 2.9, 3.0, 3.1, 3.2, 3.3, 3.4, 3.5]

    np.random.seed(42)

    points: List[VolatilityPoint] = []
    data_sources: List[DataSource] = []

    lecture_ds = DataSource(
        source_type=DataSourceType.LECTURE_NOTE,
        source_name="金融工程讲义-第7章",
        source_path="/docs/lectures/vol_surface.pdf",
        field_mapping={"行权价": "strike", "隐含波动率": "implied_vol", "期限": "tenor"},
        raw_data_hash="a1b2c3d4e5f6"
    )
    data_sources.append(lecture_ds)

    business_ds = DataSource(
        source_type=DataSourceType.BUSINESS_TABLE,
        source_name="期权做市系统导出_20260530",
        source_path="/data/export/market_data_20260530.csv",
        field_mapping={"执行价": "strike", "IV": "implied_vol", "到期日": "maturity"},
        raw_data_hash="f6e5d4c3b2a1"
    )
    data_sources.append(business_ds)

    screenshot_ds = DataSource(
        source_type=DataSourceType.SCREENSHOT,
        source_name="彭博终端截图_15:30",
        source_path="/screenshots/bloomberg_20260530_1530.png",
        field_mapping={"Strike": "strike", "Vol": "implied_vol", "Expiry": "tenor"},
        raw_data_hash="1234567890ab"
    )
    data_sources.append(screenshot_ds)

    for tenor_idx, (tenor, maturity) in enumerate(zip(tenors, maturities)):
        base_vol = 0.15 + tenor_idx * 0.01

        for strike in strikes:
            moneyness = strike / 3.0
            smile = 0.08 * (moneyness - 1.0) ** 2 + 0.02 * (1.0 - moneyness)
            true_vol = base_vol + smile

            if tenor_idx < 2:
                source = "lecture_note"
                noise = np.random.normal(0, 0.003)
            elif tenor_idx < 4:
                source = "business_table"
                noise = np.random.normal(0, 0.001)
            else:
                source = "screenshot"
                noise = np.random.normal(0, 0.008)

            observed_vol = true_vol + noise
            observed_vol = max(0.01, min(1.0, observed_vol))

            if has_anomaly and strike == 2.8 and tenor == "6M":
                observed_vol = 2.5

            if has_anomaly and strike == 3.2 and tenor == "1Y":
                observed_vol = 0.8

            tags = []
            if source == "lecture_note":
                tags.append("lecture_import")
            elif source == "business_table":
                tags.append("business_import")
            elif source == "screenshot":
                tags.append("screenshot_ocr")

            confidence_map = {
                "lecture_note": 0.6,
                "business_table": 0.9,
                "screenshot": 0.4
            }

            vp = VolatilityPoint(
                strike=strike,
                maturity=maturity,
                implied_vol=round(observed_vol, 4),
                tenor=tenor,
                option_type="call",
                raw_value=round(observed_vol, 4),
                data_source_id=source,
                confidence=confidence_map.get(source, 0.5),
                tags=tags
            )
            points.append(vp)

    if has_anomaly:
        for tenor, maturity in [("1M", 1/12), ("3M", 3/12)]:
            for strike in [2.8, 3.0, 3.2]:
                base_vol = 0.16 if tenor == "1M" else 0.18
                moneyness = strike / 3.0
                smile = 0.08 * (moneyness - 1.0) ** 2
                put_vol = base_vol + smile - 0.005
                vp = VolatilityPoint(
                    strike=strike,
                    maturity=maturity,
                    implied_vol=round(put_vol, 4),
                    tenor=tenor,
                    option_type="put",
                    raw_value=round(put_vol + 0.06, 4),
                    data_source_id="business_table",
                    confidence=0.9,
                    tags=["business_import", "arbitrage_test"]
                )
                points.append(vp)

    surface = VolatilitySurface(
        surface_id=surface_id,
        underlying=underlying,
        trade_date=trade_date,
        points=points,
        data_sources=data_sources,
        status=RecordStatus.PENDING_REVIEW,
        comments=f"样例曲面 - {underlying} @ {trade_date.strftime('%Y-%m-%d')}"
    )

    summary_data = {}
    for p in points:
        if not p.is_outlier:
            key = f"{p.tenor}_{p.strike:.4f}"
            summary_data[key] = p.implied_vol

    return surface, summary_data


def generate_summary_page_data() -> Dict[str, float]:
    data = {
        "1M_2.5000": 0.225,
        "1M_2.8000": 0.185,
        "1M_3.0000": 0.160,
        "1M_3.2000": 0.180,
        "1M_3.5000": 0.240,
        "3M_2.5000": 0.235,
        "3M_2.8000": 0.195,
        "3M_3.0000": 0.170,
        "3M_3.2000": 0.190,
        "3M_3.5000": 0.250,
        "6M_2.5000": 0.245,
        "6M_2.8000": 0.205,
        "6M_3.0000": 0.180,
        "6M_3.2000": 0.200,
        "6M_3.5000": 0.260,
        "1Y_2.5000": 0.255,
        "1Y_2.8000": 0.215,
        "1Y_3.0000": 0.190,
        "1Y_3.2000": 0.210,
        "1Y_3.5000": 0.270,
        "2Y_2.5000": 0.265,
        "2Y_3.0000": 0.200,
        "2Y_3.5000": 0.280,
        "3Y_2.5000": 0.275,
        "3Y_3.0000": 0.210,
        "3Y_3.5000": 0.290
    }

    data["1Y_3.0000"] = 0.220
    data["3M_3.0000"] = 0.200

    return data


def create_three_sample_records() -> Tuple[VolatilitySurface, VolatilitySurface, VolatilitySurface]:
    surface1, _ = generate_sample_surface(
        underlying="50ETF",
        trade_date=datetime(2026, 5, 28),
        has_anomaly=False
    )
    surface1.status = RecordStatus.SUCCESS
    surface1.comments = "【样例1】顺利记录 - 数据质量良好，无异常值，无冲突，自动清洗通过"

    surface2, _ = generate_sample_surface(
        underlying="50ETF",
        trade_date=datetime(2026, 5, 29),
        has_anomaly=True
    )
    surface2.status = RecordStatus.PENDING_REVIEW
    surface2.comments = "【样例2】待确认记录 - 检测到异常值、套利机会和潜在冲突，需要人工复核"

    surface3, _ = generate_sample_surface(
        underlying="50ETF",
        trade_date=datetime(2026, 5, 27),
        has_anomaly=False
    )
    surface3.status = RecordStatus.LEGACY_CALIBRATION
    for p in surface3.points:
        if p.tenor in ["2Y", "3Y"]:
            p.tags.append("legacy")
            p.review_comment = "旧口径数据 - 来自2025年Q4校准方法，已标注供对比参考"
    surface3.comments = "【样例3】旧口径记录 - 从老板汇总页补充的历史数据，使用2025年旧版校准口径"
    surface3.metadata["legacy_method"] = "2025_Q4_SABR_calibration"
    surface3.metadata["source_page"] = "老板汇总页-历史数据区第3行"

    return surface1, surface2, surface3


def generate_conflict_scenario() -> Tuple[VolatilitySurface, Dict[str, float], Dict[str, Any]]:
    surface, _ = generate_sample_surface(
        underlying="300ETF",
        trade_date=datetime(2026, 5, 30),
        has_anomaly=True
    )

    summary_data = generate_summary_page_data()

    conflict_evidence = {
        "conflict_points": [
            {
                "tenor": "1Y",
                "strike": 3.0,
                "imported_value": 0.190,
                "summary_value": 0.220,
                "difference_pct": 15.8,
                "imported_source": "业务系统导出表",
                "summary_source": "老板看的汇总页-单元格D15",
                "suggested_action": "请核对：\n1. 业务表导出时间是否与汇总页一致\n2. 是否有盘中调整未同步\n3. 检查汇总页公式是否正确引用了该单元格",
                "evidence_links": [
                    "业务表原始文件: /data/export/market_data_20260530.csv",
                    "汇总页截图: /screenshots/summary_20260530.png",
                    "对应处理日志ID: log_20260530_1542"
                ]
            },
            {
                "tenor": "3M",
                "strike": 3.0,
                "imported_value": 0.170,
                "summary_value": 0.200,
                "difference_pct": 17.6,
                "imported_source": "老师讲义-第7章例3.2",
                "summary_source": "老板看的汇总页-单元格B8",
                "suggested_action": "请核对：\n1. 讲义例题使用的是理论值还是实盘值\n2. 汇总页该数据的更新时间\n3. 是否有分红调整未考虑",
                "evidence_links": [
                    "讲义扫描件: /docs/lectures/vol_surface.pdf#page=45",
                    "汇总页截图: /screenshots/summary_20260530.png",
                    "处理日志: 3M_3.0点异常检测记录"
                ]
            }
        ],
        "recommendation": "系统检测到2个冲突点，差异均超过5%容忍阈值。建议先确认数据来源的时间一致性，再决定采用哪个值。"
    }

    return surface, summary_data, conflict_evidence
