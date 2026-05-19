import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from backup_manifest_checker.core.parser import ManifestParser
from backup_manifest_checker.core.checksum import ChecksumVerifier, CheckStatus


def test_parser():
    manifest_path = Path(__file__).parent / "sample_data" / "manifest.txt"
    parser = ManifestParser(str(manifest_path))
    result = parser.parse()

    print(f"解析格式: {result.format.value}")
    print(f"解析块数: {len(result.chunks)}")
    print(f"解析错误数: {len(result.errors)}")

    assert len(result.chunks) == 4
    assert len(result.errors) == 1
    assert result.chunks[0].chunk_id == "chunk1.dat"

    print("解析测试通过!")


def test_checksum():
    backup_dir = Path(__file__).parent / "sample_data" / "backup"
    manifest_path = Path(__file__).parent / "sample_data" / "manifest.txt"

    parser = ManifestParser(str(manifest_path))
    parse_result = parser.parse()

    verifier = ChecksumVerifier(str(backup_dir))
    report = verifier.verify_all(parse_result.chunks)

    print(f"总块数: {report.total_chunks}")
    print(f"通过: {report.passed}")
    print(f"失败: {report.failed}")
    print(f"缺失: {report.missing}")

    assert report.total_chunks == 4
    assert report.passed == 2
    assert report.missing == 1

    print("校验和测试通过!")


if __name__ == "__main__":
    test_parser()
    print()
    test_checksum()
    print()
    print("所有测试通过!")
