package com.example.provenance;

import com.example.provenance.dto.*;
import com.example.provenance.model.*;
import com.example.provenance.repository.ProvenanceRepository;
import com.example.provenance.service.ProvenanceService;
import com.fasterxml.jackson.core.JsonProcessingException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.annotation.DirtiesContext;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)
class ProvenanceServiceTest {

    @Autowired
    private ProvenanceService provenanceService;

    @Autowired
    private ProvenanceRepository provenanceRepository;

    private ProvenanceSubmitRequest createValidRequest() {
        ProvenanceSubmitRequest request = new ProvenanceSubmitRequest();
        request.setImageTag("registry.example.com/test/app:v1.0.0");
        request.setImageDigest("sha256:" + UUID.randomUUID().toString().replace("-", "")
                + UUID.randomUUID().toString().replace("-", ""));
        request.setRegistry("registry.example.com");
        request.setRepository("test/app");
        request.setSourceCommit(new SourceCommit(
                "https://github.com/example/test-app",
                "main",
                "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0",
                "dev@example.com",
                "test commit",
                System.currentTimeMillis()
        ));
        request.setBuildPipeline(new BuildPipeline(
                "pipeline-test",
                "test-build",
                "1",
                "https://ci.example.com/1",
                "runner-01",
                System.currentTimeMillis() - 3600000,
                System.currentTimeMillis(),
                "SUCCESS"
        ));
        request.setSignatureResult(new SignatureResult(
                "ECDSA",
                "MEUCIQD...",
                "CN=test-signer",
                "cert-data",
                System.currentTimeMillis(),
                "TRUE",
                "签名验证通过"
        ));
        request.setSubmittedBy("test-user");
        request.setRawInput("{\"imageTag\": \"registry.example.com/test/app:v1.0.0\"}");
        return request;
    }

    @Test
    @DisplayName("测试正常流程: 提交完整数据应通过校验并标记为VERIFIED")
    void testNormalFlow() {
        ProvenanceSubmitRequest request = createValidRequest();

        ProvenanceRecord record = provenanceService.submitProvenance(request);

        assertNotNull(record.getId());
        assertEquals(ProvenanceStatus.VERIFIED, record.getStatus());
        assertTrue(record.getProcessingLogs().size() >= 2);
    }

    @Test
    @DisplayName("测试脏数据: 提交无来源和签名的数据应标记为FAILED")
    void testDirtyData() {
        ProvenanceSubmitRequest request = createValidRequest();
        request.setSourceCommit(null);
        request.setSignatureResult(null);

        ProvenanceRecord record = provenanceService.submitProvenance(request);

        assertEquals(ProvenanceStatus.FAILED, record.getStatus());
        assertTrue(record.getStatusMessage().contains("失败"));
    }

    @Test
    @DisplayName("测试重复请求: 重复提交相同镜像标签应幂等返回已有记录")
    void testIdempotentSubmission() {
        ProvenanceSubmitRequest request = createValidRequest();

        ProvenanceRecord record1 = provenanceService.submitProvenance(request);
        ProvenanceRecord record2 = provenanceService.submitProvenance(request);

        assertEquals(record1.getId(), record2.getId());
        assertEquals(1, provenanceRepository.count());
        assertTrue(record2.getProcessingLogs().stream()
                .anyMatch(log -> "幂等返回".equals(log.getAction())));
    }

    @Test
    @DisplayName("测试仅来源校验通过: 应有签名但签名无效，应标记为SOURCE_VERIFIED")
    void testOnlySourceVerified() {
        ProvenanceSubmitRequest request = createValidRequest();
        request.setSignatureResult(new SignatureResult(
                "ECDSA",
                null,
                null,
                null,
                System.currentTimeMillis(),
                "FALSE",
                "签名无效"
        ));

        ProvenanceRecord record = provenanceService.submitProvenance(request);

        assertEquals(ProvenanceStatus.SOURCE_VERIFIED, record.getStatus());
    }

