import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType, NotFoundException } from "@zxing/library";

export function ScannerView({ onCode }: { onCode: (code: string) => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);

  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // debug
  const [ticks, setTicks] = useState(0);
  const [lastText, setLastText] = useState<string>("-");
  const [lastFormat, setLastFormat] = useState<string>("-");

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
      setLastText("-");
      setLastFormat("-");

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

      // Hints: priorità formati farmacia
      const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
]);

      const reader = new BrowserMultiFormatReader(hints, {
        delayBetweenScanAttempts: 100,
        delayBetweenScanSuccess: 600,
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
          const text = result.getText()?.trim() ?? "";
const fmt = result.getBarcodeFormat?.();

setLastText(text || "-");
setLastFormat(String(fmt ?? "-"));

const cleaned = text.replace(/\s+/g, "");

// ✅ Accetta SOLO codici prodotto: numerici 13 cifre (EAN-13)
// (se vuoi anche UPC-A metti 12)
const isEan13 = /^\d{13}$/.test(cleaned);
const isUpcA = /^\d{12}$/.test(cleaned);

if (!isEan13 && !isUpcA) return;

try {
  navigator.vibrate?.(60);
} catch {}

try {
  controlsRef.current?.stop();
} catch {}
controlsRef.current = null;

setIsRunning(false);
onCode(cleaned);
          }
          

          // NotFoundException = normale quando non c'è un barcode nel frame
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
      </div>
    </div>
  );
}