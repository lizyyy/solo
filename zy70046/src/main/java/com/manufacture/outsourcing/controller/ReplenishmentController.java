package com.manufacture.outsourcing.controller;

import com.manufacture.outsourcing.common.Result;
import com.manufacture.outsourcing.dto.ReplenishmentDeliveryRequest;
import com.manufacture.outsourcing.dto.ReplenishmentRequest;
import com.manufacture.outsourcing.entity.ReplenishmentTask;
import com.manufacture.outsourcing.service.ReplenishmentService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/replenishments")
public class ReplenishmentController {

    private final ReplenishmentService replenishmentService;

    public ReplenishmentController(ReplenishmentService replenishmentService) {
        this.replenishmentService = replenishmentService;
    }

    @PostMapping
    public Result<ReplenishmentTask> create(@Valid @RequestBody ReplenishmentRequest request) {
        return Result.success(replenishmentService.createTask(request));
    }

    @GetMapping("/{id}")
    public Result<ReplenishmentTask> getById(@PathVariable Long id) {
        return Result.success(replenishmentService.getById(id));
    }

    @GetMapping("/order/{orderId}")
    public Result<List<ReplenishmentTask>> findByOrderId(@PathVariable Long orderId) {
        return Result.success(replenishmentService.findByOrderId(orderId));
    }

    @GetMapping("/batch/{batchId}")
    public Result<List<ReplenishmentTask>> findByBatchId(@PathVariable Long batchId) {
        return Result.success(replenishmentService.findByBatchId(batchId));
    }

    @GetMapping("/inspection/{inspectionId}")
    public Result<List<ReplenishmentTask>> findByInspectionId(@PathVariable Long inspectionId) {
        return Result.success(replenishmentService.findByInspectionId(inspectionId));
    }

    @GetMapping("/failed")
    public Result<List<ReplenishmentTask>> findFailedTasks() {
        return Result.success(replenishmentService.findFailedTasks());
    }

    @GetMapping("/supplier/{supplierId}")
    public Result<List<ReplenishmentTask>> findBySupplierId(@PathVariable Long supplierId) {
        return Result.success(replenishmentService.findBySupplierId(supplierId));
    }

    @PostMapping("/{id}/notify-supplier")
    public Result<ReplenishmentTask> notifySupplier(@PathVariable Long id,
                                                     @RequestParam(required = false) String supplierResponse) {
        return Result.success(replenishmentService.notifySupplier(id, supplierResponse));
    }

    @PostMapping("/{id}/confirm-supplier")
    public Result<ReplenishmentTask> confirmSupplier(@PathVariable Long id,
                                                      @RequestParam(required = false) String supplierResponse) {
        return Result.success(replenishmentService.confirmSupplier(id, supplierResponse));
    }

    @PostMapping("/{id}/delivery")
    public Result<ReplenishmentTask> recordDelivery(@PathVariable Long id,
                                                     @Valid @RequestBody ReplenishmentDeliveryRequest request) {
        return Result.success(replenishmentService.recordDelivery(id, request));
    }

    @PostMapping("/{id}/mark-failed")
    public Result<ReplenishmentTask> markFailed(@PathVariable Long id,
                                                 @RequestParam String failureReason) {
        return Result.success(replenishmentService.markFailed(id, failureReason));
    }

    @PostMapping("/{id}/retry")
    public Result<ReplenishmentTask> retry(@PathVariable Long id,
                                            @RequestParam(required = false) String retryDescription) {
        return Result.success(replenishmentService.retryTask(id, retryDescription));
    }

    @PostMapping("/{id}/cancel")
    public Result<ReplenishmentTask> cancel(@PathVariable Long id,
                                             @RequestParam String reason) {
        return Result.success(replenishmentService.cancelTask(id, reason));
    }
}
