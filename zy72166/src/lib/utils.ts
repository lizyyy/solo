import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function parseJsonField<T>(val: string | null | undefined, fallback: T): T {
  if (!val) return fallback
  try {
    return JSON.parse(val) as T
  } catch {
    return fallback
  }
}
