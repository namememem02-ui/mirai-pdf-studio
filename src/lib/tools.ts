// ทะเบียนเครื่องมือทั้งหมด — เพิ่มเมนูใหม่: เพิ่ม 1 รายการที่นี่ + สร้างโฟลเดอร์หน้าใหม่ใน src/app/<id>/page.tsx
export interface ToolInfo {
  id: string;        // = ชื่อโฟลเดอร์ route
  name: string;
  description: string;
  icon: string;
  color: string;     // tailwind bg class ของไอคอน
}

export const TOOLS: ToolInfo[] = [
  {
    id: 'organize',
    name: 'จัดระเบียบหน้า PDF',
    description: 'จัดหน้า โยกย้าย หมุน ลบ แทรกหน้าว่าง หรือแทรกไฟล์ PDF/รูปภาพ แบบ PDFgear',
    icon: '📋',
    color: 'bg-indigo-100',
  },
  {
    id: 'edit-text',
    name: 'แก้ไขข้อความ PDF',
    description: 'พิมพ์เขียนข้อความ แทรกกล่องข้อความทับลงบนหน้ากระดาษ PDF (Form Filler)',
    icon: '✍️',
    color: 'bg-blue-100',
  },
  {
    id: 'merge',
    name: 'รวม PDF',
    description: 'รวม PDF หลายไฟล์เป็นไฟล์เดียว จัดลำดับได้ตามต้องการ',
    icon: '🗂️',
    color: 'bg-red-100',
  },
  {
    id: 'split',
    name: 'แยกหน้า PDF',
    description: 'เลือกเฉพาะหน้าที่ต้องการ เช่น 1-3,5 ออกมาเป็นไฟล์ใหม่',
    icon: '✂️',
    color: 'bg-orange-100',
  },
  {
    id: 'rotate',
    name: 'หมุนหน้า PDF',
    description: 'หมุนทุกหน้าหรือเฉพาะบางหน้า 90 / 180 / 270 องศา',
    icon: '🔄',
    color: 'bg-amber-100',
  },
  {
    id: 'image-to-pdf',
    name: 'รูปภาพ → PDF',
    description: 'แปลงรูป JPG / PNG หลายรูปเป็น PDF ไฟล์เดียว',
    icon: '🖼️',
    color: 'bg-emerald-100',
  },
  {
    id: 'pdf-to-image',
    name: 'PDF → รูปภาพ',
    description: 'แปลงทุกหน้าเป็นรูป PNG ดาวน์โหลดทีละหน้าหรือ ZIP ทั้งหมด',
    icon: '📸',
    color: 'bg-sky-100',
  },
  {
    id: 'extract-text',
    name: 'ดึงข้อความจาก PDF',
    description: 'คัดลอกข้อความทั้งหมดในเอกสาร หรือบันทึกเป็นไฟล์ .txt',
    icon: '📝',
    color: 'bg-violet-100',
  },
];
