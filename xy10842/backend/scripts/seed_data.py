#!/usr/bin/env python3
"""
样例数据生成脚本
包含：成功、失败、重复提交、人工修正 四类样例
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from app.database import SessionLocal, engine
from app import models, schemas
from datetime import datetime

def init_db():
    models.Base.metadata.create_all(bind=engine)

def create_sample_data():
    db = SessionLocal()
    try:
        print("开始创建样例数据...")

        versions = [
            schemas.ModelVersionCreate(
                version_name="v1.0.0",
                model_name="GPT-3.5",
                description="初始版本"
            ),
            schemas.ModelVersionCreate(
                version_name="v1.1.0",
                model_name="GPT-3.5",
                description="优化版本"
            ),
            schemas.ModelVersionCreate(
                version_name="v2.0.0",
                model_name="GPT-4",
                description="重大升级"
            ),
            schemas.ModelVersionCreate(
                version_name="v2.1.0",
                model_name="GPT-4",
                description="微调版本"
            ),
        ]

        created_versions = []
        for v in versions:
            db_version = db.query(models.ModelVersion).filter(
                models.ModelVersion.version_name == v.version_name
            ).first()
            if not db_version:
                db_version = models.ModelVersion(**v.model_dump())
                db.add(db_version)
                db.commit()
                db.refresh(db_version)
            created_versions.append(db_version)
        print(f"已创建 {len(created_versions)} 个模型版本")

        evaluations = [
            {
                "model_version_id": created_versions[0].id,
                "dataset_name": "SQuAD-v1",
                "dataset_version": "1.0",
                "status": "completed",
                "total_samples": 1000,
                "passed_samples": 856,
                "failed_samples": 144,
                "metrics": [
                    {"metric_name": "accuracy", "metric_value": 0.856, "metric_unit": "", "threshold": 0.8, "is_alert": False},
                    {"metric_name": "f1_score", "metric_value": 0.823, "metric_unit": "", "threshold": 0.8, "is_alert": False},
                    {"metric_name": "precision", "metric_value": 0.841, "metric_unit": "", "threshold": 0.8, "is_alert": False},
                    {"metric_name": "recall", "metric_value": 0.835, "metric_unit": "", "threshold": 0.8, "is_alert": False},
                ],
                "failure_samples": [
                    {"sample_id": "S1", "input_data": "北京的首都是哪里？", "expected_output": "中国的首都是北京", "actual_output": "北京是中国的首都", "error_type": "格式错误", "is_resolved": True},
                    {"sample_id": "S2", "input_data": "2+2等于几？", "expected_output": "4", "actual_output": "5", "error_type": "计算错误", "is_resolved": False},
                ]
            },
            {
                "model_version_id": created_versions[1].id,
                "dataset_name": "SQuAD-v1",
                "dataset_version": "1.0",
                "status": "failed",
                "total_samples": 1000,
                "passed_samples": 0,
                "failed_samples": 1000,
                "error_message": "模型加载超时",
                "metrics": [],
                "failure_samples": []
            },
            {
                "model_version_id": created_versions[1].id,
                "dataset_name": "SQuAD-v1",
                "dataset_version": "1.0",
                "status": "completed",
                "total_samples": 1000,
                "passed_samples": 892,
                "failed_samples": 108,
                "metrics": [
                    {"metric_name": "accuracy", "metric_value": 0.892, "metric_unit": "", "threshold": 0.8, "is_alert": False},
                    {"metric_name": "f1_score", "metric_value": 0.865, "metric_unit": "", "threshold": 0.8, "is_alert": False},
                    {"metric_name": "precision", "metric_value": 0.878, "metric_unit": "", "threshold": 0.8, "is_alert": False},
                    {"metric_name": "recall", "metric_value": 0.871, "metric_unit": "", "threshold": 0.8, "is_alert": False},
                ],
                "failure_samples": [
                    {"sample_id": "S3", "input_data": "法国的首都是哪里？", "expected_output": "巴黎", "actual_output": "里昂", "error_type": "知识错误", "is_resolved": False},
                ]
            },
            {
                "model_version_id": created_versions[2].id,
                "dataset_name": "SQuAD-v2",
                "dataset_version": "2.0",
                "status": "error",
                "total_samples": 500,
                "passed_samples": 0,
                "failed_samples": 0,
                "error_message": "数据格式错误：无效的JSON格式",
                "metrics": [],
                "failure_samples": []
            },
            {
                "model_version_id": created_versions[3].id,
                "dataset_name": "SQuAD-v2",
                "dataset_version": "2.0",
                "status": "completed",
                "total_samples": 500,
                "passed_samples": 478,
                "failed_samples": 22,
                "metrics": [
                    {"metric_name": "accuracy", "metric_value": 0.956, "metric_unit": "", "threshold": 0.9, "is_alert": False},
                    {"metric_name": "f1_score", "metric_value": 0.942, "metric_unit": "", "threshold": 0.9, "is_alert": False},
                    {"metric_name": "precision", "metric_value": 0.948, "metric_unit": "", "threshold": 0.9, "is_alert": False},
                    {"metric_name": "recall", "metric_value": 0.945, "metric_unit": "", "threshold": 0.9, "is_alert": False},
                    {"metric_name": "latency", "metric_value": 125.5, "metric_unit": "ms", "threshold": 200.0, "is_alert": False},
                ],
                "failure_samples": [
                    {"sample_id": "S4", "input_data": "太阳从哪个方向升起？", "expected_output": "东方", "actual_output": "西方", "error_type": "常识错误", "is_resolved": False},
                    {"sample_id": "S5", "input_data": "一年有多少天？", "expected_output": "365天", "actual_output": "366天", "error_type": "常识错误", "is_resolved": True},
                ]
            },
        ]

        for i, eval_data in enumerate(evaluations):
            metrics_data = eval_data.pop("metrics", [])
            samples_data = eval_data.pop("failure_samples", [])
            
            db_eval = models.Evaluation(**eval_data)
            db.add(db_eval)
            db.commit()
            db.refresh(db_eval)

            for metric in metrics_data:
                db_metric = models.Metric(evaluation_id=db_eval.id, **metric)
                db.add(db_metric)

            for sample in samples_data:
                db_sample = models.FailureSample(evaluation_id=db_eval.id, **sample)
                db.add(db_sample)

            db.commit()
            print(f"已创建评测 #{db_eval.id}: {eval_data['dataset_name']} - {eval_data['status']}")

        notes = [
            {"evaluation_id": 1, "author": "张三", "content": "这个版本的准确度有提升，但是还有一些边缘案例需要优化"},
            {"evaluation_id": 1, "author": "李四", "content": "建议重点关注样本S2的计算错误问题"},
            {"evaluation_id": 5, "author": "王五", "content": "GPT-4的表现有显著提升，延迟也在可接受范围内"},
        ]

        for note_data in notes:
            db_note = models.Note(**note_data)
            db.add(db_note)
        db.commit()
        print(f"已创建 {len(notes)} 条备注")

        suggestions = [
            {
                "model_version_id": created_versions[0].id,
                "suggestion_type": "review",
                "content": "建议再进行一轮测试，确认准确率稳定后再发布",
                "author": "产品经理",
                "is_approved": False,
            },
            {
                "model_version_id": created_versions[3].id,
                "suggestion_type": "release",
                "content": "建议立即发布，各项指标均达标，性能提升明显",
                "author": "技术负责人",
                "is_approved": True,
                "approved_by": "CTO",
                "approved_at": datetime.now(),
            },
        ]

        for sugg_data in suggestions:
            db_sugg = models.ReleaseSuggestion(**sugg_data)
            db.add(db_sugg)
        db.commit()
        print(f"已创建 {len(suggestions)} 条发布建议")

        print("\n样例数据创建完成！")
        print("\n数据概览:")
        print(f"- 模型版本: {len(created_versions)} 个")
        print(f"- 评测记录: {len(evaluations)} 条")
        print(f"  - 成功: {sum(1 for e in evaluations if e['status'] == 'completed')} 条")
        print(f"  - 失败: {sum(1 for e in evaluations if e['status'] == 'failed')} 条")
        print(f"  - 异常: {sum(1 for e in evaluations if e['status'] == 'error')} 条")
        print(f"- 备注: {len(notes)} 条")
        print(f"- 发布建议: {len(suggestions)} 条")

    except Exception as e:
        print(f"创建数据时出错: {e}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    init_db()
    create_sample_data()
