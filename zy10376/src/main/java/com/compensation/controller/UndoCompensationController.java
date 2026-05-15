package com.compensation.controller;

import com.compensation.dto.ApiResponse;
import com.compensation.dto.CreateUndoRequest;
import com.compensation.entity.CompletionProof;
import com.compensation.entity.UndoRequest;
import com.compensation.enums.RequestStatus;
import com.compensation.service.UndoCompensationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/v1/compensation")
@RequiredArgsConstructor
public class UndoCompensationController {
    
    private final UndoCompensationService undoCompensationService;
    
    @PostMapping("/requests")
    public ApiResponse<UndoRequest> createRequest(@Valid @RequestBody CreateUndoRequest request) {
        log.info("创建撤销请求: {}", request.getRequestId());
        UndoRequest result = undoCompensationService.createUndoRequest(request);
        return ApiResponse.success(result);
    }
    
    @PostMapping("/requests/{requestId}/validate")
    public ApiResponse<UndoRequest> validateRequest(@PathVariable String requestId) {
        log.info("校验请求: {}", requestId);
        UndoRequest result = undoCompensationService.validateRequest(requestId);
        return ApiResponse.success(result);
    }
    
    @PostMapping("/requests/{requestId}/execute")
    public ApiResponse<UndoRequest> executeRequest(@PathVariable String requestId) {
        log.info("执行请求: {}", requestId);
        UndoRequest result = undoCompensationService.startExecution(requestId);
        return ApiResponse.success(result);
    }
    
    @GetMapping("/requests/{requestId}")
    public ApiResponse<UndoRequest> getRequest(@PathVariable String requestId) {
        log.info("查询请求: {}", requestId);
        UndoRequest result = undoCompensationService.getRequest(requestId);
        return ApiResponse.success(result);
    }
    
    @GetMapping("/requests")
    public ApiResponse<List<UndoRequest>> listRequests(
            @RequestParam(required = false) RequestStatus status,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startTime,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endTime) {
        log.info("查询请求列表: status={}, startTime={}, endTime={}", status, startTime, endTime);
        List<UndoRequest> result = undoCompensationService.listRequests(status, startTime, endTime);
        return ApiResponse.success(result);
    }
    
    @GetMapping("/requests/{requestId}/proof")
    public ApiResponse<CompletionProof> exportProof(@PathVariable String requestId) {
        log.info("导出完成证明: {}", requestId);
        CompletionProof result = undoCompensationService.exportProof(requestId);
        return ApiResponse.success(result);
    }
}
