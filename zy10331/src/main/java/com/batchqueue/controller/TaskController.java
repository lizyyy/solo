package com.batchqueue.controller;

import com.batchqueue.model.dto.*;
import com.batchqueue.model.entity.ExecutionSlot;
import com.batchqueue.model.entity.PreemptionRecord;
import com.batchqueue.model.entity.ScheduleLog;
import com.batchqueue.model.enums.TaskStatus;
import com.batchqueue.service.*;
import javax.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/tasks")
@RequiredArgsConstructor
public class TaskController {
    private final TaskService taskService;
    private final ScheduleLogService scheduleLogService;
    private final ExecutionSlotService executionSlotService;
    private final TaskSchedulerService taskSchedulerService;
    private final ExportService exportService;

    @PostMapping
    public ResponseEntity<ApiResponse<TaskResponse>> createTask(@Valid @RequestBody TaskCreateRequest request) {
        TaskResponse response = taskService.createTask(request);
        return ResponseEntity.ok(ApiResponse.success("任务创建成功", response));
    }

    @GetMapping("/{taskId}")
    public ResponseEntity<ApiResponse<TaskResponse>> getTask(@PathVariable String taskId) {
        TaskResponse response = taskService.getTaskByTaskId(taskId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<TaskResponse>>> getAllTasks() {
        List<TaskResponse> tasks = taskService.getAllTasks();
        return ResponseEntity.ok(ApiResponse.success(tasks));
    }

    @GetMapping("/status/{status}")
    public ResponseEntity<ApiResponse<List<TaskResponse>>> getTasksByStatus(@PathVariable TaskStatus status) {
        List<TaskResponse> tasks = taskService.getTasksByStatus(status);
        return ResponseEntity.ok(ApiResponse.success(tasks));
    }

    @GetMapping("/queue/waiting")
    public ResponseEntity<ApiResponse<List<TaskResponse>>> getWaitingQueue() {
        List<TaskResponse> tasks = taskService.getWaitingQueue();
        return ResponseEntity.ok(ApiResponse.success(tasks));
    }

    @GetMapping("/queue/running")
    public ResponseEntity<ApiResponse<List<TaskResponse>>> getRunningTasks() {
        List<TaskResponse> tasks = taskService.getRunningTasks();
        return ResponseEntity.ok(ApiResponse.success(tasks));
    }

    @PostMapping("/progress")
    public ResponseEntity<ApiResponse<TaskResponse>> progressTask(@Valid @RequestBody TaskProgressRequest request) {
        TaskResponse response = taskService.progressTask(request.getTaskId(), request.getResult(), request.getOperator());
        return ResponseEntity.ok(ApiResponse.success("任务执行完成", response));
    }

    @PostMapping("/cancel")
    public ResponseEntity<ApiResponse<TaskResponse>> cancelTask(@Valid @RequestBody TaskCancelRequest request) {
        TaskResponse response = taskService.cancelTask(request.getTaskId(), request.getReason(), request.getOperator());
        return ResponseEntity.ok(ApiResponse.success("任务已取消", response));
    }

    @GetMapping("/{taskId}/logs")
    public ResponseEntity<ApiResponse<List<ScheduleLog>>> getTaskLogs(@PathVariable String taskId) {
        TaskResponse task = taskService.getTaskByTaskId(taskId);
        List<ScheduleLog> logs = scheduleLogService.getTaskLogs(task.getId());
        return ResponseEntity.ok(ApiResponse.success(logs));
    }

    @GetMapping("/logs/all")
    public ResponseEntity<ApiResponse<List<ScheduleLog>>> getAllLogs() {
        List<ScheduleLog> logs = scheduleLogService.getAllLogs();
        return ResponseEntity.ok(ApiResponse.success(logs));
    }

    @GetMapping("/slots")
    public ResponseEntity<ApiResponse<List<ExecutionSlot>>> getAllSlots() {
        List<ExecutionSlot> slots = executionSlotService.getAllSlots();
        return ResponseEntity.ok(ApiResponse.success(slots));
    }

    @GetMapping("/preemptions")
    public ResponseEntity<ApiResponse<List<PreemptionRecord>>> getPreemptionRecords() {
        List<PreemptionRecord> records = taskSchedulerService.getAllPreemptionRecords();
        return ResponseEntity.ok(ApiResponse.success(records));
    }

    @GetMapping("/stats/average-wait-time")
    public ResponseEntity<ApiResponse<Double>> getAverageWaitTime() {
        Double avgWaitTime = taskSchedulerService.getAverageWaitTime();
        return ResponseEntity.ok(ApiResponse.success(avgWaitTime));
    }

    @GetMapping("/export/json")
    public ResponseEntity<byte[]> exportToJson() throws Exception {
        byte[] data = exportService.exportTasksToJson();
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setContentDispositionFormData("attachment", "tasks.json");
        return ResponseEntity.ok().headers(headers).body(data);
    }

    @GetMapping("/export/csv")
    public ResponseEntity<byte[]> exportToCsv() throws Exception {
        byte[] data = exportService.exportTasksToCsv();
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType("text/csv; charset=UTF-8"));
        headers.setContentDispositionFormData("attachment", "tasks.csv");
        return ResponseEntity.ok().headers(headers).body(data);
    }
}
