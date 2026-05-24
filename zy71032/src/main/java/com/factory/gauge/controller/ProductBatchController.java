package com.factory.gauge.controller;

import com.factory.gauge.common.Result;
import com.factory.gauge.dto.request.BatchRegisterRequest;
import com.factory.gauge.entity.ProductBatch;
import com.factory.gauge.service.ProductBatchService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/batches")
@RequiredArgsConstructor
public class ProductBatchController {

    private final ProductBatchService productBatchService;

    @PostMapping("/register")
    public Result<ProductBatch> registerBatch(@Valid @RequestBody BatchRegisterRequest request) {
        ProductBatch batch = productBatchService.registerBatch(request);
        return Result.success("批次登记成功", batch);
    }

    @GetMapping("/{batchNo}")
    public Result<ProductBatch> getBatch(@PathVariable String batchNo) {
        ProductBatch batch = productBatchService.getBatchByBatchNo(batchNo);
        return Result.success(batch);
    }

    @GetMapping
    public Result<List<ProductBatch>> getAllBatches() {
        List<ProductBatch> batches = productBatchService.getAllBatches();
        return Result.success(batches);
    }

    @GetMapping("/gauge/{toolNo}")
    public Result<List<ProductBatch>> getBatchesByToolNo(@PathVariable String toolNo) {
        List<ProductBatch> batches = productBatchService.getBatchesByToolNo(toolNo);
        return Result.success(batches);
    }

    @GetMapping("/status/locked")
    public Result<List<ProductBatch>> getLockedBatches() {
        List<ProductBatch> batches = productBatchService.getLockedBatches();
        return Result.success(batches);
    }

    @PostMapping("/{batchNo}/lock")
    public Result<ProductBatch> lockBatch(
            @PathVariable String batchNo,
            @RequestParam String lockReason,
            @RequestParam(defaultValue = "system") String operator) {
        ProductBatch batch = productBatchService.lockBatch(batchNo, lockReason, operator);
        return Result.success("批次锁定成功", batch);
    }

    @PostMapping("/{batchNo}/unlock")
    public Result<ProductBatch> unlockBatch(
            @PathVariable String batchNo,
            @RequestParam(defaultValue = "system") String operator) {
        ProductBatch batch = productBatchService.unlockBatch(batchNo, operator);
        return Result.success("批次解锁成功", batch);
    }

    @PostMapping("/{batchNo}/close")
    public Result<ProductBatch> closeBatch(
            @PathVariable String batchNo,
            @RequestParam(defaultValue = "system") String operator) {
        ProductBatch batch = productBatchService.closeBatch(batchNo, operator);
        return Result.success("批次关闭成功", batch);
    }

    @PostMapping("/lock-by-gauge")
    public Result<Void> lockBatchesByExpiredTool(
            @RequestParam String toolNo,
            @RequestParam String lockReason,
            @RequestParam(defaultValue = "system") String operator) {
        productBatchService.lockBatchesByExpiredTool(toolNo, lockReason, operator);
        return Result.success("相关批次已锁定", null);
    }
}
