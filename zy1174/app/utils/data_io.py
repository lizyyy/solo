import pandas as pd
import json
import os
from typing import List, Dict, Any, Optional, Tuple
from io import StringIO, TextIOWrapper

class DataImporter:
    SUPPORTED_FORMATS = {'csv', 'jsonl', 'txt'}
    
    @staticmethod
    def detect_format(file_path: str) -> str:
        _, ext = os.path.splitext(file_path)
        ext = ext.lower().lstrip('.')
        
        if ext in DataImporter.SUPPORTED_FORMATS:
            return ext
        
        with open(file_path, 'r', encoding='utf-8') as f:
            first_line = f.readline().strip()
            if first_line.startswith('{') and first_line.endswith('}'):
                return 'jsonl'
            elif ',' in first_line:
                return 'csv'
        
        return 'txt'
    
    @staticmethod
    def import_csv(file_path: str, content_column: Optional[str] = None,
                   id_column: Optional[str] = None, encoding: str = 'utf-8') -> List[Dict[str, Any]]:
        df = pd.read_csv(file_path, encoding=encoding)
        
        documents = []
        for idx, row in df.iterrows():
            doc = {}
            
            if id_column and id_column in df.columns:
                doc['doc_id'] = str(row[id_column])
            else:
                doc['doc_id'] = f"doc_{idx}"
            
            if content_column and content_column in df.columns:
                doc['content'] = str(row[content_column])
            else:
                possible_columns = ['content', 'text', 'document', 'doc', 'body']
                found = False
                for col in possible_columns:
                    if col in df.columns:
                        doc['content'] = str(row[col])
                        found = True
                        break
                
                if not found:
                    text_cols = df.select_dtypes(include=['object']).columns
                    if len(text_cols) > 0:
                        doc['content'] = str(row[text_cols[0]])
                    else:
                        doc['content'] = str(row.iloc[0])
            
            metadata = {}
            for col in df.columns:
                if col not in [id_column, content_column]:
                    metadata[col] = row[col]
            doc['metadata'] = json.dumps(metadata, ensure_ascii=False)
            
            documents.append(doc)
        
        return documents
    
    @staticmethod
    def import_jsonl(file_path: str, encoding: str = 'utf-8') -> List[Dict[str, Any]]:
        documents = []
        
        with open(file_path, 'r', encoding=encoding) as f:
            for idx, line in enumerate(f):
                line = line.strip()
                if not line:
                    continue
                
                try:
                    data = json.loads(line)
                except json.JSONDecodeError:
                    continue
                
                doc = {}
                
                if 'doc_id' in data:
                    doc['doc_id'] = str(data['doc_id'])
                elif 'id' in data:
                    doc['doc_id'] = str(data['id'])
                else:
                    doc['doc_id'] = f"doc_{idx}"
                
                if 'content' in data:
                    doc['content'] = str(data['content'])
                elif 'text' in data:
                    doc['content'] = str(data['text'])
                elif 'document' in data:
                    doc['content'] = str(data['document'])
                else:
                    doc['content'] = json.dumps(data, ensure_ascii=False)
                
                metadata = {}
                for key, value in data.items():
                    if key not in ['doc_id', 'id', 'content', 'text', 'document']:
                        metadata[key] = value
                doc['metadata'] = json.dumps(metadata, ensure_ascii=False)
                
                documents.append(doc)
        
        return documents
    
    @staticmethod
    def import_txt(file_path: str, encoding: str = 'utf-8', 
                   delimiter: Optional[str] = None) -> List[Dict[str, Any]]:
        documents = []
        
        with open(file_path, 'r', encoding=encoding) as f:
            content = f.read()
        
        if delimiter:
            lines = content.split(delimiter)
        else:
            lines = content.split('\n')
        
        for idx, line in enumerate(lines):
            line = line.strip()
            if not line:
                continue
            
            doc = {
                'doc_id': f"doc_{idx}",
                'content': line,
                'metadata': json.dumps({}, ensure_ascii=False)
            }
            documents.append(doc)
        
        return documents
    
    @staticmethod
    def import_file(file_path: str, format: Optional[str] = None, **kwargs) -> List[Dict[str, Any]]:
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")
        
        if not format:
            format = DataImporter.detect_format(file_path)
        
        if format == 'csv':
            return DataImporter.import_csv(file_path, **kwargs)
        elif format == 'jsonl':
            return DataImporter.import_jsonl(file_path, **kwargs)
        elif format == 'txt':
            return DataImporter.import_txt(file_path, **kwargs)
        else:
            raise ValueError(f"Unsupported format: {format}")

