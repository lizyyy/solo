import sys
from datetime import datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from database import SessionLocal, init_db
from models import (
    QualityInspection, CustomerServiceDialog, KnowledgeBaseEntry,
    ReviewSample, ChangeHistory
)
from services.change_service import ChangeHistoryService


def create_sample_data():
    db = SessionLocal()
    
    try:
        print("正在初始化数据库...")
        init_db()
        
        print("正在创建示例数据...")
        
        now = datetime.now()
        
        inspections = []
        for i in range(1, 8):
            inspection = QualityInspection(
                inspection_no=f"QJ202405{i:02d}",
                customer_id=f"CUST{i:05d}",
                service_type=["咨询", "投诉", "售后", "办理"][i % 4],
                inspector=["张三", "李四", "王五", "赵六"][i % 4],
                inspection_time=now - timedelta(days=i),
                is_late_submit=i in [3, 5],
                submit_time=now - timedelta(days=i) + (timedelta(hours=2) if i in [3, 5] else timedelta(0)),
                content={
                    "问题描述": f"用户反馈{i}号问题",
                    "处理过程": f"已按照流程处理{i}号问题",
                    "处理结果": "已解决",
                    "敏感信息": "手机号: 138****5678" if i == 2 else "无",
                }
            )
            inspections.append(inspection)
        
        db.add_all(inspections)
        db.flush()
        
        dialogs = []
        for i in range(1, 6):
            dialog = CustomerServiceDialog(
                dialog_id=f"KF202405{i:02d}",
                customer_id=f"CUST{i:05d}",
                agent_id=f"AGENT{i:03d}",
                start_time=now - timedelta(days=i, hours=1),
                end_time=now - timedelta(days=i, hours=0, minutes=30),
                is_late_supplement=i in [2, 4],
                supplement_time=now - timedelta(days=i-1) if i in [2, 4] else None,
                inspection_id=inspections[i-1].id,
                content={
                    "对话记录": [
                        {"role": "用户", "content": f"你好，我有问题{i}需要咨询"},
                        {"role": "客服", "content": f"您好，请详细描述问题{i}"},
                        {"role": "用户", "content": f"我的身份证是110101********1234，需要查询"},
                    ]
                } if i == 3 else {
                    "对话记录": [
                        {"role": "用户", "content": f"咨询问题{i}"},
                        {"role": "客服", "content": f"已解答问题{i}"},
                    ]
                }
            )
            dialogs.append(dialog)
        
        db.add_all(dialogs)
        db.flush()
        
        knowledge_entries = []
        for i in range(1, 5):
            entry = KnowledgeBaseEntry(
                entry_id=f"KB{i:03d}",
                title=f"知识库条目{i} - 常见问题解答",
                category=["产品使用", "售后服务", "政策法规", "技术支持"][i-1],
                version=f"v{i}.0",
                is_manual_modified=i in [2, 3],
                modified_time=now - timedelta(days=i, hours=3) if i in [2, 3] else None,
                modifier=["运营A", "运营B"][i % 2] if i in [2, 3] else None,
                content={
                    "问题": f"常见问题{i}",
                    "答案": f"这是问题{i}的详细解答",
                    "相关链接": [f"/help/{i}"],
                }
            )
            knowledge_entries.append(entry)
        
        db.add_all(knowledge_entries)
        db.flush()
        
        samples = []
        sample_configs = [
            (0, 0, 0, False, None, "待复判", "pending"),
            (1, 1, 1, True, "SENSITIVE_DATA_LEAK", "发现敏感词漏脱敏", "completed"),
            (2, 2, 2, False, None, "质检表晚交但数据无异常", "completed"),
            (3, 3, None, False, None, "客服对话晚补，已核对", "pending"),
            (4, None, 3, True, "KNOWLEDGE_ERROR", "知识库条目错误", "completed"),
            (5, 4, None, False, None, "数据正常", "completed"),
            (6, None, None, True, "TIMING_ISSUE", "质检表早到对话晚补，时序问题", "pending"),
        ]
        
        for i, (ins_idx, dia_idx, kb_idx, is_anomaly, anomaly_type, conclusion, status) in enumerate(sample_configs):
            sample = ReviewSample(
                sample_batch_no=f"BATCH{now.strftime('%Y%m%d')}",
                sample_date=now - timedelta(days=i),
                sampler=["采样员A", "采样员B"][i % 2],
                reviewer=["复判员A", "复判员B", None][i % 3],
                review_status=status,
                anomaly_type=anomaly_type,
                is_anomaly=is_anomaly,
                conclusion=conclusion,
                evidence_summary=f"样本{i+1}的依据摘要，包含质检、客服对话和知识库的核对结果",
                inspection_id=inspections[ins_idx].id if ins_idx is not None else None,
                dialog_id=dialogs[dia_idx].id if dia_idx is not None else None,
                knowledge_entry_id=knowledge_entries[kb_idx].id if kb_idx is not None else None,
            )
            samples.append(sample)
        
        db.add_all(samples)
        db.flush()
        
        print("正在创建变更历史示例...")
        
        ChangeHistoryService.log_change(
            db, samples[1].id, "is_anomaly", False, True,
            operator="复判员A", remark="发现敏感词未脱敏", change_source="MANUAL"
        )
        ChangeHistoryService.log_change(
            db, samples[1].id, "anomaly_type", None, "SENSITIVE_DATA_LEAK",
            operator="复判员A", remark="标记为敏感词漏脱敏", change_source="MANUAL"
        )
        ChangeHistoryService.log_change(
            db, samples[1].id, "conclusion", None, "发现敏感词漏脱敏",
            operator="复判员A", change_source="MANUAL"
        )
        
        ChangeHistoryService.log_material_supplement(
            db, samples[3].id, "evidence_summary",
            "补充客服对话记录，已核对无误",
            operator="客服", remark="补材料-补充对话记录",
            change_source="MATERIAL"
        )
        
        ChangeHistoryService.log_change(
            db, samples[4].id, "is_anomaly", False, True,
            operator="复判员B", remark="知识库内容错误", change_source="MANUAL"
        )
        ChangeHistoryService.log_change(
            db, samples[4].id, "anomaly_type", None, "KNOWLEDGE_ERROR",
            operator="复判员B", change_source="MANUAL"
        )
        
        ChangeHistoryService.log_material_supplement(
            db, samples[6].id, "evidence_summary",
            "补充质检表和对话时序说明，质检表早交2天，对话晚补1天",
            operator="运营", remark="补材料-时序说明",
            change_source="MATERIAL"
        )
        
        db.commit()
        print("示例数据创建完成！")
        print(f"  - 质检表: {len(inspections)} 条")
        print(f"  - 客服对话: {len(dialogs)} 条")
        print(f"  - 知识库条目: {len(knowledge_entries)} 条")
        print(f"  - 复判样本: {len(samples)} 条")
        print(f"  - 变更历史: {db.query(ChangeHistory).count()} 条")
        print("\n访问 http://localhost:8000 查看系统")
        
    except Exception as e:
        db.rollback()
        print(f"创建示例数据失败: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    create_sample_data()
