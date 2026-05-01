"""悬链线计算模块"""

import math
from dataclasses import dataclass
from typing import List, Optional


@dataclass
class CatenaryPoint:
    s: float
    x: float
    z: float
    tension: float
    angle: float


@dataclass
class CatenaryResult:
    horizontal_offset: float
    vertical_depth: float
    cable_length_used: float
    top_tension: float
    bottom_tension: float
    minimum_bending_radius: float
    top_angle: float
    bottom_angle: float
    is_touchdown: bool
    touchdown_x: Optional[float]
    points: List[CatenaryPoint]


class CatenaryCalculator:
    def __init__(
        self,
        cable_weight_in_water: float,
        max_iterations: int = 100,
        tolerance: float = 1e-6
    ):
        self.w = cable_weight_in_water
        self.max_iterations = max_iterations
        self.tolerance = tolerance
    
    def _sinh(self, x: float) -> float:
        return math.sinh(x)
    
    def _cosh(self, x: float) -> float:
        return math.cosh(x)
    
    def _asinh(self, x: float) -> float:
        return math.asinh(x)
    
    def _acosh(self, x: float) -> float:
        if x < 1:
            return 0.0
        return math.acosh(x)
    
    def calculate_from_length(
        self,
        total_length: float,
        depth: float,
        horizontal_offset: float,
        bottom_force: float = 0.0
    ) -> CatenaryResult:
        if total_length <= 0 or depth <= 0:
            return self._create_invalid_result(
                horizontal_offset, depth, total_length
            )
        
        min_length_needed = math.sqrt(horizontal_offset**2 + depth**2)
        if total_length < min_length_needed:
            return CatenaryResult(
                horizontal_offset=horizontal_offset,
                vertical_depth=depth,
                cable_length_used=total_length,
                top_tension=float('inf'),
                bottom_tension=float('inf'),
                minimum_bending_radius=0.0,
                top_angle=90.0,
                bottom_angle=90.0,
                is_touchdown=False,
                touchdown_x=None,
                points=[]
            )
        
        return self._solve_catenary_horizontal_force(
            total_length, depth, horizontal_offset, bottom_force
        )
    
    def _solve_catenary_horizontal_force(
        self,
        s: float,
        h: float,
        d: float,
        bottom_force: float = 0.0
    ) -> CatenaryResult:
        if d <= 0:
            d = 1e-10
        if s <= h:
            return self._create_invalid_result(0, h, s)
        
        T_h_low = 1.0
        T_h_high = 1e7
        
        for _ in range(self.max_iterations):
            T_h_mid = (T_h_low + T_h_high) / 2
            calc_s = self._calculate_cable_length(T_h_mid, d, h, bottom_force)
            
            if abs(calc_s - s) < self.tolerance:
                break
            
            if calc_s < s:
                T_h_low = T_h_mid
            else:
                T_h_high = T_h_mid
        
        T_h = (T_h_low + T_h_high) / 2
        
        return self._calculate_full_catenary(T_h, d, h, s, bottom_force)
    
    def _calculate_cable_length(
        self,
        T_h: float,
        d: float,
        h: float,
        bottom_force: float = 0.0
    ) -> float:
        if T_h <= 0:
            return float('inf')
        
        w = self.w
        c = T_h / w
        
        if h <= 0:
            return 0.0
        
        T_v_bottom = bottom_force + w * h / 2 if bottom_force > 0 else 0
        
        if bottom_force > 0:
            T_bottom = math.sqrt(T_h**2 + bottom_force**2)
            T_top = math.sqrt(T_h**2 + (bottom_force + w * h)**2)
            
            z1 = c * (self._cosh((d / 2) / c) - 1)
            if z1 < h / 2:
                touchdown = True
                s_free = 2 * c * self._sinh(d / (2 * c))
                z_free = c * (self._cosh(d / (2 * c)) - 1)
                s_touchdown = h - z_free
                return s_free + s_touchdown
        
        return c * (self._sinh((d + c * self._asinh(bottom_force / T_h)) / c) - self._asinh(bottom_force / T_h))
    
    def _calculate_full_catenary(
        self,
        T_h: float,
        d: float,
        h: float,
        s: float,
        bottom_force: float = 0.0
    ) -> CatenaryResult:
        w = self.w
        c = T_h / w
        
        points: List[CatenaryPoint] = []
        num_points = 50
        
        T_bottom_v = bottom_force
        T_bottom_h = T_h
        
        for i in range(num_points + 1):
            t = i / num_points
            s_i = t * s
            
            if bottom_force > 0:
                T_v_i = bottom_force + w * (h - h * t)
            else:
                T_v_i = w * (h - h * t)
            
            x_i = c * (self._sinh(s_i / c + self._asinh(bottom_force / T_h)) - self._asinh(bottom_force / T_h))
            z_i = c * (self._cosh(s_i / c + self._asinh(bottom_force / T_h)) - self._cosh(self._asinh(bottom_force / T_h)))
            
            T_i = math.sqrt(T_h**2 + T_v_i**2)
            angle_i = math.degrees(math.atan2(T_v_i, T_h))
            
            points.append(CatenaryPoint(
                s=s_i,
                x=x_i,
                z=z_i,
                tension=T_i,
                angle=angle_i
            ))
        
        if points:
            top_point = points[0]
            bottom_point = points[-1]
            T_top = top_point.tension
            T_bottom = bottom_point.tension
            top_angle = top_point.angle
            bottom_angle = bottom_point.angle
        else:
            T_top = T_h
            T_bottom = math.sqrt(T_h**2 + (bottom_force + w * h)**2)
            top_angle = 0
            bottom_angle = math.degrees(math.atan2(bottom_force + w * h, T_h))
        
        min_radius = self._calculate_min_bending_radius(T_h, w, points)
        touchdown_x, is_touchdown = self._check_touchdown(points, h)
        
        return CatenaryResult(
            horizontal_offset=d,
            vertical_depth=h,
            cable_length_used=s,
            top_tension=T_top,
            bottom_tension=T_bottom,
            minimum_bending_radius=min_radius,
            top_angle=top_angle,
            bottom_angle=bottom_angle,
            is_touchdown=is_touchdown,
            touchdown_x=touchdown_x,
            points=points
        )
    
    def _calculate_min_bending_radius(
        self,
        T_h: float,
        w: float,
        points: List[CatenaryPoint]
    ) -> float:
        if not points:
            return float('inf')
        
        min_radius = float('inf')
        for point in points:
            if w > 0:
                radius = point.tension / w if w > 0 else float('inf')
                min_radius = min(min_radius, radius)
        
        return min_radius
    
    def _check_touchdown(
        self,
        points: List[CatenaryPoint],
        depth: float
    ) -> tuple[Optional[float], bool]:
        if not points:
            return None, False
        
        for i, point in enumerate(points):
            if point.z >= depth:
                if i > 0:
                    prev_point = points[i - 1]
                    t = (depth - prev_point.z) / (point.z - prev_point.z)
                    x = prev_point.x + t * (point.x - prev_point.x)
                    return x, True
                return point.x, True
        
        return None, False
    
    def _create_invalid_result(
        self,
        horizontal_offset: float,
        depth: float,
        length: float
    ) -> CatenaryResult:
        return CatenaryResult(
            horizontal_offset=horizontal_offset,
            vertical_depth=depth,
            cable_length_used=length,
            top_tension=float('inf'),
            bottom_tension=float('inf'),
            minimum_bending_radius=0.0,
            top_angle=90.0,
            bottom_angle=90.0,
            is_touchdown=False,
            touchdown_x=None,
            points=[]
        )
    
    def estimate_horizontal_offset(
        self,
        total_length: float,
        depth: float
    ) -> float:
        if total_length <= depth:
            return 0.0
        
        extra_length = total_length - depth
        
        if extra_length <= 0:
            return 0.0
        
        w = self.w
        T_h_guess = w * extra_length * 2
        
        c = T_h_guess / w
        
        s_free = extra_length
        x = c * self._sinh(s_free / c)
        
        return max(0.0, x)
    
    def calculate_angle_change_rate(
        self,
        current_angle: float,
        previous_angle: float,
        time_delta: float
    ) -> float:
        if time_delta <= 0:
            return 0.0
        
        angle_diff = abs(current_angle - previous_angle)
        if angle_diff > 180:
            angle_diff = 360 - angle_diff
        
        return angle_diff / time_delta
