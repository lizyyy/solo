import os
import json
from datetime import datetime
from typing import List, Dict, Any, Optional

from models import (
    init_db, RecordRepository, RecordStatus, IssueType,
    DataSourceType
)
from data_ingestion import DataIngestionService
from anomaly_detector import AnomalyDetector
from review_service import StateEngine, ReviewService, issue_type_description


class RiverPollutionSystem:
    def __init__(self, db_path: str = "river_pollution.db", reset: bool = False):
        if reset and os.path.exists(db_path):
            os.remove(db_path)
        
        self.conn = init_db(db_path)
        self.repo = RecordRepository(self.conn)
        self.ingestion = DataIngestionService(self.repo)
        self.detector = AnomalyDetector(self.repo)
        self.state_engine = StateEngine(self.repo)
        self.review = ReviewService(self.repo, self.state_engine)
    
    def ingest_data(self, data: Dict[str, Any],
                    source_type: DataSourceType = DataSourceType.AUTOMATIC,
                    uploaded_by: Optional[str] = None,
                    auto_detect: bool = True) -> str:
        record_id = self.ingestion.ingest_from_dict(
            data=data,
            source_type=source_type,
            uploaded_by=uploaded_by
        )
        
        if auto_detect:
            self.detector.run_all_checks(record_id)
        
        return record_id
    
    def ingest_csv(self, csv_path: str,
                   uploaded_by: Optional[str] = None,
                   auto_detect: bool = True) -> List[str]:
        record_ids = self.ingestion.ingest_from_csv(
            csv_path=csv_path,
            uploaded_by=uploaded_by
        )
        
        if auto_detect:
            for rid in record_ids:
                self.detector.run_all_checks(rid)
        
        return record_ids
    
    def ingest_json(self, json_path: str,
                    uploaded_by: Optional[str] = None,
                    auto_detect: bool = True) -> List[str]:
        record_ids = self.ingestion.ingest_from_json(
            json_path=json_path,
            uploaded_by=uploaded_by
        )
        
        if auto_detect:
            for rid in record_ids:
                self.detector.run_all_checks(rid)
        
        return record_ids
    
    def add_late_attachment(self, original_record_id: str,
                            attachment_data: Dict[str, Any],
                            uploaded_by: str,
                            reason: str = "",
                            auto_detect: bool = True) -> str:
        new_record_id = self.ingestion.ingest_late_attachment(
            original_record_id=original_record_id,
            attachment_data=attachment_data,
            uploaded_by=uploaded_by,
            reason=reason
        )
        
        if auto_detect:
            self.detector.run_all_checks(new_record_id)
        
        return new_record_id
    
    def apply_correction(self, record_id: str,
                         corrections: Dict[str, Any],
                         corrected_by: str,
                         reason: str,
                         auto_detect: bool = True) -> None:
        self.ingestion.apply_manual_correction(
            record_id=record_id,
            corrections=corrections,
            corrected_by=corrected_by,
            reason=reason
        )
        
        if auto_detect:
            self.detector.run_all_checks(record_id)
    
    def find_duplicates(self, location: Optional[str] = None,
                        pollutant: Optional[str] = None) -> List[Dict[str, Any]]:
        groups = self.ingestion.find_duplicates(
            location=location,
            pollutant=pollutant
        )
        return [dict(
            group_id=g.group_id,
            primary_record_id=g.primary_record_id,
            duplicate_record_ids=g.duplicate_record_ids,
            detected_at=g.detected_at.isoformat(),
            merged=g.merged
        ) for g in groups]
    
    def run_detection_on_all(self) -> Dict[str, List[Dict[str, Any]]]:
        results = self.detector.check_all_records()
        return {
            rid: [dict(
                queue_id=item.queue_id,
                issue_type=item.issue_type.value,
                issue_description=item.issue_description,
                review_reason=item.review_reason,
                detected_at=item.detected_at.isoformat()
            ) for item in items]
            for rid, items in results.items()
        }
    
    def get_pending_queue(self, issue_type: Optional[IssueType] = None) -> List[Dict[str, Any]]:
        return self.review.get_pending_queue(issue_type=issue_type)
    
    def resolve_issue(self, queue_id: str, reviewed_by: str,
                      resolution: str, accept: bool) -> None:
        self.review.resolve_pending_issue(
            queue_id=queue_id,
            reviewed_by=reviewed_by,
            resolution=resolution,
            accept=accept
        )
    
    def resolve_record_issues(self, record_id: str, reviewed_by: str,
                              accept: bool, resolution: str) -> None:
        self.review.review_and_resolve_all(
            record_id=record_id,
            reviewed_by=reviewed_by,
            accept=accept,
            resolution=resolution
        )
    
    def get_record_trace(self, record_id: str) -> Dict[str, Any]:
        return self.ingestion.get_record_full_info(record_id)
    
    def get_review_history(self, record_id: str) -> List[Dict[str, Any]]:
        return self.review.get_record_review_history(record_id)
    
    def get_summary(self) -> Dict[str, Any]:
        return self.review.get_review_summary()
    
    def get_controversial_records(self, min_issues: int = 2) -> List[Dict[str, Any]]:
        return self.review.get_controversial_records(min_issues=min_issues)
    
    def get_records(self, location: Optional[str] = None,
                    pollutant: Optional[str] = None,
                    status: Optional[RecordStatus] = None) -> List[Dict[str, Any]]:
        records = self.repo.get_records_by_criteria(
            location=location,
            pollutant=pollutant,
            status=status
        )
        
        result = []
        for r in records:
            source = self.repo.get_data_source(r.source_id)
            pending = self.repo.get_pending_items_for_record(r.record_id, active_only=True)
            
            result.append({
                "record_id": r.record_id,
                "location": r.location,
                "pollutant": r.pollutant,
                "value": r.value,
                "unit": r.unit,
                "sample_time": r.sample_time.isoformat(),
                "status": r.status.value,
                "model_version": r.model_version,
                "has_overridden_constraints": len(r.overridden_constraints) > 0,
                "source_type": source.source_type.value if source else None,
                "uploaded_by": source.uploaded_by if source else None,
                "pending_issues": len(pending),
                "current_owner": r.current_owner,
                "created_at": r.created_at.isoformat(),
                "updated_at": r.updated_at.isoformat()
            })
        
        return result
    
    def print_report(self, detailed: bool = False) -> str:
        summary = self.get_summary()
        pending = self.get_pending_queue()
        controversial = self.get_controversial_records()
        
        lines = []
        lines.append("=" * 80)
        lines.append("河道污染反推系统 - 数据质量报告")
        lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("=" * 80)
        lines.append("")
        
        lines.append("【总体概览】")
        lines.append(f"总记录数: {summary['total_records']}")
        lines.append("状态分布:")
        for status, count in summary["by_status"].items():
            status_cn = {
                "draft": "草稿",
                "normal": "正常",
                "pending_review": "待复核",
                "rejected": "已拒绝",
                "archived": "已归档"
            }.get(status, status)
            lines.append(f"  {status_cn}: {count}条")
        lines.append("")
        
        lines.append("【待处理问题】")
        lines.append(f"待处理总数: {summary['pending_count']}")
        lines.append("按问题类型分布:")
        for itype, count in summary["pending_by_type"].items():
            itype_cn = issue_type_description(IssueType(itype))
            lines.append(f"  {itype_cn}: {count}条")
        lines.append("按等待时间分布:")
        age_labels = {
            "0_1_days": "0-1天",
            "1_3_days": "1-3天",
            "3_7_days": "3-7天",
            "over_7_days": "超过7天"
        }
        for age_key, count in summary["pending_by_age"].items():
            lines.append(f"  {age_labels[age_key]}: {count}条")
        lines.append("")
        
        if pending:
            lines.append("【待处理详情】")
            for i, item in enumerate(pending, 1):
                qi = item["queue_item"]
                rec = item["record"]
                
                itype_cn = issue_type_description(IssueType(qi["issue_type"]))
                status_cn = {
                    "draft": "草稿",
                    "normal": "正常",
                    "pending_review": "待复核",
                    "rejected": "已拒绝",
                    "archived": "已归档"
                }.get(rec["status"], rec["status"]) if rec else "未知"
                
                lines.append(f"{i}. [{itype_cn}] {qi['issue_description']}")
                lines.append(f"   记录ID: {qi['record_id']}")
                lines.append(f"   当前状态: {status_cn}")
                if rec:
                    lines.append(f"   位置: {rec['location']}, 污染物: {rec['pollutant']}, "
                               f"数值: {rec['value']}{rec['unit']}")
                lines.append(f"   检测时间: {qi['detected_at']}")
                if detailed:
                    lines.append(f"   复核原因: {qi['review_reason']}")
                lines.append("")
        else:
            lines.append("【待处理详情】无待处理问题")
            lines.append("")
        
        if controversial:
            min_issues = min(controversial[0].get('issue_count', 0), 2)
            lines.append(f"【高争议记录】(至少{min_issues}个问题)")
            for i, rec in enumerate(controversial, 1):
                lines.append(f"{i}. 记录ID: {rec['record_id']}")
                lines.append(f"   问题数: {rec['issue_count']} (活跃: {rec['active_issue_count']})")
                lines.append(f"   位置: {rec['location']}, 污染物: {rec['pollutant']}, "
                           f"数值: {rec['value']}{rec['unit']}")
                lines.append(f"   采样时间: {rec['sample_time']}")
                
                if rec.get('overridden_constraints'):
                    lines.append(f"   覆盖约束: {list(rec['overridden_constraints'].keys())}")
                
                issue_types = set(i['issue_type'] for i in rec['issues'])
                issue_type_cns = [issue_type_description(IssueType(t)) for t in issue_types]
                lines.append(f"   涉及问题类型: {', '.join(issue_type_cns)}")
                lines.append("")
        
        return "\n".join(lines)
    
    def close(self):
        self.conn.close()


