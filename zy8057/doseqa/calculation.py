import numpy as np
from scipy.spatial import KDTree
from typing import Dict, List, Tuple


def interpolate_dose(plan_coords: np.ndarray, plan_doses: np.ndarray, 
                     target_coords: np.ndarray) -> np.ndarray:
    tree = KDTree(plan_coords)
    distances, indices = tree.query(target_coords, k=4)
    weights = 1.0 / (distances + 1e-10)
    weights = weights / weights.sum(axis=1, keepdims=True)
    return np.sum(plan_doses[indices] * weights, axis=1)


def calculate_gamma(measured: np.ndarray, plan: np.ndarray, 
                    dd_threshold: float = 0.03, dta_threshold: float = 3.0,
                    global_norm: float = None) -> Tuple[np.ndarray, float]:
    if global_norm is None:
        global_norm = np.max(plan)
    gamma_values = []
    for m, p in zip(measured, plan):
        dd = abs(m - p) / global_norm
        dta = 0.0
        gamma = np.sqrt((dd / dd_threshold)**2 + (dta / dta_threshold)**2)
        gamma_values.append(gamma)
    gamma_arr = np.array(gamma_values)
    pass_rate = np.mean(gamma_arr <= 1.0) * 100
    return gamma_arr, pass_rate


def structure_dose_stats(plan_coords: np.ndarray, plan_doses: np.ndarray,
                        structure_contours: List[np.ndarray]) -> Dict:
    if not structure_contours:
        return {'max_dose': 0.0, 'mean_dose': 0.0, 'min_dose': 0.0, 'volume': 0}
    all_points = []
    for contour in structure_contours:
        all_points.extend(contour)
    all_points = np.array(all_points)
    if len(all_points) == 0:
        return {'max_dose': 0.0, 'mean_dose': 0.0, 'min_dose': 0.0, 'volume': 0}
    interpolated = interpolate_dose(plan_coords, plan_doses, all_points)
    return {
        'max_dose': float(np.max(interpolated)),
        'mean_dose': float(np.mean(interpolated)),
        'min_dose': float(np.min(interpolated)),
        'volume': len(all_points)
    }
