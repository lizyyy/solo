import math
import numpy as np


def compare_trajectories(estimated, ground_truth):
    results = []
    min_len = min(len(estimated), len(ground_truth))

    for i in range(min_len):
        e = estimated[i]
        g = ground_truth[i]
        pos_err = math.sqrt((e[0] - g[0]) ** 2 + (e[1] - g[1]) ** 2)
        angle_diff = abs(e[2] - g[2])
        angle_diff = min(angle_diff, 2 * math.pi - angle_diff)
        results.append({
            "step": i,
            "estimated": {"x": round(e[0], 4), "y": round(e[1], 4), "theta": round(e[2], 4)},
            "ground_truth": {"x": round(g[0], 4), "y": round(g[1], 4), "theta": round(g[2], 4)},
            "position_error": round(pos_err, 4),
            "angle_error": round(angle_diff, 4)
        })

    if not results:
        return {"steps": [], "summary": {"mean_pos_error": 0, "max_pos_error": 0,
                                          "mean_angle_error": 0, "max_angle_error": 0}}

    pos_errors = [r["position_error"] for r in results]
    angle_errors = [r["angle_error"] for r in results]

    summary = {
        "mean_pos_error": round(float(np.mean(pos_errors)), 4),
        "max_pos_error": round(float(np.max(pos_errors)), 4),
        "mean_angle_error": round(float(np.mean(angle_errors)), 4),
        "max_angle_error": round(float(np.max(angle_errors)), 4),
    }

    return {"steps": results, "summary": summary}
