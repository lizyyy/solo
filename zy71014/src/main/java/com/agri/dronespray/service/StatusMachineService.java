package com.agri.dronespray.service;

import com.agri.dronespray.entity.Permission;
import com.agri.dronespray.entity.PermissionStatus;
import com.agri.dronespray.entity.ProcessingRecord;
import org.springframework.stereotype.Service;

import java.util.Set;

@Service
public class StatusMachineService {

    private static final Set<PermissionStatus> ALLOW_SUBMIT = Set.of(
            PermissionStatus.DRAFT,
            PermissionStatus.SYSTEM_REJECTED
    );

    private static final Set<PermissionStatus> ALLOW_SYSTEM_CHECK = Set.of(
            PermissionStatus.SUBMITTED
    );

    private static final Set<PermissionStatus> ALLOW_SYSTEM_RESULT = Set.of(
            PermissionStatus.SYSTEM_CHECKING
    );

    private static final Set<PermissionStatus> ALLOW_MANUAL_REVIEW = Set.of(
            PermissionStatus.SYSTEM_APPROVED
    );

    private static final Set<PermissionStatus> ALLOW_APPROVE = Set.of(
            PermissionStatus.MANUAL_REVIEWING
    );

    private static final Set<PermissionStatus> ALLOW_REJECT = Set.of(
            PermissionStatus.SYSTEM_CHECKING,
            PermissionStatus.MANUAL_REVIEWING
    );

    private static final Set<PermissionStatus> ALLOW_CANCEL = Set.of(
            PermissionStatus.DRAFT,
            PermissionStatus.SUBMITTED,
            PermissionStatus.SYSTEM_APPROVED,
            PermissionStatus.APPROVED
    );

    private static final Set<PermissionStatus> ALLOW_AMEND = Set.of(
            PermissionStatus.APPROVED,
            PermissionStatus.REJECTED
    );

    private static final Set<PermissionStatus> ALLOW_COMPLETE = Set.of(
            PermissionStatus.APPROVED,
            PermissionStatus.AMENDED
    );

    public boolean canTransition(Permission permission, PermissionStatus targetStatus) {
        PermissionStatus currentStatus = permission.getStatus();

        return switch (targetStatus) {
            case SUBMITTED -> ALLOW_SUBMIT.contains(currentStatus);
            case SYSTEM_CHECKING -> ALLOW_SYSTEM_CHECK.contains(currentStatus);
            case SYSTEM_APPROVED -> ALLOW_SYSTEM_RESULT.contains(currentStatus);
            case SYSTEM_REJECTED -> ALLOW_SYSTEM_RESULT.contains(currentStatus);
            case MANUAL_REVIEWING -> ALLOW_MANUAL_REVIEW.contains(currentStatus);
            case APPROVED -> ALLOW_APPROVE.contains(currentStatus);
            case REJECTED -> ALLOW_REJECT.contains(currentStatus);
            case CANCELLED -> ALLOW_CANCEL.contains(currentStatus);
            case AMENDED -> ALLOW_AMEND.contains(currentStatus);
            case COMPLETED -> ALLOW_COMPLETE.contains(currentStatus);
            default -> false;
        };
    }

    public ProcessingRecord transition(Permission permission, PermissionStatus targetStatus,
                                       String action, String remark, String operator) {
        if (!canTransition(permission, targetStatus)) {
            throw new IllegalStateException(
                    String.format("无法从状态[%s]转换到[%s]",
                            permission.getStatus().getDisplayName(),
                            targetStatus.getDisplayName())
            );
        }

        ProcessingRecord record = new ProcessingRecord();
        record.setFromStatus(permission.getStatus());
        record.setToStatus(targetStatus);
        record.setAction(action);
        record.setRemark(remark);
        record.setProcessedBy(operator);

        permission.setStatus(targetStatus);

        return record;
    }

    public String getTransitionAction(PermissionStatus from, PermissionStatus to) {
        return switch (to) {
            case SUBMITTED -> "提交申请";
            case SYSTEM_CHECKING -> "系统审核";
            case SYSTEM_APPROVED -> "系统审核通过";
            case SYSTEM_REJECTED -> "系统审核驳回";
            case MANUAL_REVIEWING -> "人工复核";
            case APPROVED -> "审批通过";
            case REJECTED -> "审批驳回";
            case CANCELLED -> "取消申请";
            case AMENDED -> "人工修正";
            case COMPLETED -> "作业完成";
            default -> "状态变更";
        };
    }
}
