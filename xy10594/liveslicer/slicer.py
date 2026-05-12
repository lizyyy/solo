from datetime import datetime
from typing import List, Tuple
from uuid import uuid4
from .models import (
    ProjectState,
    Slice,
    SliceType,
    SliceStatus,
    Subtitle,
    Product,
    Violation,
    TimelineSegment,
)


def time_overlap(a_start: float, a_end: float, b_start: float, b_end: float) -> bool:
    return not (a_end <= b_start or a_end is None or b_end is None)


def find_subtitles_in_range(subtitles: List[Subtitle], start: float, end: float) -> List[str]:
    result = []
    for sub in subtitles:
        if time_overlap(sub.start_time, sub.end_time, start, end):
            result.append(sub.id)
    return result


def get_product_explain_times(product: Product, subtitles: List[Subtitle], duration: float = 300.0) -> Tuple[float, float]:
    end_time = product.unlink_time if product.unlink_time else (product.link_time + duration)
    return product.link_time, end_time


def create_product_slice(product: Product, subtitles: List[Subtitle], subtitle_offset: float) -> Slice:
    start, end = get_product_explain_times(product, subtitles)
    actual_start = max(0, start + subtitle_offset)
    actual_end = end + subtitle_offset
    if actual_end <= actual_start:
        actual_end = actual_start + 60
    return Slice(
        slice_id=f"product-{product.product_id}-{uuid4().hex[:8]}",
        slice_type=SliceType.PRODUCT,
        start_time=actual_start,
        end_time=actual_end,
        duration=actual_end - actual_start,
        status=SliceStatus.PENDING,
        title=f"商品讲解: {product.name}",
        description=f"商品编号: {product.product_id}",
        product_id=product.product_id,
        product_name=product.name,
    )


def create_violation_slice(violation: Violation, subtitle_offset: float) -> Slice:
    actual_start = max(0, violation.start_time + subtitle_offset)
    actual_end = violation.end_time + subtitle_offset
    return Slice(
        slice_id=f"violation-{violation.id}-{uuid4().hex[:8]}",
        slice_type=SliceType.VIOLATION,
        start_time=actual_start,
        end_time=actual_end,
        duration=actual_end - actual_start,
        status=SliceStatus.PENDING,
        title=f"违规片段: {violation.reason}",
        description=f"违规级别: {violation.level}",
        violation_id=violation.id,
        violation_reason=violation.reason,
    )


def create_topic_slice(segment: TimelineSegment, subtitle_offset: float) -> Slice:
    actual_start = max(0, segment.start_time + subtitle_offset)
    actual_end = segment.end_time + subtitle_offset
    return Slice(
        slice_id=f"topic-{uuid4().hex[:12]}",
        slice_type=SliceType.TOPIC,
        start_time=actual_start,
        end_time=actual_end,
        duration=actual_end - actual_start,
        status=SliceStatus.PENDING,
        title=f"话题片段: {segment.title}",
        description=segment.description,
    )


def detect_overlaps(slices: List[Slice]) -> None:
    for i, s1 in enumerate(slices):
        for j, s2 in enumerate(slices):
            if i == j:
                continue
            if time_overlap(s1.start_time, s1.end_time, s2.start_time, s2.end_time):
                if s2.slice_id not in s1.overlapping_slices:
                    s1.overlapping_slices.append(s2.slice_id)


def generate_slices(state: ProjectState) -> List[Slice]:
    slices: List[Slice] = []

    for segment in state.timeline_segments:
        slices.append(create_topic_slice(segment, state.subtitle_offset))

    for violation in state.violations:
        slices.append(create_violation_slice(violation, state.subtitle_offset))

    for product in state.products:
        if product.product_id in state.processed_products:
            continue
        slices.append(create_product_slice(product, state.subtitles, state.subtitle_offset))

    for s in slices:
        s.subtitle_ids = find_subtitles_in_range(state.subtitles, s.start_time, s.end_time)

    detect_overlaps(slices)
    return slices


def validate_slices(state: ProjectState, slices: List[Slice]) -> List[str]:
    errors: List[str] = []
    seen_product_ids = set()
    duplicate_products: List[str] = []
    missing_id_products: List[str] = []

    for s in slices:
        if s.slice_type == SliceType.PRODUCT:
            if not s.product_id:
                if s.product_name not in missing_id_products:
                    missing_id_products.append(s.product_name or "未知商品")
                continue
            if s.product_id in seen_product_ids:
                if s.product_id not in duplicate_products:
                    duplicate_products.append(s.product_id)
            else:
                seen_product_ids.add(s.product_id)

    if missing_id_products:
        errors.append(f"发现缺少商品编号的商品: {', '.join(missing_id_products)}")
    if duplicate_products:
        errors.append(f"发现重复的商品讲解切片: {', '.join(duplicate_products)}")

    return errors


def check_slice_status(state: ProjectState, slices: List[Slice]) -> None:
    for s in slices:
        if s.overlapping_slices:
            s.status = SliceStatus.REVIEW_NEEDED
        elif s.slice_type == SliceType.PRODUCT and not s.product_id:
            s.status = SliceStatus.FAILED
        else:
            s.status = SliceStatus.READY
        s.updated_at = datetime.now()
