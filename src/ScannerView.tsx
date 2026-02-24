import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType, NotFoundException } from "@zxing/library";

function norm(text: string) {
  return (text ?? "").trim().replace(/\s+/g, "");
}

function isSimpleAlphaNum(s: string) {
  return /^[A-Z0-9]+$/i.test(s);
}

export function ScannerView({ onCode }: { onCode: (code: string) => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);

  // stabilizzazione
  const lastReadRef = useRef<string>("");
  const stableCountRef = useRef<number>(0);

  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // UI “pistola”
  const [candidate, setCandidate] = useState<string | null>(null); // codice proposto
  const [lastFmt, setLastFmt] = useState<string>("-");
  const [ticks, setTicks] = useState(0);

  useEffect(() => {
    return () => {
      try {
        controlsRef.current?.stop();
      } catch {}
    };
  }, []);

  const stopScanner = () => {
    try {
      controlsRef.current?.stop();
    } catch {}
    controlsRef.current = null;
    setIsRunning(false);
  };

  const startScanner = async () => {
    try {
      setError(null);
      setTicks(0);
      setLastFmt("-");
      setCandidate(null);

      lastReadRef.current = "";
      stableCountRef.current = 0;

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
      stopScanner();

      // ✅ SOLO codici LINEARI (universale per negozio/farmacia)
      // (evitiamo DataMatrix/QR che rubano la lettura)
      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
        BarcodeFormat.CODE_128,
        BarcodeFormat.CODE_39,
        BarcodeFormat.CODE_93,
        BarcodeFormat.ITF,
        BarcodeFormat.CODABAR,
      ]);

      const reader = new BrowserMultiFormatReader(hints, {
        delayBetweenScanAttempts: 60,
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

          // se abbiamo già un candidate, non aggiorniamo più finché non riprendi
          if (candidate) return;

          if (result) {
            const text = norm(result.getText?.() ?? "");
            const fmt = result.getBarcodeFormat?.();
            setLastFmt(String(fmt ?? "-"));

            // anti-rumore
            if (!text || text.length < 6) return;
            if (!isSimpleAlphaNum(text)) return;

            // ✅ stabilizzazione: lo stesso codice deve arrivare 2 volte
            if (text === lastReadRef.current) {
              stableCountRef.current += 1;
            } else {
              lastReadRef.current = text;
              stableCountRef.current = 1;
            }

            if (stableCountRef.current >= 2) {
              // “lock” del codice: lo proponiamo e fermiamo lo scanner
              try {
                navigator.vibrate?.(60);
              } catch {}

              setCandidate(text);
              stopScanner();
            }

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
      stopScanner();
    }
  };

  const confirm = () => {
    if (!candidate) return;
    onCode(candidate);
  };

  const resume = () => {
    setCandidate(null);
    lastReadRef.current = "";
    stableCountRef.current = 0;
    startScanner();
  };

  return (
    <div>
      {/* INFO/DEBUG leggero */}
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
        <div style={{ fontWeight: 800 }}>Scanner (modalità conferma)</div>
        <div style={{ color: "var(--muted)" }}>
          Metti il codice nel riquadro e tieni fermo 1–2 sec. Poi premi “Conferma”.
        </div>
        <div style={{ marginTop: 6, color: "var(--muted)" }}>
          Tick: {ticks} — last fmt: {lastFmt}
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

      {/* Camera + mirino */}
      <div
        style={{
          position: "relative",
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

        {/* mirino */}
        <div
          style={{
            position: "absolute",
            left: "12%",
            top: "35%",
            width: "76%",
            height: "30%",
            border: "2px dashed rgba(255,255,255,0.8)",
            borderRadius: 12,
            pointerEvents: "none",
          }}
        />
      </div>

      <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
        {!isRunning && !candidate && (
          <button
            onClick={startScanner}
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
        )}

        {isRunning && (
          <button
            onClick={stopScanner}
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

        {/* candidato */}
        {candidate && (
          <div
            style={{
              padding: 12,
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: "#fff",
            }}
          >
            <div style={{ fontWeight: 800, color: "var(--primary)" }}>
              Codice rilevato
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, marginTop: 6 }}>
              {candidate}
            </div>
            <div style={{ color: "var(--muted)", marginTop: 4 }}>
              Se non è quello giusto, premi “Riprendi scansione”.
            </div>

            <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
              <button
                onClick={confirm}
                style={{
                  width: "100%",
                  padding: 12,
                  borderRadius: 12,
                  border: "2px solid var(--primary)",
                  background: "var(--primary)",
                  color: "#fff",
                  fontWeight: 800,
                  fontSize: 16,
                  cursor: "pointer",
                }}
              >
                Conferma codice
              </button>

              <button
                onClick={resume}
                style={{
                  width: "100%",
                  padding: 12,
                  borderRadius: 12,
                  border: "2px solid var(--primary)",
                  background: "#fff",
                  color: "var(--primary)",
                  fontWeight: 800,
                  fontSize: 16,
                  cursor: "pointer",
                }}
              >
                Riprendi scansione
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}