def create_sample_data() -> List[Dict[str, Any]]:
    from datetime import timedelta
    
    base_time = datetime.now() - timedelta(hours=24)
    
    return [
        {
            "sample_time": (base_time + timedelta(minutes=0)).isoformat(),
            "location": "监测点A",
            "pollutant": "COD",
            "value": 45.2,
            "unit": "mg/L",
            "model_version": "v2.1.0",
            "constraints": {"max_value": 100, "min_value": 0},
            "overridden_constraints": {},
            "metadata": {"batch": "normal_001"}
        },
        {
            "sample_time": (base_time + timedelta(minutes=15)).isoformat(),
            "location": "监测点A",
            "pollutant": "COD",
            "value": 42800,
            "unit": "μg/L",
            "model_version": "v2.1.0",
            "constraints": {"max_value": 100, "min_value": 0},
            "overridden_constraints": {},
            "metadata": {"batch": "unit_mismatch_001"}
        },
        {
            "sample_time": (base_time + timedelta(minutes=30)).isoformat(),
            "location": "监测点B",
            "pollutant": "氨氮",
            "value": 5.8,
            "unit": "mg/L",
            "model_version": "v2.1.0",
            "constraints": {"max_value": 10, "min_value": 0, "confidence_threshold": 0.8},
            "overridden_constraints": {"confidence_threshold": 0.5},
            "metadata": {"batch": "constraint_override_001"}
        },
        {
            "sample_time": (base_time + timedelta(minutes=45)).isoformat(),
            "location": "监测点A",
            "pollutant": "COD",
            "value": 45.2,
            "unit": "mg/L",
            "model_version": "v2.1.0",
            "constraints": {"max_value": 100, "min_value": 0},
            "overridden_constraints": {},
            "metadata": {"batch": "duplicate_001"}
        },
        {
            "sample_time": (base_time + timedelta(minutes=60)).isoformat(),
            "location": "监测点C",
            "pollutant": "总磷",
            "value": 0.85,
            "unit": "mg/L",
            "model_version": "v2.0.0",
            "constraints": {"max_value": 2, "min_value": 0},
            "overridden_constraints": {},
            "metadata": {"batch": "result_drift_001"}
        },
        {
            "sample_time": (base_time + timedelta(minutes=62)).isoformat(),
            "location": "监测点C",
            "pollutant": "总磷",
            "value": 1.25,
            "unit": "mg/L",
            "model_version": "v2.1.0",
            "constraints": {"max_value": 2, "min_value": 0},
            "overridden_constraints": {},
            "metadata": {"batch": "result_drift_002"}
        },
        {
            "sample_time": (base_time + timedelta(minutes=90)).isoformat(),
            "location": "监测点D",
            "pollutant": "pH",
            "value": 7.2,
            "unit": "pH",
            "model_version": "v2.1.0",
            "constraints": {"max_value": 14, "min_value": 0},
            "overridden_constraints": {},
            "metadata": {"batch": "normal_002"}
        }
    ]


