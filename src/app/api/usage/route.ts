import { NextRequest, NextResponse } from 'next/server';
import { TOOLS } from '@/lib/tools';

const NAMESPACE = 'mirai-pdf-studio';
const ABACUS_BASE = 'https://abacus.jasoncameron.dev';

// In-memory cache บนเซิร์ฟเวอร์ ลดภาระการยิง Abacus ซ้ำซ้อน
interface CacheState {
  data: {
    tools: Record<string, number>;
    total: number;
  };
  expiresAt: number;
}

let serverCache: CacheState | null = null;
const CACHE_TTL_MS = 25 * 1000; // 25 วินาที

async function fetchAbacusValue(key: string): Promise<number> {
  try {
    const res = await fetch(`${ABACUS_BASE}/get/${NAMESPACE}/${key}`, {
      signal: AbortSignal.timeout(3000),
      cache: 'no-store',
    });
    if (!res.ok) return 0;
    const json = await res.json();
    return typeof json.value === 'number' ? json.value : 0;
  } catch {
    return 0;
  }
}

async function hitAbacusValue(key: string): Promise<number> {
  try {
    const res = await fetch(`${ABACUS_BASE}/hit/${NAMESPACE}/${key}`, {
      signal: AbortSignal.timeout(4000),
      cache: 'no-store',
    });
    if (!res.ok) return 0;
    const json = await res.json();
    return typeof json.value === 'number' ? json.value : 0;
  } catch {
    return 0;
  }
}

export async function GET() {
  const now = Date.now();
  if (serverCache && serverCache.expiresAt > now) {
    return NextResponse.json(serverCache.data, {
      headers: {
        'Cache-Control': 'public, s-maxage=25, stale-while-revalidate=60',
      },
    });
  }

  const toolIds = TOOLS.map((t) => t.id);

  // ดึงค่าของทั้ง 16 เครื่องมือ + _total พร้อมกันแบบขนาน
  const [totalVal, ...toolVals] = await Promise.all([
    fetchAbacusValue('_total'),
    ...toolIds.map((id) => fetchAbacusValue(id)),
  ]);

  const tools: Record<string, number> = {};
  toolIds.forEach((id, index) => {
    tools[id] = toolVals[index] || 0;
  });

  const sum = Object.values(tools).reduce((a, b) => a + b, 0);
  const total = Math.max(totalVal, sum);

  serverCache = {
    data: { tools, total },
    expiresAt: now + CACHE_TTL_MS,
  };

  return NextResponse.json(
    { tools, total },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=25, stale-while-revalidate=60',
      },
    }
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const toolId = typeof body?.toolId === 'string' ? body.toolId.trim() : '';

    const validTools = TOOLS.map((t) => t.id);
    if (!validTools.includes(toolId)) {
      return NextResponse.json(
        { error: 'Invalid tool id' },
        { status: 400 }
      );
    }

    // อัปเดตทั้งตัวนับของเครื่องมือนั้น และยอดรวม _total
    const [toolCount, totalCount] = await Promise.all([
      hitAbacusValue(toolId),
      hitAbacusValue('_total'),
    ]);

    // อัปเดต serverCache ทันที
    if (serverCache) {
      serverCache.data.tools[toolId] = toolCount;
      serverCache.data.total = Math.max(
        totalCount,
        Object.values(serverCache.data.tools).reduce((a, b) => a + b, 0)
      );
    }

    return NextResponse.json({
      success: true,
      toolId,
      toolCount,
      totalCount,
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}
