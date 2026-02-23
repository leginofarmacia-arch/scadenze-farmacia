const KEY = "sf_stock_items_v1";

export type StockItem = {
  id: string;
  barcode: string;
  name: string | null;
  expiryDate: string; // YYYY-MM-DD
  quantity: number;
  buyPrice?: number;
  sellPrice?: number;
  createdAt: number;
};

export function loadItems(): StockItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as StockItem[];
  } catch {
    return [];
  }
}

export function saveItems(items: StockItem[]) {
  localStorage.setItem(KEY, JSON.stringify(items));
}