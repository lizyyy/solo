package com.example.readonlywindow.service;

import com.example.readonlywindow.entity.*;
import com.example.readonlywindow.exception.BusinessException;
import com.example.readonlywindow.exception.ResourceNotFoundException;
import com.example.readonlywindow.repository.ReleaseCredentialRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class ReleaseCredentialService {
    private final ReleaseCredentialRepository credentialRepository;
    private final FreezeWindowService windowService;
    private final WriteRequestService requestService;
    private final TimelineService timelineService;

    @Transactional
    public ReleaseCredential issueCredential(String windowCode, String requestCode,
                                             String issuedTo, String issuedBy, String auditNotes) {
        FreezeWindow window = windowService.getWindowByCode(windowCode);
        WriteRequest request = null;

        if (requestCode != null) {
            request = requestService.getRequestByCode(requestCode);
            if (request.getStatus() != RequestStatus.APPROVED) {
                throw new BusinessException("REQUEST_NOT_APPROVED", "只有已批准的请求才能发放凭证");
            }
        }

        String credentialCode;
        do {
            credentialCode = "CRD-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        } while (credentialRepository.existsByCredentialCode(credentialCode));

        ReleaseCredential credential = new ReleaseCredential();
        credential.setCredentialCode(credentialCode);
        credential.setFreezeWindow(window);
        credential.setWriteRequest(request);
        credential.setIssuedTo(issuedTo);
        credential.setIssuedBy(issuedBy);
        credential.setIssuedAt(LocalDateTime.now());
        credential.setValidUntil(window.getEndTime());
        credential.setUsed(false);
        credential.setAuditNotes(auditNotes);

        ReleaseCredential savedCredential = credentialRepository.save(credential);

        timelineService.createEvent(
                EventType.CREDENTIAL_ISSUED,
                window.getId(),
                request != null ? request.getId() : null,
                savedCredential.getId(),
                null,
                issuedBy,
                "发放解除凭证",
                "凭证编码: " + credentialCode + ", 发放给: " + issuedTo
        );

        return savedCredential;
    }

    @Transactional
    public ReleaseCredential useCredential(String credentialCode, String usedBy) {
        ReleaseCredential credential = getCredentialByCode(credentialCode);

        if (credential.isUsed()) {
            throw new BusinessException("CREDENTIAL_USED", "凭证已使用");
        }

        if (credential.getValidUntil().isBefore(LocalDateTime.now())) {
            throw new BusinessException("CREDENTIAL_EXPIRED", "凭证已过期");
        }

        credential.setUsed(true);
        credential.setUsedAt(LocalDateTime.now());
        credential.setUsedBy(usedBy);

        timelineService.createEvent(
                EventType.CREDENTIAL_USED,
                credential.getFreezeWindow().getId(),
                credential.getWriteRequest() != null ? credential.getWriteRequest().getId() : null,
                credential.getId(),
                null,
                usedBy,
                "使用解除凭证",
                "凭证编码: " + credentialCode
        );

        return credentialRepository.save(credential);
    }

    public ReleaseCredential getCredentialByCode(String credentialCode) {
        return credentialRepository.findByCredentialCode(credentialCode)
                .orElseThrow(() -> new ResourceNotFoundException("解除凭证", credentialCode));
    }

    public List<ReleaseCredential> getCredentialsByWindow(String windowCode) {
        FreezeWindow window = windowService.getWindowByCode(windowCode);
        return credentialRepository.findByFreezeWindowId(window.getId());
    }

    public List<ReleaseCredential> getUnusedCredentialsByWindow(String windowCode) {
        FreezeWindow window = windowService.getWindowByCode(windowCode);
        return credentialRepository.findByFreezeWindowIdAndUsedFalse(window.getId());
    }

    public List<ReleaseCredential> getAllCredentials() {
        return credentialRepository.findAll();
    }
}
