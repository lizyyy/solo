from datetime import datetime, timedelta
from models import (
    RiverbankRiskRecord,
    RedlineRemark,
    GridInspection,
    ResidentOpinion,
    ProfessionalCalc,
    RiskLevel,
)


def create_sample_1_normal() -> tuple:
    record_id = "RIVERBANK_001"
    location = "河岸步道A段-亲水台阶处"

    record = RiverbankRiskRecord(
        record_id=record_id,
        location=location,
        resident_opinion=ResidentOpinion(
            opinion_id="OP_001",
            summary="居民反映台阶处雨后湿滑，有老人小孩摔倒风险",
            original_text="张阿姨：上周六下雨，我家孙子在台阶那儿差点滑倒，那个台阶没有防滑条，水积在上面特别滑，希望社区能处理一下，不然老人小孩太危险了。",
            has_original=True,
            submit_time=datetime.now() - timedelta(days=3),
        ),
    )

    redline = RedlineRemark(
        remark_id="RED_001",
        redline_version="v2.1",
        location=location,
        risk_description="亲水台阶处防滑措施不足，雨后易滑倒",
        risk_level=RiskLevel.MEDIUM,
        import_time=datetime.now() - timedelta(days=1),
    )

    grid = GridInspection(
        inspection_id="GRID_001",
        inspector="网格员小李",
        location=location,
        risk_description="亲水台阶处防滑措施不足，雨后易滑倒",
        risk_level=RiskLevel.MEDIUM,
        inspection_time=datetime.now() - timedelta(days=2),
        is_old_caliber=False,
    )

    calc = ProfessionalCalc(
        calc_id="CALC_001",
        calc_name="滑倒风险概率模型",
        param_version="v1.2",
        params={
            "防滑系数": 0.35,
            "人流量": "高",
            "雨天积水深度": "5mm",
        },
        result="滑倒概率：12.5%",
        trade_off_reason="采用保守估计参数，考虑雨季持续时间较长",
        calc_time=datetime.now() - timedelta(hours=2),
    )

    return record, redline, grid, calc


def create_sample_2_no_original() -> tuple:
    record_id = "RIVERBANK_002"
    location = "河岸步道B段-护栏缺口处"

    record = RiverbankRiskRecord(
        record_id=record_id,
        location=location,
        resident_opinion=ResidentOpinion(
            opinion_id="OP_002",
            summary="居民反映护栏有缺口，儿童易坠落",
            original_text=None,
            has_original=False,
            submit_time=datetime.now() - timedelta(days=5),
        ),
    )

    redline = RedlineRemark(
        remark_id="RED_002",
        redline_version="v2.1",
        location=location,
        risk_description="护栏存在30cm缺口，儿童易穿越坠落",
        risk_level=RiskLevel.HIGH,
        import_time=datetime.now() - timedelta(days=1),
    )

    grid = GridInspection(
        inspection_id="GRID_002",
        inspector="网格员小王",
        location=location,
        risk_description="护栏存在30cm缺口，儿童易穿越坠落",
        risk_level=RiskLevel.HIGH,
        inspection_time=datetime.now() - timedelta(days=4),
        is_old_caliber=False,
    )

    return record, redline, grid, None


def create_sample_3_old_caliber_conflict() -> tuple:
    record_id = "RIVERBANK_003"
    location = "河岸步道C段-水深标识处"

    record = RiverbankRiskRecord(
        record_id=record_id,
        location=location,
        resident_opinion=ResidentOpinion(
            opinion_id="OP_003",
            summary="居民反映水深标识不清，有人误入深水区",
            original_text="李先生：昨天带孩子去玩，看到有个年轻人往水深的地方走，那边标识牌太小了，不注意根本看不到，太危险了。",
            has_original=True,
            submit_time=datetime.now() - timedelta(days=7),
        ),
    )

    redline = RedlineRemark(
        remark_id="RED_003",
        redline_version="v2.1",
        location=location,
        risk_description="水深标识牌尺寸不足，能见度差",
        risk_level=RiskLevel.MEDIUM,
        import_time=datetime.now() - timedelta(days=1),
    )

    grid = GridInspection(
        inspection_id="GRID_003",
        inspector="网格员老陈",
        location=location,
        risk_description="标识牌缺失，完全无警示",
        risk_level=RiskLevel.HIGH,
        inspection_time=datetime.now() - timedelta(days=10),
        is_old_caliber=True,
    )

    calc = ProfessionalCalc(
        calc_id="CALC_002",
        calc_name="可视距离计算模型",
        param_version="v2.0",
        params={
            "标识牌尺寸": "30cm×40cm",
            "安装高度": "1.2m",
            "环境光照": "中等",
        },
        result="有效可视距离：12米",
        trade_off_reason="选用旧版参数库，与巡查表同期标准一致",
        calc_time=datetime.now() - timedelta(hours=1),
    )

    return record, redline, grid, calc
