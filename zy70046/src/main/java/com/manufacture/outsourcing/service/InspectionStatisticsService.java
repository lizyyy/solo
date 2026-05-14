package com.manufacture.outsourcing.service;

import com.manufacture.outsourcing.entity.DeductionRecord;
import com.manufacture.outsourcing.entity.InspectionResult;
import com.manufacture.outsourcing.entity.ReplenishmentTask;
import com.manufacture.outsourcing.repository.DeductionRecordRepository;
import com.manufacture.outsourcing.repository.ReplenishmentTaskRepository;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.List;

@Service
public class InspectionStatisticsService {

    private final DeductionRecordRepository deductionRecordRepository;
    private final ReplenishmentTaskRepository replenishmentTaskRepository;

    public InspectionStatisticsService(DeductionRecordRepository deductionRecordRepository,
                                        ReplenishmentTaskRepository replenishmentTaskRepository) {
        this.deductionRecordRepository = deductionRecordRepository;
        this.replenishmentTaskRepository = replenishmentTaskRepository;
    }

    public BigDecimal calculateDeductionAmountForInspection(InspectionResult result) {
        List<DeductionRecord> records = deductionRecordRepository.findByInspectionResultId(result.getId());
        return records.stream()
                .filter(r -> List.of(
                        DeductionRecord.STATUS_APPROVED,
                        DeductionRecord.STATUS_COMPLETED
                ).contains(r.getRecordStatus()))
                .map(DeductionRecord::getDeductionAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    public BigDecimal calculateReplenishmentQuantityForInspection(InspectionResult result) {
        List<ReplenishmentTask> tasks = replenishmentTaskRepository.findByInspectionResultId(result.getId());
        return tasks.stream()
                .filter(t -> !ReplenishmentTask.STATUS_CANCELLED.equals(t.getTaskStatus()))
                .map(ReplenishmentTask::getRequiredQuantity)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}
