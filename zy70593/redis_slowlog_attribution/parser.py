import re
import json
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional, Tuple


@dataclass
class SlowlogEntry:
    id: int
    timestamp: int
    duration_us: int
    command: str
    args: List[str]
    client_ip: Optional[str] = None
    client_name: Optional[str] = None
    raw_line: Optional[str] = None
    line_number: Optional[int] = None

    @property
    def duration_ms(self) -> float:
        return self.duration_us / 1000.0

    @property
    def keys(self) -> List[str]:
        return extract_keys_from_command(self.command, self.args)


@dataclass
class ParseError:
    line_number: int
    raw_content: str
    error_reason: str


@dataclass
class ParseResult:
    entries: List[SlowlogEntry] = field(default_factory=list)
    errors: List[ParseError] = field(default_factory=list)


def extract_keys_from_command(command: str, args: List[str]) -> List[str]:
    cmd_upper = command.upper()
    
    if cmd_upper in ('GET', 'SET', 'DEL', 'EXISTS', 'INCR', 'DECR', 'TTL', 'TYPE'):
        return args[:1] if args else []
    
    if cmd_upper in ('MGET', 'MSET', 'MDEL'):
        return args
    
    if cmd_upper in ('HGET', 'HSET', 'HDEL', 'HEXISTS', 'HINCRBY'):
        return args[:1] if args else []
    
    if cmd_upper in ('HMGET', 'HMSET'):
        return args[:1] if args else []
    
    if cmd_upper in ('HKEYS', 'HVALS', 'HGETALL'):
        return args[:1] if args else []
    
    if cmd_upper in ('LPUSH', 'RPUSH', 'LPOP', 'RPOP', 'LLEN', 'LRANGE'):
        return args[:1] if args else []
    
    if cmd_upper in ('SADD', 'SREM', 'SISMEMBER', 'SMEMBERS'):
        return args[:1] if args else []
    
    if cmd_upper in ('ZADD', 'ZREM', 'ZRANGE', 'ZRANK'):
        return args[:1] if args else []
    
    if cmd_upper in ('EXPIRE', 'EXPIREAT', 'PERSIST'):
        return args[:1] if args else []
    
    if cmd_upper == 'RENAME':
        return args[:2] if len(args) >= 2 else args
    
    if cmd_upper in ('BITCOUNT', 'BITOP', 'GETBIT', 'SETBIT'):
        return args[:1] if args else []
    
    if cmd_upper == 'SCAN':
        return []
    
    if cmd_upper in ('KEYS', 'SCAN'):
        return args[:1] if args else []
    
    if args:
        return args[:1]
    
    return []


