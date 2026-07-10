# 📄 Mirai PDF Studio — Architecture & Technical Blueprint

เอกสารฉบับนี้เป็นคู่มือสรุปสถาปัตยกรรม เทคนิค และสูตรการเขียนโค้ด (Technical Recipes) ทั้งหมดของโครงการ **Mirai PDF Studio** หากคุณต้องการสร้างโครงการใหม่หรือย้ายโค้ดไปรันที่อื่น คุณสามารถคัดลอกไฟล์นี้ไปใช้อ้างอิงเพื่อสร้างระบบเครื่องมือจัดการ PDF บนเบราว์เซอร์ (Client-side) ที่ทำงานได้แบบออฟไลน์ 100% ได้ทันที

---

## 1. แนวคิดหลักของระบบ (Core Architecture Concept)

โปรเจกต์นี้ได้รับการออกแบบภายใต้แนวคิด **"Client-Side First & Zero Server-Overhead"**
* **ความปลอดภัยและความเป็นส่วนตัวสูงสุด**: เอกสาร PDF ทุกไฟล์จะถูกอ่าน ถอดรหัส วาดภาพ ปรับแต่ง บีบอัด หรือเข้ารหัส **ภายในหน่วยความจำเบราว์เซอร์ของผู้ใช้เท่านั้น** ไฟล์จะไม่ถูกอัปโหลดขึ้นเซิร์ฟเวอร์ใด ๆ
* **ประหยัดค่าเซิร์ฟเวอร์เป็นศูนย์ (0$)**: ไม่ต้องใช้คลาวด์แรงสูงหรือ API แปลงไฟล์ในการประมวลผล ทุกอย่างรันผ่านกำลังประมวลผลของเครื่องผู้ใช้งาน (CPU/GPU)
* **ทำงานแบบออฟไลน์ 100% (Offline PWA)**: แคชไฟล์ฟอนต์ไทย, Character Maps, ไฟล์ระบบสแกนภาพ (OCR) และสคริปต์หน้าเว็บทั้งหมดลงเครื่องของผู้ใช้ทันทีที่เปิดเว็บครั้งแรก ทำให้สามารถใช้งานแอปได้แม้อยู่บนเครื่องบินหรือไม่มีสัญญาณอินเทอร์เน็ต

---

## 2. โครงสร้างโฟลเดอร์โครงการ (Directory Structure)

เมื่อคุณวางไฟล์เหล่านี้ในโปรเจกต์ Next.js (App Router) โครงสร้างไฟล์จะถูกแบ่งตามหน้าที่การทำงานดังนี้:

