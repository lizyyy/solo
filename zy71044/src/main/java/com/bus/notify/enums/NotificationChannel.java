package com.bus.notify.enums;

public enum NotificationChannel {
    SMS("短信", "通过手机短信通知"),
    PHONE_CALL("电话", "通过电话语音通知"),
    APP_PUSH("APP推送", "通过手机APP推送通知"),
    WECHAT("微信", "通过微信公众号通知"),
    STATION_BROADCAST("站点广播", "在站点现场广播通知");

    private final String displayName;
    private final String description;

    NotificationChannel(String displayName, String description) {
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
