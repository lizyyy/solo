package com.certificate.health.service;

import com.certificate.health.enums.RiskLevel;
import com.certificate.health.model.*;
import lombok.extern.slf4j.Slf4j;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.bouncycastle.openssl.PEMParser;
import org.springframework.stereotype.Service;

import java.io.ByteArrayInputStream;
import java.io.StringReader;
import java.security.*;
import java.security.cert.*;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Slf4j
@Service
public class CertificateParserService {

    private static final int NEAR_EXPIRY_THRESHOLD_DAYS = 30;
    private static final Set<String> WEAK_ALGORITHMS = Set.of(
            "MD2", "MD5", "SHA1", "SHA-1",
            "RSA-SHA1", "DSA-SHA1", "ECDSA-SHA1"
    );
    private static final int MIN_KEY_SIZE_RSA = 2048;
    private static final int MIN_KEY_SIZE_DSA = 2048;
    private static final int MIN_KEY_SIZE_EC = 256;

    static {
        Security.addProvider(new BouncyCastleProvider());
    }

    public List<X509Certificate> parseCertificateChain(String pemData) throws CertificateException {
        List<X509Certificate> certificates = new ArrayList<>();
        try {
            CertificateFactory factory = CertificateFactory.getInstance("X.509", "BC");
            ByteArrayInputStream bis = new ByteArrayInputStream(pemData.getBytes());
            
            Collection<? extends Certificate> certs = factory.generateCertificates(bis);
            for (Certificate cert : certs) {
                if (cert instanceof X509Certificate) {
                    certificates.add((X509Certificate) cert);
                }
            }
            
            if (certificates.isEmpty()) {
                certificates = parseWithPEMParser(pemData);
            }
            
        } catch (Exception e) {
            log.error("Failed to parse certificate chain", e);
            throw new CertificateException("证书解析失败: " + e.getMessage(), e);
        }
        return certificates;
    }

    private List<X509Certificate> parseWithPEMParser(String pemData) throws Exception {
        List<X509Certificate> certificates = new ArrayList<>();
        PEMParser parser = new PEMParser(new StringReader(pemData));
        Object obj;
        CertificateFactory factory = CertificateFactory.getInstance("X.509", "BC");
        
        while ((obj = parser.readObject()) != null) {
            if (obj instanceof X509Certificate) {
                certificates.add((X509Certificate) obj);
            }
        }
        return certificates;
    }

    public ChainNode buildChainNode(X509Certificate cert, int order) {
        ChainNode node = ChainNode.builder()
                .nodeOrder(order)
                .subject(cert.getSubjectX500Principal().getName())
                .issuer(cert.getIssuerX500Principal().getName())
                .serialNumber(cert.getSerialNumber().toString(16))
                .fingerprint(calculateFingerprint(cert))
                .isRootCa(cert.getSubjectX500Principal().equals(cert.getIssuerX500Principal()))
                .isIntermediateCa(isIntermediateCA(cert))
                .isLeafCertificate(!isCA(cert))
                .isTrusted(false)
                .build();

        node.setAlgorithmInfo(analyzeAlgorithm(cert));
        node.setExpiryWindow(analyzeExpiry(cert));

        return node;
    }

    private boolean isCA(X509Certificate cert) {
        try {
            return cert.getBasicConstraints() != -1;
        } catch (Exception e) {
            return false;
        }
    }

    private boolean isIntermediateCA(X509Certificate cert) {
        try {
            int basicConstraints = cert.getBasicConstraints();
            return basicConstraints != -1 && 
                   !cert.getSubjectX500Principal().equals(cert.getIssuerX500Principal());
        } catch (Exception e) {
            return false;
        }
    }

