import { useState, useEffect, useRef } from "react";

const LAUNCH_API_URL = "https://lpe0z1vu8l.execute-api.us-east-1.amazonaws.com/launch";
const STATUS_API_URL = "https://lpe0z1vu8l.execute-api.us-east-1.amazonaws.com/status"; 

const STAGES = [
  { id: "idle",       label: "Ready to launch" },
  { id: "launching",  label: "Requesting GPU instance..." },
  { id: "booting",    label: "Instance booting..." },
  { id: "pulling",    label: "Loading your environment..." },
  { id: "ready",      label: "Your session is ready!" },
  { id: "error",      label: "Something went wrong" },
];

const STAGE_TIMES = {
  launching: 10,
  booting: 120,
  pulling: 180,
};

function ProgressBar({ stage }) {
  const pct = stage === "idle" ? 0
    : stage === "launching" ? 15
    : stage === "booting"   ? 40
    : stage === "pulling"   ? 75
    : stage === "ready"     ? 100
    : 0;

  return (
    <div style={{ width: "100%", height: "3px", background: "#1e293b", borderRadius: "99px", overflow: "hidden", margin: "32px 0 8px" }}>
      <div style={{
        height: "100%",
        width: `${pct}%`,
        background: stage === "ready" ? "#22c55e" : stage === "error" ? "#ef4444" : "linear-gradient(90deg, #f97316, #fb923c)",
        borderRadius: "99px",
        transition: "width 2s cubic-bezier(0.4,0,0.2,1)",
        boxShadow: stage === "ready" ? "0 0 12px #22c55e88" : "0 0 12px #f9731688",
      }} />
    </div>
  );
}

function PulsingDot({ color = "#f97316" }) {
  return (
    <span style={{ position: "relative", display: "inline-block", width: "10px", height: "10px", marginRight: "8px" }}>
      <span style={{
        position: "absolute", inset: 0, borderRadius: "50%", background: color, opacity: 0.4,
        animation: "ping 1.2s cubic-bezier(0,0,0.2,1) infinite",
      }} />
      <span style={{ position: "absolute", inset: "2px", borderRadius: "50%", background: color }} />
    </span>
  );
}

function LogLine({ text, delay = 0 }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, []);
  return (
    <div style={{
      opacity: visible ? 1 : 0,
      transform: visible ? "translateY(0)" : "translateY(4px)",
      transition: "all 0.4s ease",
      fontSize: "12px",
      color: "#475569",
      fontFamily: "'DM Mono', monospace",
      padding: "3px 0",
      display: "flex",
      gap: "10px",
    }}>
      <span style={{ color: "#1e3a5f", userSelect: "none" }}>›</span>
      <span>{text}</span>
    </div>
  );
}

