import re
from typing import Optional, Tuple, List
from .models import ImageInfo, EnvironmentStage


class TagParser:
    VERSION_PATTERNS = [
        r'v?(\d+\.\d+\.\d+)',
        r'v?(\d+\.\d+)',
    ]
    
    COMMIT_PATTERNS = [
        r'([0-9a-f]{7,40})',
    ]
    
    STAGE_PATTERNS = [
        r'(dev|development)',
        r'(test|testing)',
        r'(staging|stage|preprod)',
        r'(prod|production|release)',
    ]
    
    BUILD_TIME_PATTERNS = [
        r'(\d{8})',
        r'(\d{4}-\d{2}-\d{2})',
    ]

    @classmethod
    def parse_tag(cls, tag: str) -> dict:
        result = {
            'version': None,
            'commit': None,
            'stage': None,
            'build_time': None,
        }
        
        for pattern in cls.VERSION_PATTERNS:
            match = re.search(pattern, tag, re.IGNORECASE)
            if match:
                result['version'] = match.group(1)
                break
        
        for pattern in cls.COMMIT_PATTERNS:
            match = re.search(pattern, tag, re.IGNORECASE)
            if match:
                result['commit'] = match.group(1).lower()
                break
        
        for pattern in cls.STAGE_PATTERNS:
            match = re.search(pattern, tag, re.IGNORECASE)
            if match:
                stage_str = match.group(1).lower()
                if stage_str in ['dev', 'development']:
                    result['stage'] = EnvironmentStage.DEV.value
                elif stage_str in ['test', 'testing']:
                    result['stage'] = EnvironmentStage.TEST.value
                elif stage_str in ['staging', 'stage', 'preprod']:
                    result['stage'] = EnvironmentStage.STAGING.value
                elif stage_str in ['prod', 'production', 'release']:
                    result['stage'] = EnvironmentStage.PROD.value
                break
        
        for pattern in cls.BUILD_TIME_PATTERNS:
            match = re.search(pattern, tag)
            if match:
                result['build_time'] = match.group(1)
                break
        
        return result

    @classmethod
    def parse_image_line(cls, line: str, line_number: int = None) -> Tuple[Optional[ImageInfo], List[str]]:
        errors = []
        line = line.strip()
        
        if not line or line.startswith('#'):
            return None, errors
        
        parts = re.split(r'[\s,;]+', line)
        parts = [p for p in parts if p]
        
        if len(parts) < 1:
            errors.append(f"行 {line_number}: 无法解析镜像信息")
            return None, errors
        
        image_full = parts[0]
        
        if ':' in image_full:
            image_name, tag = image_full.split(':', 1)
        else:
            image_name = image_full
            tag = 'latest'
            errors.append(f"行 {line_number}: 镜像未指定标签，默认为 latest")
        
        commit_hash = None
        environment = None
        
        for part in parts[1:]:
            if re.match(r'^[0-9a-f]{7,40}$', part, re.IGNORECASE):
                commit_hash = part.lower()
            elif part.lower() in ['dev', 'test', 'staging', 'prod', 'production']:
                environment = part.lower()
        
        image_info = ImageInfo(
            image_name=image_name,
            tag=tag,
            commit_hash=commit_hash,
            environment=environment,
            line_number=line_number,
            raw_line=line,
        )
        
        parsed = cls.parse_tag(tag)
        image_info.parsed_version = parsed['version']
        image_info.parsed_commit = parsed['commit']
        image_info.parsed_stage = parsed['stage']
        image_info.parsed_build_time = parsed['build_time']
        
        return image_info, errors