    private String calculateFingerprint(X509Certificate cert) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] der = cert.getEncoded();
            byte[] hash = md.digest(der);
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex).append(":");
            }
            return hexString.substring(0, hexString.length() - 1).toUpperCase();
        } catch (Exception e) {
            return "N/A";
        }
    }

    public AlgorithmInfo analyzeAlgorithm(X509Certificate cert) {
        String sigAlg = cert.getSigAlgName();
        PublicKey publicKey = cert.getPublicKey();
        String keyAlg = publicKey.getAlgorithm();
        int keySize = getKeySize(publicKey);

        boolean isWeak = isWeakAlgorithm(sigAlg, keyAlg, keySize);
        RiskLevel riskLevel = calculateAlgorithmRisk(sigAlg, keyAlg, keySize);

        return AlgorithmInfo.builder()
                .signatureAlgorithm(sigAlg)
                .signatureAlgorithmOid(cert.getSigAlgOID())
                .publicKeyAlgorithm(keyAlg)
                .keySize(keySize)
                .hashAlgorithm(extractHashAlgorithm(sigAlg))
                .isWeakAlgorithm(isWeak)
                .riskLevel(riskLevel)
                .riskDescription(generateAlgorithmRiskDescription(sigAlg, keyAlg, keySize, isWeak))
                .recommendedAlgorithm(generateRecommendedAlgorithm(keyAlg))
                .build();
    }

    private int getKeySize(PublicKey publicKey) {
        try {
            String algorithm = publicKey.getAlgorithm();
            if ("RSA".equalsIgnoreCase(algorithm)) {
                java.security.interfaces.RSAPublicKey rsaKey = (java.security.interfaces.RSAPublicKey) publicKey;
                return rsaKey.getModulus().bitLength();
            } else if ("DSA".equalsIgnoreCase(algorithm)) {
                java.security.interfaces.DSAPublicKey dsaKey = (java.security.interfaces.DSAPublicKey) publicKey;
                return dsaKey.getParams().getP().bitLength();
            } else if ("EC".equalsIgnoreCase(algorithm)) {
                java.security.interfaces.ECPublicKey ecKey = (java.security.interfaces.ECPublicKey) publicKey;
                return ecKey.getParams().getCurve().getField().getFieldSize();
            }
        } catch (Exception e) {
            log.warn("Failed to get key size", e);
        }
        return 0;
    }

    private boolean isWeakAlgorithm(String sigAlg, String keyAlg, int keySize) {
        String sigAlgUpper = sigAlg.toUpperCase();
        
        for (String weak : WEAK_ALGORITHMS) {
            if (sigAlgUpper.contains(weak)) {
                return true;
            }
        }
        
        if ("RSA".equalsIgnoreCase(keyAlg) && keySize < MIN_KEY_SIZE_RSA) {
            return true;
        }
        if ("DSA".equalsIgnoreCase(keyAlg) && keySize < MIN_KEY_SIZE_DSA) {
            return true;
        }
        if ("EC".equalsIgnoreCase(keyAlg) && keySize < MIN_KEY_SIZE_EC) {
            return true;
        }
        
        return false;
    }

    private RiskLevel calculateAlgorithmRisk(String sigAlg, String keyAlg, int keySize) {
        String sigAlgUpper = sigAlg.toUpperCase();
        
        if (sigAlgUpper.contains("MD5") || sigAlgUpper.contains("MD2")) {
            return RiskLevel.CRITICAL;
        }
        
        if (sigAlgUpper.contains("SHA1") || sigAlgUpper.contains("SHA-1")) {
            return RiskLevel.HIGH;
        }
        
        if ("RSA".equalsIgnoreCase(keyAlg) && keySize < 1024) {
            return RiskLevel.CRITICAL;
        }
        if ("RSA".equalsIgnoreCase(keyAlg) && keySize < 2048) {
            return RiskLevel.HIGH;
        }
        
        return RiskLevel.NONE;
    }

    private String extractHashAlgorithm(String sigAlg) {
        if (sigAlg.toUpperCase().contains("SHA256")) return "SHA-256";
        if (sigAlg.toUpperCase().contains("SHA384")) return "SHA-384";
        if (sigAlg.toUpperCase().contains("SHA512")) return "SHA-512";
        if (sigAlg.toUpperCase().contains("SHA1") || sigAlg.toUpperCase().contains("SHA-1")) return "SHA-1";
        if (sigAlg.toUpperCase().contains("MD5")) return "MD5";
        return "Unknown";
    }

    private String generateAlgorithmRiskDescription(String sigAlg, String keyAlg, int keySize, boolean isWeak) {
        if (!isWeak) {
            return "算法配置符合安全标准";
        }
        
        StringBuilder desc = new StringBuilder();
        String sigAlgUpper = sigAlg.toUpperCase();
        
        if (sigAlgUpper.contains("MD5") || sigAlgUpper.contains("MD2")) {
            desc.append("哈希算法").append(sigAlg).append("已被安全机构认定为不安全，存在碰撞攻击风险。");
        }
        if (sigAlgUpper.contains("SHA1") || sigAlgUpper.contains("SHA-1")) {
            desc.append("SHA-1哈希算法已被废弃，存在碰撞攻击风险。");
        }
        
        if ("RSA".equalsIgnoreCase(keyAlg) && keySize < 2048) {
            desc.append("RSA密钥长度为").append(keySize).append("位，低于推荐的2048位最小要求。");
        }
        
        return desc.toString();
    }

    private String generateRecommendedAlgorithm(String keyAlg) {
        if ("RSA".equalsIgnoreCase(keyAlg)) {
            return "使用RSA-2048或更高位密钥配合SHA-256/SHA-384签名算法";
        }
        if ("EC".equalsIgnoreCase(keyAlg)) {
            return "使用ECDSA P-256/P-384曲线配合SHA-256/SHA-384签名算法";
        }
        return "使用SHA-256或更高级别哈希算法的数字签名";
    }

    public ExpiryWindow analyzeExpiry(X509Certificate cert) {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime notBefore = cert.getNotBefore().toInstant()
                .atZone(ZoneId.systemDefault()).toLocalDateTime();
        LocalDateTime notAfter = cert.getNotAfter().toInstant()
                .atZone(ZoneId.systemDefault()).toLocalDateTime();

        long daysUntilExpiry = ChronoUnit.DAYS.between(now, notAfter);
        boolean isExpired = now.isAfter(notAfter);
        boolean isNearExpiry = !isExpired && daysUntilExpiry <= NEAR_EXPIRY_THRESHOLD_DAYS;

        RiskLevel riskLevel;
        if (isExpired) {
            riskLevel = RiskLevel.CRITICAL;
        } else if (isNearExpiry) {
            riskLevel = RiskLevel.HIGH;
        } else if (daysUntilExpiry <= 90) {
            riskLevel = RiskLevel.MEDIUM;
        } else {
            riskLevel = RiskLevel.NONE;
        }

        return ExpiryWindow.builder()
                .notBefore(notBefore)
                .notAfter(notAfter)
                .daysUntilExpiry(daysUntilExpiry)
                .isExpired(isExpired)
                .isNearExpiry(isNearExpiry)
                .nearExpiryThresholdDays(NEAR_EXPIRY_THRESHOLD_DAYS)
                .riskLevel(riskLevel)
                .warningDescription(generateExpiryWarning(isExpired, isNearExpiry, daysUntilExpiry))
                .build();
    }

    private String generateExpiryWarning(boolean isExpired, boolean isNearExpiry, long daysUntilExpiry) {
        if (isExpired) {
            return "证书已过期，请立即更新证书";
        }
        if (isNearExpiry) {
            return "证书将于" + daysUntilExpiry + "天后过期，请尽快安排更新";
        }
        if (daysUntilExpiry <= 90) {
            return "证书将于" + daysUntilExpiry + "天后过期，建议提前规划更新计划";
        }
        return "证书有效期正常";
    }

    public boolean validateChain(List<X509Certificate> certificates) {
        if (certificates.isEmpty()) {
            return false;
        }

        try {
            for (int i = 0; i < certificates.size() - 1; i++) {
                X509Certificate child = certificates.get(i);
                X509Certificate parent = certificates.get(i + 1);
                
                if (!child.getIssuerX500Principal().equals(parent.getSubjectX500Principal())) {
                    log.warn("Chain validation failed at index {}: issuer does not match subject", i);
                    return false;
                }
                
                try {
                    child.verify(parent.getPublicKey());
                } catch (Exception e) {
                    log.warn("Chain validation failed at index {}: signature verification failed", i, e);
                    return false;
                }
            }
            return true;
        } catch (Exception e) {
            log.error("Chain validation error", e);
            return false;
        }
    }
}