```text
├── public/                       # ไฟล์ Static ที่เข้าถึงได้โดยตรงจาก URL (ไม่ผ่านการแปลงบิลด์)
│   ├── cmaps/                    # Character Maps ของ PDF.js (ทำให้พรีวิวฟอนต์ CID ภาษาแปลกๆ ได้ออฟไลน์)
│   ├── fonts/                    # ฟอนต์ Sarabun.ttf (สำหรับใช้เขียนข้อความภาษาไทยลงบน PDF)
│   ├── icons/                    # ไอคอนโลโก้สำหรับ PWA Launcher
│   ├── tesseract/                # โมเดลภาษาไทย/อังกฤษ และ Engine รันภาษาสำหรับสแกนภาพออฟไลน์ (OCR)
│   ├── manifest.json             # ข้อมูลติดตั้งแอป PWA (ชื่อแอป, ไอคอน, สีธีม)
│   └── sw.js                     # Service Worker จัดการแคชแบบออฟไลน์ (มีระบบ HMR Bypass ในตัว)
│
├── src/
│   ├── app/                      # โฟลเดอร์หน้าหลักและเส้นทางของ URL (Next.js App Router)
│   │   ├── layout.tsx            # โครงสร้าง Layout หลัก + ระบบลงทะเบียน/ยกเลิก Service Worker
│   │   ├── page.tsx              # หน้าแรก Dashboard (ค้นหาเครื่องมือ + บอร์ดชูจุดขาย USP)
│   │   ├── add-text/             # [เครื่องมือ] เขียนข้อความ & ยางลบลบคำ (Typewriter & Eraser Workspace)
│   │   ├── compress/             # [เครื่องมือ] บีบอัด PDF (Image re-compression / Deflate / Rasterize)
│   │   ├── downloads/            # หน้าประวัติการดาวน์โหลดเอกสารย้อนหลัง
│   │   ├── excel-to-pdf/         # [เครื่องมือ] แปลง Excel เป็น PDF (SheetJS / jsPDF / AutoTable)
│   │   ├── extract-text/         # [เครื่องมือ] สกัดตัวอักษร / สแกนรูปถ่ายเป็นตัวหนังสือ (Digital & OCR)
│   │   ├── merge/                # [เครื่องมือ] รวมไฟล์ PDF หลายไฟล์เข้าด้วยกัน
│   │   ├── organize/             # [เครื่องมือ] สลับหน้ากระดาษ (Drag & Drop) + แว่นขยายดูหน้าเต็ม
│   │   ├── page-number/          # [เครื่องมือ] แสตมป์ใส่เลขหน้า (รองรับรูปแบบอักษรไทย เช่น "หน้า X จาก Y")
│   │   ├── protect/              # [เครื่องมือ] ตั้งรหัสผ่านล็อกเปิดไฟล์ และควบคุมสิทธิ์ป้องกันการพิมพ์/ก๊อปปี้
│   │   ├── signature/            # [เครื่องมือ] เซ็นชื่อบน PDF (วาดลายเซ็นสด หรืออัปโหลดไฟล์ลายเซ็น)
│   │   ├── split/                # [เครื่องมือ] แยกหน้ากระดาษ PDF ออกเป็นไฟล์ย่อย
│   │   └── watermark/            # [เครื่องมือ] แสตมป์ใส่ลายน้ำตัวอักษรไทย/อังกฤษ ปรับองศาเอียงได้
│   │
│   ├── components/               # คอมโพเนนต์ UI พื้นฐานที่ใช้ซ้ำในหลายๆ หน้า
│   │   ├── ActionButton.tsx      # ปุ่มรันคำสั่งรองรับสเตทโหลด (Busy/Spin)
│   │   ├── FileDropzone.tsx      # กล่องอัปโหลดแบบลากวางไฟล์
│   │   ├── PageHeader.tsx        # ส่วนหัวของหน้าเครื่องมือแต่ละหน้า
│   │   └── PDFPreviewModal.tsx   # ป๊อปอัปพรีวิวไฟล์ผลลัพธ์แบบทีละหน้า (ก่อนกดดาวน์โหลด)
│   │
│   ├── context/
│   │   └── DownloadQueueContext.tsx # Context จัดการคิวไฟล์ที่ทำงานเสร็จแล้ว เพื่อกันดาวน์โหลดออโต้
│   │
│   └── lib/
│       ├── pdf.ts                # ยูทิลิตี้หลักในการเรียกใช้ PDF.js, ดึง cMaps, โหลดฟอนต์ไทย Sarabun
│       └── tools.ts              # ทะเบียนรายชื่อและคุณสมบัติของไอคอนเครื่องมือทั้งหมด
```

---

## 3. ไลบรารีหลักที่ต้องติดตั้ง (Core Dependencies)

เมื่อเริ่มโปรเจกต์ใหม่ ให้รันคำสั่งติดตั้งไลบรารีเหล่านี้:

```bash
# 1. จัดการเขียนเนื้อหา แปลงไฟล์ และแก้ไข PDF
npm install pdf-lib @pdf-lib/fontkit

# 2. ถอดรหัสไฟล์และทำหน้าพรีวิวแสดงหน้ากระดาษ PDF
npm install pdfjs-dist

# 3. ถอดข้อความภาษาไทย/อังกฤษจากภาพสแกนเอกสาร (OCR)
npm install tesseract.js

# 4. เข้ารหัสไฟล์ ตั้งรหัสผ่าน และควบคุมสิทธิ์ในเบราว์เซอร์
npm install @pdfsmaller/pdf-encrypt

# 5. แปลงเอกสาร Excel เป็น PDF
npm install xlsx jspdf jspdf-autotable
```

