#!/usr/bin/env python3
"""测试场景生成器 - 创建包含各种边界情况的测试仓库"""

import os
import subprocess
import tempfile
import shutil
from pathlib import Path

TEST_REPOS_DIR = Path(__file__).parent / "test_repos"


def run_git(repo_path, *args):
    """运行Git命令"""
    result = subprocess.run(
        ["git"] + list(args),
        cwd=repo_path,
        capture_output=True,
        text=True
    )
    return result


def create_lfs_pointer(oid, size, path):
    """创建LFS指针文件"""
    content = f"""version https://git-lfs.github.com/spec/v1
oid sha256:{oid}
size {size}
"""
    path.write_text(content)


def setup_empty_repo():
    """场景1: 空仓库 - 没有LFS文件"""
    repo_path = TEST_REPOS_DIR / "empty_repo"
    if repo_path.exists():
        shutil.rmtree(repo_path)
    repo_path.mkdir(parents=True)
    
    run_git(repo_path, "init")
    run_git(repo_path, "config", "user.name", "Test User")
    run_git(repo_path, "config", "user.email", "test@example.com")
    
    (repo_path / "README.md").write_text("# Empty Repository\n")
    run_git(repo_path, "add", ".")
    run_git(repo_path, "commit", "-m", "Initial commit")
    
    return repo_path


def setup_normal_repo():
    """场景2: 正常仓库 - 包含多个有效LFS文件"""
    repo_path = TEST_REPOS_DIR / "normal_repo"
    if repo_path.exists():
        shutil.rmtree(repo_path)
    repo_path.mkdir(parents=True)
    
    run_git(repo_path, "init")
    run_git(repo_path, "config", "user.name", "Test User")
    run_git(repo_path, "config", "user.email", "test@example.com")
    
    # 第一次提交：大模型文件
    models_dir = repo_path / "models"
    models_dir.mkdir()
    create_lfs_pointer(
        "a" * 64,
        100 * 1024 * 1024,  # 100MB
        models_dir / "large_model.bin"
    )
    run_git(repo_path, "add", ".")
    run_git(repo_path, "commit", "-m", "Add large model")
    
    # 第二次提交：图像文件
    images_dir = repo_path / "data" / "images"
    images_dir.mkdir(parents=True)
    create_lfs_pointer(
        "b" * 64,
        50 * 1024 * 1024,  # 50MB
        images_dir / "image_large.png"
    )
    create_lfs_pointer(
        "c" * 64,
        1 * 1024 * 1024,  # 1MB
        images_dir / "image_small.png"
    )
    run_git(repo_path, "add", ".")
    run_git(repo_path, "commit", "-m", "Add images")
    
    # 第三次提交：不同作者
    run_git(repo_path, "config", "user.name", "Another User")
    run_git(repo_path, "config", "user.email", "another@example.com")
    
    videos_dir = repo_path / "data" / "videos"
    videos_dir.mkdir()
    create_lfs_pointer(
        "d" * 64,
        200 * 1024 * 1024,  # 200MB
        videos_dir / "sample_video.mp4"
    )
    run_git(repo_path, "add", ".")
    run_git(repo_path, "commit", "-m", "Add video by another user")
    
    return repo_path


def setup_dirty_data_repo():
    """场景3: 脏数据仓库 - 包含损坏/无效的LFS指针"""
    repo_path = TEST_REPOS_DIR / "dirty_data_repo"
    if repo_path.exists():
        shutil.rmtree(repo_path)
    repo_path.mkdir(parents=True)
    
    run_git(repo_path, "init")
    run_git(repo_path, "config", "user.name", "Test User")
    run_git(repo_path, "config", "user.email", "test@example.com")
    
    # 有效的LFS指针
    create_lfs_pointer("a" * 64, 50 * 1024 * 1024, repo_path / "valid_file.bin")
    
    # 损坏的LFS指针 - oid长度不对
    (repo_path / "bad_oid.bin").write_text("""version https://git-lfs.github.com/spec/v1
oid sha256:abc123
size 100
""")
    
    # 损坏的LFS指针 - 缺少size
    (repo_path / "missing_size.bin").write_text("""version https://git-lfs.github.com/spec/v1
oid sha256:1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
""")
    
    # 损坏的LFS指针 - 格式完全错误
    (repo_path / "corrupted.bin").write_text("This is not a LFS pointer at all")
    
    # 普通文本文件（不是LFS）
    (repo_path / "normal.txt").write_text("Hello World")
    
    run_git(repo_path, "add", ".")
    run_git(repo_path, "commit", "-m", "Add mix of valid and invalid files")
    
    return repo_path


