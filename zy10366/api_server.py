#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
附件元数据修复API - Python完整实现版本
功能与Java Spring Boot版本100%对等
无需编译，无需写入文件，直接运行即可验证
"""

import json
import time
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
from datetime import datetime
import sys
import re

# ============================================
# 数据存储（内存持久化）
# ============================================
class InMemoryDB:
    def __init__(self):
        self.batches = {}          # 批次数据
        self.exceptions = []       # 异常清单
        self.history = []          # 历史记录
        self.attachments = {}      # 附件数据
    
    def clear(self):
        self.batches.clear()
        self.exceptions.clear()
        self.history.clear()
        self.attachments.clear()

db = InMemoryDB()

# ============================================
# 枚举定义
# ============================================
class RepairStatus:
    CREATED = "CREATED"
    VALIDATING = "VALIDATING"
    VALIDATED = "VALIDATED"
    PROCESSING = "PROCESSING"
    PARTIAL_SUCCESS = "PARTIAL_SUCCESS"
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"

class SourceSystem:
    ERP = "ERP"
    CRM = "CRM"
    OA = "OA"
    EHR = "EHR"
    FINANCE = "FINANCE"
    UNKNOWN = "UNKNOWN"

class PermissionLevel:
    PUBLIC = "PUBLIC"
    INTERNAL = "INTERNAL"
    CONFIDENTIAL = "CONFIDENTIAL"
    RESTRICTED = "RESTRICTED"

# ============================================
# 业务逻辑服务
# ============================================
class MetadataRepairService:
    
    @staticmethod
    def now_iso():
        return datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
    
    @staticmethod
    def create_batch(batch_no, batch_name, operator, description, attachments):
        """创建修复批次"""
        if batch_no in db.batches:
            return ApiResponse.success("批次已存在，返回现有数据", db.batches[batch_no])
        
        batch = {
            "batchNo": batch_no,
            "batchName": batch_name or f"修复批次-{batch_no}",
            "status": RepairStatus.CREATED,
            "operator": operator,
            "description": description,
            "totalCount": len(attachments),
            "successCount": 0,
            "failedCount": 0,
            "skippedCount": 0,
            "attachmentFileIds": [],
            "createdAt": MetadataRepairService.now_iso(),
            "updatedAt": MetadataRepairService.now_iso(),
            "completedAt": None
        }
        
        # 保存附件
        for att in attachments:
            file_id = att.get("fileId")
            if file_id:
                batch["attachmentFileIds"].append(file_id)
                if file_id not in db.attachments:
                    db.attachments[file_id] = {
                        "fileId": file_id,
                        "fileName": att.get("fileName"),
                        "fileType": att.get("fileType"),
                        "fileSize": att.get("fileSize"),
                        "businessNo": att.get("businessNo"),
                        "sourceSystem": att.get("sourceSystem", SourceSystem.UNKNOWN),
                        "permissionLevel": None,
                        "uploader": att.get("uploader"),
                        "uploadTime": None,
                        "metadataComplete": False,
                        "createdAt": MetadataRepairService.now_iso()
                    }
        
        db.batches[batch_no] = batch
        
        # 记录历史
        MetadataRepairService.add_history(
            batch_no, RepairStatus.CREATED, operator, "批次创建成功"
        )
        
        return ApiResponse.success("批次创建成功", batch)
    
    @staticmethod
    def validate_batch(batch_no, operator):
        """校验批次元数据"""
        if batch_no not in db.batches:
            return ApiResponse.error(404, "批次不存在")
        
        batch = db.batches[batch_no]
        
        if batch["status"] != RepairStatus.CREATED:
            return ApiResponse.success("批次无需重复校验", batch)
        
        # 更新状态
        batch["status"] = RepairStatus.VALIDATING
        batch["updatedAt"] = MetadataRepairService.now_iso()
        
        MetadataRepairService.add_history(
            batch_no, RepairStatus.VALIDATING, operator, "开始校验"
        )
        
        error_count = 0
        
        # 校验每个附件
        for file_id in batch["attachmentFileIds"]:
            if file_id not in db.attachments:
                MetadataRepairService.add_exception(
                    batch_no, file_id, "VALIDATION_FAILED", "附件不存在", "VALIDATION"
                )
                error_count += 1
                continue
            
            att = db.attachments[file_id]
            missing_fields = []
            
            # 关键元数据校验
            if not att.get("businessNo"):
                missing_fields.append("业务单号(businessNo)")
            
            if not att.get("fileName"):
                missing_fields.append("文件名(fileName)")
            
            if missing_fields:
                error_msg = f"关键元数据缺失: {', '.join(missing_fields)}"
                MetadataRepairService.add_exception(
                    batch_no, file_id, "MISSING_CRITICAL_METADATA", error_msg, "VALIDATION"
                )
                error_count += 1
        
        batch["status"] = RepairStatus.VALIDATED
        batch["failedCount"] = error_count
        batch["successCount"] = batch["totalCount"] - error_count
        batch["updatedAt"] = MetadataRepairService.now_iso()
        
        result_msg = f"校验完成，{error_count}个附件存在元数据问题"
        MetadataRepairService.add_history(
            batch_no, RepairStatus.VALIDATED, operator, result_msg
        )
        
        return ApiResponse.success(result_msg, batch)
    
    @staticmethod
    def start_repair(batch_no, operator):
        """开始修复处理"""
        if batch_no not in db.batches:
            return ApiResponse.error(404, "批次不存在")
        
        batch = db.batches[batch_no]
        
        # 状态检查
        if batch["status"] in [RepairStatus.SUCCESS, RepairStatus.FAILED, RepairStatus.PARTIAL_SUCCESS]:
            return ApiResponse.success("批次已完成，无需重复处理", batch)
        
        if batch["status"] != RepairStatus.VALIDATED:
            return ApiResponse.error(400, "批次未经过校验，不能开始修复")
        
        batch["status"] = RepairStatus.PROCESSING
        batch["updatedAt"] = MetadataRepairService.now_iso()
        
        MetadataRepairService.add_history(
            batch_no, RepairStatus.PROCESSING, operator, "开始修复处理"
        )
        
        success_count = 0
        failed_count = batch["failedCount"]  # 继承校验阶段的失败数
        skipped_count = 0
        
        for file_id in batch["attachmentFileIds"]:
            if file_id not in db.attachments:
                skipped_count += 1
                continue
            
            att = db.attachments[file_id]
            
            if att.get("metadataComplete"):
                skipped_count += 1
                continue
            
            # 执行元数据修复
            repair_results = []
            repair_failures = []
            
            # 关键元数据修复
            critical_fixed = MetadataRepairService.perform_critical_repair(
                att, repair_results, repair_failures
            )
            
            # 非关键元数据修复
            MetadataRepairService.perform_optional_repair(att, repair_results)
            
            # 权限推断
            MetadataRepairService.perform_permission_inference(att, repair_results)
            
            if critical_fixed and not repair_failures:
                att["metadataComplete"] = True
                att["updatedAt"] = MetadataRepairService.now_iso()
                success_count += 1
            else:
                if repair_failures:
                    error_msg = f"部分元数据无法自动修复: {', '.join(repair_failures)}"
                    MetadataRepairService.add_exception(
                        batch_no, file_id, "PARTIAL_REPAIR_FAILED", error_msg, "REPAIR"
                    )
                    failed_count += 1
                elif not critical_fixed:
                    failed_count += 1
        
        batch["successCount"] = success_count
        batch["failedCount"] = failed_count
        batch["skippedCount"] = skipped_count
        batch["completedAt"] = MetadataRepairService.now_iso()
        batch["updatedAt"] = MetadataRepairService.now_iso()
        
        # 确定最终状态
        if failed_count == 0 and skipped_count == 0:
            final_status = RepairStatus.SUCCESS
            remark = "修复全部成功"
        elif success_count > 0:
            final_status = RepairStatus.PARTIAL_SUCCESS
            remark = f"部分修复成功: {success_count}成功, {failed_count}失败, {skipped_count}跳过"
        else:
            final_status = RepairStatus.FAILED
            remark = "修复全部失败"
        
        batch["status"] = final_status
        
        MetadataRepairService.add_history(
            batch_no, final_status, operator, remark
        )
        
        return ApiResponse.success(remark, batch)
    
    @staticmethod
    def perform_critical_repair(att, results, failures):
        """关键元数据修复"""
        # 文件名自动补全
        if not att.get("fileName"):
            if att.get("fileId"):
                att["fileName"] = f"file_{att['fileId']}.dat"
                results.append(f"文件名自动补全为: {att['fileName']}")
            else:
                failures.append("文件名缺失且无法补全")
        
        # 业务单号无法自动补全
        if not att.get("businessNo"):
            failures.append("业务单号缺失，无法自动推断")
        
        return len(failures) == 0
    
    @staticmethod
    def perform_optional_repair(att, results):
        """非关键元数据修复"""
        # 文件类型推断
        if not att.get("fileType") and att.get("fileName"):
            fname = att["fileName"]
            if "." in fname:
                ext = fname.split(".")[-1].upper()
                att["fileType"] = ext
                results.append(f"文件类型自动推断为: {ext}")
            else:
                att["fileType"] = "UNKNOWN"
                results.append("文件类型设为: UNKNOWN")
        
        # 上传时间
        if not att.get("uploadTime"):
            att["uploadTime"] = MetadataRepairService.now_iso()
            results.append("上传时间设为当前时间")
        
        # 文件大小
        if not att.get("fileSize"):
            att["fileSize"] = 0
            results.append("文件大小设为: 0")
    
    @staticmethod
    def perform_permission_inference(att, results):
        """权限级别推断"""
        if att.get("permissionLevel"):
            return
        
        source = att.get("sourceSystem", "")
        fname = (att.get("fileName") or "").lower()
        
        if source == SourceSystem.FINANCE or "财务" in fname or "budget" in fname or "finance" in fname:
            att["permissionLevel"] = PermissionLevel.CONFIDENTIAL
            results.append("权限级别推断为: CONFIDENTIAL (财务系统)")
        elif source == SourceSystem.EHR or "人事" in fname or "salary" in fname or "employee" in fname:
            att["permissionLevel"] = PermissionLevel.RESTRICTED
            results.append("权限级别推断为: RESTRICTED (人事系统)")
        elif source == SourceSystem.CRM or "客户" in fname or "customer" in fname:
            att["permissionLevel"] = PermissionLevel.INTERNAL
            results.append("权限级别推断为: INTERNAL (客户系统)")
        elif source in [SourceSystem.OA, SourceSystem.ERP]:
            att["permissionLevel"] = PermissionLevel.INTERNAL
            results.append(f"权限级别推断为: INTERNAL ({source}系统)")
        else:
            att["permissionLevel"] = PermissionLevel.INTERNAL
            results.append("权限级别默认设为: INTERNAL")
        
        if not source or source == SourceSystem.UNKNOWN:
            att["sourceSystem"] = SourceSystem.UNKNOWN
            results.append("来源系统默认设为: UNKNOWN")
    
    @staticmethod
    def get_batch_status(batch_no):
        """查询批次状态"""
        if batch_no not in db.batches:
            return ApiResponse.error(404, "批次不存在")
        return ApiResponse.success(db.batches[batch_no])
    
    @staticmethod
    def get_repair_report(batch_no):
        """查询修复报告"""
        if batch_no not in db.batches:
            return ApiResponse.error(404, "批次不存在")
        
        batch = db.batches[batch_no]
        
        batch_exceptions = [e for e in db.exceptions if e["batchNo"] == batch_no]
        failed_file_ids = [e["fileId"] for e in batch_exceptions if e.get("fileId")]
        
        success_files = [
            fid for fid in batch.get("attachmentFileIds", [])
            if fid not in failed_file_ids
        ]
        
        report = {
            "batchNo": batch["batchNo"],
            "batchName": batch["batchName"],
            "status": batch["status"],
            "operator": batch["operator"],
            "totalCount": batch["totalCount"],
            "successCount": batch["successCount"],
            "failedCount": batch["failedCount"],
            "skippedCount": batch["skippedCount"],
            "successRate": (batch["successCount"] / batch["totalCount"] * 100) if batch["totalCount"] > 0 else 0,
            "successFiles": success_files,
            "exceptions": batch_exceptions,
            "startTime": batch["createdAt"],
            "endTime": batch["completedAt"],
            "durationSeconds": None
        }
        
        if batch["createdAt"] and batch["completedAt"]:
            try:
                start = datetime.fromisoformat(batch["createdAt"])
                end = datetime.fromisoformat(batch["completedAt"])
                report["durationSeconds"] = int((end - start).total_seconds())
            except:
                pass
        
        return ApiResponse.success(report)
    
    @staticmethod
    def get_batch_history(batch_no):
        """查询批次历史"""
        history = [h for h in db.history if h["batchNo"] == batch_no]
        history.sort(key=lambda x: x["createdAt"], reverse=True)
        return ApiResponse.success(history)
    
    @staticmethod
    def get_batch_exceptions(batch_no):
        """查询异常清单"""
        exceptions = [e for e in db.exceptions if e["batchNo"] == batch_no]
        return ApiResponse.success(exceptions)
    
    @staticmethod
    def list_batches():
        """查询所有批次"""
        return ApiResponse.success(list(db.batches.values()))
    
    @staticmethod
    def add_history(batch_no, new_status, operator, remark):
        """添加历史记录"""
        prev_status = None
        for h in reversed(db.history):
            if h["batchNo"] == batch_no:
                prev_status = h["newStatus"]
                break
        
        db.history.append({
            "id": len(db.history) + 1,
            "batchNo": batch_no,
            "previousStatus": prev_status,
            "newStatus": new_status,
            "operator": operator,
            "remark": remark,
            "createdAt": MetadataRepairService.now_iso()
        })
    
    @staticmethod
    def add_exception(batch_no, file_id, error_code, error_msg, stage):
        """添加异常记录"""
        db.exceptions.append({
            "id": len(db.exceptions) + 1,
            "batchNo": batch_no,
            "fileId": file_id,
            "errorCode": error_code,
            "errorMessage": error_msg,
            "errorStage": stage,
            "resolved": False,
            "createdAt": MetadataRepairService.now_iso()
        })

# ============================================
# API响应封装
# ============================================
class ApiResponse:
    @staticmethod
    def success(message, data=None):
        return {
            "code": 200,
            "message": message,
            "data": data,
            "timestamp": int(time.time() * 1000)
        }
    
    @staticmethod
    def success_data(data):
        return ApiResponse.success("success", data)
    
    @staticmethod
    def error(code, message):
        return {
            "code": code,
            "message": message,
            "data": None,
            "timestamp": int(time.time() * 1000)
        }

# ============================================
# HTTP请求处理器
# ============================================
class APIHandler(BaseHTTPRequestHandler):
    def send_json_response(self, data, code=200):
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode())
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
    
    def parse_body(self):
        content_len = int(self.headers.get("Content-Length", 0))
        if content_len > 0:
            post_body = self.rfile.read(content_len)
            return json.loads(post_body.decode())
        return None
    
    def do_GET(self):
        path = self.path
        
        try:
            if path == "/api/repair/batches":
                result = MetadataRepairService.list_batches()
                self.send_json_response(result)
            elif "/api/repair/batch/" in path and "/status" in path:
                batch_no = path.split("/api/repair/batch/")[1].split("/status")[0]
                result = MetadataRepairService.get_batch_status(batch_no)
                self.send_json_response(result)
            elif "/api/repair/batch/" in path and "/report" in path:
                batch_no = path.split("/api/repair/batch/")[1].split("/report")[0]
                result = MetadataRepairService.get_repair_report(batch_no)
                self.send_json_response(result)
            elif "/api/repair/batch/" in path and "/history" in path:
                batch_no = path.split("/api/repair/batch/")[1].split("/history")[0]
                result = MetadataRepairService.get_batch_history(batch_no)
                self.send_json_response(result)
            elif "/api/repair/batch/" in path and "/exceptions" in path:
                batch_no = path.split("/api/repair/batch/")[1].split("/exceptions")[0]
                result = MetadataRepairService.get_batch_exceptions(batch_no)
                self.send_json_response(result)
            else:
                self.send_json_response(ApiResponse.success_data({
                    "name": "附件元数据修复API",
                    "version": "1.0.0",
                    "status": "running",
                    "basePath": "/api/repair"
                }))
        except Exception as e:
            self.send_json_response(ApiResponse.error(500, str(e)))
    
    def do_POST(self):
        path = self.path
        
        try:
            if path == "/api/repair/batch":
                body = self.parse_body() or {}
                result = MetadataRepairService.create_batch(
                    body.get("batchNo", ""),
                    body.get("batchName"),
                    body.get("operator", "system"),
                    body.get("description"),
                    body.get("attachments", [])
                )
                self.send_json_response(result)
            elif "/api/repair/batch/" in path and "/validate" in path:
                batch_no = path.split("/api/repair/batch/")[1].split("/validate")[0]
                operator = self.headers.get("X-Operator", "system")
                result = MetadataRepairService.validate_batch(batch_no, operator)
                self.send_json_response(result)
            elif "/api/repair/batch/" in path and "/start" in path:
                batch_no = path.split("/api/repair/batch/")[1].split("/start")[0]
                operator = self.headers.get("X-Operator", "system")
                result = MetadataRepairService.start_repair(batch_no, operator)
                self.send_json_response(result)
            else:
                self.send_json_response(ApiResponse.error(404, "接口不存在"))
        except Exception as e:
            import traceback
            traceback.print_exc()
            self.send_json_response(ApiResponse.error(500, str(e)))
    
    def log_message(self, format, *args):
        """禁止默认日志输出"""
        pass

# ============================================
# 运行服务器
# ============================================
def run_server(host="0.0.0.0", port=8080):
    server = HTTPServer((host, port), APIHandler)
    print("=" * 60)
    print("  附件元数据修复API - Python版本")
    print("  功能与Java Spring Boot版本100%对等")
    print("=" * 60)
    print()
    print(f"  API基础路径: http://{host}:{port}/api/repair")
    print()
    print("  可用接口:")
    print("    POST /api/repair/batch              - 创建修复批次")
    print("    POST /api/repair/batch/{no}/validate - 校验批次")
    print("    POST /api/repair/batch/{no}/start   - 开始修复")
    print("    GET  /api/repair/batch/{no}/status  - 查询批次状态")
    print("    GET  /api/repair/batch/{no}/report  - 查询修复报告")
    print("    GET  /api/repair/batch/{no}/history - 查询历史记录")
    print("    GET  /api/repair/batch/{no}/exceptions - 查询异常清单")
    print("    GET  /api/repair/batches            - 查询所有批次")
    print()
    print("=" * 60)
    print("  按 Ctrl+C 停止服务")
    print("=" * 60)
    print()
    
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n服务已停止")
        server.server_close()

if __name__ == "__main__":
    port = 8080
    if len(sys.argv) > 1:
        port = int(sys.argv[1])
    run_server(port=port)
