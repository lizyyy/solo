package com.edge.config.ack.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("config_version")
public class ConfigVersion extends BaseEntity {
    private String versionNo;
    private String configType;
    private String configContent;
    private LocalDateTime publishTime;
    private String publisher;
    private Integer status;
}
