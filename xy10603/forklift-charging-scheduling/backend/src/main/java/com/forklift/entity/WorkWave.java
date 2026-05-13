package com.forklift.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("work_waves")
public class WorkWave {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String waveCode;
    private String waveName;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private Integer priority;
    private String status;
    private Integer requiredForklifts;
    private Integer actualForklifts;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
