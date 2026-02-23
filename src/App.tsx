import { useEffect, useMemo, useState } from "react";
import "./App.css";
import "./theme.css";

import { ScannerView } from "./ScannerView.tsx";
import {
  loadCatalog,
  saveCatalog,
  loadStock,
  saveStock,
  type CatalogItem,
  type StockItem,
} from "./storage.ts";

export default function App() {
  // --- Catalogo (barcode -> nome/note) ---
  const [catalog, setCatalog] = useState<Record<string, CatalogItem>>(() => loadCatalog());

  useEffect(() => {
    saveCatalog(catalog);
  }, [catalog]);

  // --- Stock (righe con scadenza/quantità) ---
  const [stock, setStock] = useState<StockItem[]>(() => loadStock());

  useEffect(() => {
    saveStock(stock);
  }, [stock]);

  // --- Scansione corrente ---
  const [lastCode, setLastCode] = useState<string | null>(null);

  // se trovato nel catalogo
  const catalogItem = useMemo(() => {
    if (!lastCode) return null;
    return catalog[lastCode] ?? null;
  }, [catalog, lastCode]);

  // --- Form anagrafica (se non trovato) ---
  const [newName, setNewName] = useState("");
  const [newNotes, setNewNotes] = useState("");

  // --- Form scadenza/quantità ---
  const [expiryDate, setExpiryDate] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [buyPrice, setBuyPrice] = useState("");
  const [sellPrice, setSellPrice] = useState("");

  const onScanned = (code: string) => {
    setLastCode(code);

    // reset form scadenza
    setExpiryDate("");
    setQuantity(1);
    setBuyPrice("");
    setSellPrice("");

    // se non esiste nel catalogo, preparo form anagrafica vuoto
    if (!catalog[code]) {
      setNewName("");
      setNewNotes("");
    } else {
      // se esiste, precompilo note (solo per comodità visiva)
      setNewName(catalog[code].name);
      setNewNotes(catalog[code].notes ?? "");
    }
  };

  const saveCatalogItem = () => {
    if (!lastCode) return;
    const name = newName.trim();
    if (!name) {
      alert("Inserisci il nome del prodotto");
      return;
    }

    setCatalog((prev) => ({
      ...prev,
      [lastCode]: {
        barcode: lastCode,
        name,
        notes: newNotes.trim() ? newNotes.trim() : undefined,
        updatedAt: Date.now(),
      },
    }));

    alert("Anagrafica salvata");
  };

  const saveStockItem = () => {
    if (!lastCode) return;

    const item = catalog[lastCode];
    if (!item) {
      alert("Prima salva l'anagrafica (nome prodotto)");
      return;
    }

    if (!expiryDate) {
      alert("Inserisci la data di scadenza");
      return;
    }

    const row: StockItem = {
      id: crypto.randomUUID(),
      barcode: lastCode,
      name: item.name,
      notes: item.notes,
      expiryDate,
      quantity,
      buyPrice: buyPrice ? Number(buyPrice.replace(",", ".")) : undefined,
      sellPrice: sellPrice ? Number(sellPrice.replace(",", ".")) : undefined,
      createdAt: Date.now(),
    };

    setStock((prev) => [row, ...prev]);

    setExpiryDate("");
    setQuantity(1);
    setBuyPrice("");
    setSellPrice("");

    alert("Scadenza salvata");
  };

  // lista per “catalogo consultabile”
  const catalogList = useMemo(() => {
    return Object.values(catalog).sort((a, b) => b.updatedAt - a.updatedAt);
  }, [catalog]);

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
        Scadenze Farmacia
      </h1>

      {/* SCANNER */}
      <ScannerView onCode={onScanned} />

      <div style={{ marginTop: 10, fontSize: 13, color: "var(--muted)" }}>
        Inquadra il barcode principale (EAN/UPC). Se non esiste in archivio, inserisci nome e (opz.) note.
      </div>

      {/* RISULTATO SCANSIONE */}
      {lastCode && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 13, color: "var(--muted)" }}>Codice: {lastCode}</div>

          <div style={{ marginTop: 6, fontWeight: 800 }}>
            {catalogItem ? catalogItem.name : "Prodotto non presente in archivio"}
          </div>
        </div>
      )}

      {/* ANAGRAFICA (nome + note) */}
      {lastCode && (
        <div
          style={{
            marginTop: 14,
            padding: 12,
            border: "1px solid var(--border)",
            borderRadius: 12,
            background: "#fff",
          }}
        >
          <div style={{ fontWeight: 800, marginBottom: 8, color: "var(--primary)" }}>
            Anagrafica prodotto
          </div>

          <div style={{ marginBottom: 10 }}>
            <label>Nome prodotto</label>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label>Note (opzionali)</label>
            <input value={newNotes} onChange={(e) => setNewNotes(e.target.value)} />
          </div>

          <button
            onClick={saveCatalogItem}
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
          >
            Salva / Aggiorna anagrafica
          </button>
        </div>
      )}

      {/* SCADENZA / QUANTITÀ (solo se anagrafica esiste) */}
      {lastCode && catalog[lastCode] && (
        <div
          style={{
            marginTop: 14,
            padding: 12,
            border: "1px solid var(--border)",
            borderRadius: 12,
            background: "#fff",
          }}
        >
          <div style={{ fontWeight: 800, marginBottom: 8, color: "var(--primary)" }}>
            Inserisci scadenza
          </div>

          <div style={{ marginBottom: 10 }}>
            <label>Data scadenza</label>
            <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
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
            onClick={saveStockItem}
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
          >
            Salva scadenza
          </button>
        </div>
      )}

      {/* ARCHIVIO SCADENZE */}
      {stock.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h3 style={{ margin: "0 0 10px 0", color: "var(--primary)" }}>
            Archivio scadenze ({stock.length})
          </h3>

          {stock.map((it) => (
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
              <div style={{ fontWeight: 800 }}>{it.name}</div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>{it.barcode}</div>

              <div style={{ marginTop: 6 }}>
                Scadenza: <strong>{it.expiryDate}</strong> — Q.tà: <strong>{it.quantity}</strong>
              </div>

              {it.notes && (
                <div style={{ marginTop: 6, fontSize: 12, color: "var(--muted)" }}>
                  Note: {it.notes}
                </div>
              )}

              <button
                style={{
                  marginTop: 8,
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "#fff",
                  cursor: "pointer",
                }}
                onClick={() => setStock((prev) => prev.filter((x) => x.id !== it.id))}
              >
                Elimina
              </button>
            </div>
          ))}
        </div>
      )}

      {/* CATALOGO CONSULTABILE (anagrafica) */}
      {catalogList.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h3 style={{ margin: "0 0 10px 0", color: "var(--primary)" }}>
            Catalogo prodotti ({catalogList.length})
          </h3>

          {catalogList.map((p) => (
            <div
              key={p.barcode}
              style={{
                padding: 12,
                border: "1px solid var(--border)",
                borderRadius: 12,
                background: "#fff",
                marginBottom: 10,
              }}
            >
              <div style={{ fontWeight: 800 }}>{p.name}</div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>{p.barcode}</div>
              {p.notes && (
                <div style={{ marginTop: 6, fontSize: 12, color: "var(--muted)" }}>
                  Note: {p.notes}
                </div>
              )}

              <button
                style={{
                  marginTop: 8,
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "#fff",
                  cursor: "pointer",
                }}
                onClick={() => {
                  // carica nel form per modifica
                  setLastCode(p.barcode);
                  setNewName(p.name);
                  setNewNotes(p.notes ?? "");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              >
                Modifica
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}