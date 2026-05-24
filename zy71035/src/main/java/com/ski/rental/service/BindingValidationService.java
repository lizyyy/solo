package com.ski.rental.service;

import com.ski.rental.model.BindingSpec;
import com.ski.rental.model.Customer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@Service
public class BindingValidationService {

    @Value("${app.rental.binding-release-tolerance:1.5}")
    private BigDecimal releaseTolerance;

    public ValidationResult validateBindingParams(Customer customer, BindingSpec bindingSpec,
                                                  BigDecimal actualReleaseValue) {
        List<String> errors = new ArrayList<>();
        List<String> warnings = new ArrayList<>();

        if (bindingSpec.getMinReleaseValue() != null && bindingSpec.getMaxReleaseValue() != null) {
            if (actualReleaseValue.compareTo(bindingSpec.getMinReleaseValue()) < 0 ||
                actualReleaseValue.compareTo(bindingSpec.getMaxReleaseValue()) > 0) {
                errors.add(String.format("释放值 %.1f 超出绑定器范围 [%.1f, %.1f]",
                    actualReleaseValue, bindingSpec.getMinReleaseValue(), bindingSpec.getMaxReleaseValue()));
            }
        }

        if (customer.getPreferredReleaseValue() != null) {
            BigDecimal diff = actualReleaseValue.subtract(customer.getPreferredReleaseValue()).abs();
            if (diff.compareTo(releaseTolerance) > 0) {
                warnings.add(String.format("释放值与租客偏好差异 %.1f 超过容差 %.1f",
                    diff, releaseTolerance));
            }
        }

        if (bindingSpec.getMinBootSize() != null && bindingSpec.getMaxBootSize() != null
            && customer.getBootSize() != null) {
            if (customer.getBootSize() < bindingSpec.getMinBootSize() ||
                customer.getBootSize() > bindingSpec.getMaxBootSize()) {
                errors.add(String.format("租客鞋码 %d 超出绑定器适配范围 [%d, %d]",
                    customer.getBootSize(), bindingSpec.getMinBootSize(), bindingSpec.getMaxBootSize()));
            }
        }

        if (bindingSpec.getRecommendedHeightMin() != null && bindingSpec.getRecommendedHeightMax() != null
            && customer.getHeightCm() != null) {
            if (customer.getHeightCm().compareTo(bindingSpec.getRecommendedHeightMin()) < 0 ||
                customer.getHeightCm().compareTo(bindingSpec.getRecommendedHeightMax()) > 0) {
                warnings.add(String.format("租客身高 %.1fcm 不在推荐范围 [%.1f, %.1f]",
                    customer.getHeightCm(), bindingSpec.getRecommendedHeightMin(),
                    bindingSpec.getRecommendedHeightMax()));
            }
        }

        if (bindingSpec.getRecommendedWeightMin() != null && bindingSpec.getRecommendedWeightMax() != null
            && customer.getWeightKg() != null) {
            if (customer.getWeightKg().compareTo(bindingSpec.getRecommendedWeightMin()) < 0 ||
                customer.getWeightKg().compareTo(bindingSpec.getRecommendedWeightMax()) > 0) {
                warnings.add(String.format("租客体重 %.1fkg 不在推荐范围 [%.1f, %.1f]",
                    customer.getWeightKg(), bindingSpec.getRecommendedWeightMin(),
                    bindingSpec.getRecommendedWeightMax()));
            }
        }

        return new ValidationResult(errors.isEmpty(), errors, warnings);
    }

    public static class ValidationResult {
        private final boolean valid;
        private final List<String> errors;
        private final List<String> warnings;

        public ValidationResult(boolean valid, List<String> errors, List<String> warnings) {
            this.valid = valid;
            this.errors = errors;
            this.warnings = warnings;
        }

        public boolean isValid() { return valid; }
        public List<String> getErrors() { return errors; }
        public List<String> getWarnings() { return warnings; }

        public String getSummary() {
            StringBuilder sb = new StringBuilder();
            if (!errors.isEmpty()) {
                sb.append("错误: ").append(String.join("; ", errors));
            }
            if (!warnings.isEmpty()) {
                if (sb.length() > 0) sb.append(" ");
                sb.append("警告: ").append(String.join("; ", warnings));
            }
            return sb.length() > 0 ? sb.toString() : "参数校验通过";
        }
    }
}
