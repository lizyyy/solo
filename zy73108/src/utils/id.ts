export const uid = (prefix = ""): string => {
  const rand = Math.random().toString(36).slice(2, 8);
  const time = Date.now().toString(36);
  return `${prefix}${time}${rand}`;
};

export const generateBatchNo = (): string => {
  const d = new Date();
  const pad = (n: number, w = 2) => n.toString().padStart(w, "0");
  const ymd = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  const hm = `${pad(d.getHours())}${pad(d.getMinutes())}`;
  const r = Math.floor(Math.random() * 900 + 100);
  return `B${ymd}${hm}${r}`;
};

export const computeRecordKey = (
  materialNo: string,
  title: string
): string => {
  const head = (title || "").slice(0, 20).replace(/\s+/g, "");
  let hash = 0;
  const src = `${materialNo}__${head}`;
  for (let i = 0; i < src.length; i++) {
    hash = (hash << 5) - hash + src.charCodeAt(i);
    hash |= 0;
  }
  return `RK_${materialNo}_${Math.abs(hash).toString(36)}`;
};
