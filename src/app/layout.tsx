import type { Metadata } from "next";
import "./globals.css";
import { DownloadQueueProvider } from "@/context/DownloadQueueContext";
import HeaderNav from "@/components/HeaderNav";

export const metadata: Metadata = {
  title: "PDF Support — เครื่องมือจัดการ PDF ฟรี",
  description:
    "รวมไฟล์ แยกหน้า หมุน แปลงรูปภาพ และดึงข้อความจาก PDF — ทำงานในเบราว์เซอร์ของคุณทั้งหมด ไฟล์ไม่ถูกอัปโหลด",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th">
      <body className="min-h-screen flex flex-col">
        <DownloadQueueProvider>
          <HeaderNav />

          <div className="flex-1">{children}</div>

          <footer className="border-t border-gray-200 bg-white">
            <div className="max-w-5xl mx-auto px-4 py-4 text-center text-xs text-gray-400">
              🔒 ไฟล์ของคุณไม่ถูกอัปโหลดขึ้นเซิร์ฟเวอร์ — ประมวลผลในเบราว์เซอร์ของคุณทั้งหมด
            </div>
          </footer>
        </DownloadQueueProvider>

        {/* Register custom Service Worker for offline PWA support */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(function(reg) {
                    console.log('ServiceWorker registered:', reg.scope);
                  }).catch(function(err) {
                    console.error('ServiceWorker registration failed:', err);
                  });
                });
              }
            `
          }}
        />
      </body>
    </html>
  );
}
