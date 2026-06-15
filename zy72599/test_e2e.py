#!/usr/bin/env python3
"""
端到端验证脚本
验证：生成三类样本 -> 用新编号查看回放 -> 执行重跑脚本 -> 验证链路一致性
"""
import os
import subprocess
import sys
import json

STORAGE_MAIN = "track_records.json"
STORAGE_REPLAY = "e2e_replay_records.json"


def run_cmd(cmd, cwd="."):
    result = subprocess.run(
        cmd, shell=True, capture_output=True, text=True, cwd=cwd
    )
    return result.returncode, result.stdout, result.stderr


def main():
    print("=" * 70)
    print("样本权重异常追踪 - 端到端链路验证")
    print("=" * 70)
    print()

    work_dir = os.path.dirname(os.path.abspath(__file__))

    # ========== 第一步：生成三类样本 ==========
    print("【Step 1】生成三类样本")
    print("-" * 70)

    for f in [STORAGE_MAIN, STORAGE_REPLAY, "replay_normal.sh", "replay_threshold_issue.sh", "replay_log_supplement.sh"]:
        p = os.path.join(work_dir, f)
        if os.path.exists(p):
            os.remove(p)

    code, out, err = run_cmd(f"python3 cli.py run-samples --storage {STORAGE_MAIN}", cwd=work_dir)
    if code != 0:
        print("❌ 生成样本失败")
        print(err)
        return 1

    # 解析出三个追踪编号
    track_ids = {}
    for line in out.split("\n"):
        if "【场景一】" in line and "->" in line:
            track_ids["normal"] = line.split("->")[-1].strip()
        if "【场景二】" in line and "->" in line:
            track_ids["threshold_issue"] = line.split("->")[-1].strip()
        if "【场景三】" in line and "->" in line:
            track_ids["log_supplement"] = line.split("->")[-1].strip()

    print(f"  生成的追踪编号:")
    for k, v in track_ids.items():
        print(f"    {k}: {v}")
    print("  ✅ 三类样本生成成功")
    print()

    # ========== 第二步：用新编号查看和回放 ==========
    print("【Step 2】用新生成的编号查看和回放")
    print("-" * 70)

    for tag, tid in track_ids.items():
        code, out, err = run_cmd(
            f"python3 cli.py show --track-id {tid} --storage {STORAGE_MAIN} | head -10",
            cwd=work_dir
        )
        assert code == 0, f"查看 {tag} 失败: {err}"
        assert tid in out, f"查看结果的追踪ID不匹配"
        print(f"  ✅ {tag}: show 正常，追踪ID一致")

        code, out, err = run_cmd(
            f"python3 cli.py replay --track-id {tid} --storage {STORAGE_MAIN}",
            cwd=work_dir
        )
        assert code == 0, f"回放 {tag} 失败: {err}"
        assert "TRACK_ID=$(" in out or "TRACK_ID=$(python3" in out, "重跑脚本未使用变量承接新编号"
        assert '$TRACK_ID' in out, "重跑脚本后续步骤未使用变量"
        print(f"  ✅ {tag}: replay 正常，使用变量承接新编号")

    print("  ✅ 所有场景查看和回放正常")
    print()

    # ========== 第三步：执行重跑脚本，验证编号链路 ==========
    print("【Step 3】执行重跑脚本，验证编号链路一致性")
    print("-" * 70)

    for tag, tid in track_ids.items():
        print(f"\n  --- {tag} ---")
        replay_file = f"replay_{tag}.sh"

        # 生成独立存储的重跑脚本
        code, out, err = run_cmd(
            f"python3 cli.py replay --track-id {tid} --storage {STORAGE_MAIN}",
            cwd=work_dir
        )

        # 修改存储路径后运行
        replay_content = out.replace(
            f'STORAGE_FILE="{STORAGE_MAIN}"',
            f'STORAGE_FILE="{STORAGE_REPLAY}"'
        )
        test_script = f"test_e2e_replay_{tag}.sh"
        with open(os.path.join(work_dir, test_script), "w") as f:
            f.write(replay_content)
        os.chmod(os.path.join(work_dir, test_script), 0o755)

        # 清掉回放存储
        replay_storage = os.path.join(work_dir, STORAGE_REPLAY)
        if os.path.exists(replay_storage):
            os.remove(replay_storage)

        code, out, err = run_cmd(f"bash {test_script}", cwd=work_dir)
        if code != 0:
            print(f"    ❌ 重跑脚本执行失败")
            print(err)
            return 1

        # 从输出中提取第一步生成的编号和最终复盘的编号
        first_id = None
        final_id = None

        for line in out.split("\n"):
            if "新生成追踪编号:" in line:
                first_id = line.split(":")[-1].strip()
            if "追踪ID:" in line and "快照ID" not in line and "新生成" not in line:
                final_id = line.split(":")[-1].strip()

        assert first_id is not None, "未找到第一步生成的编号"
        assert final_id is not None, "未找到最终复盘的编号"
        assert first_id == final_id, f"编号链路断裂: 第一步={first_id}, 最终={final_id}"

        # 验证训练日志补看和分层指标都在
        assert "补看训练日志曲线" in out, "缺少训练日志补看步骤"
        assert "更新分层指标" in out or "分层指标处理完成" in out, "缺少分层指标更新步骤"

        # 验证存储里的记录
        with open(replay_storage) as f:
            data = json.load(f)
        assert first_id in data, f"存储中找不到编号 {first_id}"
        record = data[first_id]

        # 验证分层指标和历史记录的存在
        assert "stratified_metrics" in record
        assert "history" in record
        assert len(record["history"]) >= 3, "操作历史不足3步"

        print(f"    第一步编号: {first_id}")
        print(f"    最终编号:   {final_id}")
        print(f"    分层指标数: {len(record['stratified_metrics'])}")
        print(f"    操作历史数: {len(record['history'])}")
        print(f"    ✅ 编号链路一致，训练日志和分层指标都跟上了")

        # 清掉测试文件
        os.remove(os.path.join(work_dir, test_script))
        os.remove(replay_storage)

    print()
    print("=" * 70)
    print("✅ 端到端验证全部通过")
    print("=" * 70)
    print()
    print("验证要点总结:")
    print("  1. 样本生成、查看、回放读写同一份追踪记录文件 ✅")
    print("  2. 重跑脚本第一步生成新编号，后续步骤自动承接 ✅")
    print("  3. 训练日志补看跟着同一个编号走 ✅")
    print("  4. 分层指标更新跟着同一个编号走 ✅")
    print("  5. 可复盘记录跟着同一个编号走 ✅")

    return 0


if __name__ == "__main__":
    sys.exit(main())
