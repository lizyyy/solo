from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple
from collections import defaultdict

from .models import Event, PodStatus, ReplicaSetInfo, DeploymentInfo, TimelineEvent, TimelineReport


class TimelineAnalyzer:
    def __init__(self, deployment_name: str, namespace: str):
        self.deployment_name = deployment_name
        self.namespace = namespace

    def analyze(self, events: List[Event], pods: List[PodStatus],
                replicasets: List[ReplicaSetInfo],
                deployment: Optional[DeploymentInfo] = None) -> TimelineReport:
        timeline_events = []

        deployment_events = self._filter_deployment_related(events, pods, replicasets)
        timeline_events.extend(self._convert_events_to_timeline(deployment_events))
        timeline_events.extend(self._extract_pod_timeline(pods))
        timeline_events.extend(self._extract_rs_timeline(replicasets))

        timeline_events.sort(key=lambda x: x.timestamp if x.timestamp else datetime.min)

        start_time, end_time = self._calculate_time_range(timeline_events)

        image_changes = self._analyze_image_changes(pods, timeline_events)
        status_changes = self._analyze_status_attribution(timeline_events)

        summary = self._generate_summary(timeline_events, pods, replicasets, deployment)

        report = TimelineReport(
            namespace=self.namespace,
            deployment_name=self.deployment_name,
            start_time=start_time,
            end_time=end_time,
            events=timeline_events,
            pods=pods,
            replicasets=replicasets,
            deployment=deployment,
            image_changes=image_changes,
            summary=summary
        )

        return report

    def _filter_deployment_related(self, events: List[Event], pods: List[PodStatus],
                                   replicasets: List[ReplicaSetInfo]) -> List[Event]:
        related_names = set()
        related_names.add(self.deployment_name)

        for rs in replicasets:
            related_names.add(rs.name)

        for pod in pods:
            related_names.add(pod.name)

        filtered = []
        for event in events:
            if (event.namespace == self.namespace and
                (event.object_name in related_names or
                 self.deployment_name in event.object_name)):
                filtered.append(event)

        return filtered

    def _convert_events_to_timeline(self, events: List[Event]) -> List[TimelineEvent]:
        timeline_events = []
        for event in events:
            severity = 'error' if event.type == 'Warning' else 'info'
            event_type = self._classify_event_type(event)

            timeline_events.append(TimelineEvent(
                timestamp=event.timestamp,
                event_type=event_type,
                severity=severity,
                title=f"{event.reason}",
                description=event.message,
                object_ref=f"{event.object_kind}/{event.object_name}",
                attributes={
                    'source': event.source_component,
                    'count': event.count,
                    'raw_type': event.type
                }
            ))
        return timeline_events

    def _classify_event_type(self, event: Event) -> str:
        reason_lower = event.reason.lower()

        if 'pull' in reason_lower:
            return 'image_pull'
        elif 'start' in reason_lower or 'created' in reason_lower:
            return 'lifecycle'
        elif 'fail' in reason_lower or 'error' in reason_lower:
            return 'error'
        elif 'kill' in reason_lower or 'stop' in reason_lower:
            return 'termination'
        elif 'scale' in reason_lower:
            return 'scaling'
        elif 'probe' in reason_lower:
            return 'health_check'
        elif 'scheduled' in reason_lower:
            return 'scheduling'
        else:
            return 'general'

    def _extract_pod_timeline(self, pods: List[PodStatus]) -> List[TimelineEvent]:
        events = []
        for pod in pods:
            if pod.start_time:
                events.append(TimelineEvent(
                    timestamp=pod.start_time,
                    event_type='pod_start',
                    severity='info',
                    title=f"Pod {pod.name} started",
                    description=f"Phase: {pod.phase}, IP: {pod.pod_ip}, Restarts: {pod.restarts}",
                    object_ref=f"Pod/{pod.name}",
                    attributes={
                        'phase': pod.phase,
                        'restarts': pod.restarts,
                        'ready': pod.ready
                    }
                ))
        return events

    def _extract_rs_timeline(self, replicasets: List[ReplicaSetInfo]) -> List[TimelineEvent]:
        events = []
        for rs in replicasets:
            if rs.creation_timestamp:
                events.append(TimelineEvent(
                    timestamp=rs.creation_timestamp,
                    event_type='replicaset_create',
                    severity='info',
                    title=f"ReplicaSet {rs.name} created",
                    description=f"Replicas: {rs.replicas}, Ready: {rs.ready_replicas}",
                    object_ref=f"ReplicaSet/{rs.name}",
                    attributes={
                        'replicas': rs.replicas,
                        'ready_replicas': rs.ready_replicas,
                        'pod_template_hash': rs.pod_template_hash
                    }
                ))
        return events

    def _calculate_time_range(self, events: List[TimelineEvent]) -> Tuple[Optional[datetime], Optional[datetime]]:
        valid_times = [e.timestamp for e in events if e.timestamp and e.timestamp != datetime.min]
        if not valid_times:
            return (None, None)
        return (min(valid_times), max(valid_times))

    def _analyze_image_changes(self, pods: List[PodStatus],
                                events: List[TimelineEvent]) -> List[Dict[str, Any]]:
        image_groups = defaultdict(list)

        for pod in pods:
            spec = pod.raw_source.get('spec', {})
            containers = spec.get('containers', [])
            for container in containers:
                image = container.get('image', '')
                if image:
                    image_groups[container.get('name', 'unknown')].append({
                        'pod': pod.name,
                        'image': image,
                        'timestamp': pod.start_time
                    })

        changes = []
        for container_name, images in image_groups.items():
            if len(images) > 1:
                images_sorted = sorted(images, key=lambda x: x['timestamp'] or datetime.min)
                unique_images = []
                prev_image = None
                for img in images_sorted:
                    if img['image'] != prev_image:
                        unique_images.append(img)
                        prev_image = img['image']

                if len(unique_images) > 1:
                    for i in range(1, len(unique_images)):
                        changes.append({
                            'container': container_name,
                            'from': unique_images[i-1]['image'],
                            'to': unique_images[i]['image'],
                            'timestamp': unique_images[i]['timestamp'],
                            'pod': unique_images[i]['pod']
                        })

        return changes

    def _analyze_status_attribution(self, events: List[TimelineEvent]) -> List[Dict[str, Any]]:
        attribution = []

        error_events = [e for e in events if e.severity == 'error']

        for error in error_events:
            related_events = self._find_related_events(error, events)
            attribution.append({
                'error_event': error,
                'related_events': related_events,
                'possible_cause': self._infer_cause(error, related_events)
            })

        return attribution

    def _find_related_events(self, target_event: TimelineEvent,
                              all_events: List[TimelineEvent],
                              window_minutes: int = 5) -> List[TimelineEvent]:
        if not target_event.timestamp:
            return []

        window_start = target_event.timestamp - timedelta(minutes=window_minutes)
        window_end = target_event.timestamp + timedelta(minutes=window_minutes)

        related = []
        for event in all_events:
            if (event.timestamp and
                window_start <= event.timestamp <= window_end and
                event != target_event):
                related.append(event)

        return related

    def _infer_cause(self, error_event: TimelineEvent,
                     related_events: List[TimelineEvent]) -> str:
        desc_lower = error_event.description.lower()

        if 'image' in desc_lower and 'pull' in desc_lower:
            if 'not found' in desc_lower:
                return "Image not found in registry"
            elif 'auth' in desc_lower or 'credentials' in desc_lower:
                return "Image pull authentication failure"
            else:
                return "Image pull failure"

        if 'back-off' in desc_lower:
            return "CrashLoopBackOff - container failing repeatedly"

        if 'liveness' in desc_lower:
            return "Liveness probe failure"

        if 'readiness' in desc_lower:
            return "Readiness probe failure"

        if 'out of memory' in desc_lower or 'OOM' in error_event.description:
            return "Out of memory kill"

        for related in related_events:
            if 'image' in related.event_type:
                return f"Possibly related to image pull issues"
            if 'probe' in related.event_type:
                return f"Possibly related to health check failures"

        return "Unknown - see related events for context"

    def _generate_summary(self, events: List[PodStatus], pods: List[PodStatus],
                          replicasets: List[ReplicaSetInfo],
                          deployment: Optional[DeploymentInfo]) -> Dict[str, Any]:
        summary = {
            'total_events': len(events),
            'error_events': len([e for e in events if isinstance(e, TimelineEvent) and e.severity == 'error']),
            'warning_events': len([e for e in events if isinstance(e, TimelineEvent) and e.severity == 'warning']),
            'info_events': len([e for e in events if isinstance(e, TimelineEvent) and e.severity == 'info']),
            'pods_count': len(pods),
            'pods_ready': len([p for p in pods if p.ready]),
            'total_restarts': sum(p.restarts for p in pods),
            'replicasets_count': len(replicasets),
        }

        if deployment:
            summary['deployment'] = {
                'replicas': deployment.replicas,
                'updated_replicas': deployment.updated_replicas,
                'ready_replicas': deployment.ready_replicas,
                'available_replicas': deployment.available_replicas,
                'strategy': deployment.strategy
            }

        return summary
