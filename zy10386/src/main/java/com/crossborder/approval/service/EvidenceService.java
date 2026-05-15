package com.crossborder.approval.service;

import com.crossborder.approval.model.entity.AccessToken;
import com.crossborder.approval.model.entity.DataAccessApplication;
import com.crossborder.approval.model.entity.EvidenceRecord;
import com.crossborder.approval.repository.EvidenceRecordRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Base64;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class EvidenceService {

    private final EvidenceRecordRepository evidenceRecordRepository;

    @Transactional
    public EvidenceRecord collectEvidence(DataAccessApplication application, AccessToken token,
                                          String evidenceType, String content,
                                          String collectorId, String collectorName) {
        EvidenceRecord record = new EvidenceRecord();
        record.setApplication(application);
        record.setAccessToken(token);
        record.setEvidenceType(evidenceType);
        record.setEvidenceContent(content);
        record.setEvidenceHash(generateHash(content));
        record.setCollectorId(collectorId);
        record.setCollectorName(collectorName);

        record = evidenceRecordRepository.save(record);
        log.info("取证记录已保存: 类型={}, 申请编号={}", evidenceType, application.getApplicationNo());
        return record;
    }

    public List<EvidenceRecord> getEvidenceByApplication(Long applicationId) {
        return evidenceRecordRepository.findByApplicationIdOrderByCollectedAtDesc(applicationId);
    }

    public List<EvidenceRecord> getEvidenceByToken(Long tokenId) {
        return evidenceRecordRepository.findByAccessTokenIdOrderByCollectedAtDesc(tokenId);
    }

    private String generateHash(String content) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(content.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(hash);
        } catch (NoSuchAlgorithmException e) {
            log.warn("SHA-256 算法不可用，跳过哈希生成", e);
            return "NO_HASH_AVAILABLE";
        }
    }
}
