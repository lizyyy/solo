export async function sha1Fingerprint(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  const bytes = Array.from(new Uint8Array(hash));
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
}

export function makeSubmissionFingerprint(
  questionNo: string,
  answerContent: string,
  supplementaryNote: string | undefined
): string {
  const raw = `${questionNo}|||${answerContent.trim()}|||${(
    supplementaryNote || ""
  ).trim()}`;
  let h = 2166136261 >>> 0;
  for (let i = 0; i < raw.length; i++) {
    h ^= raw.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}
