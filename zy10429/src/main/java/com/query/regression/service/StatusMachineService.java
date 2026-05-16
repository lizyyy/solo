package com.query.regression.service;

import com.query.regression.entity.RegressionRecord;
import com.query.regression.enums.RegressionStatus;
import com.query.regression.exception.InvalidStatusTransitionException;
import com.query.regression.repository.RegressionRecordRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.Set;

@Slf4j
@Service
@RequiredArgsConstructor
public class StatusMachineService {

    private final RegressionRecordRepository recordRepository;

    private static final Set<RegressionStatus> VALID_FROM_CREATED = Set.of(
            RegressionStatus.COMPARING, RegressionStatus.ERROR
    );

    private static final Set<RegressionStatus> VALID_FROM_COMPARING = Set.of(
            RegressionStatus.ANALYZED, RegressionStatus.ERROR
    );

    private static final Set<RegressionStatus> VALID_FROM_ANALYZED = Set.of(
            RegressionStatus.CONFIRMED, RegressionStatus.ERROR
    );

    private static final Set<RegressionStatus> VALID_FROM_ERROR = Set.of(
            RegressionStatus.COMPARING
    );

    @Transactional
    public RegressionRecord transition(Long recordId, RegressionStatus targetStatus) {
        RegressionRecord record = recordRepository.findById(recordId)
                .orElseThrow(() -> new IllegalArgumentException("回归记录不存在: " + recordId));
        
        return transition(record, targetStatus);
    }

    @Transactional
    public RegressionRecord transition(RegressionRecord record, RegressionStatus targetStatus) {
        RegressionStatus currentStatus = record.getStatus();
        
        if (!isValidTransition(currentStatus, targetStatus)) {
            throw new InvalidStatusTransitionException(currentStatus, targetStatus);
        }
        
        log.info("状态转换: {} -> {} (记录ID: {})", currentStatus, targetStatus, record.getId());
        record.setStatus(targetStatus);
        return recordRepository.save(record);
    }

    public boolean isValidTransition(RegressionStatus from, RegressionStatus to) {
        return switch (from) {
            case CREATED -> VALID_FROM_CREATED.contains(to);
            case COMPARING -> VALID_FROM_COMPARING.contains(to);
            case ANALYZED -> VALID_FROM_ANALYZED.contains(to);
            case CONFIRMED -> false;
            case ERROR -> VALID_FROM_ERROR.contains(to);
        };
    }

    public Set<RegressionStatus> getValidTransitions(RegressionStatus currentStatus) {
        return switch (currentStatus) {
            case CREATED -> VALID_FROM_CREATED;
            case COMPARING -> VALID_FROM_COMPARING;
            case ANALYZED -> VALID_FROM_ANALYZED;
            case CONFIRMED -> Set.of();
            case ERROR -> VALID_FROM_ERROR;
        };
    }
}
