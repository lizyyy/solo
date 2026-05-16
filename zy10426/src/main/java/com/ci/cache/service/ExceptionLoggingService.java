package com.ci.cache.service;

import com.ci.cache.model.ProcessingException;
import com.ci.cache.repository.ProcessingExceptionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.io.PrintWriter;
import java.io.StringWriter;
import java.time.LocalDateTime;
import java.util.List;

@Service
public class ExceptionLoggingService {
    private static final Logger logger = LoggerFactory.getLogger(ExceptionLoggingService.class);

    @Autowired
    private ProcessingExceptionRepository exceptionRepository;

    public ProcessingException logException(
            String operationType,
            String originalInput,
            Exception exception,
            String processingConclusion,
            String relatedApplicationId,
            String relatedCacheKey) {

        ProcessingException pe = new ProcessingException();
        pe.setOperationType(operationType);
        pe.setOriginalInput(originalInput);
        pe.setErrorMessage(exception.getMessage());
        pe.setStackTrace(getStackTraceAsString(exception));
        pe.setProcessingConclusion(processingConclusion);
        pe.setOccurredAt(LocalDateTime.now());
        pe.setRelatedApplicationId(relatedApplicationId);
        pe.setRelatedCacheKey(relatedCacheKey);

        ProcessingException saved = exceptionRepository.save(pe);
        logger.error("Logged exception: {} - {}", operationType, exception.getMessage());
        return saved;
    }

    public List<ProcessingException> getAllExceptions() {
        return exceptionRepository.findAll();
    }

    public List<ProcessingException> getExceptionsByOperation(String operationType) {
        return exceptionRepository.findByOperationType(operationType);
    }

    public List<ProcessingException> getExceptionsByApplicationId(String applicationId) {
        return exceptionRepository.findByRelatedApplicationId(applicationId);
    }

    public List<ProcessingException> getExceptionsByCacheKey(String cacheKey) {
        return exceptionRepository.findByRelatedCacheKey(cacheKey);
    }

    private String getStackTraceAsString(Exception e) {
        StringWriter sw = new StringWriter();
        PrintWriter pw = new PrintWriter(sw);
        e.printStackTrace(pw);
        String stackTrace = sw.toString();
        return stackTrace.length() > 3900 ? stackTrace.substring(0, 3900) + "..." : stackTrace;
    }
}
