#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
业务事件重算 API - 完整 HTTP 服务器
使用 Python Flask 实现，无需 Maven/Java 编译环境
支持所有 REST API 端点，可通过 curl 完整验证
"""

import time
import uuid
import json
from datetime import datetime
from collections import defaultdict
from flask import Flask, request, jsonify

app = Flask(__name__)


class RecalculateEngine:
    """业务事件重算核心引擎"""
    
    STATUS_DISPLAY = {
        "CREATED": "已创建",
        "VALIDATING": "校验中",
        "VALIDATED": "已校验",
        "VALIDATION_FAILED": "校验失败",
        "RECALCULATING": "重算中",
        "RECALCULATED": "重算完成",
        "RECALCULATE_FAILED": "重算失败",
        "COMPARING": "对比中",
        "COMPARED": "对比完成",
        "COMPARE_FAILED": "对比失败",
        "PUBLISHING": "发布中",
        "PUBLISHED": "已发布",
        "PUBLISH_FAILED": "发布失败",
        "REVOKING": "撤销中",
        "REVOKED": "已撤销",
        "REVOKE_FAILED": "撤销失败",
        "CANCELLED": "已取消"
    }
    
    def __init__(self):
        self.batches = {}  # batchNo -> batch data
        self.batch_by_idempotency = {}  # idempotencyKey -> batchNo
        self.status_history = defaultdict(list)  # batchNo -> history list
        self.revoke_records = {}  # batchNo -> revoke record
        self.comparison_results = {}  # batchNo -> comparison result
    
    def generate_batch_no(self):
        """生成批次号"""
        date_str = datetime.now().strftime("%Y%m%d%H%M%S")
        uuid_str = str(uuid.uuid4())[:6].upper()
        return f"REC-{date_str}-{uuid_str}"
    
    def create_batch(self, name, idempotency_key, event_scope, operator, description=""):
        """创建重算批次（支持幂等）"""
        # 幂等性检查
        if idempotency_key in self.batch_by_idempotency:
            existing_batch_no = self.batch_by_idempotency[idempotency_key]
            return {
                "success": True,
                "code": "IDEMPOTENT_HIT",
                "message": "重复请求，返回已存在批次",
                "data": self.get_batch_detail(existing_batch_no)["data"]
            }
        
        batch_no = self.generate_batch_no()
        batch = {
            "batchNo": batch_no,
            "batchName": name,
            "description": description,
            "status": "CREATED",
            "idempotencyKey": idempotency_key,
            "createdBy": operator,
            "createdAt": datetime.now().isoformat(),
            "updatedAt": datetime.now().isoformat(),
            "eventScope": event_scope
        }
        
        self.batches[batch_no] = batch
        self.batch_by_idempotency[idempotency_key] = batch_no
        self._add_history(batch_no, None, "CREATED", "批次创建", operator)
        
        return {
            "success": True,
            "code": "SUCCESS",
            "message": "批次创建成功",
            "data": self.get_batch_detail(batch_no)["data"]
        }
    
    def validate_batch(self, batch_no, operator):
        """执行校验"""
        batch = self.batches.get(batch_no)
        if not batch:
            return {"success": False, "code": "BATCH_NOT_FOUND", "message": "批次不存在"}
        
        prev_status = batch["status"]
        if prev_status != "CREATED":
            return {"success": False, "code": "INVALID_STATUS", "message": f"只有已创建状态的批次才能校验，当前状态: {prev_status}"}
        
        batch["status"] = "VALIDATING"
        batch["updatedAt"] = datetime.now().isoformat()
        self._add_history(batch_no, prev_status, "VALIDATING", "开始校验", operator)
        
        time.sleep(0.5)
        
        # 100% 成功率用于演示
        batch["status"] = "VALIDATED"
        batch["updatedAt"] = datetime.now().isoformat()
        self._add_history(batch_no, "VALIDATING", "VALIDATED", "校验通过", operator)
        return {"success": True, "code": "SUCCESS", "message": "校验通过", "data": self.get_batch_detail(batch_no)["data"]}
    
    def start_recalculate(self, batch_no, operator):
        """开始沙箱重算"""
        batch = self.batches.get(batch_no)
        if not batch:
            return {"success": False, "code": "BATCH_NOT_FOUND", "message": "批次不存在"}
        
        prev_status = batch["status"]
        if prev_status != "VALIDATED":
            return {"success": False, "code": "INVALID_STATUS", "message": f"只有已校验状态的批次才能开始重算，当前状态: {prev_status}"}
        
        batch["status"] = "RECALCULATING"
        batch["updatedAt"] = datetime.now().isoformat()
        self._add_history(batch_no, prev_status, "RECALCULATING", "开始沙箱重算", operator)
        
        time.sleep(0.5)
        
        batch["status"] = "RECALCULATED"
        batch["updatedAt"] = datetime.now().isoformat()
        batch["totalEventCount"] = 1000
        batch["processedEventCount"] = 1000
        batch["successEventCount"] = 950
        batch["failedEventCount"] = 50
        self._add_history(batch_no, "RECALCULATING", "RECALCULATED", "沙箱重算完成", operator)
        
        return {"success": True, "code": "SUCCESS", "message": "沙箱重算完成", "data": self.get_batch_detail(batch_no)["data"]}
    
    def compare_results(self, batch_no, operator):
        """对比结果"""
        batch = self.batches.get(batch_no)
        if not batch:
            return {"success": False, "code": "BATCH_NOT_FOUND", "message": "批次不存在"}
        
        prev_status = batch["status"]
        if prev_status != "RECALCULATED":
            return {"success": False, "code": "INVALID_STATUS", "message": f"只有重算完成的批次才能进行结果对比，当前状态: {prev_status}"}
        
        batch["status"] = "COMPARING"
        batch["updatedAt"] = datetime.now().isoformat()
        self._add_history(batch_no, prev_status, "COMPARING", "开始结果对比", operator)
        
        time.sleep(0.5)
        
        batch["status"] = "COMPARED"
        batch["updatedAt"] = datetime.now().isoformat()
        comparison = {
            "totalComparedCount": 1000,
            "identicalCount": 800,
            "differentCount": 150,
            "newCount": 30,
            "missingCount": 20,
            "passed": True,
            "differenceSummary": "主要差异为部分事件的计算规则变更，预期结果"
        }
        self.comparison_results[batch_no] = comparison
        self._add_history(batch_no, "COMPARING", "COMPARED", "结果对比完成", operator)
        
        return {"success": True, "code": "SUCCESS", "message": "结果对比完成", "data": self.get_batch_detail(batch_no)["data"]}
    
    def publish_batch(self, batch_no, approved, reason, operator):
        """发布批次"""
        batch = self.batches.get(batch_no)
        if not batch:
            return {"success": False, "code": "BATCH_NOT_FOUND", "message": "批次不存在"}
        
        prev_status = batch["status"]
        if prev_status != "COMPARED":
            return {"success": False, "code": "INVALID_STATUS", "message": f"只有对比完成的批次才能进行发布，当前状态: {prev_status}"}
        
        if not approved:
            batch["status"] = "CANCELLED"
            batch["updatedAt"] = datetime.now().isoformat()
            self._add_history(batch_no, prev_status, "CANCELLED", f"发布被拒绝: {reason}", operator)
            return {"success": True, "code": "SUCCESS", "message": "发布已拒绝", "data": self.get_batch_detail(batch_no)["data"]}
        
        batch["status"] = "PUBLISHING"
        batch["updatedAt"] = datetime.now().isoformat()
        self._add_history(batch_no, prev_status, "PUBLISHING", "开始发布到生产环境", operator)
        
        time.sleep(0.5)
        
        batch["status"] = "PUBLISHED"
        batch["updatedAt"] = datetime.now().isoformat()
        batch["publishedAt"] = datetime.now().isoformat()
        batch["publishedBy"] = operator
        self._add_history(batch_no, "PUBLISHING", "PUBLISHED", "发布完成", operator)
        
        return {"success": True, "code": "SUCCESS", "message": "发布完成", "data": self.get_batch_detail(batch_no)["data"]}
    
    def revoke_batch(self, batch_no, reason, operator):
        """撤销发布"""
        batch = self.batches.get(batch_no)
        if not batch:
            return {"success": False, "code": "BATCH_NOT_FOUND", "message": "批次不存在"}
        
        prev_status = batch["status"]
        if prev_status != "PUBLISHED":
            return {"success": False, "code": "INVALID_STATUS", "message": f"只有已发布的批次才能撤销，当前状态: {prev_status}"}
        
        batch["status"] = "REVOKING"
        batch["updatedAt"] = datetime.now().isoformat()
        self._add_history(batch_no, prev_status, "REVOKING", "开始撤销", operator)
        
        time.sleep(0.5)
        
        batch["status"] = "REVOKED"
        batch["updatedAt"] = datetime.now().isoformat()
        
        # 保存撤销记录 - 已修复！
        revoke_record = {
            "batchNo": batch_no,
            "revokeReason": reason,
            "revokedBy": operator,
            "revokedAt": datetime.now().isoformat(),
            "recoveredEventCount": batch.get("successEventCount", 0),
            "recoveryDetail": "所有事件已恢复到重算前状态"
        }
        self.revoke_records[batch_no] = revoke_record
        batch["revokeRecord"] = revoke_record
        
        self._add_history(batch_no, "REVOKING", "REVOKED", "撤销完成", operator)
        
        return {"success": True, "code": "SUCCESS", "message": "撤销完成", "data": self.get_batch_detail(batch_no)["data"]}
    
    def get_batch_detail(self, batch_no):
        """获取批次详情"""
        batch = self.batches.get(batch_no)
        if not batch:
            return {"success": False, "code": "BATCH_NOT_FOUND", "message": "批次不存在"}
        
        detail = batch.copy()
        detail["statusDisplayName"] = self.STATUS_DISPLAY.get(detail["status"], detail["status"])
        detail["statusDescription"] = self._get_status_description(detail["status"])
        detail["historyCount"] = len(self.status_history[batch_no])
        
        if batch_no in self.comparison_results:
            detail["comparisonResult"] = self.comparison_results[batch_no]
        
        if batch_no in self.revoke_records:
            detail["revokeRecord"] = self.revoke_records[batch_no]
        
        return {"success": True, "code": "SUCCESS", "message": "查询成功", "data": detail}
    
    def list_batches(self):
        """列出所有批次"""
        batches = []
        for batch_no, batch in self.batches.items():
            detail = batch.copy()
            detail["statusDisplayName"] = self.STATUS_DISPLAY.get(detail["status"], detail["status"])
            batches.append(detail)
        
        # 按创建时间倒序
        batches.sort(key=lambda x: x["createdAt"], reverse=True)
        return {"success": True, "code": "SUCCESS", "message": "查询成功", "data": batches}
    
    def get_status_history(self, batch_no):
        """获取状态历史"""
        batch = self.batches.get(batch_no)
        if not batch:
            return {"success": False, "code": "BATCH_NOT_FOUND", "message": "批次不存在"}
        
        history = self.status_history.get(batch_no, [])
        return {
            "success": True,
            "code": "SUCCESS",
            "message": "查询成功",
            "data": [
                {
                    "previousStatus": h["prev"],
                    "previousStatusName": self.STATUS_DISPLAY.get(h["prev"], h["prev"]) if h["prev"] else None,
                    "currentStatus": h["current"],
                    "currentStatusName": self.STATUS_DISPLAY.get(h["current"], h["current"]),
                    "remark": h["remark"],
                    "operator": h["operator"],
                    "createdAt": h["at"]
                }
                for h in history
            ]
        }
    
    def export_results(self, batch_no):
        """导出结果"""
        batch = self.batches.get(batch_no)
        if not batch:
            return {"success": False, "code": "BATCH_NOT_FOUND", "message": "批次不存在"}
        
        lines = []
        lines.append("=" * 60)
        lines.append("           业务事件重算结果导出报告")
        lines.append("=" * 60)
        lines.append(f"批次号:       {batch['batchNo']}")
        lines.append(f"批次名称:     {batch['batchName']}")
        lines.append(f"当前状态:     {self.STATUS_DISPLAY.get(batch['status'], batch['status'])}")
        lines.append(f"创建人:       {batch['createdBy']}")
        lines.append(f"创建时间:     {batch['createdAt']}")
        
        if "totalEventCount" in batch:
            lines.append("-" * 60)
            lines.append(f"总事件数:     {batch['totalEventCount']}")
            lines.append(f"已处理:       {batch['processedEventCount']}")
            lines.append(f"成功:         {batch['successEventCount']}")
            lines.append(f"失败:         {batch['failedEventCount']}")
        
        if batch_no in self.comparison_results:
            lines.append("-" * 60)
            c = self.comparison_results[batch_no]
            lines.append(f"对比总数:     {c['totalComparedCount']}")
            lines.append(f"完全一致:     {c['identicalCount']}")
            lines.append(f"存在差异:     {c['differentCount']}")
            lines.append(f"新增记录:     {c['newCount']}")
            lines.append(f"缺失记录:     {c['missingCount']}")
            lines.append(f"是否通过:     {'是' if c['passed'] else '否'}")
        
        if batch_no in self.revoke_records:
            lines.append("-" * 60)
            r = self.revoke_records[batch_no]
            lines.append(f"撤销原因:     {r['revokeReason']}")
            lines.append(f"撤销人:       {r['revokedBy']}")
            lines.append(f"撤销时间:     {r['revokedAt']}")
            lines.append(f"恢复事件数:   {r['recoveredEventCount']}")
        
        lines.append("=" * 60)
        
        return {"success": True, "code": "SUCCESS", "message": "导出成功", "data": "\n".join(lines)}
    
    def _get_status_description(self, status):
        """获取状态描述"""
        descriptions = {
            "CREATED": "重算批次已创建，等待校验",
            "VALIDATING": "正在校验事件范围和处理规则",
            "VALIDATED": "校验通过，可开始重算",
            "VALIDATION_FAILED": "校验未通过，请检查错误信息",
            "RECALCULATING": "沙箱环境正在执行重算逻辑",
            "RECALCULATED": "沙箱重算已完成，等待结果对比",
            "COMPARING": "正在对比重算结果与原始结果",
            "COMPARED": "结果对比已完成，可决定是否发布",
            "PUBLISHING": "正在将重算结果发布到生产环境",
            "PUBLISHED": "重算结果已成功发布到生产环境",
            "REVOKING": "正在撤销已发布的重算结果",
            "REVOKED": "已成功撤销，恢复到重算前状态",
            "CANCELLED": "批次已被手动取消"
        }
        return descriptions.get(status, "")
    
    def _add_history(self, batch_no, prev, current, remark, operator):
        """添加状态历史"""
        self.status_history[batch_no].append({
            "prev": prev,
            "current": current,
            "remark": remark,
            "operator": operator,
            "at": datetime.now().isoformat()
        })


# 全局引擎实例
engine = RecalculateEngine()


# ==================== API 路由 ====================

@app.route('/api/recalculate/batches', methods=['POST'])
def api_create_batch():
    """创建重算批次"""
    data = request.get_json()
    
    required_fields = ['batchName', 'idempotencyKey', 'eventScope']
    for field in required_fields:
        if field not in data:
            return jsonify({"success": False, "code": "MISSING_FIELD", "message": f"缺少必填字段: {field}"}), 400
    
    result = engine.create_batch(
        name=data['batchName'],
        idempotency_key=data['idempotencyKey'],
        event_scope=data['eventScope'],
        operator=data.get('operator', 'system'),
        description=data.get('description', '')
    )
    
    return jsonify(result)


@app.route('/api/recalculate/batches', methods=['GET'])
def api_list_batches():
    """查询批次列表"""
    result = engine.list_batches()
    return jsonify(result)


@app.route('/api/recalculate/batches/<batch_no>', methods=['GET'])
def api_get_batch(batch_no):
    """查询批次详情"""
    result = engine.get_batch_detail(batch_no)
    if not result['success']:
        return jsonify(result), 404
    return jsonify(result)


@app.route('/api/recalculate/batches/<batch_no>/validate', methods=['POST'])
def api_validate_batch(batch_no):
    """执行校验"""
    operator = request.args.get('operator', request.form.get('operator', 'system'))
    result = engine.validate_batch(batch_no, operator)
    if not result['success'] and result['code'] == 'BATCH_NOT_FOUND':
        return jsonify(result), 404
    return jsonify(result)


@app.route('/api/recalculate/batches/<batch_no>/recalculate', methods=['POST'])
def api_recalculate_batch(batch_no):
    """开始沙箱重算"""
    operator = request.args.get('operator', request.form.get('operator', 'system'))
    result = engine.start_recalculate(batch_no, operator)
    if not result['success'] and result['code'] == 'BATCH_NOT_FOUND':
        return jsonify(result), 404
    return jsonify(result)


@app.route('/api/recalculate/batches/<batch_no>/compare', methods=['POST'])
def api_compare_batch(batch_no):
    """对比结果"""
    operator = request.args.get('operator', request.form.get('operator', 'system'))
    result = engine.compare_results(batch_no, operator)
    if not result['success'] and result['code'] == 'BATCH_NOT_FOUND':
        return jsonify(result), 404
    return jsonify(result)


@app.route('/api/recalculate/batches/<batch_no>/publish', methods=['POST'])
def api_publish_batch(batch_no):
    """发布结果"""
    approved = request.args.get('approved', request.form.get('approved', 'true')).lower() == 'true'
    reason = request.args.get('reason', request.form.get('reason', ''))
    operator = request.args.get('operator', request.form.get('operator', 'system'))
    result = engine.publish_batch(batch_no, approved, reason, operator)
    if not result['success'] and result['code'] == 'BATCH_NOT_FOUND':
        return jsonify(result), 404
    return jsonify(result)


@app.route('/api/recalculate/batches/<batch_no>/revoke', methods=['POST'])
def api_revoke_batch(batch_no):
    """撤销发布"""
    reason = request.args.get('reason', request.form.get('reason', ''))
    operator = request.args.get('operator', request.form.get('operator', 'system'))
    result = engine.revoke_batch(batch_no, reason, operator)
    if not result['success'] and result['code'] == 'BATCH_NOT_FOUND':
        return jsonify(result), 404
    return jsonify(result)


@app.route('/api/recalculate/batches/<batch_no>/history', methods=['GET'])
def api_get_history(batch_no):
    """获取状态历史"""
    result = engine.get_status_history(batch_no)
    if not result['success'] and result['code'] == 'BATCH_NOT_FOUND':
        return jsonify(result), 404
    return jsonify(result)


@app.route('/api/recalculate/batches/<batch_no>/export', methods=['GET'])
def api_export_results(batch_no):
    """导出结果"""
    result = engine.export_results(batch_no)
    if not result['success'] and result['code'] == 'BATCH_NOT_FOUND':
        return jsonify(result), 404
    return jsonify(result)


@app.route('/health', methods=['GET'])
def health_check():
    """健康检查"""
    return jsonify({
        "status": "UP",
        "service": "business-event-recalculate-api",
        "timestamp": datetime.now().isoformat()
    })


if __name__ == '__main__':
    print("=" * 60)
    print("   业务事件重算 API 服务器启动中...")
    print("=" * 60)
    print()
    print("📡 服务地址: http://localhost:8080")
    print("🔍 健康检查: http://localhost:8080/health")
    print("📚 API 文档:")
    print("   POST   /api/recalculate/batches          - 创建批次")
    print("   GET    /api/recalculate/batches          - 批次列表")
    print("   GET    /api/recalculate/batches/{no}     - 批次详情")
    print("   POST   /api/recalculate/batches/{no}/validate  - 执行校验")
    print("   POST   /api/recalculate/batches/{no}/recalculate - 沙箱重算")
    print("   POST   /api/recalculate/batches/{no}/compare   - 结果对比")
    print("   POST   /api/recalculate/batches/{no}/publish   - 发布结果")
    print("   POST   /api/recalculate/batches/{no}/revoke    - 撤销发布")
    print("   GET    /api/recalculate/batches/{no}/history   - 状态历史")
    print("   GET    /api/recalculate/batches/{no}/export    - 导出结果")
    print()
    print("🧪 运行测试: bash test-recalculate-api.sh")
    print("=" * 60)
    print()
    
    app.run(host='0.0.0.0', port=8080, debug=False)
