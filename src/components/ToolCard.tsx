import Link from 'next/link';
import { ToolInfo } from '@/lib/tools';
import { formatUsageCount } from '@/lib/usage';

export default function ToolCard({
  tool,
  usageCount = 0,
}: {
  tool: ToolInfo;
  usageCount?: number;
}) {
  return (
    <Link
      href={`/${tool.id}`}
      className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition flex flex-col gap-3 group relative"
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={`w-12 h-12 rounded-lg ${tool.color} flex items-center justify-center text-2xl shrink-0 group-hover:scale-105 transition-transform`}
        >
          {tool.icon}
        </span>
        <span
          title={`ใช้งานแล้วสะสม ${usageCount.toLocaleString('th-TH')} ครั้ง`}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-semibold tracking-tight border border-slate-200/60 shrink-0"
        >
          <span className="text-[10px] text-amber-500" aria-hidden="true">
            ⚡
          </span>
          <span className="tabular-nums">{formatUsageCount(usageCount)}</span>
          <span className="text-[10px] text-slate-400 font-normal">ครั้ง</span>
        </span>
      </div>
      <div>
        <h2 className="font-bold text-gray-800 group-hover:text-cyan-700 transition-colors">
          {tool.name}
        </h2>
        <p className="text-sm text-gray-500 mt-1 leading-snug">{tool.description}</p>
      </div>
    </Link>
  );
}
