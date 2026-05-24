package com.livestock.transfer.controller;

import com.livestock.transfer.common.Result;
import com.livestock.transfer.dto.AcceptanceRequest;
import com.livestock.transfer.dto.TransferCreateRequest;
import com.livestock.transfer.dto.TransferDetailVO;
import com.livestock.transfer.dto.ValidationResolveRequest;
import com.livestock.transfer.entity.*;
import com.livestock.transfer.service.AcceptanceService;
import com.livestock.transfer.service.ReportService;
import com.livestock.transfer.service.TransferService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/transfers")
public class TransferController {
    private final TransferService transferService;
    private final AcceptanceService acceptanceService;
    private final ReportService reportService;

    public TransferController(TransferService transferService,
            AcceptanceService acceptanceService,
            ReportService reportService) {
        this.transferService = transferService;
        this.acceptanceService = acceptanceService;
        this.reportService = reportService;
    }

    @PostMapping
    public Result<TransferOrder> createTransfer(@RequestBody TransferCreateRequest request) {
        try {
            TransferOrder order = transferService.createTransfer(request);
            return Result.success(order);
        } catch (Exception e) {
            return Result.fail(e.getMessage());
        }
    }

    @GetMapping
    public Result<List<TransferOrder>> getAllTransfers() {
        return Result.success(transferService.getAllTransfers());
    }

    @GetMapping("/{id}")
    public Result<TransferDetailVO> getTransferDetail(@PathVariable Long id) {
        try {
            TransferDetailVO detail = transferService.getTransferDetail(id);
            return Result.success(detail);
        } catch (Exception e) {
            return Result.fail(e.getMessage());
        }
    }

    @PostMapping("/{id}/submit")
    public Result<TransferOrder> submitTransfer(@PathVariable Long id, @RequestParam String operator) {
        try {
            TransferOrder order = transferService.submitTransfer(id, operator);
            return Result.success(order);
        } catch (Exception e) {
            return Result.fail(e.getMessage());
        }
    }

    @PostMapping("/{id}/approve")
    public Result<TransferOrder> approveTransfer(@PathVariable Long id, @RequestParam String operator) {
        try {
            TransferOrder order = transferService.approveTransfer(id, operator);
            return Result.success(order);
        } catch (Exception e) {
            return Result.fail(e.getMessage());
        }
    }

    @PostMapping("/{id}/start-transport")
    public Result<TransferOrder> startTransport(@PathVariable Long id, @RequestParam String operator) {
        try {
            TransferOrder order = transferService.startTransport(id, operator);
            return Result.success(order);
        } catch (Exception e) {
            return Result.fail(e.getMessage());
        }
    }

    @PostMapping("/{id}/cancel")
    public Result<TransferOrder> cancelTransfer(@PathVariable Long id, 
            @RequestParam String operator, @RequestParam(required = false) String reason) {
        try {
            TransferOrder order = transferService.cancelTransfer(id, operator, reason);
            return Result.success(order);
        } catch (Exception e) {
            return Result.fail(e.getMessage());
        }
    }

    @PostMapping("/validations/resolve")
    public Result<Void> resolveValidation(@RequestBody ValidationResolveRequest request) {
        try {
            transferService.resolveValidation(request.getValidationId(), 
                    request.getResolvedBy(), request.getResolutionNote());
            return Result.success();
        } catch (Exception e) {
            return Result.fail(e.getMessage());
        }
    }

    @PostMapping("/acceptance")
    public Result<AcceptanceRecord> createAcceptance(@RequestBody AcceptanceRequest request) {
        try {
            AcceptanceRecord acceptance = acceptanceService.createAcceptance(request);
            return Result.success(acceptance);
        } catch (Exception e) {
            return Result.fail(e.getMessage());
        }
    }

    @PostMapping("/acceptance/{id}/confirm")
    public Result<AcceptanceRecord> confirmAcceptance(@PathVariable Long id,
            @RequestParam(required = false) String differenceReason,
            @RequestParam String operator) {
        try {
            AcceptanceRecord acceptance = acceptanceService.confirmAcceptance(id, differenceReason, operator);
            return Result.success(acceptance);
        } catch (Exception e) {
            return Result.fail(e.getMessage());
        }
    }

    @PostMapping("/acceptance/{id}/resolve")
    public Result<AcceptanceRecord> resolveDispute(@PathVariable Long id,
            @RequestParam boolean acceptAsIs,
            @RequestParam String resolutionNote,
            @RequestParam String operator) {
        try {
            AcceptanceRecord acceptance = acceptanceService.resolveAcceptanceDispute(
                    id, acceptAsIs, resolutionNote, operator);
            return Result.success(acceptance);
        } catch (Exception e) {
            return Result.fail(e.getMessage());
        }
    }

    @GetMapping("/{id}/acceptance-tags/{acceptanceId}")
    public Result<List<AcceptanceTag>> getAcceptanceTags(@PathVariable Long id, @PathVariable Long acceptanceId) {
        return Result.success(acceptanceService.getAcceptanceTags(acceptanceId));
    }

    @PostMapping("/{id}/complete")
    public Result<TransferOrder> completeTransfer(@PathVariable Long id, @RequestParam String operator) {
        try {
            TransferOrder order = acceptanceService.completeTransfer(id, operator);
            return Result.success(order);
        } catch (Exception e) {
            return Result.fail(e.getMessage());
        }
    }

    @PostMapping("/{id}/reports")
    public Result<TransferReport> generateReport(@PathVariable Long id, @RequestParam String operator) {
        try {
            TransferReport report = reportService.generateTransferReport(id, operator);
            return Result.success(report);
        } catch (Exception e) {
            return Result.fail(e.getMessage());
        }
    }

    @GetMapping("/{id}/reports")
    public Result<List<TransferReport>> getReports(@PathVariable Long id) {
        return Result.success(reportService.getReports(id));
    }

    @GetMapping("/reports/{reportId}/export")
    public ResponseEntity<String> exportReport(@PathVariable Long reportId) {
        try {
            String csv = reportService.exportReportAsCsv(reportId);
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.parseMediaType("text/csv; charset=UTF-8"));
            headers.setContentDispositionFormData("attachment", "report_" + reportId + ".csv");
            return ResponseEntity.ok()
                    .headers(headers)
                    .body(new String(csv.getBytes(StandardCharsets.UTF_8), StandardCharsets.ISO_8859_1));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @GetMapping("/statistics")
    public Result<Map<String, Object>> getStatistics() {
        return Result.success(reportService.getStatistics());
    }
}
