export interface UsageData {
  tools: Record<string, number>;
  total: number;
  updatedAt: number;
}

export const USAGE_CACHE_KEY = 'mirai_pdf_usage_cache';
export const USAGE_UPDATED_EVENT = 'mirai-usage-updated';

/**
 * จัดรูปแบบตัวเลขสถิติให้อ่านง่ายและกะทัดรัด (เช่น 0, 45, 1,250, 15.4k)
 */
export function formatUsageCount(count?: number | null): string {
  if (count === undefined || count === null || Number.isNaN(count) || count < 0) {
    return '0';
  }
  if (count >= 1_000_000) {
    return (count / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (count >= 10_000) {
    return (count / 1_000).toFixed(1).replace(/\.0$/, '') + 'k';
  }
  return Math.floor(count).toLocaleString('th-TH');
}

/**
 * อ่านสถิติที่แคชไว้ใน localStorage อย่างปลอดภัย (รองรับ SSR และโหมดออฟไลน์)
 */
export function getCachedUsage(): UsageData {
  if (typeof window === 'undefined') {
    return { tools: {}, total: 0, updatedAt: 0 };
  }
  try {
    const raw = localStorage.getItem(USAGE_CACHE_KEY);
    if (!raw) return { tools: {}, total: 0, updatedAt: 0 };
    const parsed = JSON.parse(raw);
    return {
      tools: parsed.tools || {},
      total: typeof parsed.total === 'number' ? parsed.total : 0,
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : 0,
    };
  } catch {
    return { tools: {}, total: 0, updatedAt: 0 };
  }
}

/**
 * บันทึกสถิติลงใน localStorage
 */
export function setCachedUsage(data: UsageData): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(USAGE_CACHE_KEY, JSON.stringify(data));
  } catch {
    // Ignore quota or private browsing errors
  }
}

/**
 * ดึงข้อมูลสถิติรวมของทุกคนจากเซิร์ฟเวอร์ พร้อมอัปเดตลงแคช
 */
export async function fetchGlobalUsage(): Promise<UsageData> {
  const cached = getCachedUsage();
  if (typeof window === 'undefined') return cached;

  try {
    const res = await fetch('/api/usage', {
      headers: { credentials: 'omit' },
      cache: 'no-store',
    });
    if (!res.ok) return cached;
    const json = await res.json();

    const tools: Record<string, number> = json.tools || {};
    // ยอดรวมมาจากเซิร์ฟเวอร์ หรือคำนวณผลรวมจากทุกเมนู
    const sumOfTools = Object.values(tools).reduce((a, b) => a + (Number(b) || 0), 0);
    const total = Math.max(typeof json.total === 'number' ? json.total : 0, sumOfTools);

    const freshData: UsageData = {
      tools,
      total,
      updatedAt: Date.now(),
    };
    setCachedUsage(freshData);
    return freshData;
  } catch {
    return cached;
  }
}

/**
 * บันทึกการใช้งานเครื่องมือ 1 ครั้ง (เรียกเมื่อประมวลผลไฟล์สำเร็จ)
 * อัปเดตแคชในเครื่องทันที (Optimistic) และส่งไปอัปเดตที่เซิร์ฟเวอร์ในพื้นหลัง
 */
export function recordToolUsage(toolId: string): void {
  if (typeof window === 'undefined' || !toolId) return;

  // 1. อัปเดตแคชในเครื่องทันที
  const current = getCachedUsage();
  const nextTools = { ...current.tools };
  nextTools[toolId] = (nextTools[toolId] || 0) + 1;
  const nextTotal = (current.total || 0) + 1;

  const nextData: UsageData = {
    tools: nextTools,
    total: nextTotal,
    updatedAt: Date.now(),
  };
  setCachedUsage(nextData);

  // 2. ส่ง Event แจ้งเตือน Component ในหน้าให้รีเฟรชตัวเลขทันที
  try {
    window.dispatchEvent(
      new CustomEvent(USAGE_UPDATED_EVENT, {
        detail: { toolId, data: nextData },
      })
    );
  } catch {
    // Ignore event dispatch failure
  }

  // 3. ยิงอัปเดตไปยัง API ในพื้นหลัง (fire-and-forget)
  try {
    fetch('/api/usage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toolId }),
      keepalive: true,
    }).catch(() => {
      // ทำงานเงียบๆ ไม่รบกวนการดาวน์โหลดไฟล์ของผู้ใช้
    });
  } catch {
    // Non-blocking
  }
}
