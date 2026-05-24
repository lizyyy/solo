package com.dormitory.maintenance.controller;

import com.dormitory.maintenance.dto.BatchSubmitRequest;
import com.dormitory.maintenance.dto.MaintenanceOrderRequest;
import com.dormitory.maintenance.dto.ValidationResult;
import com.dormitory.maintenance.entity.AuditLog;
import com.dormitory.maintenance.entity.MaintenanceOrder;
import com.dormitory.maintenance.service.AuditLogService;
import com.dormitory.maintenance.service.MaintenanceOrderService;
import com.dormitory.maintenance.service.ReportService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/orders")
public class MaintenanceOrderController {

    @Autowired
    private MaintenanceOrderService orderService;

    @Autowired
    private AuditLogService auditLogService;

    @Autowired
    private ReportService reportService;

    @PostMapping
    public ResponseEntity<MaintenanceOrder> createOrder(@Valid @RequestBody MaintenanceOrderRequest request) {
        return ResponseEntity.ok(orderService.createOrder(request));
    }

    @PostMapping("/batch")
    public ResponseEntity<Map<String, Object>> batchSubmit(@Valid @RequestBody BatchSubmitRequest request) {
        return ResponseEntity.ok(orderService.batchSubmit(request));
    }

    @PutMapping("/{orderId}")
    public ResponseEntity<MaintenanceOrder> updateOrder(
            @PathVariable Long orderId,
            @Valid @RequestBody MaintenanceOrderRequest request) {
        return ResponseEntity.ok(orderService.updateOrder(orderId, request));
    }

    @PostMapping("/{orderId}/submit")
    public ResponseEntity<MaintenanceOrder> submitForApproval(
            @PathVariable Long orderId,
            @RequestParam(required = false) String operator) {
        return ResponseEntity.ok(orderService.submitForApproval(orderId, operator));
    }

    @PostMapping("/{orderId}/start")
    public ResponseEntity<MaintenanceOrder> startWork(
            @PathVariable Long orderId,
            @RequestParam(required = false) String operator) {
        return ResponseEntity.ok(orderService.startWork(orderId, operator));
    }

    @PostMapping("/{orderId}/complete")
    public ResponseEntity<MaintenanceOrder> completeWork(
            @PathVariable Long orderId,
            @RequestParam(required = false) String operator) {
        return ResponseEntity.ok(orderService.completeWork(orderId, operator));
    }

    @GetMapping("/{orderId}/validate")
    public ResponseEntity<ValidationResult> validateOrder(@PathVariable Long orderId) {
        return ResponseEntity.ok(orderService.validateOrder(orderId));
    }

    @GetMapping("/abnormal")
    public ResponseEntity<List<MaintenanceOrder>> getAbnormalOrders() {
        return ResponseEntity.ok(orderService.getAbnormalOrders());
    }

    @GetMapping("/overtime")
    public ResponseEntity<List<Map<String, Object>>> getOverTimeOrders() {
        return ResponseEntity.ok(orderService.getOverTimeOrders());
    }

    @GetMapping("/{orderId}/overtime")
    public ResponseEntity<Map<String, Object>> checkOverTime(@PathVariable Long orderId) {
        return ResponseEntity.ok(orderService.checkOverTime(orderId));
    }

    @PostMapping("/{orderId}/overtime/request")
    public ResponseEntity<MaintenanceOrder> requestOverTime(
            @PathVariable Long orderId,
            @RequestParam String reason,
            @RequestParam(required = false) String operator) {
        return ResponseEntity.ok(orderService.requestOverTime(orderId, reason, operator));
    }

    @PostMapping("/{orderId}/overtime/approve")
    public ResponseEntity<MaintenanceOrder> approveOverTime(
            @PathVariable Long orderId,
            @RequestParam boolean approved,
            @RequestParam(required = false) String remark,
            @RequestParam(required = false) String approver) {
        return ResponseEntity.ok(orderService.approveOverTime(orderId, approved, remark, approver));
    }

    @GetMapping("/batch/{batchNo}")
    public ResponseEntity<List<MaintenanceOrder>> getOrdersByBatch(@PathVariable String batchNo) {
        return ResponseEntity.ok(orderService.getOrdersByBatch(batchNo));
    }

    @GetMapping("/{orderId}")
    public ResponseEntity<MaintenanceOrder> getOrder(@PathVariable Long orderId) {
        return ResponseEntity.ok(orderService.getOrder(orderId));
    }

    @GetMapping("/no/{orderNo}")
    public ResponseEntity<MaintenanceOrder> getOrderByNo(@PathVariable String orderNo) {
        return ResponseEntity.ok(orderService.getOrderByNo(orderNo));
    }

    @GetMapping
    public ResponseEntity<List<MaintenanceOrder>> getAllOrders() {
        return ResponseEntity.ok(orderService.getAllOrders());
    }

    @GetMapping("/{orderId}/audit-trail")
    public ResponseEntity<List<AuditLog>> getOrderAuditTrail(@PathVariable Long orderId) {
        return ResponseEntity.ok(auditLogService.getOrderAuditTrail(orderId));
    }

    @GetMapping("/no/{orderNo}/audit-trail")
    public ResponseEntity<List<AuditLog>> getOrderAuditTrailByNo(@PathVariable String orderNo) {
        return ResponseEntity.ok(auditLogService.getOrderAuditTrail(orderNo));
    }

    @GetMapping("/no/{orderNo}/report")
    public ResponseEntity<Map<String, Object>> getOrderReport(@PathVariable String orderNo) {
        return ResponseEntity.ok(reportService.generateOrderReport(orderNo));
    }

    @GetMapping(value = "/no/{orderNo}/report/text", produces = "text/plain;charset=UTF-8")
    public ResponseEntity<String> getOrderReportAsText(@PathVariable String orderNo) {
        return ResponseEntity.ok(reportService.generateOrderReportAsText(orderNo));
    }
}
