"""Main QC engine orchestrating parsing, validation, and reporting."""

import math
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

from .geometry import (
    TimeSequenceAnalyzer,
    calculate_gsd,
    calculate_overlap,
    get_line_bbox,
    is_photo_on_line,
)
from .parser import parse_exif, parse_flight_lines, parse_photo_list, parse_rules
from .report import ReportGenerator
from .rules import RulesEngine, ValidationIssue


class SurveyQCEngine:
    def __init__(self, package_dir: Union[str, Path], rules_path: Optional[Union[str, Path]] = None):
        self.package_dir = Path(package_dir)
        self.rules_path = Path(rules_path) if rules_path else None
        self.rules: Dict[str, Any] = {}
        self.photos: List[Dict[str, Any]] = []
        self.exif_data: List[Dict[str, Any]] = []
        self.flight_lines: Dict[str, Any] = {}
        self.photo_exif_map: Dict[str, Dict[str, Any]] = {}
        self.all_issues: List[ValidationIssue] = []
        self.route_results: Dict[str, Dict[str, Any]] = {}
        self.coverage: Dict[str, Dict[str, Any]] = {}

    def load_rules(self, rules_path: Optional[Union[str, Path]] = None) -> None:
        if rules_path:
            self.rules = parse_rules(rules_path)
        elif self.rules_path:
            self.rules = parse_rules(self.rules_path)
        else:
            self.rules = {
                "overlap": {"min_percent": 60},
                "altitude": {"target_m": 120, "tolerance_m": 10},
                "gsd": {"min_cm_px": 2.0, "max_cm_px": 10.0},
            }

    def load_data(self) -> None:
        photo_csv = self._find_file("photos.csv", "photo_list.csv")
        if photo_csv:
            self.photos = parse_photo_list(photo_csv)

        exif_jsonl = self._find_file("exif.jsonl")
        if exif_jsonl:
            self.exif_data = parse_exif(exif_jsonl)
            self.photo_exif_map = {e.get("photo_id", e.get("filename", "")): e for e in self.exif_data}

        geojson_path = self._find_file("flight_lines.geojson", "routes.geojson", "flight_lines.json")
        if geojson_path:
            self.flight_lines = parse_flight_lines(geojson_path)

    def _find_file(self, *names: str) -> Optional[Path]:
        for name in names:
            for ext in ["", ".gz"]:
                path = self.package_dir / f"{name}{ext}"
                if path.exists():
                    return path
        return None

    def run(self) -> Dict[str, Any]:
        self.load_rules()
        self.load_data()
        self._validate()
        return self._build_summary()

    def _validate(self) -> None:
        rules_engine = RulesEngine(self.rules)
        features = self.flight_lines.get("features", [])

        for feature in features:
            props = feature.get("properties", {})
            route_id = props.get("route_id", props.get("id", "unknown"))
            geometry = feature.get("geometry", {})
            coords = geometry.get("coordinates", [])

            if geometry.get("type") == "LineString":
                line_coords = [(c[1], c[0]) for c in coords]
            else:
                line_coords = []

            route_photos = []
            for photo in self.photos:
                photo_id = photo.get("photo_id", photo.get("filename", ""))
                if is_photo_on_line(photo, line_coords):
                    route_photos.append(photo)

            photos_with_exif = [p for p in route_photos if p.get("photo_id", p.get("filename", "")) in self.photo_exif_map]
            photos_missing_exif = [p for p in route_photos if p.get("photo_id", p.get("filename", "")) not in self.photo_exif_map]

            for photo in photos_missing_exif:
                photo_id = photo.get("photo_id", photo.get("filename", "unknown"))
                self.all_issues.append(ValidationIssue(
                    route_id=route_id,
                    issue_type="EXIF_MISSING",
                    severity="MEDIUM",
                    message=f"Photo {photo_id} has no EXIF data",
                    photo_id=photo_id,
                ))

            if not route_photos:
                self.all_issues.append(ValidationIssue(
                    route_id=route_id,
                    issue_type="NO_PHOTOS_ON_ROUTE",
                    severity="HIGH",
                    message="No photos found on this route",
                ))
                self.route_results[route_id] = {"photo_count": 0, "issues": [], "photos": []}
                self.coverage[route_id] = {"status": "FAILED", "photos_on_route": 0, "coverage_percent": 0.0}
                continue

            route_issues: List[ValidationIssue] = []

            exif_for_route = [self.photo_exif_map.get(p.get("photo_id", p.get("filename", "")), {}) for p in route_photos]

            altitudes = [e.get("altitude", self.rules.get("altitude", {}).get("target_m", 120)) for e in exif_for_route]
            altitudes = [a for a in altitudes if a is not None]
            avg_altitude = sum(altitudes) / len(altitudes) if altitudes else self.rules.get("altitude", {}).get("target_m", 120)

            focal = exif_for_route[0].get("focal_length", 4.5) if exif_for_route else 4.5
            sensor_w = exif_for_route[0].get("sensor_width", 6.4) if exif_for_route else 6.4
            img_w = exif_for_route[0].get("image_width", 4000) if exif_for_route else 4000

            gsd = calculate_gsd(avg_altitude, focal, sensor_w, img_w)
            gsd_issue = rules_engine.validate_gsd(gsd, route_id)
            if gsd_issue:
                route_issues.append(gsd_issue)

            for i, photo in enumerate(route_photos[:-1]):
                next_photo = route_photos[i + 1]
                overlap = calculate_overlap(photo, next_photo, avg_altitude, focal, sensor_w, img_w)
                overlap_issue = rules_engine.validate_overlap(overlap, route_id)
                if overlap_issue:
                    overlap_issue.photo_id = photo.get("photo_id", photo.get("filename"))
                    route_issues.append(overlap_issue)

            timestamps: List[datetime] = []
            photo_ids: List[str] = []
            for photo in route_photos:
                pid = photo.get("photo_id", photo.get("filename", ""))
                photo_ids.append(pid)
                exif = self.photo_exif_map.get(pid, {})
                ts = exif.get("timestamp") or exif.get("datetime")
                if isinstance(ts, str):
                    for fmt in ["%Y:%m:%d %H:%M:%S", "%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S"]:
                        try:
                            ts = datetime.strptime(ts, fmt)
                            break
                        except ValueError:
                            continue
                if isinstance(ts, datetime):
                    timestamps.append(ts)

            if len(timestamps) >= 2:
                analyzer = TimeSequenceAnalyzer()
                disorder_issues = analyzer.check_disorder(timestamps, photo_ids)
                for di in disorder_issues:
                    route_issues.append(ValidationIssue(
                        route_id=route_id,
                        issue_type=di["issue"],
                        severity=di["severity"],
                        message=di["message"],
                        photo_id=di["photo_id"],
                        details=di.get("details", {}),
                    ))

                cross_midnight_issues = analyzer.check_cross_midnight(timestamps, photo_ids)
                for cmi in cross_midnight_issues:
                    route_issues.append(ValidationIssue(
                        route_id=route_id,
                        issue_type=cmi["issue"],
                        severity=cmi["severity"],
                        message=cmi["message"],
                        photo_id=cmi["photo_id"],
                        details=cmi.get("details", {}),
                    ))

            for photo in route_photos:
                pid = photo.get("photo_id", photo.get("filename", ""))
                lat = photo.get("latitude")
                lon = photo.get("longitude")
                if lat is None or lon is None or str(lat).strip() == "" or str(lon).strip() == "":
                    route_issues.append(rules_engine.validate_gps_missing(route_id, pid))

                if timestamps:
                    exif = self.photo_exif_map.get(pid, {})
                    alt = exif.get("altitude", avg_altitude)
                    alt_issue = rules_engine.validate_altitude(alt, route_id, pid)
                    if alt_issue:
                        route_issues.append(alt_issue)

            coverage_pct = len(photos_with_exif) / len(route_photos) * 100 if route_photos else 0
            self.coverage[route_id] = {
                "status": "PASSED" if len(route_issues) == 0 else "FAILED",
                "photos_on_route": len(route_photos),
                "coverage_percent": coverage_pct,
            }
            self.route_results[route_id] = {
                "photo_count": len(route_photos),
                "issues": route_issues,
                "photos": route_photos,
            }
            self.all_issues.extend(route_issues)

    def _build_summary(self) -> Dict[str, Any]:
        return {
            "package_name": str(self.package_dir.name),
            "generated_at": datetime.now().isoformat(),
            "routes": self.route_results,
            "coverage": self.coverage,
            "total_issues": len(self.all_issues),
        }

    def generate_reports(self, output_dir: Optional[Union[str, Path]] = None) -> Dict[str, Path]:
        if output_dir is None:
            output_dir = self.package_dir / "qc_reports"
        output_dir = Path(output_dir)
        reporter = ReportGenerator(output_dir)

        routes_issues: Dict[str, List[ValidationIssue]] = {}
        for issue in self.all_issues:
            if issue.route_id not in routes_issues:
                routes_issues[issue.route_id] = []
            routes_issues[issue.route_id].append(issue)

        summary = self._build_summary()
        coverage_for_report = {rid: self.coverage.get(rid, {}) for rid in self.route_results}

        outputs = {}
        outputs["summary"] = reporter.write_summary_md(summary, coverage_for_report)
        outputs["all_issues"] = reporter.write_issues_csv(self.all_issues)

        for route_id, issues in routes_issues.items():
            outputs[f"route_{route_id}"] = reporter.write_route_csv(route_id, issues)

        return outputs
