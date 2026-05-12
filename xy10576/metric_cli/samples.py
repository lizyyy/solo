from datetime import datetime, timedelta
import uuid

from .models import (
    MetricDefinition,
    Dashboard,
    BackfillTask,
    MetricChange,
    ChangeProject,
    ChangeStatus,
    BackfillStatus,
    MetricType,
)


def create_sample_project(operator: str = "data_engineer_01") -> ChangeProject:
    """创建内置样例项目，包含GMV、活跃用户和退款率三个场景"""
    project = ChangeProject(
        project_id=f"proj_{uuid.uuid4().hex[:8]}",
        name="2026Q1 指标口径优化项目",
        description="优化三个核心指标口径：GMV(排除测试订单)、活跃用户(修正定义)、退款率(重命名)",
        created_by=operator,
        created_at=datetime.now(),
        updated_at=datetime.now()
    )

    gmv_old = MetricDefinition(
        metric_id="gmv_v1",
        name="总GMV",
        type=MetricType.COUNTER,
        sql="SELECT SUM(amount) FROM orders WHERE status = 'completed'",
        aggregation="sum",
        time_window="daily",
        filters={"status": "completed"},
        business_owner="wang_fan@example.com",
        tech_owner="zhang_wei@example.com",
        created_at=datetime.now() - timedelta(days=180),
        updated_at=datetime.now() - timedelta(days=180)
    )
    gmv_new = MetricDefinition(
        metric_id="gmv_v1",
        name="总GMV",
        type=MetricType.COUNTER,
        sql="SELECT SUM(amount) FROM orders WHERE status = 'completed' AND is_test = false",
        aggregation="sum",
        time_window="daily",
        filters={"status": "completed", "is_test": False},
        business_owner="wang_fan@example.com",
        tech_owner="zhang_wei@example.com",
        created_at=datetime.now() - timedelta(days=180),
        updated_at=datetime.now()
    )

    dau_old = MetricDefinition(
        metric_id="dau_v1",
        name="日活跃用户",
        type=MetricType.COUNTER,
        sql="SELECT COUNT(DISTINCT user_id) FROM user_sessions WHERE session_start >= DATE_SUB(NOW(), INTERVAL 1 DAY)",
        aggregation="count_distinct",
        time_window="daily",
        filters={"time_window": "1_day"},
        business_owner="li_na@example.com",
        tech_owner="chen_hong@example.com",
        created_at=datetime.now() - timedelta(days=365),
        updated_at=datetime.now() - timedelta(days=365)
    )
    dau_new = MetricDefinition(
        metric_id="dau_v2",
        name="日活跃用户(修正版)",
        type=MetricType.COUNTER,
        sql="SELECT COUNT(DISTINCT user_id) FROM user_activity WHERE activity_date = CURDATE() AND duration >= 30",
        aggregation="count_distinct",
        time_window="daily",
        filters={"activity_date": "today", "min_duration": 30},
        business_owner="li_na@example.com",
        tech_owner="chen_hong@example.com",
        created_at=datetime.now() - timedelta(days=365),
        updated_at=datetime.now()
    )

    refund_old = MetricDefinition(
        metric_id="refund_ratio_old",
        name="退款比率",
        type=MetricType.RATIO,
        sql="SELECT SUM(refund_amount) / SUM(total_amount) FROM orders WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)",
        aggregation="ratio",
        time_window="weekly",
        filters={"time_window": "7_days"},
        business_owner="zhao_qiang@example.com",
        tech_owner="sun_ming@example.com",
        created_at=datetime.now() - timedelta(days=90),
        updated_at=datetime.now() - timedelta(days=90)
    )
    refund_new = MetricDefinition(
        metric_id="refund_rate",
        name="退款率",
        type=MetricType.RATIO,
        sql="SELECT SUM(refund_amount) / SUM(total_amount) FROM orders WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)",
        aggregation="ratio",
        time_window="weekly",
        filters={"time_window": "7_days"},
        business_owner="zhao_qiang@example.com",
        tech_owner="sun_ming@example.com",
        created_at=datetime.now() - timedelta(days=90),
        updated_at=datetime.now()
    )

    dash1 = Dashboard(
        dashboard_id="dash_sales_001",
        name="销售业绩总览",
        owner="wang_fan@example.com",
        metrics=["gmv_v1", "refund_ratio_old"],
        created_at=datetime.now() - timedelta(days=60),
        updated_at=datetime.now() - timedelta(days=30)
    )
    dash2 = Dashboard(
        dashboard_id="dash_user_002",
        name="用户活跃度分析",
        owner="li_na@example.com",
        metrics=["dau_v1"],
        created_at=datetime.now() - timedelta(days=120),
        updated_at=datetime.now() - timedelta(days=10)
    )
    dash3 = Dashboard(
        dashboard_id="dash_ops_003",
        name="运营综合监控",
        owner="yang_jie@example.com",
        metrics=["gmv_v1", "dau_v1", "refund_ratio_old"],
        created_at=datetime.now() - timedelta(days=45),
        updated_at=datetime.now() - timedelta(days=5)
    )
    dash4 = Dashboard(
        dashboard_id="dash_unknown",
        name="未指派看板",
        owner=None,
        metrics=["gmv_v1"],
        created_at=datetime.now() - timedelta(days=30),
        updated_at=datetime.now() - timedelta(days=30)
    )

    backfill_gmv = BackfillTask(
        task_id="bf_gmv_202601",
        metric_id="gmv_v1",
        start_date=datetime(2025, 1, 1),
        end_date=datetime(2025, 12, 31),
        status=BackfillStatus.PENDING,
        retry_count=0,
        created_by=operator,
        created_at=datetime.now(),
        completed_at=None,
        error_message=None
    )
    backfill_dau = BackfillTask(
        task_id="bf_dau_202601",
        metric_id="dau_v2",
        start_date=datetime(2025, 6, 1),
        end_date=datetime(2025, 12, 31),
        status=BackfillStatus.RUNNING,
        retry_count=0,
        created_by=operator,
        created_at=datetime.now() - timedelta(hours=2),
        completed_at=None,
        error_message=None
    )
    backfill_dau_old = BackfillTask(
        task_id="bf_dau_202512",
        metric_id="dau_v2",
        start_date=datetime(2025, 1, 1),
        end_date=datetime(2025, 5, 31),
        status=BackfillStatus.SUCCEEDED,
        retry_count=2,
        created_by=operator,
        created_at=datetime.now() - timedelta(days=2),
        completed_at=datetime.now() - timedelta(days=1),
        error_message=None
    )

    change_gmv = MetricChange(
        change_id=f"chg_gmv_{uuid.uuid4().hex[:6]}",
        old_metric=gmv_old,
        new_metric=gmv_new,
        renamed_from=None,
        affected_dashboards=["dash_sales_001", "dash_ops_003", "dash_unknown"],
        backfill_tasks=["bf_gmv_202601"],
        status=ChangeStatus.PENDING,
        owner_missing=False,
        backfill_incomplete=False,
        history=[],
        created_by=operator,
        created_at=datetime.now() - timedelta(hours=1),
        updated_at=datetime.now() - timedelta(hours=1)
    )

    change_dau = MetricChange(
        change_id=f"chg_dau_{uuid.uuid4().hex[:6]}",
        old_metric=dau_old,
        new_metric=dau_new,
        renamed_from=None,
        affected_dashboards=["dash_user_002", "dash_ops_003"],
        backfill_tasks=["bf_dau_202601", "bf_dau_202512"],
        status=ChangeStatus.PENDING,
        owner_missing=False,
        backfill_incomplete=False,
        history=[],
        created_by=operator,
        created_at=datetime.now() - timedelta(hours=2),
        updated_at=datetime.now() - timedelta(hours=2)
    )

    change_refund = MetricChange(
        change_id=f"chg_refund_{uuid.uuid4().hex[:6]}",
        old_metric=refund_old,
        new_metric=refund_new,
        renamed_from="refund_ratio_old",
        affected_dashboards=["dash_sales_001", "dash_ops_003"],
        backfill_tasks=[],
        status=ChangeStatus.PENDING,
        owner_missing=False,
        backfill_incomplete=False,
        history=[],
        created_by=operator,
        created_at=datetime.now() - timedelta(minutes=30),
        updated_at=datetime.now() - timedelta(minutes=30)
    )

    project.old_metrics = {
        "gmv_v1": gmv_old,
        "dau_v1": dau_old,
        "refund_ratio_old": refund_old,
    }
    project.metrics = {
        "gmv_v1": gmv_new,
        "dau_v2": dau_new,
        "refund_rate": refund_new,
    }
    project.dashboards = {
        "dash_sales_001": dash1,
        "dash_user_002": dash2,
        "dash_ops_003": dash3,
        "dash_unknown": dash4,
    }
    project.backfill_tasks = {
        "bf_gmv_202601": backfill_gmv,
        "bf_dau_202601": backfill_dau,
        "bf_dau_202512": backfill_dau_old,
    }
    project.metric_changes = {
        change_gmv.change_id: change_gmv,
        change_dau.change_id: change_dau,
        change_refund.change_id: change_refund,
    }

    return project


