#!/usr/bin/env python3
"""权限扫描模块 - 负责目录遍历和权限信息采集"""

import os
import stat
import pwd
import grp
import subprocess
from dataclasses import dataclass
from typing import List, Dict, Optional, Tuple


@dataclass
class PermissionEntry:
    """权限条目数据类"""
    path: str
    file_type: str
    mode: str
    mode_octal: str
    owner: str
    owner_uid: int
    group: str
    group_gid: int
    size: int
    mtime: float
    acl: List[str]
    error: Optional[str] = None


class PermissionScanner:
    """权限扫描器 - 扫描目录并采集文件权限信息"""

    def __init__(self, root_path: str, recursive: bool = True):
        self.root_path = os.path.abspath(root_path)
        self.recursive = recursive
        self.entries: List[PermissionEntry] = []
        self.errors: List[Dict] = []

    def _get_file_type(self, mode: int) -> str:
        """获取文件类型"""
        if stat.S_ISDIR(mode):
            return "directory"
        elif stat.S_ISREG(mode):
            return "file"
        elif stat.S_ISLNK(mode):
            return "symlink"
        elif stat.S_ISCHR(mode):
            return "char_device"
        elif stat.S_ISBLK(mode):
            return "block_device"
        elif stat.S_ISFIFO(mode):
            return "fifo"
        elif stat.S_ISSOCK(mode):
            return "socket"
        else:
            return "unknown"

    def _mode_to_string(self, mode: int) -> str:
        """将权限模式转换为字符串表示"""
        perms = []
        for _ in range(3):
            perm = ""
            if mode & stat.S_IRUSR:
                perm += "r"
            else:
                perm += "-"
            if mode & stat.S_IWUSR:
                perm += "w"
            else:
                perm += "-"
            if mode & stat.S_IXUSR:
                perm += "x"
            else:
                perm += "-"
            perms.append(perm)
            mode <<= 3
        return "".join(perms)

    def _mode_to_octal(self, mode: int) -> str:
        """将权限模式转换为八进制字符串"""
        return oct(stat.S_IMODE(mode))[2:].zfill(3)

    def _get_acl(self, path: str) -> List[str]:
        """读取文件的ACL信息"""
        try:
            result = subprocess.run(
                ["getfacl", "-c", "-p", path],
                capture_output=True,
                text=True,
                timeout=5
            )
            if result.returncode == 0:
                acl_lines = [line.strip() for line in result.stdout.strip().split("\n") if line.strip()]
                return acl_lines
            return []
        except (subprocess.TimeoutExpired, FileNotFoundError, Exception):
            return []

    def _get_owner_group_names(self, st: os.stat_result) -> Tuple[str, str]:
        """获取所有者和组的名称"""
        try:
            owner = pwd.getpwuid(st.st_uid).pw_name
        except (KeyError, ValueError):
            owner = f"UID:{st.st_uid}"
        
        try:
            group = grp.getgrgid(st.st_gid).gr_name
        except (KeyError, ValueError):
            group = f"GID:{st.st_gid}"
        
        return owner, group

    def _scan_entry(self, path: str) -> Optional[PermissionEntry]:
        """扫描单个文件或目录的权限信息"""
        try:
            st = os.lstat(path)
            file_type = self._get_file_type(st.st_mode)
            mode_str = self._mode_to_string(st.st_mode)
            mode_octal = self._mode_to_octal(st.st_mode)
            owner, group = self._get_owner_group_names(st)
            acl = self._get_acl(path)
            
            return PermissionEntry(
                path=path,
                file_type=file_type,
                mode=mode_str,
                mode_octal=mode_octal,
                owner=owner,
                owner_uid=st.st_uid,
                group=group,
                group_gid=st.st_gid,
                size=st.st_size,
                mtime=st.st_mtime,
                acl=acl
            )
        except Exception as e:
            error_msg = str(e)
            error_type = type(e).__name__
            self.errors.append({
                "path": path,
                "error": error_msg,
                "error_type": error_type
            })
            return PermissionEntry(
                path=path,
                file_type="error",
                mode="",
                mode_octal="",
                owner="",
                owner_uid=0,
                group="",
                group_gid=0,
                size=0,
                mtime=0,
                acl=[],
                error=error_msg
            )

    def scan(self) -> Tuple[List[PermissionEntry], List[Dict]]:
        """执行扫描，返回权限条目列表和错误列表"""
        self.entries = []
        self.errors = []
        
        if not os.path.exists(self.root_path):
            self.errors.append({
                "path": self.root_path,
                "error": "Path does not exist",
                "error_type": "FileNotFoundError"
            })
            return self.entries, self.errors
        
        if os.path.isdir(self.root_path) and self.recursive:
            for root, dirs, files in os.walk(self.root_path, followlinks=False):
                for name in dirs + files:
                    full_path = os.path.join(root, name)
                    entry = self._scan_entry(full_path)
                    if entry:
                        self.entries.append(entry)
        else:
            entry = self._scan_entry(self.root_path)
            if entry:
                self.entries.append(entry)
        
        return self.entries, self.errors
