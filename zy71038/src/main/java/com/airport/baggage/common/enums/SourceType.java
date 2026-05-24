package com.airport.baggage.common.enums;

public enum SourceType {
    COUNTER("值机柜台"),
    GATE("登机口"),
    ARRIVAL_HALL("到达厅"),
    BAGGAGE_CLAIM("行李提取处"),
    HOTLINE("服务热线"),
    ONLINE("线上渠道");

    private final String description;

    SourceType(String description) {
        this.description = description;
    }

    public String getDescription() {
        return description;
    }
}
