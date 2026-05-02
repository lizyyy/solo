import re
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple

from .models import (
    SubtitleFile, SubtitleItem, ProjectConfig, Speaker, Term, Issue
)


@dataclass
class FixResult:
    success: bool
    original_file: Path
    fixed_file: Optional[Path] = None
    fixes_applied: int = 0
    fixes_details: List[Dict[str, Any]] = field(default_factory=list)
    message: str = ''
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'success': self.success,
            'original_file': str(self.original_file),
            'fixed_file': str(self.fixed_file) if self.fixed_file else None,
            'fixes_applied': self.fixes_applied,
            'fixes_details': self.fixes_details,
            'message': self.message
        }


class BaseFixer(ABC):
    @abstractmethod
    def fix(self, subtitle_file: SubtitleFile, config: ProjectConfig) -> Tuple[SubtitleFile, List[Dict[str, Any]]]:
        pass
    
    @property
    @abstractmethod
    def fixer_name(self) -> str:
        pass
    
    @property
    def is_safe(self) -> bool:
        return True


class SequenceFixer(BaseFixer):
    @property
    def fixer_name(self) -> str:
        return 'sequence_fixer'
    
    def fix(self, subtitle_file: SubtitleFile, config: ProjectConfig) -> Tuple[SubtitleFile, List[Dict[str, Any]]]:
        fixes: List[Dict[str, Any]] = []
        fixed_items: List[SubtitleItem] = []
        
        for expected_index, item in enumerate(subtitle_file.items, 1):
            if item.index != expected_index:
                fixes.append({
                    'type': 'sequence',
                    'original_index': item.index,
                    'new_index': expected_index,
                    'text': item.text
                })
                
                new_item = SubtitleItem(
                    index=expected_index,
                    start_time=item.start_time,
                    end_time=item.end_time,
                    text=item.text,
                    original_index=item.original_index
                )
                fixed_items.append(new_item)
            else:
                fixed_items.append(item)
        
        fixed_file = SubtitleFile(
            path=subtitle_file.path,
            format=subtitle_file.format,
            items=fixed_items,
            encoding=subtitle_file.encoding
        )
        
        return fixed_file, fixes


class SpeakerFixer(BaseFixer):
    SPEAKER_PATTERN = re.compile(r'^([^：:]+)[：:]\s*(.*)$')
    
    @property
    def fixer_name(self) -> str:
        return 'speaker_fixer'
    
    def fix(self, subtitle_file: SubtitleFile, config: ProjectConfig) -> Tuple[SubtitleFile, List[Dict[str, Any]]]:
        fixes: List[Dict[str, Any]] = []
        fixed_items: List[SubtitleItem] = []
        
        if not config.speakers:
            return subtitle_file, fixes
        
        speaker_alias_map: Dict[str, Speaker] = {}
        for speaker in config.speakers:
            speaker_alias_map[speaker.name.lower()] = speaker
            for alias in speaker.aliases:
                speaker_alias_map[alias.lower()] = speaker
        
        for item in subtitle_file.items:
            match = self.SPEAKER_PATTERN.match(item.text)
            if match:
                speaker_name = match.group(1).strip()
                rest_text = match.group(2).strip()
                
                speaker_name_lower = speaker_name.lower()
                
                if speaker_name_lower in speaker_alias_map:
                    correct_speaker = speaker_alias_map[speaker_name_lower]
                    
                    if correct_speaker.name.lower() != speaker_name_lower:
                        new_text = f"{correct_speaker.name}：{rest_text}"
                        
                        fixes.append({
                            'type': 'speaker',
                            'original_speaker': speaker_name,
                            'correct_speaker': correct_speaker.name,
                            'original_text': item.text,
                            'new_text': new_text,
                            'subtitle_index': item.index
                        })
                        
                        new_item = SubtitleItem(
                            index=item.index,
                            start_time=item.start_time,
                            end_time=item.end_time,
                            text=new_text,
                            original_index=item.original_index
                        )
                        fixed_items.append(new_item)
                        continue
            
            fixed_items.append(item)
        
        fixed_file = SubtitleFile(
            path=subtitle_file.path,
            format=subtitle_file.format,
            items=fixed_items,
            encoding=subtitle_file.encoding
        )
        
        return fixed_file, fixes


