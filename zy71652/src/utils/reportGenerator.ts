import type {
  Route,
  Order,
  Location,
  PathException,
  RouteStop,
} from "@/types";

export function generateJSONReport(
  route: Route,
  orders: Order[],
  locations: Location[],
  exceptions: PathException[]
): string {
  const locMap = new Map(locations.map((l) => [l.id, l]));
  const itemMap = new Map<string, Order["items"][0]>();
  for (const o of orders) {
    for (const i of o.items) {
      itemMap.set(i.id, i);
    }
  }

  const orderMap = new Map(orders.map((o) => [o.id, o]));

  const report = {
    reportGeneratedAt: new Date().toISOString(),
    route: {
      id: route.id,
      name: route.name,
      status: route.status,
      pickerId: route.pickerId,
      totalDistance: route.totalDistance,
      estimatedMinutes: route.estimatedMinutes,
      notes: route.notes,
      createdAt: new Date(route.createdAt).toISOString(),
      updatedAt: new Date(route.updatedAt).toISOString(),
    },
    stops: route.stops
      .sort((a, b) => a.sequence - b.sequence)
      .map((stop) => {
        const loc = locMap.get(stop.locationId);
        const item = itemMap.get(stop.orderItemId);
        const order = item ? orderMap.get(item.orderId) : null;
        return {
          sequence: stop.sequence,
          locationCode: loc?.code ?? "",
          x: loc?.x ?? 0,
          y: loc?.y ?? 0,
          orderNo: order?.orderNo ?? "",
          sku: item?.sku ?? "",
          quantity: item?.quantity ?? 0,
          coldChain: item?.coldChain ?? false,
          coldChainMaxMin: item?.coldChainMaxMin ?? 0,
          coldChainStatus: stop.coldChainStatus,
          isInsertion: stop.isInsertion,
          orderNotes: order?.notes ?? "",
        };
      }),
    exceptions: exceptions.map((e) => ({
      type: e.type,
      message: e.message,
      detail: e.detail,
      resolved: e.resolved,
    })),
    notes: route.notes,
  };

  return JSON.stringify(report, null, 2);
}

export function generateCSVReport(
  route: Route,
  orders: Order[],
  locations: Location[],
  exceptions: PathException[]
): string {
  const locMap = new Map(locations.map((l) => [l.id, l]));
  const itemMap = new Map<string, Order["items"][0]>();
  for (const o of orders) {
    for (const i of o.items) {
      itemMap.set(i.id, i);
    }
  }
  const orderMap = new Map(orders.map((o) => [o.id, o]));

  const headers = [
    "序号",
    "库位编号",
    "X坐标",
    "Y坐标",
    "订单号",
    "SKU",
    "数量",
    "冷链",
    "冷链时限(分)",
    "冷链状态",
    "是否插单",
    "备注",
  ];

  const lines = [headers.join(",")];

  for (const stop of route.stops.sort((a, b) => a.sequence - b.sequence)) {
    const loc = locMap.get(stop.locationId);
    const item = itemMap.get(stop.orderItemId);
    const order = item ? orderMap.get(item.orderId) : null;
    lines.push(
      [
        stop.sequence,
        loc?.code ?? "",
        loc?.x ?? 0,
        loc?.y ?? 0,
        order?.orderNo ?? "",
        item?.sku ?? "",
        item?.quantity ?? 0,
        item?.coldChain ? "是" : "否",
        item?.coldChainMaxMin ?? 0,
        stop.coldChainStatus,
        stop.isInsertion ? "是" : "否",
        `"${(order?.notes ?? "").replace(/"/g, '""')}"`,
      ].join(",")
    );
  }

  lines.push("");
  lines.push(["异常类型", "异常信息", "是否已解决"].join(","));
  for (const e of exceptions) {
    lines.push(
      [e.type, `"${e.message.replace(/"/g, '""')}"`, e.resolved ? "是" : "否"].join(",")
    );
  }

  if (route.notes) {
    lines.push("");
    lines.push(`"路线备注: ${route.notes.replace(/"/g, '""')}"`);
  }

  return lines.join("\n");
}

export function downloadFile(
  content: string,
  filename: string,
  mimeType: string
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
