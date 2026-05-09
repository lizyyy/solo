package com.manufacture.outsourcing.controller;

import com.manufacture.outsourcing.common.Result;
import com.manufacture.outsourcing.dto.SupplierReport;
import com.manufacture.outsourcing.service.ReportService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/reports")
public class ReportController {

    private final ReportService reportService;

    public ReportController(ReportService reportService) {
        this.reportService = reportService;
    }

    @GetMapping("/suppliers")
    public Result<List<SupplierReport>> getAllSupplierReports() {
        return Result.success(reportService.generateSupplierReports());
    }

    @GetMapping("/suppliers/{supplierId}")
    public Result<SupplierReport> getSupplierReport(@PathVariable Long supplierId) {
        return Result.success(reportService.generateSupplierReport(supplierId));
    }
}
