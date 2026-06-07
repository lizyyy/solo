import numpy as np
from typing import List, Dict, Tuple
from datetime import datetime
from collections import defaultdict
from models import store, HeatmapData
from config import (
    HEATMAP_GRID_SIZE, 
    EVENING_START_HOUR, 
    EVENING_END_HOUR,
    MIN_SAMPLES_PER_HOUR
)

def parse_inspection_time(time_str: str) -> int:
    if not time_str:
        return -1
    try:
        if ':' in time_str:
            hour = int(time_str.split(':')[0])
        else:
            hour = int(time_str)
        return hour % 24
    except:
        return -1

def coord_to_grid(lng: float, lat: float, 
                  min_lng: float, max_lng: float,
                  min_lat: float, max_lat: float) -> Tuple[int, int]:
    if max_lng == min_lng or max_lat == min_lat:
        return 0, 0
    grid_x = int((lng - min_lng) / (max_lng - min_lng) * (HEATMAP_GRID_SIZE - 1))
    grid_y = int((lat - min_lat) / (max_lat - min_lat) * (HEATMAP_GRID_SIZE - 1))
    return max(0, min(grid_x, HEATMAP_GRID_SIZE - 1)), max(0, min(grid_y, HEATMAP_GRID_SIZE - 1))

def grid_to_coord(grid_x: int, grid_y: int,
                  min_lng: float, max_lng: float,
                  min_lat: float, max_lat: float) -> Tuple[float, float]:
    lng = min_lng + (grid_x / (HEATMAP_GRID_SIZE - 1)) * (max_lng - min_lng)
    lat = min_lat + (grid_y / (HEATMAP_GRID_SIZE - 1)) * (max_lat - min_lat)
    return lng, lat

def is_evening_hour(hour: int) -> bool:
    return hour >= EVENING_START_HOUR or hour < EVENING_END_HOUR

def generate_heatmap(target_date: str = None) -> Dict:
    if not store.inspections:
        return {
            'grid_data': [],
            'stats': {
                'total_samples': 0,
                'grids_with_data': 0,
                'evening_gap_grids': 0,
                'needs_review_grids': 0
            },
            'bounding_box': {'min_lng': 0, 'max_lng': 0, 'min_lat': 0, 'max_lat': 0}
        }
    
    valid_inspections = []
    for insp in store.inspections:
        if target_date and insp.inspection_date != target_date:
            continue
        if insp.lng != 0 and insp.lat != 0:
            valid_inspections.append(insp)
    
    if not valid_inspections:
        return {
            'grid_data': [],
            'stats': {
                'total_samples': 0,
                'grids_with_data': 0,
                'evening_gap_grids': 0,
                'needs_review_grids': 0
            },
            'bounding_box': {'min_lng': 0, 'max_lng': 0, 'min_lat': 0, 'max_lat': 0}
        }
    
    lngs = [i.lng for i in valid_inspections]
    lats = [i.lat for i in valid_inspections]
    min_lng, max_lng = min(lngs), max(lngs)
    min_lat, max_lat = min(lats), max(lats)
    
    padding = 0.001
    min_lng -= padding
    max_lng += padding
    min_lat -= padding
    max_lat += padding
    
    grid_samples = defaultdict(lambda: defaultdict(list))
    
    for insp in valid_inspections:
        grid_x, grid_y = coord_to_grid(insp.lng, insp.lat, min_lng, max_lng, min_lat, max_lat)
        hour = parse_inspection_time(insp.inspection_time)
        weight = 1.0
        if not insp.passable:
            weight = 2.0
        if insp.obstacle:
            weight += 0.5
        grid_samples[(grid_x, grid_y)][hour].append({
            'weight': weight,
            'hour': hour,
            'date': insp.inspection_date
        })
    
    heatmap_data = []
    evening_gap_count = 0
    needs_review_count = 0
    
    for (grid_x, grid_y), hour_data in grid_samples.items():
        lng, lat = grid_to_coord(grid_x, grid_y, min_lng, max_lng, min_lat, max_lat)
        
        all_weights = []
        all_hours = []
        for hour, samples in hour_data.items():
            for s in samples:
                all_weights.append(s['weight'])
                all_hours.append(hour)
        
        total_weight = sum(all_weights)
        sample_count = len(all_weights)
        
        has_evening_gap = False
        evening_hours_present = set()
        for h in all_hours:
            if h >= 0 and is_evening_hour(h):
                evening_hours_present.add(h)
        
        expected_evening_hours = set(range(EVENING_START_HOUR, 24)) | set(range(0, EVENING_END_HOUR))
        missing_evening_hours = expected_evening_hours - evening_hours_present
        
        if len(missing_evening_hours) > 3:
            has_evening_gap = True
            evening_gap_count += 1
        
        needs_review = has_evening_gap
        if needs_review:
            needs_review_count += 1
        
        avg_weight = total_weight / sample_count if sample_count > 0 else 0
        
        if has_evening_gap:
            avg_weight = avg_weight * 0.6
        
        hour_counts = defaultdict(int)
        for h in all_hours:
            if h >= 0:
                hour_counts[h] += 1
        
        low_sample_hours = sum(1 for h, cnt in hour_counts.items() if cnt < MIN_SAMPLES_PER_HOUR)
        if low_sample_hours > 2:
            needs_review = True
            if not has_evening_gap:
                needs_review_count += 1
        
        heatmap = HeatmapData(
            grid_x=grid_x,
            grid_y=grid_y,
            lng=lng,
            lat=lat,
            weight=avg_weight,
            sample_count=sample_count,
            date=target_date or '',
            has_evening_gap=has_evening_gap,
            needs_review=needs_review
        )
        heatmap_data.append(heatmap)
    
    store.heatmaps = heatmap_data
    store.save()
    
    return {
        'grid_data': [h.to_dict() for h in heatmap_data],
        'stats': {
            'total_samples': len(valid_inspections),
            'grids_with_data': len(heatmap_data),
            'evening_gap_grids': evening_gap_count,
            'needs_review_grids': needs_review_count
        },
        'bounding_box': {
            'min_lng': min_lng,
            'max_lng': max_lng,
            'min_lat': min_lat,
            'max_lat': max_lat
        }
    }

def review_heatmap_grid(grid_id: str, review_status: str, 
                        reviewed_by: str) -> HeatmapData:
    for heatmap in store.heatmaps:
        if heatmap.id == grid_id:
            heatmap.review_status = review_status
            heatmap.reviewed_by = reviewed_by
            heatmap.needs_review = False
            store.save()
            return heatmap
    return None

def get_heatmap_data() -> List[Dict]:
    return [h.to_dict() for h in store.heatmaps]

def get_heatmap_stats() -> Dict:
    total = len(store.heatmaps)
    needs_review = sum(1 for h in store.heatmaps if h.needs_review)
    has_gap = sum(1 for h in store.heatmaps if h.has_evening_gap)
    reviewed = sum(1 for h in store.heatmaps if h.reviewed_by)
    return {
        'total_grids': total,
        'needs_review': needs_review,
        'has_evening_gap': has_gap,
        'reviewed': reviewed
    }
