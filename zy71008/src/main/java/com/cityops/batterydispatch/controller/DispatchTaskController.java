package com.cityops.batterydispatch.controller;

import com.cityops.batterydispatch.dto.*;
import com.cityops.batterydispatch.enums.DispatchStatus;
import com.cityops.batterydispatch.service.DispatchTaskService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;
import java.util.List;

@RestController
@RequestMapping("/api/tasks")
@RequiredArgsConstructor
public class DispatchTaskController {
    private final DispatchTaskService dispatchTaskService;

    @PostMapping
    public ApiResponse<TaskVO> createTask(@Valid @RequestBody CreateTaskRequest request) {
        return ApiResponse.success(dispatchTaskService.createTask(request));
    }

    @GetMapping("/{taskNo}")
    public ApiResponse<TaskVO> getTaskDetail(@PathVariable String taskNo) {
        return ApiResponse.success(dispatchTaskService.getTaskDetail(taskNo));
    }

    @GetMapping
    public ApiResponse<List<TaskVO>> getTasks(
        @RequestParam(required = false) List<DispatchStatus> statuses,
        @RequestParam(required = false) String batchNo) {

        if (batchNo != null && !batchNo.isEmpty()) {
            return ApiResponse.success(dispatchTaskService.getTasksByBatch(batchNo));
        }

        if (statuses != null && !statuses.isEmpty()) {
            return ApiResponse.success(dispatchTaskService.getTasksByStatus(statuses));
        }

        return ApiResponse.success(dispatchTaskService.getTasksByStatus(List.of(DispatchStatus.values())));
    }

    @PostMapping("/{taskNo}/dispatch")
    public ApiResponse<TaskVO> dispatchTask(
        @PathVariable String taskNo,
        @Valid @RequestBody TaskProcessRequest request) {
        return ApiResponse.success(dispatchTaskService.dispatchTask(taskNo, request));
    }

    @PostMapping("/{taskNo}/arrive")
    public ApiResponse<TaskVO> arriveAtLocation(
        @PathVariable String taskNo,
        @Valid @RequestBody TaskProcessRequest request) {
        return ApiResponse.success(dispatchTaskService.arriveAtLocation(taskNo, request));
    }

    @PostMapping("/{taskNo}/sign")
    public ApiResponse<TaskVO> signForTask(
        @PathVariable String taskNo,
        @Valid @RequestBody TaskProcessRequest request) {
        return ApiResponse.success(dispatchTaskService.signForTask(taskNo, request));
    }

    @PostMapping("/{taskNo}/confirm")
    public ApiResponse<TaskVO> manualConfirm(
        @PathVariable String taskNo,
        @Valid @RequestBody ManualConfirmRequest request) {
        return ApiResponse.success(dispatchTaskService.manualConfirm(taskNo, request));
    }

    @PostMapping("/{taskNo}/cancel")
    public ApiResponse<TaskVO> cancelTask(
        @PathVariable String taskNo,
        @Valid @RequestBody TaskProcessRequest request) {
        return ApiResponse.success(dispatchTaskService.cancelTask(taskNo, request));
    }
}
