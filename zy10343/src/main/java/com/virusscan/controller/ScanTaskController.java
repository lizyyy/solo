package com.virusscan.controller;

import com.virusscan.dto.ApiResponse;
import com.virusscan.dto.CreateScanTaskRequest;
import com.virusscan.dto.TaskStatusUpdateRequest;
import com.virusscan.entity.FailureReason;
import com.virusscan.entity.NotificationRecord;
import com.virusscan.entity.ScanTask;
import com.virusscan.enums.TaskStatus;
import com.virusscan.service.ScanTaskService;
import javax.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/scan-tasks")
@RequiredArgsConstructor
public class ScanTaskController {

    private final ScanTaskService scanTaskService;

    @PostMapping
    public ResponseEntity<ApiResponse<ScanTask>> createScanTask(
            @Valid @RequestBody CreateScanTaskRequest request) {
        log.info("创建扫描任务: fileId={}, fileName={}", request.getFileId(), request.getFileName());
        ScanTask task = scanTaskService.createScanTask(request);
        return ResponseEntity.ok(ApiResponse.success("创建成功", task));
    }

    @GetMapping("/{taskId}")
    public ResponseEntity<ApiResponse<ScanTask>> getTaskById(@PathVariable String taskId) {
        ScanTask task = scanTaskService.getTaskByTaskId(taskId);
        return ResponseEntity.ok(ApiResponse.success(task));
    }

    @PutMapping("/{taskId}/status")
    public ResponseEntity<ApiResponse<ScanTask>> updateTaskStatus(
            @PathVariable String taskId,
            @Valid @RequestBody TaskStatusUpdateRequest request) {
        log.info("更新任务状态: taskId={}, targetStatus={}", taskId, request.getTargetStatus());
        ScanTask task = scanTaskService.updateTaskStatus(taskId, request);
        return ResponseEntity.ok(ApiResponse.success("状态更新成功", task));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<ScanTask>>> getTasks(
            @RequestParam(required = false) String fileId,
            @RequestParam(required = false) TaskStatus status,
            @RequestParam(required = false) @DateTimeFormat(pattern = "yyyy-MM-dd HH:mm:ss") LocalDateTime startTime,
            @RequestParam(required = false) @DateTimeFormat(pattern = "yyyy-MM-dd HH:mm:ss") LocalDateTime endTime) {

        List<ScanTask> tasks;
        if (fileId != null) {
            tasks = scanTaskService.getTasksByFileId(fileId);
        } else if (status != null) {
            tasks = scanTaskService.getTasksByStatus(status);
        } else if (startTime != null && endTime != null) {
            tasks = scanTaskService.getTasksByTimeRange(startTime, endTime);
        } else {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error(400, "请提供查询参数: fileId, status 或时间范围"));
        }
        return ResponseEntity.ok(ApiResponse.success(tasks));
    }

    @GetMapping("/{taskId}/failures")
    public ResponseEntity<ApiResponse<List<FailureReason>>> getTaskFailures(@PathVariable String taskId) {
        List<FailureReason> failures = scanTaskService.getFailureReasonsByTaskId(taskId);
        return ResponseEntity.ok(ApiResponse.success(failures));
    }

    @GetMapping("/{taskId}/notifications")
    public ResponseEntity<ApiResponse<List<NotificationRecord>>> getTaskNotifications(@PathVariable String taskId) {
        List<NotificationRecord> notifications = scanTaskService.getNotificationsByTaskId(taskId);
        return ResponseEntity.ok(ApiResponse.success(notifications));
    }

    @GetMapping("/statistics")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getStatistics() {
        Map<String, Object> stats = scanTaskService.getTaskStatistics();
        return ResponseEntity.ok(ApiResponse.success(stats));
    }
}