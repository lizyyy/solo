package com.school.canteen.dto;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class ValidationResult {
    private boolean valid = true;
    private boolean hasAllergenConflict = false;
    private boolean hasDuplicateReplacement = false;
    private boolean mealLocked = false;
    private List<String> errors = new ArrayList<>();
    private List<String> warnings = new ArrayList<>();
    private AllergenConflictDetail conflictDetail;

    @Data
    public static class AllergenConflictDetail {
        private List<String> commonAllergens;
        private List<AffectedStudentInfo> affectedStudents;
        private int affectedCount;
    }

    @Data
    public static class AffectedStudentInfo {
        private String studentNo;
        private String studentName;
        private String grade;
        private String className;
        private List<String> allergens;
        private String parentPhone;
        private String parentEmail;
    }

    public void addError(String error) {
        this.valid = false;
        this.errors.add(error);
    }

    public void addWarning(String warning) {
        this.warnings.add(warning);
    }
}
