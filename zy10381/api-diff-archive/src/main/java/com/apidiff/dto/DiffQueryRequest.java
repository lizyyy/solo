package com.apidiff.dto;

import com.apidiff.entity.enums.ConfirmationStatus;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class DiffQueryRequest {

    private ConfirmationStatus status;

    private String apiPath;

    private Boolean hasDifferences;

    private LocalDateTime startTime;

    private LocalDateTime endTime;

    private Integer page = 0;

    private Integer size = 20;
}