def setup_duplicate_files_repo():
    """场景4: 边界冲突 - 相同OID出现在不同路径/提交"""
    repo_path = TEST_REPOS_DIR / "duplicate_files_repo"
    if repo_path.exists():
        shutil.rmtree(repo_path)
    repo_path.mkdir(parents=True)
    
    run_git(repo_path, "init")
    run_git(repo_path, "config", "user.name", "Test User")
    run_git(repo_path, "config", "user.email", "test@example.com")
    
    # 同一文件出现在不同路径
    common_oid = "f" * 64
    common_size = 75 * 1024 * 1024  # 75MB
    
    create_lfs_pointer(common_oid, common_size, repo_path / "original.bin")
    run_git(repo_path, "add", ".")
    run_git(repo_path, "commit", "-m", "Add original file")
    
    # 复制到另一个位置（相同OID）
    create_lfs_pointer(common_oid, common_size, repo_path / "backup.bin")
    run_git(repo_path, "add", ".")
    run_git(repo_path, "commit", "-m", "Add backup copy")
    
    # 又复制到子目录
    subdir = repo_path / "subdir"
    subdir.mkdir()
    create_lfs_pointer(common_oid, common_size, subdir / "copy.bin")
    run_git(repo_path, "add", ".")
    run_git(repo_path, "commit", "-m", "Add another copy in subdir")
    
    # 添加其他不同的文件
    create_lfs_pointer("e" * 64, 25 * 1024 * 1024, repo_path / "other_file.bin")
    run_git(repo_path, "add", ".")
    run_git(repo_path, "commit", "-m", "Add other unique file")
    
    return repo_path


def setup_deep_hierarchy_repo():
    """场景5: 深层目录结构 - 测试路径聚合功能"""
    repo_path = TEST_REPOS_DIR / "deep_hierarchy_repo"
    if repo_path.exists():
        shutil.rmtree(repo_path)
    repo_path.mkdir(parents=True)
    
    run_git(repo_path, "init")
    run_git(repo_path, "config", "user.name", "Test User")
    run_git(repo_path, "config", "user.email", "test@example.com")
    
    # 创建深层目录结构
    base_path = repo_path
    for level in ["level1", "level2", "level3", "level4", "level5"]:
        base_path = base_path / level
        base_path.mkdir()
        create_lfs_pointer(
            f"{level[-1]}" * 64,
            10 * 1024 * 1024,  # 10MB
            base_path / f"{level}_data.bin"
        )
    
    run_git(repo_path, "add", ".")
    run_git(repo_path, "commit", "-m", "Add deep hierarchy files")
    
    return repo_path


def setup_mixed_sizes_repo():
    """场景6: 各种大小的文件 - 测试大小过滤功能"""
    repo_path = TEST_REPOS_DIR / "mixed_sizes_repo"
    if repo_path.exists():
        shutil.rmtree(repo_path)
    repo_path.mkdir(parents=True)
    
    run_git(repo_path, "init")
    run_git(repo_path, "config", "user.name", "Test User")
    run_git(repo_path, "config", "user.email", "test@example.com")
    
    sizes = {
        "tiny.bin": 100,          # 100B
        "small.bin": 10 * 1024,   # 10KB
        "medium.bin": 500 * 1024, # 500KB
        "large.bin": 5 * 1024 * 1024,  # 5MB
        "xlarge.bin": 50 * 1024 * 1024, # 50MB
        "huge.bin": 500 * 1024 * 1024,  # 500MB
    }
    
    for i, (filename, size) in enumerate(sizes.items()):
        create_lfs_pointer(
            f"{i:064d}",  # 用数字填充64位
            size,
            repo_path / filename
        )
    
    run_git(repo_path, "add", ".")
    run_git(repo_path, "commit", "-m", "Add files of various sizes")
    
    return repo_path


def setup_special_chars_repo():
    """场景7: 特殊字符路径 - 测试路径处理"""
    repo_path = TEST_REPOS_DIR / "special_chars_repo"
    if repo_path.exists():
        shutil.rmtree(repo_path)
    repo_path.mkdir(parents=True)
    
    run_git(repo_path, "init")
    run_git(repo_path, "config", "user.name", "Test User")
    run_git(repo_path, "config", "user.email", "test@example.com")
    
    # 创建包含特殊字符的目录和文件
    (repo_path / "dir with spaces").mkdir()
    create_lfs_pointer(
        "1" * 64,
        1024 * 1024,
        repo_path / "dir with spaces" / "file with spaces.bin"
    )
    
    (repo_path / "中文目录").mkdir()
    create_lfs_pointer(
        "2" * 64,
        2 * 1024 * 1024,
        repo_path / "中文目录" / "中文文件名.bin"
    )
    
    (repo_path / "special_chars").mkdir()
    create_lfs_pointer(
        "3" * 64,
        3 * 1024 * 1024,
        repo_path / "special_chars" / "file_with_underscores.bin"
    )
    
    run_git(repo_path, "add", ".")
    run_git(repo_path, "commit", "-m", "Add files with special path names")
    
    return repo_path


def setup_all_scenarios():
    """设置所有测试场景"""
    TEST_REPOS_DIR.mkdir(parents=True, exist_ok=True)
    
    print("创建测试仓库...")
    
    repos = [
        ("空仓库 (无LFS文件)", setup_empty_repo),
        ("正常仓库 (多LFS文件)", setup_normal_repo),
        ("脏数据仓库 (损坏指针)", setup_dirty_data_repo),
        ("重复文件仓库 (相同OID)", setup_duplicate_files_repo),
        ("深层目录仓库", setup_deep_hierarchy_repo),
        ("混合大小仓库", setup_mixed_sizes_repo),
        ("特殊字符路径仓库", setup_special_chars_repo),
    ]
    
    for name, setup_func in repos:
        print(f"  - {name}...", end=" ")
        repo_path = setup_func()
        print(f"完成 -> {repo_path}")
    
    print("\n所有测试场景已创建完成!")
    print(f"测试仓库位置: {TEST_REPOS_DIR.resolve()}")


if __name__ == "__main__":
    setup_all_scenarios()
