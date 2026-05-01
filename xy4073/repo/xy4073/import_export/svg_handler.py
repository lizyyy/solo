import re
from typing import List, Optional, Dict, Tuple
from xml.etree import ElementTree as ET

from models.piece import Piece
from geometry.point import Point
from geometry.polygon import Polygon


class SVGImporter:
    NS = {
        'svg': 'http://www.w3.org/2000/svg'
    }

    def __init__(self):
        self.scale_factor = 1.0
        self.flip_y = True

    def import_from_file(self, filepath: str) -> List[Piece]:
        try:
            tree = ET.parse(filepath)
            root = tree.getroot()
            return self._parse_svg(root)
        except Exception as e:
            print(f"解析 SVG 文件失败: {e}")
            return []

    def import_from_string(self, svg_string: str) -> List[Piece]:
        try:
            root = ET.fromstring(svg_string)
            return self._parse_svg(root)
        except Exception as e:
            print(f"解析 SVG 字符串失败: {e}")
            return []

    def _parse_svg(self, root: ET.Element) -> List[Piece]:
        pieces = []
        
        viewbox = root.get('viewBox')
        if viewbox:
            parts = viewbox.split()
            if len(parts) == 4:
                pass
        
        polygons = root.findall('.//svg:polygon', self.NS)
        for polygon_elem in polygons:
            piece = self._parse_polygon(polygon_elem)
            if piece:
                pieces.append(piece)
        
        paths = root.findall('.//svg:path', self.NS)
        for path_elem in paths:
            piece = self._parse_path(path_elem)
            if piece:
                pieces.append(piece)
        
        rects = root.findall('.//svg:rect', self.NS)
        for rect_elem in rects:
            piece = self._parse_rect(rect_elem)
            if piece:
                pieces.append(piece)
        
        return pieces

    def _parse_polygon(self, elem: ET.Element) -> Optional[Piece]:
        points_str = elem.get('points', '')
        if not points_str:
            return None
        
        points = self._parse_points_string(points_str)
        if len(points) < 3:
            return None
        
        piece = Piece()
        piece.points = points
        piece.name = elem.get('id', '裁片')
        
        style = elem.get('style', '')
        fill = elem.get('fill', '')
        
        if fill and fill != 'none':
            piece.color = fill
        else:
            color_match = re.search(r'fill:\s*([^;]+)', style)
            if color_match:
                piece.color = color_match.group(1)
        
        return piece

    def _parse_path(self, elem: ET.Element) -> Optional[Piece]:
        d = elem.get('d', '')
        if not d:
            return None
        
        points = self._parse_path_d(d)
        if len(points) < 3:
            return None
        
        piece = Piece()
        piece.points = points
        piece.name = elem.get('id', '裁片')
        
        fill = elem.get('fill', '')
        style = elem.get('style', '')
        
        if fill and fill != 'none':
            piece.color = fill
        else:
            color_match = re.search(r'fill:\s*([^;]+)', style)
            if color_match:
                piece.color = color_match.group(1)
        
        return piece

    def _parse_rect(self, elem: ET.Element) -> Optional[Piece]:
        x = float(elem.get('x', 0))
        y = float(elem.get('y', 0))
        width = float(elem.get('width', 0))
        height = float(elem.get('height', 0))
        
        if width <= 0 or height <= 0:
            return None
        
        points = [
            Point(x, y),
            Point(x + width, y),
            Point(x + width, y + height),
            Point(x, y + height)
        ]
        
        piece = Piece()
        piece.points = points
        piece.name = elem.get('id', '裁片')
        
        fill = elem.get('fill', '')
        style = elem.get('style', '')
        
        if fill and fill != 'none':
            piece.color = fill
        else:
            color_match = re.search(r'fill:\s*([^;]+)', style)
            if color_match:
                piece.color = color_match.group(1)
        
        return piece

    def _parse_points_string(self, points_str: str) -> List[Point]:
        points = []
        coords = re.findall(r'([+-]?\d+\.?\d*)\s*,\s*([+-]?\d+\.?\d*)', points_str)
        for x, y in coords:
            point = Point(float(x), float(y))
            if self.flip_y:
                point.y = -point.y
            points.append(point)
        return points

    def _parse_path_d(self, d: str) -> List[Point]:
        points = []
        current = Point(0, 0)
        start = Point(0, 0)
        
        tokens = re.findall(r'([A-Za-z])|([+-]?\d+\.?\d*)', d)
        command = 'M'
        coords = []
        
        for cmd, num in tokens:
            if cmd:
                if coords:
                    points, current, start = self._apply_path_command(
                        command, coords, points, current, start
                    )
                    coords = []
                command = cmd
            elif num:
                coords.append(float(num))
        
        if coords:
            points, current, start = self._apply_path_command(
                command, coords, points, current, start
            )
        
        return points

    def _apply_path_command(
        self,
        command: str,
        coords: List[float],
        points: List[Point],
        current: Point,
        start: Point
    ) -> Tuple[List[Point], Point, Point]:
        is_relative = command.islower()
        cmd = command.upper()
        
        i = 0
        while i < len(coords):
            if cmd in 'ML':
                x = coords[i]
                y = coords[i + 1]
                if is_relative:
                    x += current.x
                    y += current.y
                point = Point(x, -y if self.flip_y else y)
                points.append(point)
                current = Point(x, y)
                if cmd == 'M' and i == 0:
                    start = Point(x, y)
                i += 2
            elif cmd == 'H':
                x = coords[i]
                if is_relative:
                    x += current.x
                point = Point(x, -current.y if self.flip_y else current.y)
                points.append(point)
                current = Point(x, current.y)
                i += 1
            elif cmd == 'V':
                y = coords[i]
                if is_relative:
                    y += current.y
                point = Point(current.x, -y if self.flip_y else y)
                points.append(point)
                current = Point(current.x, y)
                i += 1
            elif cmd == 'Z':
                if points:
                    point = Point(start.x, -start.y if self.flip_y else start.y)
                    points.append(point)
                    current = start
                i += 1
            else:
                i += len(coords) - i
        
        return points, current, start


