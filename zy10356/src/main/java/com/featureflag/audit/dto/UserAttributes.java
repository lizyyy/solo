package com.featureflag.audit.dto;

import lombok.Data;
import java.util.HashMap;
import java.util.Map;

@Data
public class UserAttributes {
    private String userId;
    private String deviceId;
    private String sessionId;
    private String country;
    private String region;
    private String city;
    private String os;
    private String appVersion;
    private String userSegment;
    private Integer age;
    private String gender;
    private Map<String, String> customAttributes = new HashMap<>();
}
