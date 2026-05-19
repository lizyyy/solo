#!/usr/bin/env python
"""
测试数据初始化脚本
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.database import engine, Base
from app.models.models import (
    GrayBatch, MetricWindow, GapSegment, BackfillSource,
    AuditRecord, ResultSnapshot, ExceptionLog,
    BatchStatus, GapType, SourceType, OverrideStrategy
)


def seed_data():
    Base.metadata.create_all(bind=engine)
    db = Session(bind=engine)

    try:
        print("开始初始化测试数据...")

        # 清空现有数据
        db.query(ExceptionLog).delete()
        db.query(ResultSnapshot).delete()
        db.query(AuditRecord).delete()
        db.query(BackfillSource).delete()
        db.query(GapSegment).delete()
        db.query(MetricWindow).delete()
        db.query(GrayBatch).delete()
        db.commit()

        # 创建测试批次
        batch1 = GrayBatch(
            batch_code="GRAY-2024-001",
            batch_name="灰度发布v2.0指标补全",
            description="2024年5月15日灰度发布期间部分监控指标缺失",
            created_by="dev_ops_001",
            status=BatchStatus.PENDING,
            override_strategy=OverrideStrategy.PROTECT,
        )
        db.add(batch1)

        batch2 = GrayBatch(
            batch_code="GRAY-2024-002",
            batch_name="订单服务延迟指标修复",
            description="订单服务P99延迟数据异常，需要回补",
            created_by="dev_ops_002",
            status=BatchStatus.COMPLETED,
            override_strategy=OverrideStrategy.MERGE,
        )
        db.add(batch2)
        db.flush()

        # 创建指标窗口
        now = datetime.now()
        window1 = MetricWindow(
            batch_id=batch1.id,
            metric_name="request_latency_p99",
            window_start=now - timedelta(hours=4),
            window_end=now - timedelta(hours=2),
            tags='{"service": "order-service", "env": "prod"}',
        )
        db.add(window1)

        window2 = MetricWindow(
            batch_id=batch1.id,
            metric_name="success_rate",
            window_start=now - timedelta(hours=4),
            window_end=now - timedelta(hours=2),
            tags='{"service": "payment-service", "env": "prod"}',
        )
        db.add(window2)
        db.flush()

        # 创建缺口片段
        gap1 = GapSegment(
            metric_window_id=window1.id,
            gap_type=GapType.MISSING,
            gap_start=now - timedelta(hours=3, minutes=30),
            gap_end=now - timedelta(hours=3),
            expected_points=180,
            actual_points=0,
            fill_rate=0.0,
            is_backfilled=False,
        )
        db.add(gap1)

        gap2 = GapSegment(
            metric_window_id=window1.id,
            gap_type=GapType.CORRUPTED,
            gap_start=now - timedelta(hours=2, minutes=30),
            gap_end=now - timedelta(hours=2, minutes=15),
            expected_points=90,
            actual_points=45,
            fill_rate=0.5,
            is_backfilled=False,
        )
        db.add(gap2)
        db.flush()

        # 创建回填来源
        source1 = BackfillSource(
            gap_segment_id=gap1.id,
            source_type=SourceType.LOG_REPLAY,
            source_name="nginx访问日志重放",
            source_config='{"log_path": "/var/log/nginx/access.log"}',
            data_hash="a1b2c3d4e5f67890",
            record_count=180,
        )
        db.add(source1)

        source2 = BackfillSource(
            gap_segment_id=gap2.id,
            source_type=SourceType.HISTORY_RESTORE,
            source_name="历史数据恢复",
            source_config='{"backup_date": "2024-05-14"}',
            data_hash="b2c3d4e5f67890a1",
            record_count=90,
        )
        db.add(source2)

        # 创建审核记录
        audit1 = AuditRecord(
            batch_id=batch2.id,
            from_status=BatchStatus.PENDING,
            to_status=BatchStatus.APPROVING,
            operator="dev_ops_002",
            comment="申请审批",
        )
        db.add(audit1)

        audit2 = AuditRecord(
            batch_id=batch2.id,
            from_status=BatchStatus.APPROVING,
            to_status=BatchStatus.APPROVED,
            operator="tech_lead_001",
            comment="审批通过",
        )
        db.add(audit2)

        audit3 = AuditRecord(
            batch_id=batch2.id,
            from_status=BatchStatus.APPROVED,
            to_status=BatchStatus.PROCESSING,
            operator="dev_ops_002",
            comment="开始执行",
        )
        db.add(audit3)

        audit4 = AuditRecord(
            batch_id=batch2.id,
            from_status=BatchStatus.PROCESSING,
            to_status=BatchStatus.COMPLETED,
            operator="dev_ops_002",
            comment="执行完成",
        )
        db.add(audit4)

        # 创建结果快照
        snapshot1 = ResultSnapshot(
            batch_id=batch2.id,
            snapshot_type="batch_result",
            snapshot_data='{"status": "completed", "filled_points": 270, "success_rate": 100}',
            snapshot_hash="c3d4e5f67890a1b2",
            created_by="system",
        )
        db.add(snapshot1)

        # 创建异常日志示例
        exception1 = ExceptionLog(
            batch_id=batch2.id,
            operation="process_batch",
            original_input='{"batch_id": 2, "operator": "dev_ops_002"}',
            error_message="模拟的处理错误（测试）",
            handler="dev_ops_002",
            conclusion="测试异常，实际处理成功",
            handled_at=now,
        )
        db.add(exception1)

        db.commit()
        print("测试数据初始化完成！")
        print(f"  - 灰度批次: 2 个")
        print(f"  - 指标窗口: 2 个")
        print(f"  - 缺口片段: 2 个")
        print(f"  - 回填来源: 2 个")
        print(f"  - 审核记录: 4 条")
        print(f"  - 结果快照: 1 个")
        print(f"  - 异常日志: 1 条")

    except Exception as e:
        db.rollback()
        print(f"初始化失败: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_data()
