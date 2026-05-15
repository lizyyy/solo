package com.crossborder.approval.service;

import com.crossborder.approval.exception.BusinessException;
import com.crossborder.approval.model.entity.AccessToken;
import com.crossborder.approval.model.entity.DataAccessApplication;
import com.crossborder.approval.model.enums.ApplicationStatus;
import com.crossborder.approval.repository.AccessTokenRepository;
import com.crossborder.approval.repository.DataAccessApplicationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class TokenService {

    private final AccessTokenRepository tokenRepository;
    private final DataAccessApplicationRepository applicationRepository;
    private final AuditService auditService;
    private final EvidenceService evidenceService;

    @Transactional
    public AccessToken issueToken(Long applicationId, String operatorId, String operatorName) {
        DataAccessApplication application = applicationRepository.findById(applicationId)
                .orElseThrow(() -> new BusinessException("申请不存在: " + applicationId));

        if (application.getStatus() != ApplicationStatus.APPROVED) {
            throw new BusinessException("只有审批通过的申请可以签发令牌");
        }

        if (tokenRepository.existsByApplicationId(applicationId)) {
            throw new BusinessException("该申请已签发过令牌");
        }

        LocalDateTime now = LocalDateTime.now();
        LocalDateTime expiresAt = application.getAccessEndTime() != null 
                ? application.getAccessEndTime() 
                : now.plusHours(24);

        AccessToken token = new AccessToken();
        token.setToken(generateToken());
        token.setApplication(application);
        token.setIssuedTo(application.getApplicantId());
        token.setIssuedAt(now);
        token.setExpiresAt(expiresAt);
        token.setIsActive(true);
        token.setAccessCount(0L);

        token = tokenRepository.save(token);

        application.setStatus(ApplicationStatus.TOKEN_ISSUED);
        applicationRepository.save(application);

        auditService.logTokenAction(token, "TOKEN_ISSUED",
                operatorId, operatorName,
                "令牌签发成功，有效期至: " + expiresAt);

        evidenceService.collectEvidence(application, token, "TOKEN_ISSUANCE",
                "令牌签发，申请编号: " + application.getApplicationNo() + 
                ", 签发人: " + operatorName, operatorId, operatorName);

        log.info("令牌签发成功: {}", token.getToken().substring(0, 16) + "...");
        return token;
    }

    @Transactional
    public boolean validateToken(String tokenValue) {
        AccessToken token = tokenRepository.findByToken(tokenValue)
                .orElse(null);

        if (token == null) {
            log.warn("令牌不存在: {}", tokenValue.substring(0, Math.min(16, tokenValue.length())) + "...");
            return false;
        }

        if (!Boolean.TRUE.equals(token.getIsActive())) {
            log.warn("令牌已停用: {}", tokenValue.substring(0, 16) + "...");
            return false;
        }

        if (LocalDateTime.now().isAfter(token.getExpiresAt())) {
            log.warn("令牌已过期: {}", tokenValue.substring(0, 16) + "...");
            token.setIsActive(false);
            token.getApplication().setStatus(ApplicationStatus.TOKEN_EXPIRED);
            tokenRepository.save(token);
            applicationRepository.save(token.getApplication());
            return false;
        }

        token.setAccessCount(token.getAccessCount() + 1);
        token.setLastAccessTime(LocalDateTime.now());
        tokenRepository.save(token);

        return true;
    }

    @Transactional
    public void revokeToken(Long tokenId, String reason, String operatorId, String operatorName) {
        AccessToken token = tokenRepository.findById(tokenId)
                .orElseThrow(() -> new BusinessException("令牌不存在: " + tokenId));

        if (!Boolean.TRUE.equals(token.getIsActive())) {
            throw new BusinessException("令牌已处于非活跃状态");
        }

        token.setIsActive(false);
        token.setRevokedAt(LocalDateTime.now());
        token.setRevokeReason(reason);
        tokenRepository.save(token);

        token.getApplication().setStatus(ApplicationStatus.TOKEN_REVOKED);
        applicationRepository.save(token.getApplication());

        auditService.logTokenAction(token, "TOKEN_REVOKED",
                operatorId, operatorName,
                "令牌被吊销，原因: " + reason);

        evidenceService.collectEvidence(token.getApplication(), token, "TOKEN_REVOCATION",
                "令牌被吊销，原因: " + reason, operatorId, operatorName);
    }

    public AccessToken getTokenByApplication(Long applicationId) {
        return tokenRepository.findByApplicationId(applicationId).orElse(null);
    }

    private String generateToken() {
        return "CB-TOKEN-" + UUID.randomUUID().toString().toUpperCase().replace("-", "");
    }
}
