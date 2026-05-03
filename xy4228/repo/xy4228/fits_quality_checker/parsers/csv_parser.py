"""CSV元数据解析器。"""

import os
from datetime import datetime
from typing import Dict, Any, Optional, List
from pathlib import Path

import pandas as pd

from fits_quality_checker.models.models import FITSMetadata, FileType


class CSVParser:
    """CSV元数据文件解析器。

    用于解析简化的CSV元数据文件，适用于没有真实FITS文件的场景。
    """

    def __init__(self):
        """初始化CSV解析器。"""
        pass

    def is_csv_file(self, file_path: str) -> bool:
        """检查文件是否为CSV文件。

        Args:
            file_path: 文件路径

        Returns:
            是否为CSV文件
        """
        path = Path(file_path)
        return path.suffix.lower() == ".csv"

    def parse_file(self, file_path: str) -> List[FITSMetadata]:
        """解析CSV元数据文件。

        CSV文件应包含以下列（可选但推荐）：
        - file_path / file_name: 文件路径或名称
        - file_type / type: 文件类型 (light/dark/flat/bias)
        - exposure / exptime: 曝光时间(秒)
        - filter: 滤镜名称
        - temperature / temp: 温度(°C)
        - gain: 增益
        - ra / objctra: 赤经
        - dec / objctdec: 赤纬
        - airmass: 大气质量
        - date_obs / observation_time: 观测时间
        - object: 目标名称

        Args:
            file_path: CSV文件路径

        Returns:
            FITSMetadata对象列表
        """
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"文件不存在: {file_path}")

        if not self.is_csv_file(file_path):
            raise ValueError(f"不是有效的CSV文件: {file_path}")

        # 读取CSV文件
        try:
            df = pd.read_csv(file_path)
        except Exception as e:
            raise ValueError(f"无法读取CSV文件: {e}")

        metadata_list = []
        for _, row in df.iterrows():
            metadata = self._row_to_metadata(row)
            metadata_list.append(metadata)

        return metadata_list

    def parse_directory(self, directory_path: str, recursive: bool = True) -> List[FITSMetadata]:
        """解析目录中的所有CSV文件。

        Args:
            directory_path: 目录路径
            recursive: 是否递归解析子目录

        Returns:
            FITSMetadata对象列表
        """
        if not os.path.isdir(directory_path):
            raise NotADirectoryError(f"不是有效的目录: {directory_path}")

        metadata_list = []
        path = Path(directory_path)

        pattern = "**/*.csv" if recursive else "*.csv"
        for csv_path in path.glob(pattern):
            if csv_path.is_file():
                try:
                    metadatas = self.parse_file(str(csv_path))
                    metadata_list.extend(metadatas)
                except Exception:
                    # 跳过无法解析的文件
                    continue

        return metadata_list

    def _row_to_metadata(self, row: pd.Series) -> FITSMetadata:
        """将CSV行转换为FITSMetadata对象。

        Args:
            row: CSV行数据

        Returns:
            FITSMetadata对象
        """
        # 获取文件路径和名称
        file_path = self._get_row_value(row, ["file_path", "filepath", "path"])
        file_name = self._get_row_value(row, ["file_name", "filename", "name"])

        if file_path is None and file_name is None:
            raise ValueError("CSV行缺少file_path或file_name列")

        if file_path is None:
            file_path = file_name
        if file_name is None:
            file_name = Path(file_path).name

        # 获取文件类型
        file_type_str = self._get_row_value(row, ["file_type", "type", "imagetype"])
        file_type = self._parse_file_type(file_type_str, file_name)

        # 获取曝光时间
        exposure_time = self._get_row_value(row, ["exposure", "exptime", "exp_time", "exp"])

        # 获取滤镜
        filter_name = self._get_row_value(row, ["filter", "filter_name", "flt", "filt"])

        # 获取温度
        temperature = self._get_row_value(row, ["temperature", "temp", "ccd_temp", "set_temp"])

        # 获取增益
        gain = self._get_row_value(row, ["gain", "ccd_gain"])

        # 获取偏移
        offset = self._get_row_value(row, ["offset", "pedestal", "bias"])

        # 获取坐标
        ra = self._get_row_value(row, ["ra", "objctra", "rightasc", "ra_hms"])
        dec = self._get_row_value(row, ["dec", "objctdec", "declinat", "dec_dms"])

        # 获取大气质量
        airmass = self._get_row_value(row, ["airmass", "amass", "air_mass"])

        # 获取观测时间
        observation_time_str = self._get_row_value(
            row, ["date_obs", "observation_time", "time_obs", "date", "utc_time"]
        )
        observation_time = self._parse_datetime(observation_time_str)

        # 获取目标名称
        object_name = self._get_row_value(row, ["object", "target", "objname", "object_name"])

        # 获取像素大小
        x_pixel_size = self._get_row_value(row, ["x_pixel_size", "xpixsz", "pixel_size_x"])
        y_pixel_size = self._get_row_value(row, ["y_pixel_size", "ypixsz", "pixel_size_y"])

        # 获取binning
        x_bin = self._get_row_value(row, ["x_bin", "xbinning", "bin_x"])
        y_bin = self._get_row_value(row, ["y_bin", "ybinning", "bin_y"])

        # 构建头信息字典（将所有列转换为字典）
        header = {}
        for col in row.index:
            value = row[col]
            if pd.notna(value):
                header[col] = value

        return FITSMetadata(
            file_path=file_path,
            file_name=file_name,
            file_type=file_type,
            exposure_time=exposure_time,
            filter_name=filter_name,
            temperature=temperature,
            gain=gain,
            offset=offset,
            ra=ra,
            dec=dec,
            airmass=airmass,
            observation_time=observation_time,
            object_name=object_name,
            x_pixel_size=x_pixel_size,
            y_pixel_size=y_pixel_size,
            x_bin=x_bin,
            y_bin=y_bin,
            header=header,
        )

    def _get_row_value(
        self,
        row: pd.Series,
        possible_keys: List[str],
        default: Any = None,
    ) -> Any:
        """从多个可能的列名中获取行值。

        Args:
            row: 数据行
            possible_keys: 可能的列名列表
            default: 默认值

        Returns:
            找到的值或默认值
        """
        row_lower = {k.lower(): v for k, v in row.items()}

        for key in possible_keys:
            # 先尝试精确匹配
            if key in row.index:
                value = row[key]
                if pd.notna(value):
                    return value

            # 再尝试小写匹配
            key_lower = key.lower()
            if key_lower in row_lower:
                value = row_lower[key_lower]
                if pd.notna(value):
                    return value

        return default

    def _parse_file_type(self, type_str: Optional[str], file_name: str) -> FileType:
        """解析文件类型字符串。

        Args:
            type_str: 文件类型字符串
            file_name: 文件名（用于推断）

        Returns:
            文件类型枚举
        """
        if type_str:
            type_lower = str(type_str).lower().strip()

            if type_lower in ["light", "object", "target", "obj"]:
                return FileType.LIGHT
            elif type_lower == "dark":
                return FileType.DARK
            elif type_lower == "flat":
                return FileType.FLAT
            elif type_lower in ["bias", "zero"]:
                return FileType.BIAS

        # 如果没有找到，从文件名推断
        lower_name = file_name.lower()
        if "dark" in lower_name:
            return FileType.DARK
        elif "flat" in lower_name:
            return FileType.FLAT
        elif "bias" in lower_name or "zero" in lower_name:
            return FileType.BIAS
        else:
            return FileType.LIGHT

    def _parse_datetime(self, datetime_str: Optional[Any]) -> Optional[datetime]:
        """解析日期时间字符串。

        Args:
            datetime_str: 日期时间字符串

        Returns:
            datetime对象或None
        """
        if datetime_str is None:
            return None

        try:
            # 尝试pandas的to_datetime
            pd_dt = pd.to_datetime(datetime_str)
            if pd.notna(pd_dt):
                return pd_dt.to_pydatetime()
        except Exception:
            pass

        # 手动尝试常见格式
        formats = [
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%d %H:%M",
            "%Y-%m-%d",
            "%Y/%m/%d %H:%M:%S",
            "%Y/%m/%d",
        ]

        dt_str = str(datetime_str).strip()
        for fmt in formats:
            try:
                return datetime.strptime(dt_str, fmt)
            except ValueError:
                continue

        return None
