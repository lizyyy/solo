import json
import os
from datetime import datetime
from typing import List, Optional, Dict, Any
import uuid

from ..models import DJShow


class ShowStorage:
    def __init__(self, data_dir: str = "data"):
        self.data_dir = data_dir
        self.shows_dir = os.path.join(data_dir, "shows")
        os.makedirs(self.shows_dir, exist_ok=True)

    def _get_show_path(self, show_id: str) -> str:
        return os.path.join(self.shows_dir, f"{show_id}.json")

    def save_show(self, show: DJShow) -> str:
        path = self._get_show_path(show.id)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(show.dict(), f, ensure_ascii=False, indent=2, default=str)
        return path

    def load_show(self, show_id: str) -> Optional[DJShow]:
        path = self._get_show_path(show_id)
        if not os.path.exists(path):
            return None
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return DJShow.parse_obj(data)

    def list_shows(self) -> List[Dict[str, Any]]:
        shows = []
        for filename in os.listdir(self.shows_dir):
            if filename.endswith(".json"):
                show_id = filename[:-5]
                show = self.load_show(show_id)
                if show:
                    shows.append({
                        "id": show.id,
                        "name": show.name,
                        "date": show.date.strftime("%Y-%m-%d") if show.date else "",
                        "venue": show.venue,
                        "dj_name": show.dj_name,
                        "workflow_stage": show.workflow_stage.value,
                        "batches": len(show.batches),
                    })
        return sorted(shows, key=lambda x: x["date"], reverse=True)

    def delete_show(self, show_id: str) -> bool:
        path = self._get_show_path(show_id)
        if os.path.exists(path):
            os.remove(path)
            return True
        return False

    def export_replay_script(self, show_id: str, output_path: str) -> str:
        show = self.load_show(show_id)
        if not show:
            raise ValueError(f"未找到场次: {show_id}")

        script_lines = [
            "#!/usr/bin/env python3",
            f'# 复盘脚本: {show.name} - {show.date.strftime("%Y-%m-%d")}',
            f'# 生成时间: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}',
            "# 此脚本可完整复现该场次的所有操作",
            "",
            "import sys",
            "sys.path.insert(0, '.')",
            "",
            "from datetime import datetime",
            "from src.models import *",
            "from src.importer import ImportEngine",
            "from src.rules import BoundaryRuleEngine",
            "from src.workflow import WorkflowEngine",
            "from src.history import HistoryEngine",
            "from src.storage import ShowStorage",
            "",
            f"storage = ShowStorage()",
            "",
            f"# ========== 1. 创建场次 ==========",
            f"show = DJShow(",
            f'    id="{show.id}",',
            f'    name="{show.name}",',
            f'    date=datetime.fromisoformat("{show.date.isoformat()}"),',
            f'    venue="{show.venue}",',
            f'    dj_name="{show.dj_name}",',
            f")",
            "",
        ]

        for i, imp in enumerate(show.rehearsal_imports):
            script_lines.extend([
                f"# ========== 导入排练群接龙 ({i+1}/{len(show.rehearsal_imports)}) ==========",
                f'raw_content_{i} = """{imp.raw_content}"""',
                f"result = ImportEngine.import_rehearsal(",
                f"    show=show,",
                f'    source_filename="{imp.source_filename}",',
                f"    raw_content=raw_content_{i},",
                f'    imported_by="{imp.imported_by}",',
                f")",
                "print('导入结果:', result)",
                "",
            ])

        for i, screenshot in enumerate(show.contract_screenshots):
            script_lines.extend([
                f"# ========== 上传合同截图 ({i+1}/{len(show.contract_screenshots)}) ==========",
                f"WorkflowEngine.upload_contract_screenshot(",
                f"    show=show,",
                f'    image_path="{screenshot.image_path}",',
                f'    uploaded_by="{screenshot.uploaded_by}",',
                f'    ocr_text={json.dumps(screenshot.ocr_text, ensure_ascii=False) if screenshot.ocr_text else None},',
                f'    linked_batch_ids={screenshot.linked_batch_ids},',
                f'    note={json.dumps(screenshot.note, ensure_ascii=False) if screenshot.note else None},',
                f")",
                "",
            ])

        for i, mod in enumerate(show.modification_history):
            script_lines.extend([
                f"# ========== 修改记录 ({i+1}/{len(show.modification_history)}) ==========",
                f"# [{mod.modified_at}] {mod.modified_by} 修改 {mod.entity_type}.{mod.field_name}",
                f"# {mod.old_value} → {mod.new_value}",
                f"# 原因: {mod.reason or '无'}",
                "",
            ])

        script_lines.extend([
            f"# ========== 保存结果 ==========",
            f"storage.save_show(show)",
            'print("场次已保存:", show.id)',
            'print("当前阶段:", WorkflowEngine.get_stage_description(show.workflow_stage))',
            'print("复盘完成!")',
            "",
        ])

        with open(output_path, "w", encoding="utf-8") as f:
            f.write("\n".join(script_lines))

        os.chmod(output_path, 0o755)
        return output_path
