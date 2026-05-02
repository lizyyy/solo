import json
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional
from copy import deepcopy


class ReviewManager:
    """人工裁决管理器"""
    
    def __init__(self, config: Dict, project_dir: Path):
        """
        初始化裁决管理器
        
        Args:
            config: 项目配置
            project_dir: 项目目录路径
        """
        self.config = config
        self.project_dir = project_dir
        self.reviews_dir = project_dir / "reviews"
    
    def get_pending_conflicts(self) -> List[Dict]:
        """
        获取待裁决的冲突列表
        
        Returns:
            待裁决冲突列表
        """
        check_results = self.config.get("check_results", {})
        existing_reviews = self.config.get("reviews", [])
        
        # 获取已裁决的冲突ID
        resolved_ids = set(r.get("conflict_id") for r in existing_reviews if r.get("resolved", False))
        
        pending = []
        
        # 从检查结果中收集所有冲突
        conflicts = check_results.get("conflicts", []) if check_results else []
        
        # 也从merged_samples中获取
        merged = self.config.get("merged_samples", {})
        if merged:
            conflicts_from_merge = merged.get("conflicts", [])
            conflicts.extend(conflicts_from_merge)
        
        # 去重
        seen_ids = set()
        unique_conflicts = []
        for c in conflicts:
            cid = c.get("conflict_id")
            if cid and cid not in seen_ids:
                seen_ids.add(cid)
                unique_conflicts.append(c)
        
        # 过滤出待裁决的
        for conflict in unique_conflicts:
            cid = conflict.get("conflict_id")
            if cid and cid not in resolved_ids:
                pending.append({
                    "id": cid,
                    "type": conflict.get("type", "unknown"),
                    "description": conflict.get("description", ""),
                    "conflict_data": conflict,
                })
        
        return pending
    
    def add_decision(
        self,
        conflict_id: str,
        decision: str,
        note: str = "",
        custom_data: Dict = None
    ) -> Optional[Dict]:
        """
        添加裁决记录
        
        Args:
            conflict_id: 冲突ID
            decision: 裁决方式: 'keep_first', 'keep_last', 'keep_both', 'custom'
            note: 裁决备注
            custom_data: 自定义数据
        
        Returns:
            裁决记录字典，如果冲突不存在则返回None
        """
        # 检查冲突是否存在
        existing_reviews = self.config.get("reviews", [])
        
        # 检查是否已裁决
        for r in existing_reviews:
            if r.get("conflict_id") == conflict_id and r.get("resolved", False):
                return None
        
        # 构建裁决记录
        review_record = {
            "id": f"review_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            "conflict_id": conflict_id,
            "decision": decision,
            "note": note,
            "custom_data": custom_data or {},
            "resolved": True,
            "resolved_at": datetime.now().isoformat(),
        }
        
        # 保存到reviews目录
        self.reviews_dir.mkdir(parents=True, exist_ok=True)
        review_file = self.reviews_dir / f"{review_record['id']}.json"
        
        with open(review_file, 'w', encoding='utf-8') as f:
            json.dump(review_record, f, indent=2, ensure_ascii=False, default=str)
        
        return review_record
    
    def get_all_reviews(self) -> List[Dict]:
        """
        获取所有裁决记录
        
        Returns:
            裁决记录列表
        """
        all_reviews = []
        
        # 从配置中获取
        all_reviews.extend(self.config.get("reviews", []))
        
        # 从reviews目录读取
        if self.reviews_dir.exists():
            for review_file in self.reviews_dir.glob("review_*.json"):
                try:
                    with open(review_file, 'r', encoding='utf-8') as f:
                        review = json.load(f)
                        all_reviews.append(review)
                except:
                    continue
        
        # 去重
        seen_ids = set()
        unique = []
        for r in all_reviews:
            rid = r.get("id")
            if rid and rid not in seen_ids:
                seen_ids.add(rid)
                unique.append(r)
        
        return unique
    
    def apply_decisions(self, samples: List[Any]) -> List[Any]:
        """
        应用裁决到样点列表
        
        Args:
            samples: 原始样点列表
        
        Returns:
            应用裁决后的样点列表
        """
        reviews = self.get_all_reviews()
        
        if not reviews:
            return samples
        
        result = []
        id_to_samples = {}  # sample_id -> list of samples
        
        # 按ID分组
        for sample in samples:
            sid = sample.sample_id
            if sid not in id_to_samples:
                id_to_samples[sid] = []
            id_to_samples[sid].append(sample)
        
        # 应用裁决
        for review in reviews:
            if not review.get("resolved"):
                continue
            
            conflict_id = review.get("conflict_id", "")
            decision = review.get("decision", "")
            
            # 提取冲突中的sample_id
            # 冲突ID格式通常是 "id_{sample_id}"
            if conflict_id.startswith("id_"):
                sample_id = conflict_id[3:]
                
                if sample_id in id_to_samples:
                    group = id_to_samples[sample_id]
                    
                    if decision == "keep_first":
                        # 只保留第一个
                        if group:
                            result.append(group[0])
                        del id_to_samples[sample_id]
                    
                    elif decision == "keep_last":
                        # 只保留最后一个
                        if group:
                            result.append(group[-1])
                        del id_to_samples[sample_id]
                    
                    elif decision == "keep_both":
                        # 重命名并保留全部
                        for idx, sample in enumerate(group):
                            if idx == 0:
                                result.append(sample)
                            else:
                                # 创建副本并重命名
                                new_sample = deepcopy(sample)
                                new_sample.sample_id = f"{sample_id}_{idx+1}"
                                new_sample.metadata['_original_id'] = sample_id
                                new_sample.metadata['_renamed_by_review'] = review.get("id")
                                result.append(new_sample)
                        del id_to_samples[sample_id]
        
        # 添加剩余的（未被裁决处理的）
        for sid, group in id_to_samples.items():
            result.extend(group)
        
        return result