class TermFixer(BaseFixer):
    @property
    def fixer_name(self) -> str:
        return 'term_fixer'
    
    def fix(self, subtitle_file: SubtitleFile, config: ProjectConfig) -> Tuple[SubtitleFile, List[Dict[str, Any]]]:
        fixes: List[Dict[str, Any]] = []
        fixed_items: List[SubtitleItem] = []
        
        if not config.terms:
            return subtitle_file, fixes
        
        term_alias_map: Dict[str, Term] = {}
        for term in config.terms:
            for alt in term.alternatives:
                term_alias_map[alt.lower()] = term
        
        for item in subtitle_file.items:
            original_text = item.text
            new_text = original_text
            item_fixes: List[Dict[str, Any]] = []
            
            for alt_lower, term in term_alias_map.items():
                if alt_lower in new_text.lower():
                    pattern = re.compile(re.escape(alt_lower), re.IGNORECASE)
                    matches = list(pattern.finditer(new_text))
                    
                    for match in reversed(matches):
                        original_match = new_text[match.start():match.end()]
                        
                        fixes.append({
                            'type': 'term',
                            'original_term': original_match,
                            'correct_term': term.correct,
                            'category': term.category,
                            'subtitle_index': item.index,
                            'position': (match.start(), match.end())
                        })
                        
                        new_text = new_text[:match.start()] + term.correct + new_text[match.end():]
            
            if new_text != original_text:
                new_item = SubtitleItem(
                    index=item.index,
                    start_time=item.start_time,
                    end_time=item.end_time,
                    text=new_text,
                    original_index=item.original_index
                )
                fixed_items.append(new_item)
            else:
                fixed_items.append(item)
        
        fixed_file = SubtitleFile(
            path=subtitle_file.path,
            format=subtitle_file.format,
            items=fixed_items,
            encoding=subtitle_file.encoding
        )
        
        return fixed_file, fixes


class FixerManager:
    def __init__(self):
        self.fixers: List[BaseFixer] = [
            SequenceFixer(),
            SpeakerFixer(),
            TermFixer(),
        ]
    
    def fix_file(self, subtitle_file: SubtitleFile, config: ProjectConfig, 
                  fixer_names: Optional[List[str]] = None) -> Tuple[SubtitleFile, List[Dict[str, Any]]]:
        all_fixes: List[Dict[str, Any]] = []
        current_file = subtitle_file
        
        for fixer in self.fixers:
            if fixer_names and fixer.fixer_name not in fixer_names:
                continue
            
            if not fixer.is_safe:
                continue
            
            current_file, fixes = fixer.fix(current_file, config)
            all_fixes.extend(fixes)
        
        return current_file, all_fixes
    
    def fix_files(self, subtitle_files: List[SubtitleFile], config: ProjectConfig,
                   fixer_names: Optional[List[str]] = None) -> Dict[Path, Tuple[SubtitleFile, List[Dict[str, Any]]]]:
        results: Dict[Path, Tuple[SubtitleFile, List[Dict[str, Any]]]] = {}
        
        for subtitle_file in subtitle_files:
            fixed_file, fixes = self.fix_file(subtitle_file, config, fixer_names)
            results[subtitle_file.path] = (fixed_file, fixes)
        
        return results
    
    def list_fixers(self) -> List[Dict[str, Any]]:
        return [
            {
                'name': fixer.fixer_name,
                'is_safe': fixer.is_safe,
                'description': self._get_fixer_description(fixer)
            }
            for fixer in self.fixers
        ]
    
    def _get_fixer_description(self, fixer: BaseFixer) -> str:
        descriptions = {
            'sequence_fixer': '重新排序字幕序号，确保序号连续',
            'speaker_fixer': '统一说话人名称，将别名替换为标准名称',
            'term_fixer': '统一术语使用，将替代术语替换为标准术语',
        }
        return descriptions.get(fixer.fixer_name, '')


def generate_fixed_filename(original_path: Path, suffix: str = '_fixed') -> Path:
    stem = original_path.stem
    extension = original_path.suffix
    new_name = f"{stem}{suffix}{extension}"
    return original_path.parent / new_name
