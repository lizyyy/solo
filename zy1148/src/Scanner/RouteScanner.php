<?php

declare(strict_types=1);

namespace PhpSecurityScanner\Scanner;

use PhpSecurityScanner\Config;
use PhpSecurityScanner\Finding;

class RouteScanner extends AbstractScanner
{
    private Config $config;

    public function __construct(Config $config)
    {
        $this->config = $config;
    }

    public function getCategory(): string
    {
        return 'route_security';
    }

    public function scan(string $path): array
    {
        $this->findings = [];

        if (is_dir($path)) {
            $files = $this->scanDirectory($path, ['php'], $this->config->getExcludes());
            foreach ($files as $file) {
                $filename = basename($file);
                if (str_contains($filename, 'route') || $filename === 'web.php' || $filename === 'api.php') {
                    $this->scanFile($file);
                }
            }
        } elseif (is_file($path)) {
            $this->scanFile($path);
        }

        return $this->findings;
    }

    private function scanFile(string $filePath): void
    {
        $content = file_get_contents($filePath);
        if ($content === false) {
            return;
        }

        $lines = explode("\n", $content);

        $this->scanRouteParameters($lines, $filePath);
        $this->scanCsrfProtection($lines, $filePath);
        $this->scanAuthentication($lines, $filePath);
    }

    private function scanRouteParameters(array $lines, string $filePath): void
    {
        foreach ($lines as $lineNumber => $line) {
            if (preg_match('/\{[a-zA-Z_][a-zA-Z0-9_]*\?\}/', $line, $matches)) {
                $snippet = $this->getFileLines($filePath, $lineNumber + 1);
                
                $this->addFinding(
                    'route_optional_parameter',
                    Finding::SEVERITY_INFO,
                    $filePath,
                    $lineNumber + 1,
                    '可选路由参数: ' . trim($matches[0]),
                    Finding::CONFIDENCE_MEDIUM,
                    '可选路由参数可能导致意外的路由匹配',
                    '确保控制器正确处理可选参数的边界情况',
                    $snippet
                );
            }

            if (preg_match('/Route::(get|post|put|patch|delete|any)\s*\(\s*[\'"]([^\'"]+)\{/', $line, $matches)) {
                $method = strtoupper($matches[1] ?? 'unknown');
                $pattern = $matches[2] ?? 'unknown';
                
                if (str_contains($line, 'where(')) {
                    continue;
                }

                if (preg_match('/\{[a-zA-Z_][a-zA-Z0-9_]*\}/', $line, $paramMatch)) {
                    $snippet = $this->getFileLines($filePath, $lineNumber + 1);
                    
                    $this->addFinding(
                        'route_unconstrained_parameter',
                        Finding::SEVERITY_LOW,
                        $filePath,
                        $lineNumber + 1,
                        sprintf('未约束的路由参数 %s %s: %s', $method, $pattern, $paramMatch[0]),
                        Finding::CONFIDENCE_MEDIUM,
                        '路由参数没有使用 where() 约束，可能接受意外的值',
                        '使用 ->where() 方法对参数进行正则约束',
                        $snippet
                    );
                }
            }
        }
    }

    private function scanCsrfProtection(array $lines, string $filePath): void
    {
        $routeWithoutCsrf = [];
        $hasCsrfMiddleware = false;
        $hasCsrfException = false;

        foreach ($lines as $lineNumber => $line) {
            if (preg_match('/Route::(post|put|patch|delete)\s*\(/i', $line)) {
                $routeWithoutCsrf[] = [
                    'line' => $lineNumber + 1,
                    'content' => $line,
                ];
            }

            if (preg_match('/middleware.*csrf|csrf.*middleware/i', $line)) {
                $hasCsrfMiddleware = true;
            }

            if (preg_match('/except.*csrf|csrf.*except/i', $line)) {
                $hasCsrfException = true;
                $snippet = $this->getFileLines($filePath, $lineNumber + 1);
                
                $this->addFinding(
                    'route_csrf_exception',
                    Finding::SEVERITY_MEDIUM,
                    $filePath,
                    $lineNumber + 1,
                    'CSRF 保护例外路由',
                    Finding::CONFIDENCE_HIGH,
                    '存在 CSRF 保护例外的路由，需要验证这些路由是否真的不需要 CSRF 保护',
                    '仅对真正需要绕过 CSRF 的路由（如 API 回调）添加例外，并使用其他认证方式',
                    $snippet
                );
            }

            if (preg_match('/withoutMiddleware.*VerifyCsrfToken/i', $line)) {
                $snippet = $this->getFileLines($filePath, $lineNumber + 1);
                
                $this->addFinding(
                    'route_disable_csrf',
                    Finding::SEVERITY_HIGH,
                    $filePath,
                    $lineNumber + 1,
                    '禁用 CSRF 中间件: ' . trim($line),
                    Finding::CONFIDENCE_HIGH,
                    '直接禁用 CSRF 中间件会移除该路由组的 CSRF 保护',
                    '使用 $except 属性精确指定例外路由，而不是完全禁用中间件',
                    $snippet
                );
            }
        }

        if (!$hasCsrfMiddleware && !empty($routeWithoutCsrf)) {
            foreach (array_slice($routeWithoutCsrf, 0, 5) as $route) {
                $snippet = $this->getFileLines($filePath, $route['line']);
                
                $this->addFinding(
                    'route_missing_csrf',
                    Finding::SEVERITY_MEDIUM,
                    $filePath,
                    $route['line'],
                    '可能缺少 CSRF 保护: ' . trim($route['content']),
                    Finding::CONFIDENCE_LOW,
                    'POST/PUT/DELETE 路由没有明确的 CSRF 中间件',
                    '确保路由组应用了 VerifyCsrfToken 中间件',
                    $snippet
                );
            }
        }
    }

    private function scanAuthentication(array $lines, string $filePath): void
    {
        $hasAuthMiddleware = false;
        $routesWithoutAuth = [];

        foreach ($lines as $lineNumber => $line) {
            if (preg_match('/middleware.*auth|auth.*middleware/i', $line)) {
                $hasAuthMiddleware = true;
            }

            if (preg_match('/Route::(get|post|put|patch|delete|any)\s*\(/i', $line)) {
                if (!preg_match('/middleware.*auth|->auth\(/i', $line) && 
                    !preg_match('/auth\s*\(/i', $line) &&
                    !preg_match('/guest\s*\(/i', $line)) {
                    
                    $routesWithoutAuth[] = [
                        'line' => $lineNumber + 1,
                        'content' => $line,
                    ];
                }
            }
        }

        if (!$hasAuthMiddleware && !empty($routesWithoutAuth)) {
            foreach (array_slice($routesWithoutAuth, 0, 3) as $route) {
                $snippet = $this->getFileLines($filePath, $route['line']);
                
                $this->addFinding(
                    'route_missing_auth',
                    Finding::SEVERITY_INFO,
                    $filePath,
                    $route['line'],
                    '未明确认证的路由: ' . trim($route['content']),
                    Finding::CONFIDENCE_LOW,
                    '路由没有明确的认证中间件',
                    '审查路由是否确实应该公开访问，敏感路由应添加 auth 中间件',
                    $snippet
                );
            }
        }
    }
}
