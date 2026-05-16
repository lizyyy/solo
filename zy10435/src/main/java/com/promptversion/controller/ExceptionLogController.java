package com.promptversion.controller;

import com.promptversion.dto.ApiResponse;
import com.promptversion.entity.ExceptionLog;
import com.promptversion.repository.ExceptionLogRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/exceptions")
public class ExceptionLogController {

    @Autowired
    private ExceptionLogRepository exceptionLogRepository;

    @GetMapping
    public ApiResponse<List<ExceptionLog>> getAllExceptions() {
        return ApiResponse.success(exceptionLogRepository.findAll());
    }

    @GetMapping("/{id}")
    public ApiResponse<ExceptionLog> getExceptionById(@PathVariable Long id) {
        return ApiResponse.success(exceptionLogRepository.findById(id).orElse(null));
    }

    @GetMapping("/template/{templateId}")
    public ApiResponse<List<ExceptionLog>> getExceptionsByTemplate(@PathVariable Long templateId) {
        return ApiResponse.success(exceptionLogRepository.findByTemplateIdOrderByCreatedAtDesc(templateId));
    }

    @GetMapping("/operation/{operationType}")
    public ApiResponse<List<ExceptionLog>> getExceptionsByOperation(@PathVariable String operationType) {
        return ApiResponse.success(exceptionLogRepository.findByOperationTypeOrderByCreatedAtDesc(operationType));
    }

    @GetMapping("/range")
    public ApiResponse<List<ExceptionLog>> getExceptionsByTimeRange(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startTime,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endTime) {
        return ApiResponse.success(exceptionLogRepository.findByCreatedAtBetweenOrderByCreatedAtDesc(startTime, endTime));
    }

    @PutMapping("/{id}/conclusion")
    public ApiResponse<ExceptionLog> updateConclusion(@PathVariable Long id, @RequestParam String conclusion) {
        ExceptionLog log = exceptionLogRepository.findById(id).orElse(null);
        if (log != null) {
            log.setConclusion(conclusion);
            exceptionLogRepository.save(log);
        }
        return ApiResponse.success(log);
    }
}