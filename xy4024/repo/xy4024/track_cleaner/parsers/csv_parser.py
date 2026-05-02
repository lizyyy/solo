from datetime import datetime
from pathlib import Path
from typing import Optional

try:
    import pandas as pd
    PANDAS_AVAILABLE = True
except ImportError:
    PANDAS_AVAILABLE = False

from track_cleaner.parsers.base import TrackParser
from track_cleaner.models.track import TrackPoint, TrackSegment, Track


class CSVParser(TrackParser):
    
    @classmethod
    def supported_extensions(cls) -> list:
        return [".csv"]
    
    def parse(self, file_path: Path) -> Track:
        if not PANDAS_AVAILABLE:
            raise ImportError("pandas 库未安装，请运行: pip install pandas")
        
        df = pd.read_csv(file_path)
        
        track_name = file_path.stem
        points = []
        
        for _, row in df.iterrows():
            lat = self._get_value(row, ["latitude", "lat", "y"])
            lon = self._get_value(row, ["longitude", "lon", "lng", "x"])
            elev = self._get_value(row, ["elevation", "elev", "altitude", "alt", "z"])
            time = self._get_time_value(row, ["time", "timestamp", "datetime", "date_time"])
            
            if lat is not None and lon is not None:
                tp = TrackPoint(
                    latitude=float(lat),
                    longitude=float(lon),
                    elevation=float(elev) if elev is not None else None,
                    timestamp=time,
                )
                points.append(tp)
        
        segments = []
        if points:
            segment = TrackSegment(
                points=points,
                name="CSV Import",
            )
            segments.append(segment)
        
        return Track(
            name=track_name,
            segments=segments,
            source_file=str(file_path),
            source_format="csv",
        )
    
    def _get_value(self, row, possible_columns: list):
        for col in possible_columns:
            if col in row.index and not pd.isna(row[col]):
                return row[col]
            col_lower = col.lower()
            if col_lower in row.index and not pd.isna(row[col_lower]):
                return row[col_lower]
            col_upper = col.upper()
            if col_upper in row.index and not pd.isna(row[col_upper]):
                return row[col_upper]
        return None
    
    def _get_time_value(self, row, possible_columns: list) -> Optional[datetime]:
        value = self._get_value(row, possible_columns)
        if value is None:
            return None
        
        try:
            if isinstance(value, datetime):
                return value
            return pd.to_datetime(value).to_pydatetime()
        except (ValueError, TypeError):
            return None
