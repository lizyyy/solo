package com.promptversion.service;

import com.alibaba.fastjson.JSON;
import com.promptversion.dto.HitRecordRequest;
import com.promptversion.entity.ExceptionLog;
import com.promptversion.entity.HitRecord;
import com.promptversion.exception.BusinessException;
import com.promptversion.repository.ExceptionLogRepository;
import com.promptversion.repository.HitRecordRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class HitRecordService {

    @Autowired
    private HitRecordRepository hitRecordRepository;

    @Autowired
    private ExceptionLogRepository exceptionLogRepository;

    @Transactional
    public HitRecord recordHit(HitRecordRequest request) {
        try {
            HitRecord record = new HitRecord();
            record.setTemplateId(request.getTemplateId());
            record.setVersionId(request.getVersionId());
            record.setRequestId(request.getRequestId());
            record.setUserId(request.getUserId());
            record.setModelName(request.getModelName());
            record.setHitReason(request.getHitReason());
            record.setLatencyMs(request.getLatencyMs());

            return hitRecordRepository.save(record);
        } catch (Exception e) {
            saveExceptionLog("RECORD_HIT", JSON.toJSONString(request), e.getMessage(), request.getUserId(), e);
            throw new BusinessException(500, "记录命中失败: " + e.getMessage());
        }
    }

    public List<HitRecord> getHitRecordsByVersion(Long versionId) {
        return hitRecordRepository.findByVersionIdOrderByHitTimeDesc(versionId);
    }

    public List<HitRecord> getHitRecordsByTemplate(Long templateId) {
        return hitRecordRepository.findByTemplateIdOrderByHitTimeDesc(templateId);
    }

    public List<HitRecord> getHitRecordsByTimeRange(Long templateId, LocalDateTime startTime, LocalDateTime endTime) {
        return hitRecordRepository.findByTemplateIdAndHitTimeBetween(templateId, startTime, endTime);
    }

    private void saveExceptionLog(String operationType, String originalInput, String errorMessage, String operator, Exception e) {
        ExceptionLog log = new ExceptionLog();
        log.setOperationType(operationType);
        log.setOriginalInput(originalInput);
        log.setErrorMessage(errorMessage);
        log.setOperator(operator);
        if (e != null) {
            log.setStackTrace(getStackTrace(e));
        }
        log.setConclusion("操作失败，已记录异常日志");
        exceptionLogRepository.save(log);
    }

    private String getStackTrace(Exception e) {
        StringBuilder sb = new StringBuilder();
        for (StackTraceElement element : e.getStackTrace()) {
            sb.append(element.toString()).append("\n");
        }
        return sb.toString();
    }
}