package com.dormitory.maintenance.component;

import com.dormitory.maintenance.dto.ValidationResult;
import com.dormitory.maintenance.entity.MaintenanceOrder;
import com.dormitory.maintenance.enums.MaintenanceStatus;
import com.dormitory.maintenance.repository.MaintenanceOrderRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;

@Component
public class DuplicateOrderChecker {

    @Autowired
    private MaintenanceOrderRepository orderRepository;

    private static final List<MaintenanceStatus> ACTIVE_STATUSES = List.of(
            MaintenanceStatus.PENDING_APPROVAL,
            MaintenanceStatus.APPROVED,
            MaintenanceStatus.IN_PROGRESS
    );

    public ValidationResult checkDuplicate(MaintenanceOrder order) {
        ValidationResult result = new ValidationResult();

        List<MaintenanceOrder> overlapping = orderRepository.findOverlappingOrders(
                order.getBuilding(),
                order.getScheduledStartTime(),
                order.getScheduledEndTime(),
                ACTIVE_STATUSES
        );

        overlapping = overlapping.stream()
                .filter(o -> !o.getId().equals(order.getId()))
                .filter(o -> o.getTeam() != null && order.getTeam() != null && o.getTeam().getId().equals(order.getTeam().getId()))
                .toList();

        if (!overlapping.isEmpty()) {
            StringBuilder sb = new StringBuilder("同一施工队在相同时段已有派单：");
            for (MaintenanceOrder o : overlapping) {
                sb.append(String.format("[%s]%s(%s至%s), ",
                        o.getOrderNo(),
                        o.getTitle(),
                        o.getScheduledStartTime().toLocalTime(),
                        o.getScheduledEndTime().toLocalTime()));
            }
            result.addWarning(sb.substring(0, sb.length() - 2));
        }

        return result;
    }

    public boolean hasOverTimeRisk(MaintenanceOrder order) {
        if (order.getActualStartTime() == null) return false;

        LocalDateTime expectedEnd = order.getActualStartTime()
                .plusHours(order.getScheduledEndTime().getHour() - order.getScheduledStartTime().getHour())
                .plusMinutes(order.getScheduledEndTime().getMinute() - order.getScheduledStartTime().getMinute());

        return LocalDateTime.now().isAfter(expectedEnd.plusMinutes(30));
    }

    public String getOverTimeDetail(MaintenanceOrder order) {
        if (order.getActualStartTime() == null) return "";

        long scheduledMinutes = java.time.Duration.between(
                order.getScheduledStartTime(), order.getScheduledEndTime()).toMinutes();
        long actualMinutes = java.time.Duration.between(
                order.getActualStartTime(), LocalDateTime.now()).toMinutes();
        long overMinutes = actualMinutes - scheduledMinutes;

        if (overMinutes > 0) {
            return String.format("超时%d分钟（计划%d分钟，已进行%d分钟）",
                    overMinutes, scheduledMinutes, actualMinutes);
        }
        return "";
    }
}
