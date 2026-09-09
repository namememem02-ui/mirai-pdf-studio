import { PDFDocument, rgb, StandardFonts, PDFFont } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

export type ImagePdfLayoutMode =
  | 'single_fit'    // 1 รูป / หน้า (Fit A4)
  | 'grid_2'        // 2 รูป / หน้า (1 คอลัมน์ 2 แถว)
  | 'grid_4'        // 4 รูป / หน้า (2 คอลัมน์ 2 แถว)
  | 'grid_6'        // 6 รูป / หน้า (2 คอลัมน์ 3 แถว)
  | 'single_orig'   // 1 รูป / หน้า (ขนาดไฟล์ดั้งเดิม)
  | 'continuous';   // รวมต่อกันเป็น 1 หน้ายาว

export interface LayoutItemInput {
  id: string;
  type: 'image' | 'blank';
  file?: File;
  url?: string;
  caption?: string;
}

export interface GridConfig {
  cols: number;
  rows: number;
  itemsPerPage: number;
}

export const A4_WIDTH = 595.275;
export const A4_HEIGHT = 841.89;

/**
 * ดึงการตั้งค่า Grid (จำนวนคอลัมน์, แถว, จำนวนรูปต่อหน้า) ตาม Layout Mode
 */
export function getGridConfig(mode: ImagePdfLayoutMode): GridConfig {
  switch (mode) {
    case 'grid_2':
      return { cols: 1, rows: 2, itemsPerPage: 2 };
    case 'grid_4':
      return { cols: 2, rows: 2, itemsPerPage: 4 };
    case 'grid_6':
      return { cols: 2, rows: 3, itemsPerPage: 6 };
    case 'single_fit':
    case 'single_orig':
    case 'continuous':
    default:
      return { cols: 1, rows: 1, itemsPerPage: 1 };
  }
}

/**
 * คำนวณพิกัดและขนาดของ Cell แต่ละช่องในหน้ากระดาษ A4
 */
export function calculateCellBounds(params: {
  slotIndex: number;
  cols: number;
  rows: number;
  pageWidth?: number;
  pageHeight?: number;
  margin?: number;
  headerHeight?: number;
  gapX?: number;
  gapY?: number;
}) {
  const {
    slotIndex,
    cols,
    rows,
    pageWidth = A4_WIDTH,
    pageHeight = A4_HEIGHT,
    margin = 36,
    headerHeight = 0,
    gapX = 16,
    gapY = 16,
  } = params;

  const col = slotIndex % cols;
  const row = Math.floor(slotIndex / cols);

  const availableW = pageWidth - 2 * margin;
  const availableH = pageHeight - 2 * margin - headerHeight;

  const cellW = (availableW - (cols - 1) * gapX) / cols;
  const cellH = (availableH - (rows - 1) * gapY) / rows;

  const cellX = margin + col * (cellW + gapX);
  const topY = pageHeight - margin - headerHeight - row * (cellH + gapY);
  const cellY = topY - cellH;

  return {
    x: cellX,
    y: cellY,
    width: cellW,
    height: cellH,
  };
}

/**
 * คำนวณขนาดย่อ/ขยายของรูปภาพให้พอดีกับกล่องโดยรักษาสัดส่วน Aspect Ratio
 */
export function fitImageInBox(
  boxWidth: number,
  boxHeight: number,
  imgWidth: number,
  imgHeight: number
) {
  if (imgWidth <= 0 || imgHeight <= 0 || boxWidth <= 0 || boxHeight <= 0) {
    return { drawWidth: 0, drawHeight: 0, offsetX: 0, offsetY: 0 };
  }

  const scale = Math.min(boxWidth / imgWidth, boxHeight / imgHeight);
  const drawW = imgWidth * scale;
  const drawH = imgHeight * scale;

  return {
    drawWidth: drawW,
    drawHeight: drawH,
    offsetX: (boxWidth - drawW) / 2,
    offsetY: (boxHeight - drawH) / 2,
  };
}

/**
 * จัดกลุ่มรายการ (Image/Blank) เป็นหน้าๆ ตาม itemsPerPage
 * หน้าเปล่า (Blank Page) จะถูกแยกออกมาเป็น 1 หน้าเดี่ยวโดยเฉพาะเสมอ
 */
export function groupItemsIntoPages<T extends { type: 'image' | 'blank' }>(
  items: T[],
  itemsPerPage: number
): T[][] {
  const pages: T[][] = [];
  let currentPage: T[] = [];

  for (const item of items) {
    if (item.type === 'blank') {
      if (currentPage.length > 0) {
        pages.push(currentPage);
        currentPage = [];
      }
      pages.push([item]);
    } else {
      currentPage.push(item);
      if (currentPage.length >= itemsPerPage) {
        pages.push(currentPage);
        currentPage = [];
      }
    }
  }

  if (currentPage.length > 0) {
    pages.push(currentPage);
  }

  return pages;
}

export interface BuildPdfOptions {
  layoutMode: ImagePdfLayoutMode;
  headerText?: string;
  items: LayoutItemInput[];
  sarabunFontBytes?: ArrayBuffer | null;
}

/**
 * สร้าง PDFDocument จากรูปภาพและตั้งค่า Layout ทั้งหมด
 */
