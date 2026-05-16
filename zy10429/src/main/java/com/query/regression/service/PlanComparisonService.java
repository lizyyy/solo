package com.query.regression.service;

import com.query.regression.entity.ExecutionPlan;
import com.query.regression.entity.PlanDifference;
import com.query.regression.enums.RiskLevel;
import com.query.regression.repository.ExecutionPlanRepository;
import com.query.regression.repository.PlanDifferenceRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@Service
@RequiredArgsConstructor
public class PlanComparisonService {

    private final ExecutionPlanRepository planRepository;
    private final PlanDifferenceRepository differenceRepository;

    @Transactional
    public ExecutionPlan parseAndSavePlan(Long recordId, String planType, String rawPlan) {
        ExecutionPlan plan = new ExecutionPlan();
        plan.setRegressionRecordId(recordId);
        plan.setPlanType(planType);
        plan.setRawPlan(rawPlan);
        plan.setCapturedAt(LocalDateTime.now());
        
        parsePlanSummary(plan, rawPlan);
        
        return planRepository.save(plan);
    }

    private void parsePlanSummary(ExecutionPlan plan, String rawPlan) {
        StringBuilder summary = new StringBuilder();
        
        double cost = extractCost(rawPlan);
        long rows = extractRows(rawPlan);
        int joinCount = countJoins(rawPlan);
        int fullScanCount = countFullScans(rawPlan);
        String indexes = extractIndexes(rawPlan);
        
        plan.setEstimatedCost(cost);
        plan.setEstimatedRows(rows);
        plan.setJoinCount(joinCount);
        plan.setFullScanCount(fullScanCount);
        plan.setIndexesUsed(indexes);
        
        summary.append(String.format("Cost: %.2f, Rows: %d, Joins: %d, FullScans: %d",
                cost, rows, joinCount, fullScanCount));
        if (indexes != null && !indexes.isEmpty()) {
            summary.append(", Indexes: ").append(indexes);
        }
        plan.setPlanSummary(summary.toString());
    }

    private double extractCost(String plan) {
        Pattern pattern = Pattern.compile("cost=([\\d.]+)");
        Matcher matcher = pattern.matcher(plan);
        if (matcher.find()) {
            return Double.parseDouble(matcher.group(1));
        }
        pattern = Pattern.compile("Total.*Cost.*[:=]\\s*([\\d.]+)");
        matcher = pattern.matcher(plan);
        if (matcher.find()) {
            return Double.parseDouble(matcher.group(1));
        }
        return 0.0;
    }

    private long extractRows(String plan) {
        Pattern pattern = Pattern.compile("rows=([\\d]+)");
        Matcher matcher = pattern.matcher(plan);
        if (matcher.find()) {
            return Long.parseLong(matcher.group(1));
        }
        return 0;
    }

    private int countJoins(String plan) {
        int count = 0;
        String[] joinTypes = {"Nested Loop", "Hash Join", "Merge Join", "JOIN"};
        for (String joinType : joinTypes) {
            count += (plan.split(joinType, -1).length - 1);
        }
        return count;
    }

    private int countFullScans(String plan) {
        int count = 0;
        String[] scanTypes = {"Seq Scan", "Full Scan", "TABLE ACCESS FULL"};
        for (String scanType : scanTypes) {
            count += (plan.split(scanType, -1).length - 1);
        }
        return count;
    }

    private String extractIndexes(String plan) {
        List<String> indexes = new ArrayList<>();
        Pattern pattern = Pattern.compile("Index.*Scan.*on\\s+(\\w+)");
        Matcher matcher = pattern.matcher(plan);
        while (matcher.find()) {
            indexes.add(matcher.group(1));
        }
        return String.join(", ", indexes);
    }

