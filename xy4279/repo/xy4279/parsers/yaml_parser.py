import yaml
from typing import Dict, List, Any, Optional
from models.schemas import (
    SettingVersionCreate, SettingValueCreate,
    TopologyCreate, TopologyNodeCreate, TopologyRelationCreate,
    PlateStatusCreate, PlateStateCreate,
    ApprovalTicketCreate, ApprovalSignatureCreate
)


class YAMLParser:
    def __init__(self):
        self.encoding = "utf-8"

    def parse_settings(self, file_content: bytes, filename: str,
                       bay_id: str, bay_name: str, version: str) -> SettingVersionCreate:
        try:
            content = file_content.decode(self.encoding)
            data = yaml.safe_load(content) or {}
            
            return self._parse_settings_data(data, filename, bay_id, bay_name, version)
        except Exception as e:
            raise ValueError(f"解析YAML定值文件失败: {str(e)}")

    def _parse_settings_data(self, data: Dict[str, Any], filename: str,
                             bay_id: str, bay_name: str, version: str) -> SettingVersionCreate:
        version_info = data.get("version_info", data.get("版本信息", {}))
        values_data = data.get("values", data.get("定值项", []))
        
        if not values_data and "settings" in data:
            values_data = data.get("settings", [])
        
        values = []
        for item in values_data:
            if isinstance(item, dict):
                name = str(item.get("name", item.get("名称", item.get("定值项", "")))).strip()
                value = str(item.get("value", item.get("值", item.get("整定值", "")))).strip()
                
                if name and value:
                    values.append(SettingValueCreate(
                        name=name,
                        value=value,
                        unit=str(item.get("unit", item.get("单位", ""))).strip() or None,
                        description=str(item.get("description", item.get("说明", ""))).strip() or None,
                        category=str(item.get("category", item.get("分类", ""))).strip() or None,
                        group_name=str(item.get("group", item.get("组", ""))).strip() or None
                    ))
        
        return SettingVersionCreate(
            version=str(version_info.get("version", version_info.get("版本", version))),
            bay_id=str(version_info.get("bay_id", version_info.get("间隔ID", bay_id))),
            bay_name=str(version_info.get("bay_name", version_info.get("间隔名称", bay_name))),
            device_type=str(version_info.get("device_type", version_info.get("装置类型", "线路保护"))),
            device_model=str(version_info.get("device_model", version_info.get("装置型号", "RCS-931"))),
            manufacturer=str(version_info.get("manufacturer", version_info.get("厂家", "南瑞继保"))),
            effective_date=str(version_info.get("effective_date", version_info.get("生效日期", ""))) or None,
            source_file=filename,
            source_type="yaml",
            values=values
        )

    def parse_topology(self, file_content: bytes, filename: str, name: str) -> TopologyCreate:
        try:
            content = file_content.decode(self.encoding)
            data = yaml.safe_load(content) or {}
            
            nodes_data = data.get("nodes", data.get("节点", []))
            relations_data = data.get("relations", data.get("连接关系", []))
            
            nodes = []
            for node in nodes_data:
                if isinstance(node, dict):
                    nodes.append(TopologyNodeCreate(
                        node_id=str(node.get("id", node.get("node_id", ""))).strip(),
                        node_type=str(node.get("type", node.get("node_type", "设备"))).strip(),
                        name=str(node.get("name", node.get("名称", ""))).strip(),
                        parent_id=str(node.get("parent_id", node.get("父节点", ""))).strip() or None,
                        properties=node.get("properties", node.get("属性"))
                    ))
            
            relations = []
            for rel in relations_data:
                if isinstance(rel, dict):
                    relations.append(TopologyRelationCreate(
                        from_node=str(rel.get("from", rel.get("from_node", ""))).strip(),
                        to_node=str(rel.get("to", rel.get("to_node", ""))).strip(),
                        relation_type=str(rel.get("type", rel.get("relation_type", "连接"))).strip(),
                        properties=rel.get("properties", rel.get("属性"))
                    ))
            
            return TopologyCreate(
                name=str(data.get("name", data.get("名称", name))),
                description=str(data.get("description", data.get("描述", ""))) or None,
                source_file=filename,
                nodes=nodes,
                relations=relations
            )
        except Exception as e:
            raise ValueError(f"解析YAML拓扑文件失败: {str(e)}")

    def parse_plates(self, file_content: bytes, filename: str,
                     bay_id: str, bay_name: str, name: str) -> PlateStatusCreate:
        try:
            content = file_content.decode(self.encoding)
            data = yaml.safe_load(content) or {}
            
            plates_data = data.get("plates", data.get("压板", []))
            
            plates = []
            for item in plates_data:
                if isinstance(item, dict):
                    plate_id = str(item.get("id", item.get("plate_id", ""))).strip()
                    plate_name = str(item.get("name", item.get("名称", ""))).strip()
                    plate_type = str(item.get("type", item.get("类型", "功能压板"))).strip()
                    current_state = str(item.get("current_state", item.get("当前状态", "退出"))).strip()
                    
                    if plate_id or plate_name:
                        sequence = item.get("sequence", item.get("顺序"))
                        if sequence is not None:
                            try:
                                sequence = int(sequence)
                            except (ValueError, TypeError):
                                sequence = None
                        
                        plates.append(PlateStateCreate(
                            plate_id=plate_id or plate_name,
                            plate_name=plate_name or plate_id,
                            plate_type=plate_type,
                            current_state=current_state,
                            target_state=str(item.get("target_state", item.get("目标状态", ""))).strip() or None,
                            sequence=sequence,
                            description=str(item.get("description", item.get("说明", ""))).strip() or None,
                            bay_id=bay_id
                        ))
            
            return PlateStatusCreate(
                name=str(data.get("name", data.get("名称", name))),
                bay_id=str(data.get("bay_id", data.get("间隔ID", bay_id))),
                bay_name=str(data.get("bay_name", data.get("间隔名称", bay_name))),
                source_file=filename,
                plates=plates
            )
        except Exception as e:
            raise ValueError(f"解析YAML压板状态文件失败: {str(e)}")

    def parse_approval_ticket(self, file_content: bytes, filename: str) -> ApprovalTicketCreate:
        try:
            content = file_content.decode(self.encoding)
            data = yaml.safe_load(content) or {}
            
            signatures_data = data.get("signatures", data.get("签名", []))
            
            signatures = []
            for item in signatures_data:
                if isinstance(item, dict):
                    signatures.append(ApprovalSignatureCreate(
                        role=str(item.get("role", item.get("角色", ""))).strip(),
                        signatory=str(item.get("signatory", item.get("签字人", ""))).strip(),
                        signed=bool(item.get("signed", item.get("已签字", False))),
                        signed_at=str(item.get("signed_at", item.get("签字时间", ""))).strip() or None,
                        comment=str(item.get("comment", item.get("备注", ""))).strip() or None,
                        sequence=int(item.get("sequence", item.get("顺序", len(signatures) + 1)))
                    ))
            
            return ApprovalTicketCreate(
                ticket_no=str(data.get("ticket_no", data.get("票号", ""))).strip(),
                title=str(data.get("title", data.get("标题", "定值审批票"))).strip(),
                status=str(data.get("status", data.get("状态", "pending"))).strip(),
                source_file=filename,
                signatures=signatures
            )
        except Exception as e:
            raise ValueError(f"解析YAML审批票文件失败: {str(e)}")
