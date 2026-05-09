package com.manufacture.outsourcing.controller;

import com.manufacture.outsourcing.common.Result;
import com.manufacture.outsourcing.dto.DeliveryBatchRequest;
import com.manufacture.outsourcing.entity.DeliveryBatch;
import com.manufacture.outsourcing.service.DeliveryBatchService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/batches")
public class DeliveryBatchController {

    private final DeliveryBatchService batchService;

    public DeliveryBatchController(DeliveryBatchService batchService) {
        this.batchService = batchService;
    }

    @PostMapping
    public Result<DeliveryBatch> create(@Valid @RequestBody DeliveryBatchRequest request) {
        return Result.success(batchService.create(request));
    }

    @GetMapping("/{id}")
    public Result<DeliveryBatch> getById(@PathVariable Long id) {
        return Result.success(batchService.getById(id));
    }

    @GetMapping("/no/{batchNo}")
    public Result<DeliveryBatch> getByBatchNo(@PathVariable String batchNo) {
        return Result.success(batchService.getByBatchNo(batchNo));
    }

    @GetMapping("/order/{orderId}")
    public Result<List<DeliveryBatch>> findByOrderId(@PathVariable Long orderId) {
        return Result.success(batchService.findByOrderId(orderId));
    }

    @PostMapping("/{id}/start-inspection")
    public Result<DeliveryBatch> startInspection(@PathVariable Long id) {
        return Result.success(batchService.startInspection(id));
    }

    @PostMapping("/{id}/mark-failed")
    public Result<DeliveryBatch> markInspectionFailed(@PathVariable Long id, @RequestParam String reason) {
        return Result.success(batchService.markInspectionFailed(id, reason));
    }

    @PostMapping("/{id}/retry-inspection")
    public Result<DeliveryBatch> retryInspection(@PathVariable Long id) {
        return Result.success(batchService.retryInspection(id));
    }
}
