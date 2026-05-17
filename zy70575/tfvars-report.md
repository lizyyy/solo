# Terraform Variable Usage Report

Generated: 2026-05-17 11:33:02

## Summary

| Metric | Value |
|--------|-------|
| Total variables | 8 |
| Used variables | 5 |
| Unused variables | 3 |
| With default value | 8 |
| Without default | 0 |
| Undefined but used | 0 |
| Total issues | 3 |
| Parse errors | 0 |

## Variable issues

| Variable | Issue | Location |
|----------|-------|----------|
| no_default_unused | defined but never used | test-normal/variables.tf:42 |
| unused_var | defined but never used | test-normal/variables.tf:31 |
| no_default_used | defined but never used | test-normal/variables.tf:37 |

## Unused variables

| Variable | File | Line |
|----------|------|------|
| no_default_unused | test-normal/variables.tf | 42 |
| no_default_used | test-normal/variables.tf | 37 |
| unused_var | test-normal/variables.tf | 31 |

## All variables

| Variable | Defined | Used | Has default | Issues |
|----------|---------|------|-------------|--------|
| aws_region | YES | YES | YES | 0 |
| environment | YES | YES | YES | 0 |
| instance_type | YES | YES | YES | 0 |
| no_default_unused | YES | NO | YES | 1 |
| no_default_used | YES | NO | YES | 1 |
| subnet_cidrs | YES | YES | YES | 0 |
| unused_var | YES | NO | YES | 1 |
| vpc_cidr | YES | YES | YES | 0 |
