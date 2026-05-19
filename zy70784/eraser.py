import re
import sqlparse
from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass


@dataclass
class RiskMatch:
    original_value: str
    replaced_value: str
    rule_name: str
    rule_id: Optional[int]
    position_start: int
    position_end: int
    risk_level: str


class SQLEraser:
    def __init__(self, rules: List[Dict]):
        self.rules = rules
        self.compiled_rules = self._compile_rules()
    
    def _compile_rules(self) -> List[Tuple]:
        compiled = []
        for rule in self.rules:
            if rule.get('is_enabled', True):
                pattern = rule['pattern']
                try:
                    regex = re.compile(pattern, re.IGNORECASE)
                    compiled.append((
                        regex,
                        rule['replacement'],
                        rule['rule_name'],
                        rule.get('id'),
                        rule.get('risk_level', 'medium')
                    ))
                except re.error:
                    continue
        return compiled
    
    def parse_sql_params(self, sql_content: str) -> List[Tuple[str, int, int]]:
        params = []
        parsed = sqlparse.parse(sql_content)
        
        for stmt in parsed:
            for token in stmt.flatten():
                token_str = str(token)
                if token.ttype in (sqlparse.tokens.String.Single, 
                                   sqlparse.tokens.String.Symbol,
                                   sqlparse.tokens.Number.Integer,
                                   sqlparse.tokens.Number.Float):
                    value = token_str.strip("'\"")
                    pos = 0
                    while True:
                        start = sql_content.find(token_str, pos)
                        if start == -1:
                            break
                        end = start + len(token_str)
                        params.append((value, start, end))
                        pos = end
        
        return params
    
    def extract_params_from_dict(self, params_dict: Dict) -> List[Tuple[str, int, int]]:
        results = []
        pos = 0
        for key, value in params_dict.items():
            if isinstance(value, str):
                results.append((value, pos, pos + len(value)))
                pos += len(value) + 1
        return results
    
    def find_risk_fragments(self, content: str, params: Optional[Dict] = None) -> List[RiskMatch]:
        matches = []
        checked_positions = set()
        
        sql_params = self.parse_sql_params(content)
        if params:
            for key, value in params.items():
                if isinstance(value, str):
                    idx = content.find(value)
                    if idx != -1:
                        sql_params.append((value, idx, idx + len(value)))
        
        for value, start, end in sql_params:
            if (start, end) in checked_positions:
                continue
            
            for regex, replacement, rule_name, rule_id, risk_level in self.compiled_rules:
                if regex.search(value):
                    replaced = regex.sub(replacement, value)
                    matches.append(RiskMatch(
                        original_value=value,
                        replaced_value=replaced,
                        rule_name=rule_name,
                        rule_id=rule_id,
                        position_start=start,
                        position_end=end,
                        risk_level=risk_level
                    ))
                    checked_positions.add((start, end))
                    break
        
        return matches
    
    def apply_erasure(self, sql_content: str, risk_matches: List[RiskMatch]) -> str:
        result = sql_content
        sorted_matches = sorted(risk_matches, key=lambda x: x.position_end, reverse=True)
        
        for match in sorted_matches:
            if 0 <= match.position_start < len(result) and match.position_end <= len(result):
                original_in_sql = result[match.position_start:match.position_end]
                if match.original_value in original_in_sql or original_in_sql.strip("'\"") == match.original_value:
                    result = result[:match.position_start] + f"'{match.replaced_value}'" + result[match.position_end:]
        
        return result
    
    def highlight_risk_positions(self, sql_content: str, risk_matches: List[RiskMatch]) -> str:
        result = sql_content
        sorted_matches = sorted(risk_matches, key=lambda x: x.position_end, reverse=True)
        
        for match in sorted_matches:
            if 0 <= match.position_start < len(result) and match.position_end <= len(result):
                prefix = result[:match.position_start]
                risky = result[match.position_start:match.position_end]
                suffix = result[match.position_end:]
                result = f"{prefix}[RISK]{risky}[/RISK]{suffix}"
        
        return result
