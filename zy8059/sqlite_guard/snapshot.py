import sqlite3
import shutil
import json
import hashlib
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, Optional


def check_wal_state(db_path: Path) -> Dict[str, Any]:
    wal_path = db_path.with_suffix(db_path.suffix + '-wal')
    shm_path = db_path.with_suffix(db_path.suffix + '-shm')
    
    state = {
        'db_exists': db_path.exists(),
        'wal_exists': wal_path.exists(),
        'shm_exists': shm_path.exists(),
        'wal_size': wal_path.stat().st_size if wal_path.exists() else 0,
        'wal_pages': 0
    }
    
    if db_path.exists():
        try:
            conn = sqlite3.connect(str(db_path))
            cursor = conn.cursor()
            cursor.execute("PRAGMA wal_autocheckpoint")
            state['wal_autocheckpoint'] = cursor.fetchone()[0]
            cursor.execute("PRAGMA journal_mode")
            state['journal_mode'] = cursor.fetchone()[0]
            conn.close()
        except Exception as e:
            state['error'] = str(e)
    
    return state


def create_snapshot(db_path: Path, target_dir: Path, auto_checkpoint: bool = True) -> Dict[str, Any]:
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    snapshot_dir = target_dir / f"snapshot_{timestamp}"
    snapshot_dir.mkdir(parents=True, exist_ok=True)
    
    snapshot_db = snapshot_dir / db_path.name
    
    wal_path = db_path.with_suffix(db_path.suffix + '-wal')
    shm_path = db_path.with_suffix(db_path.suffix + '-shm')
    
    if auto_checkpoint and wal_path.exists():
        conn = sqlite3.connect(str(db_path))
        cursor = conn.cursor()
        cursor.execute("PRAGMA wal_checkpoint(TRUNCATE)")
        conn.commit()
        conn.close()
    
    shutil.copy2(db_path, snapshot_db)
    
    if wal_path.exists():
        shutil.copy2(wal_path, snapshot_dir / wal_path.name)
    if shm_path.exists():
        shutil.copy2(shm_path, snapshot_dir / shm_path.name)
    
    manifest = {
        'timestamp': timestamp,
        'db_name': db_path.name,
        'db_size': db_path.stat().st_size,
        'db_hash': compute_file_hash(db_path),
        'wal_exists': wal_path.exists(),
        'shm_exists': shm_path.exists(),
        'snapshot_dir': str(snapshot_dir),
        'created_at': datetime.now().isoformat()
    }
    
    manifest_path = snapshot_dir / 'manifest.json'
    with open(manifest_path, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
    
    return manifest


def compute_file_hash(file_path: Path) -> str:
    sha256_hash = hashlib.sha256()
    with open(file_path, "rb") as f:
        for byte_block in iter(lambda: f.read(4096), b""):
            sha256_hash.update(byte_block)
    return sha256_hash.hexdigest()
