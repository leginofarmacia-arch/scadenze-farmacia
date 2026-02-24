import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType, NotFoundException } from "@zxing/library";

function norm(text: string) {
  return (text ?? "").trim().replace(/\s+/g, "");
}

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

      // stop sessione precedente
      try {
        controlsRef.current?.stop();
      } catch {}
      controlsRef.current = null;

      // ✅ SOLO formati LINEARI (cosmetici/OTC/parafarmaco)
      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
        BarcodeFormat.CODE_128,
        BarcodeFormat.CODE_39,  // <- per codici tipo A979332400
        BarcodeFormat.ITF,
        BarcodeFormat.CODABAR,
      ]);

      const reader = new BrowserMultiFormatReader(hints, {
        delayBetweenScanAttempts: 80,
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
            const text = norm(result.getText?.() ?? "");
            const fmt = result.getBarcodeFormat?.();

            setLastText(text || "-");
            setLastFormat(String(fmt ?? "-"));

            if (!text || text.length < 6) return;

            // accetta solo alfanumerico semplice (ok per A979332400)
            if (!/^[A-Z0-9]+$/i.test(text)) return;

            try {
              navigator.vibrate?.(60);
            } catch {}

            try {
              controlsRef.current?.stop();
            } catch {}
            controlsRef.current = null;

            setIsRunning(false);
            onCode(text);
            return;
          }

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
        <div>Formato: {lastFormat}</div>
        <div>Letto: {lastText}</div>
        <div style={{ color: "var(--muted)" }}>
          Tip: per OTC/cosmetici cerca il barcode lineare (EAN/Code39/Code128).
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
      </div>
    </div>
  );
}