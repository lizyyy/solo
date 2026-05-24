import csv
import json
from pathlib import Path
from datetime import datetime
from typing import List, Optional
from tabulate import tabulate

from .models import AnalysisResult, PVCStatus, ReferenceEdge


class ReportGenerator:
    def __init__(self, output_dir: str = "."):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    def generate_all(self, result: AnalysisResult) -> dict:
        outputs = {}

        outputs['terminal'] = self.generate_terminal_summary(result)
        outputs['markdown'] = self.generate_markdown_report(result)
        outputs['csv'] = self.generate_csv_report(result)
        outputs['json'] = self.generate_json_report(result)

        return outputs

    def generate_terminal_summary(self, result: AnalysisResult) -> str:
        lines = []

        lines.append("\n" + "=" * 80)
        lines.append("K8s PVC ORPHAN FINDER - ANALYSIS SUMMARY")
        lines.append("=" * 80)
        lines.append(f"Generated at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")

        lines.append("📊 STATISTICS")
        lines.append("-" * 40)
        lines.append(f"Total PVCs analyzed:     {result.total_pvc_count}")
        lines.append(f"Orphan PVCs found:       {result.orphan_count}")
        lines.append(f"Referenced PVCs:         {result.total_pvc_count - result.orphan_count}")
        lines.append(f"Total resources scanned: {len(result.all_resources)}")
        lines.append(f"References tracked:      {len(result.references)}")
        lines.append("")

        if result.errors:
            lines.append(f"❌ ERRORS: {len(result.errors)}")
            for err in result.errors:
                lines.append(f"   - {err}")
            lines.append("")

        if result.warnings:
            lines.append(f"⚠️  WARNINGS: {len(result.warnings)}")
            for warn in result.warnings:
                lines.append(f"   - {warn}")
            lines.append("")

        orphan_pvcs = [p for p in result.pvcs if p.is_orphan]
        if orphan_pvcs:
            lines.append("🚨 ORPHAN PVCs")
            lines.append("-" * 40)

            table_data = []
            for pvc_status in orphan_pvcs:
                pvc = pvc_status.pvc
                source = str(pvc.source) if pvc.source else "unknown"
                active_rules = [r for r in pvc_status.retention_rules if r.is_active]
                protection = "Protected" if active_rules else "Unprotected"

                table_data.append([
                    f"{pvc.namespace}/{pvc.name}",
                    protection,
                    pvc_status.cleanup_recommendation,
                    source
                ])

            lines.append(tabulate(
                table_data,
                headers=["PVC", "Protection", "Recommendation", "Source File"],
                tablefmt="simple"
            ))
            lines.append("")
        else:
            lines.append("✅ No orphan PVCs found!")
            lines.append("")

        if result.orphan_count > 0:
            lines.append("📋 CLEANUP RECOMMENDATIONS")
            lines.append("-" * 40)

            for pvc_status in orphan_pvcs:
                pvc = pvc_status.pvc
                lines.append(f"\n[{pvc.namespace}/{pvc.name}]")
                lines.append(f"  Recommendation: {pvc_status.cleanup_recommendation.upper()}")
                lines.append(f"  Source: {pvc.source}")

                if pvc_status.issues:
                    lines.append(f"  Issues:")
                    for issue in pvc_status.issues:
                        lines.append(f"    - {issue}")

                if pvc_status.retention_rules:
                    lines.append(f"  Retention Rules:")
                    for rule in pvc_status.retention_rules:
                        status = "ACTIVE" if rule.is_active else "EXPIRED/INACTIVE"
                        lines.append(f"    - [{status}] {rule.description}")
        lines.append("")

        return "\n".join(lines)

    def generate_markdown_report(self, result: AnalysisResult) -> str:
        path = self.output_dir / f"pvc_orphan_report_{self.timestamp}.md"

        lines = []
        lines.append("# K8s PVC Orphan Analysis Report")
        lines.append("")
        lines.append(f"**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")

        lines.append("## Executive Summary")
        lines.append("")
        lines.append("| Metric | Value |")
        lines.append("|--------|-------|")
        lines.append(f"| Total PVCs analyzed | {result.total_pvc_count} |")
        lines.append(f"| Orphan PVCs found | **{result.orphan_count}** |")
        lines.append(f"| Referenced PVCs | {result.total_pvc_count - result.orphan_count} |")
        lines.append(f"| Total resources scanned | {len(result.all_resources)} |")
        lines.append(f"| References tracked | {len(result.references)} |")
        lines.append(f"| Errors | {len(result.errors)} |")
        lines.append(f"| Warnings | {len(result.warnings)} |")
        lines.append("")

        if result.errors:
            lines.append("## ❌ Errors")
            lines.append("")
            for err in result.errors:
                lines.append(f"- {err}")
            lines.append("")

        if result.warnings:
            lines.append("## ⚠️ Warnings")
            lines.append("")
            for warn in result.warnings:
                lines.append(f"- {warn}")
            lines.append("")

        lines.append("## Resource Graph Explanation")
        lines.append("")
        lines.append("The tool builds a resource reference graph by tracking:")
        lines.append("")
        lines.append("- **Direct references**: Pod → PVC via `spec.volumes[].persistentVolumeClaim.claimName`")
        lines.append("- **CronJob references**: CronJob → Pod template → PVC (indirect reference)")
        lines.append("- **Job references**: Job → Pod template → PVC, plus ownerReferences to CronJob")
        lines.append("- **StatefulSet references**:")
        lines.append("  - Direct volume claims")
        lines.append("  - VolumeClaimTemplates (pattern matching: `{tmpl}-{sts-name}-{ordinal}`)")
        lines.append("- **Workload references**: Deployment/DaemonSet/ReplicaSet → Pod template → PVC")
        lines.append("")

        lines.append("## Reference Types Tracked")
        lines.append("")
        lines.append("| Reference Type | Description |")
        lines.append("|----------------|-------------|")
        lines.append("| `direct` | Direct Pod to PVC reference |")
        lines.append("| `cronjob-template` | CronJob's job template references PVC |")
        lines.append("| `job-template` | Job's pod template references PVC |")
        lines.append("| `sts-volumeclaimtemplate` | StatefulSet VolumeClaimTemplate (pattern match) |")
        lines.append("| `sts-direct` | StatefulSet direct volume reference |")
        lines.append("| `deployment-template` | Deployment pod template reference |")
        lines.append("")

        lines.append("## Retention Rules")
        lines.append("")
        lines.append("The following rules are checked to determine if a PVC should be kept:")
        lines.append("")
        lines.append("1. **Namespace Protection**: PVCs in protected namespaces (kube-system, etc.)")
        lines.append("2. **Retention Labels**: `pvc-orphan/retention-policy=retain`")
        lines.append("3. **Expiry Labels**: `pvc-orphan/expires-at=YYYY-MM-DD`")
        lines.append("4. **Protected Labels**: Common app labels like `app.kubernetes.io/name`")
        lines.append("5. **Storage Class**: StorageClass name containing 'retain'")
        lines.append("6. **Retention Annotations**: Annotations containing 'retain'")
        lines.append("")

        lines.append("## Cleanup Recommendations")
        lines.append("")
        lines.append("| Recommendation | Meaning | Action |")
        lines.append("|----------------|---------|--------|")
        lines.append("| `keep` | PVC is actively referenced | Keep |")
        lines.append("| `keep-protected` | Orphan but has active retention rules | Review, keep if needed |")
        lines.append("| `delete-expired` | Orphan with expired retention | Safe to delete |")
        lines.append("| `review-delete` | Orphan, no protection | Review carefully, delete if unused |")
        lines.append("")

        orphan_pvcs = [p for p in result.pvcs if p.is_orphan]
        referenced_pvcs = [p for p in result.pvcs if not p.is_orphan]

        if orphan_pvcs:
            lines.append("## 🚨 Orphan PVC Details")
            lines.append("")

            for pvc_status in orphan_pvcs:
                pvc = pvc_status.pvc
                lines.append(f"### {pvc.namespace}/{pvc.name}")
                lines.append("")

                lines.append("| Field | Value |")
                lines.append("|-------|-------|")
                lines.append(f"| Namespace | {pvc.namespace} |")
                lines.append(f"| Name | {pvc.name} |")
                lines.append(f"| Source | `{pvc.source}` |")
                lines.append(f"| Cleanup Recommendation | **{pvc_status.cleanup_recommendation.upper()}** |")
                lines.append("")

                if pvc.labels:
                    lines.append("**Labels:**")
                    lines.append("")
                    for k, v in pvc.labels.items():
                        lines.append(f"- `{k}={v}`")
                    lines.append("")

                if pvc_status.issues:
                    lines.append("**Issues:**")
                    lines.append("")
                    for issue in pvc_status.issues:
                        lines.append(f"- ⚠️ {issue}")
                    lines.append("")

                if pvc_status.retention_rules:
                    lines.append("**Retention Rules:**")
                    lines.append("")
                    for rule in pvc_status.retention_rules:
                        icon = "✅" if rule.is_active else "❌"
                        lines.append(f"- {icon} **{rule.rule_type}**: {rule.description}")
                    lines.append("")

                if pvc.spec.get('storageClassName'):
                    lines.append(f"**StorageClass:** {pvc.spec.get('storageClassName')}")
                    lines.append("")

                if pvc.spec.get('volumeName'):
                    lines.append(f"**Bound PV:** {pvc.spec.get('volumeName')}")
                    lines.append("")

                if pvc.spec.get('resources', {}).get('requests', {}).get('storage'):
                    lines.append(f"**Storage Request:** {pvc.spec['resources']['requests']['storage']}")
                    lines.append("")

        lines.append("## ✅ Referenced PVCs")
        lines.append("")
        if referenced_pvcs:
            lines.append("| PVC | References | Source |")
            lines.append("|-----|------------|--------|")
            for pvc_status in referenced_pvcs:
                pvc = pvc_status.pvc
                refs = ", ".join(pvc_status.references[:3])
                if len(pvc_status.references) > 3:
                    refs += f" (+{len(pvc_status.references) - 3} more)"
                source = str(pvc.source) if pvc.source else "unknown"
                lines.append(f"| {pvc.namespace}/{pvc.name} | {refs} | {source} |")
        else:
            lines.append("None found.")
        lines.append("")

        lines.append("## Reference Graph")
        lines.append("")
        lines.append("```mermaid")
        lines.append("graph TD")
        lines.append("")

        pvc_nodes = set()
        for pvc_status in result.pvcs:
            pvc = pvc_status.pvc
            node_id = f"PVC_{pvc.namespace}_{pvc.name}".replace("-", "_").replace(".", "_")
            pvc_nodes.add(node_id)
            style = ",fill:#ffcccc" if pvc_status.is_orphan else ",fill:#ccffcc"
            lines.append(f"    {node_id}[\"{pvc.namespace}/{pvc.name}\"]")
            lines.append(f"    style {node_id} fill:#e0e0e0{style}")
        lines.append("")

        for ref in result.references:
            from_id = ref.from_resource.replace("/", "_").replace("-", "_").replace(".", "_")
            to_id = ref.to_resource.replace("/", "_").replace("-", "_").replace(".", "_")

            if ref.reference_type in ['owner']:
                arrow = "-->"
            else:
                arrow = "-.->"

            label = f"|{ref.reference_type}|"
            lines.append(f"    {from_id} {arrow} {to_id}")
        lines.append("```")
        lines.append("")

        lines.append("---")
        lines.append("")
        lines.append("*Report generated by pvc-orphan-finder*")

        content = "\n".join(lines)
        path.write_text(content, encoding='utf-8')
        return str(path)

    def generate_csv_report(self, result: AnalysisResult) -> str:
        path = self.output_dir / f"pvc_orphan_report_{self.timestamp}.csv"

        with open(path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)

            writer.writerow([
                'Namespace',
                'PVC Name',
                'Is Orphan',
                'Cleanup Recommendation',
                'References',
                'Reference Count',
                'Has Protection',
                'Protection Rules',
                'Issues',
                'Source File',
                'Start Line',
                'Storage Class',
                'Storage Request',
            ])

            for pvc_status in result.pvcs:
                pvc = pvc_status.pvc
                active_rules = [r for r in pvc_status.retention_rules if r.is_active]

                writer.writerow([
                    pvc.namespace,
                    pvc.name,
                    'YES' if pvc_status.is_orphan else 'NO',
                    pvc_status.cleanup_recommendation,
                    '; '.join(pvc_status.references),
                    len(pvc_status.references),
                    'YES' if active_rules else 'NO',
                    '; '.join([f"{r.rule_type}:{r.description}" for r in active_rules]),
                    '; '.join(pvc_status.issues),
                    pvc.source.file_path if pvc.source else '',
                    pvc.source.start_line if pvc.source else '',
                    pvc.spec.get('storageClassName', ''),
                    pvc.spec.get('resources', {}).get('requests', {}).get('storage', ''),
                ])

        return str(path)

    def generate_json_report(self, result: AnalysisResult) -> str:
        path = self.output_dir / f"pvc_orphan_report_{self.timestamp}.json"

        data = {
            'generated_at': datetime.now().isoformat(),
            'summary': {
                'total_pvcs': result.total_pvc_count,
                'orphan_pvcs': result.orphan_count,
                'referenced_pvcs': result.total_pvc_count - result.orphan_count,
                'total_resources': len(result.all_resources),
                'references_tracked': len(result.references),
                'errors': result.errors,
                'warnings': result.warnings,
            },
            'orphan_pvcs': [],
            'referenced_pvcs': [],
        }

        for pvc_status in result.pvcs:
            pvc = pvc_status.pvc
            pvc_data = {
                'namespace': pvc.namespace,
                'name': pvc.name,
                'labels': pvc.labels,
                'annotations': pvc.annotations,
                'source': str(pvc.source) if pvc.source else None,
                'source_file': pvc.source.file_path if pvc.source else None,
                'source_line': pvc.source.start_line if pvc.source else None,
                'cleanup_recommendation': pvc_status.cleanup_recommendation,
                'reason': pvc_status.reason,
                'issues': pvc_status.issues,
                'references': pvc_status.references,
                'retention_rules': [
                    {
                        'type': r.rule_type,
                        'description': r.description,
                        'is_active': r.is_active,
                        'expires_at': r.expires_at.isoformat() if r.expires_at else None,
                    }
                    for r in pvc_status.retention_rules
                ],
                'spec': {
                    'storage_class': pvc.spec.get('storageClassName'),
                    'storage_request': pvc.spec.get('resources', {}).get('requests', {}).get('storage'),
                    'volume_name': pvc.spec.get('volumeName'),
                },
            }

            if pvc_status.is_orphan:
                data['orphan_pvcs'].append(pvc_data)
            else:
                data['referenced_pvcs'].append(pvc_data)

        import json as json_module
        path.write_text(json_module.dumps(data, indent=2), encoding='utf-8')
        return str(path)
