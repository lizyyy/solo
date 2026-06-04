"""核心算法：3D线段相交检测、断档追踪"""
import math
from typing import List, Optional, Tuple
from .models import Point3D, Segment, Conflict, GapRecord


def vector_subtract(p1: Point3D, p2: Point3D) -> Point3D:
    return Point3D(p1.x - p2.x, p1.y - p2.y, p1.z - p2.z)


def vector_add(p1: Point3D, p2: Point3D) -> Point3D:
    return Point3D(p1.x + p2.x, p1.y + p2.y, p1.z + p2.z)


def vector_multiply(p: Point3D, scalar: float) -> Point3D:
    return Point3D(p.x * scalar, p.y * scalar, p.z * scalar)


def dot_product(p1: Point3D, p2: Point3D) -> float:
    return p1.x * p2.x + p1.y * p2.y + p1.z * p2.z


def cross_product(p1: Point3D, p2: Point3D) -> Point3D:
    return Point3D(
        p1.y * p2.z - p1.z * p2.y,
        p1.z * p2.x - p1.x * p2.z,
        p1.x * p2.y - p1.y * p2.x,
    )


def vector_magnitude(p: Point3D) -> float:
    return math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z)


def vector_normalize(p: Point3D) -> Point3D:
    mag = vector_magnitude(p)
    if mag == 0:
        return Point3D(0, 0, 0)
    return vector_multiply(p, 1.0 / mag)


def distance_between_points(p1: Point3D, p2: Point3D) -> float:
    return vector_magnitude(vector_subtract(p1, p2))


def segment_3d_intersection(
    s1: Segment, s2: Segment, tolerance: float = 0.05
) -> Tuple[bool, Optional[Point3D], float]:
    """
    检测两条3D线段是否相交（或距离小于阈值）
    返回：(是否冲突, 最近点/交点, 最小距离)
    """
    p1 = s1.start
    p2 = s1.end
    p3 = s2.start
    p4 = s2.end

    d1 = vector_subtract(p2, p1)
    d2 = vector_subtract(p4, p3)
    d13 = vector_subtract(p1, p3)

    a = dot_product(d1, d1)
    b = dot_product(d1, d2)
    c = dot_product(d2, d2)
    d = dot_product(d1, d13)
    e = dot_product(d2, d13)

    denom = a * c - b * b

    if abs(denom) < 1e-10:
        denom = 1e-10

    s_numer = b * e - c * d
    t_numer = a * e - b * d

    s = s_numer / denom
    t = t_numer / denom

    s_clamped = max(0.0, min(1.0, s))
    t_clamped = max(0.0, min(1.0, t))

    point_on_s1 = vector_add(p1, vector_multiply(d1, s_clamped))
    point_on_s2 = vector_add(p3, vector_multiply(d2, t_clamped))

    distance = distance_between_points(point_on_s1, point_on_s2)
    mid_point = Point3D(
        (point_on_s1.x + point_on_s2.x) / 2,
        (point_on_s1.y + point_on_s2.y) / 2,
        (point_on_s1.z + point_on_s2.z) / 2,
    )

    is_intersecting = (distance <= tolerance) and (0 <= s <= 1) and (0 <= t <= 1)
    is_conflict = distance <= tolerance

    return is_conflict, mid_point, distance


def detect_all_conflicts(
    segments: List[Segment], tolerance: float = 0.05
) -> List[Conflict]:
    """检测所有线段之间的冲突"""
    conflicts = []
    conflict_id = 1

    active_segments = [s for s in segments if not s.is_deleted]

    for i in range(len(active_segments)):
        for j in range(i + 1, len(active_segments)):
            s1 = active_segments[i]
            s2 = active_segments[j]

            is_conflict, point, distance = segment_3d_intersection(s1, s2, tolerance)

            if is_conflict:
                if distance < 0.01:
                    severity = "critical"
                    conflict_type = "exact_intersection"
                elif distance < 0.03:
                    severity = "high"
                    conflict_type = "near_intersection"
                else:
                    severity = "medium"
                    conflict_type = "close_proximity"

                conflicts.append(
                    Conflict(
                        id=conflict_id,
                        segment1_id=s1.id,
                        segment2_id=s2.id,
                        intersection_point=point,
                        distance=round(distance, 6),
                        conflict_type=conflict_type,
                        severity=severity,
                    )
                )
                conflict_id += 1

    return conflicts


def detect_gaps(segments: List[Segment]) -> List[GapRecord]:
    """检测编号断档（人工删除行后留下的断档）"""
    gaps = []

    row_nums = sorted(
        [(s.original_row_num, s.id) for s in segments if not s.is_deleted]
    )
    deleted_rows = sorted(
        [(s.original_row_num, s.id) for s in segments if s.is_deleted]
    )

    all_row_nums = sorted([r for r, _ in row_nums] + [r for r, _ in deleted_rows])

    if not all_row_nums:
        return gaps

    all_rows_set = set(all_row_nums)

    expected_row = all_row_nums[0]
    for actual_row in all_row_nums:
        if actual_row > expected_row:
            gap_start = expected_row
            gap_end = actual_row - 1
            missing_count = gap_end - gap_start + 1

            seg_before = None
            for r, sid in row_nums + deleted_rows:
                if r == gap_start - 1:
                    seg_before = sid
                    break

            seg_after = None
            for r, sid in row_nums + deleted_rows:
                if r == gap_end + 1:
                    seg_after = sid
                    break

            gaps.append(
                GapRecord(
                    gap_start=gap_start,
                    gap_end=gap_end,
                    missing_count=missing_count,
                    segment_before=seg_before,
                    segment_after=seg_after,
                )
            )

        expected_row = actual_row + 1

    return gaps


def classify_conflict_type(s1: Segment, s2: Segment) -> str:
    """根据线段类型分类冲突"""
    categories = sorted([s1.category, s2.category])
    return f"{categories[0]}_vs_{categories[1]}"