class SVGExporter:
    def __init__(self):
        self.scale_factor = 1.0
        self.margin = 10

    def export_to_file(
        self,
        filepath: str,
        placements,
        fabric_width: float,
        fabric_length: float
    ) -> bool:
        try:
            svg_content = self._generate_svg(placements, fabric_width, fabric_length)
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(svg_content)
            return True
        except Exception as e:
            print(f"导出 SVG 失败: {e}")
            return False

    def _generate_svg(
        self,
        placements,
        fabric_width: float,
        fabric_length: float
    ) -> str:
        viewbox_width = fabric_width + 2 * self.margin
        viewbox_height = fabric_length + 2 * self.margin
        
        svg_parts = [
            f'<?xml version="1.0" encoding="UTF-8"?>',
            f'<svg xmlns="http://www.w3.org/2000/svg" '
            f'width="{viewbox_width}mm" height="{viewbox_height}mm" '
            f'viewBox="0 0 {viewbox_width} {viewbox_height}">',
        ]
        
        svg_parts.append('  <defs>')
        svg_parts.append('    <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">')
        svg_parts.append('      <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#E0E0E0" stroke-width="0.1"/>')
        svg_parts.append('    </pattern>')
        svg_parts.append('  </defs>')
        
        svg_parts.append(f'  <rect x="0" y="0" width="{viewbox_width}" height="{viewbox_height}" fill="white"/>')
        
        fabric_x = self.margin
        fabric_y = self.margin
        svg_parts.append(
            f'  <rect x="{fabric_x}" y="{fabric_y}" '
            f'width="{fabric_width}" height="{fabric_length}" '
            f'fill="url(#grid)" stroke="#CCCCCC" stroke-width="0.5"/>'
        )
        
        colors = ['#4A90D9', '#D94A4A', '#4AD94A', '#D9D94A', '#D94AD9', '#4AD9D9']
        
        for idx, placement in enumerate(placements):
            if not placement.is_placed:
                continue
            
            color = placement.piece.color if placement.piece.color else colors[idx % len(colors)]
            
            from geometry.transform import Transform
            transformed_points = Transform.get_transformed_polygon(
                placement.piece.points,
                placement.position,
                placement.rotation,
                placement.mirror
            ).points
            
            points_str = ' '.join(
                f'{fabric_x + p.x},{fabric_y + p.y}'
                for p in transformed_points[:-1]
            )
            
            svg_parts.append(
                f'  <polygon points="{points_str}" '
                f'fill="{color}" fill-opacity="0.7" '
                f'stroke="#333333" stroke-width="0.3"/>'
            )
            
            bounds = Transform.get_bounds_after_transform(
                placement.piece.points,
                placement.position,
                placement.rotation,
                placement.mirror
            )
            
            center_x = fabric_x + bounds.center.x
            center_y = fabric_y + bounds.center.y
            name = placement.piece.name or f'裁片{idx + 1}'
            svg_parts.append(
                f'  <text x="{center_x}" y="{center_y}" '
                f'font-family="Arial" font-size="3" text-anchor="middle" '
                f'fill="#333333" dominant-baseline="middle">{name}</text>'
            )
        
        svg_parts.append('</svg>')
        
        return '\n'.join(svg_parts)
