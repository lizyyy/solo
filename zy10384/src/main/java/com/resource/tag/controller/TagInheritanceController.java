package com.resource.tag.controller;

import com.resource.tag.dto.*;
import com.resource.tag.model.*;
import com.resource.tag.service.TagInheritanceService;
import javax.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/v1/tag-inheritance")
@RequiredArgsConstructor
public class TagInheritanceController {

    private final TagInheritanceService inheritanceService;

    @PostMapping("/tasks")
    public ResponseEntity<ApiResponse<TaskStatusResponse>> createTask(@Valid @RequestBody CreateTaskRequest request) {
        log.info("Received create task request: {}", request.getRequestId());
        ApiResponse<TaskStatusResponse> response = inheritanceService.createTask(request);
        return buildResponseEntity(response);
    }

    @PostMapping("/tasks/{taskId}/validate")
    public ResponseEntity<ApiResponse<TaskStatusResponse>> validateTask(@PathVariable String taskId) {
        log.info("Validating task: {}", taskId);
        ApiResponse<TaskStatusResponse> response = inheritanceService.validateTask(taskId);
        return buildResponseEntity(response);
    }

    @PostMapping("/tasks/{taskId}/calculate")
    public ResponseEntity<ApiResponse<TaskStatusResponse>> calculateInheritance(@PathVariable String taskId) {
        log.info("Calculating inheritance for task: {}", taskId);
        ApiResponse<TaskStatusResponse> response = inheritanceService.calculateInheritance(taskId);
        return buildResponseEntity(response);
    }

    @GetMapping("/tasks/{taskId}/status")
    public ResponseEntity<ApiResponse<TaskStatusResponse>> getTaskStatus(@PathVariable String taskId) {
        ApiResponse<TaskStatusResponse> response = inheritanceService.getTaskStatus(taskId);
        return buildResponseEntity(response);
    }

    @GetMapping("/tasks/{taskId}/conflicts")
    public ResponseEntity<ApiResponse<List<ConflictItem>>> getTaskConflicts(@PathVariable String taskId) {
        ApiResponse<List<ConflictItem>> response = inheritanceService.getTaskConflicts(taskId);
        return buildResponseEntity(response);
    }

    @PostMapping("/tasks/{taskId}/conflicts/{conflictId}/resolve")
    public ResponseEntity<ApiResponse<TaskStatusResponse>> resolveConflict(
            @PathVariable String taskId,
            @PathVariable Long conflictId,
            @Valid @RequestBody ConflictResolutionRequest request) {
        log.info("Resolving conflict {} for task: {}", conflictId, taskId);
        ApiResponse<TaskStatusResponse> response = inheritanceService.resolveConflict(taskId, conflictId, request);
        return buildResponseEntity(response);
    }

    @GetMapping("/tasks/{taskId}/results")
    public ResponseEntity<ApiResponse<List<CalculationResult>>> getTaskResults(@PathVariable String taskId) {
        ApiResponse<List<CalculationResult>> response = inheritanceService.getTaskResults(taskId);
        return buildResponseEntity(response);
    }

    @GetMapping("/tasks/{taskId}/history")
    public ResponseEntity<ApiResponse<List<ChangeHistory>>> getTaskHistory(@PathVariable String taskId) {
        ApiResponse<List<ChangeHistory>> response = inheritanceService.getTaskHistory(taskId);
        return buildResponseEntity(response);
    }

    @GetMapping("/tasks/{taskId}/history/export")
    public ResponseEntity<ApiResponse<List<ChangeHistory>>> exportHistory(@PathVariable String taskId) {
        ApiResponse<List<ChangeHistory>> response = inheritanceService.exportHistory(taskId);
        return buildResponseEntity(response);
    }

    private <T> ResponseEntity<ApiResponse<T>> buildResponseEntity(ApiResponse<T> response) {
        HttpStatus status = HttpStatus.resolve(response.getCode());
        if (status == null) {
            status = HttpStatus.OK;
        }
        return new ResponseEntity<>(response, status);
    }
}
