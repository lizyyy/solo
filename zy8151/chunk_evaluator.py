#!/usr/bin/env python3
"""
RAG 知识库切片回归评测工具
用于在修改切片策略前进行离线评测对比
"""

import os
import re
import csv
import json
import hashlib
import argparse
from pathlib import Path
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass, field
from collections import defaultdict

import yaml
import jieba
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer


@dataclass
class ChunkPolicy:
    name: str
    max_chunk_size: int = 800
    min_chunk_size: int = 50
    split_on_headings: bool = True
    heading_levels: List[int] = field(default_factory=lambda: [1, 2, 3])
    keep_section_context: bool = True
    paragraph_separator: str = '\n\n'


@dataclass
class Chunk:
    id: str
    content: str
    file_path: str
    start_line: int
    end_line: int
    headings: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class QaCase:
    id: str
    question: str
    expected_answers: List[str]
    expected_file_paths: List[str]


@dataclass
class Issue:
    category: str
    severity: str
    policy_name: str
    file_path: str
    chunk_id: Optional[str]
    message: str
    context: str = ''


@dataclass
class RetrievalResult:
    chunk_id: str
    score: float
    rank: int
    content: str
    file_path: str


class PolicyParser:
    @staticmethod
    def parse(file_path: str) -> List[ChunkPolicy]:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f)
        
        policies = []
        for policy_data in data.get('policies', []):
            policy = ChunkPolicy(
                name=policy_data['name'],
                max_chunk_size=policy_data.get('max_chunk_size', 800),
                min_chunk_size=policy_data.get('min_chunk_size', 50),
                split_on_headings=policy_data.get('split_on_headings', True),
                heading_levels=policy_data.get('heading_levels', [1, 2, 3]),
                keep_section_context=policy_data.get('keep_section_context', True),
                paragraph_separator=policy_data.get('paragraph_separator', '\n\n')
            )
            policies.append(policy)
        
        return policies


class MarkdownParser:
    HEADING_PATTERN = re.compile(r'^(#{1,6})\s+(.+?)\s*$', re.MULTILINE)
    CODE_BLOCK_PATTERN = re.compile(r'```[\s\S]*?```', re.MULTILINE)
    
    @staticmethod
    def extract_headings(content: str) -> List[Tuple[int, int, int, str]]:
        headings = []
        for match in MarkdownParser.HEADING_PATTERN.finditer(content):
            level = len(match.group(1))
            start_pos = match.start()
            end_pos = match.end()
            text = match.group(2).strip()
            headings.append((level, start_pos, end_pos, text))
        return headings
    
    @staticmethod
    def split_by_headings(content: str, headings: List[Tuple], 
                           allowed_levels: List[int]) -> List[Tuple[int, int, List[str]]]:
        sections = []
        filtered_headings = [(l, s, e, t) for l, s, e, t in headings if l in allowed_levels]
        
        current_headings = []
        last_pos = 0
        
        for i, (level, start_pos, end_pos, text) in enumerate(filtered_headings):
            while current_headings and current_headings[-1][0] >= level:
                current_headings.pop()
            
            if last_pos < start_pos:
                sections.append((
                    last_pos,
                    start_pos,
                    [h[1] for h in current_headings]
                ))
            
            current_headings.append((level, text))
            last_pos = start_pos
        
        if last_pos < len(content):
            sections.append((
                last_pos,
                len(content),
                [h[1] for h in current_headings]
            ))
        
        return sections


