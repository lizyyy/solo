package com.api.inspection.controller;

import com.api.inspection.dto.ApiResponse;
import com.api.inspection.entity.ExecutionBatch;
import com.api.inspection.service.ExecutionBatchService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/batches")
@RequiredArgsConstructor
public class ExecutionBatchController {
    private final ExecutionBatchService batchService;

    @PostMapping
    public ApiResponse<ExecutionBatch> createBatch(@RequestParam Long templateId, @RequestParam String executedBy) {
        log.info("创建执行批次, 模板ID: {}, 执行人: {}", templateId, executedBy);
        ExecutionBatch batch = batchService.createBatch(templateId, executedBy);
        return ApiResponse.success("批次创建成功", batch);
    }

    @GetMapping("/{id}")
    public ApiResponse<ExecutionBatch> getBatch(@PathVariable Long id) {
        return ApiResponse.success(batchService.getBatch(id));
    }

    @GetMapping("/no/{batchNo}")
    public ApiResponse<ExecutionBatch> getBatchByNo(@PathVariable String batchNo) {
        return ApiResponse.success(batchService.getBatchByNo(batchNo));
    }

    @GetMapping("/template/{templateId}")
    public ApiResponse<List<ExecutionBatch>> getBatchesByTemplate(@PathVariable Long templateId) {
        return ApiResponse.success(batchService.getBatchesByTemplate(templateId));
    }

    @GetMapping
    public ApiResponse<List<ExecutionBatch>> getAllBatches() {
        return ApiResponse.success(batchService.getAllBatches());
    }

    @PostMapping("/{id}/start")
    public ApiResponse<ExecutionBatch> startExecution(@PathVariable Long id) {
        log.info("开始执行批次: {}", id);
        return ApiResponse.success("执行开始", batchService.startExecution(id));
    }

    @PostMapping("/{id}/steps/{stepOrder}/execute")
    public ApiResponse<ExecutionBatch> executeStep(@PathVariable Long id, @PathVariable Integer stepOrder) {
        log.info("自动执行步骤, 批次ID: {}, 步骤序号: {}", id, stepOrder);
        return ApiResponse.success("步骤执行完成", batchService.executeStep(id, stepOrder));
    }

    @PostMapping("/{id}/execute-all")
    public ApiResponse<ExecutionBatch> executeAllSteps(@PathVariable Long id) {
        log.info("自动执行全部步骤, 批次ID: {}", id);
        return ApiResponse.success("批次执行完成", batchService.executeAllSteps(id));
    }

    @GetMapping("/compare")
    public ApiResponse<Map<String, Object>> compareBatches(@RequestParam Long batchId1, @RequestParam Long batchId2) {
        log.info("对比批次: {} vs {}", batchId1, batchId2);
        return ApiResponse.success("批次对比完成", batchService.compareBatches(batchId1, batchId2));
    }

    @PostMapping("/{id}/cancel")
    public ApiResponse<ExecutionBatch> cancelBatch(@PathVariable Long id) {
        log.info("撤销执行批次: {}", id);
        return ApiResponse.success("批次已撤销", batchService.cancelBatch(id));
    }
}
