import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal, engine
from app.models import Base, AdPlan, StatusLog, PauseRule, DeliveryReport

Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)

db = SessionLocal()

try:
    plan1 = AdPlan(
        plan_name="双11大促-信息流",
        channel="抖音",
        budget=50000.0,
        version=3,
        original_input='{"campaign":"双11大促","target":"18-35岁女性","duration":"2024-11-01至2024-11-11","budget":"50000"}',
        processed_result='{"optimized_budget":45000,"recommended_channel":"抖音信息流","estimated_roi":2.8}',
        review_status="审核通过",
        spend_status="投放中",
        actual_spend=12500.0,
        is_paused=False
    )
    db.add(plan1)
    db.flush()

    plan2 = AdPlan(
        plan_name="品牌曝光-搜索广告",
        channel="百度",
        budget=30000.0,
        version=2,
        original_input='{"campaign":"品牌曝光","target":"商务人士","duration":"2024-11全月","budget":"30000"}',
        processed_result='{"optimized_budget":28000,"recommended_channel":"百度品牌专区","estimated_roi":1.5}',
        review_status="审核通过",
        spend_status="花费异常",
        actual_spend=28500.0,
        is_paused=True
    )
    db.add(plan2)
    db.flush()

    plan3 = AdPlan(
        plan_name="新品推广-短视频",
        channel="快手",
        budget=20000.0,
        version=1,
        original_input='{"campaign":"新品推广","target":"下沉市场","duration":"2024-11-15起","budget":"20000"}',
        processed_result=None,
        review_status="待审核",
        spend_status="未开始",
        actual_spend=0.0,
        is_paused=False
    )
    db.add(plan3)
    db.flush()

    plan4 = AdPlan(
        plan_name="年货节预热-社交广告",
        channel="微信",
        budget=80000.0,
        version=4,
        original_input='{"campaign":"年货节","target":"全年龄段","duration":"2024-12至2025-01","budget":"80000"}',
        processed_result='{"optimized_budget":75000,"recommended_channel":"微信朋友圈+公众号","estimated_roi":3.2}',
        review_status="审核通过",
        spend_status="回填失败",
        actual_spend=45000.0,
        is_paused=True
    )
    db.add(plan4)
    db.flush()

    logs_plan1 = [
        StatusLog(ad_plan_id=plan1.id, field_name="review_status", old_value="待审核", new_value="审核通过", change_reason="渠道预算审核通过", operator="审核员A"),
        StatusLog(ad_plan_id=plan1.id, field_name="spend_status", old_value="未开始", new_value="投放中", change_reason="开始投放", operator="系统"),
        StatusLog(ad_plan_id=plan1.id, field_name="actual_spend", old_value="0", new_value="12500.0", change_reason="花费回填", operator="API"),
    ]
    db.add_all(logs_plan1)

    logs_plan2 = [
        StatusLog(ad_plan_id=plan2.id, field_name="review_status", old_value="待审核", new_value="审核通过", change_reason="审核通过", operator="审核员B"),
        StatusLog(ad_plan_id=plan2.id, field_name="actual_spend", old_value="0", new_value="15000", change_reason="花费回填", operator="API"),
        StatusLog(ad_plan_id=plan2.id, field_name="actual_spend", old_value="15000", new_value="28500", change_reason="花费异常，超出预算95%", operator="监控系统"),
        StatusLog(ad_plan_id=plan2.id, field_name="spend_status", old_value="投放中", new_value="花费异常", change_reason="花费速度异常", operator="监控系统"),
    ]
    db.add_all(logs_plan2)

    logs_plan4 = [
        StatusLog(ad_plan_id=plan4.id, field_name="review_status", old_value="待审核", new_value="审核通过", change_reason="审核通过", operator="审核员A"),
        StatusLog(ad_plan_id=plan4.id, field_name="actual_spend", old_value="0", new_value="25000", change_reason="花费回填", operator="API"),
        StatusLog(ad_plan_id=plan4.id, field_name="actual_spend", old_value="25000", new_value="45000", change_reason="花费回填", operator="API"),
        StatusLog(ad_plan_id=plan4.id, field_name="spend_status", old_value="投放中", new_value="回填失败", change_reason="API返回错误：数据格式异常", operator="API"),
    ]
    db.add_all(logs_plan4)

    pause_rule2 = PauseRule(
        ad_plan_id=plan2.id,
        rule_type="budget_exceeded",
        rule_value="95%",
        reason="实际花费已达预算的95%，花费速度远超预期，为避免超支暂停投放，建议重新评估日预算设置",
        operator="监控系统",
        is_active=True
    )
    db.add(pause_rule2)

    pause_rule4 = PauseRule(
        ad_plan_id=plan4.id,
        rule_type="spend_backfill_failed",
        rule_value="API错误",
        reason="花费回填API连续3次返回数据格式异常，暂停投放等待技术修复，已通知运维团队",
        operator="系统",
        is_active=True
    )
    db.add(pause_rule4)

    reports_plan1 = [
        DeliveryReport(ad_plan_id=plan1.id, report_date="2024-11-01", impressions=150000, clicks=4500, spend=3200.0),
        DeliveryReport(ad_plan_id=plan1.id, report_date="2024-11-02", impressions=180000, clicks=5200, spend=3800.0),
        DeliveryReport(ad_plan_id=plan1.id, report_date="2024-11-03", impressions=200000, clicks=5800, spend=4200.0),
        DeliveryReport(ad_plan_id=plan1.id, report_date="2024-11-04", impressions=175000, clicks=5100, spend=1300.0),
    ]
    db.add_all(reports_plan1)

    reports_plan2 = [
        DeliveryReport(ad_plan_id=plan2.id, report_date="2024-11-01", impressions=80000, clicks=1200, spend=8500.0),
        DeliveryReport(ad_plan_id=plan2.id, report_date="2024-11-02", impressions=95000, clicks=1450, spend=10000.0),
        DeliveryReport(ad_plan_id=plan2.id, report_date="2024-11-03", impressions=120000, clicks=1800, spend=10000.0),
    ]
    db.add_all(reports_plan2)

    reports_plan4 = [
        DeliveryReport(ad_plan_id=plan4.id, report_date="2024-12-01", impressions=250000, clicks=7500, spend=15000.0),
        DeliveryReport(ad_plan_id=plan4.id, report_date="2024-12-02", impressions=280000, clicks=8200, spend=16000.0),
        DeliveryReport(ad_plan_id=plan4.id, report_date="2024-12-03", impressions=300000, clicks=8800, spend=14000.0),
    ]
    db.add_all(reports_plan4)

    db.commit()
    print("数据初始化完成！")
    print(f"创建了 {db.query(AdPlan).count()} 个广告计划")
    print(f"创建了 {db.query(StatusLog).count()} 条状态日志")
    print(f"创建了 {db.query(PauseRule).count()} 条暂停规则")
    print(f"创建了 {db.query(DeliveryReport).count()} 条投放报表")

except Exception as e:
    db.rollback()
    print(f"初始化失败: {e}")
finally:
    db.close()
