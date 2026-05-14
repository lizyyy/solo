from models import (
    Experiment, Group, Metric, MutexRule, 
    ExperimentReport, ReportData, ExperimentStatus
)
from datetime import datetime, timedelta
import uuid


def generate_dirty_experiments():
    experiments = []
    
    exp1 = Experiment(
        id="exp-001",
        name="登录流程优化实验",
        description="测试新的登录流程对转化率的影响",
        status=ExperimentStatus.RUNNING,
        groups=[
            Group(id="g1", name="对照组", traffic_ratio=50.0, is_control=True),
            Group(id="g2", name="实验组A", traffic_ratio=60.0, is_control=False),
            Group(id="g3", name="实验组B", traffic_ratio=20.0, is_control=False),
        ],
        metrics=[
            Metric(id="m1", name="登录转化率", definition="成功登录数/访问登录页数", unit="%", is_primary=True),
            Metric(id="m2", name="平均登录时长", definition="从进入登录页到完成登录的平均时间", unit="秒"),
        ],
        mutex_rules=[
            MutexRule(
                id="mr1",
                name="与注册实验互斥",
                rule_type="user_segment",
                conditions=["user_segment = 'new'"],
                is_valid=False,
                error_message="条件语法错误：缺少操作符"
            ),
            MutexRule(
                id="mr2",
                name="与支付实验互斥",
                rule_type="user_tag",
                conditions=[],
                is_valid=False,
                error_message="条件列表不能为空"
            ),
        ],
        start_time=datetime.now() - timedelta(days=7),
        report=ExperimentReport(
            id="report-001",
            experiment_id="exp-001",
            generated_at=datetime.now(),
            data=[
                ReportData(group_id="g1", metric_id="m1", value=45.2, sample_size=1000, confidence_interval=[43.1, 47.3], p_value=0.02, is_significant=True),
                ReportData(group_id="g2", metric_id="m1", value=52.8, sample_size=1200, confidence_interval=[50.5, 55.1], p_value=0.01, is_significant=True),
                ReportData(group_id="g3", metric_id="m1", value=48.5, sample_size=400, confidence_interval=[45.2, 51.8], p_value=0.15, is_significant=False),
                ReportData(group_id="g1", metric_id="m2", value=12.5, sample_size=1000),
                ReportData(group_id="g2", metric_id="m2", value=10.2, sample_size=1200),
                ReportData(group_id="g3", metric_id="m2", value=11.8, sample_size=400),
            ],
            is_valid=False
        ),
        need_recalculation=True
    )
    experiments.append(exp1)
    
    exp2 = Experiment(
        id="exp-002",
        name="首页推荐算法实验",
        description="测试新推荐算法对用户停留时间的影响",
        status=ExperimentStatus.PAUSED,
        groups=[
            Group(id="g1", name="旧算法", traffic_ratio=0.0, is_control=True),
            Group(id="g2", name="新算法", traffic_ratio=100.0, is_control=False),
        ],
        metrics=[
            Metric(id="m1", name="人均停留时间", definition="总停留时间/活跃用户数", unit="分钟", is_primary=True),
            Metric(id="m2", name="点击率", definition="点击次数/曝光次数", unit="%"),
        ],
        mutex_rules=[
            MutexRule(
                id="mr1",
                name="与搜索实验互斥",
                rule_type="feature",
                conditions=["feature = 'recommendation'"],
                is_valid=True
            ),
        ],
        start_time=datetime.now() - timedelta(days=14),
        end_time=datetime.now() - timedelta(days=2),
        report=ExperimentReport(
            id="report-002",
            experiment_id="exp-002",
            generated_at=datetime.now() - timedelta(days=2),
            data=[
                ReportData(group_id="g1", metric_id="m1", value=8.5, sample_size=5000),
                ReportData(group_id="g2", metric_id="m1", value=12.3, sample_size=5000),
                ReportData(group_id="g1", metric_id="m2", value=15.2, sample_size=5000),
                ReportData(group_id="g2", metric_id="m2", value=18.7, sample_size=5000),
            ],
            is_valid=True
        ),
        need_recalculation=False
    )
    experiments.append(exp2)
    
    exp3 = Experiment(
        id="exp-003",
        name="支付页面改版实验",
        description="测试新支付页面对支付成功率的影响",
        status=ExperimentStatus.RUNNING,
        groups=[
            Group(id="g1", name="原页面", traffic_ratio=30.0, is_control=True),
            Group(id="g2", name="新版页面", traffic_ratio=30.0, is_control=False),
            Group(id="g3", name="简化版", traffic_ratio=30.0, is_control=False),
        ],
        metrics=[
            Metric(id="m1", name="支付成功率", definition="成功支付数/进入支付页数", unit="%", is_primary=True),
            Metric(id="m2", name="支付放弃率", definition="放弃支付数/进入支付页数", unit="%"),
        ],
        mutex_rules=[
            MutexRule(
                id="mr1",
                name="与优惠券实验互斥",
                rule_type="invalid_type",
                conditions=["has_coupon = true"],
                is_valid=False,
                error_message="无效的规则类型：invalid_type"
            ),
        ],
        start_time=datetime.now() - timedelta(days=3),
        report=ExperimentReport(
            id="report-003",
            experiment_id="exp-003",
            generated_at=datetime.now(),
            data=[
                ReportData(group_id="g1", metric_id="m1", value=78.5, sample_size=2000),
                ReportData(group_id="g2", metric_id="m1", value=82.1, sample_size=2000),
                ReportData(group_id="g3", metric_id="m1", value=85.3, sample_size=2000),
            ],
            is_valid=False
        ),
        need_recalculation=True
    )
    experiments.append(exp3)
    
    return experiments
