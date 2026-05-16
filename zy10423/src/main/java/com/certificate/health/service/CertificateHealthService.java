package com.certificate.health.service;

import com.certificate.health.dto.CertificateUploadRequest;
import com.certificate.health.dto.ManualFixRequest;
import com.certificate.health.enums.HealthStatus;
import com.certificate.health.model.*;
import com.certificate.health.repository.CertificateFileRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.cert.X509Certificate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class CertificateHealthService {

    private final CertificateFileRepository certificateFileRepository;
    private final CertificateParserService parserService;
    private final HealthReportService healthReportService;

    @Transactional
    public CertificateFile processCertificate(CertificateUploadRequest request) {
        log.info("Processing certificate upload: {}", request.getFileName());

        Optional<CertificateFile> existing = certificateFileRepository.findByRawCertificateData(request.getCertificateData());
        if (existing.isPresent()) {
            log.info("Certificate already exists, returning existing record");
            return existing.get();
        }

        CertificateFile certificateFile = CertificateFile.builder()
                .fileName(request.getFileName() != null ? request.getFileName() : "certificate.pem")
                .fileSize((long) request.getCertificateData().length())
                .uploadTime(LocalDateTime.now())
                .uploadedBy(request.getUploadedBy())
                .certificateFormat(request.getCertificateFormat() != null ? request.getCertificateFormat() : "PEM")
                .rawCertificateData(request.getCertificateData())
                .status(HealthStatus.PARSING)
                .manualFixApplied(false)
                .build();

        certificateFile = certificateFileRepository.save(certificateFile);

        try {
            List<X509Certificate> certificates = parserService.parseCertificateChain(request.getCertificateData());
            
            if (certificates.isEmpty()) {
                certificateFile.setStatus(HealthStatus.ERROR);
                certificateFile.setParsingError("未找到有效的X.509证书");
                return certificateFileRepository.save(certificateFile);
            }

            List<ChainNode> chainNodes = new ArrayList<>();
            for (int i = 0; i < certificates.size(); i++) {
                chainNodes.add(parserService.buildChainNode(certificates.get(i), i));
            }
            certificateFile.setChainNodes(chainNodes);

            HealthReport report = healthReportService.generateReport(certificateFile, certificates);
            certificateFile.setHealthReport(report);
            certificateFile.setStatus(report.getOverallStatus());
            certificateFile.setLastAnalyzedAt(LocalDateTime.now());

        } catch (Exception e) {
            log.error("Failed to process certificate", e);
            certificateFile.setStatus(HealthStatus.ERROR);
            certificateFile.setParsingError("证书处理失败: " + e.getMessage());
        }

        return certificateFileRepository.save(certificateFile);
    }

    public Optional<CertificateFile> getCertificateById(Long id) {
        return certificateFileRepository.findById(id);
    }

    public List<CertificateFile> getAllCertificates() {
        return certificateFileRepository.findAll();
    }

    public List<CertificateFile> getCertificatesByStatus(HealthStatus status) {
        return certificateFileRepository.findByStatus(status);
    }

    @Transactional
    public Optional<CertificateFile> advanceStatus(Long id, HealthStatus newStatus) {
        return certificateFileRepository.findById(id).map(cert -> {
            cert.setStatus(newStatus);
            return certificateFileRepository.save(cert);
        });
    }

    @Transactional
    public Optional<CertificateFile> applyManualFix(Long id, ManualFixRequest request) {
        return certificateFileRepository.findById(id).map(cert -> {
            cert.setManualFixApplied(true);
            cert.setManualFixNotes(request.getFixNotes());
            cert.setStatus(HealthStatus.NEEDS_MANUAL_FIX);

            if (request.getCorrectedCertificateData() != null && !request.getCorrectedCertificateData().isEmpty()) {
                try {
                    cert.setRawCertificateData(request.getCorrectedCertificateData());
                    List<X509Certificate> certificates = parserService.parseCertificateChain(request.getCorrectedCertificateData());
                    
                    List<ChainNode> chainNodes = new ArrayList<>();
                    for (int i = 0; i < certificates.size(); i++) {
                        chainNodes.add(parserService.buildChainNode(certificates.get(i), i));
                    }
                    cert.setChainNodes(chainNodes);

                    HealthReport report = healthReportService.generateReport(cert, certificates);
                    cert.setHealthReport(report);
                    cert.setStatus(report.getOverallStatus());
                    cert.setLastAnalyzedAt(LocalDateTime.now());

                } catch (Exception e) {
                    log.error("Failed to reprocess certificate after manual fix", e);
                }
            }

            if (cert.getHealthReport() != null && cert.getHealthReport().getFixSuggestions() != null) {
                for (FixSuggestion suggestion : cert.getHealthReport().getFixSuggestions()) {
                    suggestion.setIsFixed(true);
                    suggestion.setFixedAt(LocalDateTime.now());
                    suggestion.setFixedBy(request.getFixedBy());
                }
            }

            return certificateFileRepository.save(cert);
        });
    }

    @Transactional
    public Optional<CertificateFile> reanalyzeCertificate(Long id) {
        return certificateFileRepository.findById(id).map(cert -> {
            try {
                cert.setStatus(HealthStatus.ANALYZING);
                certificateFileRepository.save(cert);

                List<X509Certificate> certificates = parserService.parseCertificateChain(cert.getRawCertificateData());
                
                List<ChainNode> chainNodes = new ArrayList<>();
                for (int i = 0; i < certificates.size(); i++) {
                    chainNodes.add(parserService.buildChainNode(certificates.get(i), i));
                }
                cert.setChainNodes(chainNodes);

                HealthReport report = healthReportService.generateReport(cert, certificates);
                cert.setHealthReport(report);
                cert.setStatus(report.getOverallStatus());
                cert.setLastAnalyzedAt(LocalDateTime.now());

            } catch (Exception e) {
                log.error("Failed to reanalyze certificate", e);
                cert.setStatus(HealthStatus.ERROR);
                cert.setParsingError("重新分析失败: " + e.getMessage());
            }
            return certificateFileRepository.save(cert);
        });
    }
}
