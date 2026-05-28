import os
import json
import glob
import re


def versioned_path(filepath):
    if not os.path.exists(filepath):
        return filepath
    base, ext = os.path.splitext(filepath)
    version = 2
    while True:
        candidate = f"{base}_v{version}{ext}"
        if not os.path.exists(candidate):
            return candidate
        version += 1


def save_json(filepath, data):
    actual = versioned_path(filepath)
    os.makedirs(os.path.dirname(actual), exist_ok=True)
    with open(actual, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    return actual


def load_json(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        return json.load(f)


def load_json_dir(directory):
    results = []
    if not os.path.isdir(directory):
        return results
    for fp in sorted(glob.glob(os.path.join(directory, "*.json"))):
        try:
            data = load_json(fp)
            data["_source_file"] = os.path.basename(fp)
            results.append(data)
        except (json.JSONDecodeError, IOError):
            pass
    return results


def collect_inputs(input_dir):
    files = {
        "maps": [],
        "odometry": [],
        "observations": [],
        "params": [],
    }
    map_dir = os.path.join(input_dir, "maps")
    odom_dir = os.path.join(input_dir, "odometry")
    obs_dir = os.path.join(input_dir, "observations")
    param_dir = os.path.join(input_dir, "params")

    for name, subdir in [
        ("maps", map_dir),
        ("odometry", odom_dir),
        ("observations", obs_dir),
        ("params", param_dir),
    ]:
        if os.path.isdir(subdir):
            files[name] = load_json_dir(subdir)

    singular = {"maps": "map", "odometry": "odometry", "observations": "observations", "params": "params"}
    for name in ["maps", "odometry", "observations", "params"]:
        for variant in [name, singular[name]]:
            fallback = os.path.join(input_dir, f"{variant}.json")
            if not files[name] and os.path.isfile(fallback):
                data = load_json(fallback)
                data["_source_file"] = f"{variant}.json"
                files[name] = [data]

    return files
