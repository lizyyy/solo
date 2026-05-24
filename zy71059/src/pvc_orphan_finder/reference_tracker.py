from typing import List, Dict, Set, Optional, Tuple, Any
from collections import defaultdict
import fnmatch

from .models import (
    K8sResource,
    ReferenceEdge,
    ResourceType,
)


class ReferenceTracker:
    def __init__(self, resources: List[K8sResource]):
        self.resources = resources
        self.resource_map: Dict[str, K8sResource] = {}
        self.references: List[ReferenceEdge] = []
        self.pvc_references: Dict[str, Set[str]] = defaultdict(set)

        for r in resources:
            self.resource_map[r.key] = r

    def build_reference_graph(self) -> List[ReferenceEdge]:
        self.references = []

        for resource in self.resources:
            self._track_resource_references(resource)

        self._propagate_indirect_references()

        return self.references

    def _track_resource_references(self, resource: K8sResource) -> None:
        rt = resource.resource_type

        if rt == ResourceType.POD:
            self._track_pod_references(resource)
        elif rt == ResourceType.CRONJOB:
            self._track_cronjob_references(resource)
        elif rt == ResourceType.JOB:
            self._track_job_references(resource)
        elif rt == ResourceType.STATEFULSET:
            self._track_statefulset_references(resource)
        elif rt in (ResourceType.DEPLOYMENT, ResourceType.DAEMONSET,
                    ResourceType.REPLICASET, ResourceType.REPLICATIONCONTROLLER):
            self._track_workload_references(resource)

    def _track_pod_references(self, pod: K8sResource) -> None:
        volumes = pod.spec.get('volumes', []) or []

        for i, volume in enumerate(volumes):
            if not isinstance(volume, dict):
                continue

            pvc_claim = volume.get('persistentVolumeClaim', {}) or {}
            if pvc_claim:
                claim_name = pvc_claim.get('claimName')
                if claim_name:
                    self._add_reference(
                        from_resource=pod.key,
                        to_resource=f"{pod.namespace}/{ResourceType.PVC.value}/{claim_name}",
                        ref_type="direct",
                        via_field=f"spec.volumes[{i}].persistentVolumeClaim.claimName"
                    )

        ephemeral = volume.get('ephemeral', {}) or {}
        if ephemeral:
            vol_claim_tmpl = ephemeral.get('volumeClaimTemplate', {}) or {}
            metadata = vol_claim_tmpl.get('metadata', {}) or {}
            tmpl_name = metadata.get('name')
            if tmpl_name:
                self._add_reference(
                    from_resource=pod.key,
                    to_resource=f"{pod.namespace}/{ResourceType.PVC.value}/{tmpl_name}",
                    ref_type="ephemeral-template",
                    via_field=f"spec.volumes[{i}].ephemeral.volumeClaimTemplate.metadata.name"
                )

    def _track_cronjob_references(self, cronjob: K8sResource) -> None:
        job_tmpl = cronjob.spec.get('jobTemplate', {}) or {}
        job_spec = job_tmpl.get('spec', {}) or {}
        pod_tmpl = job_spec.get('template', {}) or {}
        pod_spec = pod_tmpl.get('spec', {}) or {}
        volumes = pod_spec.get('volumes', []) or []

        for i, volume in enumerate(volumes):
            if not isinstance(volume, dict):
                continue

            pvc_claim = volume.get('persistentVolumeClaim', {}) or {}
            if pvc_claim:
                claim_name = pvc_claim.get('claimName')
                if claim_name:
                    self._add_reference(
                        from_resource=cronjob.key,
                        to_resource=f"{cronjob.namespace}/{ResourceType.PVC.value}/{claim_name}",
                        ref_type="cronjob-template",
                        via_field=f"spec.jobTemplate.spec.template.spec.volumes[{i}].persistentVolumeClaim.claimName"
                    )

    def _track_job_references(self, job: K8sResource) -> None:
        owner_refs = job.raw.get('metadata', {}).get('ownerReferences', []) or []
        for owner in owner_refs:
            owner_kind = owner.get('kind')
            owner_name = owner.get('name')
            if owner_kind == 'CronJob' and owner_name:
                self._add_reference(
                    from_resource=job.key,
                    to_resource=f"{job.namespace}/{ResourceType.CRONJOB.value}/{owner_name}",
                    ref_type="owner",
                    via_field="metadata.ownerReferences"
                )

        pod_tmpl = job.spec.get('template', {}) or {}
        pod_spec = pod_tmpl.get('spec', {}) or {}
        volumes = pod_spec.get('volumes', []) or []

        for i, volume in enumerate(volumes):
            if not isinstance(volume, dict):
                continue

            pvc_claim = volume.get('persistentVolumeClaim', {}) or {}
            if pvc_claim:
                claim_name = pvc_claim.get('claimName')
                if claim_name:
                    self._add_reference(
                        from_resource=job.key,
                        to_resource=f"{job.namespace}/{ResourceType.PVC.value}/{claim_name}",
                        ref_type="job-template",
                        via_field=f"spec.template.spec.volumes[{i}].persistentVolumeClaim.claimName"
                    )

    def _track_statefulset_references(self, sts: K8sResource) -> None:
        vol_claim_templates = sts.spec.get('volumeClaimTemplates', []) or []

        for i, tmpl in enumerate(vol_claim_templates):
            if not isinstance(tmpl, dict):
                continue
            metadata = tmpl.get('metadata', {}) or {}
            tmpl_name = metadata.get('name')
            if tmpl_name:
                for ordinal in range(10):
                    pvc_name = f"{tmpl_name}-{sts.name}-{ordinal}"
                    self._add_reference(
                        from_resource=sts.key,
                        to_resource=f"{sts.namespace}/{ResourceType.PVC.value}/{pvc_name}",
                        ref_type="sts-volumeclaimtemplate",
                        via_field=f"spec.volumeClaimTemplates[{i}].metadata.name (pattern: {tmpl_name}-{sts.name}-N)"
                    )

        pod_tmpl = sts.spec.get('template', {}) or {}
        pod_spec = pod_tmpl.get('spec', {}) or {}
        volumes = pod_spec.get('volumes', []) or []

        for i, volume in enumerate(volumes):
            if not isinstance(volume, dict):
                continue

            pvc_claim = volume.get('persistentVolumeClaim', {}) or {}
            if pvc_claim:
                claim_name = pvc_claim.get('claimName')
                if claim_name:
                    self._add_reference(
                        from_resource=sts.key,
                        to_resource=f"{sts.namespace}/{ResourceType.PVC.value}/{claim_name}",
                        ref_type="sts-direct",
                        via_field=f"spec.template.spec.volumes[{i}].persistentVolumeClaim.claimName"
                    )

    def _track_workload_references(self, workload: K8sResource) -> None:
        pod_tmpl = workload.spec.get('template', {}) or {}
        pod_spec = pod_tmpl.get('spec', {}) or {}
        volumes = pod_spec.get('volumes', []) or []

        for i, volume in enumerate(volumes):
            if not isinstance(volume, dict):
                continue

            pvc_claim = volume.get('persistentVolumeClaim', {}) or {}
            if pvc_claim:
                claim_name = pvc_claim.get('claimName')
                if claim_name:
                    self._add_reference(
                        from_resource=workload.key,
                        to_resource=f"{workload.namespace}/{ResourceType.PVC.value}/{claim_name}",
                        ref_type=f"{workload.kind.lower()}-template",
                        via_field=f"spec.template.spec.volumes[{i}].persistentVolumeClaim.claimName"
                    )

    def _add_reference(self, from_resource: str, to_resource: str,
                       ref_type: str, via_field: str) -> None:
        edge = ReferenceEdge(
            from_resource=from_resource,
            to_resource=to_resource,
            reference_type=ref_type,
            via_field=via_field
        )
        self.references.append(edge)

    def _propagate_indirect_references(self) -> None:
        pass

    def get_pvc_referencers(self, pvc_key: str) -> List[Tuple[str, str, str]]:
        results = []
        for ref in self.references:
            if ref.to_resource == pvc_key:
                results.append((ref.from_resource, ref.reference_type, ref.via_field))
        return results

    def find_all_pvc_references(self, pvc: K8sResource) -> List[Dict[str, Any]]:
        references = []
        pvc_key = pvc.key

        for ref in self.references:
            if ref.to_resource == pvc_key:
                from_res = self.resource_map.get(ref.from_resource)
                references.append({
                    'referencer': ref.from_resource,
                    'referencer_type': from_res.kind if from_res else 'Unknown',
                    'reference_type': ref.reference_type,
                    'via_field': ref.via_field,
                    'source': from_res.source if from_res else None
                })

        pvc_patterns = [
            f"*/{ResourceType.PVC.value}/{pvc.name}",
            f"{pvc.namespace}/{ResourceType.PVC.value}/*-{pvc.name}-*",
        ]

        for ref in self.references:
            for pattern in pvc_patterns:
                if fnmatch.fnmatch(ref.to_resource, pattern) and ref.to_resource != pvc_key:
                    if pvc.name in ref.to_resource:
                        from_res = self.resource_map.get(ref.from_resource)
                        references.append({
                            'referencer': ref.from_resource,
                            'referencer_type': from_res.kind if from_res else 'Unknown',
                            'reference_type': f"{ref.reference_type} (pattern-match)",
                            'via_field': ref.via_field,
                            'source': from_res.source if from_res else None
                        })

        return references
