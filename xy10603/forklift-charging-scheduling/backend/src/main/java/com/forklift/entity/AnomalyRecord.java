package com.forklift.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("anomaly_records")
public class AnomalyRecord {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String anomalyType;
    private String anomalyCode;
    private String title;
    private String description;
    private String source;
    private Long sourceId;
    private String severity;
    private String status;
    private String assignedTo;
    private LocalDateTime handledAt;
    private String handledBy;
    private String handlingNotes;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
