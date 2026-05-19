import re
from datetime import datetime
from typing import List, Dict, Any
from dataclasses import dataclass


@dataclass
class ParsedEvent:
    event_time: datetime
    type: str
    reason: str
    message: str
    involved_object_kind: str
    involved_object_name: str
    source_component: str
    count: int = 1


@dataclass
class ParsedPod:
    pod_name: str
    namespace: str
    ready: str
    status: str
    restarts: int
    age: str
    ip: str = ""
    node: str = ""
    nominated_node: str = ""
    readness_gates: str = ""


@dataclass
class ParsedContainer:
    name: str
    ready: bool
    state: str
    image: str
    restart_count: int
    reason: str = ""
    message: str = ""


@dataclass
class ParsedDeployment:
    name: str
    namespace: str
    ready: str
    up_to_date: int
    available: int
    age: str
    containers: str
    images: str


class KubectlOutputParser:
    @staticmethod
    def parse_events(output: str) -> List[ParsedEvent]:
        events = []
        lines = output.strip().split('\n')
        header_found = False

        for line in lines:
            line = line.strip()
            if not line:
                continue
            if line.startswith('LAST'):
                header_found = True
                continue
            if not header_found:
                continue

            parts = re.split(r'\s+', line, maxsplit=5)
            if len(parts) >= 5:
                try:
                    last_seen = parts[0]
                    event_type = parts[1]
                    reason = parts[2]
                    object_str = parts[3]
                    message = parts[4] if len(parts) > 4 else ""

                    kind = "Pod"
                    obj_name = object_str
                    if '/' in object_str:
                        kind_parts = object_str.split('/', 1)
                        kind = kind_parts[0]
                        obj_name = kind_parts[1]

                    source = "unknown"

                    event_time = KubectlOutputParser._parse_time(last_seen)
                    count_match = re.search(r'x(\d+)', last_seen)
                    count = int(count_match.group(1)) if count_match else 1

                    events.append(ParsedEvent(
                        event_time=event_time,
                        type=event_type,
                        reason=reason,
                        message=message,
                        involved_object_kind=kind,
                        involved_object_name=obj_name,
                        source_component=source,
                        count=count
                    ))
                except Exception as e:
                    print(f"Error parsing event line: {line}, error: {e}")

        return events

    @staticmethod
    def parse_pods(output: str) -> List[ParsedPod]:
        pods = []
        lines = output.strip().split('\n')
        header_found = False

        for line in lines:
            line = line.strip()
            if not line or line.startswith('NAME'):
                header_found = True
                continue
            if not header_found:
                continue

            parts = re.split(r'\s{2,}', line)
            if len(parts) >= 5:
                try:
                    name = parts[0]
                    ready = parts[1]
                    status = parts[2]
                    restarts = int(parts[3])
                    age = parts[4]
                    ip = parts[5] if len(parts) > 5 else ""
                    node = parts[6] if len(parts) > 6 else ""
                    nominated_node = parts[7] if len(parts) > 7 else ""
                    readness_gates = parts[8] if len(parts) > 8 else ""

                    pods.append(ParsedPod(
                        pod_name=name,
                        namespace="",
                        ready=ready,
                        status=status,
                        restarts=restarts,
                        age=age,
                        ip=ip,
                        node=node,
                        nominated_node=nominated_node,
                        readness_gates=readness_gates
                    ))
                except Exception as e:
                    print(f"Error parsing pod line: {line}, error: {e}")

        return pods

    @staticmethod
    def parse_pod_description(output: str) -> Dict[str, Any]:
        result = {
            "name": "",
            "namespace": "",
            "containers": [],
            "events": []
        }

        lines = output.strip().split('\n')
        current_section = None
        container_info = {}
        event_lines = []

        for line in lines:
            line = line.rstrip()

            if line.startswith('Name:'):
                result["name"] = line.split(':', 1)[1].strip()
            elif line.startswith('Namespace:'):
                result["namespace"] = line.split(':', 1)[1].strip()
            elif line.startswith('Containers:'):
                current_section = 'containers'
            elif line.startswith('Events:'):
                current_section = 'events'
            elif current_section == 'containers' and line.strip().startswith('Container ID:'):
                if container_info:
                    result["containers"].append(container_info)
                container_info = {"name": line.strip().split()[0] if line.strip().split()[0] != 'Container' else ''}
            elif current_section == 'containers' and ':' in line and line.strip() and not line.startswith(' '):
                key, value = line.strip().split(':', 1)
                container_info[key.strip().lower().replace(' ', '_')] = value.strip()

        if container_info:
            result["containers"].append(container_info)

        return result

    @staticmethod
    def parse_deployments(output: str) -> List[ParsedDeployment]:
        deployments = []
        lines = output.strip().split('\n')
        header_found = False

        for line in lines:
            line = line.strip()
            if not line or line.startswith('NAME'):
                header_found = True
                continue
            if not header_found:
                continue

            parts = re.split(r'\s{2,}', line)
            if len(parts) >= 5:
                try:
                    name = parts[0]
                    ready = parts[1]
                    up_to_date = int(parts[2])
                    available = int(parts[3])
                    age = parts[4]
                    containers = parts[5] if len(parts) > 5 else ""
                    images = parts[6] if len(parts) > 6 else ""

                    deployments.append(ParsedDeployment(
                        name=name,
                        namespace="",
                        ready=ready,
                        up_to_date=up_to_date,
                        available=available,
                        age=age,
                        containers=containers,
                        images=images
                    ))
                except Exception as e:
                    print(f"Error parsing deployment line: {line}, error: {e}")

        return deployments

    @staticmethod
    def parse_rs(output: str) -> List[Dict[str, Any]]:
        replicasets = []
        lines = output.strip().split('\n')
        header_found = False

        for line in lines:
            line = line.strip()
            if not line or line.startswith('NAME'):
                header_found = True
                continue
            if not header_found:
                continue

            parts = re.split(r'\s{2,}', line)
            if len(parts) >= 4:
                try:
                    name = parts[0]
                    desired = int(parts[1]) if parts[1].isdigit() else 0
                    current = int(parts[2]) if parts[2].isdigit() else 0
                    ready = int(parts[3]) if parts[3].isdigit() else 0
                    age = parts[4] if len(parts) > 4 else ""

                    replicasets.append({
                        "name": name,
                        "desired": desired,
                        "current": current,
                        "ready": ready,
                        "age": age
                    })
                except Exception as e:
                    print(f"Error parsing RS line: {line}, error: {e}")

        return replicasets

    @staticmethod
    def _parse_time(time_str: str) -> datetime:
        time_str = time_str.split('x')[0].strip()

        if 's' in time_str or 'm' in time_str or 'h' in time_str or 'd' in time_str:
            from datetime import timedelta
            total_seconds = 0

            matches = re.findall(r'(\d+)([smhd])', time_str)
            for value, unit in matches:
                value = int(value)
                if unit == 's':
                    total_seconds += value
                elif unit == 'm':
                    total_seconds += value * 60
                elif unit == 'h':
                    total_seconds += value * 3600
                elif unit == 'd':
                    total_seconds += value * 86400

            return datetime.utcnow() - timedelta(seconds=total_seconds)

        try:
            return datetime.strptime(time_str, '%Y-%m-%dT%H:%M:%SZ')
        except ValueError:
            pass

        try:
            return datetime.strptime(time_str, '%Y-%m-%d %H:%M:%S')
        except ValueError:
            pass

        return datetime.utcnow()

    @staticmethod
    def extract_image_name(image_str: str) -> str:
        if ':' in image_str and not image_str.endswith(':'):
            return image_str.split(':')[-1]
        return image_str

    @staticmethod
    def compare_images(image1: str, image2: str) -> Dict[str, Any]:
        img1_name = KubectlOutputParser.extract_image_name(image1)
        img2_name = KubectlOutputParser.extract_image_name(image2)

        return {
            "are_equal": img1_name == img2_name,
            "old_version": img1_name,
            "new_version": img2_name,
            "changed": img1_name != img2_name
        }
