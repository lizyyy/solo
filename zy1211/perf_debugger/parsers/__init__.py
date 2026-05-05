"""Parsers for various Linux performance tools output."""

from pathlib import Path
import hashlib
from datetime import datetime

from .top_parser import parse_top
from .vmstat_parser import parse_vmstat
from .iostat_parser import parse_iostat
from .netstat_parser import parse_netstat
from .strace_parser import parse_strace
from .perf_script_parser import parse_perf_script
from .flame_graph_parser import parse_flame_graph
from ..database import Sample, Metric, Record


PARSERS = {
    'top': parse_top,
    'htop': parse_top,
    'vmstat': parse_vmstat,
    'iostat': parse_iostat,
    'netstat': parse_netstat,
    'ss': parse_netstat,
    'strace': parse_strace,
    'perf_script': parse_perf_script,
    'flame_graph': parse_flame_graph,
}


def calculate_file_hash(file_path: Path) -> str:
    """Calculate SHA-256 hash of a file."""
    sha256 = hashlib.sha256()
    with open(file_path, 'rb') as f:
        for chunk in iter(lambda: f.read(8192), b''):
            sha256.update(chunk)
    return sha256.hexdigest()


def detect_parser(file_path: Path) -> str:
    """Detect the type of performance sample file.
    
    Returns:
        The sample type string, or None if not detected.
    """
    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            lines = [line.strip() for line in f.readlines() if line.strip()]
        
        if not lines:
            return None
        
        first_line = lines[0]
        first_10_lines = lines[:10] if len(lines) > 10 else lines
        
        # Check for top/htop output
        if any('top -' in line for line in first_10_lines):
            if 'htop' in first_line.lower():
                return 'htop'
            return 'top'
        
        # Check for vmstat output
        if any('procs' in line and 'memory' in line and 'swap' in line for line in first_10_lines):
            return 'vmstat'
        if len(first_line.split()) >= 16 and 'r' in first_line.split()[:5]:
            header_words = first_line.split()
            if len(header_words) >= 8 and 'b' in header_words and 'swpd' in header_words:
                return 'vmstat'
        
        # Check for iostat output
        if any('avg-cpu' in line or 'Device' in line and 'tps' in line for line in first_10_lines):
            return 'iostat'
        
        # Check for netstat/ss output
        if any('Active Internet connections' in line or 'Proto' in line and 'Recv-Q' in line for line in first_10_lines):
            if 'ss' in first_line.lower()[:5]:
                return 'ss'
            return 'netstat'
        if any('State' in line and 'Recv-Q' in line and 'Send-Q' in line for line in first_10_lines):
            return 'ss'
        
        # Check for strace output
        if any('=' in line and (
            'open' in line or 'read' in line or 'write' in line or 
            'socket' in line or 'connect' in line or 'poll' in line
        ) for line in first_10_lines):
            return 'strace'
        if any('<unfinished' in line or '<...' in line for line in first_10_lines):
            return 'strace'
        
        # Check for perf script output
        if any(len(line.split()) > 5 and ':' in line.split()[1] for line in first_10_lines):
            parts = first_line.split()
            if len(parts) >= 4 and parts[1].endswith(':'):
                return 'perf_script'
        
        # Check for flame graph folded stacks
        # Format: function1;function2;function3 count
        if all(';' in line and line.split()[-1].isdigit() for line in first_10_lines if ';' in line):
            return 'flame_graph'
        
        # Fallback: try to parse as top (most common)
        if any('%CPU' in line or '%MEM' in line for line in first_10_lines):
            return 'top'
        
        return None
        
    except Exception:
        return None


def parse_file(db, session, file_path: Path, sample_type: str):
    """Parse a sample file and import into database.
    
    Args:
        db: Database session
        session: Session object
        file_path: Path to the sample file
        sample_type: Type of sample (top, vmstat, etc.)
    
    Returns:
        Dictionary with import statistics
    """
    file_hash = calculate_file_hash(file_path)
    
    existing = db.query(Sample).filter_by(
        session_id=session.id,
        file_hash=file_hash
    ).first()
    
    if existing:
        raise ValueError(f"File already imported: {file_path}")
    
    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
        raw_content = f.read()
    
    sample = Sample(
        session_id=session.id,
        sample_type=sample_type,
        file_path=str(file_path),
        file_hash=file_hash,
        raw_content=raw_content,
        imported_at=datetime.utcnow()
    )
    
    db.add(sample)
    db.flush()
    
    parser = PARSERS.get(sample_type)
    if not parser:
        raise ValueError(f"Unknown sample type: {sample_type}")
    
    result = parser(db, sample, raw_content)
    
    if session.start_time is None or result.get('min_time') < session.start_time:
        session.start_time = result.get('min_time')
    if session.end_time is None or result.get('max_time') > session.end_time:
        session.end_time = result.get('max_time')
    
    return result
