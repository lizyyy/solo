import json
import re
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from dateutil import parser as date_parser

from .models import Event, PodStatus, ReplicaSetInfo, DeploymentInfo, ImageInfo
from .exceptions import ParseError


class K8sOutputParser:
    def __init__(self):
        self.parse_errors: List[Dict[str, Any]] = []

    def _parse_timestamp(self, ts_str: str) -> Optional[datetime]:
        if not ts_str or ts_str == '<none>':
            return None
        try:
            return date_parser.parse(ts_str)
        except Exception:
            return None

    def _record_error(self, message: str, file_path: str = None,
                      line_number: int = None, raw_line: str = None):
        error = {
            'message': message,
            'file_path': file_path,
            'line_number': line_number,
            'raw_line': raw_line.strip() if raw_line else None
        }
        self.parse_errors.append(error)

    def parse_events_json(self, content: str, file_path: str = None) -> List[Event]:
        events = []
        try:
            data = json.loads(content)
        except json.JSONDecodeError as e:
            self._record_error(f"Failed to parse events JSON: {str(e)}", file_path, raw_line=content[:200])
            return events

        items = data.get('items', [data]) if isinstance(data, dict) else data

        for idx, item in enumerate(items):
            try:
                event = self._parse_single_event(item)
                if event:
                    events.append(event)
            except Exception as e:
                self._record_error(f"Failed to parse event item: {str(e)}",
                                   file_path, line_number=idx + 1,
                                   raw_line=json.dumps(item)[:200])
        return events

    def _parse_single_event(self, item: Dict[str, Any]) -> Optional[Event]:
        metadata = item.get('metadata', {})
        event_time = item.get('eventTime') or metadata.get('creationTimestamp')
        involved_object = item.get('involvedObject', {})
        source = item.get('source', {})

        return Event(
            timestamp=self._parse_timestamp(event_time) or datetime.min,
            type=item.get('type', 'Normal'),
            reason=item.get('reason', ''),
            message=item.get('message', ''),
            object_kind=involved_object.get('kind', ''),
            object_name=involved_object.get('name', ''),
            namespace=involved_object.get('namespace', ''),
            source_component=source.get('component', ''),
            count=item.get('count', 1),
            raw_source=item
        )

    def parse_pods_json(self, content: str, file_path: str = None) -> List[PodStatus]:
        pods = []
        try:
            data = json.loads(content)
        except json.JSONDecodeError as e:
            self._record_error(f"Failed to parse pods JSON: {str(e)}", file_path, raw_line=content[:200])
            return pods

        items = data.get('items', [data]) if isinstance(data, dict) else data

        for idx, item in enumerate(items):
            try:
                pod = self._parse_single_pod(item)
                if pod:
                    pods.append(pod)
            except Exception as e:
                self._record_error(f"Failed to parse pod item: {str(e)}",
                                   file_path, line_number=idx + 1,
                                   raw_line=json.dumps(item)[:200])
        return pods

    def _parse_single_pod(self, item: Dict[str, Any]) -> Optional[PodStatus]:
        metadata = item.get('metadata', {})
        spec = item.get('spec', {})
        status = item.get('status', {})

        container_statuses = status.get('containerStatuses', [])
        ready = all(cs.get('ready', False) for cs in container_statuses)
        containers_ready = len([cs for cs in container_statuses if cs.get('ready', False)])

        return PodStatus(
            name=metadata.get('name', ''),
            namespace=metadata.get('namespace', ''),
            phase=status.get('phase', ''),
            pod_ip=status.get('podIP', ''),
            host_ip=status.get('hostIP', ''),
            start_time=self._parse_timestamp(status.get('startTime')),
            containers_ready=containers_ready == len(container_statuses) if container_statuses else False,
            ready=ready,
            restarts=sum(cs.get('restartCount', 0) for cs in container_statuses),
            qos_class=status.get('qosClass', ''),
            labels=metadata.get('labels', {}),
            annotations=metadata.get('annotations', {}),
            container_statuses=container_statuses,
            raw_source=item
        )

    def parse_replicasets_json(self, content: str, file_path: str = None) -> List[ReplicaSetInfo]:
        replicasets = []
        try:
            data = json.loads(content)
        except json.JSONDecodeError as e:
            self._record_error(f"Failed to parse replicasets JSON: {str(e)}", file_path, raw_line=content[:200])
            return replicasets

        items = data.get('items', [data]) if isinstance(data, dict) else data

        for idx, item in enumerate(items):
            try:
                rs = self._parse_single_replicaset(item)
                if rs:
                    replicasets.append(rs)
            except Exception as e:
                self._record_error(f"Failed to parse replicaset item: {str(e)}",
                                   file_path, line_number=idx + 1,
                                   raw_line=json.dumps(item)[:200])
        return replicasets

    def _parse_single_replicaset(self, item: Dict[str, Any]) -> Optional[ReplicaSetInfo]:
        metadata = item.get('metadata', {})
        spec = item.get('spec', {})
        status = item.get('status', {})

        labels = metadata.get('labels', {})
        selector = spec.get('selector', {}).get('matchLabels', {}) if spec.get('selector') else {}

        return ReplicaSetInfo(
            name=metadata.get('name', ''),
            namespace=metadata.get('namespace', ''),
            replicas=status.get('replicas', 0),
            ready_replicas=status.get('readyReplicas', 0),
            available_replicas=status.get('availableReplicas', 0),
            generation=metadata.get('generation', 0),
            creation_timestamp=self._parse_timestamp(metadata.get('creationTimestamp')),
            labels=labels,
            selector=selector,
            pod_template_hash=labels.get('pod-template-hash', ''),
            raw_source=item
        )

    def parse_deployment_json(self, content: str, file_path: str = None) -> Optional[DeploymentInfo]:
        try:
            data = json.loads(content)
        except json.JSONDecodeError as e:
            self._record_error(f"Failed to parse deployment JSON: {str(e)}", file_path, raw_line=content[:200])
            return None

        item = data.get('items', [data])[0] if isinstance(data, dict) and 'items' in data else data

        try:
            return self._parse_single_deployment(item)
        except Exception as e:
            self._record_error(f"Failed to parse deployment: {str(e)}",
                               file_path, raw_line=json.dumps(item)[:200])
            return None

    def _parse_single_deployment(self, item: Dict[str, Any]) -> DeploymentInfo:
        metadata = item.get('metadata', {})
        spec = item.get('spec', {})
        status = item.get('status', {})

        strategy = spec.get('strategy', {}).get('type', 'RollingUpdate')
        selector = spec.get('selector', {}).get('matchLabels', {}) if spec.get('selector') else {}

        return DeploymentInfo(
            name=metadata.get('name', ''),
            namespace=metadata.get('namespace', ''),
            replicas=status.get('replicas', 0),
            updated_replicas=status.get('updatedReplicas', 0),
            ready_replicas=status.get('readyReplicas', 0),
            available_replicas=status.get('availableReplicas', 0),
            unavailable_replicas=status.get('unavailableReplicas', 0),
            generation=metadata.get('generation', 0),
            observed_generation=status.get('observedGeneration', 0),
            creation_timestamp=self._parse_timestamp(metadata.get('creationTimestamp')),
            strategy=strategy,
            labels=metadata.get('labels', {}),
            selector=selector,
            current_replicaset=None,
            old_replicasets=[],
            raw_source=item
        )

    def parse_custom_columns(self, content: str, file_path: str = None) -> List[Dict[str, str]]:
        lines = content.strip().split('\n')
        if len(lines) < 2:
            self._record_error("Custom columns output has no data rows", file_path)
            return []

        headers = re.split(r'\s{2,}', lines[0].strip())
        results = []

        for line_num, line in enumerate(lines[1:], start=2):
            if not line.strip():
                continue
            try:
                values = re.split(r'\s{2,}', line.strip())
                if len(values) != len(headers):
                    self._record_error(f"Column count mismatch: expected {len(headers)}, got {len(values)}",
                                       file_path, line_number=line_num, raw_line=line)
                    continue
                row = dict(zip(headers, values))
                results.append(row)
            except Exception as e:
                self._record_error(f"Failed to parse custom column line: {str(e)}",
                                   file_path, line_number=line_num, raw_line=line)

        return results

    def extract_image_info(self, pod: PodStatus) -> List[ImageInfo]:
        images = []
        spec = pod.raw_source.get('spec', {})
        containers = spec.get('containers', [])

        for container in containers:
            image_ref = container.get('image', '')
            name_part, tag_part = self._parse_image_ref(image_ref)
            images.append(ImageInfo(
                name=name_part,
                tag=tag_part,
                full_reference=image_ref,
                container_name=container.get('name', '')
            ))
        return images

    def _parse_image_ref(self, image_ref: str) -> Tuple[str, str]:
        if not image_ref:
            return ('', '')

        if ':' in image_ref and '@' not in image_ref.split(':')[-1]:
            parts = image_ref.rsplit(':', 1)
            return (parts[0], parts[1])
        elif '@' in image_ref:
            parts = image_ref.split('@', 1)
            return (parts[0], parts[1])
        else:
            return (image_ref, 'latest')
