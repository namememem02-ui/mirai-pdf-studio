# PDF Split, Cut, and Download Naming Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เพิ่มเครื่องมือแยกทุกหน้าเป็น PDF ย่อย เปลี่ยนเครื่องมือเดิมเป็นตัดหน้า และบังคับตั้งชื่อก่อนดาวน์โหลดทุกไฟล์

**Architecture:** รวมการดาวน์โหลดไว้ใน `DownloadQueueContext` และโมดัลตั้งชื่อกลาง เพื่อให้ทุกจุดที่ใช้คิวมีพฤติกรรมเดียวกัน ส่วนจุดที่เรียก `downloadBlob` ตรงจะย้ายเข้าคิว เครื่องมือใหม่ `/split-pages` สร้าง PDF หน้าเดียวและส่งแต่ละไฟล์เข้าคิว

**Tech Stack:** Next.js 16.2.10, React 19.2.4, TypeScript, Tailwind v4, pdf-lib, JSZip, Vitest, Testing Library

## Global Constraints

- ประมวลผลไฟล์ในเบราว์เซอร์เท่านั้น ห้ามอัปโหลดขึ้นเซิร์ฟเวอร์
- คง URL `/split` เดิม
- ทุกการดาวน์โหลดต้องยืนยันหรือแก้ชื่อก่อนเสมอ
- ดาวน์โหลดหลายไฟล์เป็น ZIP และถามเฉพาะชื่อ ZIP
- ชื่อไฟล์หน้าเดียวใช้ `<ชื่อเดิม>_หน้า_001.pdf`

---

### Task 1: Filename and ZIP Utilities

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/lib/download.ts`
- Test: `src/lib/download.test.ts`

**Interfaces:**
- Produces: `splitFilename(filename): { stem: string; extension: string }`, `sanitizeStem(stem): string`, `pagePdfFilename(sourceName, pageNumber): string`, `uniqueFilename(filename, used): string`, `createZipBlob(items): Promise<Blob>`

- [ ] **Step 1: Add test dependencies**

Run: `npm install --save-dev vitest @testing-library/react @testing-library/user-event jsdom`

- [ ] **Step 2: Write failing utility tests**

```ts
import { describe, expect, it } from 'vitest';
import { pagePdfFilename, sanitizeStem, splitFilename, uniqueFilename } from './download';

