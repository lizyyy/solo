package com.example.provenance.service;

import com.example.provenance.dto.*;
import com.example.provenance.model.*;
import com.example.provenance.repository.ProvenanceRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class ProvenanceService {

    private final ProvenanceRepository provenanceRepository;
    private final ObjectMapper objectMapper;

    @Transactional
    public ProvenanceRecord submitProvenance(ProvenanceSubmitRequest request) {
        log.info("提交镜像来源证明: {}", request.getImageTag());

        Optional<ProvenanceRecord> existing = provenanceRepository.findByImageTag(request.getImageTag());
        if (existing.isPresent()) {
            log.info("镜像标签已存在，返回现有记录: {}", request.getImageTag());
            addProcessingLog(existing.get(), "SUBMIT", "幂等返回",
                    request.getRawInput(), "SUCCESS", "记录已存在，幂等返回", request.getSubmittedBy());
            return existing.get();
        }

        ProvenanceRecord record = new ProvenanceRecord();
        record.setImageTag(request.getImageTag());
        record.setImageDigest(request.getImageDigest());
        record.setRegistry(request.getRegistry());
        record.setRepository(request.getRepository());
        record.setSourceCommit(request.getSourceCommit());
        record.setBuildPipeline(request.getBuildPipeline());
        record.setSignatureResult(request.getSignatureResult());
        record.setExceptionRequest(request.getExceptionRequest());
        record.setStatus(ProvenanceStatus.SUBMITTED);
        record.setStatusMessage("已提交，待校验");
        record.setSubmittedBy(request.getSubmittedBy());
        record.setRawInput(request.getRawInput());

        addProcessingLog(record, "SUBMIT", "创建记录",
                request.getRawInput(), "SUCCESS", "来源证明记录已创建", request.getSubmittedBy());

        ProvenanceRecord saved = provenanceRepository.save(record);
        log.info("来源证明记录创建成功: {}", saved.getId());

        performVerification(saved);

        return saved;
    }

    private void performVerification(ProvenanceRecord record) {
        log.info("开始自动校验: {}", record.getImageTag());

        boolean sourceVerified = verifySource(record);
        boolean signatureVerified = verifySignature(record);

        if (sourceVerified && signatureVerified) {
            record.setStatus(ProvenanceStatus.VERIFIED);
            record.setStatusMessage("来源和签名校验全部通过");
            addProcessingLog(record, "VERIFY", "自动校验",
                    null, "SUCCESS", "来源和签名校验通过", "SYSTEM");
        } else if (sourceVerified) {
            record.setStatus(ProvenanceStatus.SOURCE_VERIFIED);
            record.setStatusMessage("来源校验通过，签名校验待处理");
            addProcessingLog(record, "VERIFY", "来源校验",
                    null, "SUCCESS", "来源校验通过，等待签名校验", "SYSTEM");
        } else if (signatureVerified) {
            record.setStatus(ProvenanceStatus.SIGNATURE_VERIFIED);
            record.setStatusMessage("签名校验通过，来源校验待处理");
            addProcessingLog(record, "VERIFY", "签名校验",
                    null, "SUCCESS", "签名校验通过，等待来源校验", "SYSTEM");
        } else {
            record.setStatus(ProvenanceStatus.FAILED);
            record.setStatusMessage("来源和签名校验均失败");
            addProcessingLog(record, "VERIFY", "自动校验",
                    null, "FAILED", "来源和签名校验均失败", "SYSTEM");
        }

        provenanceRepository.save(record);
    }

    private boolean verifySource(ProvenanceRecord record) {
        SourceCommit source = record.getSourceCommit();
        if (source == null) {
            log.warn("源码提交信息为空: {}", record.getImageTag());
            return false;
        }

        boolean hasRepoUrl = source.getRepoUrl() != null && !source.getRepoUrl().isBlank();
        boolean hasCommitHash = source.getCommitHash() != null && !source.getCommitHash().isBlank();

        return hasRepoUrl && hasCommitHash;
    }

    private boolean verifySignature(ProvenanceRecord record) {
        SignatureResult signature = record.getSignatureResult();
        if (signature == null) {
            log.warn("签名结果信息为空: {}", record.getImageTag());
            return false;
        }

        boolean hasSignatureValue = signature.getSignatureValue() != null && !signature.getSignatureValue().isBlank();
        boolean hasSigner = signature.getSignerIdentity() != null && !signature.getSignerIdentity().isBlank();
        boolean isVerified = "TRUE".equalsIgnoreCase(signature.getSignatureVerified());

        return hasSignatureValue && hasSigner && isVerified;
    }

    public Optional<ProvenanceRecord> getById(String id) {
        return provenanceRepository.findById(id);
    }

    public Optional<ProvenanceRecord> getByImageTag(String imageTag) {
        return provenanceRepository.findByImageTag(imageTag);
    }

    public List<ProvenanceRecord> getAll() {
        return provenanceRepository.findAll();
    }

    public List<ProvenanceRecord> getByStatus(ProvenanceStatus status) {
        return provenanceRepository.findByStatus(status);
    }

    @Transactional
    public Optional<ProvenanceRecord> updateStatus(String id, StatusUpdateRequest request) {
        return provenanceRepository.findById(id).map(record -> {
            record.setStatus(request.getTargetStatus());
            record.setStatusMessage(request.getStatusMessage());
            record.setLastModifiedBy(request.getOperator());

            addProcessingLog(record, "STATUS_UPDATE", "状态变更",
                    request.getTargetStatus().name(), "SUCCESS", request.getReason(), request.getOperator());

            return provenanceRepository.save(record);
        });
    }

    @Transactional
    public Optional<ProvenanceRecord> approveException(String id, ExceptionApprovalRequest request) {
        return provenanceRepository.findById(id).map(record -> {
            ExceptionRequest exception = record.getExceptionRequest();
            if (exception == null) {
                exception = new ExceptionRequest();
            }

            exception.setApprover(request.getApprover());
            exception.setApprovalTimestamp(System.currentTimeMillis());
            exception.setApprovalComment(request.getApprovalComment());
            exception.setApproved(request.getApproved());

            record.setExceptionRequest(exception);
            record.setStatus(request.getApproved() ? ProvenanceStatus.EXCEPTION_APPROVED : ProvenanceStatus.EXCEPTION_REJECTED);
            record.setStatusMessage(request.getApproved() ? "例外申请已批准" : "例外申请已拒绝");
            record.setLastModifiedBy(request.getApprover());

            addProcessingLog(record, "EXCEPTION_APPROVAL",
                    request.getApproved() ? "批准例外" : "拒绝例外",
                    null, "SUCCESS", request.getApprovalComment(), request.getApprover());

            return provenanceRepository.save(record);
        });
    }

    @Transactional
    public Optional<ProvenanceRecord> manualCorrect(String id, ManualCorrectionRequest request) {
        return provenanceRepository.findById(id).map(record -> {
            if (request.getImageTag() != null) record.setImageTag(request.getImageTag());
            if (request.getImageDigest() != null) record.setImageDigest(request.getImageDigest());
            if (request.getRegistry() != null) record.setRegistry(request.getRegistry());
            if (request.getRepository() != null) record.setRepository(request.getRepository());
            if (request.getSourceCommit() != null) record.setSourceCommit(request.getSourceCommit());
            if (request.getBuildPipeline() != null) record.setBuildPipeline(request.getBuildPipeline());
            if (request.getSignatureResult() != null) record.setSignatureResult(request.getSignatureResult());
            if (request.getExceptionRequest() != null) record.setExceptionRequest(request.getExceptionRequest());

            record.setStatus(ProvenanceStatus.MANUALLY_CORRECTED);
            record.setStatusMessage("人工修正完成: " + request.getCorrectionReason());
            record.setLastModifiedBy(request.getOperator());

            addProcessingLog(record, "MANUAL_CORRECTION", "人工修正",
                    request.getCorrectionReason(), "SUCCESS", "人工修正数据", request.getOperator());

            performVerification(record);

            return record;
        });
    }

    public String exportProvenancePackage(String id) throws JsonProcessingException {
        return provenanceRepository.findById(id)
                .map(record -> {
                    try {
                        return objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(record);
                    } catch (JsonProcessingException e) {
                        throw new RuntimeException("导出证明包失败", e);
                    }
                })
                .orElseThrow(() -> new IllegalArgumentException("记录不存在: " + id));
    }

    private void addProcessingLog(ProvenanceRecord record, String step, String action,
                                  String input, String result, String message, String operator) {
        ProcessingLog log = new ProcessingLog(
                System.currentTimeMillis(),
                step,
                action,
                input,
                result,
                message,
                operator
        );
        record.addProcessingLog(log);
    }

    @Transactional
    public void initSampleData() {
        if (provenanceRepository.count() > 0) {
            log.info("已有数据，跳过样例数据初始化");
            return;
        }

        log.info("初始化样例数据...");

        ProvenanceSubmitRequest sample1 = new ProvenanceSubmitRequest();
        sample1.setImageTag("registry.example.com/app/web:v1.0.0");
        sample1.setImageDigest("sha256:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890");
        sample1.setRegistry("registry.example.com");
        sample1.setRepository("app/web");
        sample1.setSourceCommit(new SourceCommit(
                "https://github.com/example/app-web",
                "main",
                "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0",
                "dev@example.com",
                "feat: 新增用户认证功能",
                System.currentTimeMillis() - 86400000
        ));
        sample1.setBuildPipeline(new BuildPipeline(
                "pipeline-001",
                "web-app-build",
                "1234",
                "https://ci.example.com/pipelines/1234",
                "runner-01",
                System.currentTimeMillis() - 7200000,
                System.currentTimeMillis() - 3600000,
                "SUCCESS"
        ));
        sample1.setSignatureResult(new SignatureResult(
                "ECDSA",
                "MEUCIQD...",
                "CN=build-robot,O=Example Corp",
                "-----BEGIN CERTIFICATE-----\n...",
                System.currentTimeMillis() - 1800000,
                "TRUE",
                "签名验证通过"
        ));
        sample1.setSubmittedBy("ci-bot");
        sample1.setRawInput("{\"imageTag\": \"registry.example.com/app/web:v1.0.0\"}");
        submitProvenance(sample1);

        ProvenanceSubmitRequest sample2 = new ProvenanceSubmitRequest();
        sample2.setImageTag("registry.example.com/app/api:v2.1.0");
        sample2.setImageDigest("sha256:0987654321fedcba0987654321fedcba0987654321fedcba0987654321fedcba");
        sample2.setRegistry("registry.example.com");
        sample2.setRepository("app/api");
        sample2.setSourceCommit(new SourceCommit(
                "https://github.com/example/app-api",
                "develop",
                "b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1",
                "api-dev@example.com",
                "fix: 修复数据库连接问题",
                System.currentTimeMillis() - 172800000
        ));
        sample2.setBuildPipeline(new BuildPipeline(
                "pipeline-002",
                "api-app-build",
                "5678",
                "https://ci.example.com/pipelines/5678",
                "runner-02",
                System.currentTimeMillis() - 14400000,
                System.currentTimeMillis() - 10800000,
                "SUCCESS"
        ));
        sample2.setSignatureResult(new SignatureResult(
                "RSA",
                null,
                null,
                null,
                System.currentTimeMillis() - 7200000,
                "FALSE",
                "签名验证失败: 证书已过期"
        ));
        sample2.setSubmittedBy("ci-bot");
        sample2.setRawInput("{\"imageTag\": \"registry.example.com/app/api:v2.1.0\"}");
        submitProvenance(sample2);

        ProvenanceSubmitRequest sample3 = new ProvenanceSubmitRequest();
        sample3.setImageTag("registry.example.com/infra/nginx:1.25.3");
        sample3.setImageDigest("sha256:11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff");
        sample3.setRegistry("registry.example.com");
        sample3.setRepository("infra/nginx");
        sample3.setSourceCommit(null);
        sample3.setBuildPipeline(null);
        sample3.setSignatureResult(null);
        sample3.setExceptionRequest(new ExceptionRequest(
                UUID.randomUUID().toString(),
                "sec@example.com",
                "第三方镜像，无需内部构建",
                System.currentTimeMillis() - 259200000L,
                null,
                null,
                null,
                null
        ));
        sample3.setSubmittedBy("ops-team");
        sample3.setRawInput("{\"imageTag\": \"registry.example.com/infra/nginx:1.25.3\", \"exception\": true}");
        submitProvenance(sample3);

        log.info("样例数据初始化完成，共3条记录");
    }
}