class DataExporter:
    @staticmethod
    def export_csv(documents: List[Dict[str, Any]], file_path: str, encoding: str = 'utf-8'):
        rows = []
        for doc in documents:
            row = {
                'doc_id': doc.get('doc_id', ''),
                'content': doc.get('content', '')
            }
            
            metadata = doc.get('metadata', '{}')
            if isinstance(metadata, str):
                try:
                    metadata = json.loads(metadata)
                except json.JSONDecodeError:
                    metadata = {}
            
            if isinstance(metadata, dict):
                for key, value in metadata.items():
                    row[key] = value
            
            rows.append(row)
        
        df = pd.DataFrame(rows)
        df.to_csv(file_path, index=False, encoding=encoding)
    
    @staticmethod
    def export_jsonl(documents: List[Dict[str, Any]], file_path: str, encoding: str = 'utf-8'):
        with open(file_path, 'w', encoding=encoding) as f:
            for doc in documents:
                line = {
                    'doc_id': doc.get('doc_id', ''),
                    'content': doc.get('content', '')
                }
                
                metadata = doc.get('metadata', '{}')
                if isinstance(metadata, str):
                    try:
                        metadata = json.loads(metadata)
                    except json.JSONDecodeError:
                        metadata = {}
                
                if isinstance(metadata, dict):
                    for key, value in metadata.items():
                        line[key] = value
                
                f.write(json.dumps(line, ensure_ascii=False) + '\n')
    
    @staticmethod
    def export_to_format(documents: List[Dict[str, Any]], file_path: str, 
                         format: str = 'csv', **kwargs):
        if format == 'csv':
            DataExporter.export_csv(documents, file_path, **kwargs)
        elif format == 'jsonl':
            DataExporter.export_jsonl(documents, file_path, **kwargs)
        else:
            raise ValueError(f"Unsupported format: {format}")

