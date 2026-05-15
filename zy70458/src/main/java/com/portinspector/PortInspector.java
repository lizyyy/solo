package com.portinspector;

import com.portinspector.model.BatchInfo;
import com.portinspector.model.InspectionResult;
import com.portinspector.model.InspectionSample;
import com.portinspector.model.RiskLevel;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

public class PortInspector {
    private final RuleManager ruleManager;
    private final DataStorage storage;

    public PortInspector(String dataDir) {
        this.ruleManager = new RuleManager(dataDir);
        this.storage = new DataStorage(dataDir);
    }

    private String generateBatchId() {
        String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss"));
        String uuid = UUID.randomUUID().toString().substring(0, 6);
        return "batch_" + timestamp + "_" + uuid;
    }

    private String generateSampleId() {
        return "sample_" + UUID.randomUUID().toString().substring(0, 12);
    }

    private String correctSupplier(String supplier) {
        Map<String, String> corrections = new HashMap<>();
        corrections.put("阿里", "阿里巴巴");
        corrections.put("阿里云计算", "阿里巴巴");
        corrections.put("腾讯", "腾讯科技");
        corrections.put("腾讯云", "腾讯科技");
        corrections.put("百度", "百度在线");
        corrections.put("百度云", "百度在线");
        return corrections.getOrDefault(supplier, null);
    }

    public InspectionResult inspectSample(InspectionSample sample, String ruleVersion) {
        RiskLevel portRisk = ruleManager.getPortRiskLevel(sample.getPort(), ruleVersion);
        boolean highConnections = ruleManager.isHighConnections(sample.getConnectionCount(), ruleVersion);

        RiskLevel finalRisk = portRisk;
        if (highConnections && portRisk != RiskLevel.CRITICAL) {
            finalRisk = RiskLevel.HIGH;
        }

        boolean isAnomaly = finalRisk == RiskLevel.CRITICAL || finalRisk == RiskLevel.HIGH;

        List<String> conclusionParts = new ArrayList<>();
        if (ruleManager.getRule(ruleVersion).getReservedPorts().contains(sample.getPort())) {
            conclusionParts.add("端口" + sample.getPort() + "为保留端口");
        }
        if (highConnections) {
            conclusionParts.add("连接数" + sample.getConnectionCount() + "超过阈值" + ruleManager.getRule(ruleVersion).getThresholdConnections());
        }
        conclusionParts.add("端口风险等级: " + finalRisk.getValue());
        String conclusion = String.join("，", conclusionParts);

        String portStatus;
        if (sample.getPort() < 1024) {
            portStatus = "系统端口";
        } else if (sample.getPort() < 49152) {
            portStatus = "注册端口";
        } else {
            portStatus = "动态端口";
        }

        InspectionResult result = new InspectionResult();
        result.setSampleId(sample.getSampleId());
        result.setBatchId(sample.getBatchId());
        result.setRuleVersion(ruleVersion);
        result.setRiskLevel(finalRisk);
        result.setAnomaly(isAnomaly);
        result.setConclusion(conclusion);
        result.setPortStatus(portStatus);

        Map<String, Object> details = new HashMap<>();
        details.put("portRisk", portRisk.getValue());
        details.put("highConnections", highConnections);
        details.put("portInReserved", ruleManager.getRule(ruleVersion).getReservedPorts().contains(sample.getPort()));
        details.put("ruleDescription", ruleManager.getRule(ruleVersion).getDescription());
        result.setDetails(details);

        return result;
    }

    public DuplicateCheckResult checkDuplicateSample(InspectionSample sample, String currentRuleVersion) {
        Optional<InspectionSample> existing = storage.findExistingSample(
                sample.getIpAddress(), sample.getPort(), sample.getSupplier());

        if (!existing.isPresent()) {
            return new DuplicateCheckResult(false, null, "new");
        }

        Optional<InspectionResult> existingResult = storage.getResult(existing.get().getSampleId());
        if (!existingResult.isPresent()) {
            return new DuplicateCheckResult(false, null, "new");
        }

        InspectionResult newResult = inspectSample(sample, currentRuleVersion);

        if (existingResult.get().getRiskLevel() == newResult.getRiskLevel()) {
            return new DuplicateCheckResult(true, existingResult.get(), "reused");
        } else {
            return new DuplicateCheckResult(true, existingResult.get(), "conflict");
        }
    }

