package com.api.slimming.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("api_endpoint")
public class ApiEndpoint extends BaseEntity {

    private String apiPath;

    private String httpMethod;

    private String description;

    private String originalResponseSample;

    private String requestIdKey;
}
