package com.factory.gauge.controller;

import com.factory.gauge.common.Result;
import com.factory.gauge.dto.request.CalibrationReportRequest;
import com.factory.gauge.entity.CalibrationReport;
import com.factory.gauge.service.CalibrationReportService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/reports")
@RequiredArgsConstructor
public class CalibrationReportController {

    private final CalibrationReportService calibrationReportService;

    @PostMapping("/add")
    public Result<CalibrationReport> addReport(@Valid @RequestBody CalibrationReportRequest request) {
        CalibrationReport report = calibrationReportService.addReport(request);
        return Result.success("校准报告添加成功", report);
    }

    @GetMapping("/{id}")
    public Result<CalibrationReport> getReport(@PathVariable Long id) {
        CalibrationReport report = calibrationReportService.getReportById(id);
        return Result.success(report);
    }

    @GetMapping
    public Result<List<CalibrationReport>> getAllReports() {
        List<CalibrationReport> reports = calibrationReportService.getAllReports();
        return Result.success(reports);
    }

    @GetMapping("/gauge/{toolNo}")
    public Result<List<CalibrationReport>> getReportsByToolNo(@PathVariable String toolNo) {
        List<CalibrationReport> reports = calibrationReportService.getReportsByToolNo(toolNo);
        return Result.success(reports);
    }

    @GetMapping("/certificate/{certificateNo}")
    public Result<List<CalibrationReport>> getReportsByCertificateNo(@PathVariable String certificateNo) {
        List<CalibrationReport> reports = calibrationReportService.getReportsByCertificateNo(certificateNo);
        return Result.success(reports);
    }

    @GetMapping("/certificate/{certificateNo}/version/{version}")
    public Result<CalibrationReport> getReportByCertificateNoAndVersion(
            @PathVariable String certificateNo,
            @PathVariable Integer version) {
        CalibrationReport report = calibrationReportService.getReportByCertificateNoAndVersion(certificateNo, version);
        return Result.success(report);
    }

    @GetMapping("/certificate/{certificateNo}/max-version")
    public Result<Integer> getMaxVersionByCertificateNo(@PathVariable String certificateNo) {
        Optional<Integer> maxVersion = calibrationReportService.getMaxVersionByCertificateNo(certificateNo);
        return Result.success(maxVersion.orElse(0));
    }

    @PostMapping("/certificate/{certificateNo}/validate-version")
    public Result<Void> validateCertificateVersion(
            @PathVariable String certificateNo,
            @RequestParam Integer version) {
        calibrationReportService.validateCertificateVersion(certificateNo, version);
        return Result.success("证书版本验证通过", null);
    }
}
