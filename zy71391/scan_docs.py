#!/usr/bin/env python3
"""文档链接腐烂扫描工具 - 主入口脚本。

使用方法:
    python -m linkrot.cli scan ./sample_docs --skip-external
    python -m linkrot.cli scan ./sample_docs
"""

from linkrot.cli import main

if __name__ == "__main__":
    raise SystemExit(main())
