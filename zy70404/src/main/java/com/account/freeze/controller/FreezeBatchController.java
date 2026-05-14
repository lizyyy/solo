package com.account.freeze.controller;

import com.account.freeze.common.Result;
import com.account.freeze.dto.BatchPreviewResult;
import com.account.freeze.dto.SmsBatchCreateDTO;
import com.account.freeze.entity.FreezeBatch;
import com.account.freeze.service.FreezeBatchService;
import com.account.freeze.service.FreezeExecuteService;
import com.account.freeze.service.ReportService;
import lombok.RequiredArgsConstructor;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/batch")
@RequiredArgsConstructor
public class FreezeBatchController {

    private final FreezeBatchService freezeBatchService;
    private final FreezeExecuteService freezeExecuteService;
    private final ReportService reportService;

    @PostMapping("/sms/create")
    public Result<String> createSmsBatch(@Validated @RequestBody SmsBatchCreateDTO dto) {
        String batchNo = freezeBatchService.createSmsBatch(dto);
        return Result.success(batchNo);
    }

    @GetMapping("/{batchNo}/preview")
    public Result<BatchPreviewResult> previewBatch(@PathVariable String batchNo, 
                                                   @RequestParam String operator) {
        BatchPreviewResult result = freezeBatchService.previewBatch(batchNo, operator);
        return Result.success(result);
    }

    @PostMapping("/{batchNo}/preview/confirm")
    public Result<Void> confirmPreview(@PathVariable String batchNo, 
                                       @RequestParam String operator) {
        freezeBatchService.confirmPreview(batchNo, operator);
        return Result.success();
    }

    @PostMapping("/{batchNo}/execute")
    public Result<Void> executeBatch(@PathVariable String batchNo, 
                                     @RequestParam String operator) {
        freezeExecuteService.executeBatch(batchNo, operator);
        return Result.success();
    }

    @GetMapping("/{batchNo}/status")
    public Result<String> getExecutionStatus(@PathVariable String batchNo) {
        String status = freezeExecuteService.getExecutionStatus(batchNo);
        return Result.success(status);
    }

    @GetMapping("/{batchNo}")
    public Result<FreezeBatch> getBatch(@PathVariable String batchNo) {
        FreezeBatch batch = freezeBatchService.getByBatchNo(batchNo);
        return Result.success(batch);
    }

    @PostMapping("/{batchNo}/report")
    public Result<String> generateReport(@PathVariable String batchNo, 
                                         @RequestParam String operator) {
        String reportNo = reportService.generateBatchReport(batchNo, operator);
        return Result.success(reportNo);
    }
}
