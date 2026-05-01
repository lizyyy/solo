import json
import hashlib
from pathlib import Path
from typing import Optional, Dict, Any

from .models import ProjectConfig, Speaker, Term, ForbiddenWord


class ConfigManager:
    DEFAULT_CONFIG_FILENAME = '.subtitle-checker.json'
    
    def __init__(self, config_path: Optional[Path] = None):
        self.config_path = config_path or self._find_config_file()
        self._config: Optional[ProjectConfig] = None
        self._config_hash: str = ''
    
    @classmethod
    def _find_config_file(cls) -> Path:
        current_dir = Path.cwd()
        
        config_file = current_dir / cls.DEFAULT_CONFIG_FILENAME
        if config_file.exists():
            return config_file
        
        for parent in current_dir.parents:
            config_file = parent / cls.DEFAULT_CONFIG_FILENAME
            if config_file.exists():
                return config_file
        
        return current_dir / cls.DEFAULT_CONFIG_FILENAME
    
    def load(self) -> ProjectConfig:
        if self._config is not None:
            return self._config
        
        if not self.config_path.exists():
            self._config = self._create_default_config()
            self._update_hash()
            return self._config
        
        with open(self.config_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        self._config = ProjectConfig.from_dict(data)
        self._update_hash()
        return self._config
    
    def save(self, config: Optional[ProjectConfig] = None) -> None:
        if config is not None:
            self._config = config
        
        if self._config is None:
            raise ValueError("No config to save")
        
        data = self._config.to_dict()
        
        self.config_path.parent.mkdir(parents=True, exist_ok=True)
        with open(self.config_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        self._update_hash()
    
    def _create_default_config(self) -> ProjectConfig:
        return ProjectConfig(name='Default Project')
    
    def _update_hash(self) -> None:
        if self._config is None:
            self._config_hash = ''
            return
        
        config_dict = self._config.to_dict()
        config_json = json.dumps(config_dict, sort_keys=True, ensure_ascii=False)
        self._config_hash = hashlib.sha256(config_json.encode('utf-8')).hexdigest()
    
    @property
    def config_hash(self) -> str:
        if self._config_hash == '' and self._config is not None:
            self._update_hash()
        return self._config_hash
    
    @property
    def config(self) -> Optional[ProjectConfig]:
        return self._config
    
    def init_project(self, project_name: str) -> ProjectConfig:
        if self.config_path.exists():
            raise FileExistsError(f"Config file already exists at {self.config_path}")
        
        self._config = ProjectConfig(name=project_name)
        self.save()
        return self._config
    
    def add_speaker(self, name: str, aliases: list = None, is_primary: bool = True) -> Speaker:
        config = self.load()
        
        for speaker in config.speakers:
            if speaker.name.lower() == name.lower():
                raise ValueError(f"Speaker '{name}' already exists")
        
        speaker = Speaker(
            name=name,
            aliases=aliases or [],
            is_primary=is_primary
        )
        config.speakers.append(speaker)
        self.save()
        
        return speaker
    
    def add_term(self, correct: str, alternatives: list = None, category: str = 'general') -> Term:
        config = self.load()
        
        for term in config.terms:
            if term.correct.lower() == correct.lower():
                raise ValueError(f"Term '{correct}' already exists")
        
        term = Term(
            correct=correct,
            alternatives=alternatives or [],
            category=category
        )
        config.terms.append(term)
        self.save()
        
        return term
    
    def add_forbidden_word(self, word: str, category: str = 'general', suggestion: str = None) -> ForbiddenWord:
        config = self.load()
        
        for fw in config.forbidden_words:
            if fw.word.lower() == word.lower():
                raise ValueError(f"Forbidden word '{word}' already exists")
        
        forbidden_word = ForbiddenWord(
            word=word,
            category=category,
            suggestion=suggestion
        )
        config.forbidden_words.append(forbidden_word)
        self.save()
        
        return forbidden_word
    
    def get_speaker_for_alias(self, alias: str) -> Optional[Speaker]:
        config = self.load()
        alias_lower = alias.lower()
        
        for speaker in config.speakers:
            if speaker.name.lower() == alias_lower:
                return speaker
            for speaker_alias in speaker.aliases:
                if speaker_alias.lower() == alias_lower:
                    return speaker
        
        return None
    
    def get_term_for_alternative(self, alternative: str) -> Optional[Term]:
        config = self.load()
        alt_lower = alternative.lower()
        
        for term in config.terms:
            if term.correct.lower() == alt_lower:
                return term
            for term_alt in term.alternatives:
                if term_alt.lower() == alt_lower:
                    return term
        
        return None
    
    def is_forbidden_word(self, word: str) -> Optional[ForbiddenWord]:
        config = self.load()
        word_lower = word.lower()
        
        for fw in config.forbidden_words:
            if fw.word.lower() == word_lower:
                return fw
        
        return None
