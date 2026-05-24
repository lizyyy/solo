package com.airport.baggage.common.enums;

public enum CompensationStatus {
    CREATED("已登记"),
    PENDING_REVIEW("待复核"),
    APPROVED("已核准"),
    PAID("已支付"),
    BAGGAGE_ARRIVED("行李到件"),
    PICKED_UP("已签收"),
    DISPUTED("争议中"),
    CLOSED("已结案"),
    REJECTED("已驳回");

    private final String description;

    CompensationStatus(String description) {
        this.description = description;
    }

    public String getDescription() {
        return description;
    }
}
