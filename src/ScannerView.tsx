import { useRef, useState } from "react";

export function ScannerView({ onCode }: { onCode: (code: string) => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const timerRef = useRef<number | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  // debug
  const [hasBD, setHasBD] = useState(false);
  const [supported, setSupported] = useState<string>("-");
  const [ticks, setTicks] = useState(0);
  const [lastCount, setLastCount] = useState(0);
  const [lastFmt, setLastFmt] = useState<string>("-");
  const [lastRaw, setLastRaw] = useState<string>("-");

  // zoom/torch
  const [zoom, setZoom] = useState<number>(1);
  const [zoomMax, setZoomMax] = useState<number>(1);
  const [torch, setTorch] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [zoomSupported, setZoomSupported] = useState(false);

  const stopScanner = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    try {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    } catch {}
    streamRef.current = null;
    trackRef.current = null;

    try {
      if (videoRef.current) (videoRef.current as any).srcObject = null;
    } catch {}

    setIsRunning(false);
  };

  const applyZoom = async (z: number) => {
    const track = trackRef.current as any;
    if (!track?.applyConstraints) return;
    try {
      await track.applyConstraints({ advanced: [{ zoom: z }] });
    } catch {}
  };

  const applyTorch = async (on: boolean) => {
    const track = trackRef.current as any;
    if (!track?.applyConstraints) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: on }] });
    } catch {}
  };

  const startScanner = async () => {
    try {
      setError(null);
      setTicks(0);
      setLastCount(0);
      setLastFmt("-");
      setLastRaw("-");

      if (!window.isSecureContext) {
        setError("Serve HTTPS (lucchetto).");
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("getUserMedia non disponibile (apri in Chrome).");
        return;
      }

      const BD = (window as any).BarcodeDetector;
      setHasBD(!!BD);
      if (!BD) {
        setError("BarcodeDetector non disponibile su questo browser.");
        return;
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
      trackRef.current = stream.getVideoTracks()[0];

      // zoom/torch support
      try {
        const track: any = trackRef.current;
        const caps: any = track.getCapabilities?.() ?? {};
        if (caps?.zoom?.max) {
          setZoomSupported(true);
          setZoomMax(caps.zoom.max);
          const startZ = Math.min(2, caps.zoom.max);
          setZoom(startZ);
          await applyZoom(startZ);
        } else {
          setZoomSupported(false);
          setZoomMax(1);
          setZoom(1);
        }
        if (caps?.torch) {
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

      // ✅ prendo i formati realmente supportati dal device
      let supportedArr: string[] = [];
      try {
        supportedArr = (await BD.getSupportedFormats?.()) ?? [];
      } catch {
        supportedArr = [];
      }

      setSupported(supportedArr.length ? supportedArr.join(", ") : "(non disponibile)");

      // formati desiderati per farmacia
      const desired = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "qr_code", "data_matrix"];

      // ✅ intersezione: solo quelli che il device supporta davvero
      const formatsToUse =
        supportedArr.length > 0 ? desired.filter((f) => supportedArr.includes(f)) : [];

      const detector =
        formatsToUse.length > 0 ? new BD({ formats: formatsToUse }) : new BD();

      setIsRunning(true);

      timerRef.current = window.setInterval(async () => {
        if (!videoRef.current) return;

        try {
          const results = await detector.detect(videoRef.current);
          setTicks((x) => x + 1);
          setLastCount(results?.length ?? 0);

          if (results && results.length > 0) {
            const r: any = results[0];
            const raw = (r.rawValue ?? "").toString().trim();
            const fmt = (r.format ?? "-").toString();

            setLastFmt(fmt);
            setLastRaw(raw || "(vuoto)");

            if (!raw || raw.replace(/\s+/g, "").length < 6) return;

            try {
              navigator.vibrate?.(60);
            } catch {}

            stopScanner();
            onCode(raw.replace(/\s+/g, ""));
          }
        } catch (e: any) {
          setTicks((x) => x + 1);
          // se vuoi vedere anche l'errore: setError(e?.message ?? "detect() errore");
        }
      }, 200);
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
        <div>Supported: {supported}</div>
        <div>Tick: {ticks} | results: {lastCount}</div>
        <div>Last fmt: {lastFmt}</div>
        <div>Last raw: {lastRaw}</div>
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
              Zoom
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