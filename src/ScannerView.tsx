import { useEffect, useRef, useState } from "react";
import Quagga from "@ericblade/quagga2";

export function ScannerView({ onCode }: { onCode: (code: string) => void }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const start = async () => {
    try {
      setError(null);

      if (!window.isSecureContext) {
        setError("La fotocamera richiede HTTPS (lucchetto). Apri dal link https:// in Chrome.");
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Fotocamera non disponibile in questo browser. Apri in Google Chrome.");
        return;
      }
      if (!containerRef.current) return;

      // Avvia Quagga
      await Quagga.init(
        {
          inputStream: {
            type: "LiveStream",
            target: containerRef.current,
            constraints: {
              facingMode: "environment",
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          },
          locator: {
            patchSize: "medium",
            halfSample: true,
          },
          numOfWorkers: navigator.hardwareConcurrency ? Math.min(4, navigator.hardwareConcurrency) : 2,
          frequency: 10,
          decoder: {
            readers: [
              "ean_reader",
              "ean_8_reader",
              "upc_reader",
              "upc_e_reader",
              "code_128_reader",
            ],
          },
          locate: true,
        },
        (err) => {
          if (err) {
            setError(err.message || "Errore avvio scanner");
            setIsRunning(false);
            return;
          }
          Quagga.start();
          setIsRunning(true);
        }
      );

      Quagga.offDetected(); // evita doppie registrazioni
      Quagga.onDetected((result) => {
        const code = result?.codeResult?.code;
        if (code) {
          try {
            navigator.vibrate?.(60);
          } catch {}

          stop();
          onCode(code);
        }
      });
    } catch (e: any) {
      setError(e?.message ?? "Errore avvio scanner");
      setIsRunning(false);
    }
  };

  const stop = () => {
    try {
      Quagga.stop();
    } catch {}
    setIsRunning(false);
  };

  useEffect(() => {
    return () => {
      // cleanup
      try {
        Quagga.stop();
      } catch {}
    };
  }, []);

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
          }}
        >
          {error}
        </div>
      )}

      <div
        ref={containerRef}
        style={{
          border: "1px solid var(--border)",
          borderRadius: 12,
          overflow: "hidden",
          background: "#000",
          width: "100%",
          minHeight: 240,
        }}
      />

      <div style={{ marginTop: 12 }}>
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

      {isRunning && (
        <div style={{ marginTop: 8, fontSize: 12, color: "var(--muted)" }}>
          Suggerimento: tieni il barcode a 10–20 cm, ben illuminato e fermo 1–2 secondi.
        </div>
      )}
    </div>
  );
}