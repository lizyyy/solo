import { z } from 'zod';
import { ValidationError } from '../types';
export declare const zoneFileSchema: z.ZodObject<{
    name: z.ZodString;
    records: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        type: z.ZodEffects<z.ZodString, string, string>;
        ttl: z.ZodNumber;
        value: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        value: string;
        type: string;
        ttl: number;
    }, {
        name: string;
        value: string;
        type: string;
        ttl: number;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    name: string;
    records: {
        name: string;
        value: string;
        type: string;
        ttl: number;
    }[];
}, {
    name: string;
    records: {
        name: string;
        value: string;
        type: string;
        ttl: number;
    }[];
}>;
export declare const cliOptionsSchema: z.ZodObject<{
    zoneFile: z.ZodString;
    zoneDir: z.ZodOptional<z.ZodString>;
    outputDir: z.ZodString;
    environments: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    migrationWindow: z.ZodOptional<z.ZodString>;
    ttlConfig: z.ZodOptional<z.ZodString>;
    envConfig: z.ZodOptional<z.ZodString>;
    format: z.ZodDefault<z.ZodArray<z.ZodEnum<["json", "markdown", "terminal"]>, "many">>;
    verbose: z.ZodDefault<z.ZodBoolean>;
    strict: z.ZodDefault<z.ZodBoolean>;
    expandCNAME: z.ZodDefault<z.ZodBoolean>;
    maxChainDepth: z.ZodDefault<z.ZodNumber>;
    minTTLWarn: z.ZodDefault<z.ZodNumber>;
    maxTTLWarn: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    zoneFile: string;
    outputDir: string;
    environments: string[];
    format: ("json" | "markdown" | "terminal")[];
    verbose: boolean;
    strict: boolean;
    expandCNAME: boolean;
    maxChainDepth: number;
    minTTLWarn: number;
    maxTTLWarn: number;
    zoneDir?: string | undefined;
    migrationWindow?: string | undefined;
    ttlConfig?: string | undefined;
    envConfig?: string | undefined;
}, {
    zoneFile: string;
    outputDir: string;
    zoneDir?: string | undefined;
    environments?: string[] | undefined;
    migrationWindow?: string | undefined;
    ttlConfig?: string | undefined;
    envConfig?: string | undefined;
    format?: ("json" | "markdown" | "terminal")[] | undefined;
    verbose?: boolean | undefined;
    strict?: boolean | undefined;
    expandCNAME?: boolean | undefined;
    maxChainDepth?: number | undefined;
    minTTLWarn?: number | undefined;
    maxTTLWarn?: number | undefined;
}>;
export declare function validateTTL(ttl: number): ValidationError | null;
export declare function validateDomainName(name: string): ValidationError | null;
export declare function validateRecordType(type: string): ValidationError | null;
