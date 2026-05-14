package com.retry.budget.controller;

import com.retry.budget.dto.*;
import com.retry.budget.entity.ExhaustionRecord;
import com.retry.budget.entity.FailureHistory;
import com.retry.budget.service.RetryBudgetService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/retry-budget")
@RequiredArgsConstructor
public class RetryBudgetController {
    
    private final RetryBudgetService retryBudgetService;
    
    @PostMapping("/create")
    public ApiResponse<BudgetResponse> createBudget(@Valid @RequestBody CreateBudgetRequest request) {
        log.info("Creating budget for caller: {}, target: {}", request.getCallerId(), request.getTargetApi());
        BudgetResponse response = retryBudgetService.createBudget(request);
        return ApiResponse.success("预算创建成功", response);
    }
    
    @PostMapping("/check")
    public ApiResponse<RetryCheckResponse> checkRetry(@Valid @RequestBody RetryCheckRequest request) {
        log.debug("Checking retry for caller: {}, target: {}", request.getCallerId(), request.getTargetApi());
        RetryCheckResponse response = retryBudgetService.checkAndRecordRetry(request);
        return ApiResponse.success(response);
    }
    
    @PostMapping("/success")
    public ApiResponse<BudgetResponse> recordSuccess(
            @RequestParam String callerId,
            @RequestParam String targetApi) {
        log.info("Recording success for caller: {}, target: {}", callerId, targetApi);
        BudgetResponse response = retryBudgetService.recordSuccess(callerId, targetApi);
        return ApiResponse.success("成功记录成功", response);
    }
    
    @GetMapping("/budget")
    public ApiResponse<BudgetResponse> getBudget(
            @RequestParam String callerId,
            @RequestParam String targetApi) {
        BudgetResponse response = retryBudgetService.getBudget(callerId, targetApi);
        return ApiResponse.success(response);
    }
    
    @GetMapping("/budgets")
    public ApiResponse<List<BudgetResponse>> getBudgets(@RequestParam String callerId) {
        List<BudgetResponse> response = retryBudgetService.getBudgetsByCaller(callerId);
        return ApiResponse.success(response);
    }
    
    @GetMapping("/history")
    public ApiResponse<Page<FailureHistory>> getFailureHistory(
            @RequestParam String callerId,
            @RequestParam String targetApi,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<FailureHistory> response = retryBudgetService.getFailureHistory(callerId, targetApi, pageable);
        return ApiResponse.success(response);
    }
    
    @GetMapping("/history/{budgetId}")
    public ApiResponse<List<FailureHistory>> getFailureHistoryByBudgetId(@PathVariable Long budgetId) {
        List<FailureHistory> response = retryBudgetService.getFailureHistoryByBudgetId(budgetId);
        return ApiResponse.success(response);
    }
    
    @GetMapping("/exhaustion-records")
    public ApiResponse<List<ExhaustionRecord>> getExhaustionRecords(
            @RequestParam String callerId,
            @RequestParam String targetApi) {
        List<ExhaustionRecord> response = retryBudgetService.getExhaustionRecords(callerId, targetApi);
        return ApiResponse.success(response);
    }
    
    @GetMapping(value = "/export/csv", produces = "text/csv;charset=UTF-8")
    public String exportCsv(
            @RequestParam String callerId,
            @RequestParam String targetApi) {
        return retryBudgetService.exportFailureHistoryAsCsv(callerId, targetApi);
    }
    
    @GetMapping(value = "/export/json", produces = "application/json;charset=UTF-8")
    public String exportJson(
            @RequestParam String callerId,
            @RequestParam String targetApi) {
        return retryBudgetService.exportAllAsJson(callerId, targetApi);
    }
}
