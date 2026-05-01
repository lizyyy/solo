import sqlite3
import shutil
import tempfile
from pathlib import Path
from typing import Dict, Any, List, Tuple


def get_db_stats(db_path: Path) -> Dict[str, Any]:
    stats = {}
    conn = sqlite3.connect(str(db_path))
    
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = cursor.fetchall()
        
        stats['tables'] = []
        stats['total_rows'] = 0
        
        for (table_name,) in tables:
            cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
            row_count = cursor.fetchone()[0]
            stats['tables'].append({
                'name': table_name,
                'rows': row_count
            })
            stats['total_rows'] += row_count
        
        cursor.execute("PRAGMA integrity_check")
        stats['integrity_check'] = cursor.fetchone()[0]
        
    finally:
        conn.close()
    
    return stats


def verify_restore(snapshot_dir: Path, db_name: str) -> Dict[str, Any]:
    temp_dir = Path(tempfile.mkdtemp())
    
    try:
        source_db = snapshot_dir / db_name
        target_db = temp_dir / db_name
        shutil.copy2(source_db, target_db)
        
        wal_path = snapshot_dir / (db_name + '-wal')
        shm_path = snapshot_dir / (db_name + '-shm')
        if wal_path.exists():
            shutil.copy2(wal_path, temp_dir)
        if shm_path.exists():
            shutil.copy2(shm_path, temp_dir)
        
        stats = get_db_stats(target_db)
        
        return {
            'verified': True,
            'temp_dir': str(temp_dir),
            'stats': stats,
            'success': stats['integrity_check'] == 'ok'
        }
    except Exception as e:
        return {
            'verified': False,
            'error': str(e),
            'success': False
        }
