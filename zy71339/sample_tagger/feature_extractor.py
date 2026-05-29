from __future__ import annotations

import hashlib
import logging
from pathlib import Path
from typing import Optional, Tuple

import librosa
import numpy as np
import soundfile as sf

from .models import ProcessingStatus, SampleFile, SpectrumFeatures

logger = logging.getLogger(__name__)

SUPPORTED_FORMATS = {".wav", ".mp3", ".flac", ".ogg", ".aiff", ".aif", ".m4a"}


class FeatureExtractor:
    def __init__(self, sr: int = 22050, n_mfcc: int = 13):
        self.sr = sr
        self.n_mfcc = n_mfcc
        self.rms_silence_threshold = 0.005
        self.zcr_noise_threshold = 0.5
        self.flatness_noise_threshold = 0.6

    def load_audio(self, file_path: Path) -> Tuple[Optional[np.ndarray], Optional[int], Optional[str]]:
        try:
            y, sr = librosa.load(file_path, sr=self.sr, mono=True)
            return y, sr, None
        except Exception as e:
            return None, None, f"Failed to load audio: {str(e)}"

    def is_silent(self, y: np.ndarray, threshold: Optional[float] = None) -> Tuple[bool, float]:
        threshold = threshold or self.rms_silence_threshold
        rms = librosa.feature.rms(y=y)[0]
        mean_rms = np.mean(rms)
        return mean_rms < threshold, float(mean_rms)

    def detect_suspicious_noise(self, y: np.ndarray, features: SpectrumFeatures) -> Tuple[bool, dict]:
        evidence = {
            "zcr": features.zero_crossing_rate,
            "zcr_threshold": self.zcr_noise_threshold,
            "flatness": features.spectral_flatness,
            "flatness_threshold": self.flatness_noise_threshold,
        }
        high_zcr = features.zero_crossing_rate > self.zcr_noise_threshold
        high_flatness = features.spectral_flatness > self.flatness_noise_threshold
        is_suspicious = high_zcr or high_flatness
        evidence["is_suspicious"] = is_suspicious
        evidence["reason"] = []
        if high_zcr:
            evidence["reason"].append("high_zero_crossing_rate")
        if high_flatness:
            evidence["reason"].append("high_spectral_flatness")
        return is_suspicious, evidence

    def extract_features(self, y: np.ndarray, sr: int) -> Optional[SpectrumFeatures]:
        try:
            spectral_centroid = float(np.mean(librosa.feature.spectral_centroid(y=y, sr=sr)[0]))
            spectral_bandwidth = float(np.mean(librosa.feature.spectral_bandwidth(y=y, sr=sr)[0]))
            spectral_rolloff = float(np.mean(librosa.feature.spectral_rolloff(y=y, sr=sr)[0]))
            spectral_contrast = np.mean(librosa.feature.spectral_contrast(y=y, sr=sr), axis=1).tolist()
            zero_crossing_rate = float(np.mean(librosa.feature.zero_crossing_rate(y=y)[0]))
            rms = float(np.mean(librosa.feature.rms(y=y)[0]))
            mfcc = np.mean(librosa.feature.mfcc(y=y, sr=sr, n_mfcc=self.n_mfcc), axis=1).tolist()
            chroma_stft = np.mean(librosa.feature.chroma_stft(y=y, sr=sr), axis=1).tolist()
            spectral_flatness = float(np.mean(librosa.feature.spectral_flatness(y=y)[0]))
            peak_envelope = float(np.max(np.abs(y)))
            duration = float(librosa.get_duration(y=y, sr=sr))
            return SpectrumFeatures(
                spectral_centroid=spectral_centroid,
                spectral_bandwidth=spectral_bandwidth,
                spectral_rolloff=spectral_rolloff,
                spectral_contrast=[float(x) for x in spectral_contrast],
                zero_crossing_rate=zero_crossing_rate,
                rms=rms,
                mfcc=[float(x) for x in mfcc],
                chroma_stft=[float(x) for x in chroma_stft],
                spectral_flatness=spectral_flatness,
                peak_envelope=peak_envelope,
                duration=duration,
            )
        except Exception as e:
            logger.error(f"Feature extraction failed: {e}")
            return None

    def process_sample(self, file_path: Path, source_folder: str = "") -> SampleFile:
        file_path = file_path.resolve()
        file_hash = self._compute_file_hash(file_path)
        sample_id = SampleFile.generate_id(file_path)
        try:
            with sf.SoundFile(file_path) as f:
                file_sample_rate = f.samplerate
                channels = f.channels
            file_size = file_path.stat().st_size
            y, sr, load_error = self.load_audio(file_path)
            if load_error:
                return SampleFile(
                    sample_id=sample_id,
                    file_path=file_path,
                    file_name=file_path.name,
                    file_hash=file_hash,
                    file_size=file_size,
                    sample_rate=file_sample_rate,
                    channels=channels,
                    status=ProcessingStatus.ERROR,
                    error_message=load_error,
                    source_folder=source_folder,
                )
            is_silent, rms_value = self.is_silent(y)
            if is_silent:
                features = self._create_silent_features(y, sr)
                return SampleFile(
                    sample_id=sample_id,
                    file_path=file_path,
                    file_name=file_path.name,
                    file_hash=file_hash,
                    file_size=file_size,
                    sample_rate=file_sample_rate,
                    channels=channels,
                    status=ProcessingStatus.FEATURES_EXTRACTED,
                    features=features,
                    is_silent=True,
                    source_folder=source_folder,
                )
            features = self.extract_features(y, sr)
            if features is None:
                return SampleFile(
                    sample_id=sample_id,
                    file_path=file_path,
                    file_name=file_path.name,
                    file_hash=file_hash,
                    file_size=file_size,
                    sample_rate=file_sample_rate,
                    channels=channels,
                    status=ProcessingStatus.ERROR,
                    error_message="Feature extraction failed",
                    source_folder=source_folder,
                )
            is_suspicious, _ = self.detect_suspicious_noise(y, features)
            return SampleFile(
                sample_id=sample_id,
                file_path=file_path,
                file_name=file_path.name,
                file_hash=file_hash,
                file_size=file_size,
                sample_rate=file_sample_rate,
                channels=channels,
                status=ProcessingStatus.FEATURES_EXTRACTED,
                features=features,
                is_silent=False,
                is_suspicious=is_suspicious,
                source_folder=source_folder,
            )
        except Exception as e:
            logger.exception(f"Error processing {file_path}")
            return SampleFile(
                sample_id=sample_id,
                file_path=file_path,
                file_name=file_path.name,
                file_hash=file_hash,
                file_size=file_path.stat().st_size if file_path.exists() else 0,
                sample_rate=0,
                channels=0,
                status=ProcessingStatus.ERROR,
                error_message=str(e),
                source_folder=source_folder,
            )

    def _create_silent_features(self, y: np.ndarray, sr: int) -> SpectrumFeatures:
        return SpectrumFeatures(
            spectral_centroid=0.0,
            spectral_bandwidth=0.0,
            spectral_rolloff=0.0,
            spectral_contrast=[0.0] * 7,
            zero_crossing_rate=0.0,
            rms=float(np.mean(librosa.feature.rms(y=y)[0])),
            mfcc=[0.0] * self.n_mfcc,
            chroma_stft=[0.0] * 12,
            spectral_flatness=0.0,
            peak_envelope=float(np.max(np.abs(y))),
            duration=float(librosa.get_duration(y=y, sr=sr)),
        )

    @staticmethod
    def _compute_file_hash(file_path: Path, chunk_size: int = 8192) -> str:
        hash_sha256 = hashlib.sha256()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(chunk_size), b""):
                hash_sha256.update(chunk)
        return hash_sha256.hexdigest()

    @staticmethod
    def is_audio_file(file_path: Path) -> bool:
        return file_path.suffix.lower() in SUPPORTED_FORMATS

    def scan_directory(self, directory: Path) -> list[Path]:
        audio_files = []
        for f in directory.rglob("*"):
            if f.is_file() and self.is_audio_file(f):
                audio_files.append(f)
        return sorted(audio_files)
