import type { FireZone } from "@/types";

export const FIRE_ZONES: FireZone[] = [
  {
    id: "F1",
    name: "F1 · 3层东侧防火分区",
    color: "#4361ee",
    position: [0, 0, 0],
    size: [10, 3, 8],
    floor: 3,
  },
  {
    id: "F2",
    name: "F2 · 3层西侧防火分区",
    color: "#3a0ca3",
    position: [10.4, 0, 0],
    size: [10, 3, 8],
    floor: 3,
  },
  {
    id: "F3",
    name: "F3 · 2层东侧防火分区",
    color: "#4cc9f0",
    position: [0, -3.4, 0],
    size: [10, 3, 8],
    floor: 2,
  },
  {
    id: "F4",
    name: "F4 · B1层设备防火分区",
    color: "#7209b7",
    position: [10.4, -6.8, 0],
    size: [10, 3, 8],
    floor: -1,
  },
  {
    id: "F5",
    name: "F5 · 1层大堂防火分区",
    color: "#560bad",
    position: [0, -6.8, 0],
    size: [10, 3, 8],
    floor: 1,
  },
];

export const ZONE_IDS = FIRE_ZONES.map((z) => z.id);
export const ZONE_NAME_MAP: Record<string, string> = FIRE_ZONES.reduce(
  (acc, z) => ({ ...acc, [z.id]: z.name }),
  {},
);
export const ZONE_POS_MAP: Record<string, [number, number, number]> = FIRE_ZONES.reduce(
  (acc, z) => ({ ...acc, [z.id]: z.position }),
  {},
);
export const ZONE_SIZE_MAP: Record<string, [number, number, number]> = FIRE_ZONES.reduce(
  (acc, z) => ({ ...acc, [z.id]: z.size }),
  {},
);
