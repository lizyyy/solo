package com.hazardous.waste.controller;

import com.hazardous.waste.dto.ApiResponse;
import com.hazardous.waste.entity.TransferForm;
import com.hazardous.waste.service.TransferFormService;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/transfer-forms")
public class TransferFormController {

    private final TransferFormService transferFormService;

    public TransferFormController(TransferFormService transferFormService) {
        this.transferFormService = transferFormService;
    }

    @PostMapping
    public ApiResponse<TransferForm> createForm(@RequestBody TransferForm form) {
        return ApiResponse.success(transferFormService.createForm(form));
    }

    @GetMapping
    public ApiResponse<List<TransferForm>> getAllForms() {
        return ApiResponse.success(transferFormService.getAllForms());
    }

    @GetMapping("/unused")
    public ApiResponse<List<TransferForm>> getUnusedForms() {
        return ApiResponse.success(transferFormService.getUnusedForms());
    }

    @GetMapping("/{formNo}")
    public ApiResponse<TransferForm> getFormByNo(@PathVariable String formNo) {
        return ApiResponse.success(transferFormService.getFormByNo(formNo));
    }

    @PostMapping("/{formNo}/sign")
    public ApiResponse<TransferForm> signForm(
            @PathVariable String formNo,
            @RequestBody Map<String, String> request) {
        String receiver = request.get("receiver");
        String signature = request.get("signature");
        return ApiResponse.success(transferFormService.signForm(formNo, receiver, signature));
    }
}