    @Test
    @DisplayName("测试人工修正后重新计算: 修正签名后应重新校验并通过")
    void testManualCorrectionThenRecalculate() {
        ProvenanceSubmitRequest request = createValidRequest();
        request.setSignatureResult(null);

        ProvenanceRecord record = provenanceService.submitProvenance(request);
        assertEquals(ProvenanceStatus.SOURCE_VERIFIED, record.getStatus());

        ManualCorrectionRequest correctionRequest = new ManualCorrectionRequest();
        correctionRequest.setSignatureResult(new SignatureResult(
                "ECDSA",
                "NEW_SIGNATURE_VALUE",
                "CN=test-signer",
                "cert-data",
                System.currentTimeMillis(),
                "TRUE",
                "签名验证通过"
        ));
        correctionRequest.setCorrectionReason("补充签名信息");
        correctionRequest.setOperator("admin");

        Optional<ProvenanceRecord> corrected = provenanceService.manualCorrect(record.getId(), correctionRequest);

        assertTrue(corrected.isPresent());
        assertEquals(ProvenanceStatus.VERIFIED, corrected.get().getStatus());
        assertTrue(corrected.get().getProcessingLogs().stream()
                .anyMatch(log -> "人工修正".equals(log.getAction())));
    }

    @Test
    @DisplayName("测试例外申请审批流程")
    void testExceptionApproval() {
        ProvenanceSubmitRequest request = createValidRequest();
        request.setSourceCommit(null);
        request.setSignatureResult(null);
        request.setExceptionRequest(new ExceptionRequest(
                UUID.randomUUID().toString(),
                "requester@example.com",
                "第三方镜像",
                System.currentTimeMillis(),
                null,
                null,
                null
        ));

        ProvenanceRecord record = provenanceService.submitProvenance(request);
        assertEquals(ProvenanceStatus.FAILED, record.getStatus());

        ExceptionApprovalRequest approvalRequest = new ExceptionApprovalRequest();
        approvalRequest.setApprover("security@example.com");
        approvalRequest.setApproved(true);
        approvalRequest.setApprovalComment("符合例外政策，批准");

        Optional<ProvenanceRecord> approved = provenanceService.approveException(record.getId(), approvalRequest);

        assertTrue(approved.isPresent());
        assertEquals(ProvenanceStatus.EXCEPTION_APPROVED, approved.get().getStatus());
        assertNotNull(approved.get().getExceptionRequest().getApprovalTimestamp());
    }

    @Test
    @DisplayName("测试证明包导出")
    void testExportProvenancePackage() throws JsonProcessingException {
        ProvenanceSubmitRequest request = createValidRequest();
        ProvenanceRecord record = provenanceService.submitProvenance(request);

        String exported = provenanceService.exportProvenancePackage(record.getId());

        assertNotNull(exported);
        assertTrue(exported.contains(record.getImageTag()));
        assertTrue(exported.contains("processingLogs"));
    }

    @Test
    @DisplayName("测试状态更新")
    void testStatusUpdate() {
        ProvenanceSubmitRequest request = createValidRequest();
        ProvenanceRecord record = provenanceService.submitProvenance(request);

        StatusUpdateRequest statusRequest = new StatusUpdateRequest();
        statusRequest.setTargetStatus(ProvenanceStatus.EXCEPTION_REQUESTED);
        statusRequest.setStatusMessage("申请例外");
        statusRequest.setReason("镜像存在已知问题");
        statusRequest.setOperator("security");

        Optional<ProvenanceRecord> updated = provenanceService.updateStatus(record.getId(), statusRequest);

        assertTrue(updated.isPresent());
        assertEquals(ProvenanceStatus.EXCEPTION_REQUESTED, updated.get().getStatus());
    }

    @Test
    @DisplayName("测试按镜像标签查询")
    void testGetByImageTag() {
        ProvenanceSubmitRequest request = createValidRequest();
        ProvenanceRecord record = provenanceService.submitProvenance(request);

        Optional<ProvenanceRecord> found = provenanceService.getByImageTag(record.getImageTag());

        assertTrue(found.isPresent());
        assertEquals(record.getId(), found.get().getId());
    }

    @Test
    @DisplayName("测试异常路径: 导出不存在的记录应抛出异常")
    void testExportNonExistentRecord() {
        assertThrows(IllegalArgumentException.class, () -> {
            provenanceService.exportProvenancePackage("non-existent-id");
        });
    }
}
