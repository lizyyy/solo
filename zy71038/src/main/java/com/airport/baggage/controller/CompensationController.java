package com.airport.baggage.controller;

import com.airport.baggage.dto.request.*;
import com.airport.baggage.dto.response.ApiResponse;
import com.airport.baggage.dto.response.CompensationDetailResponse;
import com.airport.baggage.entity.ClosingReport;
import com.airport.baggage.service.CompensationService;
import com.airport.baggage.service.ReportExportService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.time.LocalDateTime;

@RestController
@RequestMapping("/compensation")
public class CompensationController {
    private final CompensationService compensationService;
    private final ReportExportService reportExportService;

    public CompensationController(CompensationService compensationService, ReportExportService reportExportService) {
        this.compensationService = compensationService;
        this.reportExportService = reportExportService;
    }

    @PostMapping
    public ApiResponse<CompensationDetailResponse> createCompensation(
            @Valid @RequestBody CreateCompensationRequest request) {
        return ApiResponse.success(compensationService.createCompensation(request));
    }

    @GetMapping("/{orderId}")
    public ApiResponse<CompensationDetailResponse> getOrderDetail(@PathVariable Long orderId) {
        return ApiResponse.success(compensationService.getOrderDetail(orderId));
    }

    @GetMapping("/no/{orderNo}")
    public ApiResponse<CompensationDetailResponse> getOrderByNo(@PathVariable String orderNo) {
        return ApiResponse.success(compensationService.getOrderDetailByOrderNo(orderNo));
    }

    @PostMapping("/{orderId}/status")
    public ApiResponse<CompensationDetailResponse> transitionStatus(
            @PathVariable Long orderId,
            @Valid @RequestBody StatusTransitionRequest request) {
        return ApiResponse.success(compensationService.transitionStatus(orderId, request));
    }

    @PostMapping("/{orderNo}/arrival")
    public ApiResponse<CompensationDetailResponse> recordBaggageArrival(
            @PathVariable String orderNo,
            @Valid @RequestBody BaggageArrivalRequest request) {
        return ApiResponse.success(compensationService.recordBaggageArrival(orderNo, request));
    }

    @PostMapping("/{orderId}/pickup")
    public ApiResponse<CompensationDetailResponse> confirmPickup(
            @PathVariable Long orderId,
            @RequestParam(required = false) String operator) {
        return ApiResponse.success(compensationService.confirmPickup(orderId, operator));
    }

    @PostMapping("/{orderId}/close")
    public ApiResponse<ClosingReport> closeCase(
            @PathVariable Long orderId,
            @Valid @RequestBody CloseCaseRequest request) {
        return ApiResponse.success(compensationService.closeCase(orderId, request));
    }

    @PostMapping("/query")
    public ApiResponse<Page<CompensationDetailResponse>> queryCompensations(
            @RequestBody CompensationQueryRequest request) {
        return ApiResponse.success(compensationService.queryCompensations(request));
    }

    @PostMapping("/export")
    public ResponseEntity<byte[]> exportReport(@RequestBody CompensationQueryRequest request) throws IOException {
        byte[] excelData = reportExportService.exportToExcel(request);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_OCTET_STREAM);
        String filename = "baggage_compensation_" + LocalDateTime.now().toString().replace(":", "-") + ".xlsx";
        headers.setContentDispositionFormData("attachment", filename);

        return ResponseEntity.ok()
                .headers(headers)
                .body(excelData);
    }
}
