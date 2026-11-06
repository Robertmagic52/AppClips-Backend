const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, "state.json");

app.use(cors());
app.use(express.json());

const DEFAULT_STATE = {
  calc: {
    mode: 2,
    fixed: "3383701",
    hold: 0.5,
    chunk: 1,
    offset: 60,
    redirectUrl: "https://icontrol-magic.onrender.com/",
    updatedAt: Date.now()
  },
  acaat: {
    mode: "seq",
    singleTarget: 18,
    targets: [18, 23, 27, 41, 56, 9],
    timerUrl: "clock-stopwatch://",
    icontrolUrl: "https://icontrol-magic.onrender.com/",
    triggerOn: "both",
    autoDisarm: false,
    updatedAt: Date.now()
  },
  peeks: [],
  emergence: []
};

let state = JSON.parse(JSON.stringify(DEFAULT_STATE));

function loadState() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
      if (raw && typeof raw === "object") {
        if (raw.calc) Object.assign(state.calc, raw.calc);
        if (raw.acaat) Object.assign(state.acaat, raw.acaat);
        if (Array.isArray(raw.peeks)) state.peeks = raw.peeks.slice(0, 20);
        if (Array.isArray(raw.emergence)) state.emergence = raw.emergence.slice(0, 3);
      }
    }
  } catch (e) {}
}

function saveState() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2), "utf8");
  } catch (e) {}
}
loadState();

/* ---------------- Calculator Endpoints (/api/config) ---------------- */
app.get("/api/config", (req, res) => {
  res.json(state.calc);
});

app.post("/api/config", (req, res) => {
  const b = req.body || {};
  if ([0, 1, 2, 3].includes(Number(b.mode))) state.calc.mode = Number(b.mode);
  if (typeof b.fixed === "string") state.calc.fixed = b.fixed.replace(/[^\d.-]/g, "");
  if (!isNaN(Number(b.hold))) state.calc.hold = Math.max(0.15, Math.min(3, Number(b.hold)));
  if ([0, 1, 2, 3, 4].includes(Number(b.chunk))) state.calc.chunk = Number(b.chunk);
  if (!isNaN(Number(b.offset))) state.calc.offset = Math.floor(Number(b.offset));
  if (typeof b.redirectUrl === "string") state.calc.redirectUrl = b.redirectUrl.trim();
  state.calc.updatedAt = Date.now();
  saveState();
  res.json({ ok: true, config: state.calc });
});

/* ---------------- Stopwatch Endpoints (/api/acaat & /api/acaat/peek) ---------------- */
app.get("/api/acaat", (req, res) => {
  res.json({ ...state.acaat, peeks: state.peeks, emergence: state.emergence });
});

app.post("/api/acaat", (req, res) => {
  const b = req.body || {};
  if (["seq", "single", "open17", "off"].includes(b.mode)) state.acaat.mode = b.mode;
  if (b.singleTarget !== undefined && !isNaN(Number(b.singleTarget))) {
    state.acaat.singleTarget = Math.max(0, Math.min(99, Math.floor(Number(b.singleTarget))));
  }
  if (Array.isArray(b.targets)) {
    state.acaat.targets = [0, 1, 2, 3, 4, 5].map(i => {
      const v = b.targets[i];
      return v === null || v === "" || v === undefined || isNaN(Number(v))
        ? null
        : Math.max(0, Math.min(99, Math.floor(Number(v))));
    });
  }
  if (typeof b.timerUrl === "string" && b.timerUrl.trim()) state.acaat.timerUrl = b.timerUrl.trim();
  if (typeof b.icontrolUrl === "string" && b.icontrolUrl.trim()) state.acaat.icontrolUrl = b.icontrolUrl.trim();
  if (["both", "stop", "lap"].includes(b.triggerOn)) state.acaat.triggerOn = b.triggerOn;
  if (typeof b.autoDisarm === "boolean") state.acaat.autoDisarm = b.autoDisarm;
  state.acaat.updatedAt = Date.now();
  saveState();
  res.json({ ok: true, acaat: state.acaat });
});

app.post("/api/acaat/peek", (req, res) => {
  const b = req.body || {};
  const entry = {
    type: String(b.type || "STOP"),
    realFormatted: String(b.realFormatted || "00:00.00"),
    shownFormatted: String(b.shownFormatted || "00:00.00"),
    realSec: Number(b.realSec) || 0,
    realCs: Number(b.realCs) || 0,
    at: b.at || new Date().toLocaleTimeString()
  };
  if (entry.type.startsWith("RESET #")) {
    // Parse Emergence 3-person reset sequence (e.g. "00:01.79 — 00:02.41")
    const parts = entry.realFormatted.split("—").map(s => s.trim()).filter(Boolean);
    state.emergence = parts.map(fmt => ({
      formatted: fmt,
      largeInt: parseInt(fmt.replace(/[^0-9]/g, ""), 10) || 0
    }));
  }
  state.peeks.unshift(entry);
  if (state.peeks.length > 20) state.peeks.pop();
  saveState();
  res.json({ ok: true });
});