export default function LaunchPage() {
  const [stage, setStage] = useState("idle");
  const [sessionUrl, setSessionUrl] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [logs, setLogs] = useState([]);
  const [errorMsg, setErrorMsg] = useState(null);
  const pollRef = useRef(null);
  const timerRef = useRef(null);

  const addLog = (text) => setLogs(prev => [...prev, { text, id: Date.now() + Math.random() }]);

  const startTimer = () => {
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
  };

  const stopTimer = () => {
    clearInterval(timerRef.current);
  };

  const formatTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  const pollStatus = (id) => {
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${STATUS_API_URL}?sessionId=${id}`);
        const data = await res.json();

        if (data.status === "booting") {
          setStage("booting");
          addLog("Instance online — waiting for Docker...");
        } else if (data.status === "pulling") {
          setStage("pulling");
          addLog("Pulling GPU environment from registry...");
        } else if (data.status === "ready") {
          clearInterval(pollRef.current);
          stopTimer();
          setStage("ready");
          setSessionUrl(data.url);
          addLog("Container running — session live!");
        } else if (data.status === "error") {
          clearInterval(pollRef.current);
          stopTimer();
          setStage("error");
          setErrorMsg(data.message || "Instance failed to start.");
        }
      } catch (e) {
        // keep polling on network blips
      }
    }, 8000);
  };

  const handleLaunch = async () => {
    setStage("launching");
    setLogs([]);
    startTimer();
    addLog("Sending launch request to AWS...");

    try {
      const res = await fetch(LAUNCH_API_URL, { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      addLog(`Instance ID: ${data.instanceId}`);
      addLog("Waiting for boot sequence...");
      setSessionId(data.sessionId);
      setStage("booting");
      pollStatus(data.sessionId);
    } catch (e) {
      stopTimer();
      setStage("error");
      setErrorMsg("Could not reach the launch API. Please try again.");
    }
  };

  const handleReset = () => {
    clearInterval(pollRef.current);
    clearInterval(timerRef.current);
    setStage("idle");
    setLogs([]);
    setElapsed(0);
    setSessionUrl(null);
    setSessionId(null);
    setErrorMsg(null);
  };

  const isActive = ["launching", "booting", "pulling"].includes(stage);

  return (
    <div style={{
      minHeight: "100vh",
      background: "#060b14",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
      fontFamily: "'DM Sans', sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes ping { 0% { transform: scale(1); opacity: 0.4; } 75%, 100% { transform: scale(2); opacity: 0; } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes glow { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
      `}</style>

      <div style={{
        width: "100%",
        maxWidth: "480px",
        animation: "fadeIn 0.6s ease forwards",
      }}>

        {/* Top badge */}
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "6px 14px",
            background: "#0d1424",
            border: "1px solid #1e293b",
            borderRadius: "99px",
            fontSize: "11px",
            color: "#64748b",
            fontFamily: "'DM Mono', monospace",
            letterSpacing: "0.08em",
          }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#f97316", animation: "glow 2s ease infinite" }} />
            AWS EC2 · p5.4xlarge · 1× H100 80GB
          </div>
        </div>

        {/* Main card */}
        <div style={{
          background: "#0a1020",
          border: "1px solid #1e293b",
          borderRadius: "20px",
          overflow: "hidden",
          boxShadow: "0 24px 80px #00000080",
        }}>

          {/* Header */}
          <div style={{
            padding: "32px 32px 24px",
            borderBottom: "1px solid #1e293b",
            background: "linear-gradient(135deg, #0d1424 0%, #0a1020 100%)",
          }}>
            <h1 style={{
              fontSize: "26px",
              fontWeight: 700,
              color: "#f1f5f9",
              letterSpacing: "-0.03em",
              marginBottom: "8px",
            }}>
              GPU Session
            </h1>
            <p style={{ fontSize: "14px", color: "#475569", lineHeight: "1.6" }}>
              A private H100 instance will be spun up exclusively for you.
              Takes about 5–8 minutes to be ready.
            </p>
          </div>

          {/* Body */}
          <div style={{ padding: "28px 32px 32px" }}>

            {/* Stats row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginBottom: "28px" }}>
              {[
                { label: "GPU", value: "H100 80GB" },
                { label: "RAM", value: "96 GB" },
                { label: "vCPUs", value: "32" },
              ].map(({ label, value }) => (
                <div key={label} style={{
                  padding: "12px",
                  background: "#0d1424",
                  border: "1px solid #1e293b",
                  borderRadius: "10px",
                  textAlign: "center",
                }}>
                  <div style={{ fontSize: "15px", fontWeight: 700, color: "#f1f5f9", fontFamily: "'DM Mono', monospace" }}>{value}</div>
                  <div style={{ fontSize: "10px", color: "#475569", marginTop: "3px", letterSpacing: "0.06em" }}>{label}</div>
                </div>
              ))}
            </div>

            {/* Stage content */}
            {stage === "idle" && (
              <button
                onClick={handleLaunch}
                style={{
                  width: "100%",
                  padding: "16px",
                  background: "linear-gradient(135deg, #ea580c, #f97316)",
                  color: "#fff",
                  border: "none",
                  borderRadius: "12px",
                  fontSize: "15px",
                  fontWeight: 700,
                  cursor: "pointer",
                  letterSpacing: "-0.01em",
                  boxShadow: "0 8px 32px #f9731640",
                  transition: "transform 0.15s, box-shadow 0.15s",
                }}
                onMouseOver={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 12px 40px #f9731660"; }}
                onMouseOut={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 8px 32px #f9731640"; }}
              >
                Launch My GPU Session →
              </button>
            )}

            {isActive && (
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <PulsingDot />
                    <span style={{ fontSize: "13px", fontWeight: 600, color: "#f1f5f9" }}>
                      {STAGES.find(s => s.id === stage)?.label}
                    </span>
                  </div>
                  <span style={{ fontSize: "12px", color: "#475569", fontFamily: "'DM Mono', monospace" }}>
                    {formatTime(elapsed)}
                  </span>
                </div>
                <ProgressBar stage={stage} />
                <div style={{ fontSize: "11px", color: "#334155", fontFamily: "'DM Mono', monospace", textAlign: "right", marginBottom: "20px" }}>
                  {stage === "launching" ? "~10s" : stage === "booting" ? "~2 min" : "~3 min"} estimated
                </div>

                {/* Log output */}
                <div style={{
                  background: "#060b14",
                  border: "1px solid #1e293b",
                  borderRadius: "10px",
                  padding: "14px 16px",
                  minHeight: "80px",
                }}>
                  {logs.map((log, i) => (
                    <LogLine key={log.id} text={log.text} delay={i === logs.length - 1 ? 0 : 0} />
                  ))}
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "6px" }}>
                    <div style={{
                      width: "10px", height: "10px",
                      border: "2px solid #f97316",
                      borderTopColor: "transparent",
                      borderRadius: "50%",
                      animation: "spin 0.8s linear infinite",
                      flexShrink: 0,
                    }} />
                    <span style={{ fontSize: "11px", color: "#334155", fontFamily: "'DM Mono', monospace" }}>
                      processing...
                    </span>
                  </div>
                </div>
              </div>
            )}

            {stage === "ready" && (
              <div>
                <ProgressBar stage="ready" />
                <div style={{
                  padding: "20px",
                  background: "#052e16",
                  border: "1px solid #166534",
                  borderRadius: "12px",
                  textAlign: "center",
                  marginBottom: "16px",
                }}>
                  <div style={{ fontSize: "28px", marginBottom: "8px" }}>🚀</div>
                  <div style={{ fontSize: "15px", fontWeight: 700, color: "#22c55e", marginBottom: "4px" }}>
                    Your session is live!
                  </div>
                  <div style={{ fontSize: "12px", color: "#4ade80", marginBottom: "20px" }}>
                    Ready in {formatTime(elapsed)} · Auto-shuts down when idle
                  </div>
                  <a
                    href={sessionUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: "inline-block",
                      padding: "12px 28px",
                      background: "#22c55e",
                      color: "#fff",
                      borderRadius: "10px",
                      textDecoration: "none",
                      fontSize: "14px",
                      fontWeight: 700,
                      boxShadow: "0 8px 24px #22c55e40",
                    }}
                  >
                    Open My Session →
                  </a>
                </div>
                <button
                  onClick={handleReset}
                  style={{
                    width: "100%",
                    padding: "10px",
                    background: "transparent",
                    color: "#475569",
                    border: "1px solid #1e293b",
                    borderRadius: "8px",
                    fontSize: "12px",
                    cursor: "pointer",
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  Launch another session
                </button>
              </div>
            )}

            {stage === "error" && (
              <div>
                <div style={{
                  padding: "18px",
                  background: "#1a0a0a",
                  border: "1px solid #7f1d1d",
                  borderRadius: "12px",
                  marginBottom: "14px",
                  textAlign: "center",
                }}>
                  <div style={{ fontSize: "24px", marginBottom: "8px" }}>⚠️</div>
                  <div style={{ fontSize: "14px", fontWeight: 600, color: "#f87171", marginBottom: "6px" }}>Launch failed</div>
                  <div style={{ fontSize: "12px", color: "#b91c1c" }}>{errorMsg}</div>
                </div>
                <button
                  onClick={handleReset}
                  style={{
                    width: "100%",
                    padding: "14px",
                    background: "#1e293b",
                    color: "#f1f5f9",
                    border: "none",
                    borderRadius: "10px",
                    fontSize: "14px",
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  Try Again
                </button>
              </div>
            )}

          </div>
        </div>

        {/* Footer note */}
        <p style={{ textAlign: "center", fontSize: "11px", color: "#1e293b", marginTop: "20px", fontFamily: "'DM Mono', monospace" }}>
          Session is private to you · Instance auto-terminates on idle
        </p>
      </div>
    </div>
  );
}
