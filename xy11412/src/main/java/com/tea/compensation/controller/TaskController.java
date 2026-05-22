package com.tea.compensation.controller;

import com.tea.compensation.dto.*;
import com.tea.compensation.entity.CompensationTask;
import com.tea.compensation.entity.OperationLog;
import com.tea.compensation.enums.TaskStatus;
import com.tea.compensation.service.CompensationTaskService;
import com.tea.compensation.service.ExportService;
import com.tea.compensation.service.OperationLogService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpServletRequest;
import javax.validation.Valid;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/tasks")
@RequiredArgsConstructor
public class TaskController {

    private final CompensationTaskService taskService;
    private final OperationLogService operationLogService;
    private final ExportService exportService;

    @PostMapping
    public Result<CompensationTask> submitTask(
            @Valid @RequestBody TaskSubmitDTO dto,
            @RequestHeader(value = "X-User-Id", defaultValue = "system") String userId,
            @RequestHeader(value = "X-User-Name", defaultValue = "系统用户") String userName,
            HttpServletRequest request
    ) {
        String ipAddress = getClientIp(request);
        CompensationTask task = taskService.submitTask(dto, userId, userName, ipAddress);
        return Result.success("提交成功", task);
    }

    @GetMapping("/{id}")
    public Result<CompensationTask> getTaskById(@PathVariable Long id) {
        CompensationTask task = taskService.getTaskById(id);
        return Result.success(task);
    }

    @GetMapping("/batch/{batchNo}")
    public Result<CompensationTask> getTaskByBatchNo(@PathVariable String batchNo) {
        CompensationTask task = taskService.getTaskByBatchNo(batchNo);
        return Result.success(task);
    }

    @GetMapping("/{id}/detail")
    public Result<TaskDetailVO> getTaskDetail(@PathVariable Long id) {
        TaskDetailVO detail = taskService.getTaskDetail(id);
        return Result.success(detail);
    }

    @PostMapping("/query")
    public Result<Page<CompensationTask>> queryTasks(@RequestBody TaskQueryDTO dto) {
        Page<CompensationTask> page = taskService.queryTasks(dto);
        return Result.success(page);
    }

    @PostMapping("/{id}/cancel")
    public Result<CompensationTask> cancelTask(
            @PathVariable Long id,
            @RequestParam(required = false) String remark,
            @RequestHeader(value = "X-User-Id", defaultValue = "system") String userId,
            @RequestHeader(value = "X-User-Name", defaultValue = "系统用户") String userName,
            HttpServletRequest request
    ) {
        String ipAddress = getClientIp(request);
        CompensationTask task = taskService.cancelTask(id, userId, userName, remark, ipAddress);
        return Result.success("取消成功", task);
    }

    @PostMapping("/{id}/freeze")
    public Result<CompensationTask> freezeTask(
            @PathVariable Long id,
            @RequestParam String reason,
            @RequestHeader(value = "X-User-Id", defaultValue = "system") String userId,
            @RequestHeader(value = "X-User-Name", defaultValue = "系统用户") String userName,
            HttpServletRequest request
    ) {
        String ipAddress = getClientIp(request);
        CompensationTask task = taskService.freezeTask(id, userId, userName, reason, ipAddress);
        return Result.success("冻结成功", task);
    }

    @PostMapping("/{id}/unfreeze")
    public Result<CompensationTask> unfreezeTask(
            @PathVariable Long id,
            @RequestHeader(value = "X-User-Id", defaultValue = "system") String userId,
            @RequestHeader(value = "X-User-Name", defaultValue = "系统用户") String userName,
            HttpServletRequest request
    ) {
        String ipAddress = getClientIp(request);
        CompensationTask task = taskService.unfreezeTask(id, userId, userName, ipAddress);
        return Result.success("解冻成功", task);
    }

    @PostMapping("/{id}/manual-takeover")
    public Result<CompensationTask> manualTakeOver(
            @PathVariable Long id,
            @RequestParam(required = false) String remark,
            @RequestHeader(value = "X-User-Id", defaultValue = "system") String userId,
            @RequestHeader(value = "X-User-Name", defaultValue = "系统用户") String userName,
            HttpServletRequest request
    ) {
        String ipAddress = getClientIp(request);
        CompensationTask task = taskService.manualTakeOver(id, userId, userName, remark, ipAddress);
        return Result.success("人工接管成功", task);
    }

