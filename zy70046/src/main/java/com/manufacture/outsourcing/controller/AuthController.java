package com.manufacture.outsourcing.controller;

import com.manufacture.outsourcing.common.Result;
import com.manufacture.outsourcing.dto.LoginRequest;
import com.manufacture.outsourcing.dto.LoginResponse;
import com.manufacture.outsourcing.entity.User;
import com.manufacture.outsourcing.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/login")
    public Result<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
        return Result.success(authService.login(request));
    }

    @PostMapping("/register")
    public Result<User> register(@RequestParam String username,
                                  @RequestParam String password,
                                  @RequestParam String realName,
                                  @RequestParam String role) {
        return Result.success(authService.createUser(username, password, realName, role));
    }
}
