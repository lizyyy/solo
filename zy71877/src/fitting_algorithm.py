import numpy as np
from scipy import signal
from typing import List, Tuple
from .models import EnergyDataPoint, PeakValleyPoint, FittingResult


class EnergyFitting:
    def __init__(self, params: dict):
        self.window_size = params.get("window_size", 5)
        self.poly_order = params.get("poly_order", 3)
        self.smoothing_factor = params.get("smoothing_factor", 0.1)
        self.peak_prominence = params.get("peak_prominence", 0.15)
        self.valley_prominence = params.get("valley_prominence", 0.15)

    def smooth_data(self, data: np.ndarray) -> np.ndarray:
        kernel_size = min(self.window_size, len(data))
        if kernel_size % 2 == 0:
            kernel_size += 1
        kernel = np.ones(kernel_size) / kernel_size
        return np.convolve(data, kernel, mode="same")

    def find_peaks(self, data: np.ndarray, timestamps: np.ndarray) -> List[PeakValleyPoint]:
        data_range = np.max(data) - np.min(data)
        prominence = self.peak_prominence * data_range if data_range > 0 else 0.1
        
        peak_indices, properties = signal.find_peaks(
            data,
            prominence=prominence,
            distance=self.window_size
        )
        
        peaks = []
        for idx, peak_idx in enumerate(peak_indices):
            peaks.append(PeakValleyPoint(
                index=int(peak_idx),
                timestamp=float(timestamps[peak_idx]),
                power=float(data[peak_idx]),
                point_type="peak",
                prominence=float(properties["prominences"][idx])
            ))
        return peaks

    def find_valleys(self, data: np.ndarray, timestamps: np.ndarray) -> List[PeakValleyPoint]:
        inverted_data = -data
        data_range = np.max(data) - np.min(data)
        prominence = self.valley_prominence * data_range if data_range > 0 else 0.1
        
        valley_indices, properties = signal.find_peaks(
            inverted_data,
            prominence=prominence,
            distance=self.window_size
        )
        
        valleys = []
        for idx, valley_idx in enumerate(valley_indices):
            valleys.append(PeakValleyPoint(
                index=int(valley_idx),
                timestamp=float(timestamps[valley_idx]),
                power=float(data[valley_idx]),
                point_type="valley",
                prominence=float(properties["prominences"][idx])
            ))
        return valleys

    def polynomial_fit(self, x: np.ndarray, y: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        order = min(self.poly_order, len(x) - 1)
        coeffs = np.polyfit(x, y, order)
        fitted = np.polyval(coeffs, x)
        return coeffs, fitted

    def calculate_fitting_error(self, original: np.ndarray, fitted: np.ndarray) -> float:
        if len(original) == 0:
            return 0.0
        mse = np.mean((original - fitted) ** 2)
        return float(np.sqrt(mse))

    def fit(self, data_points: List[EnergyDataPoint]) -> FittingResult:
        if len(data_points) < 3:
            return FittingResult(
                peaks=[],
                valleys=[],
                fitting_error=0.0,
                polynomial_coeffs=[],
                smoothed_data=[]
            )

        timestamps = np.array([dp.timestamp for dp in data_points])
        powers = np.array([dp.power for dp in data_points])

        smoothed = self.smooth_data(powers)
        peaks = self.find_peaks(smoothed, timestamps)
        valleys = self.find_valleys(smoothed, timestamps)

        coeffs, fitted = self.polynomial_fit(timestamps, smoothed)
        error = self.calculate_fitting_error(powers, fitted)

        return FittingResult(
            peaks=peaks,
            valleys=valleys,
            fitting_error=error,
            polynomial_coeffs=coeffs.tolist(),
            smoothed_data=smoothed.tolist()
        )