export async function buildPdfFromImages(options: BuildPdfOptions): Promise<PDFDocument> {
  const { layoutMode, headerText, items, sarabunFontBytes } = options;
  const doc = await PDFDocument.create();

  // จัดการฟอนต์สำหรับภาษาไทยและภาษาอังกฤษ
  let font: PDFFont;
  if (sarabunFontBytes) {
    doc.registerFontkit(fontkit);
    font = await doc.embedFont(sarabunFontBytes, { subset: true });
  } else {
    font = await doc.embedFont(StandardFonts.Helvetica);
  }

  const hasHeader = Boolean(headerText && headerText.trim().length > 0);
  const headerHeight = hasHeader ? 36 : 0;
  const margin = 36;

  // โหมด Continuous (หน้าเดียวยาว)
  if (layoutMode === 'continuous') {
    const validImageItems = items.filter((it) => it.type === 'image' && it.file);
    if (validImageItems.length === 0) return doc;

    const embeddedImages = [];
    for (const item of validImageItems) {
      if (!item.file) continue;
      const bytes = await item.file.arrayBuffer();
      const img =
        item.file.type === 'image/png' ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
      embeddedImages.push(img);
    }

    const maxWidth = Math.max(...embeddedImages.map((img) => img.width));
    let totalHeight = 0;
    const scaledHeights = embeddedImages.map((img) => {
      const scale = maxWidth / img.width;
      const h = Math.round(img.height * scale);
      totalHeight += h;
      return h;
    });

    const page = doc.addPage([maxWidth, totalHeight]);
    let currentY = totalHeight;
    embeddedImages.forEach((img, i) => {
      const h = scaledHeights[i];
      currentY -= h;
      page.drawImage(img, { x: 0, y: currentY, width: maxWidth, height: h });
    });

    return doc;
  }

  // โหมด 1 รูปขนาดดั้งเดิม (Single Original)
  if (layoutMode === 'single_orig') {
    for (const item of items) {
      if (item.type === 'blank') {
        const page = doc.addPage([A4_WIDTH, A4_HEIGHT]);
        if (item.caption) {
          page.drawText(item.caption, {
            x: margin,
            y: A4_HEIGHT - margin - 20,
            size: 14,
            font,
            color: rgb(0.2, 0.2, 0.2),
          });
        }
        continue;
      }

      if (!item.file) continue;
      const bytes = await item.file.arrayBuffer();
      const img =
        item.file.type === 'image/png' ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);

      const page = doc.addPage([img.width, img.height]);
      page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
    }
    return doc;
  }

  // โหมด Grid บนหน้า A4 (single_fit, grid_2, grid_4, grid_6)
  const { cols, rows, itemsPerPage } = getGridConfig(layoutMode);
  const pagesGrouped = groupItemsIntoPages(items, itemsPerPage);

  for (const pageItems of pagesGrouped) {
    const page = doc.addPage([A4_WIDTH, A4_HEIGHT]);

    // วาดหัวกระดาษ (ถ้ามี)
    if (hasHeader && headerText) {
      page.drawText(headerText.trim(), {
        x: margin,
        y: A4_HEIGHT - margin - 12,
        size: 13,
        font,
        color: rgb(0.15, 0.2, 0.3),
      });

      // เส้นคั่นใต้หัวเรื่อง
      page.drawLine({
        start: { x: margin, y: A4_HEIGHT - margin - 18 },
        end: { x: A4_WIDTH - margin, y: A4_HEIGHT - margin - 18 },
        thickness: 0.75,
        color: rgb(0.8, 0.85, 0.9),
      });
    }

    // กรณีหน้าว่าง A4 เดี่ยวๆ
    if (pageItems.length === 1 && pageItems[0].type === 'blank') {
      const blankItem = pageItems[0];
      if (blankItem.caption && blankItem.caption.trim()) {
        page.drawText(blankItem.caption.trim(), {
          x: margin,
          y: A4_HEIGHT - margin - headerHeight - 24,
          size: 13,
          font,
          color: rgb(0.2, 0.2, 0.2),
        });
      }
      continue;
    }

    // วาดรูปภาพและคำบรรยายลงใน Grid แต่ละช่อง
    for (let slotIndex = 0; slotIndex < pageItems.length; slotIndex++) {
      const item = pageItems[slotIndex];
      if (item.type !== 'image' || !item.file) continue;

      const cellBounds = calculateCellBounds({
        slotIndex,
        cols,
        rows,
        pageWidth: A4_WIDTH,
        pageHeight: A4_HEIGHT,
        margin,
        headerHeight,
        gapX: 16,
        gapY: 16,
      });

      const captionText = item.caption?.trim();
      const hasCaption = Boolean(captionText && captionText.length > 0);
      const captionReservedHeight = hasCaption ? 20 : 0;

      const imageAreaH = cellBounds.height - captionReservedHeight;
      const imageAreaW = cellBounds.width;

      const bytes = await item.file.arrayBuffer();
      const img =
        item.file.type === 'image/png' ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);

      const fitted = fitImageInBox(imageAreaW, imageAreaH, img.width, img.height);

      const imgX = cellBounds.x + fitted.offsetX;
      const imgY = cellBounds.y + captionReservedHeight + fitted.offsetY;

      page.drawImage(img, {
        x: imgX,
        y: imgY,
        width: fitted.drawWidth,
        height: fitted.drawHeight,
      });

      // วาดข้อความคำบรรยายใต้ภาพ
      if (hasCaption && captionText) {
        const fontSize = cols >= 2 && rows >= 3 ? 9 : 10;
        let textWidth = 0;
        try {
          textWidth = font.widthOfTextAtSize(captionText, fontSize);
        } catch {
          textWidth = captionText.length * 6;
        }

        // จัดให้อยู่ตรงกลางของ Cell หรือชิดซ้ายถ้าข้อความยาว
        const textX =
          textWidth < cellBounds.width
            ? cellBounds.x + (cellBounds.width - textWidth) / 2
            : cellBounds.x;
        const textY = cellBounds.y + 4;

        page.drawText(captionText, {
          x: textX,
          y: textY,
          size: fontSize,
          font,
          color: rgb(0.25, 0.25, 0.3),
        });
      }
    }
  }

  return doc;
}
