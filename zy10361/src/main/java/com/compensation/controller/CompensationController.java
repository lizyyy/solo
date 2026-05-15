package com.compensation.controller;

import com.compensation.dto.*;
import com.compensation.entity.CompensationInstruction;
import com.compensation.service.CompensationService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/compensation")
@RequiredArgsConstructor
public class CompensationController {

    private final CompensationService compensationService;

    @PostMapping
    public ApiResponse<Map<String, Object>> createCompensation(@Valid @RequestBody CreateCompensationRequest request) {
        return compensationService.createCompensation(request);
    }

    @GetMapping("/{processId}")
    public ApiResponse<Map<String, Object>> getProcessDetail(@PathVariable String processId) {
        return compensationService.getProcessDetail(processId);
    }

    @PostMapping("/{processId}/start")
    public ApiResponse<String> startCompensation(@PathVariable String processId) {
        return compensationService.startCompensation(processId);
    }

    @PostMapping("/instruction/{instructionId}/confirm")
    public ApiResponse<String> manualConfirm(
            @PathVariable String instructionId,
            @Valid @RequestBody ManualConfirmRequest request) {
        return compensationService.manualConfirm(instructionId, request);
    }

    @PostMapping("/instruction/{instructionId}/execute")
    public ApiResponse<String> executeInstruction(
            @PathVariable String instructionId,
            @Valid @RequestBody ExecuteInstructionRequest request) {
        return compensationService.executeInstruction(instructionId, request);
    }

    @GetMapping("/{processId}/next")
    public ApiResponse<Map<String, Object>> getNextInstructions(@PathVariable String processId) {
        return compensationService.getNextInstructions(processId);
    }

    @GetMapping("/history")
    public ApiResponse<List<Map<String, Object>>> getHistory(
            @RequestParam(required = false) @DateTimeFormat(pattern = "yyyy-MM-dd HH:mm:ss") LocalDateTime startTime,
            @RequestParam(required = false) @DateTimeFormat(pattern = "yyyy-MM-dd HH:mm:ss") LocalDateTime endTime,
            @RequestParam(required = false) String status) {
        return compensationService.getHistory(startTime, endTime, status);
    }

    @GetMapping("/{processId}/export")
    public ApiResponse<String> exportResult(@PathVariable String processId) {
        return compensationService.exportResult(processId);
    }
}
