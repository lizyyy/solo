import re
from datetime import datetime
from typing import List, Tuple, Optional, Set
from sqlglot import parse, exp
from sqlglot.errors import ParseError
from .models import SlowQuery


class SlowQueryParser:
    def __init__(self):
        self.digest_patterns = [
            (re.compile(r'\?'), '?'),
            (re.compile(r"'[^']*'"), "'STRING'"),
            (re.compile(r"\b\d+\b"), "NUM"),
            (re.compile(r'\s+'), ' '),
        ]

    def parse_mysql_log(self, file_path: str) -> List[SlowQuery]:
        queries = []
        current_query = ""
        current_time = None
        current_execution_time = None
        current_database = None
        in_query = False

        time_pattern = re.compile(r'# Time: (\d{6}\s+\d{2}:\d{2}:\d{2})')
        user_host_pattern = re.compile(r'# User@Host:.*')
        query_time_pattern = re.compile(r'# Query_time:\s+([\d.]+).*')
        db_pattern = re.compile(r'USE\s+(\w+)', re.IGNORECASE)
        use_statement_pattern = re.compile(r'^use\s+\w+', re.IGNORECASE)
        set_statement_pattern = re.compile(r'^set\s+', re.IGNORECASE)

        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.rstrip('\n')
                    
                    time_match = time_pattern.match(line)
                    if time_match:
                        if current_query and current_time:
                            query = self._process_query(
                                current_time, current_execution_time,
                                current_database, current_query
                            )
                            if query:
                                queries.append(query)
                        
                        time_str = time_match.group(1)
                        current_time = datetime.strptime(time_str, '%y%m%d %H:%M:%S')
                        current_query = ""
                        current_execution_time = None
                        in_query = False
                        continue

                    query_time_match = query_time_pattern.match(line)
                    if query_time_match:
                        current_execution_time = float(query_time_match.group(1))
                        continue

                    if user_host_pattern.match(line):
                        continue

                    if line.startswith('#'):
                        continue

                    db_match = db_pattern.match(line)
                    if db_match:
                        current_database = db_match.group(1)
                        continue

                    if not line.strip():
                        continue

                    if use_statement_pattern.match(line) or set_statement_pattern.match(line):
                        continue

                    if line.strip():
                        if not in_query:
                            in_query = True
                        current_query += line + " "

                if current_query and current_time:
                    query = self._process_query(
                        current_time, current_execution_time,
                        current_database, current_query
                    )
                    if query:
                        queries.append(query)

        except FileNotFoundError:
            print(f"错误: 找不到文件 {file_path}")
        except Exception as e:
            print(f"解析日志文件时出错: {str(e)}")

        return queries

    def _process_query(
        self, query_time: datetime, execution_time: float,
        database: str, sql: str
    ) -> Optional[SlowQuery]:
        sql = sql.strip()
        if not sql or not sql.endswith(';'):
            sql += ';'

        try:
            tables = self._extract_tables(sql)
            sql_digest = self._generate_digest(sql)
            
            return SlowQuery(
                query_time=query_time,
                execution_time=execution_time if execution_time else 0.0,
                database=database if database else "unknown",
                tables=tables,
                raw_sql=sql,
                sql_digest=sql_digest
            )
        except Exception as e:
            return SlowQuery(
                query_time=query_time,
                execution_time=execution_time if execution_time else 0.0,
                database=database if database else "unknown",
                tables=[],
                raw_sql=sql,
                sql_digest="",
                error=f"解析失败: {str(e)}"
            )

    def _extract_tables(self, sql: str) -> List[str]:
        tables = set()
        
        try:
            parsed = parse(sql, read="mysql")
            if parsed:
                for ast in parsed:
                    if ast:
                        for table in ast.find_all(exp.Table):
                            table_name = table.name
                            if table_name:
                                tables.add(table_name.lower())
        except ParseError:
            pass
        except Exception:
            pass

        if not tables:
            simple_pattern = re.compile(r'\b(FROM|JOIN|UPDATE|INTO)\s+(\w+)', re.IGNORECASE)
            for match in simple_pattern.finditer(sql):
                tables.add(match.group(2).lower())

        return sorted(list(tables))

    def _generate_digest(self, sql: str) -> str:
        digest = sql.lower()
        for pattern, replacement in self.digest_patterns:
            digest = pattern.sub(replacement, digest)
        return digest.strip()

    def parse_simple_format(self, file_path: str) -> List[SlowQuery]:
        queries = []
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                for line_num, line in enumerate(f, 1):
                    line = line.strip()
                    if not line or line.startswith('#'):
                        continue
                    
                    parts = line.split('|')
                    if len(parts) >= 4:
                        try:
                            time_str = parts[0].strip()
                            query_time = datetime.strptime(time_str, '%Y-%m-%d %H:%M:%S')
                            execution_time = float(parts[1].strip())
                            database = parts[2].strip()
                            sql = parts[3].strip()
                            
                            tables = self._extract_tables(sql)
                            sql_digest = self._generate_digest(sql)
                            
                            queries.append(SlowQuery(
                                query_time=query_time,
                                execution_time=execution_time,
                                database=database,
                                tables=tables,
                                raw_sql=sql,
                                sql_digest=sql_digest
                            ))
                        except Exception as e:
                            queries.append(SlowQuery(
                                query_time=datetime.now(),
                                execution_time=0.0,
                                database="unknown",
                                tables=[],
                                raw_sql=line,
                                sql_digest="",
                                error=f"第 {line_num} 行解析失败: {str(e)}"
                            ))
        except FileNotFoundError:
            print(f"错误: 找不到文件 {file_path}")
        except Exception as e:
            print(f"解析文件时出错: {str(e)}")

        return queries
