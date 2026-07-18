import type { Metadata } from "next";
import "./globals.css";
import { DownloadQueueProvider } from "@/context/DownloadQueueContext";
import HeaderNav from "@/components/HeaderNav";

export const metadata: Metadata = {
  title: "Mee-a-rai PDF Studio — เครื่องมือจัดการเอกสาร PDF ความปลอดภัยสูง",
  description:
    "เขียนและลบข้อความ เซ็นลายเซ็น บีบอัด ใส่รหัสผ่าน และจัดการหน้า PDF ในเครื่อง 100% ปลอดภัย ไม่ผ่านคลาวด์ ออฟไลน์สมบูรณ์แบบ",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th">
      <body className="min-h-screen flex flex-col bg-gray-50">
        <DownloadQueueProvider>
          <HeaderNav />

          <div className="flex-1">{children}</div>

          <footer className="border-t border-gray-200 bg-white">
            <div className="max-w-5xl mx-auto px-4 py-4 text-center text-xs text-gray-400 font-semibold">
              🔒 Mee-a-rai PDF Studio — ข้อมูลของคุณปลอดภัย ประมวลผลและเข้ารหัสในเครื่องคุณ 100% โดยไม่ผ่านคลาวด์เซิร์ฟเวอร์
            </div>
          </footer>
        </DownloadQueueProvider>

        {/* Register/Unregister Service Worker for offline PWA support */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                  // Actively unregister local worker to flush buggy dev caches
                  navigator.serviceWorker.getRegistrations().then(function(regs) {
                    for (var i = 0; i < regs.length; i++) {
                      regs[i].unregister().then(function(ok) {
                        if (ok) console.log('Cleaned up local dev service worker.');
                      });
                    }
                  });
                } else {
                  // Register standard worker in production
                  window.addEventListener('load', function() {
                    navigator.serviceWorker.register('/sw.js').then(function(reg) {
                      console.log('ServiceWorker registered:', reg.scope);
                    }).catch(function(err) {
                      console.error('ServiceWorker registration failed:', err);
                    });
                  });
                }
              }
            `
          }}
        />
      </body>
    </html>
  );
}