---

## 4. สูตรโค้ดและเทคนิคสำคัญ (Technical Recipes & Blueprints)

### 📌 สูตรที่ 1: การโหลดและฝังฟอนต์ไทยลง PDF (pdf-lib & fontkit)
เมื่อต้องการเขียนอักษรไทยลงบนเอกสาร ปัญหาหลักคือฟอนต์มาตรฐานของ PDF (`Helvetica`) ไม่รองรับภาษาไทย ทำให้โปรแกรมแครชด้วยข้อผิดพลาด `WinAnsi cannot encode` เราต้องฝังฟอนต์ไทยเข้าไปเองทุกครั้ง:

```typescript
import { PDFDocument } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

async function embedThaiFont(pdfDoc: PDFDocument) {
  // 1. ลงทะเบียนตัวช่วยจัดการตารางฟอนต์ (Fontkit)
  pdfDoc.registerFontkit(fontkit);

  // 2. โหลดไบนารีฟอนต์ไทยจากโฟลเดอร์ public
  const fontUrl = '/fonts/Sarabun-Regular.ttf';
  const fontBytes = await fetch(fontUrl).then((res) => res.arrayBuffer());

  // 3. ฝังฟอนต์เข้าไปในไฟล์เอกสาร PDF
  const thaiFont = await pdfDoc.embedFont(fontBytes);
  return thaiFont;
}
```

### 📌 สูตรที่ 2: ป้องกันปัญหาหน่วยความจำซ้อนทับ (Detached ArrayBuffer)
ในการเลือกใช้ PDF.js เพื่อเรนเดอร์หลายๆ หน้าพร้อมกัน เบราว์เซอร์จะทำการตัดขาดหน่วยความจำ (`ArrayBuffer.slice`) ทำให้อาร์เรย์บัฟเฟอร์ต้นทางกลายเป็นศูนย์และหน้าเว็บแครช 
**วิธีป้องกัน**: ให้โคลนบัฟเฟอร์ก่อนส่งค่าเข้าตัวแปลงไฟล์ทุกครั้ง

```typescript
// ทำการ slice(0) เพื่อสร้างหน่วยความจำโคลนขึ้นมาใหม่เสมอ
const docBytes = originalArrayBuffer.slice(0);

const pdfjs = await getPdfjs();
const doc = await pdfjs.getDocument({
  data: docBytes, // บัฟเฟอร์โคลน
  cMapUrl: '/cmaps/',
  cMapPacked: true,
}).promise;
```

### 📌 สูตรที่ 3: สแกนถอดข้อความแบบออฟไลน์ 100% (Offline Tesseract OCR)
ในการแปลงภาพเอกสารเป็นข้อความดิจิทัล เราต้องตั้งค่าให้ Tesseract.js โหลดไฟล์ประมวลผลและไฟล์โมเดลภาษาไทยจากคลังไฟล์ในเครื่อง (`/tesseract/`) เพื่อตัดขาดการเชื่อมต่อภายนอก:

```typescript
import { createWorker } from 'tesseract.js';

async function initializeOfflineOCR() {
  const worker = await createWorker('tha+eng', 1, {
    workerPath: '/tesseract/worker.min.js',       // ไฟล์ประมวลผลหลัก
    langPath: '/tesseract',                       // โฟลเดอร์เก็บ [lang].traineddata.gz
    corePath: '/tesseract/tesseract-core.js'      // โมดูล WebAssembly Core
  });
  return worker;
}
```

### 📌 สูตรที่ 4: บีบอัดรูปภาพใน PDF โดยไม่ทำลายตัวหนังสือดิจิทัล
หากบีบอัด PDF โดยใช้วิธีแปลงทั้งหน้าเป็นภาพ (Rasterization) ลิงก์และตัวหนังสือที่ก๊อปปี้ได้จะหายไป 
**แนวทางแก้ไข**: กวาดหา Indirect Objects ในโครงสร้าง PDF ที่เป็นประเภทรูปภาพ แล้วทำการบีบอัดค่าของ Object นั้นโดยตรง:

