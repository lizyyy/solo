import os
import json
from typing import List, Optional, Dict, Any
from datetime import datetime
from pathlib import Path

from models.case import Case, CaseStatus


class CaseStorage:
    """
    病例存储管理器
    负责病例的本地持久化存储和加载
    """
    
    def __init__(self, storage_dir: str = None):
        """
        初始化存储管理器
        
        Args:
            storage_dir: 存储目录路径，默认为用户主目录下的.anesth_review文件夹
        """
        if storage_dir is None:
            # 默认存储在用户主目录下
            home_dir = Path.home()
            storage_dir = home_dir / ".anesth_review" / "cases"
        
        self.storage_dir = Path(storage_dir)
        self.storage_dir.mkdir(parents=True, exist_ok=True)
        
        # 索引文件路径
        self.index_file = self.storage_dir.parent / "index.json"
        
        # 缓存已加载的病例
        self._cache: Dict[str, Case] = {}
    
    def save_case(self, case: Case) -> bool:
        """
        保存病例到本地存储
        
        Args:
            case: 要保存的病例对象
            
        Returns:
            是否保存成功
        """
        try:
            # 更新病例的修改时间
            case.update_timestamp()
            
            # 转换为字典
            case_dict = case.to_dict()
            
            # 生成文件名
            file_name = f"{case.case_id}.json"
            file_path = self.storage_dir / file_name
            
            # 保存到文件
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(case_dict, f, ensure_ascii=False, indent=2, default=str)
            
            # 更新缓存
            self._cache[case.case_id] = case
            
            # 更新索引
            self._update_index(case)
            
            return True
            
        except Exception as e:
            print(f"保存病例失败: {str(e)}")
            return False
    
    def load_case(self, case_id: str) -> Optional[Case]:
        """
        从本地存储加载病例
        
        Args:
            case_id: 病例ID
            
        Returns:
            病例对象，如果不存在则返回None
        """
        # 首先检查缓存
        if case_id in self._cache:
            return self._cache[case_id]
        
        try:
            file_name = f"{case_id}.json"
            file_path = self.storage_dir / file_name
            
            if not file_path.exists():
                return None
            
            # 读取文件
            with open(file_path, 'r', encoding='utf-8') as f:
                case_dict = json.load(f)
            
            # 转换为Case对象
            case = Case.from_dict(case_dict)
            
            # 更新缓存
            self._cache[case_id] = case
            
            return case
            
        except Exception as e:
            print(f"加载病例失败: {str(e)}")
            return None
    
    def delete_case(self, case_id: str) -> bool:
        """
        删除病例
        
        Args:
            case_id: 病例ID
            
        Returns:
            是否删除成功
        """
        try:
            # 从缓存移除
            if case_id in self._cache:
                del self._cache[case_id]
            
            # 删除文件
            file_name = f"{case_id}.json"
            file_path = self.storage_dir / file_name
            
            if file_path.exists():
                file_path.unlink()
            
            # 更新索引
            self._remove_from_index(case_id)
            
            return True
            
        except Exception as e:
            print(f"删除病例失败: {str(e)}")
            return False
    
    def list_cases(self) -> List[Dict[str, Any]]:
        """
        获取所有病例的列表（摘要信息）
        
        Returns:
            病例摘要列表
        """
        # 首先尝试从索引文件加载
        index = self._load_index()
        
        if index and "cases" in index:
            return index["cases"]
        
        # 如果索引不存在，扫描存储目录
        cases = []
        
        for file_path in self.storage_dir.glob("*.json"):
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    case_dict = json.load(f)
                
                # 提取摘要信息
                case_summary = {
                    "case_id": case_dict.get("case_id", ""),
                    "patient_name": case_dict.get("patient_name", ""),
                    "patient_id": case_dict.get("patient_id", ""),
                    "species": case_dict.get("species", ""),
                    "procedure": case_dict.get("procedure", ""),
                    "status": case_dict.get("status", ""),
                    "created_at": case_dict.get("created_at", ""),
                    "updated_at": case_dict.get("updated_at", ""),
                    "risk_summary": case_dict.get("risk_summary", {})
                }
                
                cases.append(case_summary)
                
            except Exception as e:
                print(f"读取病例文件失败: {str(e)}")
                continue
        
        # 按创建时间排序（最新的在前）
        cases.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        
        return cases
    
    def get_case_count(self) -> int:
        """
        获取病例总数
        
        Returns:
            病例数量
        """
        return len(list(self.storage_dir.glob("*.json")))
    
    def _update_index(self, case: Case):
        """
        更新病例索引
        
        Args:
            case: 病例对象
        """
        try:
            # 加载现有索引
            index = self._load_index()
            
            if index is None:
                index = {
                    "version": "1.0",
                    "updated_at": datetime.now().isoformat(),
                    "cases": []
                }
            
            # 创建病例摘要
            case_summary = {
                "case_id": case.case_id,
                "patient_name": case.patient_name or "",
                "patient_id": case.patient_id or "",
                "species": case.species or "",
                "procedure": case.procedure or "",
                "status": case.status.value if case.status else "",
                "created_at": case.created_at.isoformat() if case.created_at else "",
                "updated_at": case.updated_at.isoformat() if case.updated_at else "",
                "risk_summary": {
                    "total": len(case.risks),
                    "pending": len([r for r in case.risks if r.status.name == "PENDING"]),
                    "confirmed": len([r for r in case.risks if r.status.name == "CONFIRMED"]),
                    "dismissed": len([r for r in case.risks if r.status.name == "DISMISSED"])
                }
            }
            
            # 移除旧的条目
            index["cases"] = [c for c in index["cases"] if c["case_id"] != case.case_id]
            
            # 添加新条目
            index["cases"].append(case_summary)
            
            # 更新时间
            index["updated_at"] = datetime.now().isoformat()
            
            # 保存索引
            with open(self.index_file, 'w', encoding='utf-8') as f:
                json.dump(index, f, ensure_ascii=False, indent=2)
                
        except Exception as e:
            print(f"更新索引失败: {str(e)}")
    
    def _remove_from_index(self, case_id: str):
        """
        从索引中移除病例
        
        Args:
            case_id: 病例ID
        """
        try:
            index = self._load_index()
            
            if index and "cases" in index:
                index["cases"] = [c for c in index["cases"] if c["case_id"] != case_id]
                index["updated_at"] = datetime.now().isoformat()
                
                with open(self.index_file, 'w', encoding='utf-8') as f:
                    json.dump(index, f, ensure_ascii=False, indent=2)
                    
        except Exception as e:
            print(f"从索引移除病例失败: {str(e)}")
    
    def _load_index(self) -> Optional[Dict]:
        """
        加载索引文件
        
        Returns:
            索引数据，如果不存在则返回None
        """
        if not self.index_file.exists():
            return None
        
        try:
            with open(self.index_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"加载索引失败: {str(e)}")
            return None
    
    def clear_cache(self):
        """
        清除内存缓存
        """
        self._cache.clear()
    
    def get_storage_path(self) -> str:
        """
        获取存储目录路径
        
        Returns:
            存储目录的绝对路径
        """
        return str(self.storage_dir.absolute())
    
    def export_case(self, case_id: str, export_path: str) -> bool:
        """
        导出病例到指定路径
        
        Args:
            case_id: 病例ID
            export_path: 导出路径
            
        Returns:
            是否导出成功
        """
        case = self.load_case(case_id)
        
        if case is None:
            return False
        
        try:
            export_path = Path(export_path)
            export_path.parent.mkdir(parents=True, exist_ok=True)
            
            case_dict = case.to_dict()
            
            with open(export_path, 'w', encoding='utf-8') as f:
                json.dump(case_dict, f, ensure_ascii=False, indent=2, default=str)
            
            return True
            
        except Exception as e:
            print(f"导出病例失败: {str(e)}")
            return False
    
    def import_case(self, import_path: str) -> Optional[Case]:
        """
        从外部文件导入病例
        
        Args:
            import_path: 导入文件路径
            
        Returns:
            导入的病例对象，如果失败则返回None
        """
        try:
            import_path = Path(import_path)
            
            if not import_path.exists():
                return None
            
            with open(import_path, 'r', encoding='utf-8') as f:
                case_dict = json.load(f)
            
            case = Case.from_dict(case_dict)
            
            # 保存到本地存储
            if self.save_case(case):
                return case
            
            return None
            
        except Exception as e:
            print(f"导入病例失败: {str(e)}")
            return None
