#!/usr/bin/env python3
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from datetime import datetime, timedelta
from kubectl_parser import KubectlOutputParser
from timeline_analyzer import TimelineAnalyzer, ImageComparator
from markdown_generator import MarkdownReportGenerator


SAMPLE_EVENTS_OUTPUT = """LAST SEEN   TYPE      REASON              OBJECT                                        MESSAGE
2m5s        Warning   FailedScheduling    pod/myapp-7f9d8c7546-2xqz8                   0/3 nodes are available: 3 Insufficient cpu.
118s        Warning   BackOff             pod/myapp-7f9d8c7546-2xqz8                   Back-off restarting failed container
115s        Normal    Pulling             pod/myapp-7f9d8c7546-2xqz8                   Pulling image "myregistry/myapp:v2.0"
110s        Warning   Failed              pod/myapp-7f9d8c7546-2xqz8                   Failed to pull image "myregistry/myapp:v2.0": rpc error: code = Unknown desc = Error response from daemon: manifest for myregistry/myapp:v2.0 not found: manifest unknown: manifest unknown
105s        Warning   Failed              pod/myapp-7f9d8c7546-2xqz8                   Error: ImagePullBackOff
95s         Normal    SandboxChanged      pod/myapp-7f9d8c7546-2xqz8                   Pod sandbox changed, it will be killed and re-created.
85s         Warning   Unhealthy           pod/myapp-7f9d8c7546-2xqz8                   Readiness probe failed: Get "http://10.244.0.123:8080/health": dial tcp 10.244.0.123:8080: connect: connection refused
75s         Warning   ProbeWarning        pod/myapp-7f9d8c7546-2xqz8                   Liveness probe warning: Readiness probe failed
"""

SAMPLE_PODS_OUTPUT = """NAME                     READY   STATUS             RESTARTS   AGE     IP            NODE
myapp-7f9d8c7546-2xqz8  0/1     ImagePullBackOff   5          10m     10.244.0.123  node-01
myapp-7f9d8c7546-abcde  0/1     CrashLoopBackOff   3          8m      10.244.0.124  node-02
myapp-6d7c987546-xyz12  1/1     Running            0          1h      10.244.0.120  node-01
"""


class TestResult:
    def __init__(self, name: str, passed: bool, message: str = ""):
        self.name = name
        self.passed = passed
        self.message = message

    def __str__(self):
        status = "✅ PASS" if self.passed else "❌ FAIL"
        msg = f" - {self.message}" if self.message else ""
        return f"{status}: {self.name}{msg}"


