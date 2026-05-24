package com.factory.gauge.service;

import com.factory.gauge.entity.*;
import com.factory.gauge.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class DataValidationService {

    private final MeasuringToolRepository measuringToolRepository;
    private final ProductBatchRepository productBatchRepository;
    private final ReinspectionRecordRepository reinspectionRecordRepository;
    private final DeactivationRecordRepository deactivationRecordRepository;
    private final CalibrationReportRepository calibrationReportRepository;

    public Map<String, Object> performFullValidation() {
        Map<String, Object> result = new HashMap<>();
        List<String> errors = new ArrayList<>();
        List<String> warnings = new ArrayList<>();
        Map<String, Object> stats = new HashMap<>();

        int gaugeCount = (int) measuringToolRepository.count();
        int batchCount = (int) productBatchRepository.count();
        int reinspectionCount = (int) reinspectionRecordRepository.count();
        int deactivationCount = (int) deactivationRecordRepository.count();
        int reportCount = (int) calibrationReportRepository.count();

        stats.put("gaugeCount", gaugeCount);
        stats.put("batchCount", batchCount);
        stats.put("reinspectionCount", reinspectionCount);
        stats.put("deactivationCount", deactivationCount);
        stats.put("reportCount", reportCount);

        validateGaugeBatchConsistency(errors, warnings);
        validateBatchReinspectionConsistency(errors, warnings);
        validateGaugeDeactivationConsistency(errors, warnings);
        validateGaugeCalibrationConsistency(errors, warnings);
        validateGaugeStatusConsistency(errors, warnings);

        result.put("isValid", errors.isEmpty());
        result.put("errors", errors);
        result.put("warnings", warnings);
        result.put("stats", stats);

        return result;
    }

    private void validateGaugeBatchConsistency(List<String> errors, List<String> warnings) {
        List<ProductBatch> batches = productBatchRepository.findAll();
        for (ProductBatch batch : batches) {
            Optional<MeasuringTool> gauge = measuringToolRepository.findById(batch.getToolId());
            if (gauge.isEmpty()) {
                errors.add("批次 " + batch.getBatchNo() + " 关联的量具ID " + batch.getToolId() + " 不存在");
            } else if (!gauge.get().getToolNo().equals(batch.getToolNo())) {
                errors.add("批次 " + batch.getBatchNo() + " 的量具编号不一致，记录的是 " + batch.getToolNo() + "，实际是 " + gauge.get().getToolNo());
            }
        }
    }

    private void validateBatchReinspectionConsistency(List<String> errors, List<String> warnings) {
        List<ProductBatch> batches = productBatchRepository.findAll();
        for (ProductBatch batch : batches) {
            List<ReinspectionRecord> records = reinspectionRecordRepository.findByBatchId(batch.getId());
            
            if (batch.getStatus().name().equals("REINSPECTED") && records.isEmpty()) {
                errors.add("批次 " + batch.getBatchNo() + " 状态为已复检，但没有复检记录");
            }

            for (ReinspectionRecord record : records) {
                if (!record.getBatchNo().equals(batch.getBatchNo())) {
                    errors.add("复检记录 " + record.getId() + " 的批次编号不一致");
                }
            }
        }
    }

    private void validateGaugeDeactivationConsistency(List<String> errors, List<String> warnings) {
        List<MeasuringTool> gauges = measuringToolRepository.findAll();
        for (MeasuringTool gauge : gauges) {
            Long activeCount = deactivationRecordRepository.countActiveDeactivationsByToolId(gauge.getId());
            
            if (gauge.getStatus().name().equals("DEACTIVATED") && activeCount == 0) {
                errors.add("量具 " + gauge.getToolNo() + " 状态为已停用，但没有生效的停用记录");
            }
            
            if (activeCount > 0 && !gauge.getStatus().name().equals("DEACTIVATED")) {
                warnings.add("量具 " + gauge.getToolNo() + " 有生效的停用记录，但状态不是已停用");
            }
        }
    }

    private void validateGaugeCalibrationConsistency(List<String> errors, List<String> warnings) {
        List<MeasuringTool> gauges = measuringToolRepository.findAll();
        for (MeasuringTool gauge : gauges) {
            Optional<CalibrationReport> latestReport = calibrationReportRepository.findTopByToolIdOrderByCreatedAtDesc(gauge.getId());
            
            if (latestReport.isPresent()) {
                CalibrationReport report = latestReport.get();
                if (!report.getCertificateNo().equals(gauge.getCalibrationCertificateNo())) {
                    errors.add("量具 " + gauge.getToolNo() + " 的校准证书编号与最新报告不一致");
                }
                if (!report.getVersion().equals(gauge.getCertificateVersion())) {
                    warnings.add("量具 " + gauge.getToolNo() + " 的证书版本可能不是最新的");
                }
                if (!report.getValidUntilDate().equals(gauge.getValidUntilDate())) {
                    errors.add("量具 " + gauge.getToolNo() + " 的有效期与最新报告不一致");
                }
            }
        }
    }

    private void validateGaugeStatusConsistency(List<String> errors, List<String> warnings) {
        List<MeasuringTool> gauges = measuringToolRepository.findAll();
        for (MeasuringTool gauge : gauges) {
            boolean shouldBeExpired = gauge.isExpired();
            boolean isMarkedExpired = gauge.getStatus().name().equals("EXPIRED");
            
            if (shouldBeExpired && !isMarkedExpired && gauge.getStatus().name().equals("NORMAL")) {
                warnings.add("量具 " + gauge.getToolNo() + " 已过有效期，但状态未更新");
            }
        }
    }

    public Map<String, Object> validateGaugeTraceability(String toolNo) {
        Map<String, Object> result = new HashMap<>();
        List<String> traceLog = new ArrayList<>();
        boolean isValid = true;

        MeasuringTool gauge = measuringToolRepository.findByToolNo(toolNo).orElse(null);
        if (gauge == null) {
            result.put("found", false);
            result.put("isValid", false);
            result.put("message", "量具不存在");
            return result;
        }

        traceLog.add("量具基本信息: " + gauge.getToolName() + ", 状态: " + gauge.getStatus().getDisplayName());
        traceLog.add("校准证书: " + gauge.getCalibrationCertificateNo() + " (v" + gauge.getCertificateVersion() + ")");
        traceLog.add("有效期: " + gauge.getCalibrationDate() + " ~ " + gauge.getValidUntilDate());

        List<ProductBatch> batches = productBatchRepository.findByToolId(gauge.getId());
        traceLog.add("关联批次数量: " + batches.size());
        
        for (ProductBatch batch : batches) {
            traceLog.add("  - 批次: " + batch.getBatchNo() + ", 状态: " + batch.getStatus().getDisplayName());
            List<ReinspectionRecord> records = reinspectionRecordRepository.findByBatchId(batch.getId());
            for (ReinspectionRecord record : records) {
                traceLog.add("    * 复检记录: 结果=" + record.getResult().getDisplayName() + 
                    ", 检验员=" + record.getInspector() +
                    (record.getIsCorrected() ? " [已修正]" : ""));
            }
        }

        List<DeactivationRecord> deactivations = deactivationRecordRepository.findByToolId(gauge.getId());
        if (!deactivations.isEmpty()) {
            traceLog.add("停用记录: " + deactivations.size() + " 条");
            for (DeactivationRecord d : deactivations) {
                traceLog.add("  - " + d.getReason() + ", 操作人: " + d.getOperator() + 
                    (d.getIsActive() ? " [生效中]" : ""));
            }
        }

        List<CalibrationReport> reports = calibrationReportRepository.findByToolId(gauge.getId());
        traceLog.add("校准报告: " + reports.size() + " 份");

        result.put("found", true);
        result.put("isValid", isValid);
        result.put("gauge", gauge);
        result.put("batches", batches);
        result.put("traceLog", traceLog);

        return result;
    }
}
