import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional


@dataclass
class SBOMComponent:
    name: str
    version: Optional[str] = None
    purl: Optional[str] = None
    licenses: List[str] = field(default_factory=list)
    supplier: Optional[str] = None
    description: Optional[str] = None
    raw: Dict[str, Any] = field(default_factory=dict)


class SBOMParser:
    def __init__(self):
        self.components: List[SBOMComponent] = []
        self.sbom_format: Optional[str] = None
        self.sbom_version: Optional[str] = None
        self.metadata: Dict[str, Any] = {}
    
    def parse(self, file_path: Path) -> List[SBOMComponent]:
        self.components = []
        
        if file_path.suffix.lower() == '.json':
            self._parse_json(file_path)
        elif file_path.suffix.lower() == '.xml':
            self._parse_xml(file_path)
        
        return self.components
    
    def _parse_json(self, file_path: Path):
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        if self._is_cyclonedx(data):
            self.sbom_format = "cyclonedx"
            self._parse_cyclonedx_json(data)
        elif self._is_spdx(data):
            self.sbom_format = "spdx"
            self._parse_spdx_json(data)
        else:
            self.sbom_format = "unknown"
    
    def _is_cyclonedx(self, data: Dict) -> bool:
        if "bomFormat" in data and data["bomFormat"] == "CycloneDX":
            return True
        if "components" in data and isinstance(data["components"], list):
            if data.get("components") and "name" in data["components"][0]:
                return True
        return False
    
    def _is_spdx(self, data: Dict) -> bool:
        if "spdxVersion" in data:
            return True
        if "packages" in data and isinstance(data["packages"], list):
            return True
        return False
    
    def _parse_cyclonedx_json(self, data: Dict):
        self.metadata = data.get("metadata", {})
        self.sbom_version = data.get("specVersion")
        
        components = data.get("components", [])
        for comp in components:
            licenses = self._extract_cyclonedx_licenses(comp.get("licenses", []))
            
            component = SBOMComponent(
                name=comp.get("name", ""),
                version=comp.get("version"),
                purl=comp.get("purl"),
                licenses=licenses,
                supplier=self._extract_supplier(comp),
                description=comp.get("description"),
                raw=comp
            )
            self.components.append(component)
    
    def _extract_cyclonedx_licenses(self, licenses_data: List[Dict]) -> List[str]:
        licenses = []
        for lic in licenses_data:
            if "license" in lic:
                license_info = lic["license"]
                if "id" in license_info:
                    licenses.append(license_info["id"])
                elif "name" in license_info:
                    licenses.append(license_info["name"])
                elif "expression" in license_info:
                    licenses.append(license_info["expression"])
        return licenses
    
    def _extract_supplier(self, comp: Dict) -> Optional[str]:
        supplier = comp.get("supplier", {})
        if isinstance(supplier, dict):
            name = supplier.get("name")
            if name:
                return name
        return None
    
    def _parse_spdx_json(self, data: Dict):
        self.metadata = {
            "document_name": data.get("name"),
            "document_namespace": data.get("documentNamespace"),
            "spdx_version": data.get("spdxVersion"),
        }
        self.sbom_version = data.get("spdxVersion")
        
        packages = data.get("packages", [])
        for pkg in packages:
            licenses = self._extract_spdx_licenses(pkg)
            
            component = SBOMComponent(
                name=pkg.get("name", ""),
                version=pkg.get("versionInfo"),
                purl=pkg.get("externalRefs", [{}])[0].get("referenceLocator") if pkg.get("externalRefs") else None,
                licenses=licenses,
                supplier=pkg.get("supplier"),
                description=pkg.get("description"),
                raw=pkg
            )
            self.components.append(component)
    
    def _extract_spdx_licenses(self, pkg: Dict) -> List[str]:
        licenses = []
        
        license_concluded = pkg.get("licenseConcluded")
        if license_concluded and license_concluded != "NOASSERTION":
            licenses.append(license_concluded)
        
        license_declared = pkg.get("licenseDeclared")
        if license_declared and license_declared != "NOASSERTION" and license_declared not in licenses:
            licenses.append(license_declared)
        
        return licenses
    
    def _parse_xml(self, file_path: Path):
        try:
            import xml.etree.ElementTree as ET
            tree = ET.parse(file_path)
            root = tree.getroot()
            
            ns = {}
            if "cyclonedx" in root.tag:
                self.sbom_format = "cyclonedx"
                ns = {"ns": "http://cyclonedx.org/schema/bom/1.4"}
                
                components_elem = root.find(".//ns:components", ns)
                if components_elem is not None:
                    for comp_elem in components_elem.findall("ns:component", ns):
                        licenses_elem = comp_elem.find("ns:licenses", ns)
                        licenses = []
                        if licenses_elem is not None:
                            for lic_elem in licenses_elem.findall("ns:license", ns):
                                id_elem = lic_elem.find("ns:id", ns)
                                if id_elem is not None and id_elem.text:
                                    licenses.append(id_elem.text)
                        
                        component = SBOMComponent(
                            name=comp_elem.findtext("ns:name", "", ns),
                            version=comp_elem.findtext("ns:version", None, ns),
                            purl=comp_elem.findtext("ns:purl", None, ns),
                            licenses=licenses,
                            raw={"element": comp_elem}
                        )
                        self.components.append(component)
        except Exception as e:
            self.sbom_format = f"error: {str(e)}"
    
    def get_licenses_summary(self) -> Dict[str, int]:
        license_counts: Dict[str, int] = {}
        for component in self.components:
            for lic in component.licenses:
                license_counts[lic] = license_counts.get(lic, 0) + 1
        return license_counts
    
    def get_summary(self) -> dict:
        return {
            "format": self.sbom_format,
            "version": self.sbom_version,
            "total_components": len(self.components),
            "licenses": self.get_licenses_summary(),
            "component_names": [c.name for c in self.components]
        }