class Chunker:
    def __init__(self, policy: ChunkPolicy):
        self.policy = policy
    
    def chunk_file(self, file_path: str) -> List[Chunk]:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        lines = content.split('\n')
        headings = MarkdownParser.extract_headings(content)
        chunks = []
        
        if self.policy.split_on_headings:
            sections = MarkdownParser.split_by_headings(
                content, headings, self.policy.heading_levels
            )
            
            for start_pos, end_pos, section_headings in sections:
                section_content = content[start_pos:end_pos].strip()
                if not section_content:
                    continue
                
                sub_chunks = self._split_by_size(
                    section_content, file_path, start_pos, section_headings
                )
                chunks.extend(sub_chunks)
        else:
            chunks = self._split_by_size(content, file_path, 0, [])
        
        return chunks
    
    def _split_by_size(self, content: str, file_path: str, 
                        base_pos: int, headings: List[str]) -> List[Chunk]:
        chunks = []
        paragraphs = content.split(self.policy.paragraph_separator)
        
        current_content = []
        current_size = 0
        start_line = self._pos_to_line(base_pos + content.find(paragraphs[0]) if paragraphs else base_pos)
        
        for para in paragraphs:
            para_stripped = para.strip()
            if not para_stripped:
                continue
            
            para_size = len(para_stripped)
            
            if current_size + para_size > self.policy.max_chunk_size and current_content:
                chunk_content = self.policy.paragraph_separator.join(current_content)
                chunks.append(self._create_chunk(
                    chunk_content, file_path, start_line,
                    self._pos_to_line(base_pos + content.find(para)),
                    headings
                ))
                
                current_content = [para_stripped]
                current_size = para_size
                start_line = self._pos_to_line(base_pos + content.find(para))
            else:
                current_content.append(para_stripped)
                current_size += para_size
        
        if current_content:
            chunk_content = self.policy.paragraph_separator.join(current_content)
            chunks.append(self._create_chunk(
                chunk_content, file_path, start_line,
                self._pos_to_line(base_pos + len(content)),
                headings
            ))
        
        return chunks
    
    def _pos_to_line(self, pos: int) -> int:
        return pos // 80 + 1
    
    def _create_chunk(self, content: str, file_path: str, 
                       start_line: int, end_line: int,
                       headings: List[str]) -> Chunk:
        chunk_id = hashlib.md5(
            f"{file_path}:{start_line}:{end_line}:{content[:50]}".encode()
        ).hexdigest()[:12]
        
        return Chunk(
            id=chunk_id,
            content=content,
            file_path=file_path,
            start_line=start_line,
            end_line=end_line,
            headings=headings.copy()
        )


class TfidfRetriever:
    def __init__(self, chunks: List[Chunk]):
        self.chunks = chunks
        self.chunk_map = {c.id: c for c in chunks}
        self.vectorizer = None
        self.tfidf_matrix = None
        self._build_index()
    
    def _preprocess(self, text: str) -> str:
        words = jieba.lcut_for_search(text)
        return ' '.join(words)
    
    def _build_index(self):
        if not self.chunks:
            return
        
        texts = []
        for chunk in self.chunks:
            combined = ' '.join(chunk.headings) + ' ' + chunk.content
            texts.append(self._preprocess(combined))
        
        self.vectorizer = TfidfVectorizer(
            stop_words=None,
            ngram_range=(1, 2),
            min_df=1,
            max_features=10000
        )
        
        self.tfidf_matrix = self.vectorizer.fit_transform(texts)
    
    def search(self, query: str, top_k: int = 5) -> List[RetrievalResult]:
        if not self.chunks or self.tfidf_matrix is None:
            return []
        
        processed_query = self._preprocess(query)
        query_vec = self.vectorizer.transform([processed_query])
        
        scores = (self.tfidf_matrix * query_vec.T).toarray().flatten()
        
        top_indices = scores.argsort()[-top_k:][::-1]
        
        results = []
        for rank, idx in enumerate(top_indices, 1):
            if scores[idx] <= 0:
                continue
            
            chunk = self.chunks[idx]
            results.append(RetrievalResult(
                chunk_id=chunk.id,
                score=float(scores[idx]),
                rank=rank,
                content=chunk.content[:200] + '...' if len(chunk.content) > 200 else chunk.content,
                file_path=chunk.file_path
            ))
        
        return results


