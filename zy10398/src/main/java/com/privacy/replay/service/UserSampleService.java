package com.privacy.replay.service;

import com.privacy.replay.exception.BusinessException;
import com.privacy.replay.exception.ErrorCode;
import com.privacy.replay.model.UserSample;
import com.privacy.replay.repository.UserSampleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class UserSampleService {

    private final UserSampleRepository userSampleRepository;

    public UserSample getSampleBySampleId(String sampleId) {
        return userSampleRepository.findBySampleId(sampleId)
                .orElseThrow(() -> new BusinessException(ErrorCode.SAMPLE_NOT_FOUND));
    }

    public List<UserSample> getSamplesByUserId(String userId) {
        return userSampleRepository.findByUserIdAndIsActiveTrue(userId);
    }

    @Transactional(rollbackFor = Exception.class)
    public UserSample createSample(String userId, String dataType, String sampleData,
                                  Integer sensitivityScore) {
        UserSample sample = new UserSample();
        sample.setSampleId("SMP" + UUID.randomUUID().toString().replace("-", "").substring(0, 16));
        sample.setUserId(userId);
        sample.setDataType(dataType);
        sample.setSampleData(sampleData);
        sample.setSensitivityScore(sensitivityScore);
        sample.setExpiredAt(LocalDateTime.now().plusDays(90));
        return userSampleRepository.save(sample);
    }

    public void validateSamples(List<String> sampleIds) {
        Set<String> uniqueIds = new HashSet<>(sampleIds);
        List<UserSample> samples = userSampleRepository.findBySampleIdIn(uniqueIds);
        if (samples.size() != uniqueIds.size()) {
            throw new BusinessException(ErrorCode.SAMPLE_NOT_FOUND);
        }
        for (UserSample sample : samples) {
            if (!sample.getIsActive()) {
                throw new BusinessException(ErrorCode.SAMPLE_INACTIVE);
            }
        }
    }

    public String applyMasking(String data, int level) {
        if (data == null) return null;
        switch (level) {
            case 0:
                return data;
            case 1:
                return data.replaceAll("(\\d{3})\\d{4}(\\d{4})", "$1****$2");
            case 2:
                return data.replaceAll("([\\u4e00-\\u9fa5]{2})", "$1*").replaceAll("(\\d{2})\\d+(\\d{2})", "$1****$2");
            case 3:
                return data.replaceAll(".", "*");
            case 4:
                return "******";
            default:
                return data.replaceAll(".", "*");
        }
    }

    @Scheduled(cron = "0 0 3 * * ?")
    @Transactional(rollbackFor = Exception.class)
    public void expireOldSamples() {
        List<UserSample> expiredSamples = userSampleRepository
                .findByExpiredAtBeforeAndIsActiveTrue(LocalDateTime.now());
        for (UserSample sample : expiredSamples) {
            sample.setIsActive(false);
            userSampleRepository.save(sample);
        }
        log.info("Expired {} samples", expiredSamples.size());
    }
}
