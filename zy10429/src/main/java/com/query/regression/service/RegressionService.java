package com.query.regression.service;

import com.query.regression.dto.ConfirmRequest;
import com.query.regression.dto.CreateRegressionRequest;
import com.query.regression.dto.ManualCorrectionRequest;
import com.query.regression.dto.RegressionDetailDTO;
import com.query.regression.entity.*;
import com.query.regression.enums.ConclusionType;
import com.query.regression.enums.RegressionStatus;
import com.query.regression.enums.RiskLevel;
import com.query.regression.repository.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class RegressionService {

    private final RegressionRecordRepository recordRepository;
    private final QueryParameterRepository parameterRepository;
    private final QueryTemplateRepository templateRepository;
    private final PlanComparisonService planComparisonService;
    private final StatusMachineService statusMachineService;
    private final ObjectMapper objectMapper;

    @Transactional
    public RegressionRecord createRegression(CreateRegressionRequest request) {
        log.info("创建回归记录: {}", request.getQueryName());
        
        templateRepository.findById(request.getTemplateId())
                .orElseThrow(() -> new IllegalArgumentException("模板不存在: " + request.getTemplateId()));

        RegressionRecord record = new RegressionRecord();
        record.setQueryName(request.getQueryName());
        record.setTemplateId(request.getTemplateId());
        record.setCreatedBy(request.getCreatedBy());
        record.setStatus(RegressionStatus.CREATED);
        
        try {
            record.setRawInput(objectMapper.writeValueAsString(request));
        } catch (Exception e) {
            record.setRawInput(request.toString());
        }
        
        record = recordRepository.save(record);
        saveParameters(record.getId(), request.getParameters());
        
        try {
            statusMachineService.transition(record, RegressionStatus.COMPARING);
            ExecutionPlan oldPlan = planComparisonService.parseAndSavePlan(
                    record.getId(), "OLD", request.getOldPlan());
            ExecutionPlan newPlan = planComparisonService.parseAndSavePlan(
                    record.getId(), "NEW", request.getNewPlan());
            
            List<PlanDifference> differences = planComparisonService.comparePlans(
                    record.getId(), oldPlan, newPlan);
            
            RiskLevel overallRisk = planComparisonService.calculateOverallRisk(differences);
            double costDiff = planComparisonService.calculateCostDiffPercentage(oldPlan, newPlan);
            
            record.setRiskLevel(overallRisk);
            record.setCostDiffPercentage(costDiff);
            record.setPlanDiffCount(differences.size());
            record.setConclusion(determineInitialConclusion(overallRisk, costDiff));
            
            statusMachineService.transition(record, RegressionStatus.ANALYZED);
            log.info("回归分析完成: 风险等级={}, 成本变化={}%", overallRisk, costDiff);
            
        } catch (Exception e) {
            log.error("回归分析失败", e);
            record.setErrorMessage(e.getMessage());
            record.setStackTrace(org.apache.commons.lang3.exception.ExceptionUtils.getStackTrace(e));
            statusMachineService.transition(record, RegressionStatus.ERROR);
        }
        
        return recordRepository.save(record);
    }

    private ConclusionType determineInitialConclusion(RiskLevel riskLevel, double costDiff) {
        if (costDiff < 0) {
            return ConclusionType.IMPROVED;
        }
        return switch (riskLevel) {
            case LOW -> ConclusionType.NO_CHANGE;
            case MEDIUM, HIGH -> ConclusionType.NEEDS_ATTENTION;
            case CRITICAL -> ConclusionType.REGRESSED;
        };
    }

    private void saveParameters(Long recordId, Map<String, Object> parameters) {
        if (parameters == null || parameters.isEmpty()) {
            return;
        }
        
        parameters.forEach((key, value) -> {
            QueryParameter param = new QueryParameter();
            param.setRegressionRecordId(recordId);
            param.setParamKey(key);
            param.setParamValue(value != null ? value.toString() : null);
            param.setParamType(value != null ? value.getClass().getSimpleName() : null);
            param.setNormalized(true);
            parameterRepository.save(param);
        });
    }

    public RegressionDetailDTO getRegressionDetail(Long recordId) {
        RegressionRecord record = recordRepository.findById(recordId)
                .orElseThrow(() -> new IllegalArgumentException("回归记录不存在: " + recordId));
        
        List<QueryParameter> parameters = parameterRepository.findByRegressionRecordId(recordId);
        List<ExecutionPlan> plans = new ArrayList<>();
        try {
            plans = new java.util.ArrayList<>(planRepository.findByRegressionRecordId(recordId).stream().toList());
        } catch (Exception e) {
            log.warn("获取执行计划失败", e);
        }
        
        ExecutionPlan oldPlan = plans.stream()
                .filter(p -> "OLD".equals(p.getPlanType()))
                .findFirst()
                .orElse(null);
        ExecutionPlan newPlan = plans.stream()
                .filter(p -> "NEW".equals(p.getPlanType()))
                .findFirst()
                .orElse(null);
        
        List<PlanDifference> differences = differenceRepository.findByRegressionRecordId(recordId);
        
        return RegressionDetailDTO.builder()
                .record(record)
                .parameters(parameters)
                .oldPlan(oldPlan)
                .newPlan(newPlan)
                .differences(differences)
                .build();
    }

    private final ExecutionPlanRepository planRepository;
    private final PlanDifferenceRepository differenceRepository;

    public List<RegressionRecord> getAllRegressions() {
        return recordRepository.findAll();
    }

    public List<RegressionRecord> getRegressionsByStatus(RegressionStatus status) {
        return recordRepository.findByStatus(status);
    }

    @Transactional
    public RegressionRecord confirmRegression(Long recordId, ConfirmRequest request) {
        RegressionRecord record = recordRepository.findById(recordId)
                .orElseThrow(() -> new IllegalArgumentException("回归记录不存在: " + recordId));
        
        if (record.getStatus() != RegressionStatus.ANALYZED) {
            throw new IllegalStateException("只有ANALYZED状态的记录才能确认");
        }
        
        record.setConclusion(request.getConclusion());
        record.setConclusionNotes(request.getConclusionNotes());
        record.setConfirmedBy(request.getConfirmedBy());
        record.setConfirmedAt(LocalDateTime.now());
        
        return statusMachineService.transition(record, RegressionStatus.CONFIRMED);
    }

    @Transactional
    public RegressionRecord retryAnalysis(Long recordId) {
        RegressionRecord record = recordRepository.findById(recordId)
                .orElseThrow(() -> new IllegalArgumentException("回归记录不存在: " + recordId));
        
        if (record.getStatus() != RegressionStatus.ERROR) {
            throw new IllegalStateException("只有ERROR状态的记录才能重试");
        }
        
        record.setErrorMessage(null);
        record.setStackTrace(null);
        
        return statusMachineService.transition(record, RegressionStatus.COMPARING);
    }

    @Transactional
    public RegressionRecord manualCorrect(Long recordId, ManualCorrectionRequest request) {
        RegressionRecord record = recordRepository.findById(recordId)
                .orElseThrow(() -> new IllegalArgumentException("回归记录不存在: " + recordId));
        
        if (request.getRiskLevel() != null) {
            record.setRiskLevel(request.getRiskLevel());
        }
        if (request.getConclusion() != null) {
            record.setConclusion(request.getConclusion());
        }
        if (request.getConclusionNotes() != null) {
            record.setConclusionNotes(request.getConclusionNotes());
        }
        
        String notes = record.getConclusionNotes() != null ? record.getConclusionNotes() : "";
        notes += String.format("\n[人工修正] 由 %s 在 %s 修正", 
                request.getCorrectedBy(), LocalDateTime.now());
        record.setConclusionNotes(notes);
        
        log.info("人工修正回归记录: {} by {}", recordId, request.getCorrectedBy());
        return recordRepository.save(record);
    }
}
