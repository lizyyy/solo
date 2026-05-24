package com.airport.baggage.service;

import com.airport.baggage.common.enums.CompensationStatus;
import com.airport.baggage.common.enums.ErrorCode;
import com.airport.baggage.common.exception.BusinessException;
import org.springframework.stereotype.Component;

import java.util.Set;

@Component
public class CompensationStateMachine {

    public boolean canTransition(CompensationStatus current, CompensationStatus target) {
        return switch (current) {
            case CREATED -> Set.of(
                    CompensationStatus.PENDING_REVIEW,
                    CompensationStatus.REJECTED,
                    CompensationStatus.DISPUTED
            ).contains(target);
            case PENDING_REVIEW -> Set.of(
                    CompensationStatus.APPROVED,
                    CompensationStatus.REJECTED,
                    CompensationStatus.DISPUTED
            ).contains(target);
            case APPROVED -> Set.of(
                    CompensationStatus.PAID,
                    CompensationStatus.REJECTED,
                    CompensationStatus.DISPUTED
            ).contains(target);
            case PAID -> Set.of(
                    CompensationStatus.BAGGAGE_ARRIVED,
                    CompensationStatus.DISPUTED
            ).contains(target);
            case BAGGAGE_ARRIVED -> Set.of(
                    CompensationStatus.PICKED_UP,
                    CompensationStatus.DISPUTED
            ).contains(target);
            case PICKED_UP -> Set.of(
                    CompensationStatus.CLOSED,
                    CompensationStatus.DISPUTED
            ).contains(target);
            case DISPUTED -> Set.of(
                    CompensationStatus.PENDING_REVIEW,
                    CompensationStatus.APPROVED,
                    CompensationStatus.CLOSED,
                    CompensationStatus.REJECTED
            ).contains(target);
            case REJECTED, CLOSED -> false;
        };
    }

    public void validateTransition(CompensationStatus current, CompensationStatus target) {
        if (!canTransition(current, target)) {
            throw new BusinessException(ErrorCode.INVALID_STATUS,
                    String.format("无法从 %s 转换到 %s", current.getDescription(), target.getDescription()));
        }
    }

    public boolean isFinalState(CompensationStatus status) {
        return status == CompensationStatus.CLOSED || status == CompensationStatus.REJECTED;
    }

    public boolean canModify(CompensationStatus status) {
        return status != CompensationStatus.CLOSED && status != CompensationStatus.REJECTED;
    }
}