class QualityChecker:
    def __init__(self, policy: ChunkPolicy):
        self.policy = policy
    
    def check(self, chunks: List[Chunk]) -> List[Issue]:
        issues = []
        
        issues.extend(self._check_empty_chunks(chunks))
        issues.extend(self._check_duplicate_heading_chunks(chunks))
        issues.extend(self._check_long_paragraphs(chunks))
        issues.extend(self._check_very_short_chunks(chunks))
        
        return issues
    
    def _check_empty_chunks(self, chunks: List[Chunk]) -> List[Issue]:
        issues = []
        for chunk in chunks:
            if not chunk.content.strip():
                issues.append(Issue(
                    category='空切片',
                    severity='high',
                    policy_name=self.policy.name,
                    file_path=chunk.file_path,
                    chunk_id=chunk.id,
                    message=f'发现空切片，行范围: {chunk.start_line}-{chunk.end_line}',
                    context='(无内容)'
                ))
        return issues
    
    def _check_duplicate_heading_chunks(self, chunks: List[Chunk]) -> List[Issue]:
        issues = []
        heading_counts = defaultdict(list)
        
        for chunk in chunks:
            for heading in chunk.headings:
                heading_counts[(chunk.file_path, heading)].append(chunk)
        
        for (file_path, heading), chunk_list in heading_counts.items():
            if len(chunk_list) > 1:
                issues.append(Issue(
                    category='重复标题',
                    severity='medium',
                    policy_name=self.policy.name,
                    file_path=file_path,
                    chunk_id=chunk_list[0].id,
                    message=f'标题 "{heading}" 在 {len(chunk_list)} 个切片中重复出现',
                    context=f'涉及切片: {", ".join(c.id for c in chunk_list)}'
                ))
        return issues
    
    def _check_long_paragraphs(self, chunks: List[Chunk]) -> List[Issue]:
        issues = []
        threshold = self.policy.max_chunk_size * 1.5
        
        for chunk in chunks:
            if len(chunk.content) > threshold:
                issues.append(Issue(
                    category='超长段落',
                    severity='medium',
                    policy_name=self.policy.name,
                    file_path=chunk.file_path,
                    chunk_id=chunk.id,
                    message=f'段落长度 {len(chunk.content)} 超过阈值 {int(threshold)}',
                    context=chunk.content[:100] + '...'
                ))
        return issues
    
    def _check_very_short_chunks(self, chunks: List[Chunk]) -> List[Issue]:
        issues = []
        threshold = self.policy.min_chunk_size
        
        for chunk in chunks:
            if len(chunk.content) < threshold and chunk.content.strip():
                issues.append(Issue(
                    category='过短切片',
                    severity='low',
                    policy_name=self.policy.name,
                    file_path=chunk.file_path,
                    chunk_id=chunk.id,
                    message=f'切片长度 {len(chunk.content)} 小于最小阈值 {threshold}',
                    context=chunk.content
                ))
        return issues


class QaEvaluator:
    def __init__(self, qa_cases: List[QaCase], retriever: TfidfRetriever, 
                 chunks: List[Chunk]):
        self.qa_cases = qa_cases
        self.retriever = retriever
        self.chunk_map = {c.id: c for c in chunks}
    
    def evaluate(self, top_k: int = 5) -> Dict[str, Any]:
        results = []
        hits = 0
        total_qa = len(self.qa_cases)
        
        for case in self.qa_cases:
            retrieved = self.retriever.search(case.question, top_k)
            retrieved_files = {r.file_path for r in retrieved}
            retrieved_contents = [r.content for r in retrieved]
            
            expected_files = set(case.expected_file_paths)
            
            file_hit = bool(retrieved_files & expected_files)
            content_hit = False
            
            for expected_answer in case.expected_answers:
                for content in retrieved_contents:
                    if expected_answer.lower() in content.lower():
                        content_hit = True
                        break
                if content_hit:
                    break
            
            is_hit = file_hit or content_hit
            if is_hit:
                hits += 1
            
            coverage = len(retrieved_files & expected_files) / len(expected_files) if expected_files else 0.0
            
            results.append({
                'id': case.id,
                'question': case.question,
                'hit': is_hit,
                'expected_files': list(expected_files),
                'retrieved_files': list(retrieved_files),
                'coverage': coverage,
                'retrieved': [
                    {'rank': r.rank, 'score': r.score, 'file': r.file_path, 'snippet': r.content[:100]}
                    for r in retrieved
                ]
            })
        
        return {
            'total': total_qa,
            'hits': hits,
            'hit_rate': hits / total_qa if total_qa > 0 else 0.0,
            'avg_coverage': sum(r['coverage'] for r in results) / len(results) if results else 0.0,
            'details': results
        }


