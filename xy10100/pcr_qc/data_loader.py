import pandas as pd
import numpy as np
from pathlib import Path
from typing import Dict, List, Tuple, Optional, Any
from dataclasses import dataclass, field
from enum import Enum


class SampleType(Enum):
    UNKNOWN = "unknown"
    SAMPLE = "sample"
    POSITIVE_CONTROL = "positive_control"
    NEGATIVE_CONTROL = "negative_control"
    BLANK = "blank"
    STANDARD = "standard"


@dataclass
class DataValidationIssue:
    row_index: int
    issue_type: str
    column: Optional[str]
    message: str
    sample_id: Optional[str] = None
    severity: str = "warning"


@dataclass
class LoadedData:
    raw_data: pd.DataFrame
    cleaned_data: pd.DataFrame
    metadata: Dict[str, Any]
    issues: List[DataValidationIssue] = field(default_factory=list)
    failed_samples: pd.DataFrame = field(default_factory=pd.DataFrame)
    processing_log: List[str] = field(default_factory=list)


class DataLoader:
    REQUIRED_COLUMNS = {
        "sample_id": ["sample_id", "sample", "样本编号", "样品号"],
        "well": ["well", "well_position", "孔位", "板位"],
        "ct_value": ["ct", "ct_value", "ct值", "cq", "cq_value", "cq值"],
        "sample_type": ["sample_type", "type", "类型", "样品类型"],
    }

    UNIT_COLUMNS = [
        "unit", "units", "单位", "浓度单位", "浓度"
    ]

    CONCENTRATION_COLUMNS = [
        "concentration", "conc", "浓度", "拷贝数", "copies", "copy_number"
    ]

    UNIT_CONVERSIONS = {
        "copy/μl": 1.0,
        "copy/ml": 0.001,
        "cfu/μl": 1.0,
        "cfu/ml": 0.001,
        "copies/μl": 1.0,
        "copies/ml": 0.001,
        "拷贝/μl": 1.0,
        "拷贝/ml": 0.001,
        "cfu": 1.0,
        "copy": 1.0,
        "copies": 1.0,
        "拷贝": 1.0,
    }

    TARGET_UNIT = "copy/μl"

    SAMPLE_TYPE_MAPPINGS = {
        SampleType.POSITIVE_CONTROL: [
            "positive", "pc", "阳性对照", "阳性", "pcontrol", "p_ctrl"
        ],
        SampleType.NEGATIVE_CONTROL: [
            "negative", "nc", "阴性对照", "阴性", "ncontrol", "n_ctrl"
        ],
        SampleType.BLANK: [
            "blank", "空白", "水对照", "ntc", "no_template"
        ],
        SampleType.STANDARD: [
            "standard", "std", "标准品", "梯度", "calibrator"
        ],
    }

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}
        self._validation_issues: List[DataValidationIssue] = []
        self._log: List[str] = []

    def load(self, file_path: str) -> LoadedData:
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"文件不存在: {file_path}")

        self._log.append(f"开始加载文件: {path.name}")

        raw_data = self._read_file(path)
        self._log.append(f"原始数据: {len(raw_data)} 行, {len(raw_data.columns)} 列")

        normalized_data = self._normalize_columns(raw_data)
        self._log.append(f"列名标准化完成")

        cleaned_data, failed_samples = self._clean_data(normalized_data)
        self._log.append(f"清洗后数据: {len(cleaned_data)} 行有效, {len(failed_samples)} 行失败")

        metadata = self._extract_metadata(path)

        return LoadedData(
            raw_data=raw_data,
            cleaned_data=cleaned_data,
            metadata=metadata,
            issues=self._validation_issues.copy(),
            failed_samples=failed_samples,
            processing_log=self._log.copy(),
        )

    def _read_file(self, path: Path) -> pd.DataFrame:
        suffix = path.suffix.lower()
        
        if suffix in ['.xlsx', '.xls']:
            return pd.read_excel(path)
        elif suffix == '.csv':
            return pd.read_csv(path)
        elif suffix == '.txt':
            return pd.read_csv(path, sep='\t')
        else:
            raise ValueError(f"不支持的文件格式: {suffix}")

    def _normalize_columns(self, df: pd.DataFrame) -> pd.DataFrame:
        column_mapping = {}
        
        for standard_name, aliases in self.REQUIRED_COLUMNS.items():
            for col in df.columns:
                col_lower = str(col).lower()
                if col_lower in [a.lower() for a in aliases]:
                    column_mapping[col] = standard_name
                    break

        result = df.rename(columns=column_mapping)
        
        for std_name in self.REQUIRED_COLUMNS.keys():
            if std_name not in result.columns:
                self._add_issue(
                    issue_type="missing_column",
                    column=std_name,
                    message=f"缺少必需列: {std_name}，可能影响后续分析",
                    severity="warning"
                )

        return result

    def _clean_data(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, pd.DataFrame]:
        df = df.copy()
        issues_idx = []
        
        df['original_ct_value'] = df['ct_value'].copy() if 'ct_value' in df.columns else None
        df['original_unit'] = None
        df['normalized_concentration'] = None
        
        unit_col = self._find_unit_column(df)
        if unit_col:
            self._log.append(f"检测到单位列: {unit_col}")
            df['original_unit'] = df[unit_col].astype(str)
            
            conc_col = self._find_concentration_column(df)
            if conc_col:
                self._log.append(f"检测到浓度列: {conc_col}")
                df['normalized_concentration'] = self._normalize_concentration(
                    df[conc_col], df[unit_col], issues_idx
                )
        
        if 'sample_id' in df.columns:
            df['sample_id'] = df['sample_id'].astype(str)
            duplicates = df[df['sample_id'].duplicated(keep=False)]
            for idx, row in duplicates.iterrows():
                if idx not in issues_idx:
                    self._add_issue(
                        row_index=idx,
                        issue_type="duplicate",
                        column="sample_id",
                        message=f"重复的样本ID: {row['sample_id']}",
                        sample_id=row['sample_id'],
                        severity="error"
                    )
                    issues_idx.append(idx)

        if 'ct_value' in df.columns:
            df['ct_value'] = df['ct_value'].apply(self._parse_ct_value)
            
            for idx, row in df.iterrows():
                if pd.isna(row['ct_value']):
                    self._add_issue(
                        row_index=idx,
                        issue_type="missing_value",
                        column="ct_value",
                        message="Ct值缺失或无法解析",
                        sample_id=row.get('sample_id'),
                        severity="warning"
                    )

        if 'sample_type' in df.columns:
            df['sample_type_original'] = df['sample_type'].copy()
            df['sample_type'] = df['sample_type'].apply(self._normalize_sample_type)

        failed_mask = df.index.isin(issues_idx)
        failed_samples = df[failed_mask].copy()
        cleaned_data = df[~failed_mask].copy()

        return cleaned_data, failed_samples

    def _find_unit_column(self, df: pd.DataFrame) -> Optional[str]:
        for col in df.columns:
            col_lower = str(col).lower()
            if col_lower in [u.lower() for u in self.UNIT_COLUMNS]:
                return col
        return None

    def _find_concentration_column(self, df: pd.DataFrame) -> Optional[str]:
        for col in df.columns:
            col_lower = str(col).lower()
            if col_lower in [c.lower() for c in self.CONCENTRATION_COLUMNS]:
                return col
        return None

    def _normalize_concentration(self, values: pd.Series, units: pd.Series, 
                                 issues_idx: List[int]) -> pd.Series:
        normalized = pd.Series([None] * len(values), index=values.index)
        
        for idx, (value, unit) in enumerate(zip(values, units)):
            if pd.isna(value) or pd.isna(unit):
                continue
            
            unit_str = str(unit).lower().strip()
            
            conversion_factor = None
            for known_unit, factor in self.UNIT_CONVERSIONS.items():
                if known_unit.lower() in unit_str:
                    conversion_factor = factor
                    break
            
            if conversion_factor is None:
                self._add_issue(
                    row_index=idx,
                    issue_type="unknown_unit",
                    column="unit",
                    message=f"无法识别的单位: {unit}，跳过浓度换算",
                    sample_id=values.index[idx] if hasattr(values.index, '__getitem__') else None,
                    severity="warning"
                )
                continue
            
            try:
                num_value = float(value)
                normalized.iloc[idx] = num_value * conversion_factor
                self._log.append(
                    f"浓度换算: {num_value} {unit_str} -> {normalized.iloc[idx]:.2e} {self.TARGET_UNIT}"
                )
            except (ValueError, TypeError):
                self._add_issue(
                    row_index=idx,
                    issue_type="invalid_concentration",
                    column="concentration",
                    message=f"无法解析浓度值: {value}",
                    severity="warning"
                )
        
        return normalized

    def _parse_ct_value(self, value) -> Optional[float]:
        if pd.isna(value):
            return None
        
        if isinstance(value, (int, float)):
            return float(value)
        
        value_str = str(value).strip()
        
        if value_str.lower() in ['undetermined', 'und', 'nd', 'undetected', '未检出', '']:
            return None
        
        try:
            return float(value_str)
        except ValueError:
            return None

    def _normalize_sample_type(self, value) -> SampleType:
        if pd.isna(value):
            return SampleType.UNKNOWN
        
        value_str = str(value).lower().strip()
        
        for sample_type, keywords in self.SAMPLE_TYPE_MAPPINGS.items():
            if any(keyword.lower() in value_str for keyword in keywords):
                return sample_type
        
        return SampleType.SAMPLE

    def _add_issue(self, **kwargs):
        self._validation_issues.append(DataValidationIssue(**kwargs))

    def _extract_metadata(self, path: Path) -> Dict[str, Any]:
        return {
            "filename": path.name,
            "filepath": str(path),
            "file_size": path.stat().st_size,
            "load_time": pd.Timestamp.now().isoformat(),
        }
