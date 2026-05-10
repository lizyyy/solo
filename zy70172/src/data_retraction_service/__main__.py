import sys
from pathlib import Path

src_path = Path(__file__).parent.parent
if str(src_path) not in sys.path:
    sys.path.insert(0, str(src_path))

from data_retraction_service.cli import cli

if __name__ == "__main__":
    cli()