class ReportGenerator:
    @staticmethod
    def generate_issues_csv(issues: List[Issue], output_path: str):
        with open(output_path, 'w', encoding='utf-8', newline='') as f:
            writer = csv.writer(f)
            writer.writerow([
                '分类', '严重程度', '策略名称', '文件路径', 
                '切片ID', '消息', '上下文'
            ])
            for issue in issues:
                writer.writerow([
                    issue.category,
                    issue.severity,
                    issue.policy_name,
                    issue.file_path,
                    issue.chunk_id or '',
                    issue.message,
                    issue.context
                ])
    
    @staticmethod
    def generate_retrieval_report(policy_results: Dict[str, Dict], output_path: str):
        lines = []
        lines.append('# RAG 检索评测报告\n')
        lines.append(f'生成时间: {ReportGenerator._current_time()}\n')
        lines.append('---\n')
        
        lines.append('## 策略对比摘要\n')
        lines.append('| 策略名称 | 总问题数 | 命中数 | 命中率 | 平均覆盖度 |')
        lines.append('|----------|----------|--------|--------|------------|')
        
        for policy_name, result in policy_results.items():
            lines.append(
                f'| {policy_name} | {result["total"]} | {result["hits"]} | '
                f'{result["hit_rate"]:.2%} | {result["avg_coverage"]:.2%} |'
            )
        lines.append('')
        
        lines.append('---\n')
        lines.append('## 详细评测结果\n')
        
        for policy_name, result in policy_results.items():
            lines.append(f'### {policy_name}\n')
            
            for detail in result['details']:
                hit_marker = '✅' if detail['hit'] else '❌'
                lines.append(f'#### {detail["id"]}: {hit_marker} {detail["question"]}\n')
                lines.append(f'- 预期文件: {", ".join(detail["expected_files"])}\n')
                lines.append(f'- 实际检索文件: {", ".join(detail["retrieved_files"])}\n')
                lines.append(f'- 覆盖度: {detail["coverage"]:.2%}\n')
                
                if detail['retrieved']:
                    lines.append('- 检索结果:\n')
                    for r in detail['retrieved']:
                        lines.append(f'  {r["rank"]}. [{r["file"]}] (score: {r["score"]:.4f}) - {r["snippet"]}\n')
                lines.append('')
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write('\n'.join(lines))
    
    @staticmethod
    def generate_html_comparison(
        policy_chunks: Dict[str, List[Chunk]],
        policy_issues: Dict[str, List[Issue]],
        policy_metrics: Dict[str, Dict],
        output_path: str
    ):
        html = '''<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>RAG 切片策略对比报告</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; background: #f5f7fa; color: #333; }
        .container { max-width: 1400px; margin: 0 auto; }
        h1 { text-align: center; margin-bottom: 30px; color: #2c3e50; }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .metric-card { background: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .metric-card h3 { color: #7f8c8d; font-size: 14px; margin-bottom: 10px; }
        .metric-value { font-size: 28px; font-weight: bold; color: #2c3e50; }
        .metric-good { color: #27ae60; }
        .metric-bad { color: #e74c3c; }
        .tabs { display: flex; gap: 10px; margin-bottom: 20px; }
        .tab { padding: 12px 24px; background: white; border: 1px solid #ddd; border-radius: 6px; cursor: pointer; font-weight: 500; transition: all 0.2s; }
        .tab:hover { background: #ecf0f1; }
        .tab.active { background: #3498db; color: white; border-color: #3498db; }
        .comparison { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .panel { background: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .panel h2 { margin-bottom: 15px; color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; }
        .chunk { background: #fafafa; border: 1px solid #eee; border-radius: 6px; padding: 15px; margin-bottom: 10px; }
        .chunk-header { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 12px; color: #7f8c8d; }
        .chunk-headings { color: #3498db; font-weight: 500; margin-bottom: 8px; }
        .chunk-content { white-space: pre-wrap; font-size: 14px; line-height: 1.6; color: #333; }
        .issue-list { list-style: none; }
        .issue { padding: 12px; margin-bottom: 8px; border-radius: 6px; border-left: 4px solid; }
        .issue.high { background: #fdecea; border-left-color: #e74c3c; }
        .issue.medium { background: #fef9e7; border-left-color: #f39c12; }
        .issue.low { background: #e8f4f8; border-left-color: #3498db; }
        .issue-title { font-weight: 600; margin-bottom: 5px; }
        .issue-meta { font-size: 12px; color: #7f8c8d; }
        .issue-context { margin-top: 8px; font-size: 13px; background: rgba(0,0,0,0.05); padding: 8px; border-radius: 4px; }
        .hidden { display: none; }
        .empty-state { text-align: center; padding: 40px; color: #7f8c8d; }
        .policy-name { color: #3498db; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <h1>RAG 切片策略对比报告</h1>
        
        <div class="metrics">
'''
        
        for policy_name, metrics in policy_metrics.items():
            hit_rate_class = 'metric-good' if metrics.get('hit_rate', 0) >= 0.8 else 'metric-bad'
            html += f'''
            <div class="metric-card">
                <h3>策略: {policy_name}</h3>
                <div class="metric-value {hit_rate_class}">{metrics.get('hit_rate', 0):.2%}</div>
                <div style="margin-top: 10px; font-size: 14px;">
                    命中数: {metrics.get('hits', 0)} / {metrics.get('total', 0)}
                    <br>
                    平均覆盖度: {metrics.get('avg_coverage', 0):.2%}
                </div>
            </div>
'''
        
        html += '''
        </div>
        
        <div class="tabs">
            <button class="tab active" onclick="showSection('chunks')">切片对比</button>
            <button class="tab" onclick="showSection('issues')">质量问题</button>
        </div>
        
        <div id="chunks-section">
            <div class="comparison">
'''
        
        policy_names = list(policy_chunks.keys())
        for i, policy_name in enumerate(policy_names):
            chunks = policy_chunks[policy_name]
            html += f'''
                <div class="panel">
                    <h2><span class="policy-name">{policy_name}</span> - 切片预览 ({len(chunks)} 个)</h2>
'''
            
            if not chunks:
                html += '<div class="empty-state">无切片数据</div>'
            else:
                for chunk in chunks[:50]:
                    headings_str = ' > '.join(chunk.headings) if chunk.headings else '(无标题)'
                    html += f'''
                    <div class="chunk">
                        <div class="chunk-header">
                            <span>ID: {chunk.id}</span>
                            <span>{chunk.file_path} ({chunk.start_line}-{chunk.end_line})</span>
                            <span>{len(chunk.content)} 字</span>
                        </div>
                        <div class="chunk-headings">{headings_str}</div>
                        <div class="chunk-content">{ReportGenerator._escape_html(chunk.content[:300])}{'...' if len(chunk.content) > 300 else ''}</div>
                    </div>
'''
            
            html += '''
                </div>
'''
        
        html += '''
            </div>
        </div>
        
        <div id="issues-section" class="hidden">
            <div class="comparison">
'''
        
        for policy_name in policy_names:
            issues = policy_issues.get(policy_name, [])
            html += f'''
                <div class="panel">
                    <h2><span class="policy-name">{policy_name}</span> - 质量问题 ({len(issues)} 个)</h2>
'''
            
            if not issues:
                html += '<div class="empty-state">✅ 未发现质量问题</div>'
            else:
                html += '<ul class="issue-list">'
                for issue in issues:
                    severity_map = {
                        'high': '严重',
                        'medium': '中等',
                        'low': '轻微'
                    }
                    html += f'''
                    <li class="issue {issue.severity}">
                        <div class="issue-title">[{severity_map.get(issue.severity, issue.severity)}] {issue.category}</div>
                        <div class="issue-meta">{issue.file_path} | 切片: {issue.chunk_id or 'N/A'}</div>
                        <div style="margin-top: 5px;">{issue.message}</div>
'''
                    if issue.context:
                        html += f'<div class="issue-context">{ReportGenerator._escape_html(issue.context)}</div>'
                    html += '</li>'
                html += '</ul>'
            
            html += '''
                </div>
'''
        
        html += '''
            </div>
        </div>
    </div>
    
    <script>
        function showSection(section) {
            document.getElementById('chunks-section').classList.add('hidden');
            document.getElementById('issues-section').classList.add('hidden');
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            
            document.getElementById(section + '-section').classList.remove('hidden');
            event.target.classList.add('active');
        }
    </script>
</body>
</html>
'''
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(html)
    
    @staticmethod
    def _escape_html(text: str) -> str:
        return text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    
    @staticmethod
    def _current_time() -> str:
        from datetime import datetime
        return datetime.now().strftime('%Y-%m-%d %H:%M:%S')


