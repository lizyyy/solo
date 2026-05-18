import logging
import sys
from pathlib import Path
from typing import List, Dict, Any
import pandas as pd

logger = logging.getLogger(__name__)


class MaterialStatsProcessor:
    def __init__(self, rules_path: Path, verbose: bool = False):
        self.rules_path = rules_path
        self.verbose = verbose
        self.class_rename_rules = {}
        self.set_split_rules = {}
        self.required_columns = ["班级", "画材名称", "缺料数量", "学生姓名", "申请日期"]
        
        if verbose:
            logger.setLevel(logging.DEBUG)
            if not logger.handlers:
                handler = logging.StreamHandler(sys.stdout)
                handler.setLevel(logging.DEBUG)
                logger.addHandler(handler)
        
        self.load_rules()
        
        self.stats = {
            "total_records": 0,
            "class_renamed": 0,
            "set_split": 0,
            "format_errors": 0,
            "normal_records": 0
        }
        self.errors = []
    
    def load_rules(self):
        """加载规则文件"""
        try:
            xls = pd.ExcelFile(self.rules_path)
            
            if "班级改名" in xls.sheet_names:
                df_rename = pd.read_excel(xls, sheet_name="班级改名")
                for _, row in df_rename.iterrows():
                    original = str(row["原班级名称"]).strip()
                    new = str(row["新班级名称"]).strip()
                    self.class_rename_rules[original] = new
                logger.debug(f"加载 {len(self.class_rename_rules)} 条班级改名规则")
            
            if "套装拆分" in xls.sheet_names:
                df_split = pd.read_excel(xls, sheet_name="套装拆分")
                for _, row in df_split.iterrows():
                    set_name = str(row["套装名称"]).strip()
                    materials = str(row["包含画材"]).strip().split(";")
                    quantities = str(row["拆分数量"]).strip().split(";")
                    self.set_split_rules[set_name] = list(zip(materials, quantities))
                logger.debug(f"加载 {len(self.set_split_rules)} 条套装拆分规则")
            
            logger.info(f"规则加载完成: {len(self.class_rename_rules)} 条班级改名, {len(self.set_split_rules)} 条套装拆分")
            
        except Exception as e:
            logger.error(f"加载规则文件失败: {str(e)}")
            raise
    
    def process_file(self, file_path: Path) -> List[Dict[str, Any]]:
        """处理单个文件"""
        results = []
        
        try:
            df = pd.read_excel(file_path)
            
            for _, row in df.iterrows():
                processed_records = self.process_row(row, file_path.name)
                results.extend(processed_records)
            
        except Exception as e:
            logger.error(f"读取文件失败 {file_path.name}: {str(e)}")
            raise
        
        return results
    
    def process_row(self, row: pd.Series, source_file: str) -> List[Dict[str, Any]]:
        """处理单行记录"""
        self.stats["total_records"] += 1
        results = []
        record_type = "normal"
        error_messages = []
        
        record = {
            "班级": str(row.get("班级", "")).strip(),
            "画材名称": str(row.get("画材名称", "")).strip(),
            "缺料数量": str(row.get("缺料数量", "")).strip(),
            "学生姓名": str(row.get("学生姓名", "")).strip(),
            "申请日期": str(row.get("申请日期", "")).strip(),
            "来源文件": source_file,
            "处理类型": "",
            "备注": ""
        }
        
        for col in self.required_columns:
            if not record.get(col) or record.get(col) == "nan":
                record_type = "format_error"
                error_messages.append(f"{col}为空")
        
        try:
            qty = float(record["缺料数量"]) if record["缺料数量"] else 0
            if qty <= 0:
                record_type = "format_error"
                error_messages.append("缺料数量必须大于0")
        except ValueError:
            record_type = "format_error"
            error_messages.append("缺料数量不是有效数字")
        
        if record_type == "format_error":
            self.stats["format_errors"] += 1
            record["处理类型"] = "格式错误"
            record["备注"] = "; ".join(error_messages)
            self.errors.append(record)
            
            if self.verbose:
                logger.debug(f"  [格式错误] {record['学生姓名']} - {record['画材名称']}: {record['备注']}")
            
            return [record]
        
        original_class = record["班级"]
        if original_class in self.class_rename_rules:
            record["班级"] = self.class_rename_rules[original_class]
            record["处理类型"] = "班级改名"
            record["备注"] = f"{original_class} -> {record['班级']}"
            self.stats["class_renamed"] += 1
            record_type = "class_renamed"
            
            if self.verbose:
                logger.debug(f"  [班级改名] {original_class} -> {record['班级']}")
        
        material_name = record["画材名称"]
        if material_name in self.set_split_rules:
            record_type = "set_split"
            base_record = record.copy()
            
            for idx, (mat_name, mat_qty) in enumerate(self.set_split_rules[material_name]):
                split_record = base_record.copy()
                split_record["画材名称"] = mat_name
                split_record["缺料数量"] = str(int(float(mat_qty)) * int(float(base_record["缺料数量"])))
                split_record["处理类型"] = "套装拆分"
                split_record["备注"] = f"从[{material_name}]拆分 (第{idx + 1}项)"
                results.append(split_record)
                
                if self.verbose:
                    logger.debug(f"  [套装拆分] {material_name} -> {mat_name} x {split_record['缺料数量']}")
            
            self.stats["set_split"] += 1
            return results
        
        if record_type == "normal":
            self.stats["normal_records"] += 1
            record["处理类型"] = "正常"
            if self.verbose:
                logger.debug(f"  [正常] {record['学生姓名']} - {record['画材名称']}")
        
        results.append(record)
        return results
    
    def get_statistics(self) -> Dict[str, int]:
        """获取统计数据"""
        return self.stats.copy()
