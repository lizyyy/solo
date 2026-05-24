package com.bus.notify.controller;

import com.bus.notify.dto.ResultDTO;
import com.bus.notify.entity.SpecialPassenger;
import com.bus.notify.repository.SpecialPassengerRepository;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/special-passengers")
public class SpecialPassengerController {
    private final SpecialPassengerRepository passengerRepository;
    
    public SpecialPassengerController(SpecialPassengerRepository passengerRepository) {
        this.passengerRepository = passengerRepository;
    }
    
    @PostMapping
    public ResultDTO<SpecialPassenger> create(@RequestBody SpecialPassenger passenger) {
        passenger.setId(null);
        passenger.setActive(true);
        return ResultDTO.success(passengerRepository.save(passenger));
    }
    
    @GetMapping
    public ResultDTO<List<SpecialPassenger>> getAll() {
        return ResultDTO.success(passengerRepository.findByActiveTrue());
    }
    
    @GetMapping("/{id}")
    public ResultDTO<SpecialPassenger> getById(@PathVariable Long id) {
        return passengerRepository.findById(id)
                .map(ResultDTO::success)
                .orElse(ResultDTO.fail("乘客不存在"));
    }
    
    @GetMapping("/card/{cardNo}")
    public ResultDTO<SpecialPassenger> getByCardNo(@PathVariable String cardNo) {
        return passengerRepository.findByCardNo(cardNo)
                .map(ResultDTO::success)
                .orElse(ResultDTO.fail("乘客不存在"));
    }
    
    @PutMapping("/{id}")
    public ResultDTO<SpecialPassenger> update(@PathVariable Long id, @RequestBody SpecialPassenger passenger) {
        return passengerRepository.findById(id)
                .map(existing -> {
                    existing.setPassengerName(passenger.getPassengerName());
                    existing.setCardType(passenger.getCardType());
                    existing.setPhone(passenger.getPhone());
                    existing.setAddress(passenger.getAddress());
                    existing.setEmergencyContact(passenger.getEmergencyContact());
                    existing.setEmergencyPhone(passenger.getEmergencyPhone());
                    existing.setCommonRoute(passenger.getCommonRoute());
                    existing.setCommonStation(passenger.getCommonStation());
                    existing.setNeedPhoneCall(passenger.getNeedPhoneCall());
                    existing.setRemark(passenger.getRemark());
                    return ResultDTO.success(passengerRepository.save(existing));
                })
                .orElse(ResultDTO.fail("乘客不存在"));
    }
    
    @DeleteMapping("/{id}")
    public ResultDTO<Void> delete(@PathVariable Long id) {
        return passengerRepository.findById(id)
                .map(passenger -> {
                    passenger.setActive(false);
                    passengerRepository.save(passenger);
                    return ResultDTO.<Void>success(null);
                })
                .orElse(ResultDTO.fail("乘客不存在"));
    }
    
    @GetMapping("/need-phone-call")
    public ResultDTO<List<SpecialPassenger>> getNeedPhoneCall() {
        return ResultDTO.success(passengerRepository.findByNeedPhoneCallTrueAndActiveTrue());
    }
    
    @GetMapping("/affected")
    public ResultDTO<List<SpecialPassenger>> getAffectedPassengers(
            @RequestParam(required = false) String route,
            @RequestParam(required = false) String station) {
        return ResultDTO.success(passengerRepository.findAffectedPassengers(
                route != null ? route : "",
                station != null ? station : ""));
    }
}
