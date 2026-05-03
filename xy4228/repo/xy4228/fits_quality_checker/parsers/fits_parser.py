"""FITS文件解析器。"""

import os
from datetime import datetime
from typing import Dict, Any, Optional, List
from pathlib import Path

from fits_quality_checker.models.models import FITSMetadata, FileType


class FITSParser:
    """FITS文件头信息解析器。"""

    FITS_EXTENSIONS = {".fits", ".fits.gz", ".fts", ".fts.gz"}

    def __init__(self):
        """初始化FITS解析器。"""
        self._use_astropy = True
        try:
            from astropy.io import fits
            self._fits_module = fits
        except ImportError:
            self._use_astropy = False
            self._fits_module = None

    def is_fits_file(self, file_path: str) -> bool:
        """检查文件是否为FITS文件。

        Args:
            file_path: 文件路径

        Returns:
            是否为FITS文件
        """
        path = Path(file_path)
        ext = path.suffix.lower()
        # 处理.gz扩展名
        if ext == ".gz":
            ext = Path(path.stem).suffix.lower()
        return ext in self.FITS_EXTENSIONS

    def parse_file(self, file_path: str, file_type: Optional[FileType] = None) -> FITSMetadata:
        """解析单个FITS文件。

        Args:
            file_path: 文件路径
            file_type: 可选的文件类型，如果未提供则尝试从文件名推断

        Returns:
            FITSMetadata对象
        """
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"文件不存在: {file_path}")

        if not self.is_fits_file(file_path):
            raise ValueError(f"不是有效的FITS文件: {file_path}")

        path = Path(file_path)
        file_name = path.name

        if file_type is None:
            file_type = self._infer_file_type(file_name)

        header = {}
        if self._use_astropy and self._fits_module:
            try:
                with self._fits_module.open(file_path) as hdul:
                    # 读取主HDU的头信息
                    if hdul:
                        header = dict(hdul[0].header)
            except Exception as e:
                # 如果无法读取FITS文件，使用空的头信息
                header = {}
        else:
            # 没有astropy时，尝试手动读取简单的头信息
            header = self._parse_fits_header_manually(file_path)

        return self._create_metadata(file_path, file_name, file_type, header)

    def parse_directory(self, directory_path: str, recursive: bool = True) -> List[FITSMetadata]:
        """解析目录中的所有FITS文件。

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

        pattern = "**/*" if recursive else "*"
        for file_path in path.glob(pattern):
            if file_path.is_file() and self.is_fits_file(str(file_path)):
                try:
                    metadata = self.parse_file(str(file_path))
                    metadata_list.append(metadata)
                except Exception:
                    # 跳过无法解析的文件
                    continue

        return metadata_list

    def _infer_file_type(self, file_name: str) -> FileType:
        """从文件名推断文件类型。

        Args:
            file_name: 文件名

        Returns:
            推断的文件类型
        """
        lower_name = file_name.lower()

        if any(kw in lower_name for kw in ["light", "object", "target", "obj_", "m42", "m31"]):
            return FileType.LIGHT
        elif any(kw in lower_name for kw in ["dark", "dark_"]):
            return FileType.DARK
        elif any(kw in lower_name for kw in ["flat", "flat_"]):
            return FileType.FLAT
        elif any(kw in lower_name for kw in ["bias", "bias_", "zero"]):
            return FileType.BIAS
        else:
            # 默认尝试从曝光时间推断，默认光场
            return FileType.LIGHT

    def _create_metadata(
        self,
        file_path: str,
        file_name: str,
        file_type: FileType,
        header: Dict[str, Any],
    ) -> FITSMetadata:
        """从头信息创建FITSMetadata对象。

        Args:
            file_path: 文件路径
            file_name: 文件名
            file_type: 文件类型
            header: FITS头信息字典

        Returns:
            FITSMetadata对象
        """
        # 尝试获取曝光时间
        exposure_time = self._get_header_value(
            header, ["EXPTIME", "EXPOSURE", "EXP"]
        )

        # 尝试获取滤镜名称
        filter_name = self._get_header_value(
            header, ["FILTER", "FILT", "FILTER1", "FLTNAM"]
        )

        # 尝试获取温度
        temperature = self._get_header_value(
            header, ["TEMP", "CCD-TEMP", "TEMPERATURE", "SET-TEMP"]
        )

        # 尝试获取增益
        gain = self._get_header_value(
            header, ["GAIN", "CCDGAIN"]
        )

        # 尝试获取偏移
        offset = self._get_header_value(
            header, ["OFFSET", "PEDESTAL", "BIAS"]
        )

        # 尝试获取坐标
        ra = self._get_header_value(
            header, ["RA", "OBJCTRA", "RIGHTASC"]
        )
        dec = self._get_header_value(
            header, ["DEC", "OBJCTDEC", "DECLINAT"]
        )

        # 尝试获取大气质量
        airmass = self._get_header_value(
            header, ["AIRMASS", "AMASS"]
        )

        # 尝试获取观测时间
        observation_time = self._parse_observation_time(header)

        # 尝试获取目标名称
        object_name = self._get_header_value(
            header, ["OBJECT", "OBJNAME", "TARGET"]
        )

        # 尝试获取像素大小
        x_pixel_size = self._get_header_value(
            header, ["XPIXSZ", "PIXSIZE1"]
        )
        y_pixel_size = self._get_header_value(
            header, ["YPIXSZ", "PIXSIZE2"]
        )

        # 尝试获取binning
        x_bin = self._get_header_value(
            header, ["XBINNING", "XBIN", "BIN1"]
        )
        y_bin = self._get_header_value(
            header, ["YBINNING", "YBIN", "BIN2"]
        )

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

    def _get_header_value(
        self,
        header: Dict[str, Any],
        possible_keys: List[str],
        default: Any = None,
    ) -> Any:
        """从多个可能的键名中获取头信息值。

        Args:
            header: 头信息字典
            possible_keys: 可能的键名列表
            default: 默认值

        Returns:
            找到的值或默认值
        """
        # 首先尝试精确匹配
        for key in possible_keys:
            if key in header:
                return header[key]

        # 然后尝试大小写不敏感匹配
        header_lower = {k.lower(): v for k, v in header.items()}
        for key in possible_keys:
            key_lower = key.lower()
            if key_lower in header_lower:
                return header_lower[key_lower]

        return default

    def _parse_observation_time(self, header: Dict[str, Any]) -> Optional[datetime]:
        """解析观测时间。

        Args:
            header: 头信息字典

        Returns:
            解析的datetime对象或None
        """
        date_keys = ["DATE-OBS", "DATEOBS", "DATE", "UTSTART", "TIME-OBS"]
        time_keys = ["TIME-OBS", "TIME", "UTSTART", "TIME-OBS"]

        # 尝试组合日期和时间
        date_str = self._get_header_value(header, date_keys)
        time_str = self._get_header_value(header, time_keys)

        if date_str:
            try:
                # 尝试完整的ISO格式
                return datetime.fromisoformat(date_str.replace("T", " ").strip())
            except ValueError:
                pass

            try:
                # 尝试仅日期格式
                return datetime.strptime(date_str, "%Y-%m-%d")
            except ValueError:
                pass

        return None

    def _parse_fits_header_manually(self, file_path: str) -> Dict[str, Any]:
        """手动解析FITS头信息（不使用astropy）。

        Args:
            file_path: 文件路径

        Returns:
            头信息字典
        """
        header = {}
        try:
            with open(file_path, 'rb') as f:
                # FITS头信息块是2880字节的倍数
                while True:
                    block = f.read(2880)
                    if not block:
                        break

                    # 每个头记录是80字节
                    for i in range(0, len(block), 80):
                        record = block[i:i+80]
                        if len(record) < 80:
                            continue

                        try:
                            record_str = record.decode('ascii', errors='ignore').strip()
                        except Exception:
                            continue

                        # 检查是否到达头信息结束
                        if record_str.startswith("END"):
                            return header

                        # 解析 KEYWORD=VALUE 格式
                        if "=" in record_str:
                            try:
                                key_part, value_part = record_str.split("=", 1)
                                key = key_part.strip()

                                # 移除注释
                                if "/" in value_part:
                                    value_part = value_part.split("/", 1)[0]

                                value = value_part.strip()

                                # 移除引号
                                if value.startswith("'") and value.endswith("'"):
                                    value = value[1:-1].strip()
                                elif value.startswith('"') and value.endswith('"'):
                                    value = value[1:-1].strip()

                                # 尝试转换为数字
                                try:
                                    if "." in value or "e" in value.lower():
                                        value = float(value)
                                    else:
                                        value = int(value)
                                except ValueError:
                                    pass

                                header[key] = value
                            except Exception:
                                continue

                    # 检查是否是最后一个块（包含END）
                    if b"END" in block:
                        break

        except Exception:
            pass

        return header
