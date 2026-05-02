import csv
import json
import tempfile
from datetime import datetime
from pathlib import Path

import pytest

from offline_merger.parsers.base_parser import FileType, ParseResult
from offline_merger.parsers.csv_parser import CSVParser


class TestBaseParser:
    def test_file_type_enum(self):
        assert FileType.PHOTO.value == "photo"
        assert FileType.GPX.value == "gpx"
        assert FileType.CSV.value == "csv"
        assert FileType.JSON.value == "json"
        assert FileType.UNKNOWN.value == "unknown"


class TestCSVParser:
    def test_can_parse(self):
        parser = CSVParser()
        assert parser.can_parse("test.csv") is True
        assert parser.can_parse("test.CSV") is True
        assert parser.can_parse("test.txt") is False

    def test_parse_valid_csv(self):
        csv_content = """点位编号,纬度,经度,海拔,备注
P001,39.9042,116.4074,43.5,测试点1
P002,39.9052,116.4084,45.2,测试点2
"""

        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False, encoding="utf-8") as f:
            f.write(csv_content)
            temp_path = f.name

        try:
            parser = CSVParser()
            result = parser.parse(temp_path, "测试来源")

            assert isinstance(result, ParseResult)
            assert len(result.points) == 2

            point1 = result.points[0]
            assert point1.point_id == "P001"
            assert point1.lat == 39.9042
            assert point1.lon == 116.4074
            assert point1.elevation == 43.5

            point2 = result.points[1]
            assert point2.point_id == "P002"
            assert point2.lat == 39.9052
            assert point2.lon == 116.4084

        finally:
            Path(temp_path).unlink()

    def test_parse_dms_coordinates(self):
        csv_content = """点位编号,纬度,经度
P001,39°54'15.12"N,116°24'26.64"E
"""

        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False, encoding="utf-8") as f:
            f.write(csv_content)
            temp_path = f.name

        try:
            parser = CSVParser()
            result = parser.parse(temp_path, "测试来源")

            assert len(result.points) == 1
            point = result.points[0]

            assert abs(point.lat - 39.9042) < 0.001
            assert abs(point.lon - 116.4074) < 0.001

        finally:
            Path(temp_path).unlink()

    def test_parse_with_chinese_headers(self):
        csv_content = """点位编号,纬度,经度,海拔
P001,39.9042,116.4074,43.5
"""

        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False, encoding="utf-8") as f:
            f.write(csv_content)
            temp_path = f.name

        try:
            parser = CSVParser()
            result = parser.parse(temp_path, "测试来源")

            assert len(result.points) == 1
            assert result.points[0].point_id == "P001"

        finally:
            Path(temp_path).unlink()

    def test_parse_empty_csv(self):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False, encoding="utf-8") as f:
            f.write("")
            temp_path = f.name

        try:
            parser = CSVParser()
            result = parser.parse(temp_path, "测试来源")

            assert isinstance(result, ParseResult)
            assert len(result.points) == 0

        finally:
            Path(temp_path).unlink()

    def test_parse_without_lat_lon_headers(self):
        csv_content = """名称,值
P001,测试
"""

        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False, encoding="utf-8") as f:
            f.write(csv_content)
            temp_path = f.name

        try:
            parser = CSVParser()
            result = parser.parse(temp_path, "测试来源")

            assert isinstance(result, ParseResult)
            assert len(result.points) == 0
            assert len(result.metadata.errors) > 0

        finally:
            Path(temp_path).unlink()


class TestGPXParser:
    def test_can_parse(self):
        from offline_merger.parsers.gpx_parser import GPXParser

        parser = GPXParser()
        assert parser.can_parse("track.gpx") is True
        assert parser.can_parse("track.GPX") is True
        assert parser.can_parse("track.xml") is False


class TestJsonParser:
    def test_can_parse(self):
        from offline_merger.parsers.json_parser import JsonParser

        parser = JsonParser()
        assert parser.can_parse("data.json") is True
        assert parser.can_parse("data.JSON") is True
        assert parser.can_parse("data.txt") is False

    def test_parse_simple_json(self):
        from offline_merger.parsers.json_parser import JsonParser

        data = {
            "points": [
                {
                    "point_id": "P001",
                    "lat": 39.9042,
                    "lon": 116.4074,
                    "elevation": 43.5,
                }
            ]
        }

        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False, encoding="utf-8") as f:
            json.dump(data, f)
            temp_path = f.name

        try:
            parser = JsonParser()
            result = parser.parse(temp_path, "测试来源")

            assert isinstance(result, ParseResult)
            assert len(result.points) == 1
            assert result.points[0].point_id == "P001"

        finally:
            Path(temp_path).unlink()

    def test_parse_geojson(self):
        from offline_merger.parsers.json_parser import JsonParser

        geojson = {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "Point",
                        "coordinates": [116.4074, 39.9042, 43.5]
                    },
                    "properties": {
                        "name": "测试点",
                    }
                }
            ]
        }

        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False, encoding="utf-8") as f:
            json.dump(geojson, f)
            temp_path = f.name

        try:
            parser = JsonParser()
            result = parser.parse(temp_path, "测试来源")

            assert isinstance(result, ParseResult)
            assert len(result.points) == 1 or len(result.waypoints) == 1

        finally:
            Path(temp_path).unlink()
