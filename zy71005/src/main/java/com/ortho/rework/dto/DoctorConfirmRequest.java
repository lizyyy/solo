package com.ortho.rework.dto;

import lombok.Data;

@Data
public class DoctorConfirmRequest {
    private String note;
    private String operator;
    private Boolean confirmed;
}
