package com.compensation.controller;

import com.compensation.dto.*;
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
    public ApiResponse<UndoRequestDTO> createRequest(@Valid @RequestBody CreateUndoRequest request) {
        log.info("创建撤销请求: {}", request.getRequestId());
        UndoRequestDTO result = undoCompensationService.createUndoRequest(request);
        return ApiResponse.success(result);
    }

    @PostMapping("/requests/{requestId}/validate")
    public ApiResponse<UndoRequestDTO> validateRequest(@PathVariable String requestId) {
        log.info("校验请求: {}", requestId);
        UndoRequestDTO result = undoCompensationService.validateRequest(requestId);
        return ApiResponse.success(result);
    }

    @PostMapping("/requests/{requestId}/execute")
    public ApiResponse<UndoRequestDTO> executeRequest(@PathVariable String requestId) {
        log.info("执行请求: {}", requestId);
        UndoRequestDTO result = undoCompensationService.startExecution(requestId);
        return ApiResponse.success(result);
    }

    @GetMapping("/requests/{requestId}")
    public ApiResponse<UndoRequestDTO> getRequest(@PathVariable String requestId) {
        log.info("查询请求: {}", requestId);
        UndoRequestDTO result = undoCompensationService.getRequest(requestId);
        return ApiResponse.success(result);
    }

    @GetMapping("/requests")
    public ApiResponse<List<UndoRequestDTO>> listRequests(
            @RequestParam(required = false) RequestStatus status,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startTime,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endTime) {
        log.info("查询请求列表: status={}, startTime={}, endTime={}", status, startTime, endTime);
        List<UndoRequestDTO> result = undoCompensationService.listRequests(status, startTime, endTime);
        return ApiResponse.success(result);
    }

    @GetMapping("/requests/{requestId}/proof")
    public ApiResponse<CompletionProofDTO> exportProof(@PathVariable String requestId) {
        log.info("导出完成证明: {}", requestId);
        CompletionProofDTO result = undoCompensationService.exportProof(requestId);
        return ApiResponse.success(result);
    }
}
