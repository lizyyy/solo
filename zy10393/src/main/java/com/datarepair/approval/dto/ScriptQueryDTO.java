package com.datarepair.approval.dto;

import com.datarepair.approval.enums.ScriptStatus;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class ScriptQueryDTO {

    private String scriptNo;

    private String scriptName;

    private String scriptType;

    private ScriptStatus status;

    private String businessSystem;

    private String applicant;

    private LocalDateTime startTime;

    private LocalDateTime endTime;

    private Integer pageNum = 1;

    private Integer pageSize = 20;
}
