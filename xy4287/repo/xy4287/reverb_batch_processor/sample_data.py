"""示例数据生成器"""

import csv
from datetime import datetime
from pathlib import Path
from typing import Optional

import numpy as np


class SampleDataGenerator:
    """示例数据生成器"""

    def generate_decay_csv(
        self,
        file_path: Path,
        rt60: float = 1.0,
        snr_db: float = 30.0,
        sample_rate: float = 100.0,
        duration: float = 5.0,
        peak_spl: float = 90.0,
        noise_floor: float = 35.0,
        include_metadata: bool = True
    ):
        """
        生成模拟的混响衰减CSV文件

        Args:
            file_path: 输出文件路径
            rt60: 目标混响时间(秒)
            snr_db: 信噪比(dB)
            sample_rate: 采样率(Hz)
            duration: 总时长(秒)
            peak_spl: 峰值声压级(dB)
            noise_floor: 噪声底(dB)
            include_metadata: 是否包含元数据头部
        """
        num_samples = int(duration * sample_rate)
        time = np.linspace(0, duration, num_samples)

        decay_rate = 60.0 / rt60
        ideal_decay = peak_spl - decay_rate * time

        noise_amplitude = 10 ** (-snr_db / 20)
        noise = np.random.normal(0, noise_amplitude, num_samples)
        noise_db = 20 * np.log10(np.abs(noise) + 1e-10)

        noise_floor_linear = 10 ** (noise_floor / 20)
        noise_floor_signal = np.full(num_samples, noise_floor_linear)

        decay_linear = 10 ** (ideal_decay / 20)
        signal_linear = decay_linear + noise_floor_signal + noise * noise_floor_linear

        spl = 10 * np.log10(np.maximum(signal_linear, 1e-10))

        with open(file_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)

            if include_metadata:
                writer.writerow(['测量信息', ''])
                writer.writerow(['房间', '测试房间'])
                writer.writerow(['测点', file_path.stem])
                writer.writerow(['采样率', f'{sample_rate} Hz'])
                writer.writerow(['单位', 'dB(A)'])
                writer.writerow(['日期', datetime.now().strftime('%Y-%m-%d %H:%M:%S')])
                writer.writerow(['频段', '1000Hz'])
                writer.writerow([])
                writer.writerow(['时间(s)', '声压级(dB)'])

            for t, s in zip(time, spl):
                writer.writerow([f'{t:.6f}', f'{s:.2f}'])

    def generate_clipping_csv(
        self,
        file_path: Path,
        sample_rate: float = 100.0,
        duration: float = 5.0,
        clipping_level: float = 150.0
    ):
        """
        生成包含削波的示例数据

        Args:
            file_path: 输出文件路径
            sample_rate: 采样率
            duration: 时长
            clipping_level: 削波阈值
        """
        num_samples = int(duration * sample_rate)
        time = np.linspace(0, duration, num_samples)

        rt60 = 1.5
        decay_rate = 60.0 / rt60
        peak_spl = clipping_level + 10.0

        ideal_decay = peak_spl - decay_rate * time

        spl = np.minimum(ideal_decay, clipping_level)

        noise = np.random.normal(0, 0.5, num_samples)
        spl += noise

        with open(file_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(['时间(s)', '声压级(dB)'])
            for t, s in zip(time, spl):
                writer.writerow([f'{t:.6f}', f'{s:.2f}'])

    def generate_high_noise_csv(
        self,
        file_path: Path,
        sample_rate: float = 100.0,
        duration: float = 5.0,
        noise_floor: float = 60.0
    ):
        """
        生成高噪声底的示例数据

        Args:
            file_path: 输出文件路径
            sample_rate: 采样率
            duration: 时长
            noise_floor: 噪声底水平
        """
        num_samples = int(duration * sample_rate)
        time = np.linspace(0, duration, num_samples)

        rt60 = 1.0
        decay_rate = 60.0 / rt60
        peak_spl = noise_floor + 10.0

        ideal_decay = peak_spl - decay_rate * time

        noise_amplitude = 3.0
        noise = np.random.normal(0, noise_amplitude, num_samples)

        spl = ideal_decay + noise

        with open(file_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(['时间(s)', '声压级(dB)'])
            for t, s in zip(time, spl):
                writer.writerow([f'{t:.6f}', f'{s:.2f}'])

    def generate_multiple_reflections_csv(
        self,
        file_path: Path,
        sample_rate: float = 100.0,
        duration: float = 5.0
    ):
        """
        生成包含多次反射干扰的示例数据

        Args:
            file_path: 输出文件路径
            sample_rate: 采样率
            duration: 时长
        """
        num_samples = int(duration * sample_rate)
        time = np.linspace(0, duration, num_samples)

        rt60 = 1.2
        decay_rate = 60.0 / rt60
        peak_spl = 85.0

        primary_decay = peak_spl - decay_rate * time

        reflection_time_1 = 0.2
        reflection_strength_1 = 0.7
        reflection_1 = np.where(
            time >= reflection_time_1,
            reflection_strength_1 * (peak_spl - decay_rate * (time - reflection_time_1)),
            0
        )

        reflection_time_2 = 0.5
        reflection_strength_2 = 0.5
        reflection_2 = np.where(
            time >= reflection_time_2,
            reflection_strength_2 * (peak_spl - decay_rate * (time - reflection_time_2)),
            0
        )

        spl_linear = (
            10 ** (primary_decay / 20) +
            10 ** (reflection_1 / 20) +
            10 ** (reflection_2 / 20)
        )

        noise = np.random.normal(0, 0.3, num_samples)
        spl_linear *= (1 + noise * 0.01)

        spl = 10 * np.log10(np.maximum(spl_linear, 1e-10))

        with open(file_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(['时间(s)', '声压级(dB)'])
            for t, s in zip(time, spl):
                writer.writerow([f'{t:.6f}', f'{s:.2f}'])

    def generate_multi_band_csv(
        self,
        file_path: Path,
        sample_rate: float = 100.0,
        duration: float = 5.0
    ):
        """
        生成多频段(倍频程)数据文件

        Args:
            file_path: 输出文件路径
            sample_rate: 采样率
            duration: 时长
        """
        num_samples = int(duration * sample_rate)
        time = np.linspace(0, duration, num_samples)

        bands = {
            '125Hz': {'rt60': 2.0, 'peak': 82.0},
            '250Hz': {'rt60': 1.8, 'peak': 85.0},
            '500Hz': {'rt60': 1.5, 'peak': 88.0},
            '1000Hz': {'rt60': 1.2, 'peak': 90.0},
            '2000Hz': {'rt60': 1.0, 'peak': 88.0},
            '4000Hz': {'rt60': 0.8, 'peak': 85.0},
        }

        band_data = {}
        for band, params in bands.items():
            decay_rate = 60.0 / params['rt60']
            decay = params['peak'] - decay_rate * time
            noise = np.random.normal(0, 0.5, num_samples)
            band_data[band] = decay + noise

        with open(file_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)

            headers = ['时间(s)'] + list(bands.keys())
            writer.writerow(headers)

            for i, t in enumerate(time):
                row = [f'{t:.6f}']
                for band in bands.keys():
                    row.append(f'{band_data[band][i]:.2f}')
                writer.writerow(row)

    def generate_missing_data_csv(
        self,
        file_path: Path,
        sample_rate: float = 100.0,
        duration: float = 5.0,
        missing_ratio: float = 0.1
    ):
        """
        生成包含缺失数据的示例文件

        Args:
            file_path: 输出文件路径
            sample_rate: 采样率
            duration: 时长
            missing_ratio: 缺失数据比例
        """
        num_samples = int(duration * sample_rate)
        time = np.linspace(0, duration, num_samples)

        rt60 = 1.0
        decay_rate = 60.0 / rt60
        peak_spl = 90.0

        spl = peak_spl - decay_rate * time
        noise = np.random.normal(0, 0.5, num_samples)
        spl += noise

        num_missing = int(num_samples * missing_ratio)
        missing_indices = np.random.choice(num_samples, num_missing, replace=False)

        with open(file_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(['时间(s)', '声压级(dB)'])

            for i, t in enumerate(time):
                if i in missing_indices:
                    writer.writerow([f'{t:.6f}', ''])
                else:
                    writer.writerow([f'{t:.6f}', f'{spl[i]:.2f}'])


def generate_test_data(output_dir: Path, num_normal: int = 3, include_anomalies: bool = True):
    """
    生成测试数据集

    Args:
        output_dir: 输出目录
        num_normal: 正常数据文件数量
        include_anomalies: 是否包含异常数据
    """
    output_dir.mkdir(parents=True, exist_ok=True)

    generator = SampleDataGenerator()

    for i in range(num_normal):
        rt60 = 0.8 + (i * 0.3)
        snr = 35 - (i * 3)

        file_path = output_dir / f"room1_point{i+1}_1kHz.csv"
        generator.generate_decay_csv(
            file_path,
            rt60=rt60,
            snr_db=snr,
            sample_rate=100.0,
            duration=5.0
        )

    if include_anomalies:
        clipping_path = output_dir / "anomaly_clipping.csv"
        generator.generate_clipping_csv(clipping_path)

        noisy_path = output_dir / "anomaly_noise.csv"
        generator.generate_high_noise_csv(noisy_path)

        multi_reflect_path = output_dir / "anomaly_reflections.csv"
        generator.generate_multiple_reflections_csv(multi_reflect_path)

        missing_path = output_dir / "anomaly_missing.csv"
        generator.generate_missing_data_csv(missing_path)

    multi_band_path = output_dir / "multi_band_measurement.csv"
    generator.generate_multi_band_csv(multi_band_path)