```typescript
import { PDFDocument, PDFRawStream } from 'pdf-lib';

async function compressPdfImages(pdfBytes: Uint8Array, quality: number) {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const context = pdfDoc.context;
  const indirectObjects = context.indirectObjects;

  for (const [ref, obj] of indirectObjects) {
    if (obj instanceof PDFRawStream) {
      const dict = obj.dict;
      const subtype = dict.get(PDFName.of('Subtype'));
      
      // กรองหาเฉพาะออบเจกต์รูปภาพ
      if (subtype === PDFName.of('Image')) {
        // ดึงพิกเซลข้อมูล -> วาดลง HTML Canvas -> เซฟใหม่เป็น JPEG แบบบีบอัดคุณภาพ
        // นำบัฟเฟอร์รูปภาพที่ย่อแล้วมาประกอบใหม่เป็น Stream
        const compressedStream = PDFRawStream.of(dict, newUint8ArrayData);
        
        // เขียนทับค่าอ้างอิงเดิมของรูปภาพตัวเก่าใน Context แผนที่โครงสร้าง PDF
        context.assign(ref, compressedStream);
      }
    }
  }
  return await pdfDoc.save();
}
```

### 📌 สูตรที่ 5: ตั้งรหัสผ่านและควบคุมสิทธิ์การเขียน/พิมพ์ (PDF Protector)
ใช้ `@pdfsmaller/pdf-encrypt` เพื่อทำงานร่วมกับ `pdf-lib` ในการตั้งรหัสผ่านล็อกเอกสารและสิทธิ์การเข้าถึงด้วย AES-256 บิต:

```typescript
import { encryptPDF } from '@pdfsmaller/pdf-encrypt';

async function protectDocument(originalBytes: Uint8Array, openPassword: string, adminPassword: string) {
  const options = {
    ownerPassword: adminPassword, // รหัสผ่านผู้ดูแล
    algorithm: 'AES-256',        // รูปแบบเทคโนโลยีเข้ารหัส (หรือ 'RC4')
    allowPrinting: false,        // จำกัดสิทธิ์ ห้ามสั่งพิมพ์เอกสารออกกระดาษ
    allowCopying: false,         // จำกัดสิทธิ์ ห้ามก๊อปปี้คัดลอกข้อความ
    allowModifying: false,       // จำกัดสิทธิ์ ห้ามแยก/เพิ่ม/หมุนหน้ากระดาษ
    allowAnnotating: true,       // อนุญาตให้เขียนคำอธิบายเพิ่มเติม
  };

  const encryptedBytes = await encryptPDF(
    originalBytes, 
    openPassword, // รหัสผ่านเพื่อใช้เปิดดูไฟล์
    options
  );
  return encryptedBytes;
}
```

### 📌 สูตรที่ 6: ออกแบบ Service Worker ป้องกันหน้าเว็บค้างขณะทดสอบโค้ด
การทำเว็บ PWA บน Next.js มักมีปัญหาระบบเขียนโค้ดหน้าจอร้อน (Hot Module Replacement - HMR) ค้างเนื่องจาก Service Worker ไปเก็บแคชพอร์ตพัฒนา 
**วิธีป้องกัน**: เพิ่มสคริปต์สลับเปิดปิดและบายพาส `localhost` / `127.0.0.1`

* **ในไฟล์ `sw.js` (Bypass URL)**:
  ```javascript
  self.addEventListener('fetch', (event) => {
    const url = event.request.url;
    // ปล่อยผ่าน HMR, SSE และ WebSocket เสมอ ห้ามเข้ามาแคชเด็ดขาด
    if (
      event.request.method !== 'GET' ||
      url.includes('_next/webpack-hmr') ||
      url.includes('webpack-hot-update') ||
      url.includes('ws://') ||
      url.includes('wss://')
    ) {
      return;
    }
    // ... ดำเนินการแคชปกติ ...
  });
  ```
