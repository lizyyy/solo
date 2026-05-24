package com.dormitory.maintenance.component;

import com.dormitory.maintenance.enums.MaintenanceStatus;
import org.springframework.stereotype.Component;

import java.util.Set;

@Component
public class StatusMachine {

    public boolean canTransition(MaintenanceStatus from, MaintenanceStatus to) {
        return getAllowedTransitions(from).contains(to);
    }

    public Set<MaintenanceStatus> getAllowedTransitions(MaintenanceStatus current) {
        return switch (current) {
            case PENDING_SUBMIT -> Set.of(MaintenanceStatus.PENDING_APPROVAL, MaintenanceStatus.CANCELLED);
            case PENDING_APPROVAL -> Set.of(MaintenanceStatus.APPROVED, MaintenanceStatus.REJECTED, MaintenanceStatus.PENDING_SUBMIT);
            case APPROVED -> Set.of(MaintenanceStatus.IN_PROGRESS, MaintenanceStatus.CANCELLED, MaintenanceStatus.ABNORMAL);
            case IN_PROGRESS -> Set.of(MaintenanceStatus.COMPLETED, MaintenanceStatus.ABNORMAL, MaintenanceStatus.APPROVED);
            case REJECTED -> Set.of(MaintenanceStatus.PENDING_SUBMIT, MaintenanceStatus.CANCELLED);
            case ABNORMAL -> Set.of(MaintenanceStatus.IN_PROGRESS, MaintenanceStatus.COMPLETED, MaintenanceStatus.CANCELLED);
            case COMPLETED, CANCELLED -> Set.of();
        };
    }

    public String getTransitionDescription(MaintenanceStatus from, MaintenanceStatus to) {
        return switch (from) {
            case PENDING_SUBMIT -> switch (to) {
                case PENDING_APPROVAL -> "提交审批";
                case CANCELLED -> "取消工单";
                default -> "状态变更";
            };
            case PENDING_APPROVAL -> switch (to) {
                case APPROVED -> "审批通过";
                case REJECTED -> "审批拒绝";
                case PENDING_SUBMIT -> "退回修改";
                default -> "状态变更";
            };
            case APPROVED -> switch (to) {
                case IN_PROGRESS -> "开始施工";
                case CANCELLED -> "取消工单";
                case ABNORMAL -> "标记异常";
                default -> "状态变更";
            };
            case IN_PROGRESS -> switch (to) {
                case COMPLETED -> "完成施工";
                case ABNORMAL -> "标记异常";
                case APPROVED -> "调整计划";
                default -> "状态变更";
            };
            case REJECTED -> switch (to) {
                case PENDING_SUBMIT -> "重新提交";
                case CANCELLED -> "取消工单";
                default -> "状态变更";
            };
            case ABNORMAL -> switch (to) {
                case IN_PROGRESS -> "恢复施工";
                case COMPLETED -> "完成施工";
                case CANCELLED -> "取消工单";
                default -> "状态变更";
            };
            default -> "状态变更";
        };
    }

    public boolean canModify(MaintenanceStatus status) {
        return Set.of(
                MaintenanceStatus.PENDING_SUBMIT,
                MaintenanceStatus.PENDING_APPROVAL,
                MaintenanceStatus.REJECTED
        ).contains(status);
    }

    public boolean canApprove(MaintenanceStatus status) {
        return status == MaintenanceStatus.PENDING_APPROVAL;
    }
}