class SlowlogParser:
    def __init__(self):
        self.redis_cli_pattern = re.compile(
            r'^\s*(\d+)\)\s+1\)\s+\(integer\)\s+(\d+)\s+'
            r'2\)\s+\(integer\)\s+(\d+)\s+'
            r'3\)\s+\(integer\)\s+(\d+)\s+'
            r'4\)\s+1\)\s+"([^"]+)"(.*)$',
            re.DOTALL
        )
        
        self.array_pattern = re.compile(r'^\s*\*\d+\s*$')
        self.bulk_pattern = re.compile(r'^\s*\$(\d+)\s*$')
        self.integer_pattern = re.compile(r'^\s*:\s*(\d+)\s*$')

    def parse(self, content: str) -> ParseResult:
        result = ParseResult()
        lines = content.splitlines()
        
        if self._is_json_format(lines):
            return self._parse_json(content)
        
        if self._is_redis_protocol(lines):
            return self._parse_redis_protocol(lines, result)
        
        return self._parse_redis_cli_format(lines, result)

    def _is_json_format(self, lines: List[str]) -> bool:
        for line in lines:
            stripped = line.strip()
            if stripped.startswith('[') or stripped.startswith('{'):
                return True
        return False

    def _parse_json(self, content: str) -> ParseResult:
        result = ParseResult()
        try:
            data = json.loads(content)
            if isinstance(data, list):
                for idx, item in enumerate(data):
                    try:
                        entry = self._parse_json_entry(item, idx + 1)
                        result.entries.append(entry)
                    except Exception as e:
                        result.errors.append(ParseError(
                            line_number=idx + 1,
                            raw_content=json.dumps(item),
                            error_reason=f"JSON entry parse error: {str(e)}"
                        ))
        except json.JSONDecodeError as e:
            result.errors.append(ParseError(
                line_number=1,
                raw_content=content[:200],
                error_reason=f"JSON decode error: {str(e)}"
            ))
        return result

    def _parse_json_entry(self, item: Any, line_num: int) -> SlowlogEntry:
        if isinstance(item, list):
            entry_id = int(item[0]) if len(item) > 0 else 0
            timestamp = int(item[1]) if len(item) > 1 else 0
            duration = int(item[2]) if len(item) > 2 else 0
            cmd_args = item[3] if len(item) > 3 else []
            
            if isinstance(cmd_args, list) and cmd_args:
                command = str(cmd_args[0])
                args = [str(a) for a in cmd_args[1:]]
            else:
                command = str(cmd_args)
                args = []
            
            client_ip = None
            client_name = None
            if len(item) > 4:
                client_ip = str(item[4]) if item[4] else None
            if len(item) > 5:
                client_name = str(item[5]) if item[5] else None
            
            return SlowlogEntry(
                id=entry_id,
                timestamp=timestamp,
                duration_us=duration,
                command=command,
                args=args,
                client_ip=client_ip,
                client_name=client_name,
                line_number=line_num
            )
        elif isinstance(item, dict):
            return SlowlogEntry(
                id=int(item.get('id', 0)),
                timestamp=int(item.get('timestamp', 0)),
                duration_us=int(item.get('duration_us', item.get('duration', 0))),
                command=str(item.get('command', '')),
                args=item.get('args', []),
                client_ip=item.get('client_ip'),
                client_name=item.get('client_name'),
                line_number=line_num
            )
        else:
            raise ValueError(f"Unknown entry type: {type(item)}")

    def _is_redis_protocol(self, lines: List[str]) -> bool:
        for line in lines:
            stripped = line.strip()
            if self.array_pattern.match(stripped):
                return True
            if self.bulk_pattern.match(stripped):
                return True
        return False

    def _parse_redis_protocol(self, lines: List[str], result: ParseResult) -> ParseResult:
        idx = 0
        while idx < len(lines):
            line = lines[idx].strip()
            
            if not line:
                idx += 1
                continue
            
            if self.array_pattern.match(line):
                try:
                    entry_start = idx
                    entry, idx = self._read_protocol_entry(lines, idx)
                    entry.line_number = entry_start + 1
                    result.entries.append(entry)
                except Exception as e:
                    result.errors.append(ParseError(
                        line_number=idx + 1,
                        raw_content=lines[idx] if idx < len(lines) else '',
                        error_reason=f"Protocol parse error: {str(e)}"
                    ))
                    idx += 1
            else:
                result.errors.append(ParseError(
                    line_number=idx + 1,
                    raw_content=lines[idx],
                    error_reason="Expected RESP array"
                ))
                idx += 1
        
        return result

    def _read_protocol_entry(self, lines: List[str], idx: int) -> Tuple[SlowlogEntry, int]:
        idx += 1
        
        entry_id, idx = self._read_protocol_integer(lines, idx)
        
        timestamp, idx = self._read_protocol_integer(lines, idx)
        
        duration, idx = self._read_protocol_integer(lines, idx)
        
        cmd_args, idx = self._read_protocol_array(lines, idx)
        
        client_ip = None
        client_name = None
        
        if idx < len(lines) and lines[idx].strip():
            try:
                if lines[idx].strip().startswith('$'):
                    client_ip, idx = self._read_protocol_string(lines, idx)
            except:
                pass
            
            if idx < len(lines) and lines[idx].strip():
                try:
                    if lines[idx].strip().startswith('$'):
                        client_name, idx = self._read_protocol_string(lines, idx)
                except:
                    pass
        
        command = cmd_args[0] if cmd_args else ''
        args = cmd_args[1:] if len(cmd_args) > 1 else []
        
        return SlowlogEntry(
            id=entry_id,
            timestamp=timestamp,
            duration_us=duration,
            command=command,
            args=args,
            client_ip=client_ip,
            client_name=client_name
        ), idx

    def _read_protocol_integer(self, lines: List[str], idx: int) -> Tuple[int, int]:
        while idx < len(lines) and not lines[idx].strip():
            idx += 1
        if idx >= len(lines):
            raise ValueError("Unexpected end")
        line = lines[idx].strip()
        if line.startswith(':'):
            return int(line[1:]), idx + 1
        elif '(integer)' in line:
            return int(line.split()[-1]), idx + 1
        raise ValueError(f"Expected integer: {line}")

    def _read_protocol_array(self, lines: List[str], idx: int) -> Tuple[List[str], int]:
        while idx < len(lines) and not lines[idx].strip():
            idx += 1
        if idx >= len(lines):
            return [], idx
        
        line = lines[idx].strip()
        if not line.startswith('*'):
            return [], idx
        
        count = int(line[1:])
        idx += 1
        result = []
        
        for _ in range(count):
            s, idx = self._read_protocol_string(lines, idx)
            result.append(s)
        
        return result, idx

    def _read_protocol_string(self, lines: List[str], idx: int) -> Tuple[str, int]:
        while idx < len(lines) and not lines[idx].strip():
            idx += 1
        if idx >= len(lines):
            return '', idx
        
        line = lines[idx].strip()
        if not line.startswith('$'):
            raise ValueError(f"Expected bulk string: {line}")
        
        length = int(line[1:])
        idx += 1
        
        if length == -1:
            return '', idx
        
        if idx >= len(lines):
            return '', idx
        
        result = lines[idx][:length]
        return result, idx + 1

    def _parse_redis_cli_format(self, lines: List[str], result: ParseResult) -> ParseResult:
        i = 0
        while i < len(lines):
            line = lines[i].rstrip()
            
            if not line.strip():
                i += 1
                continue
            
            if re.match(r'^ \d+\)', line):
                try:
                    entry_start = i
                    entry, i = self._read_cli_entry(lines, i)
                    entry.line_number = entry_start + 1
                    result.entries.append(entry)
                except Exception as e:
                    result.errors.append(ParseError(
                        line_number=i + 1,
                        raw_content=lines[i] if i < len(lines) else '',
                        error_reason=f"CLI format parse error: {str(e)}"
                    ))
                    i += 1
            elif re.match(r'^\s*\d+\)', line):
                result.errors.append(ParseError(
                    line_number=i + 1,
                    raw_content=lines[i],
                    error_reason="Nested entry detected, might be in wrong format"
                ))
                i += 1
            else:
                result.errors.append(ParseError(
                    line_number=i + 1,
                    raw_content=lines[i],
                    error_reason="Unexpected line format"
                ))
                i += 1
        
        return result

    def _read_cli_entry(self, lines: List[str], idx: int) -> Tuple[SlowlogEntry, int]:
        entry_id = 0
        timestamp = 0
        duration = 0
        command = ''
        args: List[str] = []
        client_ip = None
        client_name = None
        
        first_line = lines[idx].rstrip()
        
        m = re.match(r'^ (\d+)\)', first_line)
        if m:
            entry_id = int(m.group(1))
        
        field_idx = 1
        
        while idx < len(lines):
            line = lines[idx].rstrip()
            
            if re.match(r'^ \d+\)', line) and line != first_line:
                break
            
            stripped = line.strip()
            
            m_field = re.match(r'(\d+)\) ', stripped)
            if m_field:
                current_field = int(m_field.group(1))
                content = stripped[len(m_field.group(0)):]
                
                if current_field == 1 and '(integer)' in content:
                    pass
                
                elif current_field == 2 and '(integer)' in content:
                    m_val = re.search(r'\(integer\)\s+(\d+)', content)
                    if m_val:
                        timestamp = int(m_val.group(1))
                
                elif current_field == 3 and '(integer)' in content:
                    m_val = re.search(r'\(integer\)\s+(\d+)', content)
                    if m_val:
                        duration = int(m_val.group(1))
                
                elif current_field == 4:
                    cmd_parts = []
                    if '"' in content:
                        quote_parts = re.findall(r'"([^"]*)"', content)
                        if quote_parts:
                            cmd_parts.extend(quote_parts)
                    
                    idx += 1
                    while idx < len(lines):
                        next_line = lines[idx].rstrip()
                        if re.match(r'^ \d+\)', next_line):
                            break
                        
                        next_stripped = next_line.strip()
                        m_next = re.match(r'(\d+)\) ', next_stripped)
                        if m_next and int(m_next.group(1)) >= 5:
                            break
                        
                        quote_parts = re.findall(r'"([^"]*)"', next_stripped)
                        if quote_parts:
                            cmd_parts.extend(quote_parts)
                        idx += 1
                    
                    if cmd_parts:
                        command = cmd_parts[0]
                        args = cmd_parts[1:]
                    idx -= 1
                
                elif current_field == 5:
                    ip_match = re.search(r'"([^"]+)"', content)
                    if ip_match:
                        client_ip = ip_match.group(1)
                        if ':' in client_ip:
                            client_ip = client_ip.split(':')[0]
                
                elif current_field == 6:
                    name_match = re.search(r'"([^"]+)"', content)
                    if name_match:
                        client_name = name_match.group(1)
            
            idx += 1
        
        return SlowlogEntry(
            id=entry_id,
            timestamp=timestamp,
            duration_us=duration,
            command=command,
            args=args,
            client_ip=client_ip,
            client_name=client_name
        ), idx
