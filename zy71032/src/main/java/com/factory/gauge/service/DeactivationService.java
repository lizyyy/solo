package com.factory.gauge.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.factory.gauge.dto.request.DeactivationRequest;
import com.factory.gauge.entity.DeactivationRecord;
import com.factory.gauge.entity.MeasuringTool;
import com.factory.gauge.exception.BusinessException;
import com.factory.gauge.repository.DeactivationRecordRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
public class DeactivationService {


    private static final Logger log = LoggerFactory.getLogger(DeactivationService.class);
    private final DeactivationRecordRepository deactivationRecordRepository;

    public DeactivationService(DeactivationRecordRepository deactivationRecordRepository, MeasuringToolService measuringToolService) {
        this.deactivationRecordRepository = deactivationRecordRepository;
        this.measuringToolService = measuringToolService;
    }
    private final MeasuringToolService measuringToolService;

    @Transactional
    public DeactivationRecord deactivateGauge(DeactivationRequest request) {
        MeasuringTool gauge = measuringToolService.getGaugeByToolNo(request.getToolNo());

        Optional<DeactivationRecord> existingActive = deactivationRecordRepository.findByToolIdAndIsActiveTrue(gauge.getId());
        if (existingActive.isPresent()) {
            throw new BusinessException("该量具已有生效的停用记录");
        }

        DeactivationRecord record = new DeactivationRecord();
        record.setToolId(gauge.getId());
        record.setToolNo(gauge.getToolNo());
        record.setReason(request.getReason());
        record.setDescription(request.getDescription());
        record.setOperator(request.getOperator());
        record.setDeactivatedAt(LocalDateTime.now());
        record.setRemarks(request.getRemarks());
        record.setCreatedBy(request.getOperator());
        record.setUpdatedBy(request.getOperator());
        record.setIsActive(true);

        measuringToolService.deactivateGauge(request.getToolNo(), request.getReason(), request.getOperator());

        return deactivationRecordRepository.save(record);
    }

    @Transactional
    public DeactivationRecord reactivateGauge(String toolNo, String reactivationRemark, String operator) {
        MeasuringTool gauge = measuringToolService.getGaugeByToolNo(toolNo);

        DeactivationRecord activeRecord = deactivationRecordRepository.findByToolIdAndIsActiveTrue(gauge.getId())
                .orElseThrow(() -> new BusinessException("该量具没有生效的停用记录"));

        activeRecord.setReactivatedAt(LocalDateTime.now());
        activeRecord.setReactivatedBy(operator);
        activeRecord.setReactivationRemark(reactivationRemark);
        activeRecord.setIsActive(false);
        activeRecord.setUpdatedBy(operator);

        measuringToolService.reactivateGauge(toolNo, operator);

        return deactivationRecordRepository.save(activeRecord);
    }

    public List<DeactivationRecord> getRecordsByToolNo(String toolNo) {
        return deactivationRecordRepository.findByToolNo(toolNo);
    }

    public Optional<DeactivationRecord> getActiveRecordByToolId(Long toolId) {
        return deactivationRecordRepository.findByToolIdAndIsActiveTrue(toolId);
    }

    public List<DeactivationRecord> getAllRecords() {
        return deactivationRecordRepository.findAll();
    }

    public Long countActiveDeactivationsByToolId(Long toolId) {
        return deactivationRecordRepository.countActiveDeactivationsByToolId(toolId);
    }
}
