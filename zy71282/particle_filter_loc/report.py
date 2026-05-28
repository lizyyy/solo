import datetime
from .io_utils import save_json


def generate_report(run_id, inputs, conflicts, noise_alerts, filter_alerts,
                    obstacle_alerts, trajectory_result, resample_events, params):
    now = datetime.datetime.now()
    report = {
        "run_id": run_id,
        "timestamp": now.strftime("%Y-%m-%dT%H:%M:%S"),
        "input_summary": {
            "map_id": _first_id(inputs.get("maps", [])),
            "odometry_id": _first_id(inputs.get("odometry", [])),
            "observations_id": _first_id(inputs.get("observations", [])),
            "params_id": _first_id(inputs.get("params", [])),
        },
        "conflicts": conflicts,
        "alerts": {
            "excessive_noise": noise_alerts,
            "degeneration": [a for a in filter_alerts if a["type"] == "degeneration"],
            "obstacle_crossing": [a for a in filter_alerts if a["type"] == "obstacle_crossing"],
            "obstacle_crossing_estimated": [a for a in obstacle_alerts if a["type"] == "obstacle_crossing_estimated"],
        },
        "resample_events": resample_events,
        "trajectory_comparison": trajectory_result,
        "parameters_used": params,
    }
    return report


def save_report(output_dir, report):
    path = save_json(
        _path(output_dir, "report.json"),
        report
    )
    return path


def save_params(output_dir, params):
    path = save_json(
        _path(output_dir, "params_used.json"),
        params
    )
    return path


def save_trajectory(output_dir, trajectory_result):
    path = save_json(
        _path(output_dir, "trajectory_comparison.json"),
        trajectory_result
    )
    return path


def save_estimated_trajectory(output_dir, positions):
    data = [
        {"step": i, "x": round(p[0], 4), "y": round(p[1], 4), "theta": round(p[2], 4)}
        for i, p in enumerate(positions)
    ]
    path = save_json(
        _path(output_dir, "estimated_trajectory.json"),
        {"positions": data}
    )
    return path


def save_ground_truth(output_dir, positions):
    data = [
        {"step": i, "x": round(p[0], 4), "y": round(p[1], 4), "theta": round(p[2], 4)}
        for i, p in enumerate(positions)
    ]
    path = save_json(
        _path(output_dir, "ground_truth.json"),
        {"positions": data}
    )
    return path


def _first_id(items):
    if items:
        return items[0].get("id", "")
    return ""


def _path(output_dir, filename):
    import os
    return os.path.join(output_dir, filename)
