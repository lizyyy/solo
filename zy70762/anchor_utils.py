import re
import hashlib
from typing import List, Dict, Tuple, Optional
from difflib import SequenceMatcher
import os


def generate_anchor_slug(heading_text: str) -> str:
    """
    生成GitHub风格的锚点slug
    规则：转小写，移除非字母数字，空格转横杠，连续横杠合并
    """
    slug = heading_text.lower()
    slug = re.sub(r'[^\w\s-]', '', slug)
    slug = re.sub(r'[\s-]+', '-', slug)
    slug = slug.strip('-')
    return slug


def parse_markdown_headings(content: str) -> List[Dict]:
    """
    解析Markdown内容中的所有标题
    返回格式: [{'text': '标题', 'level': 1-6, 'line': 行号, 'anchor': '锚点'}]
    """
    headings = []
    lines = content.split('\n')
    
    for line_num, line in enumerate(lines, 1):
        match = re.match(r'^(#{1,6})\s+(.+)$', line.strip())
        if match:
            level = len(match.group(1))
            text = match.group(2).strip()
            anchor = generate_anchor_slug(text)
            headings.append({
                'text': text,
                'level': level,
                'line': line_num,
                'anchor': anchor
            })
    
    setext_pattern = re.compile(r'^(.+)\n(=+|-+)\s*$', re.MULTILINE)
    for match in setext_pattern.finditer(content):
        heading_text = match.group(1).strip()
        underline = match.group(2)
        level = 1 if underline.startswith('=') else 2
        line_num = content[:match.start(1)].count('\n') + 1
        
        if not any(h['line'] == line_num for h in headings):
            anchor = generate_anchor_slug(heading_text)
            headings.append({
                'text': heading_text,
                'level': level,
                'line': line_num,
                'anchor': anchor
            })
    
    return headings


def parse_markdown_links(content: str) -> List[Dict]:
    """
    解析Markdown内容中的所有链接
    支持: [text](url#anchor), [text](url), <url>
    """
    links = []
    lines = content.split('\n')
    
    inline_link_pattern = re.compile(r'\[([^\]]+)\]\(([^)]+)\)')
    
    for line_num, line in enumerate(lines, 1):
        for match in inline_link_pattern.finditer(line):
            link_text = match.group(1)
            link_url = match.group(2).strip()
            
            url_parts = link_url.split('#', 1)
            base_url = url_parts[0]
            anchor = url_parts[1] if len(url_parts) > 1 else None
            
            links.append({
                'text': link_text,
                'url': base_url,
                'anchor': anchor,
                'line': line_num,
                'column': match.start() + 1
            })
    
    angle_bracket_pattern = re.compile(r'<(https?://[^>]+)>')
    for line_num, line in enumerate(lines, 1):
        for match in angle_bracket_pattern.finditer(line):
            link_url = match.group(1)
            url_parts = link_url.split('#', 1)
            base_url = url_parts[0]
            anchor = url_parts[1] if len(url_parts) > 1 else None
            
            links.append({
                'text': link_url,
                'url': base_url,
                'anchor': anchor,
                'line': line_num,
                'column': match.start() + 1
            })
    
    return links


def calculate_similarity(str1: str, str2: str) -> float:
    """计算两个字符串的相似度"""
    return SequenceMatcher(None, str1.lower(), str2.lower()).ratio()


def find_best_anchor_match(old_anchor: str, available_anchors: List[Dict], 
                           similarity_threshold: float = 0.6) -> Tuple[Optional[Dict], float]:
    """
    在可用锚点中查找与旧锚点最匹配的锚点
    返回: (最佳匹配锚点字典, 相似度)
    """
    best_match = None
    best_score = 0.0
    
    for anchor_data in available_anchors:
        score = calculate_similarity(old_anchor, anchor_data['anchor'])
        if score > best_score and score >= similarity_threshold:
            best_score = score
            best_match = anchor_data
    
    return best_match, best_score


def is_local_markdown_link(url: str) -> bool:
    """判断是否是本地Markdown文件链接"""
    if url.startswith(('http://', 'https://', 'mailto:', 'ftp://')):
        return False
    if url.endswith('.md') or url == '' or url.endswith('/'):
        return True
    return '.' not in os.path.basename(url)


def resolve_markdown_file_path(source_file_path: str, link_url: str) -> str:
    """解析链接对应的Markdown文件路径"""
    if not link_url or link_url.startswith('#'):
        return source_file_path
    
    source_dir = os.path.dirname(source_file_path)
    target_path = os.path.normpath(os.path.join(source_dir, link_url))
    
    if not target_path.endswith('.md'):
        if os.path.isdir(target_path):
            target_path = os.path.join(target_path, 'README.md')
        else:
            target_path += '.md'
    
    return target_path


def scan_file_for_broken_anchors(file_path: str, content: str, 
                                  all_files_anchors: Dict[str, List[Dict]]) -> List[Dict]:
    """
    扫描单个文件中的断链
    all_files_anchors: {文件路径: [锚点列表]}
    """
    broken_links = []
    links = parse_markdown_links(content)
    
    for link in links:
        url = link['url']
        old_anchor = link['anchor']
        
        if not is_local_markdown_link(url):
            continue
        
        target_file = resolve_markdown_file_path(file_path, url)
        
        if target_file not in all_files_anchors:
            broken_links.append({
                **link,
                'status': 'broken',
                'reason': 'target_file_not_found',
                'target_file': target_file
            })
            continue
        
        if not old_anchor:
            continue
        
        available_anchors = all_files_anchors[target_file]
        anchor_exists = any(a['anchor'] == old_anchor for a in available_anchors)
        
        if not anchor_exists:
            best_match, score = find_best_anchor_match(old_anchor, available_anchors)
            
            broken_links.append({
                **link,
                'status': 'broken',
                'reason': 'anchor_not_found',
                'target_file': target_file,
                'best_match': best_match,
                'similarity_score': score,
                'needs_review': score < 0.8
            })
    
    return broken_links


def scan_directory_for_markdown_files(dir_path: str) -> List[str]:
    """扫描目录下的所有Markdown文件"""
    md_files = []
    for root, dirs, files in os.walk(dir_path):
        for file in files:
            if file.endswith('.md'):
                md_files.append(os.path.join(root, file))
    return md_files


def generate_file_hash(content: str) -> str:
    """生成文件内容的hash用于检测变化"""
    return hashlib.md5(content.encode('utf-8')).hexdigest()


def preview_fix(content: str, link_info: Dict, new_anchor: str) -> Tuple[str, Dict]:
    """
    预览修复效果，返回修复后的内容和修复详情
    """
    lines = content.split('\n')
    line_idx = link_info['line'] - 1
    
    if line_idx >= len(lines):
        return content, {'success': False, 'error': 'line_out_of_range'}
    
    old_line = lines[line_idx]
    
    old_link = f"[{link_info['text']}]({link_info['url']}"
    if link_info['anchor']:
        old_link += f"#{link_info['anchor']}"
    old_link += ")"
    
    new_link = f"[{link_info['text']}]({link_info['url']}#{new_anchor})"
    
    new_line = old_line.replace(
        f"#{link_info['anchor']}",
        f"#{new_anchor}"
    ) if link_info['anchor'] else old_line
    
    lines[line_idx] = new_line
    
    return '\n'.join(lines), {
        'success': True,
        'old_line': old_line,
        'new_line': new_line,
        'old_anchor': link_info['anchor'],
        'new_anchor': new_anchor
    }