    @Transactional
    public List<PlanDifference> comparePlans(Long recordId, ExecutionPlan oldPlan, ExecutionPlan newPlan) {
        List<PlanDifference> differences = new ArrayList<>();
        
        if (Math.abs(oldPlan.getEstimatedCost() - newPlan.getEstimatedCost()) > 0.01) {
            PlanDifference diff = createDifference(recordId, "COST",
                    String.valueOf(oldPlan.getEstimatedCost()),
                    String.valueOf(newPlan.getEstimatedCost()),
                    "执行计划成本变化");
            diff.setRiskLevel(calculateCostRisk(oldPlan.getEstimatedCost(), newPlan.getEstimatedCost()));
            differences.add(differenceRepository.save(diff));
        }
        
        if (!oldPlan.getIndexesUsed().equals(newPlan.getIndexesUsed())) {
            PlanDifference diff = createDifference(recordId, "INDEX_CHANGE",
                    oldPlan.getIndexesUsed(),
                    newPlan.getIndexesUsed(),
                    "使用的索引发生变化");
            diff.setRiskLevel(RiskLevel.HIGH);
            differences.add(differenceRepository.save(diff));
        }
        
        if (!oldPlan.getJoinCount().equals(newPlan.getJoinCount())) {
            PlanDifference diff = createDifference(recordId, "JOIN_COUNT",
                    String.valueOf(oldPlan.getJoinCount()),
                    String.valueOf(newPlan.getJoinCount()),
                    "连接操作数量变化");
            diff.setRiskLevel(RiskLevel.MEDIUM);
            differences.add(differenceRepository.save(diff));
        }
        
        if (!oldPlan.getFullScanCount().equals(newPlan.getFullScanCount())) {
            PlanDifference diff = createDifference(recordId, "FULL_SCAN_COUNT",
                    String.valueOf(oldPlan.getFullScanCount()),
                    String.valueOf(newPlan.getFullScanCount()),
                    "全表扫描数量变化");
            diff.setRiskLevel(newPlan.getFullScanCount() > oldPlan.getFullScanCount() 
                    ? RiskLevel.HIGH : RiskLevel.LOW);
            differences.add(differenceRepository.save(diff));
        }
        
        log.info("计划对比完成，发现 {} 个差异 (记录ID: {})", differences.size(), recordId);
        return differences;
    }

    private PlanDifference createDifference(Long recordId, String diffType, 
            String oldValue, String newValue, String description) {
        PlanDifference diff = new PlanDifference();
        diff.setRegressionRecordId(recordId);
        diff.setDiffType(diffType);
        diff.setOldValue(oldValue);
        diff.setNewValue(newValue);
        diff.setDescription(description);
        return diff;
    }

    private RiskLevel calculateCostRisk(double oldCost, double newCost) {
        if (newCost <= oldCost) {
            return RiskLevel.LOW;
        }
        double increase = (newCost - oldCost) / oldCost * 100;
        if (increase > 200) return RiskLevel.CRITICAL;
        if (increase > 100) return RiskLevel.HIGH;
        if (increase > 50) return RiskLevel.MEDIUM;
        return RiskLevel.LOW;
    }

    public RiskLevel calculateOverallRisk(List<PlanDifference> differences) {
        if (differences.isEmpty()) {
            return RiskLevel.LOW;
        }
        return differences.stream()
                .map(PlanDifference::getRiskLevel)
                .max(this::compareRiskLevel)
                .orElse(RiskLevel.LOW);
    }

    private int compareRiskLevel(RiskLevel a, RiskLevel b) {
        return Integer.compare(getRiskOrdinal(a), getRiskOrdinal(b));
    }

    private int getRiskOrdinal(RiskLevel level) {
        return switch (level) {
            case LOW -> 0;
            case MEDIUM -> 1;
            case HIGH -> 2;
            case CRITICAL -> 3;
        };
    }

    public double calculateCostDiffPercentage(ExecutionPlan oldPlan, ExecutionPlan newPlan) {
        if (oldPlan.getEstimatedCost() == 0) {
            return 0.0;
        }
        return (newPlan.getEstimatedCost() - oldPlan.getEstimatedCost()) 
                / oldPlan.getEstimatedCost() * 100;
    }
}
