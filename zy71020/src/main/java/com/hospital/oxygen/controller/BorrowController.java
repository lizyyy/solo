package com.hospital.oxygen.controller;

import com.hospital.oxygen.common.ApiResponse;
import com.hospital.oxygen.dto.BorrowRequest;
import com.hospital.oxygen.dto.OverrideRequest;
import com.hospital.oxygen.entity.EquipmentBorrow;
import com.hospital.oxygen.enums.BorrowStatus;
import com.hospital.oxygen.service.EquipmentBorrowService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/borrows")
public class BorrowController {

    private final EquipmentBorrowService borrowService;

    public BorrowController(EquipmentBorrowService borrowService) {
        this.borrowService = borrowService;
    }

    @PostMapping
    public ApiResponse<EquipmentBorrow> requestBorrow(@RequestBody BorrowRequest request) {
        EquipmentBorrow borrow = borrowService.requestBorrow(request);
        if (borrow.getStatus() == BorrowStatus.CANCELLED) {
            return ApiResponse.error(400, "借用申请被拒绝", borrow);
        }
        return ApiResponse.success("借用申请创建成功", borrow);
    }

    @GetMapping("/{borrowNumber}")
    public ApiResponse<EquipmentBorrow> getBorrow(@PathVariable String borrowNumber) {
        return ApiResponse.success(borrowService.getBorrow(borrowNumber));
    }

    @GetMapping
    public ApiResponse<List<EquipmentBorrow>> getAllBorrows() {
        return ApiResponse.success(borrowService.getAllBorrows());
    }

    @GetMapping("/overdue")
    public ApiResponse<List<EquipmentBorrow>> getOverdueBorrows() {
        return ApiResponse.success(borrowService.getOverdueBorrows());
    }

    @GetMapping("/patient/{patientId}")
    public ApiResponse<List<EquipmentBorrow>> getBorrowsByPatient(@PathVariable String patientId) {
        return ApiResponse.success(borrowService.getBorrowsByPatient(patientId));
    }

    @PostMapping("/{borrowNumber}/approve")
    public ApiResponse<EquipmentBorrow> approveBorrow(@PathVariable String borrowNumber, @RequestParam(required = false) String operator) {
        return ApiResponse.success("审批通过", borrowService.approveBorrow(borrowNumber, operator != null ? operator : "SYSTEM"));
    }

    @PostMapping("/{borrowNumber}/borrow")
    public ApiResponse<EquipmentBorrow> borrowEquipment(@PathVariable String borrowNumber, @RequestParam(required = false) String operator) {
        return ApiResponse.success("设备已借出", borrowService.borrowEquipment(borrowNumber, operator != null ? operator : "SYSTEM"));
    }

    @PostMapping("/{borrowNumber}/return")
    public ApiResponse<EquipmentBorrow> returnEquipment(@PathVariable String borrowNumber, @RequestParam(required = false) String operator) {
        return ApiResponse.success("设备已归还", borrowService.returnEquipment(borrowNumber, operator != null ? operator : "SYSTEM"));
    }

    @PostMapping("/check-overdue")
    public ApiResponse<String> checkOverdueBorrows() {
        borrowService.checkOverdueBorrows();
        return ApiResponse.success("超时检查完成", null);
    }

    @PostMapping("/{borrowNumber}/override")
    public ApiResponse<EquipmentBorrow> overrideBorrow(@PathVariable String borrowNumber, @RequestBody OverrideRequest request) {
        BorrowStatus newStatus = request.getNewStatus() != null ? BorrowStatus.valueOf(request.getNewStatus()) : BorrowStatus.RETURNED;
        return ApiResponse.success("人工改判完成", borrowService.overrideBorrow(borrowNumber, request.getReason(), request.getOperator(), newStatus));
    }
}
