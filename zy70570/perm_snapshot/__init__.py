#!/usr/bin/env python3
"""Linux权限快照CLI工具 - 用于目录权限基线管理和差异对比"""

__version__ = "1.0.0"
__author__ = "Permission Snapshot Team"

from .scanner import PermissionEntry, PermissionScanner
from .snapshot import SnapshotManager
from .diff import DiffResult, Differ
from .reporter import Reporter
