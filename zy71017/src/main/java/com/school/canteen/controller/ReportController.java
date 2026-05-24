package com.school.canteen.controller;

import com.school.canteen.dto.ApiResponse;
import com.school.canteen.entity.MealReport;
import com.school.canteen.service.ReportService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/reports")
public class ReportController {

    private final ReportService reportService;

    @Autowired
    public ReportController(ReportService reportService) {
        this.reportService = reportService;
    }

    @PostMapping("/generate")
    public ApiResponse<MealReport> generate(@RequestBody GenerateReportRequest request) {
        return ApiResponse.success(reportService.generateMealReport(
            request.getMealDate(),
            request.getMealType(),
            request.getOperator() != null ? request.getOperator() : "system"
        ));
    }

    @GetMapping("/{id}")
    public ApiResponse<MealReport> getById(@PathVariable Long id) {
        return ApiResponse.success(reportService.getReport(id));
    }

    @GetMapping
    public ApiResponse<List<MealReport>> getAll() {
        return ApiResponse.success(reportService.getAllReports());
    }

    @PostMapping("/{id}/finalize")
    public ApiResponse<MealReport> finalizeReport(
            @PathVariable Long id,
            @RequestParam(required = false, defaultValue = "system") String operator) {
        return ApiResponse.success(reportService.finalizeReport(id, operator));
    }

    @GetMapping("/{id}/export")
    public ResponseEntity<byte[]> export(@PathVariable Long id) {
        byte[] excelData = reportService.exportReportToExcel(id);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
        headers.setContentDispositionFormData("attachment", "meal_report_" + id + ".xlsx");

        return ResponseEntity.ok()
            .headers(headers)
            .body(excelData);
    }

    public static class GenerateReportRequest {
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
        private LocalDate mealDate;
        private String mealType;
        private String operator;

        public LocalDate getMealDate() { return mealDate; }
        public void setMealDate(LocalDate mealDate) { this.mealDate = mealDate; }
        public String getMealType() { return mealType; }
        public void setMealType(String mealType) { this.mealType = mealType; }
        public String getOperator() { return operator; }
        public void setOperator(String operator) { this.operator = operator; }
    }
}
