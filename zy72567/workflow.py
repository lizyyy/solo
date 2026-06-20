"""
工作流模块
走完三步：参数YAML第一次导入 → 老唐补看评测切片 → 特征版本表更新
同一批数据重复训练两次时，不急着归正常，留给策略产品复核
"""
from typing import Optional
from datetime import datetime

from models import (
    BoundarySample, EvaluationSlice, FeatureVersion,
    SampleStatus, AnomalyType
)
from database import Database
from self_check import SelfChecker


class WorkflowManager:
    """
    边界样本工作流管理器
    
    状态流转说明（跟老唐和策略产品交接用）：
    
    1. imported: YAML刚导入，初始状态
       ↓ 老唐看评测切片
    2. slice_viewed: 老唐已看完评测切片，做了标记
       ↓ 特征版本表更新
    3. feature_updated: 特征版本表已更新
       ↓ 策略产品复核（如果有异常）
    4. pending_review: 待策略产品复核（有异常时跳到这里）
       ↓ 策略产品确认
    5. normal / abnormal: 最终确认
    
    关键规则：
    - 同一批数据重复训练两次 → 自动进pending_review，不能直接跳normal
    - YAML每一行改动都留痕，能回到原始行号看证据
    - 所有地方读同一份结果，不会页面显示异常但导出消失
    """
    
    def __init__(self, db: Database):
        self.db = db
        self.self_checker = SelfChecker(db)
    
    # ==================== 第一步：YAML导入 ====================
    
    def step1_import_yaml(self, yaml_content: str, file_name: str, imported_by: str) -> dict:
        """
        第一步：参数YAML第一次导入
        
        老唐操作：把整理好的边界样本YAML贴进来或上传
        
        返回导入结果，包含：
        - 版本ID
        - 导入了多少样本
        - 哪些行有格式问题
        - 立刻跑自检，发现的问题提前暴露
        """
        from yaml_importer import YAMLImporter
        
        importer = YAMLImporter(self.db)
        version_id, samples = importer.import_from_content(
            yaml_content, file_name, imported_by
        )
        
        # 导入后立刻跑自检
        check_results = self.self_checker.run_all_checks()
        
        return {
            "step": "第一步：YAML导入完成",
            "yaml_version_id": version_id,
            "imported_count": len(samples),
            "sample_ids": [s.id for s in samples],
            "self_check_summary": [r.summary for r in check_results],
            "problems_found": sum(1 for r in check_results if not r.passed)
        }
    
    # ==================== 第二步：老唐看评测切片 ====================
    
    def step2_view_slice(self, sample_id: int, slice_data: str, viewed_by: str, remark: str = "") -> dict:
        """
        第二步：推荐策略老唐补看评测切片
        
        老唐操作：
        1. 找到样本对应的评测切片
        2. 看预测/实际分类是否合理
        3. 有问题留备注，没问题标记已查看
        
        注意：看完切片不代表样本正常，只是老唐看过了
        """
        # 保存评测切片
        slice_obj = EvaluationSlice(
            sample_id=sample_id,
            slice_data=slice_data,
            viewed_by=viewed_by,
            viewed_at=datetime.now(),
            viewer_remark=remark
        )
        slice_id = self.db.save_slice(slice_obj)
        
        # 更新样本状态（如果之前只是imported，现在变成slice_viewed）
        sample = self.db.get_sample(sample_id, include_related=False)
        if sample and sample.status == SampleStatus.IMPORTED:
            # 注意：如果有异常（比如重复训练），保持pending_review，不覆盖
            if not sample.is_abnormal:
                self.db.update_sample_status(sample_id, SampleStatus.SLICE_VIEWED, viewed_by, "老唐已查看评测切片")
        
        return {
            "step": "第二步：评测切片查看完成",
            "slice_id": slice_id,
            "sample_id": sample_id,
            "new_status": self.db.get_sample(sample_id, include_related=False).status.value,
            "viewer_remark": remark
        }
    
    # ==================== 第三步：特征版本表更新 ====================
    
    def step3_update_feature(self, sample_id: int, feature_version: str, updated_by: str, remark: str = "") -> dict:
        """
        第三步：特征版本表更新
        
        老唐操作：
        1. 确认样本在训练中用到的特征版本
        2. 记录到特征版本表中
        
        关键规则：
        - 如果这个批次已经有另一个特征版本了 → 说明同一批数据重复训练了
        - 这种情况自动进pending_review，不能直接归normal
        - 留给策略产品复核确认
        """
        # 保存特征版本
        fv = FeatureVersion(
            sample_id=sample_id,
            feature_version=feature_version,
            updated_by=updated_by,
            updated_at=datetime.now(),
            update_remark=remark
        )
        fv_id = self.db.save_feature_version(fv)
        
        # 检查：同一批数据是否重复训练了
        sample = self.db.get_sample(sample_id, include_related=True)
        if sample:
            # 检查这个批次关联了多少个不同的特征版本
            batch_samples, _ = self.db.list_samples(batch_id=sample.batch_id, page_size=1000)
            all_versions = set()
            for bs in batch_samples:
                bs_full = self.db.get_sample(bs.id, include_related=True)
                for fv_item in bs_full.feature_versions:
                    all_versions.add(fv_item.feature_version)
            
            if len(all_versions) > 1:
                # 同一批数据重复训练了 → 标记异常，进pending_review
                newly_marked = 0
                for bs in batch_samples:
                    added = self.db.add_anomaly_to_sample(bs.id, AnomalyType.DUPLICATE_TRAIN, updated_by)
                    if added:
                        newly_marked += 1
                
                return {
                    "step": "第三步：特征版本更新（注意：发现重复训练）",
                    "feature_version_id": fv_id,
                    "sample_id": sample_id,
                    "warning": "同一批数据关联了多个特征版本，已自动标记为待策略产品复核",
                    "batch_id": sample.batch_id,
                    "feature_versions_found": list(all_versions),
                    "status": SampleStatus.PENDING_REVIEW.value,
                    "newly_marked_count": newly_marked
                }
        
        # 正常情况：更新状态
        sample = self.db.get_sample(sample_id, include_related=False)
        if sample and sample.status in [SampleStatus.SLICE_VIEWED, SampleStatus.IMPORTED]:
            if not sample.is_abnormal:
                self.db.update_sample_status(sample_id, SampleStatus.FEATURE_UPDATED, updated_by, "特征版本已更新")
        
        final_sample = self.db.get_sample(sample_id, include_related=False)
        
        return {
            "step": "第三步：特征版本更新完成",
            "feature_version_id": fv_id,
            "sample_id": sample_id,
            "new_status": final_sample.status.value,
            "remark": remark
        }
    
    # ==================== 策略产品复核 ====================
    
    def product_review(self, sample_id: int, is_normal: bool, reviewed_by: str, remark: str = "") -> dict:
        """
        策略产品复核
        
        只有策略产品能操作：
        - 确认是正常 → 标normal
        - 确认是异常 → 标abnormal
        
        老唐不能直接把重复训练的样本归正常，必须过这一步
        """
        new_status = SampleStatus.NORMAL if is_normal else SampleStatus.ABNORMAL
        self.db.update_sample_status(sample_id, new_status, reviewed_by, f"策略产品复核：{remark}")
        
        return {
            "action": "策略产品复核完成",
            "sample_id": sample_id,
            "final_status": new_status.value,
            "review_remark": remark
        }
    
    # ==================== 证据追溯 ====================
    
    def get_sample_evidence(self, sample_id: int) -> dict:
        """
        拿到一个样本的完整证据链
        策略产品追问时，直接调这个接口，所有证据都在
        
        返回：
        - YAML原始行号和内容
        - YAML有没有被改过，谁改的，改了什么
        - 评测切片查看记录
        - 特征版本更新记录
        - 所有状态变更日志
        - 当前有什么异常
        """
        sample = self.db.get_sample(sample_id, include_related=True)
        if not sample:
            return {"error": "样本不存在"}
        
        yaml_version = self.db.get_yaml_version(sample.yaml_version_id)
        yaml_lines = self.db.get_yaml_lines(sample.yaml_version_id)
        
        # 找到这个样本对应的YAML行
        sample_yaml_line = next((l for l in yaml_lines if l.line_number == sample.yaml_line_number), None)
        
        # 改动记录
        modified_lines = [l for l in yaml_lines if l.is_modified]
        
        # 审计日志
        audit_logs = self.db.get_audit_logs(sample_id)
        
        return {
            "sample_basic": {
                "sample_key": sample.sample_key,
                "batch_id": sample.batch_id,
                "text_content": sample.text_content,
                "predicted_category": sample.predicted_category,
                "actual_category": sample.actual_category,
                "current_status": sample.status.value,
                "anomaly_types": [t.value for t in sample.anomaly_types]
            },
            "yaml_evidence": {
                "yaml_version": yaml_version.version_name if yaml_version else "",
                "imported_by": yaml_version.imported_by if yaml_version else "",
                "import_time": yaml_version.import_time.isoformat() if yaml_version else "",
                "original_line_number": sample.yaml_line_number,
                "original_line_content": sample_yaml_line.original_content if sample_yaml_line else "",
                "current_line_content": sample_yaml_line.current_content if sample_yaml_line else "",
                "line_modified": sample_yaml_line.is_modified if sample_yaml_line else False,
                "all_modifications_in_version": [
                    {
                        "line_number": l.line_number,
                        "original": l.original_content,
                        "current": l.current_content,
                        "modified_by": l.modified_by,
                        "modified_at": l.modified_at.isoformat() if l.modified_at else "",
                        "remark": l.remark
                    }
                    for l in modified_lines
                ]
            },
            "slice_evidence": [
                {
                    "slice_data": s.slice_data,
                    "viewed_by": s.viewed_by,
                    "viewed_at": s.viewed_at.isoformat() if s.viewed_at else "",
                    "remark": s.viewer_remark
                }
                for s in sample.slices
            ],
            "feature_evidence": [
                {
                    "feature_version": f.feature_version,
                    "updated_by": f.updated_by,
                    "updated_at": f.updated_at.isoformat(),
                    "remark": f.update_remark
                }
                for f in sample.feature_versions
            ],
            "audit_logs": audit_logs
        }
