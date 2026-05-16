import json
import os
from datetime import datetime, timedelta
from typing import Dict, Any

from .parser import K8sOutputParser
from .analyzer import TimelineAnalyzer
from .output import OutputGenerator


class SelfTest:
    def __init__(self, test_dir: str):
        self.test_dir = test_dir
        self.results: Dict[str, Dict[str, Any]] = {}

    def _generate_normal_events(self) -> Dict[str, Any]:
        now = datetime.utcnow()
        return {
            "apiVersion": "v1",
            "items": [
                {
                    "apiVersion": "v1",
                    "count": 1,
                    "eventTime": (now - timedelta(minutes=10)).isoformat() + "Z",
                    "involvedObject": {
                        "apiVersion": "apps/v1",
                        "kind": "ReplicaSet",
                        "name": "web-app-7f98d7c6b4",
                        "namespace": "default"
                    },
                    "kind": "Event",
                    "message": "Created pod: web-app-7f98d7c6b4-abcde",
                    "reason": "SuccessfulCreate",
                    "source": {"component": "replicaset-controller"},
                    "type": "Normal"
                },
                {
                    "apiVersion": "v1",
                    "count": 1,
                    "eventTime": (now - timedelta(minutes=9)).isoformat() + "Z",
                    "involvedObject": {
                        "kind": "Pod",
                        "name": "web-app-7f98d7c6b4-abcde",
                        "namespace": "default"
                    },
                    "kind": "Event",
                    "message": "Successfully pulled image \"nginx:1.21\"",
                    "reason": "Pulled",
                    "source": {"component": "kubelet"},
                    "type": "Normal"
                },
                {
                    "apiVersion": "v1",
                    "count": 1,
                    "eventTime": (now - timedelta(minutes=8)).isoformat() + "Z",
                    "involvedObject": {
                        "kind": "Pod",
                        "name": "web-app-7f98d7c6b4-abcde",
                        "namespace": "default"
                    },
                    "kind": "Event",
                    "message": "Started container nginx",
                    "reason": "Started",
                    "source": {"component": "kubelet"},
                    "type": "Normal"
                }
            ],
            "kind": "List"
        }

    def _generate_error_events(self) -> Dict[str, Any]:
        now = datetime.utcnow()
        return {
            "apiVersion": "v1",
            "items": [
                {
                    "apiVersion": "v1",
                    "count": 5,
                    "eventTime": (now - timedelta(minutes=5)).isoformat() + "Z",
                    "involvedObject": {
                        "kind": "Pod",
                        "name": "web-app-bad-image-xyz",
                        "namespace": "default"
                    },
                    "kind": "Event",
                    "message": "Failed to pull image \"nginx:invalid-tag\": rpc error: code = Unknown desc = Error response from daemon: manifest for nginx:invalid-tag not found",
                    "reason": "Failed",
                    "source": {"component": "kubelet"},
                    "type": "Warning"
                },
                {
                    "apiVersion": "v1",
                    "count": 3,
                    "eventTime": (now - timedelta(minutes=3)).isoformat() + "Z",
                    "involvedObject": {
                        "kind": "Pod",
                        "name": "web-app-crash-abc",
                        "namespace": "default"
                    },
                    "kind": "Event",
                    "message": "Back-off restarting failed container",
                    "reason": "BackOff",
                    "source": {"component": "kubelet"},
                    "type": "Warning"
                }
            ],
            "kind": "List"
        }

    def _generate_pods(self) -> Dict[str, Any]:
        now = datetime.utcnow()
        return {
            "apiVersion": "v1",
            "items": [
                {
                    "apiVersion": "v1",
                    "kind": "Pod",
                    "metadata": {
                        "name": "web-app-7f98d7c6b4-abcde",
                        "namespace": "default",
                        "labels": {"app": "web", "pod-template-hash": "7f98d7c6b4"}
                    },
                    "spec": {
                        "containers": [
                            {"name": "nginx", "image": "nginx:1.21"}
                        ]
                    },
                    "status": {
                        "phase": "Running",
                        "podIP": "10.244.1.10",
                        "hostIP": "192.168.1.100",
                        "startTime": (now - timedelta(minutes=8)).isoformat() + "Z",
                        "containerStatuses": [
                            {"name": "nginx", "ready": True, "restartCount": 0}
                        ],
                        "qosClass": "BestEffort"
                    }
                },
                {
                    "apiVersion": "v1",
                    "kind": "Pod",
                    "metadata": {
                        "name": "web-app-7f98d7c6b4-fghij",
                        "namespace": "default",
                        "labels": {"app": "web", "pod-template-hash": "7f98d7c6b4"}
                    },
                    "spec": {
                        "containers": [
                            {"name": "nginx", "image": "nginx:1.21"}
                        ]
                    },
                    "status": {
                        "phase": "Running",
                        "podIP": "10.244.1.11",
                        "hostIP": "192.168.1.100",
                        "startTime": (now - timedelta(minutes=7)).isoformat() + "Z",
                        "containerStatuses": [
                            {"name": "nginx", "ready": True, "restartCount": 0}
                        ],
                        "qosClass": "BestEffort"
                    }
                }
            ],
            "kind": "List"
        }

    def _generate_replicasets(self) -> Dict[str, Any]:
        now = datetime.utcnow()
        return {
            "apiVersion": "v1",
            "items": [
                {
                    "apiVersion": "apps/v1",
                    "kind": "ReplicaSet",
                    "metadata": {
                        "name": "web-app-7f98d7c6b4",
                        "namespace": "default",
                        "labels": {"app": "web", "pod-template-hash": "7f98d7c6b4"},
                        "creationTimestamp": (now - timedelta(minutes=15)).isoformat() + "Z"
                    },
                    "spec": {"replicas": 2},
                    "status": {
                        "replicas": 2,
                        "readyReplicas": 2,
                        "availableReplicas": 2
                    }
                }
            ],
            "kind": "List"
        }

    def _generate_deployment(self) -> Dict[str, Any]:
        now = datetime.utcnow()
        return {
            "apiVersion": "apps/v1",
            "kind": "Deployment",
            "metadata": {
                "name": "web-app",
                "namespace": "default",
                "creationTimestamp": (now - timedelta(hours=1)).isoformat() + "Z"
            },
            "spec": {
                "replicas": 2,
                "strategy": {"type": "RollingUpdate"}
            },
            "status": {
                "replicas": 2,
                "updatedReplicas": 2,
                "readyReplicas": 2,
                "availableReplicas": 2,
                "observedGeneration": 1
            }
        }

    def _save_sample_data(self):
        normal_events = self._generate_normal_events()
        error_events = self._generate_error_events()
        pods = self._generate_pods()
        replicasets = self._generate_replicasets()
        deployment = self._generate_deployment()

        files = {
            'events_normal.json': normal_events,
            'events_error.json': error_events,
            'pods.json': pods,
            'replicasets.json': replicasets,
            'deployment.json': deployment
        }

        for filename, data in files.items():
            filepath = os.path.join(self.test_dir, filename)
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2)

        return files

    def _test_parse_normal(self, files: Dict[str, str]) -> Dict[str, Any]:
        parser = K8sOutputParser()

        events_path = os.path.join(self.test_dir, 'events_normal.json')
        pods_path = os.path.join(self.test_dir, 'pods.json')
        rs_path = os.path.join(self.test_dir, 'replicasets.json')
        dep_path = os.path.join(self.test_dir, 'deployment.json')

        events = parser.parse_events_json(open(events_path).read(), events_path)
        pods = parser.parse_pods_json(open(pods_path).read(), pods_path)
        replicasets = parser.parse_replicasets_json(open(rs_path).read(), rs_path)
        deployment = parser.parse_deployment_json(open(dep_path).read(), dep_path)

        if len(events) != 3:
            return {'passed': False, 'error': f'Expected 3 events, got {len(events)}'}
        if len(pods) != 2:
            return {'passed': False, 'error': f'Expected 2 pods, got {len(pods)}'}
        if len(replicasets) != 1:
            return {'passed': False, 'error': f'Expected 1 replicaset, got {len(replicasets)}'}
        if deployment is None:
            return {'passed': False, 'error': 'Failed to parse deployment'}
        if len(parser.parse_errors) > 0:
            return {'passed': False, 'error': f'Unexpected parse errors: {parser.parse_errors}'}

        return {'passed': True, 'data': {'events': events, 'pods': pods, 'replicasets': replicasets, 'deployment': deployment}}

    def _test_parse_with_errors(self) -> Dict[str, Any]:
        parser = K8sOutputParser()

        events_path = os.path.join(self.test_dir, 'events_error.json')
        events = parser.parse_events_json(open(events_path).read(), events_path)

        if len(events) != 2:
            return {'passed': False, 'error': f'Expected 2 events, got {len(events)}'}

        warning_events = [e for e in events if e.type == 'Warning']
        if len(warning_events) != 2:
            return {'passed': False, 'error': f'Expected 2 warning events, got {len(warning_events)}'}

        return {'passed': True}

    def _test_analyzer(self) -> Dict[str, Any]:
        parser = K8sOutputParser()

        events_path = os.path.join(self.test_dir, 'events_normal.json')
        pods_path = os.path.join(self.test_dir, 'pods.json')
        rs_path = os.path.join(self.test_dir, 'replicasets.json')
        dep_path = os.path.join(self.test_dir, 'deployment.json')

        events = parser.parse_events_json(open(events_path).read(), events_path)
        pods = parser.parse_pods_json(open(pods_path).read(), pods_path)
        replicasets = parser.parse_replicasets_json(open(rs_path).read(), rs_path)
        deployment = parser.parse_deployment_json(open(dep_path).read(), dep_path)

        analyzer = TimelineAnalyzer('web-app', 'default')
        report = analyzer.analyze(events, pods, replicasets, deployment)

        if report.deployment_name != 'web-app':
            return {'passed': False, 'error': 'Deployment name mismatch'}
        if len(report.events) == 0:
            return {'passed': False, 'error': 'No timeline events generated'}
        if not report.summary:
            return {'passed': False, 'error': 'No summary generated'}

        return {'passed': True, 'report': report}

    def _test_output_generation(self) -> Dict[str, Any]:
        parser = K8sOutputParser()

        events_path = os.path.join(self.test_dir, 'events_normal.json')
        pods_path = os.path.join(self.test_dir, 'pods.json')
        rs_path = os.path.join(self.test_dir, 'replicasets.json')
        dep_path = os.path.join(self.test_dir, 'deployment.json')

        events = parser.parse_events_json(open(events_path).read(), events_path)
        pods = parser.parse_pods_json(open(pods_path).read(), pods_path)
        replicasets = parser.parse_replicasets_json(open(rs_path).read(), rs_path)
        deployment = parser.parse_deployment_json(open(dep_path).read(), dep_path)

        analyzer = TimelineAnalyzer('web-app', 'default')
        report = analyzer.analyze(events, pods, replicasets, deployment)

        output_dir = os.path.join(self.test_dir, 'output')
        os.makedirs(output_dir, exist_ok=True)

        output_gen = OutputGenerator(report, output_dir)
        outputs = output_gen.generate_all('test_report')

        if not os.path.exists(outputs['json']):
            return {'passed': False, 'error': 'JSON output file not created'}
        if not os.path.exists(outputs['markdown']):
            return {'passed': False, 'error': 'Markdown output file not created'}
        if not outputs['console']:
            return {'passed': False, 'error': 'Console output not generated'}

        return {'passed': True, 'files': outputs}

    def run_all_tests(self) -> Dict[str, Any]:
        print("\n📝 生成测试样本数据...")
        files = self._save_sample_data()
        print(f"   已生成 {len(files)} 个测试数据文件")

        tests = [
            ('解析正常事件数据', lambda: self._test_parse_normal(files)),
            ('解析错误/警告事件数据', self._test_parse_with_errors),
            ('时间线分析器功能', self._test_analyzer),
            ('报告输出生成', self._test_output_generation),
        ]

        passed = 0
        failed = 0

        for test_name, test_func in tests:
            print(f"\n🔍 运行测试: {test_name}")
            try:
                result = test_func()
                self.results[test_name] = result
                if result['passed']:
                    passed += 1
                    print(f"   ✅ 通过")
                else:
                    failed += 1
                    print(f"   ❌ 失败: {result.get('error', 'Unknown')}")
            except Exception as e:
                failed += 1
                self.results[test_name] = {'passed': False, 'error': str(e)}
                print(f"   ❌ 异常: {e}")

        return {
            'passed': passed,
            'failed': failed,
            'tests': self.results
        }
