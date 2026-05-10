package com.paymentguard.simulator.controller;

import com.paymentguard.common.dto.ApiResponse;
import com.paymentguard.common.dto.ScenarioConfig;
import com.paymentguard.simulator.scenario.ScenarioSimulator;
import javax.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/simulator")
@RequiredArgsConstructor
public class SimulatorController {

    private final ScenarioSimulator simulator;

    @PostMapping("/scenarios")
    public ResponseEntity<ApiResponse<ScenarioSimulator.ScenarioExecution>> startScenario(
            @Valid @RequestBody ScenarioConfig config) {
        
        ScenarioSimulator.ScenarioExecution execution = simulator.startScenario(config);
        
        Map<String, Object> metadata = new HashMap<>();
        metadata.put("status", execution.getStatus());
        metadata.put("startTime", execution.getStartTime());
        
        return ResponseEntity.status(HttpStatus.ACCEPTED)
                .body(ApiResponse.success(execution, "场景已启动", metadata));
    }

    @GetMapping("/scenarios/{executionId}")
    public ResponseEntity<ApiResponse<ScenarioSimulator.ScenarioExecution>> getScenario(
            @PathVariable String executionId) {
        
        ScenarioSimulator.ScenarioExecution execution = simulator.getExecution(executionId);
        if (execution == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(ApiResponse.error("场景执行不存在: " + executionId));
        }
        
        Map<String, Object> metadata = new HashMap<>();
        metadata.put("durationMs", execution.getDurationMs());
        metadata.put("totalRequests", execution.getTotalRequests());
        metadata.put("successCount", execution.getSuccessCount().get());
        metadata.put("failureCount", execution.getFailureCount().get());
        metadata.put("duplicateCount", execution.getDuplicateCount().get());
        metadata.put("timeoutCount", execution.getTimeoutCount().get());
        
        return ResponseEntity.ok(ApiResponse.success(execution, metadata));
    }

    @GetMapping("/scenarios")
    public ResponseEntity<ApiResponse<List<ScenarioSimulator.ScenarioExecution>>> getAllScenarios() {
        List<ScenarioSimulator.ScenarioExecution> executions = simulator.getAllExecutions();
        return ResponseEntity.ok(ApiResponse.success(executions));
    }

    @GetMapping("/scenarios/{executionId}/results")
    public ResponseEntity<ApiResponse<List<ScenarioSimulator.ScenarioResult>>> getScenarioResults(
            @PathVariable String executionId,
            @RequestParam(defaultValue = "100") int limit) {
        
        ScenarioSimulator.ScenarioExecution execution = simulator.getExecution(executionId);
        if (execution == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(ApiResponse.error("场景执行不存在: " + executionId));
        }
        
        List<ScenarioSimulator.ScenarioResult> results = execution.getResults();
        if (limit > 0 && results.size() > limit) {
            results = results.subList(0, limit);
        }
        
        return ResponseEntity.ok(ApiResponse.success(results));
    }
}
