package com.api.inspection.service;

import com.alibaba.fastjson.JSON;
import com.alibaba.fastjson.JSONPath;
import com.api.inspection.entity.*;
import com.api.inspection.enums.AssertionType;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.*;

@Slf4j
@Component
public class HttpExecuteEngine {

    private final RestTemplate restTemplate;

    public HttpExecuteEngine() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(30000);
        factory.setReadTimeout(30000);
        this.restTemplate = new RestTemplate(factory);
    }

    public StepExecutionResult executeStep(TransactionStep step, Map<String, Object> variables) {
        StepExecutionResult result = new StepExecutionResult();
        long startTime = System.currentTimeMillis();
        
        try {
            // 1. 替换 URL 和 Body 中的变量
            String resolvedUrl = resolveVariables(step.getUrl(), variables);
            String resolvedBody = resolveVariables(step.getBody(), variables);
            String resolvedHeaders = resolveVariables(step.getHeaders(), variables);

            // 2. 构建 HTTP 请求
            HttpHeaders headers = parseHeaders(resolvedHeaders);
            HttpEntity<String> requestEntity = new HttpEntity<>(resolvedBody, headers);

            // 3. 执行请求
            ResponseEntity<String> response = restTemplate.exchange(
                    resolvedUrl,
                    HttpMethod.resolve(step.getHttpMethod().toUpperCase()),
                    requestEntity,
                    String.class);

            // 4. 记录响应
            long duration = System.currentTimeMillis() - startTime;
            result.setSuccess(true);
            result.setDuration(duration);
            result.setStatusCode(response.getStatusCodeValue());
            result.setResponseBody(response.getBody());
            result.setResponseHeaders(JSON.toJSONString(response.getHeaders().toSingleValueMap()));

            // 5. 提取变量
            Map<String, Object> extractedVars = extractVariables(step.getVariableExtracts(), response);
            result.setExtractedVariables(extractedVars);

            // 6. 执行断言
            List<AssertionResultDTO> assertionResults = executeAssertions(step.getAssertions(), response, duration);
            result.setAssertionResults(assertionResults);

            // 7. 检查断言是否全部通过
            boolean allPassed = assertionResults.stream().allMatch(AssertionResultDTO::getPassed);
            if (!allPassed) {
                result.setSuccess(false);
                result.setErrorMessage("存在断言失败");
            }

        } catch (Exception e) {
            long duration = System.currentTimeMillis() - startTime;
            result.setSuccess(false);
            result.setDuration(duration);
            result.setErrorMessage(e.getMessage());
            log.error("步骤执行失败: {}", step.getStepName(), e);
        }

        return result;
    }

    private String resolveVariables(String template, Map<String, Object> variables) {
        if (template == null || template.isEmpty()) {
            return template;
        }
        String result = template;
        for (Map.Entry<String, Object> entry : variables.entrySet()) {
            String placeholder = "${" + entry.getKey() + "}";
            result = result.replace(placeholder, String.valueOf(entry.getValue()));
        }
        return result;
    }

    private HttpHeaders parseHeaders(String headersJson) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));
        
        if (headersJson != null && !headersJson.isEmpty()) {
            try {
                Map<String, String> headerMap = JSON.parseObject(headersJson, Map.class);
                for (Map.Entry<String, String> entry : headerMap.entrySet()) {
                    headers.add(entry.getKey(), entry.getValue());
                }
            } catch (Exception e) {
                log.warn("解析Header失败: {}", e.getMessage());
            }
        }
        return headers;
    }

    private Map<String, Object> extractVariables(List<VariableExtract> extracts, ResponseEntity<String> response) {
        Map<String, Object> result = new HashMap<>();
        if (extracts == null || extracts.isEmpty()) {
            return result;
        }

        for (VariableExtract extract : extracts) {
            try {
                Object value = null;
                switch (extract.getSourceType().toUpperCase()) {
                    case "RESPONSE_BODY":
                        value = JSONPath.read(response.getBody(), extract.getExtractExpression());
                        break;
                    case "HEADER":
                        value = response.getHeaders().getFirst(extract.getExtractExpression());
                        break;
                    case "STATUS_CODE":
                        value = response.getStatusCodeValue();
                        break;
                }
                if (value != null) {
                    result.put(extract.getVariableName(), value);
                }
            } catch (Exception e) {
                log.warn("变量提取失败: {} - {}", extract.getVariableName(), e.getMessage());
            }
        }
        return result;
    }

    private List<AssertionResultDTO> executeAssertions(List<AssertionRule> assertions, 
                                                        ResponseEntity<String> response, 
                                                        long duration) {
        List<AssertionResultDTO> results = new ArrayList<>();
        if (assertions == null || assertions.isEmpty()) {
            return results;
        }

        for (AssertionRule assertion : assertions) {
            if (!assertion.getEnabled()) {
                continue;
            }

            AssertionResultDTO result = new AssertionResultDTO();
            result.setAssertionType(assertion.getAssertionType());
            result.setExpectedValue(assertion.getExpectedValue());

            try {
                boolean passed = false;
                String actualValue = null;

                switch (assertion.getAssertionType()) {
                    case STATUS_CODE:
                        actualValue = String.valueOf(response.getStatusCodeValue());
                        passed = actualValue.equals(assertion.getExpectedValue());
                        break;
                    case RESPONSE_BODY:
                        actualValue = response.getBody();
                        passed = actualValue != null && actualValue.contains(assertion.getExpectedValue());
                        break;
                    case JSON_PATH:
                        Object jsonValue = JSONPath.read(response.getBody(), assertion.getExpression());
                        actualValue = jsonValue != null ? String.valueOf(jsonValue) : null;
                        passed = assertion.getExpectedValue().equals(actualValue);
                        break;
                    case HEADER:
                        actualValue = response.getHeaders().getFirst(assertion.getExpression());
                        passed = assertion.getExpectedValue().equals(actualValue);
                        break;
                    case TIME:
                        actualValue = String.valueOf(duration);
                        long expectedTime = Long.parseLong(assertion.getExpectedValue());
                        passed = duration <= expectedTime;
                        break;
                }

                result.setActualValue(actualValue);
                result.setPassed(passed);
                if (!passed) {
                    result.setErrorMessage("预期: " + assertion.getExpectedValue() + ", 实际: " + actualValue);
                }

            } catch (Exception e) {
                result.setPassed(false);
                result.setErrorMessage("断言执行失败: " + e.getMessage());
            }

            results.add(result);
        }
        return results;
    }

    public static class StepExecutionResult {
        private boolean success;
        private Long duration;
        private Integer statusCode;
        private String responseBody;
        private String responseHeaders;
        private String errorMessage;
        private Map<String, Object> extractedVariables;
        private List<AssertionResultDTO> assertionResults;
        private List<FailureLocationDTO> failureLocations;

        public boolean isSuccess() { return success; }
        public void setSuccess(boolean success) { this.success = success; }
        public Long getDuration() { return duration; }
        public void setDuration(Long duration) { this.duration = duration; }
        public Integer getStatusCode() { return statusCode; }
        public void setStatusCode(Integer statusCode) { this.statusCode = statusCode; }
        public String getResponseBody() { return responseBody; }
        public void setResponseBody(String responseBody) { this.responseBody = responseBody; }
        public String getResponseHeaders() { return responseHeaders; }
        public void setResponseHeaders(String responseHeaders) { this.responseHeaders = responseHeaders; }
        public String getErrorMessage() { return errorMessage; }
        public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }
        public Map<String, Object> getExtractedVariables() { return extractedVariables; }
        public void setExtractedVariables(Map<String, Object> extractedVariables) { this.extractedVariables = extractedVariables; }
        public List<AssertionResultDTO> getAssertionResults() { return assertionResults; }
        public void setAssertionResults(List<AssertionResultDTO> assertionResults) { this.assertionResults = assertionResults; }
        public List<FailureLocationDTO> getFailureLocations() { return failureLocations; }
        public void setFailureLocations(List<FailureLocationDTO> failureLocations) { this.failureLocations = failureLocations; }
    }

    public static class AssertionResultDTO {
        private AssertionType assertionType;
        private String expectedValue;
        private String actualValue;
        private Boolean passed;
        private String errorMessage;

        public AssertionType getAssertionType() { return assertionType; }
        public void setAssertionType(AssertionType assertionType) { this.assertionType = assertionType; }
        public String getExpectedValue() { return expectedValue; }
        public void setExpectedValue(String expectedValue) { this.expectedValue = expectedValue; }
        public String getActualValue() { return actualValue; }
        public void setActualValue(String actualValue) { this.actualValue = actualValue; }
        public Boolean getPassed() { return passed; }
        public void setPassed(Boolean passed) { this.passed = passed; }
        public String getErrorMessage() { return errorMessage; }
        public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }
    }

    public static class FailureLocationDTO {
        private String locationType;
        private String location;
        private String description;
        private String expectedValue;
        private String actualValue;

        public String getLocationType() { return locationType; }
        public void setLocationType(String locationType) { this.locationType = locationType; }
        public String getLocation() { return location; }
        public void setLocation(String location) { this.location = location; }
        public String getDescription() { return description; }
        public void setDescription(String description) { this.description = description; }
        public String getExpectedValue() { return expectedValue; }
        public void setExpectedValue(String expectedValue) { this.expectedValue = expectedValue; }
        public String getActualValue() { return actualValue; }
        public void setActualValue(String actualValue) { this.actualValue = actualValue; }
    }
}
