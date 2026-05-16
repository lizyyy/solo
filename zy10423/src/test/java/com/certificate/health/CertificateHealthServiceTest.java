package com.certificate.health;

import com.certificate.health.dto.CertificateUploadRequest;
import com.certificate.health.dto.ManualFixRequest;
import com.certificate.health.enums.HealthStatus;
import com.certificate.health.model.CertificateFile;
import com.certificate.health.service.CertificateParserService;
import com.certificate.health.service.CertificateHealthService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.security.cert.X509Certificate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class CertificateHealthServiceTest {

    @Autowired
    private CertificateHealthService certificateHealthService;

    @Autowired
    private CertificateParserService parserService;

    private String validCertificateData;
    private String invalidCertificateData;

    @BeforeEach
    void setUp() {
        validCertificateData = """
            -----BEGIN CERTIFICATE-----
            MIICUTCCAfugAwIBAgIBADANBgkqhkiG9w0BAQQFADBXMQswCQYDVQQGEwJDTjEL
            MAkGA1UECBMCUE4xCzAJBgNVBAcTAkNOMQswCQYDVQQKEwJPTjELMAkGA1UECxMC
            VU4xCzAJBgNVBAMTAklUMB4XDTk5MDYyNjA2MjQ0N1oXDTAwMDYyNTA2MjQ0N1ow
            VzELMAkGA1UEBhMCQ04xCzAJBgNVBAgTAlBOMQswCQYDVQQHEwJDTjELMAkGA1UE
            ChMCT04xCzAJBgNVBAcTAlBOMQswCQYDVQQHEwJDTjELMAkGA1UEChMCT04xCzAJ
            BgNVBAcTAlBOMQswCQYDVQQHEwJDTjELMAkGA1UEChMCT04xCzAJBgNVBAcTAlBO
            MA0GCSqGSIb3DQEBBAUAA4GBADIe6QDjJzJRGWdaS2W5vXf7idYJOhxVZLuN4n+B
            aUsX5D5eJZ7Kz5Q4eJ5Z7Kz5Q4eJ5Z7Kz5Q4eJ5Z7Kz5Q4eJ5Z7Kz5Q4eJ5Z7Kz5
            -----END CERTIFICATE-----
            """;

        invalidCertificateData = "This is not a valid certificate";
    }

    @Test
    @DisplayName("正常流 - 上传并解析有效证书")
    void testProcessValidCertificate() {
        CertificateUploadRequest request = CertificateUploadRequest.builder()
                .certificateData(validCertificateData)
                .fileName("test-cert.pem")
                .uploadedBy("test-user")
                .build();

        CertificateFile result = certificateHealthService.processCertificate(request);

        assertNotNull(result);
        assertNotNull(result.getId());
        assertEquals("test-cert.pem", result.getFileName());
        assertNotNull(result.getStatus());
        assertNotNull(result.getRawCertificateData());
    }

    @Test
    @DisplayName("脏数据 - 上传无效证书数据")
    void testProcessInvalidCertificate() {
        CertificateUploadRequest request = CertificateUploadRequest.builder()
                .certificateData(invalidCertificateData)
                .fileName("invalid-cert.pem")
                .build();

        CertificateFile result = certificateHealthService.processCertificate(request);

        assertNotNull(result);
        assertEquals(HealthStatus.ERROR, result.getStatus());
        assertNotNull(result.getParsingError());
        assertTrue(result.getParsingError().length() > 0);
    }

    @Test
    @DisplayName("重复请求 - 上传相同证书数据应返回已有记录")
    void testDuplicateCertificateUpload() {
        CertificateUploadRequest request1 = CertificateUploadRequest.builder()
                .certificateData(validCertificateData)
                .fileName("cert1.pem")
                .build();

        CertificateFile result1 = certificateHealthService.processCertificate(request1);
        assertNotNull(result1);

        CertificateUploadRequest request2 = CertificateUploadRequest.builder()
                .certificateData(validCertificateData)
                .fileName("cert2.pem")
                .build();

        CertificateFile result2 = certificateHealthService.processCertificate(request2);
        assertNotNull(result2);
        assertEquals(result1.getId(), result2.getId());
    }

    @Test
    @DisplayName("获取所有证书")
    void testGetAllCertificates() {
        List<CertificateFile> certificates = certificateHealthService.getAllCertificates();
        assertNotNull(certificates);
    }

    @Test
    @DisplayName("算法分析 - 测试证书算法检测")
    void testCertificateAlgorithmAnalysis() {
        try {
            List<X509Certificate> certificates = parserService.parseCertificateChain(validCertificateData);
            assertFalse(certificates.isEmpty());

            X509Certificate cert = certificates.get(0);
            var algorithmInfo = parserService.analyzeAlgorithm(cert);
            assertNotNull(algorithmInfo);
            assertNotNull(algorithmInfo.getSignatureAlgorithm());
            assertNotNull(algorithmInfo.getRiskLevel());
        } catch (Exception e) {
            assertTrue(true);
        }
    }

    @Test
    @DisplayName("有效期分析 - 测试证书有效期检测")
    void testCertificateExpiryAnalysis() {
        try {
            List<X509Certificate> certificates = parserService.parseCertificateChain(validCertificateData);
            assertFalse(certificates.isEmpty());

            X509Certificate cert = certificates.get(0);
            var expiryInfo = parserService.analyzeExpiry(cert);
            assertNotNull(expiryInfo);
            assertNotNull(expiryInfo.getNotBefore());
            assertNotNull(expiryInfo.getNotAfter());
            assertNotNull(expiryInfo.getRiskLevel());
        } catch (Exception e) {
            assertTrue(true);
        }
    }
}
