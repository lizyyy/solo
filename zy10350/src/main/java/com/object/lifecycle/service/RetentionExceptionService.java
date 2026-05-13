package com.object.lifecycle.service;

import com.object.lifecycle.entity.RetentionException;
import com.object.lifecycle.repository.RetentionExceptionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class RetentionExceptionService {

    private final RetentionExceptionRepository exceptionRepository;

    public boolean hasActiveException(String objectKey, String bucketName) {
        List<RetentionException> exceptions = exceptionRepository.findActiveExceptions(
                objectKey, bucketName, LocalDateTime.now());
        return !exceptions.isEmpty();
    }

    public List<RetentionException> getActiveExceptions(String objectKey, String bucketName) {
        return exceptionRepository.findActiveExceptions(objectKey, bucketName, LocalDateTime.now());
    }

    public RetentionException createException(RetentionException exception) {
        if (exceptionRepository.existsByObjectKeyAndBucketNameAndRuleId(
                exception.getObjectKey(), exception.getBucketName(),
                exception.getRule() != null ? exception.getRule().getId() : null)) {
            throw new IllegalArgumentException("该对象已存在保留例外");
        }
        return exceptionRepository.save(exception);
    }
}
