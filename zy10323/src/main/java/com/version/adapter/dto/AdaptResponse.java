package com.version.adapter.dto;

import lombok.Data;
import lombok.Builder;
import lombok.AllArgsConstructor;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class AdaptResponse {

    private String requestId;

    private String clientVersion;

    private Object adaptedResponse;

    private List<Map<String, Object>> warnings;

    private boolean hasWarnings;

    private boolean hasErrors;

    private String errorMessage;

    private Long adaptationTimeMs;
}
