package com.dependency.license.util;

import com.dependency.license.exception.BusinessException;
import org.springframework.stereotype.Component;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Component
public class SemanticVersionValidator {
    private static final Pattern SEMVER_PATTERN = Pattern.compile(
            "^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)" +
            "(?:-((?:0|[1-9]\\d*|\\d*[a-zA-Z-][0-9a-zA-Z-]*)" +
            "(?:\\.(?:0|[1-9]\\d*|\\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?" +
            "(?:\\+([0-9a-zA-Z-]+(?:\\.[0-9a-zA-Z-]+)*))?$"
    );

    public void validate(String version) {
        if (version == null || version.isBlank()) {
            throw new BusinessException(400, "版本号不能为空");
        }
        Matcher matcher = SEMVER_PATTERN.matcher(version.trim());
        if (!matcher.matches()) {
            throw new BusinessException(400, "版本号格式不符合语义化版本规范: " + version);
        }
    }

    public boolean isUpgrade(String currentVersion, String targetVersion) {
        int[] current = parseVersion(currentVersion);
        int[] target = parseVersion(targetVersion);
        
        for (int i = 0; i < 3; i++) {
            if (target[i] > current[i]) {
                return true;
            } else if (target[i] < current[i]) {
                return false;
            }
        }
        return false;
    }

    public int compare(String v1, String v2) {
        int[] ver1 = parseVersion(v1);
        int[] ver2 = parseVersion(v2);
        
        for (int i = 0; i < 3; i++) {
            if (ver1[i] != ver2[i]) {
                return Integer.compare(ver1[i], ver2[i]);
            }
        }
        return 0;
    }

    private int[] parseVersion(String version) {
        String cleanVersion = version.split("-")[0].split("\\+")[0];
        String[] parts = cleanVersion.split("\\.");
        return new int[]{
                Integer.parseInt(parts[0]),
                Integer.parseInt(parts[1]),
                Integer.parseInt(parts.length > 2 ? parts[2] : "0")
        };
    }
}