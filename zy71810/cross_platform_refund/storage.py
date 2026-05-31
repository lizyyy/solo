import pickle
from pathlib import Path
from typing import Optional

from config import DATA_DIR
from core import SupplementManager

STORAGE_FILE = DATA_DIR / "supplement_data.pkl"


def save_manager(manager: SupplementManager) -> None:
    try:
        with open(STORAGE_FILE, "wb") as f:
            pickle.dump(manager, f)
    except Exception as e:
        from errors import show_warning
        show_warning(f"保存数据失败：{str(e)}", "数据只会保存在当前会话中，关闭终端后会丢失。")


def load_manager() -> Optional[SupplementManager]:
    if not STORAGE_FILE.exists():
        return None
    
    try:
        with open(STORAGE_FILE, "rb") as f:
            return pickle.load(f)
    except Exception as e:
        from errors import show_warning
        show_warning(f"读取历史数据失败：{str(e)}", "将创建新的工作区，历史数据会被覆盖。")
        return None


def clear_storage() -> None:
    if STORAGE_FILE.exists():
        STORAGE_FILE.unlink()


def get_or_create_manager() -> SupplementManager:
    manager = load_manager()
    if manager is None:
        manager = SupplementManager()
    return manager
