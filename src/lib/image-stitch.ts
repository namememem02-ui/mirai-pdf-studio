export interface ImageDimension {
  width: number;
  height: number;
}

export interface StitchedDimensions {
  targetWidth: number;
  totalHeight: number;
  scale: number;
  pages: {
    y: number;
    width: number;
    height: number;
  }[];
}

const MAX_CANVAS_HEIGHT = 16000;
const MAX_CANVAS_WIDTH = 8000;

/**
 * คำนวณขนาดและพิกัดการจัดวางภาพสำหรับต่อแนวตั้ง
 * รองรับการย่อขนาดลงอัตโนมัติหากภาพมีความสูงรวมเกินขีดจำกัดของเบราว์เซอร์
 */
export function calculateStitchedDimensions(
  dimensions: ImageDimension[],
  maxHeightCap = MAX_CANVAS_HEIGHT
): StitchedDimensions {
  if (dimensions.length === 0) {
    return { targetWidth: 0, totalHeight: 0, scale: 1, pages: [] };
  }

  // หาความกว้างสูงสุดเพื่อใช้เป็นเกณฑ์หลัก
  const rawMaxWidth = Math.max(...dimensions.map((d) => d.width));
  const baseWidth = Math.min(rawMaxWidth, MAX_CANVAS_WIDTH);

  // คำนวณความสูงรวมเมื่อสเกลแต่ละหน้าให้กว้างเท่ากับ baseWidth
  let rawTotalHeight = 0;
  const rawPages = dimensions.map((d) => {
    const pageScale = baseWidth / d.width;
    const pageHeight = Math.round(d.height * pageScale);
    const y = rawTotalHeight;
    rawTotalHeight += pageHeight;
    return { y, width: baseWidth, height: pageHeight };
  });

  // ตรวจสอบว่าความสูงรวมเกินขีดจำกัด Canvas หรือไม่
  let finalScale = 1;
  if (rawTotalHeight > maxHeightCap) {
    finalScale = maxHeightCap / rawTotalHeight;
  }

  const targetWidth = Math.round(baseWidth * finalScale);
  let currentY = 0;
  const pages = rawPages.map((p) => {
    const height = Math.round(p.height * finalScale);
    const y = currentY;
    currentY += height;
    return { y, width: targetWidth, height };
  });

  return {
    targetWidth,
    totalHeight: currentY,
    scale: finalScale,
    pages,
  };
}

/**
 * รวมไฟล์ภาพหลายภาพเข้าด้วยกันเป็นภาพเดียวยาวในแนวตั้ง (Single Continuous Long Image)
 */
export async function createStitchedLongImageBlob(
  images: { blob: Blob; page?: number }[]
): Promise<Blob> {
  if (images.length === 0) {
    throw new Error('ไม่มีรูปภาพสำหรับรวม');
  }

  if (images.length === 1) {
    return images[0].blob;
  }

  // โหลดรูปภาพทั้งหมดเป็น HTMLImageElement
  const loadedElements = await Promise.all(
    images.map(
      (item) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          const url = URL.createObjectURL(item.blob);
          img.onload = () => {
            URL.revokeObjectURL(url);
            resolve(img);
          };
          img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error(`โหลดภาพหน้า ${item.page ?? ''} ไม่สำเร็จ`));
          };
          img.src = url;
        })
    )
  );

  const dimensions: ImageDimension[] = loadedElements.map((img) => ({
    width: img.naturalWidth || img.width,
    height: img.naturalHeight || img.height,
  }));

  const layout = calculateStitchedDimensions(dimensions);

  const canvas = document.createElement('canvas');
  canvas.width = layout.targetWidth;
  canvas.height = layout.totalHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('ไม่สามารถสร้าง Canvas Context ได้');
  }

  // พื้นหลังสีขาว
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, layout.targetWidth, layout.totalHeight);

  // วาดทีละหน้าลง Canvas ตามพิกัดที่คำนวณไว้
  loadedElements.forEach((img, i) => {
    const page = layout.pages[i];
    ctx.drawImage(img, 0, page.y, page.width, page.height);
  });

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('สร้างไฟล์ภาพเดียวยาวไม่สำเร็จ'));
        }
      },
      'image/png',
      0.95
    );
  });
}
