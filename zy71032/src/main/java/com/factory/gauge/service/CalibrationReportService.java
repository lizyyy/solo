package com.factory.gauge.service;

import com.factory.gauge.dto.request.CalibrationReportRequest;
import com.factory.gauge.entity.CalibrationReport;
import com.factory.gauge.entity.MeasuringTool;
import com.factory.gauge.exception.BusinessException;
import com.factory.gauge.repository.CalibrationReportRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class CalibrationReportService {

    private final CalibrationReportRepository calibrationReportRepository;
    private final MeasuringToolService measuringToolService;

    @Transactional
    public CalibrationReport addReport(CalibrationReportRequest request) {
        MeasuringTool gauge = measuringToolService.getGaugeByToolNo(request.getToolNo());

        if (!request.getIsPassed()) {
            throw new BusinessException("校准未通过，无法添加报告");
        }

        Optional<Integer> maxVersion = calibrationReportRepository.findMaxVersionByCertificateNo(request.getCertificateNo());
        int newVersion = maxVersion.map(v -> v + 1).orElse(1);

        CalibrationReport report = new CalibrationReport();
        report.setToolId(gauge.getId());
        report.setToolNo(gauge.getToolNo());
        report.setCertificateNo(request.getCertificateNo());
        report.setVersion(newVersion);
        report.setCalibrationDate(request.getCalibrationDate());
        report.setValidUntilDate(request.getValidUntilDate());
        report.setCalibrationAgency(request.getCalibrationAgency());
        report.setCalibrator(request.getCalibrator());
        report.setCalibrationItems(request.getCalibrationItems());
        report.setCalibrationResult(request.getCalibrationResult());
        report.setIsPassed(request.getIsPassed());
        report.setFileUrl(request.getFileUrl());
        report.setRemarks(request.getRemarks());
        report.setCreatedBy(request.getOperator());
        report.setUpdatedBy(request.getOperator());

        calibrationReportRepository.save(report);

        measuringToolService.updateCalibration(
                request.getToolNo(),
                request.getCalibrationDate(),
                request.getValidUntilDate(),
                request.getCertificateNo(),
                newVersion,
                request.getOperator()
        );

        return report;
    }

    public CalibrationReport getReportById(Long id) {
        return calibrationReportRepository.findById(id)
                .orElseThrow(() -> new BusinessException("校准报告不存在"));
    }

    public List<CalibrationReport> getReportsByToolNo(String toolNo) {
        return calibrationReportRepository.findByToolNo(toolNo);
    }

    public Optional<CalibrationReport> getLatestReportByToolId(Long toolId) {
        return calibrationReportRepository.findTopByToolIdOrderByCreatedAtDesc(toolId);
    }

    public List<CalibrationReport> getReportsByCertificateNo(String certificateNo) {
        return calibrationReportRepository.findByCertificateNo(certificateNo);
    }

    public CalibrationReport getReportByCertificateNoAndVersion(String certificateNo, Integer version) {
        return calibrationReportRepository.findByCertificateNoAndVersion(certificateNo, version)
                .orElseThrow(() -> new BusinessException("校准报告不存在，证书号: " + certificateNo + ", 版本: " + version));
    }

    public Optional<Integer> getMaxVersionByCertificateNo(String certificateNo) {
        return calibrationReportRepository.findMaxVersionByCertificateNo(certificateNo);
    }

    public void validateCertificateVersion(String certificateNo, Integer version) {
        Optional<Integer> maxVersion = calibrationReportRepository.findMaxVersionByCertificateNo(certificateNo);
        if (maxVersion.isEmpty() || !maxVersion.get().equals(version)) {
            throw new BusinessException("证书版本不正确，最新版本: " + maxVersion.orElse(0));
        }
    }

    public List<CalibrationReport> getAllReports() {
        return calibrationReportRepository.findAll();
    }
}
