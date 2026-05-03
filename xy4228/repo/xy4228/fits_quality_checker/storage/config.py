"""配置管理器。

负责保存和加载观测配置到本地文件系统。
"""

import os
import json
from datetime import datetime
from typing import Optional, Dict, Any, List
from pathlib import Path

from fits_quality_checker.models.models import ObservationConfig


class ConfigManager:
    """配置管理器。

    功能：
    1. 创建新的观测配置
    2. 保存配置到文件
    3. 从文件加载配置
    4. 列出可用的配置
    5. 删除配置
    """

    CONFIG_DIR_NAME = ".fitsqc"
    CONFIG_EXT = ".json"

    def __init__(self, workspace: Optional[str] = None):
        """初始化配置管理器。

        Args:
            workspace: 工作目录路径，如果为None则使用当前目录
        """
        if workspace is None:
            workspace = os.getcwd()

        self.workspace = Path(workspace)
        self.config_dir = self.workspace / self.CONFIG_DIR_NAME / "configs"

    def init_workspace(self) -> bool:
        """初始化工作空间。

        创建必要的目录结构。

        Returns:
            是否成功初始化
        """
        try:
            self.config_dir.mkdir(parents=True, exist_ok=True)
            return True
        except Exception:
            return False

    def create_config(
        self,
        config_name: str,
        observer: Optional[str] = None,
        telescope: Optional[str] = None,
        camera: Optional[str] = None,
        focal_length: Optional[float] = None,
        aperture: Optional[float] = None,
        pixel_size: Optional[float] = None,
        target_name: Optional[str] = None,
        target_ra: Optional[str] = None,
        target_dec: Optional[str] = None,
        expected_exposures: Optional[Dict[str, int]] = None,
        expected_temperature: Optional[float] = None,
        temperature_tolerance: float = 0.5,
        fwhm_threshold: float = 3.0,
        roundness_threshold: float = 0.8,
        noise_threshold: float = 10.0,
    ) -> ObservationConfig:
        """创建新的观测配置。

        Args:
            config_name: 配置名称
            observer: 观测者姓名
            telescope: 望远镜型号
            camera: 相机型号
            focal_length: 焦距(mm)
            aperture: 光圈(mm)
            pixel_size: 像素大小(um)
            target_name: 目标名称
            target_ra: 目标赤经
            target_dec: 目标赤纬
            expected_exposures: 期望曝光次数 {滤镜: 次数}
            expected_temperature: 期望温度(°C)
            temperature_tolerance: 温度容差(°C)
            fwhm_threshold: FWHM阈值(像素)
            roundness_threshold: 圆度阈值(0-1)
            noise_threshold: 背景噪声阈值(ADU)

        Returns:
            创建的ObservationConfig对象
        """
        config = ObservationConfig(
            config_name=config_name,
            observer=observer,
            telescope=telescope,
            camera=camera,
            focal_length=focal_length,
            aperture=aperture,
            pixel_size=pixel_size,
            target_name=target_name,
            target_ra=target_ra,
            target_dec=target_dec,
            expected_exposures=expected_exposures or {},
            expected_temperature=expected_temperature,
            temperature_tolerance=temperature_tolerance,
            fwhm_threshold=fwhm_threshold,
            roundness_threshold=roundness_threshold,
            noise_threshold=noise_threshold,
        )

        return config

    def save_config(self, config: ObservationConfig, overwrite: bool = False) -> Path:
        """保存配置到文件。

        Args:
            config: 观测配置对象
            overwrite: 是否覆盖已存在的配置

        Returns:
            保存的文件路径
        """
        self.init_workspace()

        file_path = self.config_dir / f"{config.config_name}{self.CONFIG_EXT}"

        if file_path.exists() and not overwrite:
            raise FileExistsError(f"配置已存在: {file_path}")

        # 更新修改时间
        config.updated_at = datetime.now()

        # 转换为字典（处理datetime）
        config_dict = config.model_dump()
        config_dict["created_at"] = config.created_at.isoformat()
        config_dict["updated_at"] = config.updated_at.isoformat()

        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(config_dict, f, indent=2, ensure_ascii=False)

        return file_path

    def load_config(self, config_name: str) -> ObservationConfig:
        """从文件加载配置。

        Args:
            config_name: 配置名称

        Returns:
            ObservationConfig对象
        """
        file_path = self.config_dir / f"{config_name}{self.CONFIG_EXT}"

        if not file_path.exists():
            raise FileNotFoundError(f"配置不存在: {file_path}")

        with open(file_path, "r", encoding="utf-8") as f:
            config_dict = json.load(f)

        # 转换datetime
        if "created_at" in config_dict and isinstance(config_dict["created_at"], str):
            config_dict["created_at"] = datetime.fromisoformat(config_dict["created_at"])
        if "updated_at" in config_dict and isinstance(config_dict["updated_at"], str):
            config_dict["updated_at"] = datetime.fromisoformat(config_dict["updated_at"])

        return ObservationConfig(**config_dict)

    def list_configs(self) -> List[Dict[str, Any]]:
        """列出所有可用的配置。

        Returns:
            配置信息列表
        """
        if not self.config_dir.exists():
            return []

        configs = []
        for file_path in self.config_dir.glob(f"*{self.CONFIG_EXT}"):
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    config_dict = json.load(f)

                configs.append({
                    "name": config_dict.get("config_name", file_path.stem),
                    "file_path": str(file_path),
                    "target_name": config_dict.get("target_name"),
                    "created_at": config_dict.get("created_at"),
                    "updated_at": config_dict.get("updated_at"),
                })
            except Exception:
                continue

        return configs

    def delete_config(self, config_name: str) -> bool:
        """删除配置。

        Args:
            config_name: 配置名称

        Returns:
            是否成功删除
        """
        file_path = self.config_dir / f"{config_name}{self.CONFIG_EXT}"

        if not file_path.exists():
            return False

        try:
            file_path.unlink()
            return True
        except Exception:
            return False

    def get_default_config(self) -> ObservationConfig:
        """获取默认配置。

        当没有指定配置时使用。

        Returns:
            默认的ObservationConfig对象
        """
        return ObservationConfig(
            config_name="default",
            observer="Unknown",
            temperature_tolerance=0.5,
            fwhm_threshold=3.0,
            roundness_threshold=0.8,
            noise_threshold=10.0,
        )

    def is_initialized(self) -> bool:
        """检查工作空间是否已初始化。

        Returns:
            是否已初始化
        """
        return self.config_dir.exists()
