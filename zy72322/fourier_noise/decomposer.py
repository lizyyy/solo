import numpy as np
from typing import Dict, Any, List, Optional
from fourier_noise.models import Record, RecordType, ReviewStatus


class FourierNoiseDecomposer:

    def __init__(self, sample_rate: float = 1.0, noise_threshold_sigma: float = 1.0):
        self.sample_rate = sample_rate
        self.noise_threshold_sigma = noise_threshold_sigma

    def decompose(self, signal: np.ndarray) -> Dict[str, Any]:
        n = len(signal)
        if n == 0:
            return {
                "original": signal,
                "periodic": signal,
                "noise": signal,
                "frequencies": np.array([]),
                "magnitudes": np.array([]),
                "dominant_indices": [],
            }

        fft_result = np.fft.fft(signal)
        frequencies = np.fft.fftfreq(n, d=1.0 / self.sample_rate)
        magnitudes = np.abs(fft_result)

        mean_mag = np.mean(magnitudes)
        std_mag = np.std(magnitudes)
        threshold = mean_mag + self.noise_threshold_sigma * std_mag
        periodic_mask = magnitudes > threshold

        periodic_fft = fft_result.copy()
        periodic_fft[~periodic_mask] = 0
        noise_fft = fft_result.copy()
        noise_fft[periodic_mask] = 0

        periodic_component = np.fft.ifft(periodic_fft).real
        noise_component = np.fft.ifft(noise_fft).real

        return {
            "original": signal,
            "periodic": periodic_component,
            "noise": noise_component,
            "frequencies": frequencies,
            "magnitudes": magnitudes,
            "dominant_indices": list(np.where(periodic_mask)[0]),
        }

    def classify_records(self, records: List[Record]) -> List[Record]:
        for r in records:
            if r.value < 0 and r.old_table_value is None:
                r.record_type = RecordType.NEGATIVE_AS_MISSING
                r.review_status = ReviewStatus.PENDING
            elif r.old_table_value is None and r.value >= 0:
                r.review_status = ReviewStatus.PENDING
        return records

    def apply_fourier_to_records(self, records: List[Record]) -> List[Record]:
        if not records:
            return records

        timestamps = np.array([r.timestamp for r in records])
        values = np.array([r.value if r.value is not None else 0.0 for r in records])

        if len(values) < 2:
            return records

        sorted_indices = np.argsort(timestamps)
        sorted_values = values[sorted_indices]

        result = self.decompose(sorted_values)

        reverse_map = np.argsort(sorted_indices)
        periodic_full = result["periodic"][reverse_map]
        noise_full = result["noise"][reverse_map]

        for i, r in enumerate(records):
            r.fourier_periodic = periodic_full[i:i+1]
            r.fourier_noise = noise_full[i:i+1]

        return records

    def supplement_from_sampling(
        self,
        records: List[Record],
        sampling_entries: List[Dict[str, Any]],
    ) -> List[Record]:
        sampling_map = {e["record_id"]: e for e in sampling_entries}

        for r in records:
            if r.id in sampling_map:
                entry = sampling_map[r.id]
                if r.record_type == RecordType.NEGATIVE_AS_MISSING:
                    r.corrected_value = entry["old_caliber_value"]
                    r.sampling_list_source = entry.get("source", "unknown")
                    r.record_type = RecordType.SUPPLEMENTED_FROM_SAMPLING
                    r.review_status = ReviewStatus.PENDING
                elif r.old_table_value is None and r.record_type == RecordType.NORMAL:
                    r.corrected_value = entry["old_caliber_value"]
                    r.sampling_list_source = entry.get("source", "unknown")
                    r.record_type = RecordType.SUPPLEMENTED_FROM_SAMPLING
                    r.review_status = ReviewStatus.PENDING

        return records

    def mark_negative_for_review(self, records: List[Record]) -> List[Record]:
        for r in records:
            if r.record_type == RecordType.NEGATIVE_AS_MISSING:
                r.review_status = ReviewStatus.PENDING
        return records

    def manual_correct(
        self,
        records: List[Record],
        record_id: str,
        corrected_value: float,
    ) -> Optional[Record]:
        for r in records:
            if r.id == record_id:
                r.corrected_value = corrected_value
                r.review_status = ReviewStatus.CONFIRMED
                return r
        return None
