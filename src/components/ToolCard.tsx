import Link from 'next/link';
import { ToolInfo } from '@/lib/tools';

export default function ToolCard({ tool }: { tool: ToolInfo }) {
  return (
    <Link
      href={`/${tool.id}`}
      className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition flex flex-col gap-3"
    >
      <span className={`w-12 h-12 rounded-lg ${tool.color} flex items-center justify-center text-2xl`}>
        {tool.icon}
      </span>
      <div>
        <h2 className="font-bold text-gray-800">{tool.name}</h2>
        <p className="text-sm text-gray-500 mt-1 leading-snug">{tool.description}</p>
      </div>
    </Link>
  );
}
