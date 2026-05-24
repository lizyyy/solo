import json
import os
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional

from .utils import format_size, parse_size, stable_hash


@dataclass
class FileEntry:
    path: str
    size: int = 0
    is_directory: bool = False
    is_added: bool = True


@dataclass
class ImageLayer:
    index: int
    digest: str
    size: int = 0
    created_by: str = ""
    files: List[FileEntry] = field(default_factory=list)
    is_base_image: bool = False
    is_cached: bool = False

    @property
    def command_summary(self) -> str:
        if not self.created_by:
            return "unknown"
        cmd = self.created_by.strip()
        if len(cmd) > 80:
            return cmd[:77] + "..."
        return cmd

    def to_dict(self) -> dict:
        return {
            "index": self.index,
            "digest": self.digest,
            "size": self.size,
            "size_formatted": format_size(self.size),
            "created_by": self.created_by,
            "command_summary": self.command_summary,
            "files_count": len(self.files),
            "is_base_image": self.is_base_image,
            "is_cached": self.is_cached,
        }


@dataclass
class ImageMetadata:
    image_name: str = ""
    image_tag: str = ""
    total_size: int = 0
    layers: List[ImageLayer] = field(default_factory=list)
    base_image: str = ""
    commit_info: Dict[str, Any] = field(default_factory=dict)

    @property
    def layers_count(self) -> int:
        return len(self.layers)

    def to_dict(self) -> dict:
        return {
            "image_name": self.image_name,
            "image_tag": self.image_tag,
            "total_size": self.total_size,
            "total_size_formatted": format_size(self.total_size),
            "layers_count": self.layers_count,
            "layers": [layer.to_dict() for layer in self.layers],
            "base_image": self.base_image,
            "commit_info": self.commit_info,
        }


class LayerParser:
    def __init__(self):
        pass

    def parse_from_docker(self, image_name: str) -> ImageMetadata:
        try:
            import docker

            client = docker.from_env()
            image = client.images.get(image_name)
            return self._parse_docker_image(image, image_name)
        except ImportError:
            raise RuntimeError("Docker SDK 未安装，请安装: pip install docker")
        except Exception as e:
            raise RuntimeError(f"无法连接 Docker 或获取镜像: {e}")

    def _parse_docker_image(self, image, image_name: str) -> ImageMetadata:
        metadata = ImageMetadata()
        metadata.image_name = image_name.split(":")[0]
        if ":" in image_name:
            metadata.image_tag = image_name.split(":")[1]

        image_attrs = image.attrs
        metadata.total_size = image_attrs.get("Size", 0)

        history = image_attrs.get("History", [])
        rootfs = image_attrs.get("RootFS", {})
        layers_data = rootfs.get("Layers", [])

        base_image_detected = True
        for i, (layer_digest, hist_entry) in enumerate(zip(layers_data, history)):
            layer = ImageLayer(
                index=i,
                digest=layer_digest,
                size=hist_entry.get("Size", 0),
                created_by=hist_entry.get("CreatedBy", ""),
                is_base_image=base_image_detected,
            )
            if "ENTRYPOINT" in layer.created_by or "CMD" in layer.created_by:
                base_image_detected = False
            if hist_entry.get("Size", 0) == 0 and not layer.created_by:
                layer.is_cached = True
            metadata.layers.append(layer)

        return metadata

    def parse_from_json(self, json_path: str) -> ImageMetadata:
        with open(json_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return self._parse_from_dict(data)

    def parse_from_layer_list(self, layer_list_path: str) -> ImageMetadata:
        metadata = ImageMetadata()
        with open(layer_list_path, "r", encoding="utf-8") as f:
            for i, line in enumerate(f):
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                parts = line.split()
                if len(parts) >= 2:
                    size_str = parts[0]
                    digest = parts[1]
                    created_by = " ".join(parts[2:]) if len(parts) > 2 else ""
                    layer = ImageLayer(
                        index=i,
                        digest=digest,
                        size=parse_size(size_str),
                        created_by=created_by,
                    )
                    metadata.layers.append(layer)

        metadata.total_size = sum(layer.size for layer in metadata.layers)
        return metadata

    def _parse_from_dict(self, data: dict) -> ImageMetadata:
        metadata = ImageMetadata()
        metadata.image_name = data.get("image_name", "")
        metadata.image_tag = data.get("image_tag", "")
        metadata.total_size = data.get("total_size", 0)
        metadata.base_image = data.get("base_image", "")
        metadata.commit_info = data.get("commit_info", {})

        layers_data = data.get("layers", [])
        for i, layer_data in enumerate(layers_data):
            layer = ImageLayer(
                index=i,
                digest=layer_data.get("digest", f"layer-{i}"),
                size=layer_data.get("size", 0),
                created_by=layer_data.get("created_by", ""),
                is_base_image=layer_data.get("is_base_image", False),
                is_cached=layer_data.get("is_cached", False),
            )

            files_data = layer_data.get("files", [])
            for file_data in files_data:
                layer.files.append(
                    FileEntry(
                        path=file_data.get("path", ""),
                        size=file_data.get("size", 0),
                        is_directory=file_data.get("is_directory", False),
                        is_added=file_data.get("is_added", True),
                    )
                )

            metadata.layers.append(layer)

        if metadata.total_size == 0:
            metadata.total_size = sum(layer.size for layer in metadata.layers)

        return metadata

    def auto_detect_and_parse(self, input_path: str) -> ImageMetadata:
        path = Path(input_path)
        if not path.exists():
            if re.match(r"^[a-zA-Z0-9._/-]+:[a-zA-Z0-9._/-]+$", input_path):
                return self.parse_from_docker(input_path)
            raise FileNotFoundError(f"输入文件不存在: {input_path}")

        if path.suffix.lower() == ".json":
            return self.parse_from_json(input_path)

        with open(input_path, "r", encoding="utf-8", errors="ignore") as f:
            first_line = f.readline().strip()
            if first_line.startswith("{"):
                return self.parse_from_json(input_path)

        return self.parse_from_layer_list(input_path)

    def parse_commit_info(self, commit_path: str) -> Dict[str, Any]:
        if not os.path.exists(commit_path):
            return {}

        with open(commit_path, "r", encoding="utf-8") as f:
            if commit_path.endswith(".json"):
                return json.load(f)
            else:
                lines = f.readlines()
                info = {}
                for line in lines:
                    if ":" in line:
                        key, value = line.split(":", 1)
                        info[key.strip()] = value.strip()
                return info
