import json
from datetime import datetime
from typing import Dict


def export_cam_manifest(manifest: Dict, output_path: str):
    manifest["generated_at"] = datetime.now().isoformat()
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
