import { useRef, useState } from "react";

export function ScannerView({ onCode }: { onCode: (code: string) => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const timerRef = useRef<number | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  // debug
  const [hasBD, setHasBD] = useState(false);
  const [supported, setSupported] = useState<string>("-");
  const [ticks, setTicks] = useState(0);
  const [lastMs, setLastMs] = useState(0);

  // zoom/torch
  const [zoom, setZoom] = useState<number>(1);
  const [zoomMax, setZoomMax] = useState<number>(1);
  const [torch, setTorch] = useState<boolean>(false);
  const [torchSupported, setTorchSupported] = useState<boolean>(false);
  const [zoomSupported, setZoomSupported] = useState<boolean>(false);

  const stopScanner = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }

    try {
      trackRef.current?.stop?.();
    } catch {}

    try {
      streamRef.current?.getTracks()?.forEach((t) => t.stop());
    } catch {}

    streamRef.current = null;
    trackRef.current = null;

    try {
      if (videoRef.current) (videoRef.current as any).srcObject = null;
    } catch {}

    setIsRunning(false);
  };

  const applyZoom = async (z: number) => {
    const track = trackRef.current;
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ zoom: z }] as any });
    } catch {}
  };

  const applyTorch = async (on: boolean) => {
    const track = trackRef.current;
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: on }] as any });
    } catch {}
  };

  const startScanner = async () => {
    try {
      setError(null);
      setTicks(0);
      setLastMs(0);

      if (!window.isSecureContext) {
        setError("Serve HTTPS (lucchetto). Apri dal link https:// in Chrome.");
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("getUserMedia non disponibile: apri in Google Chrome.");
        return;
      }

      const BD = (window as any).BarcodeDetector;
      setHasBD(!!BD);
      if (!BD) {
        setError("BarcodeDetector non disponibile. Aggiorna Chrome.");
        return;
      }

      // supported formats (debug)
      try {
        const s = await BD.getSupportedFormats?.();
        if (Array.isArray(s)) setSupported(s.join(", "));
        else setSupported("(non disponibile)");
      } catch {
        setSupported("(non disponibile)");
      }

      if (!videoRef.current) return;

      stopScanner();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      streamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      trackRef.current = track;

      // capabilities for zoom/torch
      try {
        const caps: any = (track as any).getCapabilities?.() || {};
        const z = caps.zoom;
        const t = caps.torch;

        if (z && typeof z.max === "number") {
          setZoomSupported(true);
          setZoomMax(z.max);
          const startZoom = Math.min(2, z.max); // zoom iniziale utile
          setZoom(startZoom);
          await applyZoom(startZoom);
        } else {
          setZoomSupported(false);
          setZoomMax(1);
          setZoom(1);
        }

        if (t === true) {
          setTorchSupported(true);
        } else {
          setTorchSupported(false);
          setTorch(false);
        }
      } catch {
        setZoomSupported(false);
        setTorchSupported(false);
      }

      (videoRef.current as any).srcObject = stream;

      await new Promise<void>((resolve) => {
        const v = videoRef.current!;
        if (v.readyState >= 2) return resolve();
        v.onloadedmetadata = () => resolve();
      });

      await videoRef.current.play();

      // Detector (non forziamo i formats: usiamo quelli supportati dal device)
      const detector = new BD();

      setIsRunning(true);

      // ✅ Accettiamo SOLO questi formati, per evitare codici "strani" (es. code_39/codabar)
      const allowedFormats = new Set([
        "ean_13",
        "ean_8",
        "upc_a",
        "upc_e",
        "code_128",
      ]);

      // loop con canvas crop centrale
      timerRef.current = window.setInterval(async () => {
        if (!videoRef.current) return;

        const t0 = performance.now();

        try {
          const v = videoRef.current;

          const canvas = canvasRef.current!;
          const vw = v.videoWidth || 0;
          const vh = v.videoHeight || 0;
          if (!vw || !vh) return;

          // crop centrale: ottimo per barcode 1D
          const cropW = Math.floor(vw * 0.7);
          const cropH = Math.floor(vh * 0.35);
          const sx = Math.floor((vw - cropW) / 2);
          const sy = Math.floor((vh - cropH) / 2);

          canvas.width = cropW;
          canvas.height = cropH;

          const ctx = canvas.getContext("2d");
          if (!ctx) return;

          ctx.drawImage(v, sx, sy, cropW, cropH, 0, 0, cropW, cropH);

          const results = await detector.detect(canvas);

          const dt = performance.now() - t0;
          setLastMs(Math.round(dt));
          setTicks((x) => x + 1);

          if (results && results.length > 0) {
            const r = results[0] as any;
            const raw: string | undefined = r?.rawValue;
            const fmt: string | undefined = r?.format;

            // ✅ filtro formato
            if (fmt && !allowedFormats.has(fmt)) {
              return;
            }

            // ✅ filtro contenuto: accettiamo solo codici "numerici" (tipico EAN/UPC)
            // (Code128 può essere alfanumerico, ma in farmacia spesso EAN è numerico)
            if (raw) {
              const cleaned = raw.replace(/\s+/g, "");

              // Se è numerico 8-14 cifre, ok (EAN8/EAN13/UPC)
              const isNumeric = /^\d{8,14}$/.test(cleaned);

              // Permettiamo anche code_128 ma solo se abbastanza "lungo" (evita "X5YR")
              const isOkCode128 = fmt === "code_128" && cleaned.length >= 8;

              if (!isNumeric && !isOkCode128) return;

              try {
                navigator.vibrate?.(60);
              } catch {}

              stopScanner();
              onCode(cleaned);
            }
          }
        } catch {
          const dt = performance.now() - t0;
          setLastMs(Math.round(dt));
          setTicks((x) => x + 1);
        }
      }, 180);
    } catch (e: any) {
      setError(e?.message ?? "Errore avvio scanner");
      stopScanner();
    }
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
        <div style={{ fontWeight: 800 }}>DEBUG</div>
        <div>BarcodeDetector: {hasBD ? "SI" : "NO"}</div>
        <div>Formati: {supported}</div>
        <div>
          Tick: {ticks} — detect: {lastMs}ms
        </div>
        <div style={{ color: "var(--muted)" }}>
          Nota: ora ignoro code_39/codabar ecc. (per evitare codici tipo “X5Y R”).
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

        {/* Reticolo */}
        <div
          style={{
            position: "absolute",
            left: "15%",
            top: "32%",
            width: "70%",
            height: "36%",
            border: "2px dashed rgba(255,255,255,0.75)",
            borderRadius: 10,
            pointerEvents: "none",
          }}
        />
      </div>

      {/* Canvas nascosto per crop */}
      <canvas ref={canvasRef} style={{ display: "none" }} />

      <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
        {!isRunning ? (
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
        ) : (
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

        {/* Zoom */}
        {zoomSupported && isRunning && (
          <div
            style={{
              padding: 10,
              border: "1px solid var(--border)",
              borderRadius: 12,
              background: "#fff",
            }}
          >
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>
              Zoom (aiuta sui barcode piccoli)
            </div>
            <input
              type="range"
              min={1}
              max={Math.max(1, Math.floor(zoomMax))}
              step={1}
              value={zoom}
              onChange={async (e) => {
                const z = Number(e.target.value);
                setZoom(z);
                await applyZoom(z);
              }}
            />
          </div>
        )}

        {/* Torch */}
        {torchSupported && isRunning && (
          <button
            onClick={async () => {
              const next = !torch;
              setTorch(next);
              await applyTorch(next);
            }}
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
            {torch ? "Spegni torcia" : "Accendi torcia"}
          </button>
        )}
      </div>
    </div>
  );
}