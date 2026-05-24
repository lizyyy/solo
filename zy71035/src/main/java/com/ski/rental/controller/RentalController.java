package com.ski.rental.controller;

import com.ski.rental.dto.*;
import com.ski.rental.model.AuditLog;
import com.ski.rental.model.RentalOrder;
import com.ski.rental.model.ReturnInspection;
import com.ski.rental.model.SafetyReport;
import com.ski.rental.service.AuditService;
import com.ski.rental.service.RentalService;
import com.ski.rental.service.ReportService;
import com.ski.rental.service.SelfCheckService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/rental")
@CrossOrigin(origins = "*")
public class RentalController {
    private final RentalService rentalService;
    private final ReportService reportService;
    private final AuditService auditService;
    private final SelfCheckService selfCheckService;

    public RentalController(RentalService rentalService,
                            ReportService reportService,
                            AuditService auditService,
                            SelfCheckService selfCheckService) {
        this.rentalService = rentalService;
        this.reportService = reportService;
        this.auditService = auditService;
        this.selfCheckService = selfCheckService;
    }

    @PostMapping("/batch")
    public ApiResponse<Map<String, Object>> batchSubmit(@Valid @RequestBody BatchSubmitRequest request) {
        return rentalService.batchSubmit(request);
    }

    @PostMapping("/single")
    public ApiResponse<RentalOrder> singleSubmit(@Valid @RequestBody RentalSubmitRequest request) {
        String batchNo = request.getBatchNo() != null ? request.getBatchNo() : "SINGLE-" + System.currentTimeMillis();
        return rentalService.submitSingleRental(request, batchNo, request.getOperator());
    }

    @PostMapping("/{orderNo}/rent-out")
    public ApiResponse<RentalOrder> rentOut(@PathVariable String orderNo,
                                            @RequestParam(required = false) String operator) {
        return rentalService.rentOut(orderNo, operator != null ? operator : "API");
    }

    @PostMapping("/{orderNo}/request-return")
    public ApiResponse<RentalOrder> requestReturn(@PathVariable String orderNo,
                                                  @RequestParam(required = false) String operator) {
        return rentalService.requestReturn(orderNo, operator != null ? operator : "API");
    }

    @PostMapping("/return-inspection")
    public ApiResponse<ReturnInspection> returnInspection(@Valid @RequestBody ReturnInspectionRequest request) {
        return rentalService.submitReturnInspection(request);
    }

    @PostMapping("/damage-review")
    public ApiResponse<RentalOrder> damageReview(@Valid @RequestBody DamageReviewRequest request) {
        return rentalService.reviewDamage(request);
    }

    @PostMapping("/{orderNo}/charge-fee")
    public ApiResponse<RentalOrder> chargeFee(@PathVariable String orderNo,
                                              @RequestParam(required = false) String operator) {
        return rentalService.chargeFee(orderNo, operator != null ? operator : "CASHIER");
    }

    @PostMapping("/{orderNo}/complete")
    public ApiResponse<RentalOrder> complete(@PathVariable String orderNo,
                                             @RequestParam(required = false) String operator) {
        RentalOrder order = rentalService.getOrder(orderNo).getData();
        return rentalService.completeOrder(order, operator != null ? operator : "API");
    }

    @PostMapping("/{orderNo}/archive")
    public ApiResponse<RentalOrder> archive(@PathVariable String orderNo,
                                            @RequestParam(required = false) String operator) {
        return rentalService.archiveOrder(orderNo, operator != null ? operator : "ADMIN");
    }

    @PutMapping("/{orderNo}/modify")
    public ApiResponse<RentalOrder> modify(@PathVariable String orderNo,
                                           @RequestBody RentalSubmitRequest request,
                                           @RequestParam(required = false) String operator) {
        return rentalService.modifyOrder(orderNo, request, operator != null ? operator : "API");
    }

    @GetMapping("/batch/{batchNo}/split-exceptions")
    public ApiResponse<Map<String, Object>> splitExceptions(@PathVariable String batchNo) {
        return rentalService.splitExceptions(batchNo);
    }

    @GetMapping("/orders/{orderNo}")
    public ApiResponse<RentalOrder> getOrder(@PathVariable String orderNo) {
        return rentalService.getOrder(orderNo);
    }

    @GetMapping("/batch/{batchNo}")
    public ApiResponse<List<RentalOrder>> getBatchOrders(@PathVariable String batchNo) {
        return rentalService.getBatchOrders(batchNo);
    }

    @GetMapping("/exceptions")
    public ApiResponse<List<RentalOrder>> getExceptionOrders() {
        return rentalService.getExceptionOrders();
    }

    @GetMapping("/orders/{orderNo}/audit")
    public ApiResponse<List<AuditLog>> getOrderAudit(@PathVariable String orderNo) {
        return ApiResponse.ok(auditService.getOrderAuditLogs(orderNo));
    }

    @GetMapping("/batch/{batchNo}/audit")
    public ApiResponse<List<AuditLog>> getBatchAudit(@PathVariable String batchNo) {
        return ApiResponse.ok(auditService.getBatchAuditLogs(batchNo));
    }

    @PostMapping("/reports/safety/{orderNo}")
    public ApiResponse<SafetyReport> generateSafetyReport(@PathVariable String orderNo,
                                                          @RequestParam(required = false) String operator) {
        return reportService.generateSafetyReport(orderNo, operator != null ? operator : "API");
    }

    @GetMapping("/reports/batch/{batchNo}/export")
    public ApiResponse<Map<String, Object>> exportBatchReport(@PathVariable String batchNo) {
        return reportService.exportBatchReport(batchNo);
    }

    @GetMapping("/reports/order/{orderNo}/export")
    public ApiResponse<Map<String, Object>> exportOrderDetail(@PathVariable String orderNo) {
        return reportService.exportOrderDetail(orderNo);
    }

    @GetMapping("/reports/order/{orderNo}")
    public ApiResponse<List<SafetyReport>> getOrderReports(@PathVariable String orderNo) {
        return reportService.getReportsByOrder(orderNo);
    }

    @GetMapping("/health")
    public ApiResponse<String> health() {
        return ApiResponse.ok("Service is running");
    }

    @GetMapping("/self-check")
    public ApiResponse<Map<String, Object>> selfCheck() {
        return selfCheckService.runSelfCheck();
    }

    @PostMapping("/reset-data")
    public ApiResponse<String> resetData() {
        return selfCheckService.resetAndReseed();
    }
}