    public BatchInfo processBatch(List<InspectionSample> samples, String forceRuleVersion) {
        if (samples.isEmpty()) {
            throw new IllegalArgumentException("样本列表为空");
        }

        String batchId = samples.get(0).getBatchId();
        String ruleVersion = (forceRuleVersion != null && !forceRuleVersion.isEmpty())
                ? forceRuleVersion
                : ruleManager.getLatestRule().getVersion();

        int anomalyCount = 0;
        int reusedCount = 0;
        int conflictCount = 0;

        for (InspectionSample sample : samples) {
            DuplicateCheckResult dupResult = checkDuplicateSample(sample, ruleVersion);

            if (dupResult.isDuplicate && "reused".equals(dupResult.status)) {
                reusedCount++;
                InspectionResult oldResult = dupResult.oldResult;
                String cleanConclusion = oldResult.getConclusion()
                        .replace("【复用】", "").replace("【冲突】", "");

                InspectionResult reusedResult = new InspectionResult();
                reusedResult.setSampleId(sample.getSampleId());
                reusedResult.setBatchId(batchId);
                reusedResult.setRuleVersion(oldResult.getRuleVersion());
                reusedResult.setRiskLevel(oldResult.getRiskLevel());
                reusedResult.setAnomaly(oldResult.isAnomaly());
                reusedResult.setConclusion("【复用】" + cleanConclusion);
                reusedResult.setPortStatus(oldResult.getPortStatus());
                reusedResult.setDetails(oldResult.getDetails());
                reusedResult.setReviewed(oldResult.isReviewed());
                reusedResult.setReviewer(oldResult.getReviewer());
                reusedResult.setReviewTime(oldResult.getReviewTime());
                reusedResult.setReviewNotes(oldResult.getReviewNotes());
                reusedResult.setReused(true);
                reusedResult.setOriginalSampleId(oldResult.getOriginalSampleId() != null
                        ? oldResult.getOriginalSampleId() : oldResult.getSampleId());
                reusedResult.setOriginalBatchId(oldResult.getOriginalBatchId() != null
                        ? oldResult.getOriginalBatchId() : oldResult.getBatchId());

                if (reusedResult.isAnomaly()) {
                    anomalyCount++;
                }
                storage.saveSample(sample);
                storage.saveResult(reusedResult);
            } else if (dupResult.isDuplicate && "conflict".equals(dupResult.status)) {
                conflictCount++;
                InspectionResult oldResult = dupResult.oldResult;
                InspectionResult newResult = inspectSample(sample, ruleVersion);

                Map<String, Object> conflictInfo = new HashMap<>();
                conflictInfo.put("oldRisk", oldResult.getRiskLevel().getValue());
                conflictInfo.put("oldRule", oldResult.getRuleVersion());
                conflictInfo.put("newRisk", newResult.getRiskLevel().getValue());
                conflictInfo.put("newRule", ruleVersion);

                String cleanConclusion = newResult.getConclusion();
                InspectionResult conflictResult = new InspectionResult();
                conflictResult.setSampleId(sample.getSampleId());
                conflictResult.setBatchId(batchId);
                conflictResult.setRuleVersion(ruleVersion);
                conflictResult.setRiskLevel(newResult.getRiskLevel());
                conflictResult.setAnomaly(newResult.isAnomaly());
                conflictResult.setConclusion("【冲突】" + cleanConclusion);
                conflictResult.setPortStatus(newResult.getPortStatus());
                conflictResult.setDetails(newResult.getDetails());
                conflictResult.setConflictInfo(conflictInfo);

                if (conflictResult.isAnomaly()) {
                    anomalyCount++;
                }
                storage.saveSample(sample);
                storage.saveResult(conflictResult);
            } else {
                InspectionResult result = inspectSample(sample, ruleVersion);
                if (result.isAnomaly()) {
                    anomalyCount++;
                }
                storage.saveSample(sample);
                storage.saveResult(result);
            }
        }

        BatchInfo batch = new BatchInfo();
        batch.setBatchId(batchId);
        batch.setSubmitTime(LocalDateTime.now());
        batch.setRuleVersionAtSubmit(ruleVersion);
        batch.setTotalSamples(samples.size());
        batch.setAnomalyCount(anomalyCount);
        batch.setStatus("completed");
        batch.setSourceFiles(samples.stream().map(InspectionSample::getSourceFile).distinct().collect(Collectors.toList()));
        batch.setNotes("复用样本: " + reusedCount + ", 冲突样本: " + conflictCount);

        storage.saveBatch(batch);
        return batch;
    }

    public Map<String, Object> getBatchReport(String batchId) {
        Optional<BatchInfo> batchOpt = storage.getBatch(batchId);
        if (!batchOpt.isPresent()) {
            throw new IllegalArgumentException("批次不存在: " + batchId);
        }

        BatchInfo batch = batchOpt.get();
        List<InspectionResult> results = storage.getResultsByBatch(batchId);

        Map<String, Integer> riskDistribution = new HashMap<>();
        for (InspectionResult result : results) {
            String risk = result.getRiskLevel().getValue();
            riskDistribution.put(risk, riskDistribution.getOrDefault(risk, 0) + 1);
        }

        Map<String, Object> report = new HashMap<>();
        report.put("batch", batch);
        report.put("totalSamples", batch.getTotalSamples());
        report.put("anomalyCount", batch.getAnomalyCount());
        report.put("riskDistribution", riskDistribution);
        report.put("ruleVersion", batch.getRuleVersionAtSubmit());
        report.put("results", results);

        return report;
    }

    public RuleManager getRuleManager() {
        return ruleManager;
    }

    public DataStorage getStorage() {
        return storage;
    }

    public static class DuplicateCheckResult {
        public final boolean isDuplicate;
        public final InspectionResult oldResult;
        public final String status;

        public DuplicateCheckResult(boolean isDuplicate, InspectionResult oldResult, String status) {
            this.isDuplicate = isDuplicate;
            this.oldResult = oldResult;
            this.status = status;
        }
    }
}
