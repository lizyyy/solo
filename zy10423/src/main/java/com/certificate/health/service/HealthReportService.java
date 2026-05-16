package com.certificate.health.service;

import com.certificate.health.enums.HealthStatus;
import com.certificate.health.enums.RiskLevel;
import com.certificate.health.model.*;
import com.certificate.health.repository.HealthReportRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.MessageDigest;
import java.security.cert.X509Certificate;
import java.time.LocalDateTime;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class HealthReportService {

    private final CertificateParserService parserService;
    private final HealthReportRepository healthReportRepository;

    @Transactional
    public HealthReport generateReport(CertificateFile certificateFile, List<X509Certificate> certificates) {
        HealthReport report = HealthReport.builder()
                .reportId(UUID.randomUUID().toString())
                .generatedAt(LocalDateTime.now())
                .totalCertificatesInChain(certificates.size())
                .originalInputHash(calculateHash(certificateFile.getRawCertificateData()))
                .build();

        int expiredCount = 0;
        int nearExpiryCount = 0;
        int weakAlgorithmCount = 0;
        int intermediateCount = 0;

        for (ChainNode node : certificateFile.getChainNodes()) {
            if (Boolean.TRUE.equals(node.getExpiryWindow().getIsExpired())) {
                expiredCount++;
            }
            if (Boolean.TRUE.equals(node.getExpiryWindow().getIsNearExpiry())) {
                nearExpiryCount++;
            }
            if (Boolean.TRUE.equals(node.getAlgorithmInfo().getIsWeakAlgorithm())) {
                weakAlgorithmCount++;
            }
            if (Boolean.TRUE.equals(node.getIsIntermediateCa())) {
                intermediateCount++;
            }
        }

        certificateFile.setIntermediateCount(intermediateCount);
        certificateFile.setHasIntermediateCertificates(intermediateCount > 0);

        report.setExpiredCertificatesCount(expiredCount);
        report.setNearExpiryCertificatesCount(nearExpiryCount);
        report.setWeakAlgorithmCertificatesCount(weakAlgorithmCount);

        boolean chainValid = parserService.validateChain(certificates);
        report.setChainValidationPassed(chainValid);
        report.setChainValidationMessage(chainValid ? 
                "证书链验证通过，所有证书签名关系正确" : 
                "证书链验证失败，可能存在签名不匹配或证书顺序错误");

        boolean hasMissingIntermediates = checkMissingIntermediates(certificateFile.getChainNodes());
        report.setHasMissingIntermediates(hasMissingIntermediates);
        if (hasMissingIntermediates) {
            report.setMissingIntermediatesDetails("检测到缺少中间证书，请确保上传完整的证书链");
        }

        HealthStatus overallStatus = determineOverallStatus(expiredCount, nearExpiryCount, weakAlgorithmCount, chainValid, hasMissingIntermediates);
        RiskLevel overallRisk = determineOverallRisk(expiredCount, nearExpiryCount, weakAlgorithmCount, hasMissingIntermediates);

        report.setOverallStatus(overallStatus);
        report.setOverallRiskLevel(overallRisk);
        report.setSummary(generateSummary(report));
        report.setProcessingConclusion(generateProcessingConclusion(report));

        List<FixSuggestion> suggestions = generateFixSuggestions(report, certificateFile.getChainNodes());
        report.setFixSuggestions(suggestions);

        return healthReportRepository.save(report);
    }

    private String calculateHash(String data) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(data.getBytes());
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (Exception e) {
            return "N/A";
        }
    }

    private boolean checkMissingIntermediates(List<ChainNode> nodes) {
        if (nodes.size() <= 1) return false;
        
        for (int i = 0; i < nodes.size() - 1; i++) {
            ChainNode child = nodes.get(i);
            ChainNode parent = nodes.get(i + 1);
            if (!extractCN(child.getIssuer()).equals(extractCN(parent.getSubject()))) {
                return true;
            }
        }
        return false;
    }

    private String extractCN(String dn) {
        if (dn == null) return "";
        String[] parts = dn.split(",");
        for (String part : parts) {
            if (part.trim().startsWith("CN=")) {
                return part.trim().substring(3);
            }
        }
        return dn;
    }

    private HealthStatus determineOverallStatus(int expired, int nearExpiry, int weakAlgorithm, boolean chainValid, boolean hasMissingIntermediates) {
        if (expired > 0 || !chainValid || hasMissingIntermediates) {
            return HealthStatus.ERROR;
        }
        if (nearExpiry > 0 || weakAlgorithm > 0) {
            return HealthStatus.WARNING;
        }
        return HealthStatus.HEALTHY;
    }

    private RiskLevel determineOverallRisk(int expired, int nearExpiry, int weakAlgorithm, boolean hasMissingIntermediates) {
        if (expired > 0 || hasMissingIntermediates) {
            return RiskLevel.CRITICAL;
        }
        if (weakAlgorithm > 0) {
            return RiskLevel.HIGH;
        }
        if (nearExpiry > 0) {
            return RiskLevel.MEDIUM;
        }
        return RiskLevel.NONE;
    }

    private String generateSummary(HealthReport report) {
        StringBuilder summary = new StringBuilder();
        summary.append("证书链包含").append(report.getTotalCertificatesInChain()).append("个证书。");
        
        if (report.getExpiredCertificatesCount() > 0) {
            summary.append(report.getExpiredCertificatesCount()).append("个证书已过期。");
        }
        if (report.getNearExpiryCertificatesCount() > 0) {
            summary.append(report.getNearExpiryCertificatesCount()).append("个证书即将过期。");
        }
        if (report.getWeakAlgorithmCertificatesCount() > 0) {
            summary.append(report.getWeakAlgorithmCertificatesCount()).append("个证书使用弱算法。");
        }
        if (Boolean.TRUE.equals(report.getHasMissingIntermediates())) {
            summary.append("存在缺少的中间证书。");
        }
        
        if (report.getOverallStatus() == HealthStatus.HEALTHY) {
            summary.append("证书链状态健康，所有检查项通过。");
        }
        
        return summary.toString();
    }

    private String generateProcessingConclusion(HealthReport report) {
        StringBuilder conclusion = new StringBuilder();
        conclusion.append("【证书链体检结论】");
        
        switch (report.getOverallRiskLevel()) {
            case CRITICAL:
                conclusion.append("严重风险 - ");
                if (report.getExpiredCertificatesCount() > 0) {
                    conclusion.append("存在过期证书，必须立即处理。");
                }
                if (Boolean.TRUE.equals(report.getHasMissingIntermediates())) {
                    conclusion.append("缺少中间证书，证书链不完整。");
                }
                if (!Boolean.TRUE.equals(report.getChainValidationPassed())) {
                    conclusion.append("证书链验证失败。");
                }
                break;
            case HIGH:
                conclusion.append("高风险 - 存在使用弱算法的证书，建议尽快更换。");
                break;
            case MEDIUM:
                conclusion.append("中风险 - 存在即将过期的证书，建议提前规划更换。");
                break;
            default:
                conclusion.append("无风险 - 证书链状态良好。");
        }
        
        return conclusion.toString();
    }

    private List<FixSuggestion> generateFixSuggestions(HealthReport report, List<ChainNode> nodes) {
        List<FixSuggestion> suggestions = new ArrayList<>();

        if (report.getExpiredCertificatesCount() > 0) {
            suggestions.add(FixSuggestion.builder()
                    .issueType("过期证书")
                    .severity("CRITICAL")
                    .suggestion("立即更新所有过期的证书")
                    .actionItems("1. 联系证书颁发机构申请新证书\n2. 按照部署文档更新服务器证书\n3. 验证新证书链的完整性")
                    .referenceLinks("https://letsencrypt.org/docs/")
                    .isFixed(false)
                    .build());
        }

        if (report.getNearExpiryCertificatesCount() > 0) {
            suggestions.add(FixSuggestion.builder()
                    .issueType("即将过期证书")
                    .severity("HIGH")
                    .suggestion("在30天内完成证书更新")
                    .actionItems("1. 查看每个证书的具体过期时间\n2. 提前1-2周开始证书更新流程\n3. 准备回滚方案以防更新失败")
                    .referenceLinks("https://ssl-config.mozilla.org/")
                    .isFixed(false)
                    .build());
        }

        if (report.getWeakAlgorithmCertificatesCount() > 0) {
            suggestions.add(FixSuggestion.builder()
                    .issueType("弱算法风险")
                    .severity("HIGH")
                    .suggestion("更换使用强加密算法的证书")
                    .actionItems("1. 确认哪些证书使用了弱算法\n2. 使用RSA-2048+或ECDSA P-256+算法重新申请证书\n3. 使用SHA-256或更高级别的哈希算法")
                    .referenceLinks("https://wiki.mozilla.org/Security/Server_Side_TLS")
                    .isFixed(false)
                    .build());
        }

        if (Boolean.TRUE.equals(report.getHasMissingIntermediates())) {
            suggestions.add(FixSuggestion.builder()
                    .issueType("缺少中间证书")
                    .severity("CRITICAL")
                    .suggestion("获取并安装缺失的中间证书")
                    .actionItems("1. 从证书颁发机构下载完整的证书链\n2. 按照leaf -> intermediate -> root顺序配置证书\n3. 使用在线工具验证证书链完整性")
                    .referenceLinks("https://whatsmychaincert.com/")
                    .isFixed(false)
                    .build());
        }

        if (!Boolean.TRUE.equals(report.getChainValidationPassed())) {
            suggestions.add(FixSuggestion.builder()
                    .issueType("证书链验证失败")
                    .severity("CRITICAL")
                    .suggestion("检查并修复证书链顺序和签名")
                    .actionItems("1. 确认证书顺序是否为leaf -> intermediate -> root\n2. 验证每个证书的签名是否由父证书签发\n3. 重新下载完整的证书链")
                    .referenceLinks("https://www.ssllabs.com/ssltest/")
                    .isFixed(false)
                    .build());
        }

        return suggestions;
    }

    public Optional<HealthReport> getReportByReportId(String reportId) {
        return healthReportRepository.findByReportId(reportId);
    }

    public String exportReportAsJson(HealthReport report) {
        report.setExportedAt(LocalDateTime.now());
        report.setExportedFormat("JSON");
        healthReportRepository.save(report);
        return "{}";
    }
}
