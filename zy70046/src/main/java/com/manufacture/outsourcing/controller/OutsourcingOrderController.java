package com.manufacture.outsourcing.controller;

import com.manufacture.outsourcing.common.PageResult;
import com.manufacture.outsourcing.common.Result;
import com.manufacture.outsourcing.dto.OutsourcingOrderRequest;
import com.manufacture.outsourcing.entity.OutsourcingOrder;
import com.manufacture.outsourcing.service.OutsourcingOrderService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/orders")
public class OutsourcingOrderController {

    private final OutsourcingOrderService orderService;

    public OutsourcingOrderController(OutsourcingOrderService orderService) {
        this.orderService = orderService;
    }

    @PostMapping
    public Result<OutsourcingOrder> create(@Valid @RequestBody OutsourcingOrderRequest request) {
        return Result.success(orderService.create(request));
    }

    @GetMapping("/{id}")
    public Result<OutsourcingOrder> getById(@PathVariable Long id) {
        return Result.success(orderService.getById(id));
    }

    @GetMapping("/no/{orderNo}")
    public Result<OutsourcingOrder> getByOrderNo(@PathVariable String orderNo) {
        return Result.success(orderService.getByOrderNo(orderNo));
    }

    @GetMapping
    public Result<PageResult<OutsourcingOrder>> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Page<OutsourcingOrder> pageResult = orderService.findAll(
                PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt")));
        return Result.success(PageResult.of(
                pageResult.getContent(),
                pageResult.getTotalElements(),
                pageResult.getNumber(),
                pageResult.getSize()
        ));
    }

    @PostMapping("/{id}/confirm")
    public Result<OutsourcingOrder> confirm(@PathVariable Long id) {
        return Result.success(orderService.confirm(id));
    }

    @PostMapping("/{id}/close")
    public Result<OutsourcingOrder> close(@PathVariable Long id) {
        return Result.success(orderService.close(id));
    }
}
