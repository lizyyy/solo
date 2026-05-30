"""
数据导入模块
支持多版本、多格式导入，保留历史数据，避免覆盖
"""
import os
import json
import yaml
from typing import List, Dict, Any, Optional, Tuple, TypeVar, Generic, Callable
from dataclasses import dataclass
import pandas as pd
from datetime import datetime

from .exceptions import DataImportError, ErrorLocation, create_error_location
from .models import (
    DataSource,
    DataSourceType,
    DropConfig,
    PlayerLog,
    ItemPool,
    ActivityPeriod,
    ComplaintRecord,
)
from .utils import (
    parse_datetime,
    parse_float,
    parse_int,
    parse_bool,
    safe_str,
)


T = TypeVar("T")


@dataclass
class ImportResult(Generic[T]):
    """导入结果"""
    data_source: DataSource
    records: List[T]
    errors: List[DataImportError]
    skipped_rows: List[Dict[str, Any]]


class DataImporter:
    """
    数据导入器
    支持多种格式导入，保留所有历史版本，不覆盖旧数据
    """

    # 列名映射，支持多种命名方式
    COLUMN_MAPPINGS: Dict[DataSourceType, Dict[str, List[str]]] = {
        DataSourceType.DROP_CONFIG: {
            "pool_id": ["pool_id", "poolid", "道具池ID", "池子ID", "掉落池ID"],
            "item_id": ["item_id", "itemid", "道具ID", "物品ID"],
            "item_name": ["item_name", "itemname", "道具名", "道具名称", "物品名", "物品名称"],
            "probability": ["probability", "prob", "概率", "掉落概率", "配置概率", "rate"],
            "weight": ["weight", "权重", "掉落权重"],
            "min_count": ["min_count", "mincount", "最少数量", "最小数量"],
            "max_count": ["max_count", "maxcount", "最多数量", "最大数量"],
            "effective_time": ["effective_time", "effectivetime", "生效时间", "开始时间"],
            "expire_time": ["expire_time", "expiretime", "失效时间", "结束时间"],
            "is_enabled": ["is_enabled", "enabled", "是否启用", "启用"],
            "config_version": ["config_version", "version", "版本", "配置版本"],
        },
        DataSourceType.PLAYER_LOG: {
            "player_id": ["player_id", "playerid", "玩家ID", "用户ID"],
            "pool_id": ["pool_id", "poolid", "道具池ID", "池子ID", "掉落池ID"],
            "item_id": ["item_id", "itemid", "道具ID", "物品ID"],
            "item_name": ["item_name", "itemname", "道具名", "道具名称", "物品名", "物品名称"],
            "drop_count": ["drop_count", "count", "数量", "掉落数量"],
            "drop_time": ["drop_time", "time", "timestamp", "时间", "掉落时间", "时间戳"],
            "server_id": ["server_id", "serverid", "服务器ID", "服ID", "区服"],
            "channel": ["channel", "渠道", "平台"],
        },
        DataSourceType.ITEM_POOL: {
            "pool_id": ["pool_id", "poolid", "道具池ID", "池子ID", "掉落池ID"],
            "pool_name": ["pool_name", "poolname", "池子名称", "道具池名称", "池名"],
            "description": ["description", "desc", "描述", "说明"],
            "pool_type": ["pool_type", "type", "类型", "池子类型"],
            "is_active": ["is_active", "active", "是否激活", "激活"],
            "total_weight": ["total_weight", "totalweight", "总权重"],
            "item_count": ["item_count", "itemcount", "道具数量", "物品数量"],
        },
        DataSourceType.ACTIVITY_PERIOD: {
            "activity_id": ["activity_id", "activityid", "活动ID"],
            "activity_name": ["activity_name", "activityname", "活动名称", "活动名"],
            "start_time": ["start_time", "starttime", "开始时间", "活动开始"],
            "end_time": ["end_time", "endtime", "结束时间", "活动结束"],
            "pool_id": ["pool_id", "poolid", "道具池ID", "池子ID"],
            "item_id": ["item_id", "itemid", "道具ID", "物品ID"],
            "drop_rate_multiplier": ["drop_rate_multiplier", "multiplier", "倍率", "掉率倍率", "加成倍率"],
            "guaranteed_drop_count": ["guaranteed_drop_count", "guaranteed", "保底次数", "必掉次数"],
            "is_active": ["is_active", "active", "是否有效", "有效"],
        },
        DataSourceType.COMPLAINT_RECORD: {
            "complaint_id": ["complaint_id", "complaintid", "投诉ID"],
            "player_id": ["player_id", "playerid", "玩家ID", "用户ID"],
            "pool_id": ["pool_id", "poolid", "道具池ID", "池子ID"],
            "item_id": ["item_id", "itemid", "道具ID", "物品ID"],
            "complaint_time": ["complaint_time", "time", "投诉时间"],
            "complaint_content": ["complaint_content", "content", "投诉内容", "内容"],
            "expected_probability": ["expected_probability", "expected", "期望概率", "预期概率"],
            "actual_drop_count": ["actual_drop_count", "actual_count", "实际掉落", "实际次数"],
            "total_attempts": ["total_attempts", "attempts", "总次数", "抽取次数"],
            "is_verified": ["is_verified", "verified", "是否核实", "已核实"],
            "verification_result": ["verification_result", "result", "核实结果", "验证结果"],
        },
    }

    def __init__(self, fail_fast: bool = False):
        """
        :param fail_fast: 是否遇到第一个错误就停止，False时继续导入并记录错误
        """
        self.fail_fast = fail_fast
        self._import_history: List[DataSource] = []
        self._all_records: Dict[DataSourceType, List[Any]] = {
            dtype: [] for dtype in DataSourceType
        }

    def get_import_history(self) -> List[DataSource]:
        """获取所有导入历史"""
        return list(self._import_history)

    def get_all_records(
        self,
        source_type: Optional[DataSourceType] = None,
        only_active: bool = True,
    ) -> List[Any]:
        """
        获取所有导入的记录

        Args:
            source_type: 数据源类型过滤
            only_active: 是否只返回激活的记录
        """
        if source_type:
            records = list(self._all_records[source_type])
            if only_active:
                records = [r for r in records if getattr(r, "is_active", True)]
            return records
        result = []
        for records in self._all_records.values():
            result.extend(records)
        if only_active:
            result = [r for r in result if getattr(r, "is_active", True)]
        return result

    def get_active_records(self, source_type: Optional[DataSourceType] = None) -> List[Any]:
        """获取激活的记录（别名方法）"""
        return self.get_all_records(source_type, only_active=True)

    def import_file(
        self,
        file_path: str,
        source_type: DataSourceType,
        sheet_name: Optional[str] = None,
        version: str = "1.0",
        import_notes: str = "",
        activate: bool = True,
    ) -> ImportResult:
        """
        导入文件
        :param file_path: 文件路径
        :param source_type: 数据源类型
        :param sheet_name: Excel工作表名（可选）
        :param version: 版本号
        :param import_notes: 导入备注
        :param activate: 是否激活此版本的数据
        :return: 导入结果
        """
        if not os.path.exists(file_path):
            raise DataImportError(
                f"文件不存在: {file_path}",
                location=create_error_location(file_path=file_path)
            )

        file_ext = os.path.splitext(file_path)[1].lower()
        file_name = os.path.basename(file_path)

        data_source = DataSource(
            source_type=source_type,
            file_path=file_path,
            file_name=file_name,
            sheet_name=sheet_name,
            version=version,
            import_notes=import_notes,
            is_active=activate,
        )

        try:
            if file_ext in [".csv"]:
                df = self._read_csv(file_path)
            elif file_ext in [".xlsx", ".xls"]:
                df = self._read_excel(file_path, sheet_name)
            elif file_ext in [".json"]:
                df = self._read_json(file_path)
            elif file_ext in [".yaml", ".yml"]:
                df = self._read_yaml(file_path)
            else:
                raise DataImportError(
                    f"不支持的文件格式: {file_ext}",
                    location=create_error_location(file_path=file_path)
                )
        except Exception as e:
            if isinstance(e, DataImportError):
                raise
            raise DataImportError(
                f"读取文件失败: {str(e)}",
                location=create_error_location(file_path=file_path)
            ) from e

        data_source.original_row_count = len(df)

        records, errors, skipped = self._parse_dataframe(
            df, source_type, data_source
        )

        data_source.imported_row_count = len(records)
        data_source.skipped_row_count = len(skipped)
        data_source.metadata["columns"] = list(df.columns)
        data_source.metadata["skipped_reasons"] = [
            s.get("reason", "") for s in skipped
        ]

        self._import_history.append(data_source)
        self._all_records[source_type].extend(records)

        return ImportResult(
            data_source=data_source,
            records=records,
            errors=errors,
            skipped_rows=skipped,
        )

    def _read_csv(self, file_path: str) -> pd.DataFrame:
        """读取CSV文件"""
        encodings = ["utf-8", "utf-8-sig", "gbk", "gb2312"]
        for encoding in encodings:
            try:
                return pd.read_csv(file_path, encoding=encoding)
            except UnicodeDecodeError:
                continue
            except Exception as e:
                raise DataImportError(
                    f"读取CSV失败: {str(e)}",
                    location=create_error_location(file_path=file_path)
                ) from e
        raise DataImportError(
            "无法识别文件编码，尝试了utf-8, gbk等编码",
            location=create_error_location(file_path=file_path)
        )

    def _read_excel(
        self, file_path: str, sheet_name: Optional[str] = None
    ) -> pd.DataFrame:
        """读取Excel文件"""
        try:
            if sheet_name:
                return pd.read_excel(file_path, sheet_name=sheet_name)
            return pd.read_excel(file_path)
        except Exception as e:
            raise DataImportError(
                f"读取Excel失败: {str(e)}",
                location=create_error_location(
                    file_path=file_path, sheet_name=sheet_name
                )
            ) from e

    def _read_json(self, file_path: str) -> pd.DataFrame:
        """读取JSON文件"""
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            if isinstance(data, dict) and "data" in data:
                data = data["data"]
            return pd.DataFrame(data)
        except Exception as e:
            raise DataImportError(
                f"读取JSON失败: {str(e)}",
                location=create_error_location(file_path=file_path)
            ) from e

    def _read_yaml(self, file_path: str) -> pd.DataFrame:
        """读取YAML文件"""
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = yaml.safe_load(f)
            if isinstance(data, dict) and "data" in data:
                data = data["data"]
            return pd.DataFrame(data)
        except Exception as e:
            raise DataImportError(
                f"读取YAML失败: {str(e)}",
                location=create_error_location(file_path=file_path)
            ) from e

    def _normalize_columns(
        self, df: pd.DataFrame, source_type: DataSourceType
    ) -> pd.DataFrame:
        """标准化列名"""
        mapping = self.COLUMN_MAPPINGS.get(source_type, {})
        rename_map = {}

        for std_name, possible_names in mapping.items():
            for col in df.columns:
                col_lower = str(col).strip().lower()
                if col_lower in [n.lower() for n in possible_names]:
                    rename_map[col] = std_name
                    break

        return df.rename(columns=rename_map)

    def _parse_dataframe(
        self,
        df: pd.DataFrame,
        source_type: DataSourceType,
        data_source: DataSource,
    ) -> Tuple[List[Any], List[DataImportError], List[Dict[str, Any]]]:
        """解析DataFrame为数据对象"""
        df = self._normalize_columns(df, source_type)

        records: List[Any] = []
        errors: List[DataImportError] = []
        skipped: List[Dict[str, Any]] = []

        parsers: Dict[DataSourceType, Callable] = {
            DataSourceType.DROP_CONFIG: self._parse_drop_config,
            DataSourceType.PLAYER_LOG: self._parse_player_log,
            DataSourceType.ITEM_POOL: self._parse_item_pool,
            DataSourceType.ACTIVITY_PERIOD: self._parse_activity_period,
            DataSourceType.COMPLAINT_RECORD: self._parse_complaint_record,
        }

        parser = parsers.get(source_type)
        if not parser:
            raise DataImportError(
                f"不支持的数据源类型: {source_type}",
                location=create_error_location(
                    file_path=data_source.file_path,
                    sheet_name=data_source.sheet_name,
                )
            )

        for idx, row in df.iterrows():
            row_num = idx + 2
            raw_data = row.to_dict()

            try:
                record = parser(row, data_source.source_id, row_num)
                record.source_row = row_num
                record.raw_data = raw_data if hasattr(record, "raw_data") else {}
                records.append(record)
            except DataImportError as e:
                if self.fail_fast:
                    raise
                errors.append(e)
                skipped.append({
                    "row": row_num,
                    "data": raw_data,
                    "reason": str(e),
                })
            except Exception as e:
                error = DataImportError(
                    f"解析行失败: {str(e)}",
                    location=create_error_location(
                        file_path=data_source.file_path,
                        sheet_name=data_source.sheet_name,
                        row_number=row_num,
                        raw_data=raw_data,
                    )
                )
                if self.fail_fast:
                    raise error
                errors.append(error)
                skipped.append({
                    "row": row_num,
                    "data": raw_data,
                    "reason": str(error),
                })

        return records, errors, skipped

    def _parse_drop_config(
        self, row: pd.Series, source_id: str, row_num: int
    ) -> DropConfig:
        """解析掉落配置"""
        pool_id = safe_str(row.get("pool_id", ""))
        item_id = safe_str(row.get("item_id", ""))

        if not pool_id or not item_id:
            raise DataImportError(
                "掉落配置缺少必要字段: pool_id或item_id为空",
                location=create_error_location(
                    row_number=row_num,
                    column_name="pool_id/item_id",
                    object_id=f"{pool_id}/{item_id}",
                )
            )

        return DropConfig(
            source_id=source_id,
            pool_id=pool_id,
            item_id=item_id,
            item_name=safe_str(row.get("item_name", "")),
            probability=parse_float(row.get("probability", 0.0)),
            min_count=parse_int(row.get("min_count", 1)),
            max_count=parse_int(row.get("max_count", 1)),
            weight=parse_float(row.get("weight", 0.0)),
            effective_time=parse_datetime(row.get("effective_time")),
            expire_time=parse_datetime(row.get("expire_time")),
            is_enabled=parse_bool(row.get("is_enabled", True)),
            config_version=safe_str(row.get("config_version", "1.0")),
            extra={
                k: v for k, v in row.items()
                if k not in self.COLUMN_MAPPINGS[DataSourceType.DROP_CONFIG]
            },
        )

    def _parse_player_log(
        self, row: pd.Series, source_id: str, row_num: int
    ) -> PlayerLog:
        """解析玩家日志"""
        player_id = safe_str(row.get("player_id", ""))
        pool_id = safe_str(row.get("pool_id", ""))
        item_id = safe_str(row.get("item_id", ""))

        if not player_id or not pool_id or not item_id:
            raise DataImportError(
                "玩家日志缺少必要字段: player_id, pool_id或item_id为空",
                location=create_error_location(
                    row_number=row_num,
                    column_name="player_id/pool_id/item_id",
                    object_id=f"{player_id}/{pool_id}/{item_id}",
                )
            )

        drop_time = parse_datetime(row.get("drop_time"))
        if drop_time is None:
            raise DataImportError(
                "玩家日志缺少掉落时间或格式无法解析",
                location=create_error_location(
                    row_number=row_num,
                    column_name="drop_time",
                    object_id=player_id,
                )
            )

        return PlayerLog(
            source_id=source_id,
            player_id=player_id,
            pool_id=pool_id,
            item_id=item_id,
            item_name=safe_str(row.get("item_name", "")),
            drop_count=parse_int(row.get("drop_count", 1)),
            drop_time=drop_time,
            server_id=safe_str(row.get("server_id", "")),
            channel=safe_str(row.get("channel", "")),
            raw_data=row.to_dict(),
        )

    def _parse_item_pool(
        self, row: pd.Series, source_id: str, row_num: int
    ) -> ItemPool:
        """解析道具池"""
        pool_id = safe_str(row.get("pool_id", ""))

        if not pool_id:
            raise DataImportError(
                "道具池缺少必要字段: pool_id为空",
                location=create_error_location(
                    row_number=row_num,
                    column_name="pool_id",
                )
            )

        return ItemPool(
            pool_id=pool_id,
            pool_name=safe_str(row.get("pool_name", "")),
            source_id=source_id,
            description=safe_str(row.get("description", "")),
            pool_type=safe_str(row.get("pool_type", "normal")),
            is_active=parse_bool(row.get("is_active", True)),
            total_weight=parse_float(row.get("total_weight", 0.0)),
            item_count=parse_int(row.get("item_count", 0)),
            extra={
                k: v for k, v in row.items()
                if k not in self.COLUMN_MAPPINGS[DataSourceType.ITEM_POOL]
            },
        )

    def _parse_activity_period(
        self, row: pd.Series, source_id: str, row_num: int
    ) -> ActivityPeriod:
        """解析活动时段"""
        activity_id = safe_str(row.get("activity_id", ""))
        start_time = parse_datetime(row.get("start_time"))
        end_time = parse_datetime(row.get("end_time"))

        if not activity_id:
            raise DataImportError(
                "活动时段缺少必要字段: activity_id为空",
                location=create_error_location(
                    row_number=row_num,
                    column_name="activity_id",
                )
            )

        if start_time is None or end_time is None:
            raise DataImportError(
                "活动时段缺少开始或结束时间，或格式无法解析",
                location=create_error_location(
                    row_number=row_num,
                    column_name="start_time/end_time",
                    object_id=activity_id,
                )
            )

        return ActivityPeriod(
            activity_id=activity_id,
            activity_name=safe_str(row.get("activity_name", "")),
            source_id=source_id,
            start_time=start_time,
            end_time=end_time,
            pool_id=safe_str(row.get("pool_id", "")),
            item_id=safe_str(row.get("item_id", "")),
            drop_rate_multiplier=parse_float(row.get("drop_rate_multiplier", 1.0)),
            guaranteed_drop_count=parse_int(row.get("guaranteed_drop_count", 0)),
            is_active=parse_bool(row.get("is_active", True)),
            extra={
                k: v for k, v in row.items()
                if k not in self.COLUMN_MAPPINGS[DataSourceType.ACTIVITY_PERIOD]
            },
        )

    def _parse_complaint_record(
        self, row: pd.Series, source_id: str, row_num: int
    ) -> ComplaintRecord:
        """解析投诉记录"""
        complaint_id = safe_str(row.get("complaint_id", ""))
        player_id = safe_str(row.get("player_id", ""))

        if not complaint_id:
            raise DataImportError(
                "投诉记录缺少必要字段: complaint_id为空",
                location=create_error_location(
                    row_number=row_num,
                    column_name="complaint_id",
                )
            )

        return ComplaintRecord(
            complaint_id=complaint_id,
            source_id=source_id,
            player_id=player_id,
            pool_id=safe_str(row.get("pool_id", "")),
            item_id=safe_str(row.get("item_id", "")),
            complaint_time=parse_datetime(row.get("complaint_time")),
            complaint_content=safe_str(row.get("complaint_content", "")),
            expected_probability=parse_float(row.get("expected_probability")) if pd.notna(row.get("expected_probability")) else None,
            actual_drop_count=parse_int(row.get("actual_drop_count", 0)),
            total_attempts=parse_int(row.get("total_attempts", 0)),
            is_verified=parse_bool(row.get("is_verified", False)),
            verification_result=safe_str(row.get("verification_result", "")),
            extra={
                k: v for k, v in row.items()
                if k not in self.COLUMN_MAPPINGS[DataSourceType.COMPLAINT_RECORD]
            },
        )