describe('download names', () => {
  it('preserves extension separately', () => expect(splitFilename('งาน.final.pdf')).toEqual({ stem: 'งาน.final', extension: '.pdf' }));
  it('sanitizes Windows-invalid characters', () => expect(sanitizeStem('  a/b:c*  ')).toBe('a_b_c_'));
  it('formats page numbers with three digits', () => expect(pagePdfFilename('งาน.pdf', 2)).toBe('งาน_หน้า_002.pdf'));
  it('deduplicates names', () => expect(uniqueFilename('a.pdf', new Set(['a.pdf']))).toBe('a (2).pdf'));
});
```

- [ ] **Step 3: Verify RED**

Run: `npx vitest run src/lib/download.test.ts`
Expected: FAIL because `./download` does not exist.

- [ ] **Step 4: Implement utilities and ZIP creation**

Implement pure naming functions and `createZipBlob(items: Array<{ filename: string; blob: Blob }>)` with JSZip; reject an empty item list.

- [ ] **Step 5: Verify GREEN and commit**

Run: `npx vitest run src/lib/download.test.ts`
Expected: all tests pass.

Commit: `git commit -am "test: add download naming utilities"`

### Task 2: Mandatory Rename Modal and Central Download Flow

**Files:**
- Create: `src/components/RenameDownloadModal.tsx`
- Modify: `src/context/DownloadQueueContext.tsx`
- Modify: `src/app/downloads/page.tsx`
- Test: `src/components/RenameDownloadModal.test.tsx`

**Interfaces:**
- Produces: `requestDownload(id): void`, `requestDownloadMany(ids, defaultZipName?): Promise<void>`, modal props `{ filename, onCancel, onConfirm }`
- Replaces: `downloadItem` and `downloadAll` public context actions

- [ ] **Step 1: Write failing modal test**

```tsx
it('requires a name and confirms with the original extension', async () => {
  const onConfirm = vi.fn();
  render(<RenameDownloadModal filename="งาน.pdf" onCancel={() => {}} onConfirm={onConfirm} />);
  await userEvent.clear(screen.getByRole('textbox'));
  expect(screen.getByRole('button', { name: 'ดาวน์โหลด' })).toBeDisabled();
  await userEvent.type(screen.getByRole('textbox'), 'ฉบับใหม่{Enter}');
  expect(onConfirm).toHaveBeenCalledWith('ฉบับใหม่.pdf');
});
```

- [ ] **Step 2: Verify RED**

Run: `npx vitest run src/components/RenameDownloadModal.test.tsx`
Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement modal and context flow**

Render the modal inside the provider. `requestDownload` opens it for one blob; `requestDownloadMany` creates one ZIP and opens it with `.zip`. Escape cancels, Enter confirms, and the extension is read-only.

- [ ] **Step 4: Update queue page**

Replace direct item downloads with `requestDownload`; make “ดาวน์โหลดทั้งหมด” call `requestDownloadMany(queue.map(({ id }) => id), 'mirai-pdf-files.zip')`.

- [ ] **Step 5: Verify GREEN and commit**

Run: `npx vitest run src/components/RenameDownloadModal.test.tsx`
Expected: pass.

Commit: `git add src/components/RenameDownloadModal.tsx src/context/DownloadQueueContext.tsx src/app/downloads/page.tsx && git commit -m "feat: require names before downloads"`

### Task 3: Route Every Existing Download Through the Central Flow

**Files:**
- Modify: every `src/app/**/page.tsx` currently calling `downloadItem` or `downloadBlob`
- Modify: `src/components/PDFPreviewModal.tsx` only if its callback contract changes

**Interfaces:**
- Consumes: `requestDownload`, `requestDownloadMany`, `addToQueue`

- [ ] **Step 1: Add a failing source guard test**

Create `src/lib/download-routing.test.ts` that recursively scans `src/app` and asserts no page imports or calls `downloadBlob`, except the central context implementation.

- [ ] **Step 2: Verify RED**

Run: `npx vitest run src/lib/download-routing.test.ts`
Expected: FAIL for `extract-text` and `pdf-to-image`.

- [ ] **Step 3: Route all downloads through the queue**

Replace every `downloadItem` call with `requestDownload`. Add text and ZIP results from `extract-text` and `pdf-to-image` to the queue before requesting download.

- [ ] **Step 4: Verify and commit**

Run: `npx vitest run src/lib/download-routing.test.ts`
Expected: pass.

Commit: `git add src && git commit -m "refactor: centralize all app downloads"`

### Task 4: Rename Existing Split Tool to Cut PDF

**Files:**
- Modify: `src/lib/tools.ts`
- Modify: `src/app/split/page.tsx`
- Modify: `src/app/page.tsx`
- Modify: `README.md`
- Test: `src/lib/tools.test.ts`

**Interfaces:**
- Keeps route: `/split`

- [ ] **Step 1: Write failing registry test**

```ts
it('keeps /split but labels it as cut PDF', () => {
  expect(TOOLS.find(tool => tool.id === 'split')?.name).toBe('ตัดหน้า PDF');
});
```

- [ ] **Step 2: Verify RED**

Run: `npx vitest run src/lib/tools.test.ts`
Expected: expected “ตัดหน้า PDF”, received “แยกหน้า PDF”.

- [ ] **Step 3: Update labels and explanations**

Change headings, success/error copy and action text to “ตัดหน้า PDF”; explain that selected pages are retained and unselected pages are removed. Do not change PDF logic.

- [ ] **Step 4: Verify and commit**

Run: `npx vitest run src/lib/tools.test.ts`
Expected: pass.

Commit: `git add src README.md && git commit -m "feat: rename existing split tool to cut PDF"`

### Task 5: Add Split Every Page Tool

**Files:**
- Create: `src/app/split-pages/page.tsx`
- Create: `src/lib/split-pages.ts`
- Test: `src/lib/split-pages.test.ts`
- Modify: `src/lib/tools.ts`
- Modify: `src/app/page.tsx`
- Modify: `README.md`

**Interfaces:**
- Produces: `splitSelectedPages(sourceBytes, sourceName, selectedIndices): Promise<Array<{ filename: string; blob: Blob }>>`
- Consumes: `pagePdfFilename`, `addToQueue`, `requestDownload`, `requestDownloadMany`

- [ ] **Step 1: Write failing PDF split test**

Create a three-page PDF with pdf-lib, select indices `[0, 2]`, and assert two one-page outputs named `_หน้า_001.pdf` and `_หน้า_003.pdf`.

- [ ] **Step 2: Verify RED**

Run: `npx vitest run src/lib/split-pages.test.ts`
Expected: FAIL because `splitSelectedPages` does not exist.

- [ ] **Step 3: Implement pure split function**

Load the source once, create one `PDFDocument` per selected index, copy one page, save to Blob, and throw a Thai error containing the page number on failure.

- [ ] **Step 4: Build `/split-pages` UI**

Reuse the thumbnail-loading pattern from `/split`. Select all pages initially. Provide individual download buttons and one “ดาวน์โหลดไฟล์ที่เลือกเป็น ZIP” action. Add generated results to the queue before requesting downloads.

- [ ] **Step 5: Register menu and docs**

Add `{ id: 'split-pages', name: 'แยกหน้า PDF', ... }` next to the cut tool and update home grouping and README.

- [ ] **Step 6: Verify and commit**

Run: `npx vitest run src/lib/split-pages.test.ts src/lib/tools.test.ts`
Expected: pass.

Commit: `git add src README.md && git commit -m "feat: add split-pages PDF tool"`

### Task 6: Full Verification

**Files:**
- Modify only files required by verification findings

- [ ] **Step 1: Run all tests**

Run: `npx vitest run`
Expected: all tests pass.

- [ ] **Step 2: Run lint and build**

Run: `npm run lint`
Expected: exit 0 with no errors.

Run: `npm run build`
Expected: exit 0 and routes `/split` and `/split-pages` are generated.

- [ ] **Step 3: Browser smoke test on port 4200**

Verify both routes, PDF selection, individual rename prompt, ZIP rename prompt, queue “ดาวน์โหลดทั้งหมด”, Enter/Escape behavior, and that no download starts before confirmation.

- [ ] **Step 4: Final commit if verification required fixes**

Commit: `git add -A && git commit -m "fix: address PDF workflow verification findings"`
