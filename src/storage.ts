const KEY_STOCK = "sf_stock_items_v1";
const KEY_CATALOG = "sf_product_catalog_v1";

export type CatalogItem = {
  barcode: string; // chiave
  name: string;
  notes?: string;
  updatedAt: number;
};

export type StockItem = {
  id: string;
  barcode: string;
  name: string; // congeliamo il nome al salvataggio
  notes?: string; // opzionale
  expiryDate: string; // YYYY-MM-DD
  quantity: number;
  buyPrice?: number;
  sellPrice?: number;
  createdAt: number;
};

// --- Stock (righe con scadenza/quantità) ---
export function loadStock(): StockItem[] {
  try {
    const raw = localStorage.getItem(KEY_STOCK);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as StockItem[];
  } catch {
    return [];
  }
}

export function saveStock(items: StockItem[]) {
  localStorage.setItem(KEY_STOCK, JSON.stringify(items));
}

// --- Catalogo (anagrafica prodotti) ---
export function loadCatalog(): Record<string, CatalogItem> {
  try {
    const raw = localStorage.getItem(KEY_CATALOG);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Record<string, CatalogItem>;
  } catch {
    return {};
  }
}

export function saveCatalog(catalog: Record<string, CatalogItem>) {
  localStorage.setItem(KEY_CATALOG, JSON.stringify(catalog));
}