package com.business.recalculate.model;

public enum RecalculateStatus {
    CREATED("已创建", "重算批次已创建，等待校验"),
    VALIDATING("校验中", "正在校验事件范围和处理规则"),
    VALIDATED("已校验", "校验通过，可开始重算"),
    VALIDATION_FAILED("校验失败", "校验未通过，请检查错误信息"),
    RECALCULATING("重算中", "沙箱环境正在执行重算逻辑"),
    RECALCULATED("重算完成", "沙箱重算已完成，等待结果对比"),
    RECALCULATE_FAILED("重算失败", "重算过程中出现错误"),
    COMPARING("对比中", "正在对比重算结果与原始结果"),
    COMPARED("对比完成", "结果对比已完成，可决定是否发布"),
    COMPARE_FAILED("对比失败", "结果对比过程中出现错误"),
    PUBLISHING("发布中", "正在将重算结果发布到生产环境"),
    PUBLISHED("已发布", "重算结果已成功发布到生产环境"),
    PUBLISH_FAILED("发布失败", "发布过程中出现错误"),
    REVOKING("撤销中", "正在撤销已发布的重算结果"),
    REVOKED("已撤销", "已成功撤销，恢复到重算前状态"),
    REVOKE_FAILED("撤销失败", "撤销过程中出现错误"),
    CANCELLED("已取消", "批次已被手动取消");

    private final String displayName;
    private final String description;

    RecalculateStatus(String displayName, String description) {
        this.displayName = displayName;
        this.description = description;
    }

    public String getDisplayName() {
        return displayName;
    }

    public String getDescription() {
        return description;
    }

    public boolean canTransitionTo(RecalculateStatus target) {
        return switch (this) {
            case CREATED -> target == VALIDATING || target == CANCELLED;
            case VALIDATING -> target == VALIDATED || target == VALIDATION_FAILED;
            case VALIDATED -> target == RECALCULATING || target == CANCELLED;
            case RECALCULATING -> target == RECALCULATED || target == RECALCULATE_FAILED;
            case RECALCULATED -> target == COMPARING || target == CANCELLED;
            case RECALCULATE_FAILED -> target == RECALCULATING || target == CANCELLED;
            case COMPARING -> target == COMPARED || target == COMPARE_FAILED;
            case COMPARED -> target == PUBLISHING || target == CANCELLED;
            case COMPARE_FAILED -> target == COMPARING || target == CANCELLED;
            case PUBLISHING -> target == PUBLISHED || target == PUBLISH_FAILED;
            case PUBLISHED -> target == REVOKING;
            case PUBLISH_FAILED -> target == PUBLISHING || target == CANCELLED;
            case REVOKING -> target == REVOKED || target == REVOKE_FAILED;
            case REVOKE_FAILED -> target == REVOKING;
            default -> false;
        };
    }
}