def create_failure_scenario_project(operator: str = "data_engineer_02") -> ChangeProject:
    """创建失败场景样例项目，用于演示错误路径"""
    project = ChangeProject(
        project_id=f"proj_fail_{uuid.uuid4().hex[:8]}",
        name="失败场景示例项目",
        description="演示负责人缺失、回填失败等问题",
        created_by=operator,
        created_at=datetime.now(),
        updated_at=datetime.now()
    )

    metric_old = MetricDefinition(
        metric_id="test_metric_old",
        name="测试指标",
        type=MetricType.GAUGE,
        sql="SELECT value FROM test_table",
        aggregation="avg",
        time_window="hourly",
        filters={},
        business_owner=None,
        tech_owner=None,
        created_at=datetime.now() - timedelta(days=30),
        updated_at=datetime.now() - timedelta(days=30)
    )
    metric_new = MetricDefinition(
        metric_id="test_metric_new",
        name="测试指标(新)",
        type=MetricType.GAUGE,
        sql="SELECT AVG(value) FROM test_table WHERE is_valid = true",
        aggregation="avg",
        time_window="hourly",
        filters={"is_valid": True},
        business_owner=None,
        tech_owner=None,
        created_at=datetime.now() - timedelta(days=30),
        updated_at=datetime.now()
    )

    dash = Dashboard(
        dashboard_id="dash_incomplete",
        name="不完整看板",
        owner=None,
        metrics=["test_metric_old"],
        created_at=datetime.now() - timedelta(days=20),
        updated_at=datetime.now() - timedelta(days=20)
    )

    backfill = BackfillTask(
        task_id="bf_test_fail",
        metric_id="test_metric_new",
        start_date=datetime(2025, 12, 1),
        end_date=datetime(2025, 12, 31),
        status=BackfillStatus.FAILED,
        retry_count=3,
        created_by=operator,
        created_at=datetime.now() - timedelta(hours=5),
        completed_at=None,
        error_message="分区不存在: partition '2025-12-01' not found"
    )

    change = MetricChange(
        change_id=f"chg_fail_{uuid.uuid4().hex[:6]}",
        old_metric=metric_old,
        new_metric=metric_new,
        renamed_from=None,
        affected_dashboards=["dash_incomplete"],
        backfill_tasks=["bf_test_fail"],
        status=ChangeStatus.PENDING,
        owner_missing=True,
        backfill_incomplete=True,
        history=[],
        created_by=operator,
        created_at=datetime.now() - timedelta(hours=3),
        updated_at=datetime.now() - timedelta(hours=3)
    )

    project.old_metrics = {"test_metric_old": metric_old}
    project.metrics = {"test_metric_new": metric_new}
    project.dashboards = {"dash_incomplete": dash}
    project.backfill_tasks = {"bf_test_fail": backfill}
    project.metric_changes = {change.change_id: change}

    return project
