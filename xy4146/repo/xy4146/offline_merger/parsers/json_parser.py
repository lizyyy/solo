import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from offline_merger.parsers.base_parser import (
    BaseParser,
    FileType,
    ParseResult,
    PointData,
    Track,
    TrackPoint,
    TrackSegment,
    WayPoint,
)


class JsonParser(BaseParser):
    SUPPORTED_EXTENSIONS = ["json"]

    def parse(self, file_path: str, source_package: str) -> ParseResult:
        self.clear_errors()
        json_data: Optional[Dict[str, Any]] = None
        tracks: List[Track] = []
        waypoints: List[WayPoint] = []
        points: List[PointData] = []

        try:
            with open(file_path, "r", encoding="utf-8") as f:
                json_data = json.load(f)

            if isinstance(json_data, dict):
                if "tracks" in json_data and isinstance(json_data["tracks"], list):
                    tracks = self._parse_tracks(json_data["tracks"])
                elif "track" in json_data:
                    tracks = self._parse_tracks([json_data["track"]])

                if "waypoints" in json_data and isinstance(json_data["waypoints"], list):
                    waypoints = self._parse_waypoints(json_data["waypoints"])
                elif "waypoint" in json_data:
                    waypoints = self._parse_waypoints([json_data["waypoint"]])

                if "points" in json_data and isinstance(json_data["points"], list):
                    points = self._parse_point_data(json_data["points"])
                elif "point" in json_data:
                    points = self._parse_point_data([json_data["point"]])

                if not tracks and not waypoints and not points:
                    if self._looks_like_geojson(json_data):
                        parsed = self._parse_geojson(json_data)
                        tracks = parsed.get("tracks", [])
                        waypoints = parsed.get("waypoints", [])
                        points = parsed.get("points", [])

        except json.JSONDecodeError as e:
            self.add_error(f"JSON 解析失败: {str(e)}")
        except Exception as e:
            self.add_error(f"解析 JSON 失败: {str(e)}")

        metadata = self._get_file_metadata(
            file_path=file_path,
            source_package=source_package,
            file_type=FileType.JSON,
        )

        return ParseResult(
            metadata=metadata,
            tracks=tracks,
            waypoints=waypoints,
            points=points,
            json_data=json_data,
        )

    def _looks_like_geojson(self, data: Dict[str, Any]) -> bool:
        return "type" in data and data["type"] in (
            "FeatureCollection", "Feature", "Point", "LineString", "MultiPoint"
        )

    def _parse_geojson(self, data: Dict[str, Any]) -> Dict[str, List]:
        result = {"tracks": [], "waypoints": [], "points": []}

        if data["type"] == "FeatureCollection":
            for feature in data.get("features", []):
                parsed = self._parse_geojson_feature(feature)
                result["tracks"].extend(parsed.get("tracks", []))
                result["waypoints"].extend(parsed.get("waypoints", []))
                result["points"].extend(parsed.get("points", []))
        elif data["type"] == "Feature":
            parsed = self._parse_geojson_feature(data)
            result["tracks"].extend(parsed.get("tracks", []))
            result["waypoints"].extend(parsed.get("waypoints", []))
            result["points"].extend(parsed.get("points", []))

        return result

    def _parse_geojson_feature(self, feature: Dict[str, Any]) -> Dict[str, List]:
        result = {"tracks": [], "waypoints": [], "points": []}
        geometry = feature.get("geometry", {})
        properties = feature.get("properties", {})

        if geometry.get("type") == "LineString":
            coordinates = geometry.get("coordinates", [])
            if coordinates:
                track = Track(name=properties.get("name", "GeoJSON 轨迹"))
                segment = TrackSegment()
                for coord in coordinates:
                    if len(coord) >= 2:
                        point = TrackPoint(
                            lat=coord[1],
                            lon=coord[0],
                            elevation=coord[2] if len(coord) > 2 else None,
                        )
                        segment.points.append(point)
                track.segments.append(segment)
                result["tracks"].append(track)

        elif geometry.get("type") in ("Point", "MultiPoint"):
            coords_list = (
                [geometry.get("coordinates", [])]
                if geometry.get("type") == "Point"
                else geometry.get("coordinates", [])
            )
            for i, coords in enumerate(coords_list):
                if len(coords) >= 2:
                    name = properties.get("name", f"航点_{i}")
                    waypoint = WayPoint(
                        name=name,
                        lat=coords[1],
                        lon=coords[0],
                        elevation=coords[2] if len(coords) > 2 else None,
                        description=properties.get("description"),
                    )
                    result["waypoints"].append(waypoint)

                    point_data = PointData(
                        point_id=name,
                        lat=coords[1],
                        lon=coords[0],
                        elevation=coords[2] if len(coords) > 2 else None,
                        attributes=properties.copy(),
                    )
                    result["points"].append(point_data)

        return result

    def _parse_tracks(self, tracks_data: List[Dict[str, Any]]) -> List[Track]:
        tracks = []
        for track_data in tracks_data:
            if not isinstance(track_data, dict):
                continue

            track = Track(
                name=track_data.get("name", "未命名轨迹"),
                description=track_data.get("description"),
            )

            segments_data = track_data.get("segments", [])
            if not segments_data and "points" in track_data:
                segments_data = [{"points": track_data["points"]}]

            for segment_data in segments_data:
                if not isinstance(segment_data, dict):
                    continue

                segment = TrackSegment()
                points_data = segment_data.get("points", [])

                for point_data in points_data:
                    if not isinstance(point_data, dict):
                        continue

                    try:
                        track_point = TrackPoint(
                            lat=point_data.get("lat") or point_data.get("latitude"),
                            lon=point_data.get("lon") or point_data.get("longitude"),
                            elevation=point_data.get("elevation") or point_data.get("altitude"),
                            timestamp=self._parse_datetime(point_data.get("time") or point_data.get("timestamp")),
                            speed=point_data.get("speed"),
                            course=point_data.get("course") or point_data.get("heading"),
                        )
                        if track_point.lat is not None and track_point.lon is not None:
                            segment.points.append(track_point)
                    except Exception as e:
                        self.add_warning(f"解析轨迹点失败: {e}")

                if segment.points:
                    track.segments.append(segment)

            if track.segments:
                tracks.append(track)

        return tracks

    def _parse_waypoints(self, waypoints_data: List[Dict[str, Any]]) -> List[WayPoint]:
        waypoints = []
        for wp_data in waypoints_data:
            if not isinstance(wp_data, dict):
                continue

            try:
                waypoint = WayPoint(
                    name=wp_data.get("name", "未命名航点"),
                    lat=wp_data.get("lat") or wp_data.get("latitude"),
                    lon=wp_data.get("lon") or wp_data.get("longitude"),
                    elevation=wp_data.get("elevation") or wp_data.get("altitude"),
                    timestamp=self._parse_datetime(wp_data.get("time") or wp_data.get("timestamp")),
                    description=wp_data.get("description") or wp_data.get("desc"),
                    symbol=wp_data.get("symbol"),
                )
                if waypoint.lat is not None and waypoint.lon is not None:
                    waypoints.append(waypoint)
            except Exception as e:
                self.add_warning(f"解析航点失败: {e}")

        return waypoints

    def _parse_point_data(self, points_data: List[Dict[str, Any]]) -> List[PointData]:
        points = []
        for p_data in points_data:
            if not isinstance(p_data, dict):
                continue

            try:
                point = PointData(
                    point_id=p_data.get("point_id") or p_data.get("id") or p_data.get("name", "未知点位"),
                    lat=p_data.get("lat") or p_data.get("latitude"),
                    lon=p_data.get("lon") or p_data.get("longitude"),
                    elevation=p_data.get("elevation") or p_data.get("altitude"),
                    timestamp=self._parse_datetime(p_data.get("time") or p_data.get("timestamp")),
                    attributes={k: v for k, v in p_data.items() if k not in ("point_id", "id", "lat", "latitude", "lon", "longitude", "elevation", "altitude", "time", "timestamp", "attachments")},
                    attachments=p_data.get("attachments", []),
                    coordinate_system=p_data.get("coordinate_system", "WGS84"),
                )
                if point.lat is not None and point.lon is not None:
                    points.append(point)
            except Exception as e:
                self.add_warning(f"解析点位数据失败: {e}")

        return points

    def _parse_datetime(self, value: Any) -> Optional[datetime]:
        if value is None:
            return None
        if isinstance(value, datetime):
            return value
        if isinstance(value, (int, float)):
            try:
                return datetime.fromtimestamp(value)
            except:
                return None
        if isinstance(value, str):
            from dateutil.parser import parse as date_parse
            try:
                return date_parse(value)
            except:
                return None
        return None
