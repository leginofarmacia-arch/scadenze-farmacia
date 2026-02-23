import { useState } from "react";
import "./App.css";
import { ScannerView } from "./ScannerView.tsx";
import { lookupProduct } from "./api.ts";

export default function App() {
  const [lastCode, setLastCode] = useState<string | null>(null);
  const [productName, setProductName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

      <ScannerView
        onCode={async (code: string) => {
          setLastCode(code);
          setLoading(true);

          const result = await lookupProduct(code);
          setProductName(result?.name ?? null);

          setLoading(false);
        }}
      />

      <div style={{ marginTop: 12, fontSize: 14, color: "var(--muted)" }}>
        Se non compare la camera, controlla i permessi del browser.
      </div>

      {lastCode && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 14, color: "var(--muted)" }}>Codice: {lastCode}</div>

          {loading && <div style={{ marginTop: 6 }}>Ricerca prodotto…</div>}

          {!loading && (
            <div style={{ marginTop: 6, fontWeight: 700 }}>
              {productName ? productName : "Prodotto non trovato (inserimento manuale)"}
            </div>
          )}
        </div>
      )}
    </div>
  );
}