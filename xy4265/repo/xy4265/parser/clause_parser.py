#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
条款JSON解析器
"""

import json
from typing import List, Dict, Any, Optional
from models.data_models import Clause


class ClauseParser:
    """条款解析器"""
    
    @staticmethod
    def parse_file(file_path: str) -> List[Clause]:
        """从文件解析条款"""
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return ClauseParser.parse(data)
    
    @staticmethod
    def parse(data: List[Dict[str, Any]]) -> List[Clause]:
        """解析条款数据"""
        clauses = []
        clause_map = {}
        
        for item in data:
            clause = Clause(
                clause_id=item.get('clause_id', item.get('id', '')),
                title=item.get('title', item.get('name', '')),
                content=item.get('content', ''),
                parent_id=item.get('parent_id', item.get('parent')),
                order=item.get('order', item.get('index', 0)),
                metadata=item.get('metadata', item.get('meta', {}))
            )
            clause_map[clause.clause_id] = clause
            clauses.append(clause)
        
        for clause in clauses:
            if clause.parent_id and clause.parent_id in clause_map:
                clause_map[clause.parent_id].children.append(clause)
        
        root_clauses = [c for c in clauses if not c.parent_id]
        root_clauses.sort(key=lambda x: x.order)
        return root_clauses
    
    @staticmethod
    def flatten_clauses(clauses: List[Clause]) -> List[Clause]:
        """将条款树扁平化"""
        result = []
        for clause in clauses:
            result.append(clause)
            result.extend(ClauseParser.flatten_clauses(clause.children))
        return result
