import { useState } from "react";
import { Clock, MapPin, Snowflake, Pencil, User } from "lucide-react";
import { useWarehouseStore } from "@/store/useWarehouseStore";

function formatDeadline(deadline: number): string {
  const mins = Math.max(0, Math.ceil((deadline - Date.now()) / 60000));
  if (mins < 60) return `${Math.round(mins)}分钟后`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}小时后`;
}

function getDeadlineColor(deadline: number): string {
  const mins = (deadline - Date.now()) / 60000;
  if (mins <= 30) return "text-industrial-red";
  if (mins <= 60) return "text-industrial-amber";
  return "text-industrial-green";
}

export default function OrderManage() {
  const orders = useWarehouseStore((s) => s.orders);
  const locations = useWarehouseStore((s) => s.locations);
  const pickers = useWarehouseStore((s) => s.pickers);
  const updateOrder = useWarehouseStore((s) => s.updateOrder);
  const checkDuplicateLocations = useWarehouseStore((s) => s.checkDuplicateLocations);

  const [activeTab, setActiveTab] = useState<"orders" | "locations">("orders");
  const [editingOrder, setEditingOrder] = useState<string | null>(null);
  const [editNotes, setEditNotes] = useState("");

  const handleSaveNotes = (orderId: string) => {
    updateOrder(orderId, { notes: editNotes });
    setEditingOrder(null);
  };

  const getPickerName = (pickerId: string) => {
    const idx = parseInt(pickerId.split("-")[1]);
    if (isNaN(idx)) return "-";
    return pickers[idx - 1] ?? "-";
  };

  return (
    <div className="flex h-full flex-col gap-6">
      <div className="flex items-center gap-4">
        <div className="flex gap-2 rounded-lg bg-navy-800 p-1">
          <button
            onClick={() => setActiveTab("orders")}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "orders"
                ? "bg-navy-600 text-industrial-orange"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            订单清单
          </button>
          <button
            onClick={() => setActiveTab("locations")}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "locations"
                ? "bg-navy-600 text-industrial-orange"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            库位坐标
          </button>
        </div>
      </div>

      {activeTab === "orders" && (
        <div className="flex flex-1 flex-col gap-4 overflow-auto">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {orders.map((order) => {
              const isDraft = order.status === "draft";

              return (
                <div
                  key={order.id}
                  className={`rounded-xl border border-navy-700/50 bg-navy-800/80 p-5 transition-all hover:border-navy-600 ${
                    isDraft ? "ring-1 ring-industrial-amber/30" : ""
                  }`}
                >
                  <div className="mb-3 flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-mono text-sm font-semibold text-gray-100">
                          {order.orderNo}
                        </h3>
                        {isDraft && (
                          <span className="rounded-full bg-industrial-amber/20 px-2 py-0.5 text-xs font-medium text-industrial-amber">
                            待处理
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                        <User size={12} />
                        <span>{getPickerName(order.pickerId)}</span>
                      </div>
                    </div>
                    <span
                      className={`flex items-center gap-1 text-xs ${getDeadlineColor(
                        order.deadline
                      )}`}
                    >
                      <Clock size={12} />
                      <span>{formatDeadline(order.deadline)}</span>
                    </span>
                  </div>

                  <div className="mb-3 space-y-2">
                    {order.items.map((item) => {
                      const loc = locations.find(
                        (l) => l.id === item.locationId
                      );
                      return (
                        <div
                          key={item.id}
                          className="flex items-center justify-between rounded-md bg-navy-900/50 px-3 py-2"
                        >
                          <div className="flex items-center gap-2">
                            <MapPin size={14} className="text-gray-500" />
                            <span className="font-mono text-xs text-gray-400">
                              {loc?.code ?? "-"}
                            </span>
                            <span className="text-sm text-gray-300">
                              {item.sku}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-gray-500">
                              ×{item.quantity}
                            </span>
                            {item.coldChain && (
                              <Snowflake
                                size={14}
                                className="text-industrial-blue"
                              />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="border-t border-navy-700/50 pt-3">
                    {editingOrder === order.id ? (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={editNotes}
                          onChange={(e) => setEditNotes(e.target.value)}
                          className="flex-1 rounded-md border border-navy-600 bg-navy-900 px-3 py-1.5 text-sm text-gray-200 focus:border-industrial-orange focus:outline-none"
                          placeholder="添加备注..."
                          autoFocus
                        />
                        <button
                          onClick={() => handleSaveNotes(order.id)}
                          className="rounded-md bg-industrial-orange px-3 py-1.5 text-sm font-medium text-white"
                        >
                          保存
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-gray-500">
                          {order.notes || "暂无备注"}
                        </p>
                        <button
                          onClick={() => {
                            setEditingOrder(order.id);
                            setEditNotes(order.notes);
                          }}
                          className="text-gray-500 transition-colors hover:text-industrial-orange"
                        >
                          <Pencil size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === "locations" && (
        <div className="flex flex-1 flex-col overflow-auto">
          <button
            onClick={checkDuplicateLocations}
            className="mb-4 inline-flex w-fit items-center gap-2 rounded-md border border-navy-600 bg-navy-800 px-4 py-2 text-sm text-gray-300 transition-colors hover:bg-navy-700"
          >
            <MapPin size={16} />
            <span>检查重复库位</span>
          </button>

          <div className="overflow-hidden rounded-lg border border-navy-700/50">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-navy-700/50 bg-navy-800">
                <tr>
                  <th className="px-4 py-3 font-medium text-gray-400">
                    库位编号
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-400">
                    X 坐标
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-400">
                    Y 坐标
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-400">
                    状态
                  </th>
                </tr>
              </thead>
              <tbody>
                {locations.map((loc) => (
                  <tr
                    key={loc.id}
                    className={`border-b border-navy-700/30 transition-colors hover:bg-navy-800/50 ${
                      loc.isDuplicate ? "bg-industrial-red/10" : ""
                    }`}
                  >
                    <td className="px-4 py-3 font-mono text-gray-200">
                      {loc.code}
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-400">
                      {loc.x}
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-400">
                      {loc.y}
                    </td>
                    <td className="px-4 py-3">
                      {loc.isDuplicate ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-industrial-red/20 px-2 py-0.5 text-xs font-medium text-industrial-red">
                          重复
                        </span>
                      ) : (
                        <span className="text-xs text-gray-500">正常</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
