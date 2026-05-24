package com.school.canteen.dto;

import java.util.ArrayList;
import java.util.List;

public class ValidationResult {
    private boolean valid = true;
    private boolean hasAllergenConflict = false;
    private boolean hasDuplicateReplacement = false;
    private boolean mealLocked = false;
    private List<String> errors = new ArrayList<>();
    private List<String> warnings = new ArrayList<>();
    private AllergenConflictDetail conflictDetail;

    public static class AllergenConflictDetail {
        private List<String> commonAllergens;
        private List<AffectedStudentInfo> affectedStudents;
        private int affectedCount;

        public List<String> getCommonAllergens() { return commonAllergens; }
        public void setCommonAllergens(List<String> commonAllergens) { this.commonAllergens = commonAllergens; }
        public List<AffectedStudentInfo> getAffectedStudents() { return affectedStudents; }
        public void setAffectedStudents(List<AffectedStudentInfo> affectedStudents) { this.affectedStudents = affectedStudents; }
        public int getAffectedCount() { return affectedCount; }
        public void setAffectedCount(int affectedCount) { this.affectedCount = affectedCount; }
    }

    public static class AffectedStudentInfo {
        private String studentNo;
        private String studentName;
        private String grade;
        private String className;
        private List<String> allergens;
        private String parentPhone;
        private String parentEmail;

        public String getStudentNo() { return studentNo; }
        public void setStudentNo(String studentNo) { this.studentNo = studentNo; }
        public String getStudentName() { return studentName; }
        public void setStudentName(String studentName) { this.studentName = studentName; }
        public String getGrade() { return grade; }
        public void setGrade(String grade) { this.grade = grade; }
        public String getClassName() { return className; }
        public void setClassName(String className) { this.className = className; }
        public List<String> getAllergens() { return allergens; }
        public void setAllergens(List<String> allergens) { this.allergens = allergens; }
        public String getParentPhone() { return parentPhone; }
        public void setParentPhone(String parentPhone) { this.parentPhone = parentPhone; }
        public String getParentEmail() { return parentEmail; }
        public void setParentEmail(String parentEmail) { this.parentEmail = parentEmail; }
    }

    public void addError(String error) {
        this.valid = false;
        this.errors.add(error);
    }

    public void addWarning(String warning) {
        this.warnings.add(warning);
    }

    public boolean isValid() { return valid; }
    public void setValid(boolean valid) { this.valid = valid; }
    public boolean isHasAllergenConflict() { return hasAllergenConflict; }
    public void setHasAllergenConflict(boolean hasAllergenConflict) { this.hasAllergenConflict = hasAllergenConflict; }
    public boolean isHasDuplicateReplacement() { return hasDuplicateReplacement; }
    public void setHasDuplicateReplacement(boolean hasDuplicateReplacement) { this.hasDuplicateReplacement = hasDuplicateReplacement; }
    public boolean isMealLocked() { return mealLocked; }
    public void setMealLocked(boolean mealLocked) { this.mealLocked = mealLocked; }
    public List<String> getErrors() { return errors; }
    public void setErrors(List<String> errors) { this.errors = errors; }
    public List<String> getWarnings() { return warnings; }
    public void setWarnings(List<String> warnings) { this.warnings = warnings; }
    public AllergenConflictDetail getConflictDetail() { return conflictDetail; }
    public void setConflictDetail(AllergenConflictDetail conflictDetail) { this.conflictDetail = conflictDetail; }
}
