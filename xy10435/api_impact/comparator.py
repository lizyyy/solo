from typing import Dict, List, Optional, Tuple
from datetime import datetime
from .models import (
    ApiContract,
    ApiDiff,
    EndpointDefinition,
    EndpointChange,
    FieldChange,
    FieldDefinition,
    ChangeType,
)


class ContractComparator:
    def compare(self, old_contract: ApiContract, new_contract: ApiContract) -> ApiDiff:
        if old_contract.api_name != new_contract.api_name:
            raise ValueError(f"API 名称不匹配: {old_contract.api_name} vs {new_contract.api_name}")

        endpoint_changes = self._compare_endpoints(
            old_contract.endpoints,
            new_contract.endpoints,
        )

        return ApiDiff(
            api_name=old_contract.api_name,
            old_version=old_contract.version,
            new_version=new_contract.version,
            service_name=old_contract.service_name,
            endpoint_changes=endpoint_changes,
            computed_at=datetime.now(),
        )

    def _compare_endpoints(
        self,
        old_endpoints: List[EndpointDefinition],
        new_endpoints: List[EndpointDefinition],
    ) -> List[EndpointChange]:
        old_map: Dict[Tuple[str, str], EndpointDefinition] = {
            (e.path, e.method): e for e in old_endpoints
        }
        new_map: Dict[Tuple[str, str], EndpointDefinition] = {
            (e.path, e.method): e for e in new_endpoints
        }

        changes: List[EndpointChange] = []

        for key, old_ep in old_map.items():
            if key in new_map:
                ep_changes = self._compare_single_endpoint(old_ep, new_map[key])
                if ep_changes:
                    changes.append(ep_changes)

        return changes

    def _compare_single_endpoint(
        self,
        old_ep: EndpointDefinition,
        new_ep: EndpointDefinition,
    ) -> Optional[EndpointChange]:
        changes: List[FieldChange] = []

        changes.extend(self._compare_fields(
            old_ep.request_body or [],
            new_ep.request_body or [],
            "request",
        ))
        changes.extend(self._compare_fields(
            old_ep.response_body or [],
            new_ep.response_body or [],
            "response",
        ))
        changes.extend(self._compare_fields(
            old_ep.query_params or [],
            new_ep.query_params or [],
            "query",
        ))
        changes.extend(self._compare_fields(
            old_ep.path_params or [],
            new_ep.path_params or [],
            "path",
        ))

        if changes:
            return EndpointChange(
                endpoint_path=old_ep.path,
                method=old_ep.method,
                changes=changes,
            )
        return None

    def _compare_fields(
        self,
        old_fields: List[FieldDefinition],
        new_fields: List[FieldDefinition],
        location: str,
    ) -> List[FieldChange]:
        old_map: Dict[str, FieldDefinition] = {f.name: f for f in old_fields}
        new_map: Dict[str, FieldDefinition] = {f.name: f for f in new_fields}

        changes: List[FieldChange] = []

        for name, old_field in old_map.items():
            if name not in new_map:
                changes.append(FieldChange(
                    change_type=ChangeType.FIELD_REMOVED,
                    path=f"{location}.{name}",
                    field_name=name,
                    old_value=old_field.type,
                    location=location,
                ))
            else:
                new_field = new_map[name]
                changes.extend(self._compare_single_field(
                    old_field,
                    new_field,
                    location,
                ))

        for name, new_field in new_map.items():
            if name not in old_map:
                if new_field.required:
                    changes.append(FieldChange(
                        change_type=ChangeType.REQUIRED_ADDED,
                        path=f"{location}.{name}",
                        field_name=name,
                        new_value=new_field.type,
                        location=location,
                    ))
                else:
                    changes.append(FieldChange(
                        change_type=ChangeType.FIELD_ADDED,
                        path=f"{location}.{name}",
                        field_name=name,
                        new_value=new_field.type,
                        location=location,
                    ))

        return changes

    def _compare_single_field(
        self,
        old_field: FieldDefinition,
        new_field: FieldDefinition,
        location: str,
    ) -> List[FieldChange]:
        changes: List[FieldChange] = []

        if old_field.type != new_field.type:
            changes.append(FieldChange(
                change_type=ChangeType.TYPE_CHANGED,
                path=f"{location}.{old_field.name}",
                field_name=old_field.name,
                old_value=old_field.type,
                new_value=new_field.type,
                location=location,
            ))

        if old_field.enum_values != new_field.enum_values:
            changes.append(FieldChange(
                change_type=ChangeType.ENUM_CHANGED,
                path=f"{location}.{old_field.name}",
                field_name=old_field.name,
                old_value=old_field.enum_values,
                new_value=new_field.enum_values,
                location=location,
            ))

        if not old_field.required and new_field.required:
            changes.append(FieldChange(
                change_type=ChangeType.REQUIRED_ADDED,
                path=f"{location}.{old_field.name}",
                field_name=old_field.name,
                old_value=False,
                new_value=True,
                location=location,
            ))
        elif old_field.required and not new_field.required:
            changes.append(FieldChange(
                change_type=ChangeType.REQUIRED_REMOVED,
                path=f"{location}.{old_field.name}",
                field_name=old_field.name,
                old_value=True,
                new_value=False,
                location=location,
            ))

        return changes