class ReportExporter:
    @staticmethod
    def generate_markdown_report(
        corpus_stats: Dict[str, Any],
        vectorization_config: Dict[str, Any],
        query_results: List[Dict[str, Any]],
        evaluation_metrics: Optional[Dict[str, Any]] = None,
        similarity_matrix: Optional[List[List[float]]] = None,
        dimension_analysis: Optional[Dict[str, Any]] = None
    ) -> str:
        lines = []
        
        lines.append("# 文本向量检索实验报告")
        lines.append("")
        lines.append(f"**生成时间**: {pd.Timestamp.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        
        lines.append("## 1. 语料库统计")
        lines.append("")
        lines.append(f"- 文档总数: {corpus_stats.get('total_docs', 0)}")
        lines.append(f"- 总词数: {corpus_stats.get('total_tokens', 0)}")
        lines.append(f"- 平均文档长度: {corpus_stats.get('avg_doc_length', 0):.2f} 词")
        lines.append(f"- 词汇表大小: {corpus_stats.get('vocab_size', 0)}")
        lines.append("")
        
        lines.append("## 2. 向量化配置")
        lines.append("")
        lines.append(f"- 分词器: {vectorization_config.get('tokenizer', 'jieba')}")
        lines.append(f"- 停用词语言: {vectorization_config.get('stopword_lang', 'chinese')}")
        lines.append(f"- 向量化方法: {vectorization_config.get('vectorization', 'tfidf')}")
        lines.append(f"- 向量维度: {vectorization_config.get('dimensions', 0)}")
        lines.append(f"- 是否归一化: {'是' if vectorization_config.get('normalize', True) else '否'}")
        lines.append(f"- TopK: {vectorization_config.get('top_k', 5)}")
        lines.append("")
        
        if query_results:
            lines.append("## 3. 查询结果")
            lines.append("")
            
            for i, result in enumerate(query_results, 1):
                lines.append(f"### 3.{i} 查询: {result.get('query_text', 'N/A')}")
                lines.append("")
                lines.append("| 排名 | 文档ID | 相似度 | 文档内容预览 |")
                lines.append("|------|--------|--------|--------------|")
                
                for item in result.get('results', []):
                    preview = item.get('content', '')[:50] + '...' if len(item.get('content', '')) > 50 else item.get('content', '')
                    lines.append(f"| {item.get('rank', 'N/A')} | {item.get('id', 'N/A')} | {item.get('similarity_score', 0):.4f} | {preview} |")
                
                lines.append("")
        
        if evaluation_metrics:
            lines.append("## 4. 评估指标")
            lines.append("")
            lines.append("| 指标 | 值 |")
            lines.append("|------|-----|")
            
            for metric, value in evaluation_metrics.items():
                if isinstance(value, (int, float)):
                    lines.append(f"| {metric} | {value:.4f} |")
                else:
                    lines.append(f"| {metric} | {value} |")
            
            lines.append("")
        
        if dimension_analysis:
            lines.append("## 5. 向量维度分析")
            lines.append("")
            
            if dimension_analysis.get('type') == 'tfidf':
                lines.append("### 5.1 高权重特征")
                lines.append("")
                lines.append("| 特征 | 权重 |")
                lines.append("|------|------|")
                for feat in dimension_analysis.get('top_features', [])[:10]:
                    lines.append(f"| {feat.get('feature', 'N/A')} | {feat.get('weight', 0):.4f} |")
                lines.append("")
                
                lines.append(f"- 总维度数: {dimension_analysis.get('total_dimensions', 0)}")
                lines.append(f"- 非零维度数: {dimension_analysis.get('non_zero_dimensions', 0)}")
            else:
                lines.append("### 5.1 高相似度词")
                lines.append("")
                lines.append("| 词 | 相似度 |")
                lines.append("|----|--------|")
                for token in dimension_analysis.get('top_tokens', [])[:10]:
                    lines.append(f"| {token.get('token', 'N/A')} | {token.get('similarity', 0):.4f} |")
                lines.append("")
            
            lines.append("")
        
        if similarity_matrix:
            lines.append("## 6. 相似度矩阵 (前10x10)")
            lines.append("")
            lines.append("```")
            
            n = min(len(similarity_matrix), 10)
            for i in range(n):
                row = similarity_matrix[i][:n]
                lines.append("  ".join([f"{v:.3f}" for v in row]))
            
            lines.append("```")
            lines.append("")
        
        lines.append("---")
        lines.append("")
        lines.append("*本报告由文本向量检索实验台自动生成*")
        
        return "\n".join(lines)
    
    @staticmethod
    def generate_json_report(
        corpus_stats: Dict[str, Any],
        vectorization_config: Dict[str, Any],
        query_results: List[Dict[str, Any]],
        evaluation_metrics: Optional[Dict[str, Any]] = None,
        similarity_matrix: Optional[List[List[float]]] = None,
        dimension_analysis: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        report = {
            'generated_at': pd.Timestamp.now().isoformat(),
            'corpus_stats': corpus_stats,
            'vectorization_config': vectorization_config,
            'query_results': query_results
        }
        
        if evaluation_metrics:
            report['evaluation_metrics'] = evaluation_metrics
        
        if dimension_analysis:
            report['dimension_analysis'] = dimension_analysis
        
        if similarity_matrix:
            report['similarity_matrix'] = similarity_matrix
        
        return report
    
    @staticmethod
    def save_report(report: str, file_path: str, format: str = 'markdown'):
        if format == 'markdown':
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(report)
        elif format == 'json':
            with open(file_path, 'w', encoding='utf-8') as f:
                if isinstance(report, dict):
                    json.dump(report, f, ensure_ascii=False, indent=2)
                else:
                    f.write(report)
