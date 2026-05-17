import subprocess
import tempfile
import os
import yaml
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
import logging

logger = logging.getLogger(__name__)


@dataclass
class RenderResult:
    success: bool
    manifests: List[Dict]
    errors: List[str]
    raw_output: str
    environment: str
    values_file: str


class HelmRenderer:
    def __init__(self, helm_path: str = "helm"):
        self.helm_path = helm_path
        self._check_helm_available()

    def _check_helm_available(self) -> None:
        try:
            result = subprocess.run(
                [self.helm_path, "version", "--short"],
                capture_output=True,
                text=True,
                check=True
            )
            logger.debug(f"Helm version: {result.stdout.strip()}")
        except (subprocess.CalledProcessError, FileNotFoundError):
            raise RuntimeError(
                "Helm CLI is not available. Please install Helm and ensure it's in PATH."
            )

    def render(
        self,
        chart_path: str,
        values_file: str,
        environment: str,
        release_name: Optional[str] = None,
        namespace: Optional[str] = None,
        additional_values: Optional[List[str]] = None
    ) -> RenderResult:
        if release_name is None:
            release_name = f"test-release-{environment}"

        if namespace is None:
            namespace = "default"

        cmd = [
            self.helm_path,
            "template",
            release_name,
            chart_path,
            "--values", values_file,
            "--namespace", namespace,
            "--include-crds"
        ]

        if additional_values:
            for vals in additional_values:
                cmd.extend(["--values", vals])

        errors = []
        manifests = []
        raw_output = ""

        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                check=True
            )
            raw_output = result.stdout
            manifests = self._parse_manifests(raw_output)
            success = True
        except subprocess.CalledProcessError as e:
            success = False
            errors.append(f"Helm template failed with exit code {e.returncode}")
            if e.stderr:
                errors.append(f"STDERR: {e.stderr.strip()}")
            if e.stdout:
                raw_output = e.stdout
                manifests = self._parse_manifests(e.stdout)

        return RenderResult(
            success=success,
            manifests=manifests,
            errors=errors,
            raw_output=raw_output,
            environment=environment,
            values_file=values_file
        )

    def _parse_manifests(self, raw_yaml: str) -> List[Dict]:
        manifests = []
        docs = raw_yaml.split("---\n")
        
        for doc_idx, doc in enumerate(docs):
            doc = doc.strip()
            if not doc or doc.startswith("#"):
                continue
                
            try:
                manifest = yaml.safe_load(doc)
                if manifest and isinstance(manifest, dict) and "kind" in manifest:
                    manifest["_source_position"] = doc_idx
                    manifests.append(manifest)
            except yaml.YAMLError as e:
                logger.warning(f"Failed to parse manifest at position {doc_idx}: {e}")

        return manifests

    def render_multiple(
        self,
        chart_path: str,
        environments: Dict[str, str],
        release_name: Optional[str] = None,
        namespace: Optional[str] = None
    ) -> Dict[str, RenderResult]:
        results = {}
        for env_name, values_file in environments.items():
            logger.info(f"Rendering environment: {env_name} using {values_file}")
            results[env_name] = self.render(
                chart_path=chart_path,
                values_file=values_file,
                environment=env_name,
                release_name=release_name,
                namespace=namespace
            )
        return results
