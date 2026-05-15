package com.observability.tagvalidation.dto;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class ValidationResultDto {
    private String requestId;
    private String sampleId;
    private boolean validated;
    private boolean valid;
    private List<ViolationDto> violations = new ArrayList<>();

    @Data
    public static class ViolationDto {
        private String violationType;
        private String tagKey;
        private String tagValue;
        private String detail;
        private boolean resolved;
        private int aggCount;
        private SuggestionDto suggestion;
    }

    @Data
    public static class SuggestionDto {
        private String suggestion;
        private String operation;
        private String expectedValue;
        private int priority;
    }
}
