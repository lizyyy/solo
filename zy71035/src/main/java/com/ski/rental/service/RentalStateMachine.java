package com.ski.rental.service;

import com.ski.rental.enums.RentalStatus;
import org.springframework.stereotype.Component;
import java.util.EnumSet;
import java.util.Map;
import java.util.Set;

@Component
public class RentalStateMachine {

    private final Map<RentalStatus, Set<RentalStatus>> validTransitions = Map.ofEntries(
        Map.entry(RentalStatus.PENDING_SUBMIT, EnumSet.of(
            RentalStatus.PARAMS_VALIDATING, RentalStatus.CANCELLED
        )),
        Map.entry(RentalStatus.PARAMS_VALIDATING, EnumSet.of(
            RentalStatus.PARAMS_MISMATCH, RentalStatus.RENTAL_READY
        )),
        Map.entry(RentalStatus.PARAMS_MISMATCH, EnumSet.of(
            RentalStatus.RENTAL_READY, RentalStatus.CANCELLED
        )),
        Map.entry(RentalStatus.RENTAL_READY, EnumSet.of(
            RentalStatus.RENTED, RentalStatus.CANCELLED
        )),
        Map.entry(RentalStatus.RENTED, EnumSet.of(
            RentalStatus.RETURN_PENDING
        )),
        Map.entry(RentalStatus.RETURN_PENDING, EnumSet.of(
            RentalStatus.RETURN_INSPECTING
        )),
        Map.entry(RentalStatus.RETURN_INSPECTING, EnumSet.of(
            RentalStatus.DAMAGE_FOUND, RentalStatus.COMPLETED
        )),
        Map.entry(RentalStatus.DAMAGE_FOUND, EnumSet.of(
            RentalStatus.DAMAGE_REVIEWING
        )),
        Map.entry(RentalStatus.DAMAGE_REVIEWING, EnumSet.of(
            RentalStatus.DAMAGE_CONFIRMED, RentalStatus.COMPLETED
        )),
        Map.entry(RentalStatus.DAMAGE_CONFIRMED, EnumSet.of(
            RentalStatus.FEE_CHARGED
        )),
        Map.entry(RentalStatus.FEE_CHARGED, EnumSet.of(
            RentalStatus.COMPLETED
        )),
        Map.entry(RentalStatus.COMPLETED, EnumSet.of(
            RentalStatus.ARCHIVED
        )),
        Map.entry(RentalStatus.ARCHIVED, EnumSet.noneOf(RentalStatus.class)),
        Map.entry(RentalStatus.CANCELLED, EnumSet.noneOf(RentalStatus.class))
    );

    public boolean canTransition(RentalStatus current, RentalStatus target) {
        Set<RentalStatus> allowed = validTransitions.get(current);
        return allowed != null && allowed.contains(target);
    }

    public String getInvalidTransitionMessage(RentalStatus current, RentalStatus target) {
        return String.format("状态转换无效: %s -> %s", current, target);
    }

    public boolean isTerminalState(RentalStatus status) {
        Set<RentalStatus> terminal = EnumSet.of(
            RentalStatus.ARCHIVED, RentalStatus.CANCELLED
        );
        return terminal.contains(status);
    }

    public boolean canModify(RentalStatus status) {
        Set<RentalStatus> modifiable = EnumSet.of(
            RentalStatus.PENDING_SUBMIT, RentalStatus.PARAMS_MISMATCH,
            RentalStatus.DAMAGE_FOUND, RentalStatus.DAMAGE_REVIEWING
        );
        return modifiable.contains(status);
    }
}
