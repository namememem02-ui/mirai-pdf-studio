import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "PDF Support — เครื่องมือจัดการ PDF ฟรี",
  description:
    "รวมไฟล์ แยกหน้า หมุน แปลงรูปภาพ และดึงข้อความจาก PDF — ทำงานในเบราว์เซอร์ของคุณทั้งหมด ไฟล์ไม่ถูกอัปโหลด",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th">
      <body className="min-h-screen flex flex-col">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 font-bold text-xl text-gray-800">
              <span className="text-2xl">📄</span> PDF Support
            </Link>
            <span className="ml-auto text-xs text-gray-400 hidden sm:block">
              ประมวลผลในเครื่องคุณ 100% — ไฟล์ไม่ถูกอัปโหลด
            </span>
          </div>
        </header>

        <div className="flex-1">{children}</div>

        <footer className="border-t border-gray-200 bg-white">
          <div className="max-w-5xl mx-auto px-4 py-4 text-center text-xs text-gray-400">
            🔒 ไฟล์ของคุณไม่ถูกอัปโหลดขึ้นเซิร์ฟเวอร์ — ประมวลผลในเบราว์เซอร์ของคุณทั้งหมด
          </div>
        </footer>
      </body>
    </html>
  );
}
