import os
import stat
import pwd
import grp
import subprocess
from dataclasses import dataclass, asdict
from typing import List, Dict, Optional, Tuple
import json


@dataclass
class PermissionEntry:
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
