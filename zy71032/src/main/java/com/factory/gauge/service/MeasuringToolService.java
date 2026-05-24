package com.factory.gauge.service;

import com.factory.gauge.dto.request.GaugeRegisterRequest;
import com.factory.gauge.entity.MeasuringTool;
import com.factory.gauge.entity.ProductBatch;
import com.factory.gauge.entity.enums.BatchStatus;
import com.factory.gauge.entity.enums.GaugeStatus;
import com.factory.gauge.exception.BusinessException;
import com.factory.gauge.repository.MeasuringToolRepository;
import com.factory.gauge.repository.ProductBatchRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class MeasuringToolService {

    private final MeasuringToolRepository measuringToolRepository;
    private final ProductBatchRepository productBatchRepository;
    private final StateMachineService stateMachineService;

    @Transactional
    public MeasuringTool registerGauge(GaugeRegisterRequest request) {
        if (measuringToolRepository.existsByToolNo(request.getToolNo())) {
            throw new BusinessException("量具编号已存在: " + request.getToolNo());
        }

        MeasuringTool gauge = new MeasuringTool();
        gauge.setToolNo(request.getToolNo());
        gauge.setToolName(request.getToolName());
        gauge.setSpecification(request.getSpecification());
        gauge.setCalibrationCertificateNo(request.getCalibrationCertificateNo());
        gauge.setCalibrationDate(request.getCalibrationDate());
        gauge.setValidUntilDate(request.getValidUntilDate());
        gauge.setRemarks(request.getRemarks());
        gauge.setCreatedBy(request.getOperator());
        gauge.setUpdatedBy(request.getOperator());

        if (gauge.isExpired()) {
            gauge.setStatus(GaugeStatus.EXPIRED);
        } else {
            gauge.setStatus(GaugeStatus.NORMAL);
        }

        return measuringToolRepository.save(gauge);
    }

    @Transactional
    public MeasuringTool deactivateGauge(String toolNo, String reason, String operator) {
        MeasuringTool gauge = getGaugeByToolNo(toolNo);
        
        if (gauge.getStatus() == GaugeStatus.DEACTIVATED) {
            throw new BusinessException("量具已处于停用状态");
        }

        gauge = stateMachineService.transitionGaugeStatus(gauge, GaugeStatus.DEACTIVATED, operator);
        return measuringToolRepository.save(gauge);
    }

    @Transactional
    public MeasuringTool reactivateGauge(String toolNo, String operator) {
        MeasuringTool gauge = getGaugeByToolNo(toolNo);
        
        if (gauge.getStatus() != GaugeStatus.DEACTIVATED) {
            throw new BusinessException("量具未处于停用状态");
        }

        if (gauge.isExpired()) {
            gauge = stateMachineService.transitionGaugeStatus(gauge, GaugeStatus.EXPIRED, operator);
        } else {
            gauge = stateMachineService.transitionGaugeStatus(gauge, GaugeStatus.NORMAL, operator);
        }
        
        return measuringToolRepository.save(gauge);
    }

    @Transactional
    public void checkAndUpdateExpiredStatus() {
        List<MeasuringTool> expiredTools = measuringToolRepository.findExpiredTools(LocalDate.now());
        
        for (MeasuringTool gauge : expiredTools) {
            if (gauge.getStatus() == GaugeStatus.NORMAL) {
                gauge.setStatus(GaugeStatus.EXPIRED);
                measuringToolRepository.save(gauge);
                log.info("量具 {} 已自动标记为过期状态", gauge.getToolNo());
            }
        }
    }

    public List<ProductBatch> lockExpiredToolBatches(String toolNo) {
        MeasuringTool gauge = getGaugeByToolNo(toolNo);
        return productBatchRepository.findLockedBatchesByToolId(gauge.getId());
    }

    public MeasuringTool getGaugeByToolNo(String toolNo) {
        return measuringToolRepository.findByToolNo(toolNo)
                .orElseThrow(() -> new BusinessException("量具不存在: " + toolNo));
    }

    public List<MeasuringTool> getAllGauges() {
        return measuringToolRepository.findAll();
    }

    public List<MeasuringTool> getExpiredGauges() {
        return measuringToolRepository.findByStatus(GaugeStatus.EXPIRED);
    }

    public List<MeasuringTool> getDeactivatedGauges() {
        return measuringToolRepository.findByStatus(GaugeStatus.DEACTIVATED);
    }

    public List<MeasuringTool> getExpiringGauges(int days) {
        LocalDate warningDate = LocalDate.now().plusDays(days);
        return measuringToolRepository.findExpiringTools(LocalDate.now(), warningDate);
    }

    @Transactional
    public MeasuringTool updateCalibration(String toolNo, LocalDate calibrationDate, LocalDate validUntilDate, String certificateNo, Integer version, String operator) {
        MeasuringTool gauge = getGaugeByToolNo(toolNo);
        
        gauge.setCalibrationDate(calibrationDate);
        gauge.setValidUntilDate(validUntilDate);
        gauge.setCalibrationCertificateNo(certificateNo);
        gauge.setCertificateVersion(version);
        gauge.setUpdatedBy(operator);

        if (gauge.getStatus() == GaugeStatus.EXPIRED || gauge.getStatus() == GaugeStatus.CALIBRATING) {
            gauge = stateMachineService.transitionGaugeStatus(gauge, GaugeStatus.NORMAL, operator);
        }

        return measuringToolRepository.save(gauge);
    }

    public boolean isGaugeUsable(String toolNo) {
        MeasuringTool gauge = getGaugeByToolNo(toolNo);
        return gauge.isUsable();
    }

    public void validateCertificateVersion(String certificateNo, Integer expectedVersion) {
        List<MeasuringTool> tools = measuringToolRepository.findByCalibrationCertificateNoAndCertificateVersion(
                certificateNo, expectedVersion);
        if (tools.isEmpty()) {
            throw new BusinessException("证书版本不匹配，证书号: " + certificateNo + ", 期望版本: " + expectedVersion);
        }
    }
}
