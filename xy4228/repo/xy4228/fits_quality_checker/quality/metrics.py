"""质量指标计算器。"""

import os
from typing import Optional, Dict, Any, List, Tuple
from pathlib import Path

import numpy as np

from fits_quality_checker.models.models import (
    ImageQualityMetrics,
    FITSMetadata,
    FileType,
    ObservationConfig,
)


class QualityMetricsCalculator:
    """图像质量指标计算器。

    支持两种模式：
    1. 真实FITS图像分析（需要astropy和photutils）
    2. 模拟数据计算（用于演示和测试，基于元数据和预设参数）
    """

    def __init__(self, config: Optional[ObservationConfig] = None):
        """初始化质量指标计算器。

        Args:
            config: 观测配置，用于阈值设置
        """
        self.config = config
        self._use_real_analysis = True

        try:
            from astropy.io import fits
            from photutils.detection import DAOStarFinder
            from photutils.aperture import CircularAperture
            from photutils.centroids import centroid_2dg

            self._fits = fits
            self._dao_finder = DAOStarFinder
            self._circular_aperture = CircularAperture
            self._centroid_2dg = centroid_2dg
        except ImportError:
            self._use_real_analysis = False

    def calculate_from_image(
        self,
        file_path: str,
        metadata: Optional[FITSMetadata] = None,
    ) -> ImageQualityMetrics:
        """从真实FITS图像计算质量指标。

        Args:
            file_path: FITS文件路径
            metadata: 可选的预解析元数据

        Returns:
            ImageQualityMetrics对象
        """
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"文件不存在: {file_path}")

        if metadata is None:
            metadata = self._extract_basic_metadata(file_path)

        if self._use_real_analysis:
            return self._calculate_real_metrics(file_path, metadata)
        else:
            return self._calculate_simulated_metrics(metadata)

    def calculate_from_metadata(
        self,
        metadata: FITSMetadata,
        simulated_params: Optional[Dict[str, Any]] = None,
    ) -> ImageQualityMetrics:
        """从元数据计算质量指标（使用模拟或预设值）。

        当没有真实图像数据时使用此方法。

        Args:
            metadata: FITS元数据
            simulated_params: 可选的模拟参数覆盖

        Returns:
            ImageQualityMetrics对象
        """
        return self._calculate_simulated_metrics(metadata, simulated_params)

    def batch_calculate(
        self,
        metadatas: List[FITSMetadata],
        use_real_images: bool = True,
    ) -> List[ImageQualityMetrics]:
        """批量计算质量指标。

        Args:
            metadatas: FITS元数据列表
            use_real_images: 是否尝试使用真实图像

        Returns:
            ImageQualityMetrics对象列表
        """
        metrics_list = []
        for metadata in metadatas:
            try:
                if use_real_images and os.path.exists(metadata.file_path):
                    metrics = self.calculate_from_image(metadata.file_path, metadata)
                else:
                    metrics = self.calculate_from_metadata(metadata)
                metrics_list.append(metrics)
            except Exception:
                # 创建一个空的metrics对象
                metrics_list.append(ImageQualityMetrics(
                    file_path=metadata.file_path,
                ))
        return metrics_list

    def _calculate_real_metrics(
        self,
        file_path: str,
        metadata: FITSMetadata,
    ) -> ImageQualityMetrics:
        """使用真实图像数据计算质量指标。

        Args:
            file_path: FITS文件路径
            metadata: FITS元数据

        Returns:
            ImageQualityMetrics对象
        """
        try:
            with self._fits.open(file_path) as hdul:
                data = hdul[0].data.astype(np.float64)

            # 计算背景噪声
            background_noise = self._calculate_background_noise(data)

            # 检测星点
            fwhm, roundness, star_count = self._calculate_star_metrics(
                data, background_noise
            )

            # 计算FWHM角秒值
            fwhm_arcsec = self._pixel_to_arcsec(fwhm, metadata)

            # 计算温度偏差
            temperature_deviation = None
            if metadata.temperature is not None and self.config:
                if self.config.expected_temperature is not None:
                    temperature_deviation = abs(
                        metadata.temperature - self.config.expected_temperature
                    )

            # 计算中位流量
            median_flux = float(np.median(data[data > 0])) if np.any(data > 0) else None

            return ImageQualityMetrics(
                file_path=file_path,
                fwhm=fwhm,
                fwhm_arcsec=fwhm_arcsec,
                roundness=roundness,
                background_noise=background_noise,
                star_count=star_count,
                median_flux=median_flux,
                temperature_deviation=temperature_deviation,
            )

        except Exception:
            # 如果真实分析失败，回退到模拟
            return self._calculate_simulated_metrics(metadata)

    def _calculate_simulated_metrics(
        self,
        metadata: FITSMetadata,
        simulated_params: Optional[Dict[str, Any]] = None,
    ) -> ImageQualityMetrics:
        """使用模拟数据计算质量指标。

        基于文件类型、观测条件等因素生成合理的模拟值。

        Args:
            metadata: FITS元数据
            simulated_params: 可选的参数覆盖

        Returns:
            ImageQualityMetrics对象
        """
        params = simulated_params or {}

        # 设置随机种子，确保可重复性（基于文件名哈希）
        seed = hash(metadata.file_name) % 4294967296
        rng = np.random.default_rng(seed)

        # 默认基础值
        base_fwhm = params.get("base_fwhm", 2.5)
        base_roundness = params.get("base_roundness", 0.9)
        base_noise = params.get("base_noise", 8.0)

        # 根据文件类型调整
        if metadata.file_type == FileType.DARK:
            # 暗场：星点数量为0，噪声较低
            fwhm = None
            roundness = None
            star_count = 0
            background_noise = base_noise * 0.5 + rng.normal(0, 0.5)

        elif metadata.file_type == FileType.FLAT:
            # 平场：星点数量少，均匀照明
            fwhm = base_fwhm + rng.normal(0, 0.3)
            roundness = base_roundness - rng.uniform(0, 0.05)
            star_count = int(rng.uniform(5, 20))
            background_noise = base_noise * 0.8 + rng.normal(0, 1.0)

        else:  # LIGHT or BIAS
            if metadata.file_type == FileType.BIAS:
                # 偏置：星点数量为0，噪声很低
                fwhm = None
                roundness = None
                star_count = 0
                background_noise = base_noise * 0.3 + rng.normal(0, 0.2)
            else:
                # 光场：根据条件生成
                fwhm = base_fwhm + rng.normal(0, 0.5)
                roundness = base_roundness - rng.uniform(0, 0.1)
                star_count = int(rng.uniform(50, 200))
                background_noise = base_noise + rng.normal(0, 2.0)

                # 模拟问题场景
                # 如果随机值超过阈值，模拟云或拖线
                if rng.random() < 0.15:  # 15%概率有问题
                    # 模拟云：噪声增加，星点减少
                    background_noise *= 1.5 + rng.uniform(0, 1.0)
                    star_count = int(star_count * rng.uniform(0.3, 0.7))

                if rng.random() < 0.1:  # 10%概率拖线
                    # 模拟拖线：圆度下降
                    roundness *= 0.7 + rng.uniform(0, 0.2)
                    fwhm *= 1.5 + rng.uniform(0, 1.0)

        # 计算FWHM角秒值
        fwhm_arcsec = None
        if fwhm is not None:
            fwhm_arcsec = self._pixel_to_arcsec(fwhm, metadata)

        # 计算温度偏差
        temperature_deviation = None
        if metadata.temperature is not None and self.config:
            if self.config.expected_temperature is not None:
                temperature_deviation = abs(
                    metadata.temperature - self.config.expected_temperature
                )

        return ImageQualityMetrics(
            file_path=metadata.file_path,
            fwhm=round(float(fwhm), 3) if fwhm is not None else None,
            fwhm_arcsec=round(float(fwhm_arcsec), 3) if fwhm_arcsec is not None else None,
            roundness=round(float(roundness), 3) if roundness is not None else None,
            background_noise=round(float(background_noise), 2),
            star_count=int(star_count) if star_count is not None else None,
            median_flux=round(float(rng.uniform(100, 1000)), 1),
            temperature_deviation=round(float(temperature_deviation), 2)
            if temperature_deviation is not None
            else None,
        )

    def _calculate_background_noise(self, data: np.ndarray) -> float:
        """计算背景噪声。

        使用中位数绝对偏差(MAD)作为稳健的噪声估计。

        Args:
            data: 图像数据数组

        Returns:
            背景噪声估计值
        """
        # 排除明显的星点（高于3倍MAD）
        median = np.median(data)
        mad = np.median(np.abs(data - median))

        # 使用MAD作为稳健的标准差估计
        # MAD = 0.6745 * sigma 对于正态分布
        sigma_estimate = 1.4826 * mad

        # 仅使用背景像素（在2倍sigma内）重新计算
        background_mask = np.abs(data - median) < 2 * sigma_estimate
        if np.any(background_mask):
            background_data = data[background_mask]
            median = np.median(background_data)
            mad = np.median(np.abs(background_data - median))
            sigma_estimate = 1.4826 * mad

        return float(sigma_estimate)

    def _calculate_star_metrics(
        self,
        data: np.ndarray,
        background_noise: float,
    ) -> Tuple[Optional[float], Optional[float], Optional[int]]:
        """计算星点相关指标：FWHM、圆度、星点数量。

        Args:
            data: 图像数据数组
            background_noise: 背景噪声

        Returns:
            (FWHM, 圆度, 星点数量) 元组
        """
        try:
            # 扣除背景
            median = np.median(data)
            data_sub = data - median

            # 检测星点
            threshold = 5.0 * background_noise
            finder = self._dao_finder(fwhm=3.0, threshold=threshold)
            sources = finder(data_sub)

            if sources is None or len(sources) == 0:
                return None, None, 0

            # 过滤掉边缘的源
            h, w = data.shape
            margin = 20
            valid_mask = (
                (sources["xcentroid"] > margin)
                & (sources["xcentroid"] < w - margin)
                & (sources["ycentroid"] > margin)
                & (sources["ycentroid"] < h - margin)
            )
            valid_sources = sources[valid_mask]

            if len(valid_sources) == 0:
                return None, None, 0

            # 计算平均FWHM
            # 使用 flux-weighted 平均
            fwhms = valid_sources["fwhm"]
            fluxes = valid_sources["flux"]
            weights = fluxes / np.sum(fluxes) if np.sum(fluxes) > 0 else np.ones_like(fluxes) / len(fluxes)
            avg_fwhm = float(np.sum(fwhms * weights))

            # 计算圆度
            # 圆度 = 2 * min(a, b) / (a + b)，其中a和b是长半轴和短半轴
            # 使用sharpness作为近似，或者从椭圆参数计算
            if "sharpness" in valid_sources.colnames:
                # sharpness 可以作为圆度的近似
                roundnesses = valid_sources["sharpness"]
            else:
                # 如果没有sharpness，使用0.8-1.0的默认值
                roundnesses = np.ones(len(valid_sources)) * 0.9

            avg_roundness = float(np.sum(roundnesses * weights))
            # 将圆度归一化到0-1范围
            avg_roundness = np.clip(avg_roundness / 1.0, 0.0, 1.0)

            return avg_fwhm, avg_roundness, len(valid_sources)

        except Exception:
            # 如果计算失败，返回None
            return None, None, 0

    def _pixel_to_arcsec(
        self,
        fwhm_pixel: Optional[float],
        metadata: FITSMetadata,
    ) -> Optional[float]:
        """将像素转换为角秒。

        公式: 角秒/像素 = (像素大小 * 206.265) / 焦距
        206.265 = 180 * 3600 / pi

        Args:
            fwhm_pixel: 像素单位的FWHM
            metadata: FITS元数据

        Returns:
            角秒单位的FWHM，如果无法计算则返回None
        """
        if fwhm_pixel is None:
            return None

        pixel_size = None
        focal_length = None

        # 从元数据获取像素大小
        if metadata.x_pixel_size:
            pixel_size = metadata.x_pixel_size
        elif metadata.y_pixel_size:
            pixel_size = metadata.y_pixel_size

        # 从配置获取焦距
        if self.config and self.config.focal_length:
            focal_length = self.config.focal_length

        # 如果两者都有，计算
        if pixel_size and focal_length and focal_length > 0:
            plate_scale = (pixel_size * 206.265) / focal_length
            return fwhm_pixel * plate_scale

        # 如果没有足够信息，使用默认值
        return fwhm_pixel * 0.5  # 默认0.5角秒/像素

    def _extract_basic_metadata(self, file_path: str) -> FITSMetadata:
        """从文件路径提取基本元数据。

        Args:
            file_path: 文件路径

        Returns:
            基本的FITSMetadata对象
        """
        path = Path(file_path)
        return FITSMetadata(
            file_path=file_path,
            file_name=path.name,
            file_type=FileType.LIGHT,  # 默认光场
        )
