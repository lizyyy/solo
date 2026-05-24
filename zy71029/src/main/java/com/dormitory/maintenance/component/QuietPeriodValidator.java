package com.dormitory.maintenance.component;

import com.dormitory.maintenance.dto.ValidationResult;
import com.dormitory.maintenance.entity.DormBuilding;
import com.dormitory.maintenance.entity.MaintenanceOrder;
import com.dormitory.maintenance.entity.QuietPeriod;
import com.dormitory.maintenance.enums.QuietPeriodType;
import com.dormitory.maintenance.repository.QuietPeriodRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

@Component
public class QuietPeriodValidator {

    @Autowired
    private QuietPeriodRepository quietPeriodRepository;

    @Value("${app.quiet-period.lunch-start:12:00}")
    private String lunchStart;

    @Value("${app.quiet-period.lunch-end:14:00}")
    private String lunchEnd;

    @Value("${app.quiet-period.night-start:22:00}")
    private String nightStart;

    @Value("${app.quiet-period.night-end:07:00}")
    private String nightEnd;

    @Value("${app.maintenance.default-max-hours:4}")
    private int defaultMaxHours;

    public ValidationResult validateMaintenanceTime(DormBuilding building, LocalDateTime startTime, LocalDateTime endTime, boolean isEmergency) {
        ValidationResult result = new ValidationResult();

        if (startTime.isAfter(endTime)) {
            result.addError("开始时间不能晚于结束时间");
            return result;
        }

        long hours = Duration.between(startTime, endTime).toHours();
        if (hours > defaultMaxHours && !isEmergency) {
            result.addWarning(String.format("施工时长超过%d小时（实际%d小时），非紧急维修建议拆分", defaultMaxHours, hours));
        }

        checkLunchBreak(startTime, endTime, result);
        checkNightRest(startTime, endTime, result);
        checkCustomQuietPeriods(building, startTime, endTime, result, isEmergency);

        if (result.hasIssues()) {
            result.setConflictDetail(result.getSummary());
        }

        return result;
    }

    private void checkLunchBreak(LocalDateTime startTime, LocalDateTime endTime, ValidationResult result) {
        LocalTime lunchStart = LocalTime.parse(this.lunchStart);
        LocalTime lunchEnd = LocalTime.parse(this.lunchEnd);

        LocalDateTime current = startTime;
        while (!current.isAfter(endTime)) {
            LocalTime currentTime = current.toLocalTime();
            if (!currentTime.isBefore(lunchStart) && !currentTime.isAfter(lunchEnd)) {
                result.addError(String.format("施工时间包含午休时段(%s-%s)", this.lunchStart, this.lunchEnd));
                break;
            }
            current = current.plusMinutes(30);
        }
    }

    private void checkNightRest(LocalDateTime startTime, LocalDateTime endTime, ValidationResult result) {
        LocalTime nightStart = LocalTime.parse(this.nightStart);
        LocalTime nightEnd = LocalTime.parse(this.nightEnd);

        LocalDateTime current = startTime;
        while (!current.isAfter(endTime)) {
            LocalTime currentTime = current.toLocalTime();
            boolean isNightTime = currentTime.isAfter(nightStart) || currentTime.isBefore(nightEnd);
            if (isNightTime) {
                result.addError(String.format("施工时间包含夜间休息时段(%s-%s)", this.nightStart, this.nightEnd));
                break;
            }
            current = current.plusMinutes(30);
        }
    }

    private void checkCustomQuietPeriods(DormBuilding building, LocalDateTime startTime, LocalDateTime endTime, ValidationResult result, boolean isEmergency) {
        List<QuietPeriod> conflicts = quietPeriodRepository.findConflictingPeriods(building, startTime, endTime);

        for (QuietPeriod period : conflicts) {
            String periodDesc = String.format("[%s] %s(%s 至 %s)",
                    period.getPeriodType().getDescription(),
                    period.getPeriodName(),
                    period.getStartDate().toLocalDate(),
                    period.getEndDate().toLocalDate());

            if (period.getPeriodType() == QuietPeriodType.EXAM_WEEK) {
                if (isEmergency) {
                    result.addWarning("考试周期间紧急维修，需额外审批：" + periodDesc);
                } else {
                    result.addError("考试周禁止施工：" + periodDesc);
                }
            } else {
                result.addError("静音时段冲突：" + periodDesc);
            }
        }
    }

    public ValidationResult validateOrder(MaintenanceOrder order) {
        return validateMaintenanceTime(
                order.getBuilding(),
                order.getScheduledStartTime(),
                order.getScheduledEndTime(),
                order.getIsEmergency()
        );
    }
}
