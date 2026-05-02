"""偏见审计核心类 - 协调各模块"""

import sys
from pathlib import Path
from typing import Any, Optional

sys.path.insert(0, str(Path(__file__).parent.parent))

from features import CompetencyExtractor, ReasonClusterer
from parser import CandidatesParser, CompetencyDictParser, NotesParser, RulesParser
from reports import CSVReporter, HTMLReporter, MarkdownReporter
from engine.detector import BiasDetector


class BiasAuditor:
    def __init__(
        self,
        candidates_path: Path,
        notes_path: Path,
        rules_path: Path,
        competency_dict_path: Path,
        output_dir: Path,
        high_score_threshold: float = 85.0,
        low_score_threshold: float = 50.0,
    ):
        self.candidates_path = candidates_path
        self.notes_path = notes_path
        self.rules_path = rules_path
        self.competency_dict_path = competency_dict_path
        self.output_dir = output_dir
        self.high_score_threshold = high_score_threshold
        self.low_score_threshold = low_score_threshold

        self.candidates_parser = CandidatesParser()
        self.notes_parser = NotesParser()
        self.rules_parser = RulesParser()
        self.competency_parser = CompetencyDictParser()

        self.candidates: list = []
        self.notes: list = []
        self.rules: dict = {}
        self.competency_dict: dict = {}

        self.competency_extractor = None
        self.reason_clusterer = None
        self.bias_detector = None

        self.flags: list = []
        self.clusters: dict = {}

    def _load_data(self) -> bool:
        try:
            self.candidates = self.candidates_parser.parse(self.candidates_path)
            self.notes = self.notes_parser.parse(self.notes_path)
            self.rules = self.rules_parser.parse(self.rules_path)
            self.competency_dict = self.competency_parser.parse(self.competency_dict_path)
            return True
        except Exception as e:
            print(f"数据加载失败: {e}")
            return False

    def _initialize_components(self) -> None:
        self.competency_extractor = CompetencyExtractor(self.competency_dict)
        self.reason_clusterer = ReasonClusterer()
        self.bias_detector = BiasDetector(
            high_threshold=self.high_score_threshold,
            low_threshold=self.low_score_threshold,
        )

    def _extract_reasons_for_clustering(self) -> list:
        reasons = []
        for note in self.notes:
            notes_text = note.get("notes", "") or note.get("interview_notes", "") or note.get("reason", "")
            if notes_text and notes_text.strip():
                evidence = self.competency_extractor.extract(notes_text) if self.competency_extractor else {}
                if evidence:
                    reason_parts = []
                    for comp, matches in evidence.items():
                        reason_parts.extend(matches)
                    if reason_parts:
                        reasons.append(" ".join(reason_parts))
                else:
                    reasons.append(notes_text.strip()[:200])
        return reasons

    def _run(self) -> dict:
        self.flags = self.bias_detector.run_detection(
            self.candidates,
            self.notes,
            self.competency_extractor,
        )

        reasons = self._extract_reasons_for_clustering()
        if reasons:
            self.reason_clusterer.fit_cluster(reasons)
            self.clusters = self.reason_clusterer.get_cluster_summary()

        return {
            "flags": self.flags,
            "clusters": self.clusters,
            "candidates": self.candidates,
        }

    def _generate_reports(self, result: dict) -> None:
        self.output_dir.mkdir(parents=True, exist_ok=True)

        md_reporter = MarkdownReporter()
        md_reporter.generate(
            result["flags"],
            result.get("clusters", {}),
            self.output_dir / "bias_audit.md",
        )

        csv_reporter = CSVReporter()
        csv_reporter.generate(result["flags"], self.output_dir / "review_flags.csv")

        html_reporter = HTMLReporter()
        html_reporter.generate(
            result["flags"],
            result["candidates"],
            self.output_dir / "score_map.html",
        )

    def run(self) -> Optional[dict]:
        if not self._load_data():
            return None

        self._initialize_components()
        result = self._run()
        self._generate_reports(result)
        return result
