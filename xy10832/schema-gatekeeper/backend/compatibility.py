from typing import Dict, Any, List, Tuple
from database import SchemaVersion, Consumer


def compare_schemas(old_schema: Dict[str, Any], new_schema: Dict[str, Any]) -> Tuple[List[Dict], List[Dict]]:
    breaking_changes = []
    warnings = []
    
    old_fields = old_schema.get("fields", {}) if isinstance(old_schema, dict) else old_schema
    new_fields = new_schema.get("fields", {}) if isinstance(new_schema, dict) else new_schema
    
    if not isinstance(old_fields, dict) or not isinstance(new_fields, dict):
        old_fields = {}
        new_fields = {}
    
    for field_name, old_field_info in old_fields.items():
        if field_name not in new_fields:
            breaking_changes.append({
                "type": "field_removed",
                "field": field_name,
                "message": f"字段 '{field_name}' 被删除",
                "severity": "critical"
            })
        else:
            new_field_info = new_fields[field_name]
            old_type = old_field_info.get("type") if isinstance(old_field_info, dict) else None
            new_type = new_field_info.get("type") if isinstance(new_field_info, dict) else None
            
            if old_type and new_type and old_type != new_type:
                breaking_changes.append({
                    "type": "type_changed",
                    "field": field_name,
                    "message": f"字段 '{field_name}' 类型从 '{old_type}' 改为 '{new_type}'",
                    "old_type": old_type,
                    "new_type": new_type,
                    "severity": "error"
                })
            
            old_required = old_field_info.get("required", False) if isinstance(old_field_info, dict) else False
            new_required = new_field_info.get("required", False) if isinstance(new_field_info, dict) else False
            
            if not old_required and new_required:
                breaking_changes.append({
                    "type": "field_became_required",
                    "field": field_name,
                    "message": f"字段 '{field_name}' 从可选变为必填",
                    "severity": "error"
                })
    
    for field_name, new_field_info in new_fields.items():
        if field_name not in old_fields:
            new_required = new_field_info.get("required", False) if isinstance(new_field_info, dict) else False
            if new_required:
                breaking_changes.append({
                    "type": "required_field_added",
                    "field": field_name,
                    "message": f"新增必填字段 '{field_name}'",
                    "severity": "error"
                })
            else:
                warnings.append({
                    "type": "optional_field_added",
                    "field": field_name,
                    "message": f"新增可选字段 '{field_name}'",
                    "severity": "warning"
                })
    
    return breaking_changes, warnings


def get_affected_consumers(db, schema_id: int, breaking_changes: List[Dict]) -> List[Dict]:
    consumers = db.query(Consumer).filter(
        Consumer.subscribed_schema_id == schema_id,
        Consumer.status == "active"
    ).all()
    
    affected_consumers = []
    for consumer in consumers:
        subscribed_fields = consumer.subscribed_fields or []
        affected_fields = []
        
        for change in breaking_changes:
            field = change.get("field")
            if field and (not subscribed_fields or field in subscribed_fields):
                affected_fields.append({
                    "field": field,
                    "change_type": change.get("type"),
                    "message": change.get("message")
                })
        
        if affected_fields:
            affected_consumers.append({
                "consumer_id": consumer.id,
                "consumer_name": consumer.name,
                "team": consumer.team,
                "email": consumer.email,
                "affected_fields": affected_fields
            })
    
    return affected_consumers


def generate_recommendations(breaking_changes: List[Dict], affected_consumers: List[Dict]) -> List[str]:
    recommendations = []
    
    if breaking_changes:
        recommendations.append("检测到破坏性变更，建议暂缓发布")
        
        critical_changes = [c for c in breaking_changes if c.get("severity") == "critical"]
        if critical_changes:
            recommendations.append(f"存在 {len(critical_changes)} 个严重破坏性变更，必须修复后才能发布")
        
        consumer_count = len(affected_consumers)
        if consumer_count > 0:
            recommendations.append(f"变更将影响 {consumer_count} 个消费者，请提前通知相关团队")
            for consumer in affected_consumers[:3]:
                recommendations.append(f"  - {consumer['consumer_name']} ({consumer.get('team', '未知团队')})")
            if consumer_count > 3:
                recommendations.append(f"  ... 还有 {consumer_count - 3} 个消费者受到影响")
    else:
        recommendations.append("未检测到破坏性变更，可以安全发布")
    
    return recommendations


def check_compatibility(db, old_schema: Dict[str, Any], new_schema: Dict[str, Any], schema_id: int = None) -> Dict[str, Any]:
    breaking_changes, warnings = compare_schemas(old_schema, new_schema)
    
    affected_consumers = []
    if schema_id and breaking_changes:
        affected_consumers = get_affected_consumers(db, schema_id, breaking_changes)
    
    recommendations = generate_recommendations(breaking_changes, affected_consumers)
    
    is_compatible = len(breaking_changes) == 0
    
    return {
        "is_compatible": is_compatible,
        "breaking_changes": breaking_changes,
        "warnings": warnings,
        "affected_consumers": affected_consumers,
        "recommendations": recommendations,
        "summary": {
            "total_breaking": len(breaking_changes),
            "total_warnings": len(warnings),
            "affected_consumer_count": len(affected_consumers)
        }
    }
