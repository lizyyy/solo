from pathlib import Path
from typing import Optional
from xml.etree import ElementTree as ET

try:
    import gpxpy
    import gpxpy.gpx
    GPXPY_AVAILABLE = True
except ImportError:
    GPXPY_AVAILABLE = False

from track_cleaner.parsers.base import TrackParser
from track_cleaner.models.track import TrackPoint, TrackSegment, Track


class KMLParser(TrackParser):
    
    @classmethod
    def supported_extensions(cls) -> list:
        return [".kml", ".kmz"]
    
    def parse(self, file_path: Path) -> Track:
        track_name = file_path.stem
        segments = []
        
        tree = ET.parse(file_path)
        root = tree.getroot()
        
        ns = self._get_namespace(root)
        
        for placemark in root.findall(f".//{{{ns}}}Placemark"):
            name_elem = placemark.find(f"./{{{ns}}}name")
            segment_name = name_elem.text if name_elem is not None and name_elem.text else None
            
            linestring = placemark.find(f"./{{{ns}}}LineString")
            if linestring is not None:
                coord_elem = linestring.find(f"./{{{ns}}}coordinates")
                if coord_elem is not None and coord_elem.text:
                    points = self._parse_coordinates(coord_elem.text)
                    if points:
                        segment = TrackSegment(
                            points=points,
                            name=segment_name,
                        )
                        segments.append(segment)
            
            point = placemark.find(f"./{{{ns}}}Point")
            if point is not None:
                coord_elem = point.find(f"./{{{ns}}}coordinates")
                if coord_elem is not None and coord_elem.text:
                    points = self._parse_coordinates(coord_elem.text)
                    if points:
                        segment = TrackSegment(
                            points=points,
                            name=segment_name,
                        )
                        segments.append(segment)
        
        return Track(
            name=track_name,
            segments=segments,
            source_file=str(file_path),
            source_format="kml",
        )
    
    def _get_namespace(self, root) -> str:
        tag = root.tag
        if "}" in tag:
            return tag.split("}")[0][1:]
        return ""
    
    def _parse_coordinates(self, coord_text: str) -> list:
        points = []
        lines = coord_text.strip().split()
        for line in lines:
            if not line.strip():
                continue
            parts = line.split(",")
            if len(parts) >= 2:
                try:
                    lon = float(parts[0])
                    lat = float(parts[1])
                    elev = None
                    if len(parts) >= 3:
                        elev = float(parts[2])
                    
                    tp = TrackPoint(
                        latitude=lat,
                        longitude=lon,
                        elevation=elev,
                    )
                    points.append(tp)
                except ValueError:
                    continue
        return points
