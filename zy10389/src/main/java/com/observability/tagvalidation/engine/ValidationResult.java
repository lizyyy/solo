package com.observability.tagvalidation.engine;

import com.observability.tagvalidation.enums.ViolationType;
import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class ValidationResult {
    private boolean valid;
    private List<ViolationDetail> violations = new ArrayList<>();

    @Data
    public static class ViolationDetail {
        private ViolationType type;
        private String tagKey;
        private String tagValue;
        private String detail;
        private String suggestion;
        private String expectedValue;
        private String operation;

        public static ViolationDetail of(ViolationType type, String tagKey, String tagValue, String detail) {
            ViolationDetail v = new ViolationDetail();
            v.type = type;
            v.tagKey = tagKey;
            v.tagValue = tagValue;
            v.detail = detail;
            return v;
        }

        public ViolationDetail withSuggestion(String suggestion, String expectedValue, String operation) {
            this.suggestion = suggestion;
            this.expectedValue = expectedValue;
            this.operation = operation;
            return this;
        }
    }

    public void addViolation(ViolationDetail violation) {
        this.violations.add(violation);
        this.valid = false;
    }

    public boolean isValid() {
        return violations.isEmpty();
    }
}
