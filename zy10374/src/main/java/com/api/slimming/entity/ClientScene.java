package com.api.slimming.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("client_scene")
public class ClientScene extends BaseEntity {

    private String sceneCode;

    private String sceneName;

    private String clientType;

    private String clientVersion;

    private String userGroup;

    private String description;
}
