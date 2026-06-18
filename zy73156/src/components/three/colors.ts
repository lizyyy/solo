import type { ReadingStatus } from "@/data/types";

export const STATUS_COLOR: Record<ReadingStatus, string> = {
  normal: "#34D399",
  warning: "#F59E0B",
  blocked: "#FB7185",
};

export const STATUS_EMISSIVE: Record<ReadingStatus, number> = {
  normal: 1.6,
  warning: 2.2,
  blocked: 2.8,
};
