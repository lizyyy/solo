#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
小剧场舞台监督工具
一个用于管理剧场演出道具、演员、场次的桌面应用程序。
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from gui import main


if __name__ == '__main__':
    main()
