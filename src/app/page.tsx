import { TOOLS } from '@/lib/tools';
import ToolCard from '@/components/ToolCard';

export default function Home() {
  return (
    <main className="max-w-5xl mx-auto px-4 py-10">
      <div className="text-center mb-10">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-800">
          เครื่องมือจัดการ PDF ครบในที่เดียว
        </h1>
        <p className="text-gray-500 mt-2">
          ฟรี ใช้ง่าย และปลอดภัย — ทุกอย่างประมวลผลในเบราว์เซอร์ของคุณ ไฟล์ไม่ถูกอัปโหลดไปที่ไหน
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {TOOLS.map((tool) => (
          <ToolCard key={tool.id} tool={tool} />
        ))}
      </div>
    </main>
  );
}
