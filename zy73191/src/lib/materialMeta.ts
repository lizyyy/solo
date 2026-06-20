import type { MaterialType } from "@/lib/types";

export const typeMeta: Record<
  MaterialType,
  { char: string; chip: string; bar: string }
> = {
  历史答案: {
    char: "历",
    chip: "border-indigoInk/30 bg-indigoInk/10 text-indigoInk",
    bar: "bg-indigoInk",
  },
  后补备注: {
    char: "补",
    chip: "border-moss/30 bg-moss/10 text-moss",
    bar: "bg-moss",
  },
  口头备注: {
    char: "口",
    chip: "border-amberInk/30 bg-amberInk/10 text-amberInk",
    bar: "bg-amberInk",
  },
};
