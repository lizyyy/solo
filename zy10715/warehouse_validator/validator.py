"""仓库冻结快照库存释放校验核心逻辑"""

import pandas as pd
from pathlib import Path
import logging
from dataclasses import dataclass, field
from typing import Dict, List, Tuple, Optional

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class ValidationResult:
    """校验结果数据类"""
    releasable_batches: pd.DataFrame = field(default_factory=pd.DataFrame)
    unreleasable_batches: pd.DataFrame = field(default_factory=pd.DataFrame)
    split_batches: pd.DataFrame = field(default_factory=pd.DataFrame)
    negative_inventory: pd.DataFrame = field(default_factory=pd.DataFrame)
    in_transit_occupied: pd.DataFrame = field(default_factory=pd.DataFrame)
    bad_rows: pd.DataFrame = field(default_factory=pd.DataFrame)
    statistics: Dict = field(default_factory=dict)


class WarehouseSnapshotValidator:
    """仓库冻结快照库存释放校验器"""

    REQUIRED_COLUMNS = [
        '仓库编号', '仓库名称', '商品编码', '商品名称', 
        '批次号', '库存数量', '冻结数量', '在途数量',
        '占用数量', '库龄天数', '入库日期', '状态'
    ]

    def __init__(self, rules_file: Optional[str] = None):
        self.rules = self._load_rules(rules_file)

    def _load_rules(self, rules_file: Optional[str]) -> Dict:
        """加载规则文件"""
        default_rules = {
            'min_release_qty': 1,
            'max_age_days': 180,
            'allow_negative': False,
            'exclude_status': ['报废', '待检'],
        }
        
        if rules_file and Path(rules_file).exists():
            try:
                import json
                with open(rules_file, 'r', encoding='utf-8') as f:
                    custom_rules = json.load(f)
                    default_rules.update(custom_rules)
                logger.info(f"已加载规则文件: {rules_file}")
            except Exception as e:
                logger.warning(f"加载规则文件失败，使用默认规则: {e}")
        
        return default_rules

    def validate(self, input_file: str) -> ValidationResult:
        """执行校验"""
        logger.info(f"开始校验文件: {input_file}")
        
        result = ValidationResult()
        
        try:
            df = self._read_input_file(input_file)
        except Exception as e:
            logger.error(f"读取文件失败: {e}")
            raise

        df, bad_rows = self._clean_data(df)
        result.bad_rows = bad_rows

        result.negative_inventory = self._find_negative_inventory(df)
        result.in_transit_occupied = self._find_in_transit_occupied(df)
        result.split_batches = self._find_split_batches(df)
        
        releasable, unreleasable = self._classify_batches(df)
        result.releasable_batches = releasable
        result.unreleasable_batches = unreleasable
        
        result.statistics = self._calculate_statistics(result)
        
        return result

    def _read_input_file(self, input_file: str) -> pd.DataFrame:
        """读取输入文件，支持CSV和Excel"""
        path = Path(input_file)
        if not path.exists():
            raise FileNotFoundError(f"文件不存在: {input_file}")

        if path.suffix.lower() in ['.xlsx', '.xls']:
            df = pd.read_excel(path, dtype={'批次号': str, '商品编码': str})
        elif path.suffix.lower() == '.csv':
            df = pd.read_csv(path, dtype={'批次号': str, '商品编码': str}, encoding='utf-8-sig')
        else:
            raise ValueError(f"不支持的文件格式: {path.suffix}")

        logger.info(f"读取到 {len(df)} 行数据")
        return df

    def _clean_data(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, pd.DataFrame]:
        """数据清洗，分离坏行"""
        bad_rows = pd.DataFrame()
        good_rows = []

        for idx, row in df.iterrows():
            is_bad = False
            bad_reasons = []

            for col in self.REQUIRED_COLUMNS:
                if col not in df.columns or pd.isna(row.get(col)):
                    is_bad = True
                    bad_reasons.append(f"缺少{col}")

            try:
                qty = float(row.get('库存数量', 0))
                if pd.isna(qty):
                    is_bad = True
                    bad_reasons.append("库存数量无效")
            except (ValueError, TypeError):
                is_bad = True
                bad_reasons.append("库存数量格式错误")

            if is_bad:
                bad_row = row.copy()
                bad_row['行号'] = idx + 2
                bad_row['异常原因'] = '; '.join(bad_reasons)
                bad_rows = pd.concat([bad_rows, pd.DataFrame([bad_row])], ignore_index=True)
            else:
                good_rows.append(row)

        good_df = pd.DataFrame(good_rows) if good_rows else pd.DataFrame(columns=df.columns)
        
        logger.info(f"数据清洗完成: 有效数据 {len(good_df)} 行, 异常数据 {len(bad_rows)} 行")
        return good_df, bad_rows

    def _find_negative_inventory(self, df: pd.DataFrame) -> pd.DataFrame:
        """查找负库存"""
        if df.empty:
            return pd.DataFrame()
        
        negative = df[df['库存数量'].astype(float) < 0].copy()
        if not negative.empty:
            negative['异常类型'] = '负库存'
            logger.info(f"发现负库存批次: {len(negative)} 条")
        return negative

    def _find_in_transit_occupied(self, df: pd.DataFrame) -> pd.DataFrame:
        """查找在途占用"""
        if df.empty:
            return pd.DataFrame()
        
        in_transit = df[(df['在途数量'].astype(float) > 0) | (df['占用数量'].astype(float) > 0)].copy()
        if not in_transit.empty:
            in_transit['异常类型'] = '在途/占用'
            logger.info(f"发现在途占用批次: {len(in_transit)} 条")
        return in_transit

    def _find_split_batches(self, df: pd.DataFrame) -> pd.DataFrame:
        """查找拆分批次（同一商品同一批次号出现在多行）"""
        if df.empty:
            return pd.DataFrame()
        
        batch_counts = df.groupby(['商品编码', '批次号']).size().reset_index(name='行数')
        split_batch_keys = batch_counts[batch_counts['行数'] > 1]
        
        if not split_batch_keys.empty:
            split = pd.merge(df, split_batch_keys, on=['商品编码', '批次号'], how='inner')
            split['异常类型'] = '批次拆分'
            logger.info(f"发现拆分批次: {len(split)} 行, 涉及 {len(split_batch_keys)} 个批次")
            return split
        return pd.DataFrame()

    def _classify_batches(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, pd.DataFrame]:
        """分类可释放和不可释放批次"""
        if df.empty:
            return pd.DataFrame(), pd.DataFrame()

        exclude_status = self.rules['exclude_status']
        max_age_days = self.rules['max_age_days']

        df = df.copy()
        df['可释放原因'] = ''
        df['不可释放原因'] = ''

        unreleasable_conditions = []

        if exclude_status:
            status_mask = df['状态'].isin(exclude_status)
            unreleasable_conditions.append(status_mask)
            df.loc[status_mask, '不可释放原因'] += '状态禁止;'

        age_mask = df['库龄天数'].astype(float) > max_age_days
        unreleasable_conditions.append(age_mask)
        df.loc[age_mask, '不可释放原因'] += '库龄超限;'

        frozen_mask = df['冻结数量'].astype(float) > 0
        unreleasable_conditions.append(frozen_mask)
        df.loc[frozen_mask, '不可释放原因'] += '存在冻结;'

        negative_mask = df['库存数量'].astype(float) < 0
        unreleasable_conditions.append(negative_mask)
        df.loc[negative_mask, '不可释放原因'] += '负库存;'

        in_transit_mask = (df['在途数量'].astype(float) > 0) | (df['占用数量'].astype(float) > 0)
        unreleasable_conditions.append(in_transit_mask)
        df.loc[in_transit_mask, '不可释放原因'] += '在途/占用;'

        unreleasable_mask = pd.concat(unreleasable_conditions, axis=1).any(axis=1)
        releasable_mask = ~unreleasable_mask

        releasable = df[releasable_mask].copy()
        unreleasable = df[unreleasable_mask].copy()

        releasable['校验结果'] = '可释放'
        unreleasable['校验结果'] = '不可释放'

        logger.info(f"分类完成: 可释放 {len(releasable)} 条, 不可释放 {len(unreleasable)} 条")
        return releasable, unreleasable

    def _calculate_statistics(self, result: ValidationResult) -> Dict:
        """计算统计数据"""
        return {
            '总记录数': len(result.releasable_batches) + len(result.unreleasable_batches) + len(result.bad_rows),
            '有效记录数': len(result.releasable_batches) + len(result.unreleasable_batches),
            '异常记录数': len(result.bad_rows),
            '可释放批次数量': len(result.releasable_batches),
            '可释放库存总数': result.releasable_batches['库存数量'].sum() if not result.releasable_batches.empty else 0,
            '不可释放批次数量': len(result.unreleasable_batches),
            '不可释放库存总数': result.unreleasable_batches['库存数量'].sum() if not result.unreleasable_batches.empty else 0,
            '负库存批次数量': len(result.negative_inventory),
            '在途占用批次数量': len(result.in_transit_occupied),
            '拆分批次涉及行数': len(result.split_batches),
        }