app.post("/api/acaat/clear-peeks", (req, res) => {
  state.peeks = [];
  state.emergence = [];
  saveState();
  res.json({ ok: true });
});

/* ---------------- Unified Mobile Control Dashboard (/) ---------------- */
app.get("/", (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<title>Magic Remote</title>
<style>
  :root{--bg:#000;--card:#1c1c1e;--fill:#2c2c2e;--orange:#ff9f0a;--green:#30d158;--gray:#8e8e93;}
  *{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
  body{margin:0;padding:16px 14px 60px;background:var(--bg);color:#fff;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text",sans-serif;}
  .wrap{max-width:460px;margin:0 auto;}
  .tabs{display:grid;grid-template-columns:1fr 1fr;background:var(--card);padding:4px;border-radius:12px;margin-bottom:16px;}
  .tbtn{border:0;background:none;color:var(--gray);font-size:15px;font-weight:600;padding:10px;border-radius:9px;cursor:pointer;}
  .tbtn.on{background:var(--orange);color:#000;}
  .pane{display:none;} .pane.on{display:block;}
  .sec{font-size:12px;color:var(--gray);text-transform:uppercase;letter-spacing:.05em;margin:18px 4px 7px;}
  .card{background:var(--card);border-radius:14px;padding:14px;margin-bottom:12px;}
  .row{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px;}
  .row:last-child{margin-bottom:0;}
  label{font-size:15px;color:#e5e5ea;}
  input,select{background:var(--fill);color:#fff;border:0;border-radius:8px;padding:9px 11px;font-size:16px;outline:none;}
  input[type="text"],input[type="url"]{width:100%;margin-top:6px;}
  .grid6{display:grid;grid-template-columns:repeat(6,1fr);gap:6px;margin-top:8px;}
  .grid6 input{width:100%;text-align:center;padding:9px 0;font-weight:600;}
  .btn{width:100%;border:0;border-radius:12px;background:var(--orange);color:#000;font-size:17px;font-weight:700;padding:14px;cursor:pointer;margin-top:8px;}
  .btn:active{opacity:.8;}
  .peek-hero{display:flex;align-items:center;justify-content:space-between;background:#111c14;border:1px solid #1e4628;border-radius:12px;padding:12px 14px;margin-bottom:10px;}
  .peek-big{font-size:26px;font-weight:700;color:var(--green);font-variant-numeric:tabular-nums;}
  .peek-meta{font-size:13px;color:#a1a1a6;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;}
  .peek-list{font:13px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace;color:#d1d1d6;max-height:150px;overflow-y:auto;white-space:pre-wrap;}
  .toast{position:fixed;bottom:18px;left:50%;transform:translateX(-50%);background:var(--green);color:#000;font-weight:700;padding:10px 20px;border-radius:999px;opacity:0;transition:opacity .2s;pointer-events:none;}
  .toast.on{opacity:1;}
</style>
</head>
<body>
<div class="wrap">
  <div class="tabs">
    <button class="tbtn on" id="tabSw" type="button">⏱ Stopwatch Remote</button>
    <button class="tbtn" id="tabCalc" type="button">🧮 Calculator Remote</button>
  </div>

  <!-- STOPWATCH PANE -->
  <div class="pane on" id="paneSw">
    <div class="sec">Live Spectator Peek (Auto-Updates)</div>
    <div class="card">
      <div class="peek-hero" style="margin-bottom:8px;">
        <div>
          <div style="font-size:11px;color:#8e8e93;text-transform:uppercase;">3-Person Reset Sum (Emergence)</div>
          <div class="peek-big" id="emSum">—</div>
          <div class="peek-meta" id="emSlots" style="margin-top:2px;">No Reset times locked yet</div>
        </div>
      </div>
      <div class="peek-hero">
        <div>
          <div style="font-size:11px;color:#8e8e93;text-transform:uppercase;">Latest Real Stop</div>
          <div class="peek-big" id="liveReal" style="font-size:21px;color:#fff;">—</div>
        </div>
        <div style="text-align:right;">
          <div class="peek-meta" id="liveBreakdown">Sec: — | Dec: —</div>
          <div class="peek-meta" id="liveShown">Shown: —</div>
        </div>
      </div>
      <div class="peek-list" id="peekLog">Waiting for spectator stops...</div>
      <button type="button" id="clearPeeksBtn" style="margin-top:8px;background:#2c2c2e;color:#8e8e93;border:0;border-radius:8px;padding:6px 12px;font-size:12px;cursor:pointer;">Clear Peek History</button>
    </div>

    <div class="sec">Stopwatch Force Controls</div>
    <div class="card">
      <div class="row">
        <label>Force Mode</label>
        <select id="swMode">
          <option value="seq">Lotto / 6-Number Sequence</option>
          <option value="single">Single Decimal (.00–.99)</option>
          <option value="open17">Digits Add Up to 17</option>
          <option value="off">Off (100% Fair)</option>
        </select>
      </div>
      <div class="row">
        <label>Single Decimal (.00–.99)</label>
        <input id="swSingle" type="number" min="0" max="99" style="width:80px;text-align:center;">
      </div>
      <div>
        <label>Lotto 6-Stop Sequence (00–99)</label>
        <div class="grid6">
          <input type="number" min="0" max="99" class="sw-slot" data-i="0">
          <input type="number" min="0" max="99" class="sw-slot" data-i="1">
          <input type="number" min="0" max="99" class="sw-slot" data-i="2">
          <input type="number" min="0" max="99" class="sw-slot" data-i="3">
          <input type="number" min="0" max="99" class="sw-slot" data-i="4">
          <input type="number" min="0" max="99" class="sw-slot" data-i="5">
        </div>
      </div>
    </div>

    <div class="sec">Triggers & Corner Redirects</div>
    <div class="card">
      <div class="row">
        <label>Trigger Force On</label>
        <select id="swTrigger">
          <option value="both">Stop & Lap</option>
          <option value="stop">Stop Only</option>
          <option value="lap">Lap Only</option>
        </select>
      </div>
      <div class="row">
        <label>Auto-Disarm After Force</label>
        <input id="swDisarm" type="checkbox" style="width:22px;height:22px;accent-color:var(--orange);">
      </div>
      <div style="margin-top:10px;">
        <label>Top-Left Hold (Real Timer App URL)</label>
        <input id="swTimerUrl" type="text" placeholder="clock-stopwatch://">
      </div>
      <div style="margin-top:10px;">
        <label>Top-Right Hold (iControl URL)</label>
        <input id="swIcontrolUrl" type="text" placeholder="https://icontrol-magic.onrender.com/">
      </div>
    </div>
    <button class="btn" id="saveSwBtn" type="button">Push Live to Stopwatch</button>
  </div>

  <!-- CALCULATOR PANE -->
  <div class="pane" id="paneCalc">
    <div class="sec">Calculator Force Settings</div>
    <div class="card">
      <div class="row">
        <label>Force Mode</label>
        <select id="cMode">
          <option value="0">Off</option>
          <option value="1">Fixed Number</option>
          <option value="2">Date + Time (Offset)</option>
          <option value="3">Date + Time (Live)</option>
        </select>
      </div>
      <div class="row">
        <label>Fixed Force Number</label>
        <input id="cFixed" type="text" style="width:140px;text-align:right;">
      </div>
      <div class="row">
        <label>Time Offset (Seconds)</label>
        <input id="cOffset" type="number" style="width:90px;text-align:center;">
      </div>
      <div class="row">
        <label>Digits Per Press</label>
        <select id="cChunk">
          <option value="1">1 Digit</option>
          <option value="2">2 Digits</option>
          <option value="3">3 Digits</option>
          <option value="4">4 Digits</option>
          <option value="0">All at Once</option>
        </select>
      </div>
      <div class="row">
        <label>Hold Duration (s)</label>
        <input id="cHold" type="number" step="0.05" min="0.15" max="2.0" style="width:90px;text-align:center;">
      </div>
      <div style="margin-top:10px;">
        <label>Top-Left Clock Button Redirect URL</label>
        <input id="cRedirect" type="text">
      </div>
    </div>
    <button class="btn" id="saveCalcBtn" type="button">Push Live to Calculator</button>
  </div>
</div>

<div class="toast" id="toast">Saved & Pushed Live!</div>

<script>
const p2 = n => String(Math.floor(Math.max(0, n))).padStart(2, "0");
function flashToast(msg){
  const t = document.getElementById("toast");
  t.textContent = msg || "Saved & Pushed Live!";
  t.classList.add("on");
  setTimeout(() => t.classList.remove("on"), 1800);
}

document.getElementById("tabSw").onclick = () => {
  document.getElementById("tabSw").classList.add("on");
  document.getElementById("tabCalc").classList.remove("on");
  document.getElementById("paneSw").classList.add("on");
  document.getElementById("paneCalc").classList.remove("on");
};
document.getElementById("tabCalc").onclick = () => {
  document.getElementById("tabCalc").classList.add("on");
  document.getElementById("tabSw").classList.remove("on");
  document.getElementById("paneCalc").classList.add("on");
  document.getElementById("paneSw").classList.remove("on");
};

let swLoaded = false;
async function loadSw(onlyPeeks){
  try {
    const r = await fetch("/api/acaat", { cache: "no-store" });
    const d = await r.json();
    if (!onlyPeeks && !swLoaded){
      swLoaded = true;
      document.getElementById("swMode").value = d.mode || "seq";
      document.getElementById("swSingle").value = p2(d.singleTarget ?? 18);
      document.querySelectorAll(".sw-slot").forEach(inp => {
        const v = (d.targets || [])[Number(inp.dataset.i)];
        inp.value = (v !== null && v !== undefined) ? p2(v) : "";
      });
      document.getElementById("swTrigger").value = d.triggerOn || "both";
      document.getElementById("swDisarm").checked = !!d.autoDisarm;
      document.getElementById("swTimerUrl").value = d.timerUrl || "clock-stopwatch://";
      document.getElementById("swIcontrolUrl").value = d.icontrolUrl || "https://icontrol-magic.onrender.com/";
    }
    const em = d.emergence || [];
    if (em.length){
      const sum = em.reduce((acc, it) => acc + (Number(it.largeInt) || 0), 0);
      document.getElementById("emSum").textContent = String(sum);
      document.getElementById("emSlots").textContent = em.map((it, idx) => \`#\${idx+1}: \${it.formatted} (\${it.largeInt})\`).join("  •  ");
    } else {
      document.getElementById("emSum").textContent = "—";
      document.getElementById("emSlots").textContent = "No Reset times locked yet";
    }
    const peeks = d.peeks || [];
    if (peeks.length){
      const latest = peeks[0];
      document.getElementById("liveReal").textContent = latest.realFormatted;
      document.getElementById("liveBreakdown").textContent = \`Sec: \${latest.realSec} | Dec: .\${p2(latest.realCs)}\`;
      document.getElementById("liveShown").textContent = \`Shown: \${latest.shownFormatted}\`;
      document.getElementById("peekLog").textContent = peeks.map(
        p => \`[\${p.at}] \${p.type}: REAL \${p.realFormatted} (s:\${p.realSec} c:.\${p2(p.realCs)}) → Shown \${p.shownFormatted}\`
      ).join("\\n");
    } else {
      document.getElementById("liveReal").textContent = "—";
      document.getElementById("liveBreakdown").textContent = "Sec: — | Dec: —";
      document.getElementById("liveShown").textContent = "Shown: —";
      document.getElementById("peekLog").textContent = "Waiting for spectator stops...";
    }
  } catch(e){}
}

async function loadCalc(){
  try {
    const r = await fetch("/api/config", { cache: "no-store" });
    const d = await r.json();
    document.getElementById("cMode").value = String(d.mode ?? 2);
    document.getElementById("cFixed").value = d.fixed || "";
    document.getElementById("cOffset").value = d.offset ?? 60;
    document.getElementById("cChunk").value = String(d.chunk ?? 1);
    document.getElementById("cHold").value = d.hold ?? 0.5;
    document.getElementById("cRedirect").value = d.redirectUrl || "";
  } catch(e){}
}

loadSw(false);
loadCalc();
setInterval(() => loadSw(true), 1500);

document.getElementById("saveSwBtn").onclick = async () => {
  const targets = [];
  document.querySelectorAll(".sw-slot").forEach(inp => {
    const raw = inp.value.trim();
    targets[Number(inp.dataset.i)] = raw === "" ? null : Number(raw);
  });
  const body = {
    mode: document.getElementById("swMode").value,
    singleTarget: Number(document.getElementById("swSingle").value || 0),
    targets,
    triggerOn: document.getElementById("swTrigger").value,
    autoDisarm: document.getElementById("swDisarm").checked,
    timerUrl: document.getElementById("swTimerUrl").value.trim(),
    icontrolUrl: document.getElementById("swIcontrolUrl").value.trim()
  };
  await fetch("/api/acaat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  flashToast("Stopwatch Updated Live!");
};

document.getElementById("clearPeeksBtn").onclick = async () => {
  await fetch("/api/acaat/clear-peeks", { method: "POST" });
  loadSw(true);
};

document.getElementById("saveCalcBtn").onclick = async () => {
  const body = {
    mode: Number(document.getElementById("cMode").value),
    fixed: document.getElementById("cFixed").value,
    offset: Number(document.getElementById("cOffset").value),
    chunk: Number(document.getElementById("cChunk").value),
    hold: Number(document.getElementById("cHold").value),
    redirectUrl: document.getElementById("cRedirect").value
  };
  await fetch("/api/config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  flashToast("Calculator Updated Live!");
};
</script>
</body>
</html>`);
});

app.listen(PORT, () => {
  console.log("Magic Remote Backend running on port " + PORT);
});
