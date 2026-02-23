import { useEffect, useState } from "react";
import "./App.css";
import "./theme.css";

import { ScannerView } from "./ScannerView.tsx";
import { lookupProduct } from "./api.ts";
import { loadItems, saveItems, type StockItem } from "./storage.ts";

export default function App() {
  // --- Scanner / lookup ---
  const [lastCode, setLastCode] = useState<string | null>(null);
  const [productName, setProductName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // --- Form inserimento ---
  const [expiryDate, setExpiryDate] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [buyPrice, setBuyPrice] = useState<string>("");
  const [sellPrice, setSellPrice] = useState<string>("");

  // --- STEP 2: Archivio persistente (load/save automatico) ---
  const [savedItems, setSavedItems] = useState<StockItem[]>(() => loadItems());

  useEffect(() => {
    saveItems(savedItems);
  }, [savedItems]);

  // --- Handler quando lo scanner legge un codice ---
  const handleCode = async (code: string) => {
    setLastCode(code);
    setProductName(null);
    setLoading(true);

    const result = await lookupProduct(code);
    setProductName(result?.name ?? null);

    setLoading(false);
  };

  const saveCurrentItem = () => {
    if (!lastCode) return;

    if (!expiryDate) {
      alert("Inserisci la data di scadenza");
      return;
    }

    const item: StockItem = {
      id: crypto.randomUUID(),
      barcode: lastCode,
      name: productName,
      expiryDate,
      quantity,
      buyPrice: buyPrice ? Number(buyPrice.replace(",", ".")) : undefined,
      sellPrice: sellPrice ? Number(sellPrice.replace(",", ".")) : undefined,
      createdAt: Date.now(),
    };

    setSavedItems((prev) => [item, ...prev]);

    // reset campi form
    setExpiryDate("");
    setQuantity(1);
    setBuyPrice("");
    setSellPrice("");

    alert("Prodotto salvato");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg)",
        color: "var(--text)",
        padding: 16,
      }}
    >
      <h1 style={{ marginBottom: 16, fontWeight: 800, color: "var(--primary)" }}>
        Scanner codici a barre
      </h1>
<div
  style={{
    marginBottom: 12,
    padding: 10,
    border: "2px dashed red",
    borderRadius: 12,
    background: "#fff",
    fontWeight: 900,
  }}
>
  VERSIONE APP: 99
</div>
      {/* Scanner */}
      <ScannerView onCode={handleCode} />

      <div style={{ marginTop: 10, fontSize: 13, color: "var(--muted)" }}>
        Se non compare la camera, controlla i permessi del browser.
      </div>

      {/* Risultato scansione */}
      {lastCode && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 13, color: "var(--muted)" }}>Codice: {lastCode}</div>

          {loading && <div style={{ marginTop: 6 }}>Ricerca prodotto…</div>}

          {!loading && (
            <div style={{ marginTop: 6, fontWeight: 800 }}>
              {productName ? productName : "Prodotto non trovato (inserimento manuale)"}
            </div>
          )}
        </div>
      )}

      {/* Form scadenza/quantità/prezzi */}
      {lastCode && !loading && (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            border: "1px solid var(--border)",
            borderRadius: 12,
            background: "#fff",
          }}
        >
          <div style={{ marginBottom: 10 }}>
            <label>Data scadenza</label>
            <input
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
            />
          </div>

          <div style={{ marginBottom: 10 }}>
            <label>Quantità</label>
            <input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
            <div>
              <label>Prezzo acquisto (opz.)</label>
              <input
                inputMode="decimal"
                placeholder="es. 3.50"
                value={buyPrice}
                onChange={(e) => setBuyPrice(e.target.value)}
              />
            </div>

            <div>
              <label>Prezzo vendita (opz.)</label>
              <input
                inputMode="decimal"
                placeholder="es. 6.90"
                value={sellPrice}
                onChange={(e) => setSellPrice(e.target.value)}
              />
            </div>
          </div>

          <button
            style={{
              width: "100%",
              padding: 12,
              borderRadius: 12,
              border: "2px solid var(--primary)",
              background: "#fff",
              color: "var(--primary)",
              fontWeight: 700,
              cursor: "pointer",
            }}
            onClick={saveCurrentItem}
          >
            Salva prodotto
          </button>
        </div>
      )}

      {/* Archivio */}
      {savedItems.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h3 style={{ margin: "0 0 10px 0", color: "var(--primary)" }}>
            Archivio ({savedItems.length})
          </h3>

          {savedItems.map((it) => (
            <div
              key={it.id}
              style={{
                padding: 12,
                border: "1px solid var(--border)",
                borderRadius: 12,
                background: "#fff",
                marginBottom: 10,
              }}
            >
              <div style={{ fontWeight: 800 }}>{it.name ?? "Prodotto"}</div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>{it.barcode}</div>

              <div style={{ marginTop: 6 }}>
                Scadenza: <strong>{it.expiryDate}</strong> — Q.tà:{" "}
                <strong>{it.quantity}</strong>
              </div>

              <button
                style={{
                  marginTop: 8,
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "#fff",
                  cursor: "pointer",
                }}
                onClick={() => setSavedItems((prev) => prev.filter((x) => x.id !== it.id))}
              >
                Elimina
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}