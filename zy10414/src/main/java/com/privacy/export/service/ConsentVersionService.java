package com.privacy.export.service;

import com.privacy.export.entity.ConsentVersion;
import com.privacy.export.exception.BusinessException;
import com.privacy.export.exception.ErrorCode;
import com.privacy.export.repository.ConsentVersionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class ConsentVersionService {

    private final ConsentVersionRepository consentVersionRepository;

    @Transactional
    public ConsentVersion createConsentVersion(ConsentVersion request) {
        log.info("Creating consent version: {}", request.getVersionCode());

        if (consentVersionRepository.existsByVersionCode(request.getVersionCode())) {
            throw new BusinessException(ErrorCode.DUPLICATE_REQUEST_NO, 
                    "Consent version code already exists: " + request.getVersionCode());
        }

        return consentVersionRepository.save(request);
    }

    public ConsentVersion getConsentVersion(String versionCode) {
        return consentVersionRepository.findByVersionCode(versionCode)
                .orElseThrow(() -> new BusinessException(ErrorCode.CONSENT_VERSION_NOT_FOUND, versionCode));
    }

    public List<ConsentVersion> getAllActiveVersions() {
        return consentVersionRepository.findActiveValidVersions();
    }

    public List<ConsentVersion> getAllVersions() {
        return consentVersionRepository.findAll();
    }
}
