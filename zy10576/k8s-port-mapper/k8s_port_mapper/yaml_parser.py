import yaml
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass, field


@dataclass
class BadLine:
    line_number: int
    content: str
    error: str
    file_path: str


@dataclass
class ParsedResource:
    kind: str
    name: str
    namespace: Optional[str]
    data: Dict[str, Any]
    file_path: str
    line_start: int
    line_end: int


@dataclass
class ParseResult:
    resources: List[ParsedResource] = field(default_factory=list)
    bad_lines: List[BadLine] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)


class YamlParser:
    def __init__(self):
        self.resources: List[ParsedResource] = []
        self.bad_lines: List[BadLine] = []
        self.errors: List[str] = []

    def parse_file(self, file_path: str) -> ParseResult:
        result = ParseResult()
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                lines = content.split('\n')
            result = self.parse_content(content, file_path, lines)
        except FileNotFoundError:
            result.errors.append(f"文件不存在: {file_path}")
        except PermissionError:
            result.errors.append(f"没有权限读取文件: {file_path}")
        except Exception as e:
            result.errors.append(f"读取文件失败 {file_path}: {str(e)}")
        return result

    def parse_content(self, content: str, file_path: str, lines: List[str]) -> ParseResult:
        result = ParseResult()
        
        docs_raw = content.split('\n---\n')
        line_idx = 0
        
        for doc_idx, doc_content in enumerate(docs_raw):
            if not doc_content.strip():
                continue
            
            doc_start_line = line_idx
            for i in range(line_idx, len(lines)):
                if i == 0 or lines[i-1].strip() == '---':
                    doc_start_line = i
                    break
            
            try:
                doc = yaml.safe_load(doc_content)
                if doc is None:
                    continue
                if not isinstance(doc, dict):
                    bad_content = lines[doc_start_line] if doc_start_line < len(lines) else doc_content.strip()
                    result.bad_lines.append(BadLine(
                        line_number=doc_start_line + 1,
                        content=bad_content,
                        error="YAML 文档不是字典类型",
                        file_path=file_path
                    ))
                    result.errors.append(f"YAML解析错误 {file_path} 文档 {doc_idx + 1}: 无效的 K8s 资源格式")
                    continue
                resource = self._extract_resource(doc, file_path, doc_start_line)
                if resource:
                    result.resources.append(resource)
            except yaml.YAMLError as e:
                line_num = getattr(e, 'problem_mark', None)
                if line_num:
                    line_no = doc_start_line + line_num.line + 1
                    bad_content = lines[line_no - 1] if line_no <= len(lines) else ""
                    result.bad_lines.append(BadLine(
                        line_number=line_no,
                        content=bad_content,
                        error=str(e),
                        file_path=file_path
                    ))
                result.errors.append(f"YAML解析错误 {file_path} 文档 {doc_idx + 1}: {str(e)}")
            except Exception as e:
                result.errors.append(f"处理文档 {doc_idx + 1} 失败: {str(e)}")
            
            line_idx = doc_start_line + len(doc_content.split('\n'))
        
        return result

    def _find_doc_start_line(self, lines: List[str], start_search: int, doc_idx: int) -> int:
        doc_count = 0
        for i, line in enumerate(lines[start_search:], start=start_search):
            if line.strip() == '---':
                doc_count += 1
                if doc_count == doc_idx + 1:
                    return i
            if doc_idx == 0 and i == 0:
                if not line.strip() == '---':
                    return 0
        return start_search

    def _extract_resource(self, doc: Dict[str, Any], file_path: str, start_line: int) -> Optional[ParsedResource]:
        kind = doc.get('kind', 'Unknown')
        metadata = doc.get('metadata', {})
        name = metadata.get('name', 'unknown')
        namespace = metadata.get('namespace')

        if kind not in ['Service', 'Ingress', 'Deployment', 'StatefulSet', 'DaemonSet', 'Pod']:
            return None

        return ParsedResource(
            kind=kind,
            name=name,
            namespace=namespace,
            data=doc,
            file_path=file_path,
            line_start=start_line + 1,
            line_end=start_line + 100
        )

    def merge_results(self, results: List[ParseResult]) -> ParseResult:
        merged = ParseResult()
        for r in results:
            merged.resources.extend(r.resources)
            merged.bad_lines.extend(r.bad_lines)
            merged.errors.extend(r.errors)
        return merged


def parse_files(file_paths: List[str]) -> ParseResult:
    parser = YamlParser()
    results = [parser.parse_file(fp) for fp in file_paths]
    return parser.merge_results(results)
