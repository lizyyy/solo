from datetime import datetime
from typing import List, Dict, Any, Tuple
from dataclasses import dataclass
from enum import Enum


class FailureReason(Enum):
    IMAGE_PULL_BACKOFF = "ImagePullBackOff"
    CRASH_LOOP_BACK_OFF = "CrashLoopBackOff"
    READINESS_PROBE_FAILED = "ReadinessProbeFailed"
    LIVENESS_PROBE_FAILED = "LivenessProbeFailed"
    INSUFFICIENT_RESOURCES = "InsufficientResources"
    SCHEDULING_FAILED = "FailedScheduling"
    CONFIG_ERROR = "ConfigError"
    RBAC_ERROR = "RBACError"
    NETWORK_ERROR = "NetworkError"
    UNKNOWN = "Unknown"


class ConfidenceLevel(Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


@dataclass
class TimelineEvent:
    timestamp: datetime
    event_type: str
    reason: str
    message: str
    object_type: str
    object_name: str
    severity: str


@dataclass
class AnalysisResult:
    root_cause: str
    confidence: str
    suggested_actions: List[str]
    failure_reason: FailureReason
    key_events: List[TimelineEvent]


class TimelineAnalyzer:
    def __init__(self):
        self.failure_patterns = {
            FailureReason.IMAGE_PULL_BACKOFF: {
                "keywords": ["ImagePullBackOff", "ErrImagePull", "image pull failed", "repository not found", "401 Unauthorized", "403 Forbidden"],
                "suggestions": [
                    "检查镜像名称和标签是否正确",
                    "验证镜像仓库访问凭证（ImagePullSecret）",
                    "确认网络可以访问镜像仓库",
                    "检查镜像是否存在于仓库中"
                ]
            },
            FailureReason.CRASH_LOOP_BACK_OFF: {
                "keywords": ["CrashLoopBackOff", "back-off restarting failed", "container exited", "exit code"],
                "suggestions": [
                    "查看容器日志: kubectl logs <pod-name>",
                    "检查应用启动命令是否正确",
                    "验证配置文件和环境变量",
                    "检查依赖服务是否可用"
                ]
            },
            FailureReason.READINESS_PROBE_FAILED: {
                "keywords": ["Readiness probe failed", "readiness-probe", "unhealthy"],
                "suggestions": [
                    "检查就绪探针配置",
                    "验证应用启动超时设置",
                    "查看应用健康检查端点",
                    "检查依赖服务连接"
                ]
            },
            FailureReason.LIVENESS_PROBE_FAILED: {
                "keywords": ["Liveness probe failed", "liveness-probe"],
                "suggestions": [
                    "检查存活探针配置",
                    "验证应用运行状态",
                    "查看应用内存和CPU使用情况",
                    "检查应用是否发生死锁"
                ]
            },
            FailureReason.INSUFFICIENT_RESOURCES: {
                "keywords": ["Insufficient cpu", "Insufficient memory", "out of memory", "OOMKilled", "resources"],
                "suggestions": [
                    "增加Pod的CPU和内存资源限制",
                    "检查节点资源利用率",
                    "优化应用内存使用",
                    "考虑扩容节点"
                ]
            },
            FailureReason.SCHEDULING_FAILED: {
                "keywords": ["FailedScheduling", "0/ nodes available", "taint", "node affinity", "volume binding"],
                "suggestions": [
                    "检查节点亲和性和反亲和性配置",
                    "验证Pod是否能容忍节点污点",
                    "检查持久卷绑定状态",
                    "确认有足够的可用节点"
                ]
            },
            FailureReason.CONFIG_ERROR: {
                "keywords": ["ConfigMap", "Secret", "config error", "invalid", "not found", "mount failed"],
                "suggestions": [
                    "检查ConfigMap和Secret是否存在",
                    "验证配置内容格式",
                    "检查挂载路径配置",
                    "确认配置键名正确"
                ]
            },
            FailureReason.RBAC_ERROR: {
                "keywords": ["permission denied", "forbidden", "RBAC", "cannot", "serviceaccount"],
                "suggestions": [
                    "检查ServiceAccount权限配置",
                    "验证Role和RoleBinding设置",
                    "确认API访问权限足够"
                ]
            },
            FailureReason.NETWORK_ERROR: {
                "keywords": ["connection refused", "timeout", "network", "DNS", "resolve"],
                "suggestions": [
                    "检查网络策略配置",
                    "验证DNS解析正常",
                    "检查服务端点配置",
                    "确认防火墙规则"
                ]
            }
        }

    def sort_events_by_time(self, events: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        return sorted(events, key=lambda x: x.get('event_time', datetime.utcnow()))

    def filter_warning_events(self, events: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        return [e for e in events if e.get('type') in ['Warning', 'Error']]

    def group_events_by_object(self, events: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
        grouped = {}
        for event in events:
            obj_name = event.get('involved_object_name', 'unknown')
            if obj_name not in grouped:
                grouped[obj_name] = []
            grouped[obj_name].append(event)
        return grouped

    def analyze_failure_reason(self, events: List[Dict[str, Any]], pods: List[Dict[str, Any]]) -> AnalysisResult:
        all_messages = []
        for event in events:
            all_messages.append(event.get('message', ''))
            all_messages.append(event.get('reason', ''))

        for pod in pods:
            all_messages.append(pod.get('status', ''))
            all_messages.append(pod.get('phase', ''))

        combined_text = ' '.join(all_messages)

        best_match = None
        best_score = 0
        matched_keywords = []

        for reason, pattern in self.failure_patterns.items():
            score = 0
            matched = []
            for keyword in pattern["keywords"]:
                if keyword.lower() in combined_text.lower():
                    score += 1
                    matched.append(keyword)

            if score > best_score:
                best_score = score
                best_match = reason
                matched_keywords = matched

        key_events = self._extract_key_events(events, pods)

        if best_match and best_score >= 1:
            confidence = ConfidenceLevel.HIGH.value if best_score >= 3 else (
                ConfidenceLevel.MEDIUM.value if best_score >= 2 else ConfidenceLevel.LOW.value
            )

            return AnalysisResult(
                root_cause=best_match.value,
                confidence=confidence,
                suggested_actions=self.failure_patterns[best_match]["suggestions"],
                failure_reason=best_match,
                key_events=key_events
            )

        pod_statuses = [p.get('status', '') for p in pods]
        if any('Pending' in s for s in pod_statuses):
            return AnalysisResult(
                root_cause="Pod调度超时或卡在Pending状态",
                confidence=ConfidenceLevel.LOW.value,
                suggested_actions=[
                    "检查事件详情了解调度情况",
                    "查看节点资源使用情况",
                    "检查Pod调度约束配置"
                ],
                failure_reason=FailureReason.SCHEDULING_FAILED,
                key_events=key_events
            )

        return AnalysisResult(
            root_cause=FailureReason.UNKNOWN.value,
            confidence=ConfidenceLevel.LOW.value,
            suggested_actions=[
                "手动检查Pod日志: kubectl logs <pod-name>",
                "详细查看事件: kubectl describe pod <pod-name>",
                "检查Deployment配置: kubectl describe deployment <name>"
            ],
            failure_reason=FailureReason.UNKNOWN,
            key_events=key_events
        )

    def _extract_key_events(self, events: List[Dict[str, Any]], pods: List[Dict[str, Any]]) -> List[TimelineEvent]:
        key_events = []
        warning_events = self.filter_warning_events(events)
        sorted_events = self.sort_events_by_time(warning_events)

        for event in sorted_events[:10]:
            key_events.append(TimelineEvent(
                timestamp=event.get('event_time', datetime.utcnow()),
                event_type=event.get('type', 'Unknown'),
                reason=event.get('reason', ''),
                message=event.get('message', ''),
                object_type=event.get('involved_object_kind', ''),
                object_name=event.get('involved_object_name', ''),
                severity=event.get('type', 'Normal')
            ))

        for pod in pods[:5]:
            if pod.get('status') not in ['Running', 'Succeeded']:
                key_events.append(TimelineEvent(
                    timestamp=datetime.utcnow(),
                    event_type='PodStatus',
                    reason=pod.get('status', 'Unknown'),
                    message=f"Pod {pod.get('pod_name', '')} 状态异常",
                    object_type='Pod',
                    object_name=pod.get('pod_name', ''),
                    severity='Warning'
                ))

        return key_events

    def build_timeline(self, events: List[Dict[str, Any]], pods: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        timeline_items = []
        default_time = datetime.utcnow()

        all_events = []
        for event in events:
            event_time = event.get('event_time') or default_time
            all_events.append({
                'time': event_time,
                'type': 'event',
                'data': event
            })

        for pod in pods:
            pod_time = pod.get('start_time') or default_time
            all_events.append({
                'time': pod_time,
                'type': 'pod',
                'data': pod
            })

        sorted_items = sorted(all_events, key=lambda x: x['time'])

        return sorted_items


class ImageComparator:
    @staticmethod
    def extract_tag(image: str) -> str:
        if not image:
            return ""

        if '@' in image:
            image = image.split('@')[0]

        if ':' in image and not image.endswith(':'):
            parts = image.split(':')
            if len(parts) > 1 and '/' not in parts[-1]:
                return parts[-1]
        return "latest"

    @staticmethod
    def extract_repository(image: str) -> str:
        if not image:
            return ""

        if '@' in image:
            image = image.split('@')[0]

        if ':' in image:
            parts = image.split(':')
            if len(parts) > 1 and '/' not in parts[-1]:
                return ':'.join(parts[:-1])
        return image

    @staticmethod
    def compare(old_image: str, new_image: str) -> Dict[str, Any]:
        old_tag = ImageComparator.extract_tag(old_image)
        new_tag = ImageComparator.extract_tag(new_image)
        old_repo = ImageComparator.extract_repository(old_image)
        new_repo = ImageComparator.extract_repository(new_image)

        return {
            "old_image": old_image,
            "new_image": new_image,
            "old_tag": old_tag,
            "new_tag": new_tag,
            "old_repository": old_repo,
            "new_repository": new_repo,
            "tag_changed": old_tag != new_tag,
            "repository_changed": old_repo != new_repo,
            "image_changed": old_image != new_image,
            "is_upgrade": ImageComparator._is_version_upgrade(old_tag, new_tag)
        }

    @staticmethod
    def _is_version_upgrade(old_tag: str, new_tag: str) -> bool:
        import re

        old_parts = re.findall(r'v?(\d+)\.?(\d+)?\.?(\d+)?', old_tag)
        new_parts = re.findall(r'v?(\d+)\.?(\d+)?\.?(\d+)?', new_tag)

        if old_parts and new_parts:
            old_ver = tuple(int(x) if x else 0 for x in old_parts[0])
            new_ver = tuple(int(x) if x else 0 for x in new_parts[0])
            return new_ver > old_ver

        return False

    @staticmethod
    def check_pod_images(pods: List[Dict[str, Any]], expected_image: str) -> Dict[str, Any]:
        matching = []
        not_matching = []

        for pod in pods:
            pod_image = pod.get('image', '')
            if pod_image == expected_image:
                matching.append(pod)
            else:
                not_matching.append({
                    "pod": pod,
                    "actual_image": pod_image,
                    "expected_image": expected_image,
                    "difference": ImageComparator.compare(pod_image, expected_image)
                })

        return {
            "all_match": len(not_matching) == 0,
            "matching_count": len(matching),
            "not_matching_count": len(not_matching),
            "matching_pods": matching,
            "not_matching_pods": not_matching
        }
