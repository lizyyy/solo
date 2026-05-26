"""业务服务层：分类引擎、任务编排、导出逻辑"""
import csv
import io
import json
from datetime import datetime, timezone

from models import (
    AuditLog,
    Classification,
    RecheckRecord,
    Sample,
    Task,
    db,
)


# ── 分类规则引擎 ────────────────────────────────────────────

class ClassificationEngine:
    """
    根据送样材料判断分类：
      - 正常：关键字段齐全且无异常
      - 待补充：缺失必要字段或信息不完整
      - 已拦截：检测项目中出现违禁品或高风险项
    """

    # 必须字段（缺失则待补充）
    REQUIRED_FIELDS = [
        "sample_batch",
        "cooperative",
        "product_name",
        "testing_items",
        "receiver",
    ]

    # 违禁/高风险检测项目（命中则已拦截）
    HIGH_RISK_ITEMS = {
        "甲胺磷", "克百威", "氧乐果", "水胺硫磷",
        "甲基对硫磷", "对硫磷", "久效磷", "磷胺",
    }

    @classmethod
    def classify(cls, sample_data):
        """返回 (category, reason, action)"""
        # 1. 先检查是否命中高风险
        risk_items = cls._check_high_risk(sample_data.get("testing_items", ""))
        if risk_items:
            return (
                Classification.CATEGORY_BLOCKED,
                f"检测项目中发现违禁/高风险农残: {', '.join(risk_items)}，禁止进入常规检测流程",
                "立即封存样本，通知合作社及监管部门，样本退回或销毁，出具拦截报告",
            )

        # 2. 检查必填字段
        missing = cls._check_missing_fields(sample_data)
        if missing:
            return (
                Classification.CATEGORY_SUPPLEMENT,
                f"缺失必要字段: {', '.join(missing)}",
                "联系合作社补充缺失信息，待材料完整后重新提交",
            )

        # 3. 正常
        return (
            Classification.CATEGORY_NORMAL,
            "送样材料齐全，检测项目无违禁项",
            "安排实验室检测，出具农残检测报告",
        )

    @classmethod
    def _check_high_risk(cls, testing_items_str):
        items = []
        try:
            items = json.loads(testing_items_str)
            if isinstance(items, list):
                items = [str(i) for i in items]
        except (json.JSONDecodeError, TypeError):
            items = [testing_items_str] if testing_items_str else []
        return [i for i in items if i in cls.HIGH_RISK_ITEMS]

    @classmethod
    def _check_missing_fields(cls, data):
        return [f for f in cls.REQUIRED_FIELDS if not data.get(f)]


# ── 任务编排服务 ────────────────────────────────────────────

class TaskService:
    """任务状态管理与审计"""

    @staticmethod
    def create_task(sample_id, operator="system"):
        task = Task(sample_id=sample_id, status=Task.STATUS_PROCESSING)
        db.session.add(task)
        db.session.flush()
        TaskService._audit(task.id, "task_created", f"任务创建，状态=处理中", operator)
        return task

    @staticmethod
    def transition(task_id, new_status, operator="system", detail=None, error_message=None):
        task = Task.query.get(task_id)
        if not task:
            raise ValueError(f"任务 {task_id} 不存在")
        old = task.status
        task.status = new_status
        task.last_handler = operator
        if error_message:
            task.error_message = error_message
        db.session.flush()
        TaskService._audit(
            task.id,
            "status_changed",
            detail or f"状态变更: {old} → {new_status}",
            operator,
        )
        return task

    @staticmethod
    def mark_exported(task_id, operator="system"):
        task = Task.query.get(task_id)
        if not task:
            raise ValueError(f"任务 {task_id} 不存在")
        task.status = Task.STATUS_EXPORTED
        task.last_handler = operator
        task.exported_at = datetime.now(timezone.utc)
        db.session.flush()
        TaskService._audit(task.id, "exported", "任务已导出", operator)
        return task

    @staticmethod
    def _audit(task_id, action, detail, operator):
        log = AuditLog(task_id=task_id, action=action, detail=detail, operator=operator)
        db.session.add(log)


# ── 导出服务 ────────────────────────────────────────────────

class ExportService:
    """CSV 导出，保证与查询统计一致"""

    @staticmethod
    def build_export_rows(sample_ids=None):
        """
        构建导出数据行。
        包含：送样批次、合作社、检测项目、不合格复检记录、最后处理人 等。
        """
        query = Sample.query
        if sample_ids:
            query = query.filter(Sample.id.in_(sample_ids))
        samples = query.all()

        rows = []
        for s in samples:
            cls_obj = Classification.query.filter_by(sample_id=s.id).first()
            task = Task.query.filter_by(sample_id=s.id).first()
            rechecks = RecheckRecord.query.filter_by(sample_id=s.id).all()

            recheck_summary = "; ".join(
                f"{r.item}:初={r.original_result}/复={r.recheck_result}/终={r.final_result}(操作:{r.operator})"
                for r in rechecks
            ) if rechecks else "无"

            rows.append({
                "送样批次": s.sample_batch,
                "合作社": s.cooperative,
                "农产品名称": s.product_name,
                "品类": s.product_type or "",
                "产地": s.origin or "",
                "送样重量": s.sample_weight or "",
                "送样日期": s.send_date or "",
                "接样员": s.receiver,
                "检测项目": s.testing_items,
                "分类": cls_obj.category if cls_obj else "",
                "分类原因": cls_obj.reason if cls_obj else "",
                "后续动作": cls_obj.action if cls_obj else "",
                "不合格复检记录": recheck_summary,
                "任务状态": task.status if task else "",
                "最后处理人": task.last_handler if task else "",
                "导出时间": task.exported_at.isoformat() if (task and task.exported_at) else "",
                "创建时间": s.created_at.isoformat() if s.created_at else "",
            })
        return rows

    @staticmethod
    def to_csv(rows):
        output = io.StringIO()
        if not rows:
            return output.getvalue()
        writer = csv.DictWriter(output, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        for row in rows:
            writer.writerow(row)
        return output.getvalue()


# ── 统计查询 ────────────────────────────────────────────────

class StatsService:
    """与导出数据一致的统计查询"""

    @staticmethod
    def overall():
        return {
            "total_samples": Sample.query.count(),
            "by_category": StatsService._count_by(Classification, "category"),
            "by_task_status": StatsService._count_by(Task, "status"),
        }

    @staticmethod
    def _count_by(model, field):
        from sqlalchemy import func
        rows = db.session.query(
            getattr(model, field), func.count(model.id)
        ).group_by(getattr(model, field)).all()
        return {k: v for k, v in rows}

    @staticmethod
    def detail(sample_id):
        s = Sample.query.get(sample_id)
        if not s:
            return None
        cls_obj = Classification.query.filter_by(sample_id=sample_id).first()
        task = Task.query.filter_by(sample_id=sample_id).first()
        rechecks = RecheckRecord.query.filter_by(sample_id=sample_id).all()
        audits = AuditLog.query.join(Task).filter(Task.sample_id == sample_id).all()
        return {
            "sample": s.to_dict(),
            "classification": cls_obj.to_dict() if cls_obj else None,
            "task": task.to_dict() if task else None,
            "rechecks": [r.to_dict() for r in rechecks],
            "audit_logs": [a.to_dict() for a in audits],
        }
