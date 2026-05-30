"""pytest 配置。"""
import sys
from pathlib import Path

root_dir = Path(__file__).parent.parent
src_dir = root_dir / "src"
sys.path.insert(0, str(src_dir))

pytest_plugins = []
