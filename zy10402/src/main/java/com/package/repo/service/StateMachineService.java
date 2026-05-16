package com.package.repo.service;

import com.package.repo.model.enums.PackageStatus;
import com.package.repo.model.enums.ArbitrationResult;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class StateMachineService {

    private final Map<PackageStatus, List<PackageStatus>> validTransitions = new HashMap<>();

    public StateMachineService() {
        validTransitions.put(PackageStatus.PUBLISHED, Arrays.asList(
                PackageStatus.WITHDRAW_REQUESTED,
                PackageStatus.ERROR
        ));
        validTransitions.put(PackageStatus.WITHDRAW_REQUESTED, Arrays.asList(
                PackageStatus.WITHDRAW_PENDING_REVIEW,
                PackageStatus.WITHDRAW_BLOCKED,
                PackageStatus.PUBLISHED,
                PackageStatus.ERROR
        ));
        validTransitions.put(PackageStatus.WITHDRAW_PENDING_REVIEW, Arrays.asList(
                PackageStatus.WITHDRAW_APPROVED,
                PackageStatus.WITHDRAW_REJECTED,
                PackageStatus.WITHDRAW_COMPENSATED,
                PackageStatus.ERROR
        ));
        validTransitions.put(PackageStatus.WITHDRAW_APPROVED, Arrays.asList(
                PackageStatus.PUBLISHED,
                PackageStatus.WITHDRAW_COMPENSATED,
                PackageStatus.ERROR
        ));
        validTransitions.put(PackageStatus.WITHDRAW_REJECTED, Arrays.asList(
                PackageStatus.WITHDRAW_REQUESTED,
                PackageStatus.ERROR
        ));
        validTransitions.put(PackageStatus.WITHDRAW_BLOCKED, Arrays.asList(
                PackageStatus.WITHDRAW_COMPENSATED,
                PackageStatus.PUBLISHED,
                PackageStatus.ERROR
        ));
        validTransitions.put(PackageStatus.WITHDRAW_COMPENSATED, Arrays.asList(
                PackageStatus.PUBLISHED,
                PackageStatus.ERROR
        ));
        validTransitions.put(PackageStatus.ERROR, Arrays.asList(
                PackageStatus.PUBLISHED,
                PackageStatus.WITHDRAW_REQUESTED
        ));
    }

    public boolean canTransition(PackageStatus from, PackageStatus to) {
        return validTransitions.getOrDefault(from, List.of()).contains(to);
    }

    public PackageStatus getNextStatusForArbitration(ArbitrationResult arbitrationResult) {
        return switch (arbitrationResult) {
            case APPROVED, AUTO_APPROVED -> PackageStatus.WITHDRAW_APPROVED;
            case REJECTED -> PackageStatus.WITHDRAW_REJECTED;
            case AUTO_BLOCKED -> PackageStatus.WITHDRAW_BLOCKED;
            case NEEDS_MORE_INFO, PENDING -> PackageStatus.WITHDRAW_PENDING_REVIEW;
        };
    }

    public String getTransitionReason(PackageStatus from, PackageStatus to) {
        return String.format("状态从 %s 变更为 %s", from.getDescription(), to.getDescription());
    }
}
