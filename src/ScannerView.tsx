import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType, NotFoundException } from "@zxing/library";

type Seen = {
  text: string;
  format: string;
  ts: number;
};

function norm(text: string) {
  return (text ?? "").trim().replace(/\s+/g, "");
}

export function ScannerView({ onCode }: { onCode: (code: string) => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const lastSeenAtRef = useRef<Record<string, number>>({});

  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // debug
  const [ticks, setTicks] = useState(0);
  const [seen, setSeen] = useState<Seen[]>([]);
  const [lastFormat, setLastFormat] = useState<string>("-");
  const [lastText, setLastText] = useState<string>("-");

  useEffect(() => {
    return () => {
      try {
        controlsRef.current?.stop();
      } catch {}
    };
  }, []);

  const start = async () => {
    try {
      setError(null);
      setTicks(0);
      setLastFormat("-");
      setLastText("-");
      setSeen([]);
      lastSeenAtRef.current = {};

      if (!window.isSecureContext) {
        setError("Serve HTTPS (lucchetto).");
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Fotocamera non disponibile (apri in Chrome).");
        return;
      }
      if (!videoRef.current) return;

      // stop eventuale sessione precedente
      try {
        controlsRef.current?.stop();
      } catch {}
      controlsRef.current = null;

      // Hints: farmacia (EAN/UPC/Code128 + DataMatrix)
      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
        BarcodeFormat.CODE_128,
        BarcodeFormat.ITF,
        BarcodeFormat.DATA_MATRIX,
        BarcodeFormat.QR_CODE,
        BarcodeFormat.PDF_417,
      ]);

      const reader = new BrowserMultiFormatReader(hints, {
        delayBetweenScanAttempts: 80,
        delayBetweenScanSuccess: 250,
      });

      setIsRunning(true);

      const controls = await reader.decodeFromConstraints(
        {
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false as any,
        } as any,
        videoRef.current,
        (result, err) => {
          setTicks((t) => t + 1);

          if (result) {
            const raw = result.getText?.() ?? "";
            const text = norm(raw);
            const fmt = result.getBarcodeFormat?.();

            setLastText(text || "-");
            setLastFormat(String(fmt ?? "-"));

            // evita rumore
            if (!text || text.length < 4) return;

            const key = `${fmt ?? "?"}:${text}`;
            const now = Date.now();
            const last = lastSeenAtRef.current[key] ?? 0;

            // evita spam: stesso codice max 1 volta ogni 1.5s
            if (now - last < 1500) return;
            lastSeenAtRef.current[key] = now;

            setSeen((prev) => {
              // evita duplicati in lista
              if (prev.some((x) => x.format === String(fmt ?? "-") && x.text === text)) return prev;
              return [{ text, format: String(fmt ?? "-"), ts: now }, ...prev].slice(0, 8);
            });

            return;
          }

          // NotFoundException = normale quando non c'è barcode nel frame
          if (err && !(err instanceof NotFoundException)) {
            setError(err?.message ?? "Errore lettura barcode");
          }
        }
      );

      controlsRef.current = controls;
    } catch (e: any) {
      setError(e?.message ?? "Errore avvio scanner");
      setIsRunning(false);
      try {
        controlsRef.current?.stop();
      } catch {}
      controlsRef.current = null;
    }
  };

  const stop = () => {
    try {
      controlsRef.current?.stop();
    } catch {}
    controlsRef.current = null;
    setIsRunning(false);
  };

  const useCode = (code: string) => {
    try {
      navigator.vibrate?.(60);
    } catch {}
    stop();
    onCode(code);
  };

  return (
    <div>
      {/* DEBUG */}
      <div
        style={{
          marginBottom: 10,
          padding: 10,
          borderRadius: 10,
          border: "1px solid var(--border)",
          background: "#fff",
          fontSize: 12,
          color: "var(--text)",
        }}
      >
        <div style={{ fontWeight: 800 }}>DEBUG ZXING</div>
        <div>Tick: {ticks}</div>
        <div>Ultimo formato: {lastFormat}</div>
        <div>Ultimo testo: {lastText}</div>
        <div style={{ color: "var(--muted)" }}>
          Tip: inquadra il codice rosso e tieni fermo 1–2 secondi.
        </div>
      </div>

      {error && (
        <div
          style={{
            marginBottom: 10,
            padding: 10,
            borderRadius: 10,
            border: "1px solid var(--border)",
            background: "#fff",
            color: "var(--danger)",
            fontSize: 13,
            lineHeight: 1.3,
          }}
        >
          {error}
        </div>
      )}

      <div
        style={{
          border: "1px solid var(--border)",
          borderRadius: 12,
          overflow: "hidden",
          background: "#000",
        }}
      >
        <video
          ref={videoRef}
          style={{ width: "100%", display: "block" }}
          muted
          playsInline
          autoPlay
        />
      </div>

      <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
        {!isRunning ? (
          <button
            onClick={start}
            style={{
              width: "100%",
              padding: 12,
              borderRadius: 12,
              border: "2px solid var(--primary)",
              background: "#fff",
              color: "var(--primary)",
              fontWeight: 700,
              fontSize: 16,
              cursor: "pointer",
            }}
          >
            Avvia scanner
          </button>
        ) : (
          <button
            onClick={stop}
            style={{
              width: "100%",
              padding: 12,
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: "#fff",
              color: "var(--text)",
              fontWeight: 700,
              fontSize: 16,
              cursor: "pointer",
            }}
          >
            Ferma scanner
          </button>
        )}

        {seen.length > 0 && (
          <div
            style={{
              padding: 12,
              border: "1px solid var(--border)",
              borderRadius: 12,
              background: "#fff",
            }}
          >
            <div style={{ fontWeight: 800, marginBottom: 8, color: "var(--primary)" }}>
              Codici rilevati (tocca “Usa questo”)
            </div>

            {seen.map((s) => (
              <div
                key={`${s.format}:${s.text}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: 10,
                  alignItems: "center",
                  padding: "8px 0",
                  borderTop: "1px solid var(--border)",
                }}
              >
                <div>
                  <div style={{ fontWeight: 800 }}>{s.text}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>{s.format}</div>
                </div>

                <button
                  onClick={() => useCode(s.text)}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "2px solid var(--primary)",
                    background: "#fff",
                    color: "var(--primary)",
                    fontWeight: 700,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  Usa questo
                </button>
              </div>
            ))}

            <button
              onClick={() => {
                setSeen([]);
                lastSeenAtRef.current = {};
              }}
              style={{
                marginTop: 10,
                width: "100%",
                padding: 10,
                borderRadius: 10,
                border: "1px solid var(--border)",
                background: "#fff",
                color: "var(--text)",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Svuota lista
            </button>
          </div>
        )}
      </div>
    </div>
  );
}