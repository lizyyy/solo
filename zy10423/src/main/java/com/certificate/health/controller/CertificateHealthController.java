package com.certificate.health.controller;

import com.certificate.health.dto.CertificateUploadRequest;
import com.certificate.health.dto.ManualFixRequest;
import com.certificate.health.enums.HealthStatus;
import com.certificate.health.model.CertificateFile;
import com.certificate.health.model.HealthReport;
import com.certificate.health.service.CertificateHealthService;
import com.certificate.health.service.HealthReportService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/v1/certificates")
@RequiredArgsConstructor
public class CertificateHealthController {

    private final CertificateHealthService certificateHealthService;
    private final HealthReportService healthReportService;

    @PostMapping
    public ResponseEntity<CertificateFile> uploadCertificate(@Valid @RequestBody CertificateUploadRequest request) {
        log.info("Received certificate upload request");
        CertificateFile result = certificateHealthService.processCertificate(request);
        return new ResponseEntity<>(result, HttpStatus.CREATED);
    }

    @GetMapping
    public ResponseEntity<List<CertificateFile>> getAllCertificates() {
        return ResponseEntity.ok(certificateHealthService.getAllCertificates());
    }

    @GetMapping("/{id}")
    public ResponseEntity<CertificateFile> getCertificateById(@PathVariable Long id) {
        return certificateHealthService.getCertificateById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/status/{status}")
    public ResponseEntity<List<CertificateFile>> getCertificatesByStatus(@PathVariable HealthStatus status) {
        return ResponseEntity.ok(certificateHealthService.getCertificatesByStatus(status));
    }

    @PutMapping("/{id}/status")
    public ResponseEntity<CertificateFile> advanceStatus(@PathVariable Long id, @RequestParam HealthStatus newStatus) {
        return certificateHealthService.advanceStatus(id, newStatus)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/{id}/manual-fix")
    public ResponseEntity<CertificateFile> applyManualFix(@PathVariable Long id, @RequestBody ManualFixRequest request) {
        return certificateHealthService.applyManualFix(id, request)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/{id}/reanalyze")
    public ResponseEntity<CertificateFile> reanalyzeCertificate(@PathVariable Long id) {
        return certificateHealthService.reanalyzeCertificate(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}/report")
    public ResponseEntity<HealthReport> getHealthReport(@PathVariable Long id) {
        return certificateHealthService.getCertificateById(id)
                .map(CertificateFile::getHealthReport)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/reports/{reportId}")
    public ResponseEntity<HealthReport> getReportByReportId(@PathVariable String reportId) {
        return healthReportService.getReportByReportId(reportId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}/export")
    public ResponseEntity<Map<String, Object>> exportReport(@PathVariable Long id) {
        return certificateHealthService.getCertificateById(id)
                .map(cert -> {
                    HealthReport report = cert.getHealthReport();
                    if (report == null) {
                        return ResponseEntity.notFound().<Map<String, Object>>build();
                    }
                    
                    Map<String, Object> exportData = new HashMap<>();
                    exportData.put("reportId", report.getReportId());
                    exportData.put("generatedAt", report.getGeneratedAt());
                    exportData.put("overallStatus", report.getOverallStatus());
                    exportData.put("overallRiskLevel", report.getOverallRiskLevel());
                    exportData.put("summary", report.getSummary());
                    exportData.put("processingConclusion", report.getProcessingConclusion());
                    exportData.put("totalCertificates", report.getTotalCertificatesInChain());
                    exportData.put("expiredCount", report.getExpiredCertificatesCount());
                    exportData.put("nearExpiryCount", report.getNearExpiryCertificatesCount());
                    exportData.put("weakAlgorithmCount", report.getWeakAlgorithmCertificatesCount());
                    exportData.put("chainValidationPassed", report.getChainValidationPassed());
                    exportData.put("chainValidationMessage", report.getChainValidationMessage());
                    exportData.put("hasMissingIntermediates", report.getHasMissingIntermediates());
                    exportData.put("fixSuggestions", report.getFixSuggestions());
                    exportData.put("certificateDetails", cert.getChainNodes());
                    
                    return ResponseEntity.ok(exportData);
                })
                .orElse(ResponseEntity.notFound().build());
    }
}
