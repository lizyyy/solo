package com.hospital.oxygen.controller;

import com.hospital.oxygen.common.ApiResponse;
import com.hospital.oxygen.dto.BookingRequest;
import com.hospital.oxygen.dto.OverrideRequest;
import com.hospital.oxygen.entity.Booking;
import com.hospital.oxygen.enums.BookingStatus;
import com.hospital.oxygen.service.BookingService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/bookings")
public class BookingController {

    private final BookingService bookingService;

    public BookingController(BookingService bookingService) {
        this.bookingService = bookingService;
    }

    @PostMapping
    public ApiResponse<Booking> createBooking(@RequestBody BookingRequest request) {
        Booking booking = bookingService.createBooking(request);
        if (booking.getStatus() == BookingStatus.REJECTED) {
            return ApiResponse.error(400, "预约被拒绝: " + booking.getRuleViolations(), booking);
        }
        return ApiResponse.success("预约创建成功", booking);
    }

    @GetMapping("/{bookingNumber}")
    public ApiResponse<Booking> getBooking(@PathVariable String bookingNumber) {
        return ApiResponse.success(bookingService.getBooking(bookingNumber));
    }

    @GetMapping
    public ApiResponse<List<Booking>> getAllBookings() {
        return ApiResponse.success(bookingService.getAllBookings());
    }

    @GetMapping("/active")
    public ApiResponse<List<Booking>> getActiveBookings() {
        return ApiResponse.success(bookingService.getActiveBookings());
    }

    @GetMapping("/patient/{patientId}")
    public ApiResponse<List<Booking>> getBookingsByPatient(@PathVariable String patientId) {
        return ApiResponse.success(bookingService.getBookingsByPatient(patientId));
    }

    @PostMapping("/{bookingNumber}/complete")
    public ApiResponse<Booking> completeBooking(@PathVariable String bookingNumber, @RequestParam(required = false) String operator) {
        return ApiResponse.success("预约完成", bookingService.completeBooking(bookingNumber, operator != null ? operator : "SYSTEM"));
    }

    @PostMapping("/{bookingNumber}/cancel")
    public ApiResponse<Booking> cancelBooking(@PathVariable String bookingNumber, @RequestParam(required = false) String operator) {
        return ApiResponse.success("预约已取消", bookingService.cancelBooking(bookingNumber, operator != null ? operator : "SYSTEM"));
    }

    @PostMapping("/{bookingNumber}/override")
    public ApiResponse<Booking> overrideBooking(@PathVariable String bookingNumber, @RequestBody OverrideRequest request) {
        BookingStatus newStatus = request.getNewStatus() != null ? BookingStatus.valueOf(request.getNewStatus()) : BookingStatus.COMPLETED;
        return ApiResponse.success("人工改判完成", bookingService.overrideBooking(bookingNumber, request.getReason(), request.getOperator(), newStatus));
    }
}
