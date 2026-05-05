import csv
import json
from typing import Dict, Any, Optional
from io import StringIO


class DataImporter:
    
    @staticmethod
    def parse_csv_content(content: str) -> list:
        reader = csv.DictReader(StringIO(content))
        return list(reader)
    
    @staticmethod
    def parse_segment_layout(content: str, file_type: str = "csv") -> Dict[str, Any]:
        if file_type == "csv":
            rows = DataImporter.parse_csv_content(content)
            segments = []
            for row in rows:
                segments.append({
                    "position": row.get("position", row.get("位置", "")),
                    "elevation": float(row.get("elevation", row.get("高程", 0))),
                    "width": float(row.get("width", row.get("宽度", 1500))),
                    "type": row.get("type", row.get("类型", "standard"))
                })
            return {"segments": segments}
        else:
            try:
                return json.loads(content)
            except json.JSONDecodeError:
                return {"segments": []}
    
    @staticmethod
    def parse_jack_stroke(content: str, file_type: str = "csv") -> Dict[str, Any]:
        if file_type == "csv":
            rows = DataImporter.parse_csv_content(content)
            strokes = {}
            for row in rows:
                position = row.get("position", row.get("位置", ""))
                stroke = float(row.get("stroke", row.get("行程", 0)))
                strokes[position] = stroke
            return {"strokes": strokes, "rows": rows}
        else:
            try:
                return json.loads(content)
            except json.JSONDecodeError:
                return {"strokes": {}}
    
    @staticmethod
    def parse_grouting_volume(content: str, file_type: str = "csv") -> float:
        if file_type == "csv":
            rows = DataImporter.parse_csv_content(content)
            if rows:
                first_row = rows[0]
                volume = first_row.get("volume", first_row.get("注浆量", first_row.get("grouting_volume", 0)))
                try:
                    return float(volume)
                except (ValueError, TypeError):
                    return 0.0
            return 0.0
        else:
            try:
                data = json.loads(content)
                return float(data.get("volume", data.get("grouting_volume", 0)))
            except (json.JSONDecodeError, ValueError, TypeError):
                return 0.0
    
    @staticmethod
    def parse_measurement_deviation(content: str, file_type: str = "csv") -> Dict[str, Any]:
        if file_type == "csv":
            rows = DataImporter.parse_csv_content(content)
            if rows:
                first_row = rows[0]
                return {
                    "plane_deviation": float(first_row.get("plane_deviation", first_row.get("平面偏差", first_row.get("plane", 0)))),
                    "elevation_deviation": float(first_row.get("elevation_deviation", first_row.get("高程偏差", first_row.get("elevation", 0)))),
                    "roll": float(first_row.get("roll", first_row.get("滚动角", first_row.get("rotation", 0)))),
                    "last_recheck_ring": int(first_row.get("last_recheck_ring", first_row.get("最近复测环号", first_row.get("recheck_ring", 0))))
                }
            return {}
        else:
            try:
                return json.loads(content)
            except json.JSONDecodeError:
                return {}
    
    @staticmethod
    def import_ring_data(
        ring_number: int,
        segment_layout_content: Optional[str] = None,
        jack_stroke_content: Optional[str] = None,
        grouting_content: Optional[str] = None,
        measurement_content: Optional[str] = None
    ) -> Dict[str, Any]:
        result = {
            "ring_number": ring_number,
            "segment_layout": None,
            "jack_stroke": None,
            "grouting_volume": None,
            "measurement_deviation": None
        }
        
        if segment_layout_content:
            layout = DataImporter.parse_segment_layout(segment_layout_content)
            result["segment_layout"] = json.dumps(layout, ensure_ascii=False)
        
        if jack_stroke_content:
            stroke = DataImporter.parse_jack_stroke(jack_stroke_content)
            result["jack_stroke"] = json.dumps(stroke, ensure_ascii=False)
        
        if grouting_content:
            volume = DataImporter.parse_grouting_volume(grouting_content)
            result["grouting_volume"] = volume
        
        if measurement_content:
            deviation = DataImporter.parse_measurement_deviation(measurement_content)
            result["measurement_deviation"] = json.dumps(deviation, ensure_ascii=False)
        
        return result