def demo():
    print("河道污染反推系统 - 演示程序")
    print("=" * 60)
    
    system = RiverPollutionSystem(db_path="demo_river_pollution.db", reset=True)
    
    print("\n1. 导入示例数据（包含正常记录、单位混用、约束覆盖、重复项、结果漂移）...")
    sample_data = create_sample_data()
    
    record_ids = []
    for i, data in enumerate(sample_data):
        rid = system.ingest_data(
            data=data,
            source_type=DataSourceType.AUTOMATIC,
            uploaded_by="系统自动导入",
            auto_detect=False
        )
        record_ids.append(rid)
        print(f"  导入记录 {i+1}: {rid}")
    
    print("\n2. 检测重复记录...")
    duplicates = system.find_duplicates()
    print(f"  发现 {len(duplicates)} 组重复记录")
    for g in duplicates:
        print(f"    组 {g['group_id']}: 主记录={g['primary_record_id']}, "
              f"重复项={g['duplicate_record_ids']}")
    
    print("\n3. 运行异常检测（单位混用、约束覆盖、结果漂移等）...")
    issues = system.run_detection_on_all()
    print(f"  发现 {len(issues)} 条记录存在问题")
    for rid, items in issues.items():
        print(f"    记录 {rid}: {len(items)} 个问题")
        for item in items:
            itype_cn = issue_type_description(IssueType(item["issue_type"]))
            print(f"      - [{itype_cn}] {item['issue_description'][:60]}...")
    
    print("\n4. 模拟晚到附件场景...")
    original_id = record_ids[0]
    late_attachment = {
        "value": 48.5,
        "unit": "mg/L"
    }
    late_id = system.add_late_attachment(
        original_record_id=original_id,
        attachment_data=late_attachment,
        uploaded_by="张工",
        reason="实验室重新检测结果，原始数据有误",
        auto_detect=True
    )
    print(f"  晚到附件记录ID: {late_id}")
    
    print("\n5. 模拟人工更正场景...")
    correction_id = record_ids[1]
    system.apply_correction(
        record_id=correction_id,
        corrections={"value": 42.8, "unit": "mg/L"},
        corrected_by="李工",
        reason="单位录入错误，μg/L应为mg/L，数值已按单位转换",
        auto_detect=True
    )
    print(f"  已更正记录: {correction_id}")
    
    print("\n6. 查看待处理队列...")
    pending = system.get_pending_queue()
    print(f"  当前有 {len(pending)} 个待处理问题")
    
    print("\n7. 查看有争议记录...")
    controversial = system.get_controversial_records(min_issues=1)
    print(f"  发现 {len(controversial)} 条有争议记录")
    
    print("\n8. 模拟复核处理...")
    if pending:
        first_item = pending[0]
        queue_id = first_item["queue_item"]["queue_id"]
        record_id = first_item["queue_item"]["record_id"]
        
        print(f"  处理问题 {queue_id}...")
        system.resolve_issue(
            queue_id=queue_id,
            reviewed_by="王主任",
            resolution="经核实，该单位使用正确，已建立单位换算标准",
            accept=True
        )
        print(f"  已标记为通过")
    
    print("\n" + "=" * 60)
    print("\n9. 生成完整报告...")
    report = system.print_report(detailed=True)
    print(report)
    
    print("\n10. 查看单条记录的完整追溯信息...")
    trace = system.get_record_trace(record_ids[2])
    print(f"  记录ID: {trace['record']['record_id']}")
    print(f"  来源: {trace['source']['source_type']}, 上传人: {trace['source']['uploaded_by']}")
    print(f"  状态: {trace['record']['status']}")
    print(f"  覆盖的约束: {trace['record']['overridden_constraints']}")
    print(f"  审计日志 {len(trace['audit_log'])} 条:")
    for entry in trace['audit_log']:
        print(f"    {entry['timestamp']} - {entry['action']} - {entry['changed_by']}: "
              f"{entry['change_reason'][:50]}...")
    
    system.close()
    print("\n演示完成！")


if __name__ == "__main__":
    demo()
