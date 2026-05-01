# -*- coding: utf-8 -*-
"""
CSV解析模块
负责解析样品清单CSV和滴定读数CSV
"""

import csv
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from datetime import datetime


@dataclass
class SampleInfo:
    """样品基本信息"""
    sample_id: str
    sampling_point: str = ""
    bottle_number: str = ""
    temperature_c: Optional[float] = None
    dilution_factor: float = 1.0
    is_blank: bool = False
    is_duplicate: bool = False
    parent_sample_id: Optional[str] = None
    notes: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class TitrationReading:
    """单次滴定读数"""
    volume_ml: float
    ph: float


@dataclass
class SampleTitrationData:
    """单个样品的完整滴定数据"""
    sample_id: str
    readings: List[TitrationReading] = field(default_factory=list)
    analyst: str = ""
    titration_date: Optional[datetime] = None
    notes: str = ""


class SampleCSVParser:
    """样品清单CSV解析器"""

    REQUIRED_COLUMNS = ["sample_id"]
    OPTIONAL_COLUMNS = [
        "sampling_point", "bottle_number", "temperature_c", "dilution_factor",
        "is_blank", "is_duplicate", "parent_sample_id", "notes"
    ]

    def __init__(self):
        self.warnings: List[str] = []
        self.errors: List[str] = []

    def parse(self, file_path: Path) -> List[SampleInfo]:
        """
        解析样品清单CSV
        
        Args:
            file_path: CSV文件路径
            
        Returns:
            样品信息列表
            
        Raises:
            FileNotFoundError: 文件不存在
            ValueError: CSV格式错误
        """
        self.warnings = []
        self.errors = []

        if not file_path.exists():
            raise FileNotFoundError(f"样品CSV文件不存在: {file_path}")

        samples: List[SampleInfo] = []
        sample_ids = set()

        with open(file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            
            # 检查必填列
            missing_columns = [col for col in self.REQUIRED_COLUMNS if col not in reader.fieldnames]
            if missing_columns:
                raise ValueError(
                    f"样品CSV缺少必填列: {', '.join(missing_columns)}\n"
                    f"必填列: {', '.join(self.REQUIRED_COLUMNS)}"
                )

            for row_num, row in enumerate(reader, start=2):
                sample_id = str(row["sample_id"]).strip()
                
                if not sample_id:
                    self.errors.append(f"第 {row_num} 行: sample_id 为空")
                    continue
                
                if sample_id in sample_ids:
                    self.errors.append(f"第 {row_num} 行: 重复的 sample_id '{sample_id}'")
                    continue
                
                sample_ids.add(sample_id)

                try:
                    sample = self._parse_row(row, row_num)
                    samples.append(sample)
                except ValueError as e:
                    self.errors.append(f"第 {row_num} 行: {str(e)}")

        if self.errors:
            raise ValueError(f"解析样品CSV时发现错误:\n" + "\n".join(self.errors))

        return samples

    def _parse_row(self, row: Dict[str, str], row_num: int) -> SampleInfo:
        """解析单行数据"""
        sample_id = str(row["sample_id"]).strip()
        
        # 解析温度
        temperature_c = None
        temp_str = row.get("temperature_c", "").strip()
        if temp_str:
            try:
                temperature_c = float(temp_str)
            except ValueError:
                self.warnings.append(f"第 {row_num} 行: 温度 '{temp_str}' 格式无效，将使用 None")
        
        # 解析稀释倍数
        dilution_factor = 1.0
        df_str = row.get("dilution_factor", "").strip()
        if df_str:
            try:
                dilution_factor = float(df_str)
                if dilution_factor <= 0:
                    self.warnings.append(f"第 {row_num} 行: 稀释倍数必须大于0，将使用 1.0")
                    dilution_factor = 1.0
            except ValueError:
                self.warnings.append(f"第 {row_num} 行: 稀释倍数 '{df_str}' 格式无效，将使用 1.0")
        
        # 解析是否为空白样
        is_blank = False
        blank_str = row.get("is_blank", "").strip().lower()
        if blank_str in ["yes", "y", "true", "1", "是"]:
            is_blank = True
        
        # 解析是否为平行样
        is_duplicate = False
        dup_str = row.get("is_duplicate", "").strip().lower()
        if dup_str in ["yes", "y", "true", "1", "是"]:
            is_duplicate = True
        
        # 解析平行样对应的原始样品ID
        parent_sample_id = row.get("parent_sample_id", "").strip() or None
        
        # 其他字段
        sampling_point = row.get("sampling_point", "").strip()
        bottle_number = row.get("bottle_number", "").strip()
        notes = row.get("notes", "").strip()

        return SampleInfo(
            sample_id=sample_id,
            sampling_point=sampling_point,
            bottle_number=bottle_number,
            temperature_c=temperature_c,
            dilution_factor=dilution_factor,
            is_blank=is_blank,
            is_duplicate=is_duplicate,
            parent_sample_id=parent_sample_id,
            notes=notes
        )


class TitrationCSVParser:
    """滴定读数CSV解析器"""

    def __init__(self):
        self.warnings: List[str] = []
        self.errors: List[str] = []

    def parse(self, file_path: Path) -> Dict[str, SampleTitrationData]:
        """
        解析滴定读数CSV
        
        支持两种格式：
        1. 长格式：每行一个读数 (sample_id, volume_ml, ph, ...)
        2. 宽格式：每个样品多行，按sample_id分组
        
        Args:
            file_path: CSV文件路径
            
        Returns:
            以sample_id为键的滴定数据字典
            
        Raises:
            FileNotFoundError: 文件不存在
            ValueError: CSV格式错误
        """
        self.warnings = []
        self.errors = []

        if not file_path.exists():
            raise FileNotFoundError(f"滴定CSV文件不存在: {file_path}")

        all_readings: List[Tuple[str, float, float, Dict[str, Any]]] = []

        with open(file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            fieldnames = [fn.strip() for fn in reader.fieldnames] if reader.fieldnames else []
            
            # 检查必填列
            if "sample_id" not in fieldnames:
                raise ValueError("滴定CSV必须包含 'sample_id' 列")
            if "volume_ml" not in fieldnames and "volume" not in fieldnames:
                raise ValueError("滴定CSV必须包含 'volume_ml' 或 'volume' 列")
            if "ph" not in fieldnames:
                raise ValueError("滴定CSV必须包含 'ph' 列")

            volume_col = "volume_ml" if "volume_ml" in fieldnames else "volume"

            for row_num, row in enumerate(reader, start=2):
                sample_id = str(row.get("sample_id", "")).strip()
                
                if not sample_id:
                    self.errors.append(f"第 {row_num} 行: sample_id 为空")
                    continue

                try:
                    volume_str = str(row.get(volume_col, "")).strip()
                    ph_str = str(row.get("ph", "")).strip()
                    
                    if not volume_str or not ph_str:
                        self.warnings.append(f"第 {row_num} 行: 体积或pH为空，跳过")
                        continue
                    
                    volume_ml = float(volume_str)
                    ph = float(ph_str)
                    
                    # 收集额外元数据
                    metadata = {}
                    for key, value in row.items():
                        if key not in ["sample_id", volume_col, "ph", "volume_ml", "volume"]:
                            if value and str(value).strip():
                                metadata[key] = value
                    
                    all_readings.append((sample_id, volume_ml, ph, metadata))
                    
                except ValueError as e:
                    self.errors.append(f"第 {row_num} 行: 数值解析错误 - {str(e)}")

        if self.errors:
            raise ValueError(f"解析滴定CSV时发现错误:\n" + "\n".join(self.errors))

        # 按sample_id分组
        result: Dict[str, SampleTitrationData] = {}
        
        for sample_id, volume_ml, ph, metadata in all_readings:
            if sample_id not in result:
                result[sample_id] = SampleTitrationData(
                    sample_id=sample_id,
                    readings=[]
                )
            
            result[sample_id].readings.append(TitrationReading(
                volume_ml=volume_ml,
                ph=ph
            ))
            
            # 从元数据中提取分析员和日期（如果有）
            if "analyst" in metadata:
                result[sample_id].analyst = metadata["analyst"]
            if "date" in metadata or "titration_date" in metadata:
                date_str = metadata.get("date") or metadata.get("titration_date")
                try:
                    result[sample_id].titration_date = datetime.fromisoformat(str(date_str))
                except ValueError:
                    pass

        # 对每个样品的读数按体积排序
        for sample_data in result.values():
            sample_data.readings.sort(key=lambda r: r.volume_ml)

        # 检查空读数
        empty_samples = [sid for sid, data in result.items() if len(data.readings) == 0]
        for sid in empty_samples:
            self.warnings.append(f"样品 '{sid}' 没有有效读数")

        return result

    def get_warnings(self) -> List[str]:
        """获取解析警告"""
        return self.warnings.copy()
