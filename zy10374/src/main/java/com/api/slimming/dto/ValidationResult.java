package com.api.slimming.dto;

import lombok.Data;

import java.util.List;

@Data
public class ValidationResult {

    private Boolean valid;

    private List<String> errors;

    private List<String> warnings;

    private String originalResponse;

    private String slimmedResponse;

    private Integer originalSize;

    private Integer slimmedSize;

    private Integer savedSize;

    private Double savedRatio;
}
