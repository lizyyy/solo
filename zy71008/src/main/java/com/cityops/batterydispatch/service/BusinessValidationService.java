package com.cityops.batterydispatch.service;

import com.cityops.batterydispatch.config.AppConfig;
import com.cityops.batterydispatch.enums.DispatchStatus;
import com.cityops.batterydispatch.enums.ErrorCode;
import com.cityops.batterydispatch.exception.BusinessException;
import com.cityops.batterydispatch.repository.DispatchTaskRepository;
import com.cityops.batterydispatch.repository.ForbiddenLocationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class BusinessValidationService {
    private final ForbiddenLocationRepository forbiddenLocationRepository;
    private final DispatchTaskRepository dispatchTaskRepository;
    private final AppConfig appConfig;

    private static final List<DispatchStatus> ACTIVE_STATUSES = Arrays.asList(
        DispatchStatus.PENDING,
        DispatchStatus.DISPATCHED,
        DispatchStatus.ARRIVED,
        DispatchStatus.CONFIRM_REQUIRED,
        DispatchStatus.PHOTO_MISSING
    );

    public ValidationResult validateTaskCreation(String vehicleNo, String batteryNo,
                                                  String locationCode, Integer batteryLevel) {
        ValidationResult result = new ValidationResult();
        checkDuplicateVehicle(vehicleNo, result);
        checkDuplicateBattery(batteryNo, result);
        checkForbiddenLocation(locationCode, result);
        checkBatteryLevel(batteryLevel, result);
        return result;
    }

    private void checkDuplicateVehicle(String vehicleNo, ValidationResult result) {
        boolean exists = dispatchTaskRepository.existsByVehicleNoAndStatusIn(vehicleNo, ACTIVE_STATUSES);
        if (exists) {
            result.addWarning(ErrorCode.DUPLICATE_REQUEST,
                String.format("车辆 %s 存在未完成的派送任务", vehicleNo));
        }
    }

    private void checkDuplicateBattery(String batteryNo, ValidationResult result) {
        boolean exists = dispatchTaskRepository.existsByBatteryNoAndStatusIn(batteryNo, ACTIVE_STATUSES);
        if (exists) {
            result.addError(ErrorCode.BATTERY_ALREADY_DISPATCHED,
                String.format("电池 %s 已在派送中，不能重复派送", batteryNo));
        }
    }

    private void checkForbiddenLocation(String locationCode, ValidationResult result) {
        if (locationCode != null && !locationCode.isEmpty()) {
            boolean isForbidden = forbiddenLocationRepository.existsByLocationCodeAndActiveTrue(locationCode);
            if (isForbidden) {
                result.addWarning(ErrorCode.FORBIDDEN_LOCATION,
                    String.format("位置 %s 是禁停点，建议取消或人工确认", locationCode));
            }
        }
    }

    private void checkBatteryLevel(Integer batteryLevel, ValidationResult result) {
        int threshold = appConfig.getBattery().getLowBatteryThreshold();
        if (batteryLevel != null && batteryLevel > threshold) {
            result.addWarning(ErrorCode.LOW_BATTERY_SKIP,
                String.format("当前电量 %d%% 高于阈值 %d%%，确认是否需要换电", batteryLevel, threshold));
        }
    }

    public void validatePhoto(String photoUrl, boolean override) {
        if (appConfig.getDispatch().isPhotoRequired() && !override) {
            if (photoUrl == null || photoUrl.trim().isEmpty()) {
                throw new BusinessException(ErrorCode.PHOTO_REQUIRED, "签收照片不能为空");
            }
        }
    }

    public DispatchStatus determineInitialStatus(ValidationResult validationResult) {
        if (validationResult.hasErrors()) {
            throw new BusinessException(validationResult.getFirstError().getErrorCode(),
                validationResult.getFirstError().getMessage());
        }
        if (validationResult.hasWarnings()) {
            boolean hasForbidden = validationResult.getWarnings().stream()
                .anyMatch(w -> w.getErrorCode() == ErrorCode.FORBIDDEN_LOCATION);
            if (hasForbidden) {
                return DispatchStatus.FORBIDDEN_LOCATION;
            }
            boolean hasBatteryWarning = validationResult.getWarnings().stream()
                .anyMatch(w -> w.getErrorCode() == ErrorCode.LOW_BATTERY_SKIP);
            if (hasBatteryWarning) {
                return DispatchStatus.LOW_BATTERY_SKIP;
            }
            return DispatchStatus.CONFIRM_REQUIRED;
        }
        return DispatchStatus.PENDING;
    }

    public String generateSuggestion(ValidationResult validationResult) {
        if (!validationResult.hasWarnings()) {
            return "校验通过，可以正常派送";
        }
        StringBuilder sb = new StringBuilder();
        for (ValidationResult.ValidationWarning warning : validationResult.getWarnings()) {
            sb.append(warning.getMessage()).append("；");
        }
        if (sb.length() > 0) {
            sb.append("建议人工复核后确认是否继续");
        }
        return sb.toString();
    }
}
