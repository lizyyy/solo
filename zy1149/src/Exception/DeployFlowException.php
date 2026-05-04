<?php

declare(strict_types=1);

namespace DeployFlow\Exception;

use RuntimeException;

class DeployFlowException extends RuntimeException
{
    public const CODE_VALIDATION_ERROR = 100;
    public const CODE_PARSING_ERROR = 200;
    public const CODE_BUILD_ERROR = 300;
    public const CODE_RELEASE_ERROR = 400;
    public const CODE_ROLLBACK_ERROR = 500;
    public const CODE_REPORT_ERROR = 600;
    public const CODE_IO_ERROR = 700;
    public const CODE_CONFIG_ERROR = 800;
    public const CODE_DEPENDENCY_ERROR = 900;

    private array $details = [];

    public static function validationError(string $message, array $details = []): self
    {
        $exception = new self($message, self::CODE_VALIDATION_ERROR);
        $exception->details = $details;
        return $exception;
    }

    public static function parsingError(string $file, string $message, int $line = 0): self
    {
        $error = "Parsing error in file: {$file}";
        if ($line > 0) {
            $error .= " (line: {$line})";
        }
        $error .= "\nMessage: {$message}";

        $exception = new self($error, self::CODE_PARSING_ERROR);
        $exception->details = ['file' => $file, 'line' => $line];
        return $exception;
    }

    public static function buildError(string $message, ?string $context = null): self
    {
        $fullMessage = "Build error: {$message}";
        if ($context) {
            $fullMessage .= "\nContext: {$context}";
        }
        return new self($fullMessage, self::CODE_BUILD_ERROR);
    }

    public static function releaseError(string $step, string $message): self
    {
        return new self("Release step '{$step}' failed: {$message}", self::CODE_RELEASE_ERROR);
    }

    public static function rollbackError(string $message, ?string $version = null): self
    {
        $fullMessage = "Rollback error: {$message}";
        if ($version) {
            $fullMessage .= " (version: {$version})";
        }
        return new self($fullMessage, self::CODE_ROLLBACK_ERROR);
    }

    public static function reportError(string $message): self
    {
        return new self($message, self::CODE_REPORT_ERROR);
    }

    public static function dependencyError(array $missingDependencies): self
    {
        $message = 'Missing dependencies: ' . implode(', ', $missingDependencies);
        $exception = new self($message, self::CODE_DEPENDENCY_ERROR);
        $exception->details = ['missing' => $missingDependencies];
        return $exception;
    }

    public static function ioError(string $operation, string $path, string $reason): self
    {
        return new self(
            "IO error during '{$operation}' on path '{$path}': {$reason}",
            self::CODE_IO_ERROR
        );
    }

    public static function configError(string $key, string $message): self
    {
        return new self("Configuration error for '{$key}': {$message}", self::CODE_CONFIG_ERROR);
    }

    public function getDetails(): array
    {
        return $this->details;
    }

    public function hasDetails(): bool
    {
        return !empty($this->details);
    }

    public function getDetail(string $key, mixed $default = null): mixed
    {
        return $this->details[$key] ?? $default;
    }
}
