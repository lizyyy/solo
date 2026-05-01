import csv
import yaml
import pandas as pd
from pathlib import Path
from typing import Dict, Tuple, Optional


def load_subjects_csv(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path)
    required_cols = ['subject_id']
    missing = [c for c in required_cols if c not in df.columns]
    if missing:
        raise ValueError(f"被试CSV缺少必要列: {missing}")
    
    duplicates = df[df.duplicated('subject_id', keep=False)]
    if not duplicates.empty:
        unique_subjects = df.groupby('subject_id').first().reset_index()
        print(f"⚠️  发现重复被试记录，保留首次出现: {duplicates['subject_id'].unique().tolist()}")
        return unique_subjects
    return df


def load_trials_csv(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path)
    required_cols = ['subject_id', 'rt', 'accuracy', 'condition', 'is_practice']
    missing = [c for c in required_cols if c not in df.columns]
    if missing:
        raise ValueError(f"Trial CSV缺少必要列: {missing}")
    return df


def load_design_yaml(path: Path) -> Dict:
    with open(path, 'r', encoding='utf-8') as f:
        return yaml.safe_load(f)


def validate_design(design: Dict, trials_df: pd.DataFrame) -> Tuple[Dict, pd.DataFrame]:
    valid_conditions = set(design.get('conditions', []))
    trial_conditions = set(trials_df['condition'].unique())
    
    typos = trial_conditions - valid_conditions
    corrections = {}
    
    if typos:
        print(f"⚠️  发现可能的条件名拼写错误: {typos}")
        if 'condition_typo_map' in design:
            corrections = design['condition_typo_map']
            trials_df = trials_df.copy()
            trials_df['condition'] = trials_df['condition'].replace(corrections)
            print(f"✓ 已应用拼写纠正: {corrections}")
    
    return design, trials_df


def load_all(
    subjects_path: str,
    trials_path: str,
    design_path: str
) -> Tuple[pd.DataFrame, pd.DataFrame, Dict]:
    subjects = load_subjects_csv(Path(subjects_path))
    trials = load_trials_csv(Path(trials_path))
    design = load_design_yaml(Path(design_path))
    design, trials = validate_design(design, trials)
    return subjects, trials, design