class DataLoader:
    @staticmethod
    def load_docs(docs_dir: str) -> List[str]:
        md_files = []
        docs_path = Path(docs_dir)
        
        if not docs_path.exists():
            return md_files
        
        for md_file in docs_path.rglob('*.md'):
            md_files.append(str(md_file))
        
        return md_files
    
    @staticmethod
    def load_qa_cases(file_path: str) -> List[QaCase]:
        cases = []
        if not os.path.exists(file_path):
            return cases
        
        with open(file_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                
                try:
                    data = json.loads(line)
                    case = QaCase(
                        id=data.get('id', f'qa_{len(cases)}'),
                        question=data.get('question', ''),
                        expected_answers=data.get('expected_answers', []),
                        expected_file_paths=data.get('expected_file_paths', [])
                    )
                    cases.append(case)
                except json.JSONDecodeError:
                    continue
        
        return cases


def main():
    parser = argparse.ArgumentParser(description='RAG 知识库切片回归评测工具')
    parser.add_argument('--docs', default='docs', help='文档目录 (默认: docs)')
    parser.add_argument('--qa', default='qa_cases.jsonl', help='QA 测试用例文件 (默认: qa_cases.jsonl)')
    parser.add_argument('--policy', default='chunk_policy.yaml', help='切片策略配置 (默认: chunk_policy.yaml)')
    parser.add_argument('--output', default='output', help='输出目录 (默认: output)')
    parser.add_argument('--top-k', type=int, default=5, help='检索 Top-K (默认: 5)')
    
    args = parser.parse_args()
    
    print('=' * 60)
    print('RAG 知识库切片回归评测工具')
    print('=' * 60)
    
    output_dir = Path(args.output)
    output_dir.mkdir(exist_ok=True)
    
    print(f'\n[1/6] 加载配置和数据...')
    if not os.path.exists(args.policy):
        print(f'错误: 策略文件不存在: {args.policy}')
        return
    
    policies = PolicyParser.parse(args.policy)
    print(f'  - 加载了 {len(policies)} 个切片策略')
    
    doc_files = DataLoader.load_docs(args.docs)
    print(f'  - 发现 {len(doc_files)} 个 Markdown 文档')
    
    qa_cases = DataLoader.load_qa_cases(args.qa)
    print(f'  - 加载了 {len(qa_cases)} 个 QA 测试用例')
    
    if not policies:
        print('错误: 未加载到任何切片策略')
        return
    
    policy_chunks = {}
    policy_issues = {}
    policy_metrics = {}
    all_issues = []
    
    for policy in policies:
        print(f'\n[处理策略: {policy.name}]')
        
        print(f'  - 执行切片...')
        all_chunks = []
        for doc_file in doc_files:
            try:
                chunker = Chunker(policy)
                chunks = chunker.chunk_file(doc_file)
                all_chunks.extend(chunks)
            except Exception as e:
                print(f'    警告: 处理文件 {doc_file} 失败: {e}')
        
        policy_chunks[policy.name] = all_chunks
        print(f'    生成了 {len(all_chunks)} 个切片')
        
        print(f'  - 质量检测...')
        checker = QualityChecker(policy)
        issues = checker.check(all_chunks)
        policy_issues[policy.name] = issues
        all_issues.extend(issues)
        print(f'    发现 {len(issues)} 个质量问题')
        
        print(f'  - 构建 TF-IDF 索引...')
        if all_chunks:
            retriever = TfidfRetriever(all_chunks)
            evaluator = QaEvaluator(qa_cases, retriever, all_chunks)
            
            print(f'  - 执行检索评测 (Top-{args.top_k})...')
            metrics = evaluator.evaluate(top_k=args.top_k)
            policy_metrics[policy.name] = metrics
            
            print(f'    命中率: {metrics["hit_rate"]:.2%} ({metrics["hits"]}/{metrics["total"]})')
            print(f'    平均覆盖度: {metrics["avg_coverage"]:.2%}')
        else:
            policy_metrics[policy.name] = {
                'total': 0,
                'hits': 0,
                'hit_rate': 0.0,
                'avg_coverage': 0.0,
                'details': []
            }
            print(f'    无可用切片，跳过检索评测')
    
    print(f'\n[6/6] 生成报告...')
    
    issues_csv = output_dir / 'issues.csv'
    ReportGenerator.generate_issues_csv(all_issues, str(issues_csv))
    print(f'  - 问题报告: {issues_csv}')
    
    retrieval_report = output_dir / 'retrieval_report.md'
    ReportGenerator.generate_retrieval_report(policy_metrics, str(retrieval_report))
    print(f'  - 检索报告: {retrieval_report}')
    
    html_report = output_dir / 'comparison.html'
    ReportGenerator.generate_html_comparison(
        policy_chunks, policy_issues, policy_metrics, str(html_report)
    )
    print(f'  - 对比页面: {html_report}')
    
    print('\n' + '=' * 60)
    print('评测完成!')
    print('=' * 60)
    print(f'''
结果汇总:
  - 切片策略数: {len(policies)}
  - 文档数: {len(doc_files)}
  - QA 用例数: {len(qa_cases)}
  - 总问题数: {len(all_issues)}

输出文件:
  1. {issues_csv} - 质量问题清单
  2. {retrieval_report} - 检索评测报告
  3. {html_report} - 交互式对比页面
''')


if __name__ == '__main__':
    main()
