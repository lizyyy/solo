package com.bus.notify.enums;

public enum StationStatus {
    NORMAL("正常", "站点正常运营"),
    TEMPORARY_CLOSED("临时停运", "站点临时停运"),
    DIVERTED("改线绕行", "线路改线绕行该站点"),
    RECOVERED("已恢复", "站点已恢复正常运营");

    private final String displayName;
    private final String description;

    StationStatus(String displayName, String description) {
        this.displayName = displayName;
        this.description = description;
    }

    public String getDisplayName() {
        return displayName;
    }

    public String getDescription() {
        return description;
    }
}
