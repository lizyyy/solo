#!/usr/bin/env python3
"""端到端测试"""

import json
import tempfile
from pathlib import Path
from shutil import rmtree

import numpy as np
import soundfile as sf

from sample_tagger.pipeline import TaggingPipeline
from sample_tagger.models import ProcessingStatus, DuplicateType


def generate_test_audio(duration: float = 0.5, freq: float = 440.0, sr: int = 22050) -> np.ndarray:
    t = np.linspace(0, duration, int(sr * duration), endpoint=False)
    envelope = np.exp(-3 * t)
    return envelope * 0.5 * np.sin(2 * np.pi * freq * t)


def create_test_samples(temp_dir: Path) -> Path:
    samples_dir = temp_dir / "samples"
    samples_dir.mkdir(parents=True)
    
    sr = 22050
    
    drum1 = generate_test_audio(0.3, 150.0, sr)
    bass1 = generate_test_audio(1.0, 80.0, sr)
    silence = np.zeros(int(sr * 1.0)) + 0.0001 * np.random.randn(int(sr * 1.0))
    
    sf.write(str(samples_dir / "kick_drum_001.wav"), drum1, sr)
    sf.write(str(samples_dir / "bass_808_002.wav"), bass1, sr)
    sf.write(str(samples_dir / "silent.wav"), silence, sr)
    sf.write(str(samples_dir / "kick_drum_001_copy.wav"), drum1, sr)
    
    dup_dir = samples_dir / "subfolder"
    dup_dir.mkdir()
    sf.write(str(dup_dir / "sample_001_kick.wav"), drum1, sr)
    
    return samples_dir


def test_full_pipeline():
    """测试完整流水线"""
    with tempfile.TemporaryDirectory() as tmpdir:
        temp_path = Path(tmpdir)
        
        samples_dir = create_test_samples(temp_path)
        output_dir = temp_path / "reports"
        
        pipeline = TaggingPipeline()
        bundle = pipeline.run(
            input_paths=[samples_dir],
            output_dir=output_dir,
            recursive=True,
        )
        
        assert bundle is not None
        assert bundle.report.summary.total_files == 5
        assert len(bundle.report.samples) == 5
        
        detailed_file = output_dir / f"{pipeline.run_id}_detailed.json"
        summary_file = output_dir / f"{pipeline.run_id}_summary.json"
        
        assert detailed_file.exists()
        assert summary_file.exists()
        
        with open(detailed_file, encoding="utf-8") as f:
            detailed_data = json.load(f)
        assert "report" in detailed_data
        assert "samples" in detailed_data["report"]
        
        duplicate_samples = [
            s for s in bundle.report.samples 
            if s.status == ProcessingStatus.DUPLICATE
        ]
        print(f"\n发现重复样本: {len(duplicate_samples)}")
        for dup in bundle.report.duplicates:
            print(f"  重复组 {dup.duplicate_group_id[:8]}: {len(dup.sample_ids)} 个样本, "
                  f"类型: {dup.duplicate_type.value}")
        
        assert len(bundle.report.duplicates) > 0, "应该检测到重复样本"
        
        print("\n样本状态:")
        for sample in bundle.report.samples:
            primary_tag = sample.get_primary_tag()
            tag_str = primary_tag.category.value if primary_tag else "none"
            print(f"  {sample.file_name}: {sample.status.value}, 标签: {tag_str}")
        
        silent_samples = [s for s in bundle.report.samples if s.is_silent]
        assert len(silent_samples) == 1, "应该检测到 1 个静音样本"
        
        tagged_samples = [s for s in bundle.report.samples if s.tags]
        assert len(tagged_samples) == 5, "所有样本都应该有标签"
        
        return True


def test_duplicate_detection_same_id():
    """测试重复编号检测"""
    from sample_tagger.duplicate_detector import DuplicateDetector
    from sample_tagger.models import SampleFile, SpectrumFeatures
    
    detector = DuplicateDetector()
    
    samples = [
        SampleFile(
            sample_id="id1",
            file_path=Path("/test/sample_001_kick.wav"),
            file_name="sample_001_kick.wav",
            file_hash="hash1",
            file_size=1000,
            sample_rate=22050,
            channels=1,
        ),
        SampleFile(
            sample_id="id2",
            file_path=Path("/test/other_sample_001.wav"),
            file_name="other_sample_001.wav",
            file_hash="hash2",
            file_size=1000,
            sample_rate=22050,
            channels=1,
        ),
        SampleFile(
            sample_id="id3",
            file_path=Path("/test/different_002.wav"),
            file_name="different_002.wav",
            file_hash="hash3",
            file_size=1000,
            sample_rate=22050,
            channels=1,
        ),
    ]
    
    _, duplicates = detector.detect_duplicates(samples)
    
    same_id_dups = [d for d in duplicates if d.duplicate_type == DuplicateType.SAME_ID]
    print(f"\n检测到的编号重复组: {len(same_id_dups)}")
    
    assert len(same_id_dups) >= 1, "应该检测到相同编号的样本"
    if same_id_dups:
        assert "001" in same_id_dups[0].evidence.get("matched_id", "")
    
    return True


if __name__ == "__main__":
    print("=" * 60)
    print("运行端到端测试...")
    print("=" * 60)
    
    try:
        result1 = test_full_pipeline()
        print(f"\n✓ 完整流水线测试通过")
    except AssertionError as e:
        print(f"\n✗ 完整流水线测试失败: {e}")
        raise
    
    try:
        result2 = test_duplicate_detection_same_id()
        print(f"\n✓ 重复编号检测测试通过")
    except AssertionError as e:
        print(f"\n✗ 重复编号检测测试失败: {e}")
        raise
    
    print("\n" + "=" * 60)
    print("所有测试通过!")
    print("=" * 60)