    @PostMapping("/{id}/compensate")
    public Result<CompensationTask> compensate(
            @PathVariable Long id,
            @RequestParam(required = false) String remark,
            @RequestHeader(value = "X-User-Id", defaultValue = "system") String userId,
            @RequestHeader(value = "X-User-Name", defaultValue = "系统用户") String userName,
            HttpServletRequest request
    ) {
        String ipAddress = getClientIp(request);
        CompensationTask task = taskService.compensate(id, userId, userName, remark, ipAddress);
        return Result.success("补偿入账成功", task);
    }

    @PostMapping("/{id}/close")
    public Result<CompensationTask> closeTask(
            @PathVariable Long id,
            @RequestParam(required = false) String remark,
            @RequestHeader(value = "X-User-Id", defaultValue = "system") String userId,
            @RequestHeader(value = "X-User-Name", defaultValue = "系统用户") String userName,
            HttpServletRequest request
    ) {
        String ipAddress = getClientIp(request);
        CompensationTask task = taskService.closeTask(id, userId, userName, remark, ipAddress);
        return Result.success("关闭成功", task);
    }

    @PostMapping("/{id}/judge")
    public Result<CompensationTask> judgeStatus(
            @PathVariable Long id,
            @RequestParam TaskStatus newStatus,
            @RequestParam(required = false) String remark,
            @RequestHeader(value = "X-User-Id", defaultValue = "system") String userId,
            @RequestHeader(value = "X-User-Name", defaultValue = "系统用户") String userName,
            HttpServletRequest request
    ) {
        String ipAddress = getClientIp(request);
        CompensationTask task = taskService.judgeStatus(id, newStatus, userId, userName, remark, ipAddress);
        return Result.success("改判成功", task);
    }

    @PostMapping("/{id}/retry")
    public Result<CompensationTask> retryTask(
            @PathVariable Long id,
            @RequestHeader(value = "X-User-Id", defaultValue = "system") String userId,
            @RequestHeader(value = "X-User-Name", defaultValue = "系统用户") String userName,
            HttpServletRequest request
    ) {
        CompensationTask task = taskService.getTaskById(id);
        task = taskService.retryTask(task);
        return Result.success("重试成功", task);
    }

    @GetMapping("/{id}/logs")
    public Result<List<OperationLog>> getTaskLogs(@PathVariable Long id) {
        List<OperationLog> logs = operationLogService.getLogsByTaskId(id);
        return Result.success(logs);
    }

    @GetMapping("/batch/{batchNo}/logs")
    public Result<List<OperationLog>> getTaskLogsByBatchNo(@PathVariable String batchNo) {
        List<OperationLog> logs = operationLogService.getLogsByBatchNo(batchNo);
        return Result.success(logs);
    }

    @GetMapping("/{id}/export")
    public ResponseEntity<byte[]> exportTask(
            @PathVariable Long id,
            @RequestHeader(value = "X-User-Id", defaultValue = "system") String userId,
            @RequestHeader(value = "X-User-Name", defaultValue = "系统用户") String userName,
            HttpServletRequest request
    ) {
        String ipAddress = getClientIp(request);
        byte[] data = exportService.exportTask(id, userId, userName, ipAddress);
        
        String fileName = "task_export_" + id + "_" + System.currentTimeMillis() + ".xlsx";
        String encodedFileName = URLEncoder.encode(fileName, StandardCharsets.UTF_8);
        
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename*=UTF-8''" + encodedFileName)
                .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(data);
    }

    @PostMapping("/export/batch")
    public ResponseEntity<byte[]> exportBatchTasks(
            @RequestBody List<Long> taskIds,
            @RequestHeader(value = "X-User-Id", defaultValue = "system") String userId,
            @RequestHeader(value = "X-User-Name", defaultValue = "系统用户") String userName,
            HttpServletRequest request
    ) {
        String ipAddress = getClientIp(request);
        byte[] data = exportService.exportBatchTasks(taskIds, userId, userName, ipAddress);
        
        String fileName = "batch_export_" + System.currentTimeMillis() + ".xlsx";
        String encodedFileName = URLEncoder.encode(fileName, StandardCharsets.UTF_8);
        
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename*=UTF-8''" + encodedFileName)
                .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(data);
    }

    @GetMapping("/{id}/validate")
    public Result<Boolean> validateConsistency(@PathVariable Long id) {
        boolean valid = taskService.validateDataConsistency(id);
        return Result.success(valid ? "数据一致" : "数据不一致", valid);
    }

    private String getClientIp(HttpServletRequest request) {
        String ip = request.getHeader("X-Forwarded-For");
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getHeader("X-Real-IP");
        }
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getRemoteAddr();
        }
        return ip.split(",")[0].trim();
    }
}
