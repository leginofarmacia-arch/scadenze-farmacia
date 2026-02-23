import { useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";

export function ScannerView({ onCode }: { onCode: (code: string) => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const controlsRef = useRef<any>(null);

  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const startScanner = async () => {
    try {
      setError(null);

      if (!videoRef.current) return;

      const reader = new BrowserMultiFormatReader();
      readerRef.current = reader;

      const controls = await reader.decodeFromVideoDevice(
        undefined,
        videoRef.current,
        (result, _err) => {
          if (result) {
            const code = result.getText();

            // vibrazione (se supportata)
            try {
              navigator.vibrate?.(60);
            } catch {}

            stopScanner();
            onCode(code);
          }
        }
      );

      controlsRef.current = controls;
      setIsRunning(true);
    } catch (e: any) {
      setError(e?.message ?? "Errore avvio camera");
    }
  };

  const stopScanner = () => {
    try {
      controlsRef.current?.stop?.();
    } catch (e) {}

try {
  (readerRef.current as any)?.reset?.();
} catch (e) {}

    setIsRunning(false);
  };

  return (
    <div>
      {error && (
        <p style={{ color: "red", marginBottom: 8 }}>
          {error}
        </p>
      )}

      {/* Video */}
      <video
        ref={videoRef}
        style={{
          width: "100%",
          borderRadius: 12,
          background: "#000",
          marginBottom: 10,
        }}
        muted
        playsInline
        autoPlay
      />

      {/* Pulsanti controllo */}
      {!isRunning ? (
     <button
  onClick={startScanner}
  style={{
    width: "100%",
    padding: 12,
    borderRadius: 12,
    border: "2px solid var(--primary)",
    background: "#ffffff",
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
          onClick={stopScanner}
          style={{
            width: "100%",
            padding: 12,
            borderRadius: 14,
            border: "1px solid rgba(255,255,255,0.2)",
            background: "transparent",
            color: "#eaf0ff",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Ferma scanner
        </button>
      )}
    </div>
  );
}