<?php

declare(strict_types=1);

namespace DeployFlow\Parser;

use DeployFlow\Exception\DeployFlowException;

class EnvMatrixParser
{
    private array $data = [];
    private array $environments = [];
    private array $variables = [];
    private string $matrixPath;

    public function __construct(string $matrixPath)
    {
        $this->matrixPath = $matrixPath;
    }

    public function parse(): void
    {
        if (!file_exists($this->matrixPath)) {
            throw DeployFlowException::ioError('read', $this->matrixPath, 'File not found');
        }

        $handle = fopen($this->matrixPath, 'r');
        if ($handle === false) {
            throw DeployFlowException::ioError('read', $this->matrixPath, 'Cannot open file');
        }

        $row = 0;
        $headers = [];

        while (($data = fgetcsv($handle, 0, ',', '"', '')) !== false) {
            $row++;

            if (empty($data) || (count($data) === 1 && trim($data[0]) === '')) {
                continue;
            }

            if ($row === 1) {
                $headers = $this->parseHeaders($data);
                continue;
            }

            $this->parseRow($data, $headers, $row);
        }

        fclose($handle);
    }

    private function parseHeaders(array $headerRow): array
    {
        $headers = [];
        $count = count($headerRow);

        if ($count < 2) {
            throw DeployFlowException::parsingError(
                $this->matrixPath,
                'Environment matrix must have at least 2 columns: variable name + at least 1 environment'
            );
        }

        $varName = trim($headerRow[0]);
        if ($varName === '') {
            throw DeployFlowException::parsingError(
                $this->matrixPath,
                'First column header cannot be empty (should be variable name)'
            );
        }

        $headers[] = 'variable';

        for ($i = 1; $i < $count; $i++) {
            $envName = trim($headerRow[$i]);
            if ($envName === '') {
                throw DeployFlowException::parsingError(
                    $this->matrixPath,
                    "Environment name in column " . ($i + 1) . " cannot be empty"
                );
            }
            $headers[] = $envName;
            $this->environments[$envName] = true;
        }

        return $headers;
    }

    private function parseRow(array $row, array $headers, int $lineNumber): void
    {
        $count = count($headers);
        $rowCount = count($row);

        if ($rowCount < $count) {
            $row = array_pad($row, $count, '');
        }

        $variable = trim($row[0] ?? '');
        if ($variable === '') {
            return;
        }

        $this->variables[$variable] = true;
        $this->data[$variable] = [];

        for ($i = 1; $i < $count; $i++) {
            $envName = $headers[$i];
            $value = trim($row[$i] ?? '');
            $this->data[$variable][$envName] = $value;
        }
    }

    public function getEnvironments(): array
    {
        return array_keys($this->environments);
    }

    public function getVariables(): array
    {
        return array_keys($this->variables);
    }

    public function getValue(string $variable, string $environment): ?string
    {
        return $this->data[$variable][$environment] ?? null;
    }

    public function getEnvironmentValues(string $environment): array
    {
        $values = [];
        foreach ($this->variables as $variable => $_) {
            $values[$variable] = $this->data[$variable][$environment] ?? '';
        }
        return $values;
    }

    public function getVariableValues(string $variable): array
    {
        return $this->data[$variable] ?? [];
    }

    public function findDifferences(string $env1, string $env2): array
    {
        $differences = [];
        
        foreach ($this->variables as $variable => $_) {
            $val1 = $this->data[$variable][$env1] ?? '';
            $val2 = $this->data[$variable][$env2] ?? '';
            
            if ($val1 !== $val2) {
                $differences[$variable] = [
                    $env1 => $val1,
                    $env2 => $val2,
                ];
            }
        }

        return $differences;
    }

    public function getRawData(): array
    {
        return $this->data;
    }

    public function hasEnvironment(string $environment): bool
    {
        return isset($this->environments[$environment]);
    }

    public function hasVariable(string $variable): bool
    {
        return isset($this->variables[$variable]);
    }
}