* **ในไฟล์ `layout.tsx` (ตรวจจับ localhost แล้วถอนการติดตั้งตัวแคชทิ้งทันที)**:
  ```javascript
  if ('serviceWorker' in navigator) {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      // ตรวจพบการทำสอบเครื่องโลคอล: ล้างทะเบียน Service Worker เก่าทิ้งทั้งหมด เพื่อไม่ให้ขวาง Hot Reload
      navigator.serviceWorker.getRegistrations().then(function(regs) {
        for (var i = 0; i < regs.length; i++) {
          regs[i].unregister().then(function(ok) {
            if (ok) console.log('Flushed local dev service worker cache.');
          });
        }
      });
    } else {
      // ลงทะเบียนใช้งานบนคลาวด์โปรดักชันปกติ
      window.addEventListener('load', function() {
        navigator.serviceWorker.register('/sw.js');
      });
    }
  }
  ```

### 📌 สูตรที่ 7: แปลง Excel เป็น PDF ตารางเวกเตอร์ คมชัด เลือกข้อความได้ และรองรับภาษาไทย 100%
การใช้ SheetJS ร่วมกับ jsPDF และ jspdf-autotable เพื่อแปลงข้อมูลใน Excel เป็นตารางเวกเตอร์ใน PDF โดยมีขั้นตอนการฝังฟอนต์ Sarabun เพื่อให้แสดงผลตัวอักษรภาษาไทยได้ถูกต้อง:

```typescript
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

async function convertExcelToPdf(file: File, sheetName: string) {
  // 1. อ่านข้อมูลชีต Excel ออกมาเป็นโครงสร้าง 2D Array
  const dataBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(dataBuffer);
  const worksheet = workbook.Sheets[sheetName];
  const rawData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

  // 2. โหลดไบนารีฟอนต์ไทย Sarabun-Regular แปลงเป็น base64
  const fontBytes = await fetch('/fonts/Sarabun-Regular.ttf').then(res => res.arrayBuffer());
  const fontBase64 = arrayBufferToBase64(fontBytes); // ฟังก์ชันแปลง ArrayBuffer เป็น Base64

  // 3. เริ่มสร้างไฟล์ PDF และลงทะเบียนฟอนต์ไทย
  const doc = new jsPDF({ orientation: 'l', format: 'a4' }); // แนะนำ แนวนอน (Landscape)
  doc.addFileToVFS('Sarabun-Regular.ttf', fontBase64);
  doc.addFont('Sarabun-Regular.ttf', 'Sarabun', 'normal');
  doc.setFont('Sarabun');

  const headers = rawData[0].map(h => String(h || ''));
  const body = rawData.slice(1).map(row => row.map(cell => String(cell || '')));

  // 4. วาดตารางเวกเตอร์ผ่าน autoTable
  autoTable(doc, {
    head: [headers],
    body: body,
    styles: { font: 'Sarabun', fontSize: 8 },
    headStyles: { font: 'Sarabun', fillColor: [15, 23, 42] }
  });

  // 5. บันทึกไฟล์ผลลัพธ์
  doc.save('excel_to_pdf.pdf');
}
```

---

## 5. มาตรฐานการพรีวิวและการดาวน์โหลด (Download Queue standard)

เพื่อประสบการณ์การใช้งานที่พรีเมียม (Premium UX) ห้ามสั่งเซฟไฟล์แบบดาวน์โหลดอัตโนมัติทันทีที่กดสร้างไฟล์ ให้แสดงแผงความสำเร็จพร้อมสองตัวเลือกนี้เสมอ:

1. **👁️ พรีวิวไฟล์ผลลัพธ์ (Preview Modal)**:
   * เรนเดอร์หน้ากระดาษที่เสร็จแล้วผ่านคอมโพเนนต์ `PDFPreviewModal` เพื่อให้ผู้ใช้ตรวจทานข้อความ ลายน้ำ ลายเซ็นต์ ก่อนที่จะบันทึกลงดิสก์
2. **📥 ดาวน์โหลดไฟล์ทันที (Download)**:
   * ทำการจัดเก็บ Blob ผลลัพธ์ลงใน `DownloadQueueContext` เพื่อให้ผู้ใช้งานสามารถกดดูประวัติ และดาวน์โหลดไฟล์ซ้ำในภายหลังได้จากแถบ **คิวไฟล์เอกสาร** ที่อยู่บนหน้าทูลบาร์
