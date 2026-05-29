from __future__ import annotations

import hashlib
import logging
from datetime import datetime
from pathlib import Path
from typing import Optional

from tqdm import tqdm

from .auto_tagger import RuleBasedTagger
from .conflict_detector import ConflictDetector
from .duplicate_detector import DuplicateDetector
from .exporter import ReportExporter
from .feature_extractor import FeatureExtractor
from .models import ExportBundle, ProcessingStatus, SampleFile

logger = logging.getLogger(__name__)


class TaggingPipeline:
    def __init__(
        self,
        feature_extractor: Optional[FeatureExtractor] = None,
        tagger: Optional[RuleBasedTagger] = None,
        conflict_detector: Optional[ConflictDetector] = None,
        duplicate_detector: Optional[DuplicateDetector] = None,
        exporter: Optional[ReportExporter] = None,
    ):
        self.feature_extractor = feature_extractor or FeatureExtractor()
        self.tagger = tagger or RuleBasedTagger()
        self.conflict_detector = conflict_detector or ConflictDetector()
        self.duplicate_detector = duplicate_detector or DuplicateDetector()
        self.exporter = exporter or ReportExporter()
        self.samples: list[SampleFile] = []
        self.conflicts = []
        self.duplicates = []
        self.run_id: str = ""
        self.start_time: Optional[datetime] = None
        self.source_folders: list[str] = []

    def run(
        self,
        input_paths: list[Path],
        output_dir: Path,
        recursive: bool = True,
    ) -> ExportBundle:
        self._init_run(input_paths)
        audio_files = self._scan_files(input_paths, recursive)
        self._extract_features(audio_files)
        self._auto_tag()
        self._detect_conflicts()
        self._detect_duplicates()
        self._finalize_status()
        bundle = self._generate_report()
        self._export_results(bundle, output_dir)
        return bundle

    def _init_run(self, input_paths: list[Path]):
        self.start_time = datetime.now()
        timestamp = self.start_time.strftime("%Y%m%d_%H%M%S")
        paths_hash = hashlib.md5(
            "_".join(str(p) for p in input_paths).encode()
        ).hexdigest()[:8]
        self.run_id = f"tag_{timestamp}_{paths_hash}"
        self.source_folders = [str(p) for p in input_paths]
        self.samples = []
        self.conflicts = []
        self.duplicates = []

    def _scan_files(self, input_paths: list[Path], recursive: bool) -> list[tuple[Path, str]]:
        all_files = []
        for path in input_paths:
            source_folder = str(path)
            if path.is_file():
                if FeatureExtractor.is_audio_file(path):
                    all_files.append((path, source_folder))
            elif path.is_dir():
                if recursive:
                    for f in path.rglob("*"):
                        if f.is_file() and FeatureExtractor.is_audio_file(f):
                            all_files.append((f, source_folder))
                else:
                    for f in path.iterdir():
                        if f.is_file() and FeatureExtractor.is_audio_file(f):
                            all_files.append((f, source_folder))
        seen_paths = {}
        unique_files = []
        for file_path, folder in all_files:
            resolved = str(file_path.resolve())
            if resolved not in seen_paths:
                seen_paths[resolved] = True
                unique_files.append((file_path, folder))
        return unique_files

    def _extract_features(self, audio_files: list[tuple[Path, str]]):
        logger.info(f"提取特征: {len(audio_files)} 个文件")
        for file_path, source_folder in tqdm(audio_files, desc="提取特征"):
            sample = self.feature_extractor.process_sample(file_path, source_folder)
            self.samples.append(sample)

    def _auto_tag(self):
        logger.info("自动标注样本")
        self.samples = self.tagger.batch_tag(self.samples)

    def _detect_conflicts(self):
        logger.info("检测标签冲突")
        self.samples, self.conflicts = self.conflict_detector.detect_conflicts(self.samples)

    def _detect_duplicates(self):
        logger.info("检测重复样本")
        self.samples, self.duplicates = self.duplicate_detector.detect_duplicates(self.samples)

    def _finalize_status(self):
        for sample in self.samples:
            if sample.status not in [
                ProcessingStatus.ERROR, ProcessingStatus.CONFLICT, ProcessingStatus.DUPLICATE]:
                sample.status = ProcessingStatus.COMPLETED

    def _generate_report(self) -> ExportBundle:
        return self.exporter.generate_report(
            samples=self.samples,
            conflicts=self.conflicts,
            duplicates=self.duplicates,
            run_id=self.run_id,
            source_folders=self.source_folders,
            start_time=self.start_time,
        )

    def _export_results(self, bundle: ExportBundle, output_dir: Path):
        output_dir = Path(output_dir)
        detailed_path = output_dir / f"{self.run_id}_detailed.json"
        summary_path = output_dir / f"{self.run_id}_summary.json"
        self.exporter.export_to_file(bundle, detailed_path)
        self.exporter.export_summary_file(bundle, summary_path)
        print(self.exporter.print_console_summary(bundle))
        print(f"\n详细报告: {detailed_path}")
        print(f"摘要报告: {summary_path}")
