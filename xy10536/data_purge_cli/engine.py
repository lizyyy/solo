import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional, Set, Tuple
from pathlib import Path
import json

from .storage import Storage


class PurgeEngine:
    """数据剔除核心引擎"""
    
    def __init__(self, workspace: str = "."):
        self.storage = Storage(workspace)
        
    def initialize(self, config: Dict[str, Any] = None) -> Dict[str, Any]:
        """初始化工作空间"""
        if self.storage.is_initialized():
            return {
                "success": True,
                "status": "already_initialized",
                "message": "工作空间已初始化",
                "path": str(self.storage.workspace)
            }
        
        self.storage.ensure_dirs()
        
        init_config = {
            "version": "1.0.0",
            "initialized_at": datetime.now().isoformat(),
            "config": config or {}
        }
        
        return {
            "success": True,
            "status": "initialized",
            "message": "工作空间初始化成功",
            "path": str(self.storage.workspace),
            "config": init_config
        }
    
    def import_dataset(self, name: str, description: str = "", 
                       sample_index_path: str = None,
                       label_file_path: str = None,
                       version: str = "v1.0.0",
                       source: str = "manual",
                       is_published: bool = False,
                       operator: str = "system") -> Dict[str, Any]:
        """导入数据集"""
        
        operation_id = str(uuid.uuid4())
        operation = {
            "id": operation_id,
            "type": "import_dataset",
            "dataset": name,
            "version": version,
            "operator": operator,
            "status": "running",
            "created_at": datetime.now().isoformat()
        }
        self.storage.save_operation(operation)
        
        try:
            sample_index = self._load_sample_index(sample_index_path) if sample_index_path else []
            labels = self._load_labels(label_file_path) if label_file_path else {}
            
            dataset_info = {
                "name": name,
                "description": description,
                "source": source,
                "versions": [version],
                "is_published": is_published,
                "created_at": datetime.now().isoformat(),
                "created_by": operator
            }
            
            existing = self.storage.load_dataset(name)
            if existing:
                dataset_info["versions"] = list(set(existing.get("versions", []) + [version]))
                dataset_info["updated_at"] = datetime.now().isoformat()
                dataset_info["updated_by"] = operator
            
            self.storage.save_dataset(name, dataset_info)
            
            version_data = {
                "version": version,
                "sample_count": len(sample_index),
                "samples": sample_index,
                "labels": labels,
                "imported_at": datetime.now().isoformat(),
                "imported_by": operator,
                "is_published": is_published
            }
            
            self.storage.save_labels(name, version, version_data)
            
            self.storage.update_operation_status(operation_id, "completed")
            
            return {
                "success": True,
                "operation_id": operation_id,
                "message": f"数据集 {name} 版本 {version} 导入成功",
                "stats": {
                    "sample_count": len(sample_index),
                    "label_count": len(labels)
                }
            }
            
        except Exception as e:
            self.storage.update_operation_status(operation_id, "failed", str(e))
            return {
                "success": False,
                "operation_id": operation_id,
                "error": str(e),
                "message": f"导入失败: {str(e)}"
            }
    
    def import_sensitive_samples(self, sensitive_file_path: str, 
                                  reason: str = "",
                                  operator: str = "system") -> Dict[str, Any]:
        """导入敏感样本清单"""
        
        operation_id = str(uuid.uuid4())
        operation = {
            "id": operation_id,
            "type": "import_sensitive",
            "operator": operator,
            "status": "running",
            "created_at": datetime.now().isoformat()
        }
        self.storage.save_operation(operation)
        
        try:
            sensitive_data = self._load_sensitive_samples(sensitive_file_path)
            
            sensitive_data.update({
                "id": operation_id,
                "imported_at": datetime.now().isoformat(),
                "imported_by": operator,
                "reason": reason,
                "status": "imported"
            })
            
            self.storage.save_sensitive_samples(operation_id, sensitive_data)
            self.storage.update_operation_status(operation_id, "completed")
            
            return {
                "success": True,
                "operation_id": operation_id,
                "message": f"敏感样本清单导入成功，共 {len(sensitive_data.get('samples', []))} 个样本",
                "stats": {
                    "sample_count": len(sensitive_data.get("samples", []))
                }
            }
            
        except Exception as e:
            self.storage.update_operation_status(operation_id, "failed", str(e))
            return {
                "success": False,
                "operation_id": operation_id,
                "error": str(e),
                "message": f"导入失败: {str(e)}"
            }
    
    def check(self, sensitive_operation_id: str, 
              dataset_name: str = None,
              version: str = None,
              operator: str = "system") -> Dict[str, Any]:
        """检查敏感样本在数据集中的分布"""
        
        operation_id = str(uuid.uuid4())
        operation = {
            "id": operation_id,
            "type": "check",
            "sensitive_operation_id": sensitive_operation_id,
            "operator": operator,
            "status": "running",
            "created_at": datetime.now().isoformat()
        }
        self.storage.save_operation(operation)
        
        try:
            sensitive_data = self.storage.load_sensitive_samples(sensitive_operation_id)
            if not sensitive_data:
                raise ValueError(f"敏感样本清单不存在: {sensitive_operation_id}")
            
            sensitive_samples = {s.get("original_id") or s.get("id") 
                                for s in sensitive_data.get("samples", [])}
            sensitive_includes_augment = any(s.get("include_augment", True) 
                                            for s in sensitive_data.get("samples", []))
            
            if dataset_name:
                datasets = [dataset_name]
            else:
                datasets = self.storage.list_datasets()
            
            results = {}
            
            for ds_name in datasets:
                dataset_info = self.storage.load_dataset(ds_name)
                if not dataset_info:
                    continue
                
                versions_to_check = [version] if version else dataset_info.get("versions", [])
                
                dataset_results = []
                
                for v in versions_to_check:
                    labels = self.storage.load_labels(ds_name, v)
                    if not labels:
                        continue
                    
                    matches = self._find_matches(
                        labels["samples"],
                        sensitive_samples,
                        sensitive_includes_augment
                    )
                    
                    if matches:
                        dataset_results.append({
                            "version": v,
                            "is_published": labels.get("is_published", False),
                            "matched_count": len(matches),
                            "matched_samples": matches,
                            "affected_labels": self._find_affected_labels(labels, matches)
                        })
                
                if dataset_results:
                    results[ds_name] = {
                        "is_published": dataset_info.get("is_published", False),
                        "versions": dataset_results
                    }
            
            check_result = {
                "sensitive_operation_id": sensitive_operation_id,
                "check_time": datetime.now().isoformat(),
                "checked_by": operator,
                "sensitive_sample_count": len(sensitive_samples),
                "affected_datasets": results
            }
            
            self.storage.update_operation_status(operation_id, "completed")
            
            return {
                "success": True,
                "operation_id": operation_id,
                "message": "检查完成",
                "result": check_result,
                "stats": {
                    "checked_datasets": len(datasets),
                    "affected_datasets": len(results)
                }
            }
            
        except Exception as e:
            self.storage.update_operation_status(operation_id, "failed", str(e))
            return {
                "success": False,
                "operation_id": operation_id,
                "error": str(e),
                "message": f"检查失败: {str(e)}"
            }
    
    def detail(self, check_operation_id: str = None,
                sensitive_operation_id: str = None,
                dataset_name: str = None) -> Dict[str, Any]:
        """查看详细信息"""
        
        if check_operation_id:
            check_op = self.storage.load_operation(check_operation_id)
            if check_op:
                return {
                    "success": True,
                    "operation": check_op
                }
        
        if sensitive_operation_id:
            sensitive = self.storage.load_sensitive_samples(sensitive_operation_id)
            if sensitive:
                return {
                    "success": True,
                    "sensitive_samples": sensitive
                }
        
        if dataset_name:
            dataset = self.storage.load_dataset(dataset_name)
            if dataset:
                versions = {}
                for v in dataset.get("versions", []):
                    labels = self.storage.load_labels(dataset_name, v)
                    if labels:
                        versions[v] = {
                            "sample_count": labels.get("sample_count", 0),
                            "is_published": labels.get("is_published", False),
                            "imported_at": labels.get("imported_at", "")
                        }
                
                return {
                    "success": True,
                    "dataset": dataset,
                    "versions": versions
                }
        
        return {
            "success": False,
            "message": "未找到匹配的信息"
        }
    
    def execute_purge(self, check_operation_id: str,
                       dataset_name: str,
                       version: str,
                       patch_version: str = None,
                       operator: str = "system",
                       reason: str = "") -> Dict[str, Any]:
        """执行剔除操作"""
        
        operation_id = str(uuid.uuid4())
        operation = {
            "id": operation_id,
            "type": "purge",
            "check_operation_id": check_operation_id,
            "dataset": dataset_name,
            "version": version,
            "operator": operator,
            "status": "running",
            "created_at": datetime.now().isoformat()
        }
        self.storage.save_operation(operation)
        
        try:
            labels = self.storage.load_labels(dataset_name, version)
            if not labels:
                raise ValueError(f"数据集版本不存在: {dataset_name} {version}")
            
            is_published = labels.get("is_published", False)
            target_version = patch_version if patch_version else version
            
            if is_published and not patch_version:
                raise ValueError("已发布版本只能通过补丁版本修改，请指定 --patch-version")
            
            existing = self.storage.load_labels(dataset_name, target_version)
            if existing and existing.get("purged", False):
                return {
                    "success": True,
                    "operation_id": operation_id,
                    "message": "该版本已执行过剔除操作（幂等）",
                    "status": "idempotent",
                    "version": target_version
                }
            
            check_op = self.storage.load_operation(check_operation_id)
            if not check_op:
                raise ValueError(f"检查操作不存在: {check_operation_id}")
            
            sensitive_op_id = check_op.get("sensitive_operation_id")
            sensitive_data = self.storage.load_sensitive_samples(sensitive_op_id)
            if not sensitive_data:
                raise ValueError(f"敏感样本清单不存在: {sensitive_op_id}")
            
            sensitive_samples = {s.get("original_id") or s.get("id") 
                                for s in sensitive_data.get("samples", [])}
            sensitive_includes_augment = any(s.get("include_augment", True) 
                                            for s in sensitive_data.get("samples", []))
            
            before_snapshot = {
                "version": version,
                "sample_count": len(labels["samples"]),
                "label_count": len(labels["labels"])
            }
            before_snapshot_path = self.storage.save_snapshot(
                dataset_name, target_version, "before", before_snapshot
            )
            
            matches = self._find_matches(
                labels["samples"],
                sensitive_samples,
                sensitive_includes_augment
            )
            
            new_samples = [s for s in labels["samples"] 
                          if (s.get("id") not in matches and 
                              s.get("original_id") not in matches)]
            
            affected_labels = self._find_affected_labels(labels, matches)
            new_labels = {k: v for k, v in labels["labels"].items() 
                         if k not in affected_labels}
            
            after_snapshot = {
                "version": target_version,
                "sample_count": len(new_samples),
                "label_count": len(new_labels),
                "removed_samples": len(matches),
                "removed_labels": len(affected_labels)
            }
            after_snapshot_path = self.storage.save_snapshot(
                dataset_name, target_version, "after", after_snapshot
            )
            
            version_data = {
                "version": target_version,
                "sample_count": len(new_samples),
                "samples": new_samples,
                "labels": new_labels,
                "imported_at": labels.get("imported_at", datetime.now().isoformat()),
                "imported_by": labels.get("imported_by", operator),
                "is_published": is_published,
                "purged": True,
                "purge_info": {
                    "operation_id": operation_id,
                    "check_operation_id": check_operation_id,
                    "sensitive_operation_id": sensitive_op_id,
                    "purged_at": datetime.now().isoformat(),
                    "purged_by": operator,
                    "reason": reason,
                    "removed_count": len(matches),
                    "removed_samples": list(matches),
                    "before_snapshot": before_snapshot_path,
                    "after_snapshot": after_snapshot_path,
                    "original_version": version,
                    "is_patch": patch_version is not None
                }
            }
            
            self.storage.save_labels(dataset_name, target_version, version_data)
            
            dataset_info = self.storage.load_dataset(dataset_name)
            if dataset_info:
                if target_version not in dataset_info.get("versions", []):
                    dataset_info["versions"].append(target_version)
                dataset_info["updated_at"] = datetime.now().isoformat()
                dataset_info["updated_by"] = operator
                self.storage.save_dataset(dataset_name, dataset_info)
            
            self.storage.update_operation_status(operation_id, "completed")
            
            return {
                "success": True,
                "operation_id": operation_id,
                "message": f"剔除完成，版本 {target_version}",
                "stats": {
                    "removed_samples": len(matches),
                    "removed_labels": len(affected_labels),
                    "remaining_samples": len(new_samples),
                    "remaining_labels": len(new_labels)
                },
                "version": target_version
            }
            
        except Exception as e:
            self.storage.update_operation_status(operation_id, "failed", str(e))
            return {
                "success": False,
                "operation_id": operation_id,
                "error": str(e),
                "message": f"剔除失败: {str(e)}"
            }
    
    def generate_report(self, check_operation_id: str = None,
                        purge_operation_id: str = None,
                        operator: str = "system") -> Dict[str, Any]:
        """生成报告"""
        
        operation_id = str(uuid.uuid4())
        operation = {
            "id": operation_id,
            "type": "report",
            "operator": operator,
            "status": "running",
            "created_at": datetime.now().isoformat()
        }
        self.storage.save_operation(operation)
        
        try:
            report = {
                "report_id": operation_id,
                "generated_at": datetime.now().isoformat(),
                "generated_by": operator
            }
            
            if check_operation_id:
                check_op = self.storage.load_operation(check_operation_id)
                if check_op:
                    report["check_operation"] = check_op
                    report["type"] = "check_report"
                    
                    datasets = self.storage.list_datasets()
                    affected = []
                    
                    for ds_name in datasets:
                        dataset = self.storage.load_dataset(ds_name)
                        if dataset:
                            for v in dataset.get("versions", []):
                                labels = self.storage.load_labels(ds_name, v)
                                if labels and labels.get("purged", False):
                                    affected.append({
                                        "dataset": ds_name,
                                        "version": v,
                                        "purged": labels.get("purged", False),
                                        "purge_info": labels.get("purge_info")
                                    })
                    
                    report["affected_versions"] = affected
            
            elif purge_operation_id:
                purge_op = self.storage.load_operation(purge_operation_id)
                if purge_op:
                    report["purge_operation"] = purge_op
                    report["type"] = "purge_report"
                    
                    dataset_name = purge_op.get("dataset")
                    version = purge_op.get("version")
                    labels = self.storage.load_labels(dataset_name, version)
                    
                    if labels and labels.get("purge_info"):
                        purge_info = labels["purge_info"]
                        report["details"] = {
                            "removed_count": purge_info.get("removed_count"),
                            "removed_samples": purge_info.get("removed_samples"),
                            "purged_by": purge_info.get("purged_by"),
                            "purged_at": purge_info.get("purged_at"),
                            "requires_retraining": True
                        }
                        
                        report["affected_datasets"] = [{
                            "name": dataset_name,
                            "version": version,
                            "labels_changed": True,
                            "sample_count_before": purge_info.get("removed_count") + 
                                                  (labels.get("sample_count", 0) if labels else 0),
                            "sample_count_after": labels.get("sample_count", 0),
                            "requires_retraining": True
                        }]
            
            else:
                report["type"] = "summary_report"
                all_ops = self.storage.list_operations()
                report["recent_operations"] = all_ops[:10]
                
                datasets = []
                for ds_name in self.storage.list_datasets():
                    dataset = self.storage.load_dataset(ds_name)
                    if dataset:
                        versions = []
                        for v in dataset.get("versions", []):
                            labels = self.storage.load_labels(ds_name, v)
                            if labels:
                                versions.append({
                                    "version": v,
                                    "sample_count": labels.get("sample_count", 0),
                                    "purged": labels.get("purged", False)
                                })
                        datasets.append({
                            "name": ds_name,
                            "versions": versions
                        })
                
                report["datasets"] = datasets
            
            self.storage.save_report(operation_id, report)
            self.storage.update_operation_status(operation_id, "completed")
            
            return {
                "success": True,
                "operation_id": operation_id,
                "message": "报告生成成功",
                "report": report
            }
            
        except Exception as e:
            self.storage.update_operation_status(operation_id, "failed", str(e))
            return {
                "success": False,
                "operation_id": operation_id,
                "error": str(e),
                "message": f"报告生成失败: {str(e)}"
            }
    
    def _load_sample_index(self, path: str) -> List[Dict[str, Any]]:
        """加载样本索引文件"""
        p = Path(path)
        if not p.exists():
            raise FileNotFoundError(f"样本索引文件不存在: {path}")
        
        with open(p, "r", encoding="utf-8") as f:
            if p.suffix == ".json":
                data = json.load(f)
                if isinstance(data, list):
                    return data
                elif isinstance(data, dict) and "samples" in data:
                    return data["samples"]
            elif p.suffix == ".jsonl":
                return [json.loads(line) for line in f if line.strip()]
        
        raise ValueError(f"不支持的文件格式: {p.suffix}")
    
    def _load_labels(self, path: str) -> Dict[str, Any]:
        """加载标签文件"""
        p = Path(path)
        if not p.exists():
            raise FileNotFoundError(f"标签文件不存在: {path}")
        
        with open(p, "r", encoding="utf-8") as f:
            if p.suffix == ".json":
                return json.load(f)
            elif p.suffix == ".jsonl":
                labels = {}
                for line in f:
                    if line.strip():
                        item = json.loads(line)
                        sample_id = item.get("id") or item.get("sample_id")
                        if sample_id:
                            labels[sample_id] = item
                return labels
        
        raise ValueError(f"不支持的文件格式: {p.suffix}")
    
    def _load_sensitive_samples(self, path: str) -> Dict[str, Any]:
        """加载敏感样本清单"""
        p = Path(path)
        if not p.exists():
            raise FileNotFoundError(f"敏感样本文件不存在: {path}")
        
        with open(p, "r", encoding="utf-8") as f:
            if p.suffix == ".json":
                data = json.load(f)
                if isinstance(data, dict) and "samples" in data:
                    return data
                elif isinstance(data, list):
                    return {"samples": data}
            elif p.suffix == ".jsonl":
                samples = [json.loads(line) for line in f if line.strip()]
                return {"samples": samples}
        
        raise ValueError(f"不支持的文件格式: {p.suffix}")
    
    def _find_matches(self, samples: List[Dict[str, Any]], 
                      sensitive_ids: Set[str],
                      include_augment: bool) -> Set[str]:
        """查找匹配的样本"""
        matches = set()
        
        for s in samples:
            sample_id = s.get("id")
            original_id = s.get("original_id")
            
            if sample_id in sensitive_ids:
                matches.add(sample_id)
            elif include_augment and original_id and original_id in sensitive_ids:
                matches.add(sample_id)
        
        return matches
    
    def _find_affected_labels(self, labels: Dict[str, Any], 
                               matched_ids: Set[str]) -> Set[str]:
        """查找受影响的标签"""
        affected = set()
        for sample_id in matched_ids:
            if sample_id in labels:
                affected.add(sample_id)
        return affected
