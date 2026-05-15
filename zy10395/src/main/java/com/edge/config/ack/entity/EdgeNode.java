package com.edge.config.ack.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("edge_node")
public class EdgeNode extends BaseEntity {
    private String nodeCode;
    private String nodeName;
    private String nodeIp;
    private String region;
    private Integer status;
}
