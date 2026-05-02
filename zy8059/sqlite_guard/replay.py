import sqlite3
import json
from pathlib import Path
from typing import List, Dict, Any


def replay_writes(db_path: Path, jsonl_path: Path) -> List[Dict[str, Any]]:
    results = []
    conn = sqlite3.connect(str(db_path))
    
    try:
        with open(jsonl_path, 'r', encoding='utf-8') as f:
            for line_num, line in enumerate(f, 1):
                line = line.strip()
                if not line:
                    continue
                
                try:
                    data = json.loads(line)
                    sql = data.get('sql')
                    params = data.get('params', [])
                    
                    if sql:
                        cursor = conn.cursor()
                        cursor.execute(sql, params)
                        conn.commit()
                        
                        results.append({
                            'line': line_num,
                            'status': 'success',
                            'sql': sql,
                            'rows_affected': cursor.rowcount
                        })
                    else:
                        results.append({
                            'line': line_num,
                            'status': 'skipped',
                            'reason': 'no_sql'
                        })
                except Exception as e:
                    conn.rollback()
                    results.append({
                        'line': line_num,
                        'status': 'error',
                        'error': str(e)
                    })
    finally:
        conn.close()
    
    return results