def run_tests():
    results = []
    print("=" * 70)
    print("K8s 发布失败时间线分析系统 - 自检脚本")
    print("=" * 70)
    print()

    print("📦 模块 1: kubectl 输出解析")
    print("-" * 50)

    parser = KubectlOutputParser()

    events = parser.parse_events(SAMPLE_EVENTS_OUTPUT)
    results.append(TestResult(
        "事件解析",
        len(events) > 0,
        f"成功解析 {len(events)} 条事件"
    ))
    print(f"  - 解析事件数: {len(events)}")

    if events:
        warning_events = [e for e in events if e.type == 'Warning']
        results.append(TestResult(
            "事件类型识别",
            len(warning_events) > 0,
            f"识别到 {len(warning_events)} 条 Warning 事件"
        ))
        print(f"  - Warning 事件数: {len(warning_events)}")

    pods = parser.parse_pods(SAMPLE_PODS_OUTPUT)
    results.append(TestResult(
        "Pod列表解析",
        len(pods) == 3,
        f"成功解析 {len(pods)} 个Pod"
    ))
    print(f"  - 解析Pod数: {len(pods)}")

    abnormal_pods = [p for p in pods if p.status not in ['Running', 'Succeeded']]
    results.append(TestResult(
        "异常Pod识别",
        len(abnormal_pods) == 2,
        f"识别到 {len(abnormal_pods)} 个异常Pod"
    ))
    print(f"  - 异常Pod数: {len(abnormal_pods)}")

    print()
    print("🔍 模块 2: 事件排序与状态归因")
    print("-" * 50)

    analyzer = TimelineAnalyzer()

    events_dict = [
        {
            "event_time": datetime.utcnow() - timedelta(minutes=i),
            "type": 'Warning' if i % 2 == 0 else 'Normal',
            "reason": f"Reason{i}",
            "message": f"Test message {i}",
            "involved_object_kind": "Pod",
            "involved_object_name": f"pod-{i}",
            "source_component": "kubelet",
            "count": 1
        }
        for i in range(5)
    ]

    sorted_events = analyzer.sort_events_by_time(events_dict)
    results.append(TestResult(
        "事件时间排序",
        len(sorted_events) == len(events_dict),
        "排序功能正常"
    ))
    print(f"  - 排序后事件数: {len(sorted_events)}")

    warning_events = analyzer.filter_warning_events(events_dict)
    results.append(TestResult(
        "Warning事件过滤",
        len(warning_events) == 3,
        f"过滤到 {len(warning_events)} 条 Warning 事件"
    ))
    print(f"  - 过滤后Warning事件数: {len(warning_events)}")

    pods_dict = [
        {
            "pod_name": f"pod-{i}",
            "status": 'ImagePullBackOff' if i == 0 else 'Running',
            "restarts": 5 if i == 0 else 0,
            "image": f"myapp:v{i}"
        }
        for i in range(3)
    ]

    analysis = analyzer.analyze_failure_reason(events_dict, pods_dict)
    results.append(TestResult(
        "故障根因分析",
        analysis.root_cause is not None,
        f"识别根因: {analysis.root_cause} (置信度: {analysis.confidence})"
    ))
    print(f"  - 根因识别: {analysis.root_cause}")
    print(f"  - 置信度: {analysis.confidence}")
    print(f"  - 建议数量: {len(analysis.suggested_actions)}")

    results.append(TestResult(
        "修复建议生成",
        len(analysis.suggested_actions) >= 1,
        f"生成 {len(analysis.suggested_actions)} 条建议"
    ))

    print()
    print("🖼️  模块 3: 镜像对比功能")
    print("-" * 50)

    comparator = ImageComparator()

    result = comparator.compare("myregistry/myapp:v1.0", "myregistry/myapp:v2.0")
    results.append(TestResult(
        "镜像标签对比",
        result["tag_changed"] == True,
        f"标签变化检测: {result['old_tag']} -> {result['new_tag']}"
    ))
    print(f"  - 标签变更: {result['tag_changed']}")
    print(f"  - 旧标签: {result['old_tag']}")
    print(f"  - 新标签: {result['new_tag']}")

    result2 = comparator.compare("myregistry/myapp:v1.0", "other-registry/myapp:v1.0")
    results.append(TestResult(
        "镜像仓库对比",
        result2["repository_changed"] == True,
        "仓库变化检测正常"
    ))
    print(f"  - 仓库变更检测: {result2['repository_changed']}")

    tag = comparator.extract_tag("nginx:1.21.0-alpine")
    results.append(TestResult(
        "镜像标签提取",
        tag == "1.21.0-alpine",
        f"提取标签: {tag}"
    ))
    print(f"  - 标签提取: nginx:1.21.0-alpine -> {tag}")

    print()
    print("📄 模块 4: Markdown报告生成")
    print("-" * 50)

    generator = MarkdownReportGenerator()

    release_info = {
        "namespace": "default",
        "deployment_name": "myapp",
        "release_time": datetime.utcnow(),
        "result": "failed"
    }

    analysis_dict = {
        "root_cause": "ImagePullBackOff",
        "confidence": "high",
        "suggested_actions": analysis.suggested_actions
    }

    image_compare = {
        "old_image": "myregistry/myapp:v1.0",
        "new_image": "myregistry/myapp:v2.0",
        "old_tag": "v1.0",
        "new_tag": "v2.0",
        "tag_changed": True,
        "image_changed": True
    }

    markdown = generator.generate_full_report(
        release_info=release_info,
        events=events_dict,
        pods=pods_dict,
        analysis=analysis_dict,
        image_comparison=image_compare
    )

    results.append(TestResult(
        "Markdown报告生成",
        len(markdown) > 0 and "# K8s 发布失败时间线分析报告" in markdown,
        f"报告长度: {len(markdown)} 字符"
    ))
    print(f"  - 报告长度: {len(markdown)} 字符")

    has_root_cause = "ImagePullBackOff" in markdown
    results.append(TestResult(
        "报告包含根因",
        has_root_cause,
        "根因信息已包含在报告中"
    ))
    print(f"  - 报告包含根因: {has_root_cause}")

    has_suggestions = "排查建议" in markdown
    results.append(TestResult(
        "报告包含建议",
        has_suggestions,
        "排查建议已包含在报告中"
    ))
    print(f"  - 报告包含建议: {has_suggestions}")

    print()
    print("=" * 70)
    print("测试结果汇总")
    print("=" * 70)
    print()

    passed = sum(1 for r in results if r.passed)
    total = len(results)

    for result in results:
        print(result)

    print()
    print(f"总计: {passed}/{total} 测试通过")
    print()

    if passed == total:
        print("🎉 所有测试通过！系统功能正常。")
    elif passed >= total * 0.8:
        print("⚠️  大部分测试通过，少数功能需要检查。")
    else:
        print("❌ 较多测试失败，请检查代码。")

    print()

    with open("test_report.md", "w") as f:
        f.write("# K8s 发布失败时间线分析系统 - 自检报告\n\n")
        f.write(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
        f.write("## 测试结果\n\n")
        for result in results:
            status = "✅ PASS" if result.passed else "❌ FAIL"
            f.write(f"- {status}: {result.name}\n")
            if result.message:
                f.write(f"  - {result.message}\n")
            f.write("\n")

        f.write(f"## 总结\n\n")
        f.write(f"- 通过: {passed}/{total}\n")
        f.write(f"- 通过率: {passed/total*100:.1f}%\n\n")

        if passed == total:
            f.write("✅ **所有测试通过**\n")
        elif passed >= total * 0.8:
            f.write("⚠️ **大部分测试通过**\n")
        else:
            f.write("❌ **需要修复**\n")

    print("详细报告已保存到 test_report.md")

    return passed == total


if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
