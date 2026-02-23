import { useRef, useState } from "react";

type BarcodeFormat =
  | "ean_13"
  | "ean_8"
  | "upc_a"
  | "upc_e"
  | "code_128"
  | "qr_code"
  | "data_matrix";

export function ScannerView({ onCode }: { onCode: (code: string) => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const stopScanner = () => {
    // stop loop
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    // stop camera tracks
    try {
      streamRef.current?.getTracks()?.forEach((t) => t.stop());
    } catch (e) {}

    streamRef.current = null;

    // clear video
    try {
      if (videoRef.current) {
        (videoRef.current as any).srcObject = null;
      }
    } catch (e) {}

    setIsRunning(false);
  };

  const startScanner = async () => {
    try {
      setError(null);

      if (!window.isSecureContext) {
        setError(
          "La fotocamera richiede HTTPS (lucchetto). Apri dal link https:// in Chrome (non browser interni)."
        );
        return;
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Fotocamera non disponibile in questo browser. Apri in Google Chrome.");
        return;
      }

      // BarcodeDetector (Chrome Android) - super stabile
      const BD = (window as any).BarcodeDetector;
      if (!BD) {
        setError(
          "BarcodeDetector non disponibile su questo browser. Apri con Chrome aggiornato."
        );
        return;
      }

      if (!videoRef.current) return;

      stopScanner();

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      (videoRef.current as any).srcObject = stream;
      await videoRef.current.play();

      const formats: BarcodeFormat[] = [
        "ean_13",
        "ean_8",
        "upc_a",
        "upc_e",
        "code_128",
        "qr_code",
        "data_matrix",
      ];

      const detector = new BD({ formats });

      setIsRunning(true);

      const scanLoop = async () => {
        if (!videoRef.current || !streamRef.current) return;

        try {
          const barcodes = await detector.detect(videoRef.current);
          if (barcodes && barcodes.length > 0) {
            const raw = barcodes[0]?.rawValue;
            if (raw) {
              try {
                navigator.vibrate?.(60);
              } catch (e) {}

              stopScanner();
              onCode(raw);
              return;
            }
          }
        } catch (e: any) {
          // Alcuni device possono lanciare errori intermittenti; non fermiamo subito
        }

        rafRef.current = requestAnimationFrame(scanLoop);
      };

      rafRef.current = requestAnimationFrame(scanLoop);
    } catch (e: any) {
      setError(e?.message ?? "Errore avvio scanner");
      stopScanner();
    }
  };

  return (
    <div>
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

      <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
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
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: "#ffffff",
              color: "var(--text)",
              fontWeight: 700,
              fontSize: 16,
              cursor: "pointer",
            }}
          >
            Ferma scanner
          </button>
        )}

        {isRunning && (
          <div style={{ fontSize: 12, color: "var(--muted)" }}>
            Scanner attivo: inquadra il codice e mantieni fermo 1–2 secondi.
          </div>
        )}
      </div>
    </div>
  );
}