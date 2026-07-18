export interface RawTextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

// Pure grid reconstruction heuristic algorithm
export const reconstructGrid = (
  items: RawTextItem[],
  rowTol: number,
  colTol: number,
  wordSpacing: number
): string[][] => {
  if (items.length === 0) return [];

  // 1. Group items into rows based on Y coordinate similarity (Top-to-Bottom)
  const sortedByY = [...items].sort((a, b) => b.y - a.y);
  const rows: RawTextItem[][] = [];
  
  for (const item of sortedByY) {
    let foundRow = false;
    for (const row of rows) {
      const avgY = row.reduce((sum, r) => sum + r.y, 0) / row.length;
      if (Math.abs(item.y - avgY) < rowTol) {
        row.push(item);
        foundRow = true;
        break;
      }
    }
    if (!foundRow) {
      rows.push([item]);
    }
  }

  // 2. Process each row: Sort horizontally, then merge close-spaced character fragments
  const processedRows: RawTextItem[][] = [];
  for (const row of rows) {
    row.sort((a, b) => a.x - b.x);

    const mergedRow: RawTextItem[] = [];
    for (const item of row) {
      if (mergedRow.length === 0) {
        mergedRow.push({ ...item });
      } else {
        const last = mergedRow[mergedRow.length - 1];
        const gap = item.x - (last.x + last.width);
        
        if (gap < wordSpacing) {
          // Reconstruct full phrases and update width bounding box
          last.str += (gap > 1.5 ? ' ' : '') + item.str;
          last.width = (item.x + item.width) - last.x;
        } else {
          mergedRow.push({ ...item });
        }
      }
    }
    processedRows.push(mergedRow);
  }

  // 3. Find unique Column Centroids across the page to build grid structure
  const allMergedItems = processedRows.flat();
  const sortedX = [...new Set(allMergedItems.map((it) => it.x))].sort((a, b) => a - b);
  
  const colCentroids: number[] = [];
  if (sortedX.length > 0) {
    let currentGroup = [sortedX[0]];
    for (let i = 1; i < sortedX.length; i++) {
      const x = sortedX[i];
      const prev = sortedX[i - 1];
      if (x - prev < colTol) {
        currentGroup.push(x);
      } else {
        const avg = currentGroup.reduce((a, b) => a + b, 0) / currentGroup.length;
        colCentroids.push(avg);
        currentGroup = [x];
      }
    }
    const avg = currentGroup.reduce((a, b) => a + b, 0) / currentGroup.length;
    colCentroids.push(avg);
  }

  // 4. Map row items into discrete column indexes
  const grid: string[][] = [];
  for (const row of processedRows) {
    const excelRow: string[] = Array(colCentroids.length).fill('');
    for (const item of row) {
      // Match closest centroid
      let minDiff = Infinity;
      let colIndex = 0;
      for (let c = 0; c < colCentroids.length; c++) {
        const diff = Math.abs(item.x - colCentroids[c]);
        if (diff < minDiff) {
          minDiff = diff;
          colIndex = c;
        }
      }
      
      // Populate cell text
      if (excelRow[colIndex]) {
        excelRow[colIndex] += ' ' + item.str;
      } else {
        excelRow[colIndex] = item.str;
      }
    }
    grid.push(excelRow);
  }

  return grid;
};
