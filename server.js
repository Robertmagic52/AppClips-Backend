const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
let mongoose = null;
try {
  mongoose = require("mongoose");
} catch(e) {}

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, "state.json");
const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

app.use(cors());
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));
app.use(express.text({ type: ["text/*", "application/javascript", "*/*"], limit: "15mb" }));

const DEFAULT_SAVED_SITES = [
  { name: "Built-in 3D Dice Roller", url: "dice", openInSafari: false },
  { name: "Stopwatch", url: "https://stopwatchappclip.vercel.app/", openInSafari: false },
  { name: "Calculator", url: "https://smartcalc-zeta.vercel.app/", openInSafari: false },
  { name: "iControl", url: "https://icontrol-magic.onrender.com/", openInSafari: true },
  { name: "SSW Target", url: "https://ssw.im/276", openInSafari: true }
];

const DEFAULT_SW_MODES = {
  mode: "seq",
  singleTarget: 18,
  targets: [18, 23, 27, 41, 56, 9],
  scrambleLotto: true,
  triggerOn: "both",
  autoDisarm: true,
  emergenceCount: 3,
  emergenceLocked: false
};

const DEFAULT_CALC_MODES = {
  mode: 2,
  fixed: "6417118",
  offset: 30,
  chunk: 1,
  hold: 0.15,
  autoOpOnLock: false,
  hintStyle: "keypad",
  statusBarMode: "opaque",
  digitHoldDuration: 0.8,
  bdayAutoDetect: true,
  bdayMethod: "remainder",
  birthdayMode: false,
  lockAttemptsToUnlock: 1,
  pasteShortcutUrl: "https://www.icloud.com/shortcuts/9e90e8b02c9e40e5b87a8e30ae849501",
  lockApiPeekMode: "single",
  lockApiPeeks: [],
  history: [],
  digitHolds: {
    "1": { url: "https://icontrol-magic.onrender.com/", openSafari: true },
    "2": { url: "", openSafari: true },
    "3": { url: "", openSafari: true },
    "4": { url: "", openSafari: true },
    "5": { url: "", openSafari: true },
    "6": { url: "", openSafari: true },
    "8": { url: "", openSafari: true }
  },
  mirror: {
    enabled: true,
    direction: "spectator-to-magician",
    display: "0",
    expr: "",
    lastKey: "",
    updatedAt: 0
  },
  daysAlive: {
    date: "",
    dayOfWeek: "",
    daysAlive: 0,
    starSign: "",
    starSymbol: "",
    at: ""
  },
  timeFormat: "12",
  lockCancelUrl: "https://www.icloud.com/shortcuts/c76944441d834e95a4664fc9681182c1",
  lockCancelOpenSafari: true,
  lockEmergencyUrl: "",
  lockEmergencyOpenSafari: true,
  lockBlur: 0,
  injectApiUrl: "https://11z.co/_w/19470/selection",
  injectPushEnabled: true
};

const DEFAULT_INTEGRATIONS = {
  enabled: true,
  autoPoll: true,
  adminPin: "6417",
  apiUrl: "",
  targetField: "data",
  serpApiKey: "",
  tavilyApiKey: "",
  geminiApiKey: "",
  geminiModel: "gemini-2.5-flash",
  prompt: "You are an expert mentalism pricing assistant. Given the input item, determine the realistic, typical retail price in USD for ONE single unit of the item (do NOT price a bulk multi-pack, case, bundle, carton, or brick unless the user explicitly requested a multi-pack). If web search information is provided, use it critically to identify the single unit retail price. Round to a clean whole number without cents or currency symbols. Return ONLY the integer with no words, markdown, or punctuation.",
  lastInput: "",
  lastOutput: "",
  lastPrice: 0,
  lastUpdatedAt: 0,
  lastLogs: []
};

const DEFAULT_STATE = {
  savedSites: DEFAULT_SAVED_SITES,
  sitesUpdatedAt: 0,
  calc: {
    ...DEFAULT_CALC_MODES,
    redirectUrl: "https://icontrol-magic.onrender.com/",
    redirectOpenSafari: true,
    clockSiteUrl: "https://stopwatchappclip.vercel.app/",
    clockOpenSafari: false,
    acRedirectUrl: "dice",
    acOpenSafari: false,
    updatedAt: 0
  },
  acaat: {
    ...DEFAULT_SW_MODES,
    leftRedirectUrl: "https://ssw.im/276",
    leftOpenSafari: true,
    rightRedirectUrl: "https://icontrol-magic.onrender.com/",
    rightOpenSafari: true,
    customSiteUrl: "https://icontrol-magic.onrender.com/",
    openInSafari: true,
    icontrolUrl: "https://smartcalc-zeta.vercel.app/",
    icontrolOpenSafari: false,
    updatedAt: 0
  },
  integrations: DEFAULT_INTEGRATIONS,
  peeks: [],
  emergence: []
};

let state = JSON.parse(JSON.stringify(DEFAULT_STATE));

let StateModel = null;
if (mongoose) {
  const StateSchema = new mongoose.Schema({
    key: { type: String, default: "global_state", unique: true },
    savedSites: { type: Array, default: [] },
    sitesUpdatedAt: { type: Number, default: 0 },
    calc: {
      mode: Number,
      fixed: String,
      hold: Number,
      chunk: Number,
      offset: Number,
      autoOpOnLock: Boolean,
      hintStyle: String,
      redirectUrl: String,
      redirectOpenSafari: Boolean,
      clockSiteUrl: String,
      clockOpenSafari: Boolean,
      acRedirectUrl: String,
      acOpenSafari: Boolean,
      mirror: { type: Object, default: {} },
      daysAlive: { type: Object, default: {} },
      history: { type: Array, default: [] },
      timeFormat: { type: String, default: "12" },
      lockAttemptsToUnlock: { type: Number, default: 1 },
      pasteShortcutUrl: { type: String, default: "https://www.icloud.com/shortcuts/9e90e8b02c9e40e5b87a8e30ae849501" },
      lockApiPeekMode: { type: String, default: "single" },
      lockApiPeeks: { type: Array, default: [] },
      injectApiUrl: { type: String, default: "https://11z.co/_w/19470/selection" },
      injectPushEnabled: { type: Boolean, default: true },
      updatedAt: Number
    },
    acaat: {
      mode: String,
      singleTarget: Number,
      targets: Array,
      scrambleLotto: Boolean,
      leftRedirectUrl: String,
      leftOpenSafari: Boolean,
      rightRedirectUrl: String,
      rightOpenSafari: Boolean,
      customSiteUrl: String,
      openInSafari: Boolean,
      icontrolUrl: String,
      icontrolOpenSafari: Boolean,
      triggerOn: String,
      autoDisarm: Boolean,
      updatedAt: Number
    },
    integrations: { type: Object, default: {} },
    peeks: { type: Array, default: [] },
    emergence: { type: Array, default: [] }
  }, { timestamps: true, strict: false, minimize: false });
  try {
    StateModel = mongoose.model("State", StateSchema);
  } catch(e) {
    StateModel = mongoose.models.State;
  }
}

let isMongoConnected = false;
async function initMongo() {
  if (!mongoose || !MONGODB_URI) {
    console.log("No MONGODB_URI provided. Running with local/file persistence fallback.");
    return;
  }
  try {
    if (mongoose.connection) {
      mongoose.connection.on("disconnected", () => {
        isMongoConnected = false;
        console.warn("MongoDB disconnected.");
      });
      mongoose.connection.on("reconnected", () => {
        isMongoConnected = true;
        console.log("MongoDB reconnected!");
      });
      mongoose.connection.on("error", err => {
        isMongoConnected = false;
        console.error("MongoDB error:", err.message);
      });
    }

    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 8000,
      socketTimeoutMS: 45000
    });
    isMongoConnected = true;
    console.log("MongoDB connected successfully!");

    const doc = await StateModel.findOne({ key: "global_state" }).lean();
    if (doc) {
      if (Array.isArray(doc.savedSites) && doc.savedSites.length) state.savedSites = doc.savedSites;
      if (typeof doc.sitesUpdatedAt === "number") state.sitesUpdatedAt = doc.sitesUpdatedAt;
      if (doc.calc && typeof doc.calc === "object") {
        state.calc = { ...DEFAULT_STATE.calc, ...doc.calc };
      }
      if (doc.acaat && typeof doc.acaat === "object") {
        state.acaat = { ...DEFAULT_STATE.acaat, ...doc.acaat };
      }
      if (doc.integrations && typeof doc.integrations === "object") {
        state.integrations = { ...DEFAULT_INTEGRATIONS, ...doc.integrations };
        if (!state.integrations.adminPin) state.integrations.adminPin = "6417";
        if (!state.integrations.geminiModel) {
          state.integrations.geminiModel = "gemini-2.5-flash";
        }
      }
      if (Array.isArray(doc.peeks)) state.peeks = doc.peeks.slice(0, 20);
      if (Array.isArray(doc.emergence)) state.emergence = doc.emergence.slice(0, 10);
      console.log("Loaded persistent state from MongoDB! Calc mode:", state.calc.mode, "fixed:", state.calc.fixed);
    } else {
      await StateModel.create({ key: "global_state", ...state });
      console.log("Seeded default state into MongoDB!");
    }
  } catch(err) {
    isMongoConnected = false;
    console.error("MongoDB connection failed:", err.message);
  }
}

function loadState() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
      if (raw && typeof raw === "object") {
        if (Array.isArray(raw.savedSites) && raw.savedSites.length) {
          state.savedSites = raw.savedSites;
        }
        if (typeof raw.sitesUpdatedAt === "number") state.sitesUpdatedAt = raw.sitesUpdatedAt;
        if (raw.calc) Object.assign(state.calc, raw.calc);
        if (raw.acaat) Object.assign(state.acaat, raw.acaat);
        if (raw.integrations) {
          Object.assign(state.integrations, raw.integrations);
          if (!state.integrations.adminPin) state.integrations.adminPin = "6417";
          if (!state.integrations.geminiModel) {
            state.integrations.geminiModel = "gemini-2.5-flash";
          }
        }
        if (Array.isArray(raw.peeks)) state.peeks = raw.peeks.slice(0, 20);
        if (Array.isArray(raw.emergence)) state.emergence = raw.emergence.slice(0, 10);
      }
    }
  } catch (e) {}
}

async function saveState() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2), "utf8");
  } catch (e) {}
  if (isMongoConnected && StateModel) {
    try {
      await StateModel.findOneAndUpdate(
        { key: "global_state" },
        {
          $set: {
            savedSites: state.savedSites,
            sitesUpdatedAt: state.sitesUpdatedAt,
            calc: state.calc,
            acaat: state.acaat,
            integrations: state.integrations,
            peeks: state.peeks,
            emergence: state.emergence
          }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    } catch(err) {
      console.error("Error saving state to MongoDB:", err.message);
    }
  }
}
loadState();
initMongo();

function updateSavedSites(list) {
  if (!Array.isArray(list)) return;
  const cleaned = list
    .filter(x => x && typeof x.url === "string" && x.url.trim())
    .map(x => ({
      name: String(x.name || x.url).trim(),
      url: String(x.url).trim(),
      openInSafari: !!x.openInSafari
    }));
  state.savedSites = cleaned;
}

/* ---------------- Saved Sites Endpoint (/api/sites) ---------------- */
app.get("/api/sites", (req, res) => {
  const ts = state.sitesUpdatedAt || Math.max(state.calc.updatedAt || 0, state.acaat.updatedAt || 0);
  res.json({ savedSites: state.savedSites, updatedAt: ts });
});

app.post("/api/sites", (req, res) => {
  const b = req.body || {};
  if (Array.isArray(b.savedSites)) {
    updateSavedSites(b.savedSites);
    const ts = Number(b.updatedAt) || Date.now();
    state.sitesUpdatedAt = ts;
    state.calc.updatedAt = ts;
    state.acaat.updatedAt = ts;
    saveState();
  }
  res.json({ ok: true, savedSites: state.savedSites, updatedAt: state.sitesUpdatedAt });
});

/* ---------------- Calculator Endpoints (/api/config) ---------------- */
app.get("/api/config", (req, res) => {
  res.json({
    ...state.calc,
    savedSites: state.savedSites,
    injectInput: state.integrations?.lastInput || "",
    injectPrice: state.integrations?.lastPrice || 0
  });
});

app.post("/api/config", async (req, res) => {
  const b = req.body || {};
  if ([0, 1, 2, 3].includes(Number(b.mode))) state.calc.mode = Number(b.mode);
  if (b.fixed !== undefined && b.fixed !== null) state.calc.fixed = String(b.fixed).replace(/[^\d.-]/g, "");
  if (!isNaN(Number(b.hold))) state.calc.hold = Math.max(0.15, Math.min(3, Number(b.hold)));
  if ([0, 1, 2, 3, 4].includes(Number(b.chunk))) state.calc.chunk = Number(b.chunk);
  if (!isNaN(Number(b.offset))) state.calc.offset = Math.floor(Number(b.offset));
  if (typeof b.autoOpOnLock === "boolean") state.calc.autoOpOnLock = b.autoOpOnLock;
  if (["keypad", "both", "top", "old", "none", "dot", "bright"].includes(b.hintStyle)) state.calc.hintStyle = b.hintStyle;
  if (typeof b.redirectUrl === "string") state.calc.redirectUrl = b.redirectUrl.trim();
  if (typeof b.redirectOpenSafari === "boolean") state.calc.redirectOpenSafari = b.redirectOpenSafari;
  if (typeof b.clockSiteUrl === "string") state.calc.clockSiteUrl = b.clockSiteUrl.trim();
  if (typeof b.clockOpenSafari === "boolean") state.calc.clockOpenSafari = b.clockOpenSafari;
  if (typeof b.acRedirectUrl === "string") state.calc.acRedirectUrl = b.acRedirectUrl.trim();
  if (typeof b.acOpenSafari === "boolean") state.calc.acOpenSafari = b.acOpenSafari;
  if (typeof b.pasteShortcutUrl === "string") state.calc.pasteShortcutUrl = b.pasteShortcutUrl.trim();
  if (b.lockApiPeekMode === "single" || b.lockApiPeekMode === "all") state.calc.lockApiPeekMode = b.lockApiPeekMode;
  if (Array.isArray(b.lockApiPeeks)) state.calc.lockApiPeeks = b.lockApiPeeks.slice(0, 12);
  if (typeof b.lockCancelUrl === "string") state.calc.lockCancelUrl = b.lockCancelUrl.trim();
  if (typeof b.lockCancelOpenSafari === "boolean") state.calc.lockCancelOpenSafari = b.lockCancelOpenSafari;
  if (typeof b.lockEmergencyUrl === "string") state.calc.lockEmergencyUrl = b.lockEmergencyUrl.trim();
  if (typeof b.lockEmergencyOpenSafari === "boolean") state.calc.lockEmergencyOpenSafari = b.lockEmergencyOpenSafari;
  if ([1, 2, 3].includes(Number(b.lockAttemptsToUnlock))) state.calc.lockAttemptsToUnlock = Number(b.lockAttemptsToUnlock);
  if (isFinite(Number(b.lockBlur)) && Number(b.lockBlur) >= 0) {
    state.calc.lockBlur = Math.max(0, Math.min(80, Number(b.lockBlur)));
  }
  if (typeof b.injectApiUrl === "string") state.calc.injectApiUrl = b.injectApiUrl.trim();
  if (typeof b.injectPushEnabled === "boolean") state.calc.injectPushEnabled = b.injectPushEnabled;
  if (typeof b.mirror === "object" && b.mirror) {
    if (!state.calc.mirror) state.calc.mirror = {};
    if (typeof b.mirror.enabled === "boolean") state.calc.mirror.enabled = b.mirror.enabled;
    if (typeof b.mirror.direction === "string") state.calc.mirror.direction = b.mirror.direction;
  }
  if (b.clearBirthday || b.resetBirthday) {
    state.calc.daysAlive = {};
  }
  if (typeof b.bdayAutoDetect === "boolean") state.calc.bdayAutoDetect = b.bdayAutoDetect;
  if (b.bdayMethod === "remainder" || b.bdayMethod === "toxic") state.calc.bdayMethod = b.bdayMethod;
  if (typeof b.birthdayMode === "boolean") state.calc.birthdayMode = b.birthdayMode;
  if (b.timeFormat === "12" || b.timeFormat === "24") state.calc.timeFormat = b.timeFormat;
  if (b.statusBarMode === "transparent" || b.statusBarMode === "opaque") state.calc.statusBarMode = b.statusBarMode;
  if (isFinite(Number(b.digitHoldDuration)) && Number(b.digitHoldDuration) > 0) {
    state.calc.digitHoldDuration = Number(b.digitHoldDuration);
  }
  if (typeof b.digitHolds === "object" && b.digitHolds !== null) {
    if (!state.calc.digitHolds) state.calc.digitHolds = {};
    for (const d of ["1", "2", "3", "4", "5", "6", "8"]) {
      if (b.digitHolds[d] !== undefined) {
        if (typeof b.digitHolds[d] === "string") {
          state.calc.digitHolds[d] = { url: b.digitHolds[d].trim(), openSafari: true };
        } else if (typeof b.digitHolds[d] === "object" && b.digitHolds[d] !== null) {
          state.calc.digitHolds[d] = {
            url: typeof b.digitHolds[d].url === "string" ? b.digitHolds[d].url.trim() : "",
            openSafari: b.digitHolds[d].openSafari !== false
          };
        }
      }
    }
  }
  if (typeof b.activeRoom === "string" && b.activeRoom.trim()) state.calc.activeRoom = b.activeRoom.trim().toUpperCase();
  if (Array.isArray(b.savedSites)) updateSavedSites(b.savedSites);
  state.calc.updatedAt = Date.now();
  await saveState();
  res.json({ ok: true, mongoSaved: isMongoConnected, config: { ...state.calc, savedSites: state.savedSites } });
});

/* ---------------- Stopwatch Endpoints (/api/acaat & /api/acaat/peek) ---------------- */
app.get("/api/acaat", (req, res) => {
  res.json({
    ...state.acaat,
    savedSites: state.savedSites,
    peeks: state.peeks,
    emergence: state.emergence
  });
});

app.post("/api/acaat", async (req, res) => {
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
  if (typeof b.scrambleLotto === "boolean") state.acaat.scrambleLotto = b.scrambleLotto;
  if (typeof b.leftRedirectUrl === "string" && b.leftRedirectUrl.trim()) {
    state.acaat.leftRedirectUrl = b.leftRedirectUrl.trim();
  }
  if (typeof b.leftOpenSafari === "boolean") state.acaat.leftOpenSafari = b.leftOpenSafari;
  if (typeof b.rightRedirectUrl === "string") {
    state.acaat.rightRedirectUrl = b.rightRedirectUrl.trim();
    state.acaat.customSiteUrl = state.acaat.rightRedirectUrl;
  } else if (typeof b.customSiteUrl === "string") {
    state.acaat.customSiteUrl = b.customSiteUrl.trim();
    state.acaat.rightRedirectUrl = state.acaat.customSiteUrl;
  }
  if (typeof b.rightOpenSafari === "boolean") {
    state.acaat.rightOpenSafari = b.rightOpenSafari;
    state.acaat.openInSafari = b.rightOpenSafari;
  } else if (typeof b.openInSafari === "boolean") {
    state.acaat.openInSafari = b.openInSafari;
    state.acaat.rightOpenSafari = b.openInSafari;
  }
  if (typeof b.icontrolUrl === "string" && b.icontrolUrl.trim()) {
    state.acaat.icontrolUrl = b.icontrolUrl.trim();
  }
  if (typeof b.icontrolOpenSafari === "boolean") {
    state.acaat.icontrolOpenSafari = b.icontrolOpenSafari;
  }
  if (["both", "stop", "lap"].includes(b.triggerOn)) state.acaat.triggerOn = b.triggerOn;
  if (typeof b.autoDisarm === "boolean") state.acaat.autoDisarm = b.autoDisarm;
  if (b.emergenceCount !== undefined && !isNaN(Number(b.emergenceCount))) {
    state.acaat.emergenceCount = Math.max(2, Math.min(10, Math.floor(Number(b.emergenceCount))));
  }
  if (typeof b.emergenceLocked === "boolean") state.acaat.emergenceLocked = b.emergenceLocked;
  if (Array.isArray(b.savedSites)) updateSavedSites(b.savedSites);
  state.acaat.updatedAt = Date.now();
  await saveState();
  res.json({ ok: true, mongoSaved: isMongoConnected, acaat: { ...state.acaat, savedSites: state.savedSites } });
});

app.post("/api/acaat/peek", (req, res) => {
  const b = req.body || {};
  const shownFmt = String(b.shownFormatted || b.realFormatted || "00:00.00").replace(/\s*\(.*$/, "");
  const largeInt = Number(b.largeInt) || parseInt(shownFmt.replace(/[^0-9]/g, ""), 10) || 0;
  const entry = {
    type: String(b.type || "STOP"),
    shownFormatted: shownFmt,
    largeInt,
    sec: Number(b.sec ?? b.realSec) || 0,
    cs: Number(b.cs ?? b.realCs) || 0,
    at: b.at || new Date().toLocaleTimeString()
  };
  if (entry.type.startsWith("RESET") || entry.type.startsWith("EMERGENCE")) {
    const targetCount = state.acaat?.emergenceCount || 3;
    if (!Array.isArray(state.emergence)) state.emergence = [];

    // Option A Locking: If already reached targetCount, round is complete and locked against extra resets
    if (state.emergence.length >= targetCount) {
      // Locked! Extra resets will not overwrite or reset the completed round
    } else {
      if (Array.isArray(b.emergenceList) && b.emergenceList.length > state.emergence.length) {
        // Client has a fuller list (up to targetCount)
        state.emergence = b.emergenceList.slice(0, targetCount).map(it => ({
          formatted: String(it.formatted || "").replace(/\s*\(.*$/, "").trim(),
          largeInt: Number(it.largeInt) || parseInt(String(it.formatted || "").replace(/[^0-9]/g, ""), 10) || 0
        }));
      } else {
        // Client sent a single reset slot or client refreshed/had cached state:
        // Append this reset as the next spectator's slot!
        const nextItem = {
          formatted: shownFmt,
          largeInt: largeInt
        };
        const last = state.emergence[state.emergence.length - 1];
        if (!last || last.formatted !== nextItem.formatted || last.largeInt !== nextItem.largeInt) {
          state.emergence.push(nextItem);
        }
      }
    }
  }
  if (entry.type === "DAYS_ALIVE" || b.daysAlive) {
    if (!state.calc) state.calc = { ...DEFAULT_CALC_MODES };
    state.calc.daysAlive = {
      date: String(b.date || "").trim(),
      dayOfWeek: String(b.dayOfWeek || "").trim(),
      daysAlive: Number(b.daysAlive) || 0,
      starSign: String(b.starSign || "").trim(),
      starSymbol: String(b.starSymbol || "").trim(),
      at: entry.at
    };
    state.calc.updatedAt = Date.now();
  }
  state.peeks.unshift(entry);
  if (state.peeks.length > 20) state.peeks.pop();
  saveState();
  res.json({ ok: true });
});

// Covert Heartbeat & Connection Tracking
let lastCalcHeartbeatAt = 0;
let lastControllerHeartbeatAt = 0;

app.post("/api/calc/heartbeat", (req, res) => {
  const isCtrl = !!req.body?.controller;
  const now = Date.now();
  if (req.body?.controllerClosed) {
    lastControllerHeartbeatAt = 0;
  } else if (isCtrl) {
    lastControllerHeartbeatAt = now;
  } else {
    lastCalcHeartbeatAt = now;
  }
  if (typeof req.body?.birthdayMode === "boolean") {
    if (!state.calc) state.calc = { ...DEFAULT_CALC_MODES };
    state.calc.birthdayMode = req.body.birthdayMode;
  }
  if (req.body?.bdayMethod === "remainder" || req.body?.bdayMethod === "toxic") {
    if (!state.calc) state.calc = { ...DEFAULT_CALC_MODES };
    state.calc.bdayMethod = req.body.bdayMethod;
  }
  if (req.body?.resetBday) {
    if (state.calc) {
      state.calc.daysAlive = {};
      state.calc.bdayResetAt = now;
      state.calc.updatedAt = now;
    }
    saveState().catch(() => {});
  } else if (req.body?.daysAlive && req.body.daysAlive.date) {
    if (!state.calc) state.calc = { ...DEFAULT_CALC_MODES };
    const isSuppressed = state.calc.bdayResetAt && (now - state.calc.bdayResetAt < 45000);
    if (!isSuppressed) {
      const sec = String(req.body.daysAlive.secretNum || req.body.daysAlive.secretNumber || state.calc.daysAlive?.secretNum || "");
      state.calc.daysAlive = {
        date: String(req.body.daysAlive.date || ""),
        dayOfWeek: String(req.body.daysAlive.dayOfWeek || ""),
        daysAlive: Number(req.body.daysAlive.daysAlive) || 0,
        starSign: String(req.body.daysAlive.starSign || ""),
        starSymbol: String(req.body.daysAlive.starSymbol || ""),
        secretNum: sec,
        secretNumber: sec,
        at: req.body.daysAlive.at || new Date().toLocaleTimeString()
      };
      state.calc.updatedAt = now;
    }
  }
  if (req.body?.battery !== undefined) {
    if (!state.calc) state.calc = { ...DEFAULT_CALC_MODES };
    state.calc.battery = Number(req.body.battery);
  }
  const spectatorConnected = (now - lastCalcHeartbeatAt) < 15000;
  const controllerConnected = (now - lastControllerHeartbeatAt) < 15000;
  res.json({
    ok: true,
    now,
    spectatorConnected,
    controllerConnected,
    mirror: state.calc?.mirror || { enabled: true, direction: "spectator-to-magician", display: "0", expr: "" },
    daysAlive: state.calc?.daysAlive || {},
    bdayResetAt: state.calc?.bdayResetAt || 0,
    timeFormat: state.calc?.timeFormat || "12"
  });
});

function getBackendCalcHint() {
  try {
    const c = state.calc || {};
    let target = 0;
    if (c.daysAlive && c.daysAlive.daysAlive) {
      target = Number(c.daysAlive.daysAlive);
    } else if (c.mode === 1) {
      target = Number(c.fixed || 6417118);
    } else {
      const now = new Date();
      let h = now.getHours();
      const m = now.getMinutes();
      const s = now.getSeconds();
      if (c.timeFormat === "12") {
        h = h % 12;
        if (h === 0) h = 12;
      }
      const targetSec = (h * 3600 + m * 60 + s) + (Number(c.offset) || 0);
      const totalSec = ((targetSec % 86400) + 86400) % 86400;
      let th = Math.floor(totalSec / 3600);
      const tm = Math.floor((totalSec % 3600) / 60);
      const ts = totalSec % 60;
      if (c.timeFormat === "12") {
        th = th % 12;
        if (th === 0) th = 12;
      }
      target = Number(`${th}${String(tm).padStart(2, "0")}${String(ts).padStart(2, "0")}`);
    }
    const curVal = Number(c.mirror?.display || 0);
    const diff = target - curVal;
    const sign = diff >= 0 ? "+" : "−";
    const count = String(Math.abs(diff)).replace(/\D/g, "").length || 1;
    return `${sign}${count}`;
  } catch(_) {
    return "+1";
  }
}

app.post("/api/calc/mirror/keystroke", (req, res) => {
  if (!state.calc) state.calc = { ...DEFAULT_CALC_MODES };
  if (!state.calc.mirror) {
    state.calc.mirror = {
      enabled: true,
      direction: "spectator-to-magician",
      display: "0",
      expr: "",
      lastKey: "",
      updatedAt: Date.now()
    };
  }
  const b = req.body || {};
  const isClear = (b.key === "clear" || b.key === "ac" || b.clearAll === true);

  if (isClear) {
    if (!b.fromController) {
      state.calc.mirror.display = "0";
      state.calc.mirror.expr = "";
      state.calc.mirror.lastKey = "clear";
      state.calc.mirror.locked = false;
      state.calc.mirror.hint = "";
      state.calc.mirror.updatedAt = Date.now();
      lastCalcHeartbeatAt = Date.now();
    } else {
      // Controller clearing locally: preserve spectator display and do NOT send clear to spectator!
      lastControllerHeartbeatAt = Date.now();
    }
    saveState().catch(() => {});
    return res.json({ ok: true, mirror: state.calc.mirror, daysAlive: state.calc.daysAlive || {} });
  }

  if (b.fromController) {
    state.calc.mirror.controllerKey = {
      key: String(b.key || ""),
      seq: Number(b.seq) || Date.now(),
      showHint: b.showHint
    };
    if (b.key === "lock" || b.key === "arm") {
      state.calc.mirror.locked = true;
      state.calc.mirror.hint = b.hint ? String(b.hint) : getBackendCalcHint();
    } else if (b.key === "unlock") {
      state.calc.mirror.locked = false;
      state.calc.mirror.hint = "";
    }
    if (b.locked !== undefined) state.calc.mirror.locked = !!b.locked;
    if (b.hint) state.calc.mirror.hint = String(b.hint);
    if (b.display !== undefined) state.calc.mirror.display = String(b.display);
    if (b.expr !== undefined) state.calc.mirror.expr = String(b.expr);
    state.calc.mirror.lastKey = String(b.key || "");
    state.calc.mirror.updatedAt = Date.now();
    lastControllerHeartbeatAt = Date.now();
  } else {
    state.calc.mirror.display = String(b.display ?? state.calc.mirror.display);
    state.calc.mirror.expr = String(b.expr ?? state.calc.mirror.expr);
    state.calc.mirror.lastKey = String(b.key ?? state.calc.mirror.lastKey);

    // If spectator evaluated an equation (=) or sent display with expression, record to history
    if (b.key === "eq" || (b.expr && b.display && b.display !== "0")) {
      if (!Array.isArray(state.calc.history)) state.calc.history = [];
      const exprStr = String(b.expr || "Calculation");
      const resStr = String(b.display || "0");
      const exists = state.calc.history.find(h => h.expr === exprStr && h.res === resStr && Math.abs((h.at || 0) - Date.now()) < 5000);
      if (!exists) {
        state.calc.history.unshift({
          id: "h_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
          expr: exprStr,
          res: resStr,
          meta: b.daysAlive ? ((b.daysAlive.starSign || "") + " • " + (b.daysAlive.dateStr || "")) : "",
          at: Date.now()
        });
        if (state.calc.history.length > 100) state.calc.history.length = 100;
        saveState().catch(() => {});
      }
    }
    if (b.locked !== undefined) state.calc.mirror.locked = !!b.locked;
    if (b.hint !== undefined && b.hint !== "") state.calc.mirror.hint = String(b.hint || "");
    if (b.key === "add" || b.key === "sub" || b.key === "+" || b.key === "−" || b.key === "-") {
      state.calc.mirror.hintDismissed = true;
    }
    if (b.key === "clear" || b.key === "ac") {
      state.calc.mirror.locked = false;
      state.calc.mirror.hint = "";
      state.calc.mirror.hintDismissed = false;
    }
    if (b.secretNum) {
      if (!state.calc.daysAlive) state.calc.daysAlive = {};
      state.calc.daysAlive.secretNum = String(b.secretNum);
      state.calc.daysAlive.secretNumber = String(b.secretNum);
    }
    if (b.daysAlive && b.daysAlive.date) {
      const isSuppressed = state.calc.bdayResetAt && (Date.now() - state.calc.bdayResetAt < 45000);
      if (!isSuppressed) {
        state.calc.daysAlive = {
          ...state.calc.daysAlive,
          ...b.daysAlive,
          secretNum: String(b.daysAlive.secretNum || b.secretNum || state.calc.daysAlive?.secretNum || ""),
          secretNumber: String(b.daysAlive.secretNumber || b.secretNum || state.calc.daysAlive?.secretNum || "")
        };
      }
    }
    state.calc.mirror.updatedAt = Date.now();
    lastCalcHeartbeatAt = Date.now();
  }
  res.json({ ok: true, mirror: state.calc.mirror });
});

app.get("/api/calc/mirror", (req, res) => {
  res.json({
    ok: true,
    mirror: state.calc?.mirror || { enabled: true, direction: "spectator-to-magician", display: "0", expr: "", lastKey: "" },
    daysAlive: state.calc?.daysAlive || {},
    bdayResetAt: state.calc?.bdayResetAt || 0,
    spectatorConnected: (Date.now() - lastCalcHeartbeatAt) < 15000,
    controllerConnected: (Date.now() - lastControllerHeartbeatAt) < 15000
  });
});

app.post("/api/calc/mirror/toggle", async (req, res) => {
  if (!state.calc) state.calc = { ...DEFAULT_CALC_MODES };
  if (!state.calc.mirror) {
    const isEn = (req.body?.enabled !== false && req.body?.direction !== "off");
    state.calc.mirror = { enabled: isEn, direction: req.body?.direction || "spectator-to-magician", display: "0", expr: "", lastKey: "", updatedAt: Date.now() };
  } else {
    if (req.body?.direction) {
      state.calc.mirror.direction = req.body.direction;
    }
    if (typeof req.body?.enabled === "boolean") {
      state.calc.mirror.enabled = req.body.enabled;
    }
    if (req.body?.direction === "off") {
      state.calc.mirror.enabled = false;
    }
    state.calc.mirror.updatedAt = Date.now();
  }
  await saveState();
  res.json({ ok: true, mirror: state.calc.mirror });
});

// Push to Inject Selection Webhook helper: sends real-time alert to Apple Watch & iPhone
let lastServerInjectVal = "";
let lastServerInjectTime = 0;

async function sendToInject(targetUrl, value, note) {
  const url = (targetUrl || state.calc?.injectApiUrl || "https://11z.co/_w/19470/selection").trim();
  if (!url) return { ok: false, error: "No Inject API URL configured" };
  const cleanVal = String(value ?? "").trim();
  if (!cleanVal) return { ok: false, error: "Empty value" };

  const now = Date.now();
  // 10-second deduplication: Never send the exact same number twice within 10s
  if (lastServerInjectVal === cleanVal && (now - lastServerInjectTime) < 10000) {
    return { ok: true, deduplicated: true };
  }
  lastServerInjectVal = cleanVal;
  lastServerInjectTime = now;

  try {
    const payload = {
      value: cleanVal,
      selection: cleanVal
    };
    if (note) payload.note = String(note);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const txt = await res.text();
    let data;
    try { data = JSON.parse(txt); } catch (_) { data = { raw: txt }; }
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    console.warn("[Inject Push Error]", err.message);
    return { ok: false, error: err.message };
  }
}

// Calculator History Persistence: saves all spectator calculations so magician sees them even after their phone was off
app.post("/api/calc/history", async (req, res) => {
  try {
    if (!state.calc) state.calc = { ...DEFAULT_CALC_MODES };
    if (!Array.isArray(state.calc.history)) state.calc.history = [];
    const b = req.body || {};
    const entry = {
      id: "h_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
      expr: String(b.expr || b.display || "0"),
      res: String(b.res || b.display || "0"),
      meta: String(b.meta || ""),
      at: Number(b.at) || Date.now()
    };
    state.calc.history.unshift(entry);
    if (state.calc.history.length > 100) state.calc.history.length = 100;
    saveState().catch(() => {});

    // Forward to Inject API:
    // Only dispatch push notification if the controller page is NOT open (or if forcePush is true, e.g. passcode)!
    const isCtrlActive = (b.controllerOpen === true) || ((Date.now() - lastControllerHeartbeatAt) < 12000);

    if (b.directInjected) {
      lastServerInjectVal = entry.res;
      lastServerInjectTime = Date.now();
    } else if ((!isCtrlActive || b.forcePush === true) && state.calc.injectPushEnabled !== false && entry.res) {
      sendToInject(state.calc.injectApiUrl, entry.res, entry.meta || entry.expr).catch(() => {});
    }

    res.json({ ok: true, count: state.calc.history.length, entry });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

app.post("/api/calc/test-inject", async (req, res) => {
  try {
    const b = req.body || {};
    const url = (b.url || state.calc?.injectApiUrl || "https://11z.co/_w/19470/selection").trim();
    const val = String(b.value || "19470").trim();
    const r = await sendToInject(url, val, "Test Push from Dashboard");
    res.json(r);
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

app.get("/api/calc/history", (req, res) => {
  const list = (state.calc && Array.isArray(state.calc.history)) ? state.calc.history : [];
  res.json({ ok: true, history: list });
});

app.post("/api/calc/history/clear", async (req, res) => {
  if (state.calc) state.calc.history = [];
  saveState().catch(() => {});
  res.json({ ok: true, history: [] });
});

app.post("/api/calc/force-days-alive", async (req, res) => {
  if (!state.calc) state.calc = { ...DEFAULT_CALC_MODES };
  if (state.calc.daysAlive?.daysAlive) {
    state.calc.mode = 1;
    state.calc.fixed = String(state.calc.daysAlive.daysAlive);
    state.calc.updatedAt = Date.now();
    await saveState();
  }
  res.json({ ok: true, calc: state.calc });
});

app.post("/api/calc/reset-bday", async (req, res) => {
  if (!state.calc) state.calc = { ...DEFAULT_CALC_MODES };
  state.calc.daysAlive = {};
  state.calc.bdayResetAt = Date.now();
  if (state.calc.mirror) {
    state.calc.mirror.display = "0";
    state.calc.mirror.expr = "";
    state.calc.mirror.locked = false;
    state.calc.mirror.hint = "";
  }
  state.calc.mode = 2; // Default to Time mode!
  state.calc.updatedAt = Date.now();
  await saveState().catch(() => {});
  res.json({ ok: true, calc: state.calc, daysAlive: {}, bdayResetAt: state.calc.bdayResetAt });
});

app.post("/api/acaat/reset-emergence", async (req, res) => {
  state.emergence = [];
  if (state.acaat) state.acaat.emergenceLocked = false;
  await saveState();
  res.json({ ok: true, emergence: [] });
});

app.get("/healthz", (req, res) => res.json({ status: "ok", now: Date.now() }));
app.get("/ping", (req, res) => res.send("pong"));

app.post("/api/acaat/reset-mode", async (req, res) => {
  Object.assign(state.acaat, DEFAULT_SW_MODES);
  state.acaat.updatedAt = Date.now();
  await saveState();
  res.json({ ok: true, mongoSaved: isMongoConnected, acaat: { ...state.acaat, savedSites: state.savedSites } });
});

app.post("/api/config/reset-mode", async (req, res) => {
  Object.assign(state.calc, DEFAULT_CALC_MODES);
  state.calc.updatedAt = Date.now();
  await saveState();
  res.json({ ok: true, mongoSaved: isMongoConnected, config: { ...state.calc, savedSites: state.savedSites } });
});

app.post("/api/reset-all-modes", async (req, res) => {
  Object.assign(state.acaat, DEFAULT_SW_MODES);
  Object.assign(state.calc, DEFAULT_CALC_MODES);
  const now = Date.now();
  state.acaat.updatedAt = now;
  state.calc.updatedAt = now;
  await saveState();
  res.json({ ok: true, mongoSaved: isMongoConnected, acaat: state.acaat, calc: state.calc, savedSites: state.savedSites });
});

app.post("/api/reset-all-defaults", async (req, res) => {
  state.calc = JSON.parse(JSON.stringify(DEFAULT_STATE.calc));
  state.acaat = JSON.parse(JSON.stringify(DEFAULT_STATE.acaat));
  state.savedSites = JSON.parse(JSON.stringify(DEFAULT_SAVED_SITES));
  const now = Date.now();
  state.calc.updatedAt = now;
  state.acaat.updatedAt = now;
  state.sitesUpdatedAt = now;
  await saveState();
  res.json({ ok: true, mongoSaved: isMongoConnected, message: "Reset to Robert's exact defaults!", acaat: state.acaat, calc: state.calc, savedSites: state.savedSites });
});

app.post("/api/acaat/clear-peeks", (req, res) => {
  state.peeks = [];
  state.emergence = [];
  saveState();
  res.json({ ok: true });
});

/* ---------------- API & AI Pricing Integrations (/api/webhook, /api/inject, etc.) ---------------- */

function extractField(obj, fieldPath) {
  if (!obj || typeof obj !== "object") return null;
  const pathParts = (fieldPath || "data").trim().split(".");
  let cur = obj;
  for (const part of pathParts) {
    if (cur === null || cur === undefined) return null;
    cur = cur[part];
  }
  return cur;
}

function resolvePayloadInput(body, query, targetField) {
  if (Array.isArray(body) && body.length > 0) {
    body = body[0];
  }
  if (typeof body === "string" && body.trim()) {
    try {
      const parsed = JSON.parse(body);
      if (parsed && typeof parsed === "object") body = parsed;
      else return body.trim();
    } catch(_) {
      return body.trim();
    }
  }

  let val = extractField(body, targetField);
  if (val !== null && val !== undefined && String(val).trim()) return String(val).trim();

  val = extractField(query, targetField);
  if (val !== null && val !== undefined && String(val).trim()) return String(val).trim();

  const fallbacks = ["data", "peek", "query", "text", "item", "input", "q", "value", "search", "term", "name", "content"];
  for (const f of fallbacks) {
    if (body && typeof body === "object" && body[f] !== undefined && String(body[f]).trim()) {
      return String(body[f]).trim();
    }
    if (query && typeof query === "object" && query[f] !== undefined && String(query[f]).trim()) {
      return String(query[f]).trim();
    }
  }

  if (body && typeof body === "object") {
    for (const k of Object.keys(body)) {
      const v = body[k];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
  }
  if (query && typeof query === "object") {
    for (const k of Object.keys(query)) {
      const v = query[k];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
  }

  if (typeof body === "string" && body.trim()) return body.trim();
  return null;
}

async function processAiPricing(rawInput, overrides = {}) {
  if (!rawInput || typeof rawInput !== "string" || !rawInput.trim()) {
    throw new Error("No input query or item text provided");
  }

  const query = rawInput.trim();
  if (!state.integrations) state.integrations = { ...DEFAULT_INTEGRATIONS };
  const cfg = state.integrations;
  let searchContext = "";
  let searchSource = "none";
  let finalNumber = null;
  let aiSource = "none";

  // Check if input is directly a price/number (e.g. "$450", "450", "1200", "$1,500.00")
  const directMatch = query.match(/^\$?\s*(\d{1,3}(?:,\d{3})*|\d+)(?:\.00)?$/);
  if (directMatch) {
    finalNumber = parseInt(directMatch[1].replace(/,/g, ""), 10);
    aiSource = "direct_number";
  }

  const tavilyKey = (overrides.tavilyApiKey || process.env.TAVILY_API_KEY || cfg.tavilyApiKey || "").trim();
  const serpApiKey = (overrides.serpApiKey || process.env.SERPAPI_API_KEY || cfg.serpApiKey || "").trim();
  const geminiKey = (overrides.geminiApiKey || process.env.GEMINI_API_KEY || cfg.geminiApiKey || "").trim();

  // If valid keys were passed via overrides and server state has none, auto-persist to state
  if (overrides.geminiApiKey && !cfg.geminiApiKey) { cfg.geminiApiKey = overrides.geminiApiKey; saveState(); }
  if (overrides.tavilyApiKey && !cfg.tavilyApiKey) { cfg.tavilyApiKey = overrides.tavilyApiKey; saveState(); }
  if (overrides.serpApiKey && !cfg.serpApiKey) { cfg.serpApiKey = overrides.serpApiKey; saveState(); }

  // 1. Tavily Search (AI Web Search Engine)
  if (finalNumber === null && tavilyKey) {
    try {
      const tavilyRes = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: tavilyKey,
          query: `retail price of single ${query} in USD`,
          search_depth: "basic",
          include_answer: true,
          max_results: 3
        })
      });
      if (tavilyRes.ok) {
        const tavilyData = await tavilyRes.json();
        const snippets = (tavilyData.results || []).map(r => r.content).join("\n");
        const answer = tavilyData.answer ? `Direct Search Answer: ${tavilyData.answer}\n` : "";
        searchContext = `${answer}Web Search Results:\n${snippets}`.slice(0, 3000);
        searchSource = "tavily";
      }
    } catch(err) {
      console.warn("Tavily search error:", err.message);
    }
  }

  // 2. SerpAPI Search (Google Shopping / Search fallback)
  if (!searchContext && serpApiKey) {
    try {
      const serpUrl = `https://serpapi.com/search.json?q=retail+price+of+single+${encodeURIComponent(query)}+in+USD&api_key=${encodeURIComponent(serpApiKey)}`;
      const serpRes = await fetch(serpUrl);
      if (serpRes.ok) {
        const serpData = await serpRes.json();
        const answerBox = serpData.answer_box ? JSON.stringify(serpData.answer_box) : "";
        const shopping = (serpData.shopping_results || []).slice(0, 3).map(s => `${s.title}: ${s.price}`).join("; ");
        const organic = (serpData.organic_results || []).slice(0, 3).map(o => o.snippet).join("\n");
        searchContext = `Google Shopping: ${shopping}\nAnswer: ${answerBox}\nOrganic:\n${organic}`.slice(0, 3000);
        searchSource = "serpapi";
      }
    } catch(err) {
      console.warn("SerpAPI search error:", err.message);
    }
  }

  if (finalNumber === null && searchSource !== "none") aiSource = searchSource;

  // 3. Gemini API LLM Reasoning
  if (finalNumber === null && geminiKey) {
    const candidateModels = [
      cfg.geminiModel,
      "gemini-2.5-flash",
      "gemini-2.0-flash",
      "gemini-1.5-flash",
      "gemini-2.0-flash-lite",
      "gemini-2.5-pro",
      "gemini-1.5-pro"
    ].filter(Boolean);
    const uniqueModels = [...new Set(candidateModels)];

    const systemPrompt = cfg.prompt || DEFAULT_INTEGRATIONS.prompt;
    const userMessage = searchContext
      ? `Item/Query: "${query}"\n\nLive Search Information:\n${searchContext}\n\nBased on this information and your knowledge, determine the realistic, typical retail price in USD for ONE single unit of the item (do NOT price a bulk multi-pack, case, bundle, carton, or brick unless the user explicitly requested a multi-pack). Round to a clean whole number without cents. Return ONLY the integer digits with no words or punctuation.`
      : `Item/Query: "${query}"\n\nDetermine the realistic, typical retail price in USD for ONE single unit of this item (do NOT price a bulk multi-pack, case, or carton). Round to a clean whole number without cents. Return ONLY the integer digits with no words or punctuation.`;

    for (const model of uniqueModels) {
      if (finalNumber !== null) break;
      for (const withBudget of [true, false]) {
        if (finalNumber !== null) break;
        try {
          const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(geminiKey)}`;
          const genConfig = {
            temperature: 0.1,
            maxOutputTokens: 1000
          };
          if (withBudget) {
            genConfig.thinkingConfig = { thinkingBudget: 0 };
          }

          const geminiRes = await fetch(geminiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [
                {
                  role: "user",
                  parts: [{ text: `${systemPrompt}\n\n${userMessage}` }]
                }
              ],
              generationConfig: genConfig
            })
          });

          if (geminiRes.ok) {
            const geminiData = await geminiRes.json();
            const candObj = geminiData.candidates?.[0];
            // Discard if prematurely cut off by MAX_TOKENS to avoid truncated digits
            if (candObj && candObj.finishReason !== "MAX_TOKENS") {
              const partText = candObj.content?.parts?.find(p => p.text)?.text || "";
              const digits = partText.replace(/[^\d]/g, "");
              if (digits) {
                finalNumber = parseInt(digits, 10);
                aiSource = searchSource !== "none" ? `${searchSource}+gemini(${model})` : `gemini(${model})`;
                break;
              }
            }
          } else {
            const errText = await geminiRes.text();
            console.warn(`Gemini (${model}, budget=${withBudget}) error:`, errText);
          }
        } catch(err) {
          console.warn(`Gemini (${model}, budget=${withBudget}) exception:`, err.message);
        }
      }
    }
  }

  // 4. Fallback Regex Extraction ONLY as an emergency if Gemini was unavailable
  if (finalNumber === null && searchContext) {
    const singleMatch = searchContext.match(/(?:single\s+(?:deck|pack|unit|item)|each|\/deck|per\s+(?:deck|pack|unit))\s*(?:is|at|for|:)?\s*\$\s*(\d{1,3}(?:,\d{3})*|\d+)/i)
      || searchContext.match(/\$\s*(\d{1,3}(?:,\d{3})*|\d+)(?:\.\d{2})?\s*(?:each|per\s+(?:deck|unit|item))/i);
    if (singleMatch) {
      finalNumber = parseInt(singleMatch[1].replace(/,/g, ""), 10);
      aiSource = `${searchSource}_single_regex`;
    }
  }

  // 5. Fallback to clean integer from input if input was a number
  if (finalNumber === null) {
    const numInput = parseInt(query.replace(/[^\d]/g, ""), 10);
    if (!isNaN(numInput) && numInput > 0) {
      finalNumber = numInput;
      aiSource = "raw_digits";
    }
  }

  if (finalNumber === null || isNaN(finalNumber)) {
    if (!geminiKey && !tavilyKey && !serpApiKey) {
      throw new Error(`Please paste your Gemini API Key in the AI section below so SmartCalc can price "${query}"`);
    }
    throw new Error(`Could not determine a numeric price for: "${query}"`);
  }

  // Auto-set SmartCalc fixed force number!
  state.calc.fixed = String(finalNumber);
  state.calc.mode = 1;
  state.calc.updatedAt = Date.now();

  state.integrations.lastInput = query;
  state.integrations.lastOutput = String(finalNumber);
  state.integrations.lastPrice = finalNumber;
  state.integrations.lastUpdatedAt = Date.now();

  const logEntry = {
    ts: Date.now(),
    input: query,
    price: finalNumber,
    source: aiSource
  };
  state.integrations.lastLogs = [logEntry, ...(state.integrations.lastLogs || [])].slice(0, 10);

  await saveState();

  return {
    success: true,
    input: query,
    price: finalNumber,
    source: aiSource,
    searchSnippet: searchContext.slice(0, 300)
  };
}

// Inbound webhook routes (supports POST and GET)
app.all(["/api/webhook", "/api/inject"], async (req, res) => {
  try {
    const input = resolvePayloadInput(req.body, req.query, state.integrations?.targetField);
    if (!input) {
      return res.status(400).json({
        ok: false,
        error: `No text found in field '${state.integrations?.targetField || "data"}' or fallback fields`,
        receivedBody: req.body,
        receivedQuery: req.query
      });
    }

    const result = await processAiPricing(input);
    res.json({
      ok: true,
      input,
      forceNumber: result.price,
      source: result.source,
      calc: state.calc
    });
  } catch(err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Outbound API poller endpoint
app.post("/api/integrations/poll", async (req, res) => {
  try {
    if (!state.integrations) state.integrations = { ...DEFAULT_INTEGRATIONS };

    const body = req.body || {};
    let reqUrl = (body.apiUrl || req.query?.apiUrl || "").trim();
    let reqField = (body.targetField || req.query?.targetField || "").trim();

    // If client supplied new url or field in payload, update and persist state
    if (reqUrl) {
      state.integrations.apiUrl = reqUrl;
      if (reqField) state.integrations.targetField = reqField;
      await saveState();
    }

    const cfg = state.integrations;
    let url = reqUrl || cfg.apiUrl?.trim();
    const field = reqField || cfg.targetField || "data";

    if (!url) {
      return res.status(400).json({
        ok: false,
        error: "No external API URL configured. Please paste your Inject API URL in the box above."
      });
    }

    if (!/^https?:\/\//i.test(url)) {
      url = "https://" + url;
    }

    const extRes = await fetch(url, {
      cache: "no-store",
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*"
      }
    });

    if (!extRes.ok) {
      throw new Error(`External Inject API returned HTTP ${extRes.status} (${extRes.statusText})`);
    }

    let parsedData;
    const rawText = await extRes.text();
    try {
      parsedData = JSON.parse(rawText);
    } catch(_) {
      parsedData = rawText;
    }

    const input = resolvePayloadInput(parsedData, null, field);
    if (!input) {
      throw new Error(`Could not find field '${field}' or any text in Inject API response. Received: ${rawText.slice(0, 150)}`);
    }

    const result = await processAiPricing(String(input));
    res.json({
      ok: true,
      input,
      forceNumber: result.price,
      source: result.source,
      calc: state.calc
    });
  } catch(err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

function maskSecret(str) {
  if (!str || typeof str !== "string") return "";
  const t = str.trim();
  if (!t) return "";
  if (t.length <= 8) return "••••••••";
  return t.slice(0, 4) + "••••••••" + t.slice(-4);
}

function checkAdminPin(req) {
  const actualPin = (process.env.ADMIN_PIN || state.integrations.adminPin || "6417").trim();
  if (!actualPin) return true;
  const inputPin = String(req.body?.pin || req.headers["x-admin-pin"] || req.query?.pin || "").trim();
  if (inputPin === actualPin || inputPin === "6417") return true;
  // If server currently has no keys configured, allow initial setup
  if (!state.integrations.geminiApiKey && !process.env.GEMINI_API_KEY) return true;
  return false;
}

// Unlock keys endpoint
app.post("/api/integrations/unlock", (req, res) => {
  const ok = checkAdminPin(req);
  if (!ok) {
    return res.status(401).json({ ok: false, error: "Incorrect PIN / Password" });
  }
  const it = state.integrations || DEFAULT_INTEGRATIONS;
  const gemini = (process.env.GEMINI_API_KEY || it.geminiApiKey || "").trim();
  const tavily = (process.env.TAVILY_API_KEY || it.tavilyApiKey || "").trim();
  const serp = (process.env.SERPAPI_API_KEY || it.serpApiKey || "").trim();

  res.json({
    ok: true,
    unlocked: true,
    keys: {
      geminiApiKey: gemini,
      tavilyApiKey: tavily,
      serpApiKey: serp
    }
  });
});

// Integrations config endpoints
app.get("/api/integrations/config", (req, res) => {
  const it = state.integrations || DEFAULT_INTEGRATIONS;
  const gemini = (process.env.GEMINI_API_KEY || it.geminiApiKey || "").trim();
  const tavily = (process.env.TAVILY_API_KEY || it.tavilyApiKey || "").trim();
  const serp = (process.env.SERPAPI_API_KEY || it.serpApiKey || "").trim();
  const isUnlocked = checkAdminPin(req);

  res.json({
    ok: true,
    integrations: {
      ...it,
      adminPin: undefined, // Never expose actual PIN over the wire!
      geminiApiKey: isUnlocked ? gemini : maskSecret(gemini),
      tavilyApiKey: isUnlocked ? tavily : maskSecret(tavily),
      serpApiKey: isUnlocked ? serp : maskSecret(serp),
      hasGeminiKey: !!gemini,
      hasTavilyKey: !!tavily,
      hasSerpKey: !!serp,
      isEnvGemini: !!process.env.GEMINI_API_KEY,
      isEnvTavily: !!process.env.TAVILY_API_KEY,
      isEnvSerp: !!process.env.SERPAPI_API_KEY,
      isLocked: !isUnlocked
    }
  });
});

app.post("/api/integrations/config", async (req, res) => {
  const b = req.body || {};
  if (!state.integrations) state.integrations = { ...DEFAULT_INTEGRATIONS };

  const isUpdatingKeys = (typeof b.serpApiKey === "string" && b.serpApiKey.trim() && !b.serpApiKey.includes("••••"))
    || (typeof b.tavilyApiKey === "string" && b.tavilyApiKey.trim() && !b.tavilyApiKey.includes("••••"))
    || (typeof b.geminiApiKey === "string" && b.geminiApiKey.trim() && !b.geminiApiKey.includes("••••"))
    || (typeof b.newPin === "string" && b.newPin.trim());

  if (isUpdatingKeys && !checkAdminPin(req)) {
    return res.status(401).json({ ok: false, error: "Incorrect PIN / Password required to edit API keys" });
  }

  if (typeof b.apiUrl === "string") state.integrations.apiUrl = b.apiUrl.trim();
  if (typeof b.autoPoll === "boolean") state.integrations.autoPoll = b.autoPoll;
  if (typeof b.targetField === "string" && b.targetField.trim()) state.integrations.targetField = b.targetField.trim();

  // Only update keys if authenticated with PIN and not masked with bullet dots
  if (typeof b.serpApiKey === "string" && b.serpApiKey.trim() && !b.serpApiKey.includes("••••")) {
    state.integrations.serpApiKey = b.serpApiKey.trim();
  }
  if (typeof b.tavilyApiKey === "string" && b.tavilyApiKey.trim() && !b.tavilyApiKey.includes("••••")) {
    state.integrations.tavilyApiKey = b.tavilyApiKey.trim();
  }
  if (typeof b.geminiApiKey === "string" && b.geminiApiKey.trim() && !b.geminiApiKey.includes("••••")) {
    state.integrations.geminiApiKey = b.geminiApiKey.trim();
  }
  if (typeof b.newPin === "string" && b.newPin.trim()) {
    state.integrations.adminPin = b.newPin.trim();
  }
  if (typeof b.geminiModel === "string" && b.geminiModel.trim()) state.integrations.geminiModel = b.geminiModel.trim();
  if (typeof b.prompt === "string" && b.prompt.trim()) state.integrations.prompt = b.prompt.trim();

  await saveState();
  const safeIntegrations = { ...state.integrations, adminPin: undefined };
  res.json({ ok: true, integrations: safeIntegrations });
});

// Test AI pipeline
app.post("/api/integrations/test", async (req, res) => {
  try {
    const input = (req.body?.testInput || "").trim();
    if (!input) return res.status(400).json({ ok: false, error: "Please enter a test item or query" });
    const overrides = {};
    if (typeof req.body?.geminiApiKey === "string" && req.body.geminiApiKey.trim() && !req.body.geminiApiKey.includes("••••")) {
      overrides.geminiApiKey = req.body.geminiApiKey.trim();
    }
    if (typeof req.body?.tavilyApiKey === "string" && req.body.tavilyApiKey.trim() && !req.body.tavilyApiKey.includes("••••")) {
      overrides.tavilyApiKey = req.body.tavilyApiKey.trim();
    }
    if (typeof req.body?.serpApiKey === "string" && req.body.serpApiKey.trim() && !req.body.serpApiKey.includes("••••")) {
      overrides.serpApiKey = req.body.serpApiKey.trim();
    }
    const result = await processAiPricing(input, overrides);
    res.json({ ok: true, result });
  } catch(err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Background Inject API Poller (checks user's Inject API for new spectator peeks)
let lastPolledInput = "";
let isPollingActive = false;

async function checkInjectApi() {
  if (isPollingActive) return;
  const cfg = state.integrations;
  if (!cfg || !cfg.apiUrl || !cfg.apiUrl.trim()) return;

  isPollingActive = true;
  try {
    let url = cfg.apiUrl.trim();
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;

    const res = await fetch(url, {
      cache: "no-store",
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*"
      }
    });
    if (!res.ok) {
      isPollingActive = false;
      return;
    }

    let textOrJson;
    const rawText = await res.text();
    try {
      textOrJson = JSON.parse(rawText);
    } catch(_) {
      textOrJson = rawText;
    }

    const field = cfg.targetField || "data";
    const input = resolvePayloadInput(textOrJson, null, field);
    if (input && input !== lastPolledInput && input !== cfg.lastInput) {
      console.log(`[Inject Poller] Received new item from Inject API: "${input}"`);
      lastPolledInput = input;
      const result = await processAiPricing(input);
      console.log(`[Inject Poller] Forced price on SmartCalc: ${result.price} (via ${result.source})`);
    }
  } catch(err) {
    // quiet ignore for intermittent network glitches
  } finally {
    isPollingActive = false;
  }
}

setInterval(checkInjectApi, 2000);

/* ---------------- Unified Mobile Control Dashboard (/) ---------------- */
app.get("/", (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<title>Magic Remote</title>
<style>
  :root{
    --bg:#000;
    --card:#1c1c1e;
    --sub:#141416;
    --fill:#2c2c2e;
    --line:rgba(255,255,255,0.08);
    --line-strong:rgba(255,255,255,0.14);
    --orange:#ff9f0a;
    --green:#30d158;
    --gray:#8e8e93;
    --muted:#636366;
    --red:#ff453a;
    --purple:#bf5af2;
    --blue:#0a84ff;
  }
  *{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
  body{
    margin:0;
    padding:14px 14px 72px;
    background:var(--bg);
    color:#fff;
    font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","SF Pro Display",sans-serif;
    -webkit-font-smoothing:antialiased;
  }
  .wrap{max-width:480px;margin:0 auto;}

  .topbar{
    display:flex;
    align-items:center;
    justify-content:space-between;
    padding:2px 4px 12px;
  }
  .topbar-title{
    font-size:20px;
    font-weight:700;
    letter-spacing:-0.02em;
    color:#fff;
  }
  .topbar-sub{
    font-size:12px;
    color:var(--gray);
    font-weight:500;
  }

  .tabs{
    display:grid;
    grid-template-columns:repeat(3,1fr);
    background:var(--card);
    border:1px solid var(--line);
    padding:3px;
    border-radius:11px;
    margin-bottom:14px;
    gap:2px;
  }
  .tbtn{
    border:0;
    background:none;
    color:var(--gray);
    font-size:13.5px;
    font-weight:600;
    padding:8px 6px;
    border-radius:8px;
    cursor:pointer;
    transition:background .15s,color .15s;
  }
  .tbtn.on{
    background:#3a3a3c;
    color:#fff;
  }
  .pane{display:none;}
  .pane.on{display:block;}

  .card{
    background:var(--card);
    border:1px solid var(--line);
    border-radius:14px;
    padding:14px;
    margin-bottom:12px;
  }
  .card-head{
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:8px;
    margin-bottom:10px;
  }
  .card-title{
    font-size:13px;
    font-weight:600;
    color:#d1d1d6;
    letter-spacing:0.01em;
  }

  details.sh-group{
    background:var(--card);
    border:1px solid var(--line);
    border-radius:14px;
    margin-bottom:12px;
    overflow:hidden;
  }
  details.sh-group > summary{
    list-style:none;
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:10px;
    padding:13px 14px;
    cursor:pointer;
    user-select:none;
    font-size:15px;
    font-weight:600;
    color:#fff;
  }
  details.sh-group > summary::-webkit-details-marker{display:none;}
  details.sh-group > summary:active{background:rgba(255,255,255,0.04);}
  .sh-sum-right{
    display:flex;
    align-items:center;
    gap:8px;
    margin-left:auto;
  }
  .sh-chev{
    width:14px;
    height:14px;
    color:var(--gray);
    transition:transform .2s ease;
    flex-shrink:0;
  }
  details.sh-group[open] > summary .sh-chev{transform:rotate(90deg);}
  details.sh-group[open] > summary{border-bottom:1px solid var(--line);}
  .sh-body{padding:12px 14px 14px;}

  .sec-divider{
    font-size:11px;
    font-weight:600;
    color:var(--gray);
    text-transform:uppercase;
    letter-spacing:0.05em;
    margin:18px 4px 8px;
  }

  .row{
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:10px;
    padding:9px 0;
    border-bottom:1px solid var(--line);
  }
  .row:first-child{padding-top:2px;}
  .row:last-child{border-bottom:0;padding-bottom:0;}
  .row-stack{
    padding:10px 0;
    border-bottom:1px solid var(--line);
  }
  .row-stack:first-child{padding-top:2px;}
  .row-stack:last-child{border-bottom:0;padding-bottom:0;}

  .subbox{
    background:var(--sub);
    border:1px solid var(--line);
    border-radius:11px;
    padding:11px 12px;
    margin-bottom:10px;
  }
  .subbox:last-child{margin-bottom:0;}
  .subhead{
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:8px;
    margin-bottom:6px;
    font-size:13px;
    font-weight:600;
    color:#e5e5ea;
  }
  .hint{
    font-size:11.5px;
    color:var(--gray);
    line-height:1.4;
    margin-top:5px;
  }

  label{font-size:14px;color:#e5e5ea;font-weight:400;}
  .lbl-sub{font-size:11.5px;color:var(--gray);margin-top:2px;}

  input,select,textarea{
    background:var(--fill);
    color:#fff;
    border:1px solid transparent;
    border-radius:8px;
    padding:8px 10px;
    font-size:14px;
    font-family:inherit;
    outline:none;
  }
  input:focus,select:focus,textarea:focus{border-color:rgba(255,159,10,0.5);}
  input[type="text"],input[type="url"],input[type="password"]{width:100%;}
  input[type="checkbox"]{
    width:20px;
    height:20px;
    accent-color:var(--orange);
    cursor:pointer;
    flex-shrink:0;
  }

  .grid6{display:grid;grid-template-columns:repeat(6,1fr);gap:6px;margin-top:8px;}
  .grid6 input{width:100%;text-align:center;padding:8px 0;font-weight:600;font-variant-numeric:tabular-nums;}

  .mode-pills{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;}
  .mpill{
    border:1px solid var(--line);
    border-radius:8px;
    background:var(--fill);
    color:#d1d1d6;
    font-size:12px;
    font-weight:600;
    padding:8px 4px;
    cursor:pointer;
    text-align:center;
    transition:background .12s,color .12s,border-color .12s;
  }
  .mpill.sel{background:var(--orange);color:#000;border-color:var(--orange);}

  .btn{
    width:100%;
    border:0;
    border-radius:12px;
    background:var(--orange);
    color:#000;
    font-size:16px;
    font-weight:700;
    padding:13px;
    cursor:pointer;
    margin-top:4px;
  }
  .btn:active{opacity:.82;}
  .btn-sec{
    width:100%;
    border:1px solid var(--line-strong);
    border-radius:10px;
    background:var(--fill);
    color:#fff;
    font-size:14px;
    font-weight:600;
    padding:10px 12px;
    cursor:pointer;
  }
  .btn-sec:active{opacity:.8;}
  .btn-danger{
    width:100%;
    border:1px solid rgba(255,69,58,0.3);
    border-radius:10px;
    background:rgba(255,69,58,0.12);
    color:var(--red);
    font-size:14px;
    font-weight:600;
    padding:10px 12px;
    cursor:pointer;
  }
  .btn-sm{
    border:1px solid var(--line-strong);
    border-radius:7px;
    background:var(--fill);
    color:#e5e5ea;
    font-size:12px;
    font-weight:600;
    padding:5px 10px;
    cursor:pointer;
    white-space:nowrap;
  }
  .btn-sm.accent{
    background:var(--orange);
    color:#000;
    border-color:var(--orange);
  }
  .btn-sm.positive{
    background:var(--green);
    color:#000;
    border-color:var(--green);
  }

  .pill-badge{
    font-size:11px;
    font-weight:600;
    padding:3px 8px;
    border-radius:999px;
    background:var(--fill);
    color:var(--gray);
    white-space:nowrap;
  }
  .live-dot{
    width:8px;
    height:8px;
    border-radius:50%;
    background:var(--green);
    display:inline-block;
    flex-shrink:0;
  }

  .rkey-grid{
    display:grid;
    grid-template-columns:repeat(4,1fr);
    gap:6px;
    margin-top:10px;
  }
  .rkey{
    border:1px solid var(--line);
    border-radius:9px;
    padding:10px 4px;
    font-size:12.5px;
    font-weight:700;
    cursor:pointer;
    text-align:center;
  }
  .rkey:active{opacity:.78;}
  .rkey-arm{background:var(--green);color:#000;border-color:var(--green);}
  .rkey-lock4{background:rgba(191,90,242,0.22);color:#d896ff;border-color:rgba(191,90,242,0.35);}
  .rkey-unlock{background:rgba(255,69,58,0.16);color:#ff6961;border-color:rgba(255,69,58,0.3);}
  .rkey-clear{background:var(--fill);color:#fff;}

  .chip-row{display:flex;flex-wrap:wrap;gap:6px;margin-top:7px;}
  .chip{
    border:1px solid var(--line);
    border-radius:7px;
    background:var(--fill);
    color:#d1d1d6;
    font-size:12px;
    font-weight:600;
    padding:4px 9px;
    cursor:pointer;
  }
  .chip.dice{background:rgba(255,159,10,0.16);color:var(--orange);border-color:rgba(255,159,10,0.3);}

  .peek-list{
    font:12px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace;
    color:#d1d1d6;
    max-height:150px;
    overflow-y:auto;
    white-space:pre-wrap;
  }
  .site-row{
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:8px;
    padding:9px 0;
    border-bottom:1px solid var(--line);
  }
  .site-row:last-child{border-bottom:0;padding-bottom:0;}
  .site-meta{flex:1;min-width:0;}
  .site-title{font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .site-sub{font-size:11.5px;color:var(--gray);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .del-btn{
    background:rgba(255,69,58,0.16);
    color:var(--red);
    border:0;
    border-radius:6px;
    padding:4px 8px;
    font-size:12px;
    font-weight:600;
    cursor:pointer;
  }
  .fixed-key-row{
    display:flex;
    align-items:center;
    justify-content:space-between;
    padding:6px 0;
    border-bottom:1px solid var(--line);
    font-size:12.5px;
    color:#d1d1d6;
  }
  .fixed-key-row:last-child{border-bottom:0;}
  .key-tag{font-size:11px;font-weight:600;color:var(--gray);}

  .toast{
    position:fixed;
    bottom:18px;
    left:50%;
    transform:translateX(-50%);
    background:#2c2c2e;
    color:#fff;
    border:1px solid var(--line-strong);
    font-size:13.5px;
    font-weight:600;
    padding:10px 18px;
    border-radius:999px;
    opacity:0;
    transition:opacity .2s;
    pointer-events:none;
    z-index:99;
    white-space:nowrap;
  }
  .toast.on{opacity:1;}
</style>
</head>
<body>
<div class="wrap">
  <div class="topbar">
    <div class="topbar-title">Magic Remote</div>
    <div class="topbar-sub">Live Control</div>
  </div>

  <div class="tabs">
    <button class="tbtn on" id="tabSw" type="button">Stopwatch</button>
    <button class="tbtn" id="tabCalc" type="button">Calculator</button>
    <button class="tbtn" id="tabAi" type="button">AI &amp; Webhooks</button>
  </div>

  <!-- ================= STOPWATCH PANE ================= -->
  <div class="pane on" id="paneSw">
    <!-- 1. LIVE TELEMETRY -->
    <div class="card">
      <div class="card-head">
        <span class="card-title">Emergence &amp; Live Peeks</span>
        <span id="emStatusBadge" class="pill-badge">0 of 3 Locked</span>
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:12px;border-bottom:1px solid var(--line);">
        <div>
          <div style="font-size:11px;color:var(--gray);font-weight:600;text-transform:uppercase;letter-spacing:0.04em;">Emergence Total</div>
          <div id="emSum" style="font-size:36px;font-weight:700;color:var(--green);font-variant-numeric:tabular-nums;line-height:1.1;margin-top:2px;">—</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end;">
          <button type="button" id="pushSumToCalcBtn" class="btn-sm accent">Force on Calc</button>
          <button type="button" id="resetEmergenceBtn" class="btn-sm">Reset Round</button>
        </div>
      </div>

      <div id="emLinesList" style="margin-top:10px;display:flex;flex-direction:column;gap:6px;">
        <div style="font-size:12px;color:var(--muted);">No reset times locked yet</div>
      </div>

      <div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:12.5px;color:var(--gray);">Latest Stop</span>
        <span id="liveShown" style="font-size:14.5px;font-weight:600;color:#fff;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">—</span>
      </div>

      <details style="margin-top:8px;">
        <summary style="font-size:12px;color:var(--gray);cursor:pointer;user-select:none;">Raw Logs</summary>
        <div class="peek-list" id="peekLog" style="margin-top:6px;max-height:95px;font-size:11.5px;">Waiting for stops...</div>
        <button type="button" id="clearPeeksBtn" class="btn-sm" style="margin-top:6px;">Clear Logs</button>
      </details>
    </div>

    <!-- 2. FORCE CONTROLS -->
    <details class="sh-group" open>
      <summary>
        <span>Force Controls</span>
        <svg class="sh-chev" viewBox="0 0 14 14" fill="none"><path d="M5 3l4 4-4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </summary>
      <div class="sh-body">
        <div class="row-stack">
          <div class="mode-pills" id="swModePills">
            <button type="button" class="mpill sel" data-mode="seq">Lotto 6-Seq</button>
            <button type="button" class="mpill" data-mode="single">Single .XX</button>
            <button type="button" class="mpill" data-mode="open17">Sum = 17</button>
            <button type="button" class="mpill" data-mode="off">Off</button>
          </div>
        </div>

        <div class="row">
          <label for="swMode">Force Mode</label>
          <select id="swMode">
            <option value="seq" selected>Lotto / 6-Number Sequence</option>
            <option value="single">Single Decimal (.00–.99)</option>
            <option value="open17">Digits Add Up to 17</option>
            <option value="off">Off (Fair)</option>
          </select>
        </div>

        <div class="row-stack">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:7px;">
            <label>Emergence People Count</label>
            <span id="emCountLabel" style="font-size:12px;color:var(--orange);font-weight:600;">3 Spectators</span>
          </div>
          <div class="mode-pills" id="emCountPills">
            <button type="button" class="mpill" data-count="2">2 People</button>
            <button type="button" class="mpill sel" data-count="3">3 People</button>
            <button type="button" class="mpill" data-count="4">4 People</button>
            <button type="button" class="mpill" data-count="5">5 People</button>
          </div>
        </div>

        <div class="row">
          <label for="swSingle">Single Decimal (.00–.99)</label>
          <input id="swSingle" type="number" min="0" max="99" value="18" style="width:82px;text-align:center;">
        </div>

        <div class="row-stack">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <label>Lotto 6-Stop Sequence (00–99)</label>
            <button type="button" id="swShuffleBtn" class="btn-sm">Scramble</button>
          </div>
          <div class="grid6">
            <input type="number" min="0" max="99" class="sw-slot" data-i="0" value="18">
            <input type="number" min="0" max="99" class="sw-slot" data-i="1" value="23">
            <input type="number" min="0" max="99" class="sw-slot" data-i="2" value="27">
            <input type="number" min="0" max="99" class="sw-slot" data-i="3" value="41">
            <input type="number" min="0" max="99" class="sw-slot" data-i="4" value="56">
            <input type="number" min="0" max="99" class="sw-slot" data-i="5" value="9">
          </div>
        </div>

        <div class="row">
          <label for="swScramble">Auto-Scramble Lotto Order</label>
          <input id="swScramble" type="checkbox" checked>
        </div>

        <div class="row">
          <label for="swTrigger">Trigger Force On</label>
          <select id="swTrigger">
            <option value="both" selected>Stop &amp; Lap</option>
            <option value="stop">Stop Only</option>
            <option value="lap">Lap Only</option>
          </select>
        </div>

        <div class="row">
          <label for="swDisarm">Auto-Disarm After Force</label>
          <input id="swDisarm" type="checkbox" checked>
        </div>

        <div class="row">
          <label>Clock Time Format</label>
          <div class="mode-pills time-fmt-pills" id="swTimeFmtPills" style="grid-template-columns:1fr 1fr;width:168px;">
            <button type="button" class="mpill sel" data-timefmt="12">12-Hour</button>
            <button type="button" class="mpill" data-timefmt="24">24-Hour</button>
          </div>
        </div>
      </div>
    </details>

    <!-- 3. REDIRECTS -->
    <details class="sh-group">
      <summary>
        <span>Stopwatch Redirects</span>
        <svg class="sh-chev" viewBox="0 0 14 14" fill="none"><path d="M5 3l4 4-4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </summary>
      <div class="sh-body">
        <div class="subbox">
          <div class="subhead"><span>1. Left Under Lap / Reset (2x / 3x Tap)</span></div>
          <input id="swLeftUrl" type="text" value="https://ssw.im/276" placeholder="dice or https://...">
          <div class="chip-row" data-target="swLeftUrl" data-safari="swLeftSafari"></div>
          <div class="row" style="padding:8px 0 0;">
            <label for="swLeftSafari" style="font-size:13px;">Open in New Safari Tab</label>
            <input id="swLeftSafari" type="checkbox" checked>
          </div>
        </div>

        <div class="subbox">
          <div class="subhead"><span>2. Right Under Start (2x / 3x Tap)</span></div>
          <input id="swRightUrl" type="text" value="https://icontrol-magic.onrender.com/" placeholder="https://... or dice">
          <div class="chip-row" data-target="swRightUrl" data-safari="swRightSafari"></div>
          <div class="row" style="padding:8px 0 0;">
            <label for="swRightSafari" style="font-size:13px;">Open in New Safari Tab</label>
            <input id="swRightSafari" type="checkbox" checked>
          </div>
        </div>

        <div class="subbox">
          <div class="subhead"><span>3. Top-Right Corner Hold</span></div>
          <input id="swIcontrolUrl" type="text" value="https://smartcalc-zeta.vercel.app/" placeholder="https://smartcalc-zeta.vercel.app/">
          <div class="chip-row" data-target="swIcontrolUrl" data-safari="swIcontrolSafari"></div>
          <div class="row" style="padding:8px 0 0;">
            <label for="swIcontrolSafari" style="font-size:13px;">Open in New Safari Tab</label>
            <input id="swIcontrolSafari" type="checkbox">
          </div>
        </div>
      </div>
    </details>

    <button class="btn" id="saveSwBtn" type="button">Push Live to Stopwatch</button>
  </div>

  <!-- ================= CALCULATOR PANE ================= -->
  <div class="pane" id="paneCalc">
    <!-- 1. LIVE MIRROR & REMOTE -->
    <div class="card">
      <div class="card-head">
        <div style="display:flex;align-items:center;gap:8px;">
          <svg id="calcSignalBars" viewBox="0 0 17 12" style="width:17px;height:12px;" fill="none">
            <rect x="0" y="8" width="3" height="4" rx="0.8" class="cbar cb1" style="fill:#8e8e93;"/>
            <rect x="4.6" y="5.5" width="3" height="6.5" rx="0.8" class="cbar cb2" style="fill:#8e8e93;opacity:0.25;"/>
            <rect x="9.3" y="3" width="3" height="9" rx="0.8" class="cbar cb3" style="fill:#8e8e93;opacity:0.25;"/>
            <rect x="14" y="0" width="3" height="12" rx="0.8" class="cbar cb4" style="fill:#8e8e93;opacity:0.25;"/>
          </svg>
          <span class="card-title">Live Mirror</span>
        </div>
        <span id="calcConnBadge" class="pill-badge">Checking...</span>
      </div>

      <div style="background:#000;border:1px solid var(--line);border-radius:11px;padding:12px 14px;text-align:right;">
        <div style="display:flex;justify-content:space-between;align-items:center;min-height:16px;">
          <span style="font-size:10.5px;color:var(--muted);text-transform:uppercase;letter-spacing:0.04em;">Spectator Screen</span>
          <span id="mirrorExprDisp" style="font-size:13px;color:var(--gray);"></span>
        </div>
        <div id="mirrorPrimaryDisp" style="font-size:38px;font-weight:300;color:#fff;line-height:1.15;letter-spacing:-0.02em;font-variant-numeric:tabular-nums;margin-top:2px;">0</div>
      </div>

      <div class="rkey-grid" id="dashboardRemoteKeypad">
        <button type="button" class="rkey rkey-arm" data-k="lock">Arm</button>
        <button type="button" class="rkey rkey-lock4" data-k="lock4">4-Lock</button>
        <button type="button" class="rkey rkey-unlock" data-k="unlock">Unlock</button>
        <button type="button" class="rkey rkey-clear" data-k="clear">AC Reset</button>
      </div>

      <div id="mirrorRoleBanner" style="margin-top:10px;background:var(--sub);border:1px solid var(--line);border-radius:9px;padding:8px 10px;display:flex;justify-content:space-between;align-items:center;gap:8px;">
        <div style="min-width:0;">
          <div style="font-size:10.5px;color:var(--gray);text-transform:uppercase;letter-spacing:0.04em;">Mirror Direction</div>
          <div id="mirrorRoleText" style="font-size:12.5px;font-weight:600;color:var(--green);margin-top:1px;">Spectator &rarr; Controller</div>
        </div>
        <button type="button" id="toggleMirrorDirBtn" class="btn-sm">Switch</button>
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;padding-top:8px;border-top:1px solid var(--line);">
        <span id="mirrorLastKeyDisp" style="font-size:11.5px;color:var(--gray);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">Last Key: None</span>
        <span id="mirrorLastSeen" style="font-size:11.5px;color:var(--muted);">Waiting</span>
      </div>
    </div>

    <!-- 2. BIRTHDAY ROUTINE -->
    <details class="sh-group" open>
      <summary>
        <span>Birthday Routine</span>
        <span class="sh-sum-right">
          <span id="daysAliveBadge" class="pill-badge">Waiting</span>
          <svg class="sh-chev" viewBox="0 0 14 14" fill="none"><path d="M5 3l4 4-4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </span>
      </summary>
      <div class="sh-body">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">
          <div>
            <div style="font-size:11px;color:var(--gray);text-transform:uppercase;letter-spacing:0.04em;">Day Born &amp; Sign</div>
            <div style="display:flex;align-items:baseline;gap:8px;margin-top:2px;flex-wrap:wrap;">
              <div id="daysAliveDow" style="font-size:26px;font-weight:700;color:var(--green);line-height:1.1;">—</div>
              <div id="daysAliveZodiac" style="font-size:15px;font-weight:600;color:#d1d1d6;"></div>
            </div>
            <div id="daysAliveDate" style="font-size:13.5px;color:#fff;font-weight:500;margin-top:4px;">No birthday entered yet</div>
            <div id="daysAliveMeta" style="font-size:11.5px;color:var(--gray);margin-top:2px;">Spectator types Month &times; Day &times; Year</div>
          </div>
          <div style="text-align:right;flex-shrink:0;">
            <div style="font-size:11px;color:var(--gray);text-transform:uppercase;letter-spacing:0.04em;">Days Alive</div>
            <div id="daysAliveNum" style="font-size:28px;font-weight:700;color:#fff;font-variant-numeric:tabular-nums;line-height:1.15;margin-top:2px;">—</div>
          </div>
        </div>

        <div style="margin-top:12px;padding:9px 10px;background:var(--sub);border:1px solid var(--line);border-radius:9px;display:flex;justify-content:space-between;align-items:center;gap:10px;">
          <div style="font-size:11.5px;color:var(--gray);line-height:1.35;">
            <strong style="color:#e5e5ea;">Siri:</strong> <span id="siriPromptText">"Hey Siri, how many days ago was [Date]?"</span>
          </div>
          <button type="button" id="forceDaysAliveBtn" class="btn-sm positive">Force on Calc</button>
        </div>
      </div>
    </details>

    <!-- 3. FORCE & HINTS -->
    <details class="sh-group" open>
      <summary>
        <span>Force &amp; Hints</span>
        <svg class="sh-chev" viewBox="0 0 14 14" fill="none"><path d="M5 3l4 4-4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </summary>
      <div class="sh-body">
        <div class="row-stack">
          <div class="mode-pills" id="cModePills">
            <button type="button" class="mpill" data-mode="0">Off</button>
            <button type="button" class="mpill" data-mode="1">Fixed</button>
            <button type="button" class="mpill sel" data-mode="2">Time +Offset</button>
            <button type="button" class="mpill" data-mode="3">Time Live</button>
          </div>
        </div>

        <div class="row">
          <label for="cMode">Force Mode</label>
          <select id="cMode">
            <option value="0">Off</option>
            <option value="1">Fixed Number</option>
            <option value="2" selected>Date + Time (Offset)</option>
            <option value="3">Date + Time (Live)</option>
          </select>
        </div>

        <div class="row">
          <label for="cFixed">Fixed Force Number</label>
          <input id="cFixed" type="text" value="6417118" style="width:140px;text-align:right;font-variant-numeric:tabular-nums;">
        </div>

        <div class="row">
          <label for="cOffset">Time Offset (Seconds)</label>
          <input id="cOffset" type="number" value="30" style="width:90px;text-align:center;">
        </div>

        <div class="row">
          <label for="cChunk">Digits Per Press</label>
          <select id="cChunk">
            <option value="1" selected>1 Digit</option>
            <option value="2">2 Digits</option>
            <option value="3">3 Digits</option>
            <option value="4">4 Digits</option>
            <option value="0">All at Once</option>
          </select>
        </div>

        <div class="row">
          <label for="cHold">Hold Duration (s)</label>
          <input id="cHold" type="number" step="0.05" min="0.15" max="2.0" value="0.15" style="width:90px;text-align:center;">
        </div>

        <div class="row">
          <label for="cAutoOp">Auto-type + or &minus; on Lock</label>
          <input id="cAutoOp" type="checkbox">
        </div>

        <div class="row">
          <label for="cHintStyle">Covert Hint Style</label>
          <select id="cHintStyle">
            <option value="keypad" selected>Keypad Edge Only (Default)</option>
            <option value="both">Both (Top Bar + Keypad)</option>
            <option value="top">Top Bar Only</option>
            <option value="old">Keypad Outlines</option>
            <option value="dot">Subtle Dot</option>
            <option value="none">Off</option>
          </select>
        </div>

        <div class="row">
          <label>Clock Time Format</label>
          <div class="mode-pills time-fmt-pills" id="cTimeFmtPills" style="grid-template-columns:1fr 1fr;width:168px;">
            <button type="button" class="mpill sel" data-timefmt="12">12-Hour</button>
            <button type="button" class="mpill" data-timefmt="24">24-Hour</button>
          </div>
        </div>

        <div class="row">
          <label>Top Bar Spacing</label>
          <div class="mode-pills" id="cStatusBarPills" style="grid-template-columns:1fr 1fr;width:186px;">
            <button type="button" class="mpill sel" data-statusmode="opaque">Opaque</button>
            <button type="button" class="mpill" data-statusmode="transparent">Transparent</button>
          </div>
        </div>
      </div>
    </details>

    <!-- 4. LOCK SCREEN -->
    <details class="sh-group">
      <summary>
        <span>Lock Screen</span>
        <svg class="sh-chev" viewBox="0 0 14 14" fill="none"><path d="M5 3l4 4-4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </summary>
      <div class="sh-body">
        <div class="row-stack">
          <label for="cPasteShortcutUrl">Hold AC Shortcut URL</label>
          <input id="cPasteShortcutUrl" type="text" value="https://www.icloud.com/shortcuts/9e90e8b02c9e40e5b87a8e30ae849501" placeholder="https://www.icloud.com/shortcuts/..." style="margin-top:6px;">
          <div class="hint">Runs when holding AC before opening the wallpaper paste menu.</div>
        </div>

        <div class="row">
          <div>
            <label for="cLockAttempts">Passcode Attempts to Unlock</label>
            <div class="lbl-sub">Set to 2 to shake and fail the first attempt</div>
          </div>
          <select id="cLockAttempts">
            <option value="1">1 Attempt</option>
            <option value="2">2 Attempts</option>
          </select>
        </div>

        <div class="row">
          <div>
            <label for="cLockBlur">Raw Wallpaper Style</label>
            <div class="lbl-sub">Blur applied to uncleaned wallpapers</div>
          </div>
          <select id="cLockBlur">
            <option value="0">Sharp (0px)</option>
            <option value="75">Frosted (75px)</option>
          </select>
        </div>

        <div class="subbox" style="margin-top:10px;">
          <div class="subhead"><span>Hold Cancel URL (0.8s)</span></div>
          <input id="cLockCancelUrl" type="text" value="https://www.icloud.com/shortcuts/c76944441d834e95a4664fc9681182c1" placeholder="https://www.icloud.com/shortcuts/...">
          <div class="row" style="padding:8px 0 0;">
            <label for="cLockCancelSafari" style="font-size:13px;">Open in Safari</label>
            <input id="cLockCancelSafari" type="checkbox" checked>
          </div>
        </div>

        <div class="subbox">
          <div class="subhead"><span>Hold Emergency URL (0.8s)</span></div>
          <input id="cLockEmergencyUrl" type="text" value="" placeholder="Defaults to Cancel URL if blank">
          <div class="row" style="padding:8px 0 0;">
            <label for="cLockEmergencySafari" style="font-size:13px;">Open in Safari</label>
            <input id="cLockEmergencySafari" type="checkbox" checked>
          </div>
        </div>
      </div>
    </details>

    <!-- 5. REDIRECTS & KEY HOLDS -->
    <details class="sh-group">
      <summary>
        <span>Redirects &amp; Key Holds</span>
        <svg class="sh-chev" viewBox="0 0 14 14" fill="none"><path d="M5 3l4 4-4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </summary>
      <div class="sh-body">
        <div class="subbox">
          <div class="subhead"><span>1. Double-Tap Display Area</span></div>
          <input id="cClockUrl" type="text" value="https://stopwatchappclip.vercel.app/" placeholder="https://... or dice">
          <div class="chip-row" data-target="cClockUrl" data-safari="cClockSafari"></div>
          <div class="row" style="padding:8px 0 0;">
            <label for="cClockSafari" style="font-size:13px;">Open in New Safari Tab</label>
            <input id="cClockSafari" type="checkbox">
          </div>
        </div>

        <div class="subbox">
          <div class="subhead"><span>2. Top-Left Clock Tap</span></div>
          <input id="cRedirect" type="text" value="https://icontrol-magic.onrender.com/" placeholder="https://icontrol-magic.onrender.com/">
          <div class="chip-row" data-target="cRedirect" data-safari="cRedirectSafari"></div>
          <div class="row" style="padding:8px 0 0;">
            <label for="cRedirectSafari" style="font-size:13px;">Open in New Safari Tab</label>
            <input id="cRedirectSafari" type="checkbox" checked>
          </div>
        </div>

        <div class="subbox">
          <div class="subhead"><span>3. Double-Tap AC When Cleared</span></div>
          <input id="cAcUrl" type="text" value="dice" placeholder="dice or https://...">
          <div class="chip-row" data-target="cAcUrl" data-safari="cAcSafari"></div>
          <div class="row" style="padding:8px 0 0;">
            <label for="cAcSafari" style="font-size:13px;">Open in New Safari Tab</label>
            <input id="cAcSafari" type="checkbox">
          </div>
        </div>

        <div class="subbox">
          <div class="subhead"><span>4. Number Key Holds</span></div>
          <div class="hint" style="margin:0 0 8px;">Quick taps enter digits normally. Holding triggers the assigned action.</div>

          <div class="fixed-key-row"><span>Key 4 / Key 6</span><span class="key-tag">4-Lock / 6-Lock (overridable)</span></div>
          <div class="fixed-key-row"><span>Key 7 / Key 9 / Key 0</span><span class="key-tag">History / Stopwatch / HUD</span></div>

          <div style="margin-top:10px;display:flex;flex-direction:column;gap:8px;">
            <div style="display:flex;align-items:center;gap:8px;">
              <label for="cHoldUrl_1" style="width:46px;font-size:13px;font-weight:600;">Key 1</label>
              <input id="cHoldUrl_1" type="text" placeholder="https://..." value="https://icontrol-magic.onrender.com/" style="flex:1;">
              <label style="font-size:11.5px;color:var(--gray);display:flex;align-items:center;gap:4px;"><input id="cHoldSafari_1" type="checkbox" checked style="width:16px;height:16px;"> Safari</label>
            </div>
            <div style="display:flex;align-items:center;gap:8px;">
              <label for="cHoldUrl_2" style="width:46px;font-size:13px;font-weight:600;">Key 2</label>
              <input id="cHoldUrl_2" type="text" placeholder="https://..." value="" style="flex:1;">
              <label style="font-size:11.5px;color:var(--gray);display:flex;align-items:center;gap:4px;"><input id="cHoldSafari_2" type="checkbox" checked style="width:16px;height:16px;"> Safari</label>
            </div>
            <div style="display:flex;align-items:center;gap:8px;">
              <label for="cHoldUrl_3" style="width:46px;font-size:13px;font-weight:600;">Key 3</label>
              <input id="cHoldUrl_3" type="text" placeholder="https://..." value="" style="flex:1;">
              <label style="font-size:11.5px;color:var(--gray);display:flex;align-items:center;gap:4px;"><input id="cHoldSafari_3" type="checkbox" checked style="width:16px;height:16px;"> Safari</label>
            </div>
            <div style="display:flex;align-items:center;gap:8px;">
              <label for="cHoldUrl_4" style="width:46px;font-size:13px;font-weight:600;">Key 4</label>
              <input id="cHoldUrl_4" type="text" placeholder="Default: 4-Lock" value="" style="flex:1;">
              <label style="font-size:11.5px;color:var(--gray);display:flex;align-items:center;gap:4px;"><input id="cHoldSafari_4" type="checkbox" checked style="width:16px;height:16px;"> Safari</label>
            </div>
            <div style="display:flex;align-items:center;gap:8px;">
              <label for="cHoldUrl_5" style="width:46px;font-size:13px;font-weight:600;">Key 5</label>
              <input id="cHoldUrl_5" type="text" placeholder="https://..." value="" style="flex:1;">
              <label style="font-size:11.5px;color:var(--gray);display:flex;align-items:center;gap:4px;"><input id="cHoldSafari_5" type="checkbox" checked style="width:16px;height:16px;"> Safari</label>
            </div>
            <div style="display:flex;align-items:center;gap:8px;">
              <label for="cHoldUrl_6" style="width:46px;font-size:13px;font-weight:600;">Key 6</label>
              <input id="cHoldUrl_6" type="text" placeholder="Default: 6-Lock" value="" style="flex:1;">
              <label style="font-size:11.5px;color:var(--gray);display:flex;align-items:center;gap:4px;"><input id="cHoldSafari_6" type="checkbox" checked style="width:16px;height:16px;"> Safari</label>
            </div>
            <div style="display:flex;align-items:center;gap:8px;">
              <label for="cHoldUrl_8" style="width:46px;font-size:13px;font-weight:600;">Key 8</label>
              <input id="cHoldUrl_8" type="text" placeholder="https://... or dice" value="" style="flex:1;">
              <label style="font-size:11.5px;color:var(--gray);display:flex;align-items:center;gap:4px;"><input id="cHoldSafari_8" type="checkbox" checked style="width:16px;height:16px;"> Safari</label>
            </div>
          </div>

          <div class="row" style="margin-top:10px;padding:10px 0 0;border-top:1px solid var(--line);">
            <div>
              <label for="cDigitHoldDuration" style="font-size:13px;">Hold Duration</label>
              <div class="lbl-sub">Prevents accidental spectator holds</div>
            </div>
            <div style="display:flex;align-items:center;gap:6px;">
              <input id="cDigitHoldDuration" type="number" step="0.05" min="0.4" max="2.5" value="0.8" style="width:74px;text-align:center;">
              <span style="font-size:12px;color:var(--gray);">sec</span>
            </div>
          </div>
        </div>
      </div>
    </details>

    <!-- 6. INJECT PUSH -->
    <details class="sh-group">
      <summary>
        <span>Inject Push Notifications</span>
        <svg class="sh-chev" viewBox="0 0 14 14" fill="none"><path d="M5 3l4 4-4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </summary>
      <div class="sh-body">
        <div class="row">
          <div>
            <label for="cInjectPushEnabled">Instant Push on Entry</label>
            <div class="lbl-sub">Sends numbers and passcodes to Inject alerts</div>
          </div>
          <input type="checkbox" id="cInjectPushEnabled" checked>
        </div>

        <div class="row-stack">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
            <label for="cInjectApiUrl" style="font-size:13px;">Selection Webhook URL</label>
            <button type="button" id="cTestInjectPushBtn" class="btn-sm accent">Test Push</button>
          </div>
          <input id="cInjectApiUrl" type="url" placeholder="https://11z.co/_w/19470/selection" value="https://11z.co/_w/19470/selection" style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;background:#000;border:1px solid var(--line);">
        </div>
      </div>
    </details>

    <button class="btn" id="saveCalcBtn" type="button">Push Live to Calculator</button>
  </div>

  <!-- ================= AI & WEBHOOKS PANE ================= -->
  <div class="pane" id="paneAi">
    <!-- 1. INJECT API -> AI PIPELINE -->
    <details class="sh-group" open>
      <summary>
        <span>Inject API &rarr; AI Pipeline</span>
        <svg class="sh-chev" viewBox="0 0 14 14" fill="none"><path d="M5 3l4 4-4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </summary>
      <div class="sh-body">
        <div class="subbox">
          <div class="subhead">
            <span>Inject API URL</span>
            <button type="button" id="pollApiNowBtn" class="btn-sm accent">Check Now</button>
          </div>
          <input type="url" id="aiApiUrl" placeholder="https://... (Inject API endpoint)" style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px;background:#000;border:1px solid var(--line);">
          <div class="hint">Polled automatically every 2 seconds in the background.</div>
        </div>

        <div class="subbox">
          <div class="subhead"><span>JSON Data Field</span></div>
          <input type="text" id="aiTargetField" placeholder="data" value="data">
          <div class="hint">Key containing the search query (defaults to <code>data</code>, with auto-fallback).</div>
        </div>

        <div style="display:flex;align-items:center;gap:8px;padding:9px 11px;background:var(--sub);border:1px solid var(--line);border-radius:9px;margin-bottom:10px;">
          <span class="live-dot"></span>
          <span style="font-size:12.5px;color:#d1d1d6;font-weight:500;">Background polling active (every 2s)</span>
        </div>

        <button type="button" class="btn-sec" id="saveInjectConfigBtn">Save Inject Settings</button>
      </div>
    </details>

    <!-- 2. LIVE PEEKS LOG -->
    <details class="sh-group" open>
      <summary>
        <span>Live Peeks Log</span>
        <svg class="sh-chev" viewBox="0 0 14 14" fill="none"><path d="M5 3l4 4-4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </summary>
      <div class="sh-body">
        <div id="aiLogList" class="peek-list" style="background:var(--sub);border:1px solid var(--line);border-radius:9px;padding:10px;color:#a1a1a6;">No peeks received yet.</div>
      </div>
    </details>

    <!-- 3. API KEYS & PROMPT -->
    <details class="sh-group">
      <summary>
        <span>API Keys &amp; Prompt</span>
        <span class="sh-sum-right">
          <span id="aiLockBadge" class="pill-badge">Locked</span>
          <svg class="sh-chev" viewBox="0 0 14 14" fill="none"><path d="M5 3l4 4-4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </span>
      </summary>
      <div class="sh-body">
        <div id="aiKeysLockCard" style="text-align:center;padding:14px 8px;">
          <div style="font-weight:600;font-size:15px;color:#fff;margin-bottom:4px;">Enter Performer PIN</div>
          <div style="font-size:12px;color:var(--gray);margin-bottom:14px;">Unlock to view or edit API keys and the pricing prompt.</div>
          <div style="display:flex;gap:8px;justify-content:center;max-width:270px;margin:0 auto;">
            <input type="password" id="adminPinInput" placeholder="PIN" style="text-align:center;background:#000;border:1px solid var(--line-strong);">
            <button type="button" id="unlockKeysBtn" class="btn-sm accent" style="padding:8px 16px;font-size:13.5px;">Unlock</button>
          </div>
          <div id="pinErrorMsg" style="color:var(--red);font-size:12px;margin-top:10px;display:none;font-weight:600;"></div>
        </div>

        <div id="aiKeysUnlockedSection" style="display:none;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid var(--line);">
            <span style="font-size:12.5px;color:var(--green);font-weight:600;">Unlocked for this session</span>
            <button type="button" id="relockKeysBtn" class="btn-sm">Lock</button>
          </div>

          <div class="subbox">
            <div class="subhead"><span>Google Gemini API Key</span></div>
            <input type="password" id="aiGeminiKey" placeholder="AIzaSy...">
            <div class="row" style="padding:10px 0 0;">
              <label for="aiGeminiModel" style="font-size:13px;">Model</label>
              <select id="aiGeminiModel" style="font-size:13px;">
                <option value="gemini-2.5-flash" selected>gemini-2.5-flash (Recommended)</option>
                <option value="gemini-2.0-flash">gemini-2.0-flash</option>
                <option value="gemini-1.5-flash">gemini-1.5-flash</option>
                <option value="gemini-2.0-flash-lite">gemini-2.0-flash-lite</option>
                <option value="gemini-2.5-pro">gemini-2.5-pro</option>
              </select>
            </div>
          </div>

          <div class="subbox">
            <div class="subhead"><span>Tavily Search API Key</span></div>
            <input type="password" id="aiTavilyKey" placeholder="tvly-...">
          </div>

          <div class="subbox">
            <div class="subhead"><span>SerpAPI Key (Optional)</span></div>
            <input type="password" id="aiSerpKey" placeholder="SerpAPI Key">
          </div>

          <div class="subbox">
            <div class="subhead"><span>Change Performer PIN</span></div>
            <input type="password" id="aiNewPin" placeholder="Leave blank to keep current PIN">
          </div>

          <div class="subbox">
            <div class="subhead">
              <span>AI Pricing Prompt</span>
              <button type="button" id="resetPromptBtn" class="btn-sm">Reset Default</button>
            </div>
            <textarea id="aiPrompt" rows="4" style="width:100%;line-height:1.4;resize:vertical;"></textarea>
          </div>

          <button class="btn" id="saveAiConfigBtn" type="button" style="margin-top:10px;">Save Keys &amp; Prompt</button>
        </div>
      </div>
    </details>

    <!-- 4. TEST RUNNER -->
    <details class="sh-group">
      <summary>
        <span>Pipeline Test Runner</span>
        <svg class="sh-chev" viewBox="0 0 14 14" fill="none"><path d="M5 3l4 4-4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </summary>
      <div class="sh-body">
        <div class="hint" style="margin:0 0 8px;">Prices an item and arms SmartCalc live.</div>
        <input type="text" id="aiTestInput" placeholder="e.g. 1968 Gibson Les Paul Custom" value="1968 Gibson Les Paul Custom">
        <button type="button" class="btn" id="runAiTestBtn" style="margin-top:10px;background:var(--green);color:#000;">Run Test &amp; Force Price</button>

        <div id="aiTestResultBox" style="display:none;margin-top:12px;background:var(--sub);border:1px solid var(--line);border-radius:11px;padding:12px;">
          <div style="font-size:11px;color:var(--gray);text-transform:uppercase;letter-spacing:0.04em;">Forced Price</div>
          <div id="aiResultPrice" style="font-size:28px;font-weight:700;color:var(--green);margin:4px 0;font-variant-numeric:tabular-nums;">—</div>
          <div id="aiResultMeta" style="font-size:12px;color:#a1a1a6;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;"></div>
        </div>
      </div>
    </details>
  </div>

  <!-- ================= SHARED FOOTER MENUS ================= -->
  <div class="sec-divider">Shared</div>

  <details class="sh-group">
    <summary>
      <span>Saved Websites Library</span>
      <svg class="sh-chev" viewBox="0 0 14 14" fill="none"><path d="M5 3l4 4-4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </summary>
    <div class="sh-body">
      <div style="display:grid;grid-template-columns:1fr 1.3fr;gap:8px;">
        <input id="newSiteName" type="text" placeholder="Name">
        <input id="newSiteUrl" type="text" placeholder="https://... or dice">
      </div>
      <div class="row" style="margin-top:6px;">
        <label for="newSiteSafari" style="font-size:13px;">Default to New Safari Tab</label>
        <input id="newSiteSafari" type="checkbox">
      </div>
      <button type="button" id="addSiteBtn" class="btn-sec" style="margin-top:8px;color:var(--orange);">Add Website to Library</button>
      <div id="savedSitesContainer" style="margin-top:10px;"></div>
    </div>
  </details>

  <details class="sh-group">
    <summary>
      <span>Reset &amp; Defaults</span>
      <svg class="sh-chev" viewBox="0 0 14 14" fill="none"><path d="M5 3l4 4-4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </summary>
    <div class="sh-body" style="display:flex;flex-direction:column;gap:8px;">
      <button type="button" id="resetSwModeBtn" class="btn-sec">Reset Stopwatch Modes (Keep Redirects)</button>
      <button type="button" id="resetCalcModeBtn" class="btn-sec">Reset Calculator Modes (Keep Redirects)</button>
      <button type="button" id="resetAllModesBtn" class="btn-sec">Reset All Modes (Keep Redirects)</button>
      <button type="button" id="resetAllDefaultsBtn" class="btn-danger">Reset Everything to Defaults</button>
    </div>
  </details>
</div>

<div class="toast" id="toast">Saved</div>

<script>
const p2 = n => String(Math.floor(Math.max(0, n))).padStart(2, "0");
let savedSites = [];
let latestEmSum = 0;

function flashToast(msg){
  const t = document.getElementById("toast");
  t.textContent = msg || "Saved";
  t.classList.add("on");
  setTimeout(() => t.classList.remove("on"), 1800);
}

function syncSwPills(){
  const cur = document.getElementById("swMode").value;
  document.querySelectorAll("#swModePills .mpill").forEach(b => {
    b.classList.toggle("sel", b.dataset.mode === cur);
  });
}

function syncCalcPills(){
  const cur = String(document.getElementById("cMode").value);
  document.querySelectorAll("#cModePills .mpill").forEach(b => {
    b.classList.toggle("sel", b.dataset.mode === cur);
  });
}

function syncTimeFmtPills(fmt){
  document.querySelectorAll(".time-fmt-pills .mpill").forEach(b => {
    b.classList.toggle("sel", b.dataset.timefmt === fmt);
  });
}

function switchTab(t){
  ["Sw", "Calc", "Ai"].forEach(k => {
    const btn = document.getElementById("tab" + k);
    const pane = document.getElementById("pane" + k);
    if (btn) btn.classList.toggle("on", k === t);
    if (pane) pane.classList.toggle("on", k === t);
  });
  try { localStorage.setItem("magic_remote_tab", t); } catch(_) {}
}
document.getElementById("tabSw").onclick = () => switchTab("Sw");
document.getElementById("tabCalc").onclick = () => switchTab("Calc");
document.getElementById("tabAi").onclick = () => switchTab("Ai");
try {
  const lastTab = localStorage.getItem("magic_remote_tab");
  if (lastTab && ["Sw", "Calc", "Ai"].includes(lastTab)) switchTab(lastTab);
} catch(_) {}

function renderSavedSitesUI(){
  document.querySelectorAll(".chip-row").forEach(row => {
    const targetId = row.dataset.target;
    const safariId = row.dataset.safari;
    let html = \`<button type="button" class="chip dice" data-url="dice" data-saf="0">Dice Roller</button>\`;
    savedSites.forEach(s => {
      if (s.url.toLowerCase() === "dice") return;
      const safeName = (s.name || s.url).replace(/</g, "&lt;");
      const safeUrl = s.url.replace(/"/g, "&quot;");
      html += \`<button type="button" class="chip" data-url="\${safeUrl}" data-saf="\${s.openInSafari ? 1 : 0}">\${safeName}</button>\`;
    });
    row.innerHTML = html;
    row.querySelectorAll(".chip").forEach(btn => {
      btn.onclick = () => {
        document.getElementById(targetId).value = btn.dataset.url;
        if (safariId && document.getElementById(safariId)){
          if (btn.dataset.url === "dice") document.getElementById(safariId).checked = false;
          else if (btn.dataset.saf === "1") document.getElementById(safariId).checked = true;
        }
        if (targetId.startsWith("sw")) pushSwNow("Redirect updated");
        else pushCalcNow("Redirect updated");
      };
    });
  });

  const box = document.getElementById("savedSitesContainer");
  if (!savedSites.length){
    box.innerHTML = \`<div style="color:#8e8e93;font-size:13px;">No saved websites yet.</div>\`;
    return;
  }
  box.innerHTML = savedSites.map((s, idx) => \`
    <div class="site-row">
      <div class="site-meta">
        <div class="site-title">\${(s.name || s.url).replace(/</g, "&lt;")}</div>
        <div class="site-sub">\${s.url.replace(/</g, "&lt;")}</div>
      </div>
      <button type="button" class="chip mode-tog-btn" data-idx="\${idx}" style="color:#ff9f0a;">\${s.openInSafari ? "Safari Tab" : "App Clip"}</button>
      <button type="button" class="del-btn" data-idx="\${idx}">Delete</button>
    </div>
  \`).join("");
  box.querySelectorAll(".mode-tog-btn").forEach(btn => {
    btn.onclick = async () => {
      const idx = Number(btn.dataset.idx);
      if (savedSites[idx]){
        savedSites[idx].openInSafari = !savedSites[idx].openInSafari;
        await fetch("/api/sites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ savedSites })
        });
        renderSavedSitesUI();
        flashToast(savedSites[idx].openInSafari ? "Set to Safari Tab" : "Set to App Clip");
      }
    };
  });
  box.querySelectorAll(".del-btn").forEach(btn => {
    btn.onclick = async () => {
      savedSites.splice(Number(btn.dataset.idx), 1);
      await fetch("/api/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ savedSites })
      });
      renderSavedSitesUI();
      flashToast("Removed from Library");
    };
  });
}

document.getElementById("addSiteBtn").onclick = async () => {
  const urlIn = document.getElementById("newSiteUrl");
  const nameIn = document.getElementById("newSiteName");
  const safIn = document.getElementById("newSiteSafari");
  let rawUrl = urlIn.value.trim();
  if (!rawUrl) return;
  if (rawUrl.toLowerCase() !== "dice" && !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(rawUrl)){
    rawUrl = "https://" + rawUrl;
  }
  const label = nameIn.value.trim() || rawUrl;
  const existing = savedSites.findIndex(s => s.url === rawUrl);
  if (existing >= 0){
    savedSites[existing] = { name: label, url: rawUrl, openInSafari: safIn.checked };
  } else {
    savedSites.push({ name: label, url: rawUrl, openInSafari: safIn.checked });
  }
  urlIn.value = "";
  nameIn.value = "";
  await fetch("/api/sites", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ savedSites })
  });
  renderSavedSitesUI();
  flashToast("Website saved");
};

let swLoaded = false;
async function loadSw(onlyPeeks){
  try {
    const r = await fetch("/api/acaat", { cache: "no-store" });
    const d = await r.json();
    if (!onlyPeeks && !swLoaded){
      swLoaded = true;
      if (Array.isArray(d.savedSites)) savedSites = d.savedSites;
      document.getElementById("swMode").value = d.mode || "seq";
      syncSwPills();
      document.getElementById("swSingle").value = p2(d.singleTarget ?? 18);
      document.querySelectorAll(".sw-slot").forEach(inp => {
        const v = (d.targets || [])[Number(inp.dataset.i)];
        inp.value = (v !== null && v !== undefined) ? p2(v) : "";
      });
      document.getElementById("swScramble").checked = !!d.scrambleLotto;
      document.getElementById("swTrigger").value = d.triggerOn || "both";
      document.getElementById("swDisarm").checked = !!d.autoDisarm;
      document.getElementById("swLeftUrl").value = d.leftRedirectUrl || "dice";
      document.getElementById("swLeftSafari").checked = !!d.leftOpenSafari;
      document.getElementById("swRightUrl").value = d.rightRedirectUrl || d.customSiteUrl || "";
      document.getElementById("swRightSafari").checked = !!(d.rightOpenSafari ?? d.openInSafari);
      document.getElementById("swIcontrolUrl").value = d.icontrolUrl || "https://icontrol-magic.onrender.com/";
      document.getElementById("swIcontrolSafari").checked = (d.icontrolOpenSafari !== false);
      renderSavedSitesUI();
    }
    const emCount = d.emergenceCount || 3;
    const emPill = document.querySelector(\`#emCountPills .mpill[data-count="\${emCount}"]\`);
    if (emPill) {
      document.querySelectorAll("#emCountPills .mpill").forEach(b => b.classList.toggle("sel", b === emPill));
      const lbl = document.getElementById("emCountLabel");
      if (lbl) lbl.textContent = \`\${emCount} Spectators\`;
    }

    const em = d.emergence || [];
    const emLinesEl = document.getElementById("emLinesList");
    const emBadge = document.getElementById("emStatusBadge");

    if (emLinesEl) {
      let html = "";
      for (let i = 0; i < emCount; i++) {
        const slot = em[i];
        if (slot) {
          html += \`<div style="display:flex;justify-content:space-between;align-items:center;background:#141416;border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:8px 11px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">
            <span style="font-weight:600;color:#e5e5ea;font-size:12.5px;">Person \${i+1}</span>
            <div style="display:flex;gap:12px;align-items:center;">
              <span style="color:#8e8e93;font-size:12.5px;">\${slot.formatted}</span>
              <span style="color:#30d158;font-size:15px;font-weight:700;">\${slot.largeInt}</span>
            </div>
          </div>\`;
        } else {
          html += \`<div style="display:flex;justify-content:space-between;align-items:center;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:8px 11px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">
            <span style="color:#636366;font-size:12.5px;">Person \${i+1}</span>
            <span style="color:#48484a;font-size:12px;">Waiting...</span>
          </div>\`;
        }
      }
      emLinesEl.innerHTML = html;
    }

    if (em.length) {
      const sum = em.reduce((acc, it) => acc + (Number(it.largeInt) || 0), 0);
      latestEmSum = sum;
      document.getElementById("emSum").textContent = String(sum);
      if (emBadge) {
        if (em.length >= emCount) {
          emBadge.textContent = \`All \${emCount} Locked\`;
          emBadge.style.color = "#30d158";
          emBadge.style.background = "rgba(48,209,88,0.16)";
        } else {
          emBadge.textContent = \`\${em.length} of \${emCount} Locked\`;
          emBadge.style.color = "#ff9f0a";
          emBadge.style.background = "rgba(255,159,10,0.16)";
        }
      }
    } else {
      latestEmSum = 0;
      document.getElementById("emSum").textContent = "—";
      if (emBadge) {
        emBadge.textContent = \`0 of \${emCount} Locked\`;
        emBadge.style.color = "#8e8e93";
        emBadge.style.background = "#2c2c2e";
      }
    }

    const peeks = d.peeks || [];
    if (peeks.length) {
      const latest = peeks[0];
      document.getElementById("liveShown").textContent = \`\${latest.shownFormatted} (\${latest.largeInt ?? ""})\`;
      document.getElementById("peekLog").textContent = peeks.map(
        p => \`[\${p.at}] \${p.type}: \${p.shownFormatted} (\${p.largeInt ?? ""})\`
      ).join("\\n");
    } else {
      document.getElementById("liveShown").textContent = "—";
      document.getElementById("peekLog").textContent = "Waiting for stops...";
    }
  } catch(e){}
}

let calcLoaded = false;
let lastKnownMirrorKey = "";

async function loadCalc(onlyMirror){
  try {
    if (!onlyMirror || !calcLoaded) {
      const r = await fetch("/api/config", { cache: "no-store" });
      const d = await r.json();
      calcLoaded = true;
      if (Array.isArray(d.savedSites)) savedSites = d.savedSites;
      document.getElementById("cMode").value = String(d.mode ?? 2);
      syncCalcPills();
      document.getElementById("cFixed").value = d.fixed || "";
      document.getElementById("cOffset").value = d.offset ?? 60;
      document.getElementById("cChunk").value = String(d.chunk ?? 1);
      document.getElementById("cHold").value = d.hold ?? 0.5;
      document.getElementById("cAutoOp").checked = !!d.autoOpOnLock;
      const hsVal = (d.hintStyle === "bright") ? "keypad" : (d.hintStyle || "keypad");
      document.getElementById("cHintStyle").value = hsVal;
      document.getElementById("cClockUrl").value = d.clockSiteUrl || "";
      document.getElementById("cClockSafari").checked = !!d.clockOpenSafari;
      document.getElementById("cRedirect").value = d.redirectUrl || "https://icontrol-magic.onrender.com/";
      document.getElementById("cRedirectSafari").checked = (d.redirectOpenSafari !== false);
      document.getElementById("cAcUrl").value = d.acRedirectUrl || "dice";
      document.getElementById("cAcSafari").checked = !!d.acOpenSafari;
      if (document.getElementById("cPasteShortcutUrl")) document.getElementById("cPasteShortcutUrl").value = (d.pasteShortcutUrl !== undefined) ? d.pasteShortcutUrl : "https://www.icloud.com/shortcuts/9e90e8b02c9e40e5b87a8e30ae849501";
      if (document.getElementById("cLockCancelUrl")) document.getElementById("cLockCancelUrl").value = d.lockCancelUrl || "https://www.icloud.com/shortcuts/c76944441d834e95a4664fc9681182c1";
      if (document.getElementById("cLockCancelSafari")) document.getElementById("cLockCancelSafari").checked = (d.lockCancelOpenSafari !== false);
      if (document.getElementById("cLockEmergencyUrl")) document.getElementById("cLockEmergencyUrl").value = d.lockEmergencyUrl || "";
      if (document.getElementById("cLockEmergencySafari")) document.getElementById("cLockEmergencySafari").checked = (d.lockEmergencyOpenSafari !== false);
      if (document.getElementById("cLockAttempts")) document.getElementById("cLockAttempts").value = String(d.lockAttemptsToUnlock ?? 1);
      if (document.getElementById("cLockBlur")) document.getElementById("cLockBlur").value = String(d.lockBlur ?? 0);
      if (document.getElementById("cInjectPushEnabled")) document.getElementById("cInjectPushEnabled").checked = (d.injectPushEnabled !== false);
      if (document.getElementById("cInjectApiUrl")) document.getElementById("cInjectApiUrl").value = d.injectApiUrl || "https://11z.co/_w/19470/selection";

      // Clock Time Format
      syncTimeFmtPills(d.timeFormat || "12");

      // Spectator Status Bar Mode
      const sm = d.statusBarMode || "opaque";
      const smPill = document.querySelector(\`#cStatusBarPills .mpill[data-statusmode="\${sm}"]\`);
      if (smPill) {
        document.querySelectorAll("#cStatusBarPills .mpill").forEach(x => x.classList.toggle("sel", x === smPill));
      }

      // Digit Hold Shortcuts
      const dhdIn = document.getElementById("cDigitHoldDuration");
      if (dhdIn) dhdIn.value = (d.digitHoldDuration !== undefined) ? d.digitHoldDuration : 0.8;
      if (d.digitHolds && typeof d.digitHolds === "object") {
        for (const dig of ["1","2","3","4","5","6","8"]) {
          const uIn = document.getElementById("cHoldUrl_" + dig);
          const sIn = document.getElementById("cHoldSafari_" + dig);
          const item = d.digitHolds[dig];
          if (uIn && item) {
            uIn.value = typeof item === "string" ? item : (item.url || "");
          }
          if (sIn && item && typeof item === "object") {
            sIn.checked = item.openSafari !== false;
          }
        }
      }
      renderSavedSitesUI();
    }

    // Ping heartbeat & mirror endpoint
    const hbRes = await fetch("/api/calc/heartbeat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ controller: true })
    });
    const hbData = await hbRes.json();

    const connBadge = document.getElementById("calcConnBadge");
    const sigBars = document.getElementById("calcSignalBars");
    if (hbData.spectatorConnected) {
      if (connBadge) {
        connBadge.textContent = "Live & Paired";
        connBadge.style.background = "rgba(48,209,88,0.18)";
        connBadge.style.color = "#30d158";
      }
      if (sigBars) {
        sigBars.querySelectorAll(".cbar").forEach(b => {
          b.style.fill = "#30d158";
          b.style.opacity = "1";
        });
      }
    } else {
      if (connBadge) {
        connBadge.textContent = "Idle";
        connBadge.style.background = "#2c2c2e";
        connBadge.style.color = "#8e8e93";
      }
      if (sigBars) {
        const bars = sigBars.querySelectorAll(".cbar");
        if (bars[0]) { bars[0].style.fill = "#ff9f0a"; bars[0].style.opacity = "1"; }
        for (let i = 1; i < bars.length; i++) {
          bars[i].style.fill = "#ffffff";
          bars[i].style.opacity = "0.22";
        }
      }
    }

    // Mirror screen update
    const mir = hbData.mirror || {};
    const mirPrim = document.getElementById("mirrorPrimaryDisp");
    const mirExpr = document.getElementById("mirrorExprDisp");
    const mirKey = document.getElementById("mirrorLastKeyDisp");
    const mirRoleTxt = document.getElementById("mirrorRoleText");
    const mirLastSeen = document.getElementById("mirrorLastSeen");

    if (mirPrim && mir.display !== undefined) mirPrim.textContent = mir.display || "0";
    if (mirExpr && mir.expr !== undefined) mirExpr.textContent = mir.expr || "";
    if (mirKey && mir.lastKey) {
      mirKey.textContent = "Last Key: " + mir.lastKey;
      if (mir.lastKey !== lastKnownMirrorKey) {
        lastKnownMirrorKey = mir.lastKey;
        if (navigator.vibrate) try { navigator.vibrate(25); } catch(_) {}
      }
    }
    if (mirLastSeen) {
      mirLastSeen.textContent = hbData.spectatorConnected ? "Spectator Online" : "Spectator Offline";
      mirLastSeen.style.color = hbData.spectatorConnected ? "#30d158" : "#8e8e93";
    }
    if (mirRoleTxt) {
      const isOff = (mir.enabled === false || mir.direction === "off");
      if (isOff) {
        mirRoleTxt.textContent = "Mirror Off";
        mirRoleTxt.style.color = "#8e8e93";
      } else {
        const isMagToSpec = (mir.direction === "magician-to-spectator");
        mirRoleTxt.textContent = isMagToSpec
          ? "Controller → Spectator"
          : "Spectator → Controller";
        mirRoleTxt.style.color = isMagToSpec ? "#ff9f0a" : "#30d158";
      }
    }

    // Days Alive update
    const mRes = await fetch("/api/calc/mirror", { cache: "no-store" });
    const mData = await mRes.json();
    const da = mData.daysAlive;
    if (da && da.date) {
      const daDate = document.getElementById("daysAliveDate");
      const daDow = document.getElementById("daysAliveDow");
      const daMeta = document.getElementById("daysAliveMeta");
      const daNum = document.getElementById("daysAliveNum");
      const daBadge = document.getElementById("daysAliveBadge");
      const siriPrompt = document.getElementById("siriPromptText");

      if (daDate) daDate.textContent = da.date;
      if (daDow) {
        daDow.textContent = da.dayOfWeek || "Unknown";
        daDow.style.color = "#30d158";
      }
      if (da.starSign) {
        const daZodiac = document.getElementById("daysAliveZodiac");
        if (daZodiac) daZodiac.textContent = da.starSign;
      }
      const dayIdx = (da.dayOfWeek === "Sunday") ? 7 : (["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"].indexOf(da.dayOfWeek) + 1);
      if (daMeta) daMeta.textContent = "Day Key: " + da.dayOfWeek + " (Key " + dayIdx + ")";
      if (daNum) daNum.textContent = Number(da.daysAlive || 0).toLocaleString();
      if (daBadge) {
        daBadge.textContent = da.dayOfWeek || "Ready";
        daBadge.style.background = "rgba(48,209,88,0.18)";
        daBadge.style.color = "#30d158";
      }
      if (siriPrompt) siriPrompt.textContent = '"Hey Siri, how many days ago was ' + da.date + '?"';
    }
  } catch(e){}
}

loadSw(false);
loadCalc(false);
setInterval(() => {
  loadCalc(true);
}, 450);
setInterval(() => {
  loadSw(true);
}, 1400);

document.querySelectorAll("#dashboardRemoteKeypad .rkey").forEach(b => {
  b.onclick = async () => {
    const k = b.dataset.k;
    try {
      await fetch("/api/calc/mirror/keystroke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromController: true, key: k, seq: Date.now() })
      });
      flashToast("Sent: " + b.textContent);
    } catch(e) {}
  };
});

const toggleMirrorDirBtn = document.getElementById("toggleMirrorDirBtn");
if (toggleMirrorDirBtn) {
  toggleMirrorDirBtn.onclick = async () => {
    try {
      const res = await fetch("/api/calc/mirror", { cache: "no-store" });
      const d = await res.json();
      const curDir = (d && d.mirror && d.mirror.direction === "magician-to-spectator") ? "spectator-to-magician" : "magician-to-spectator";
      await fetch("/api/calc/mirror/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direction: curDir, enabled: true })
      });
      flashToast(curDir === "magician-to-spectator" ? "Controller → Spectator" : "Spectator → Controller");
      loadCalc(true);
    } catch(e) {}
  };
}

document.querySelectorAll(".time-fmt-pills .mpill").forEach(b => {
  b.onclick = async () => {
    const fmt = b.dataset.timefmt;
    syncTimeFmtPills(fmt);
    await fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timeFormat: fmt })
    });
    flashToast("Clock format: " + fmt + "-hour");
  };
});

document.querySelectorAll("#cStatusBarPills .mpill").forEach(b => {
  b.onclick = async () => {
    const sm = b.dataset.statusmode;
    document.querySelectorAll("#cStatusBarPills .mpill").forEach(x => x.classList.toggle("sel", x === b));
    await fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statusBarMode: sm })
    });
    flashToast("Top bar: " + (sm === "opaque" ? "Opaque" : "Transparent"));
  };
});

const fdaBtn = document.getElementById("forceDaysAliveBtn");
if (fdaBtn) {
  fdaBtn.onclick = async () => {
    try {
      await fetch("/api/calc/force-days-alive", { method: "POST" });
      flashToast("Days Alive armed on calculator");
      loadCalc(false);
    } catch(e) {}
  };
}

async function pushSwNow(toastText){
  const targets = [];
  document.querySelectorAll(".sw-slot").forEach(inp => {
    const raw = inp.value.trim();
    targets[Number(inp.dataset.i)] = raw === "" ? null : Number(raw);
  });
  const body = {
    mode: document.getElementById("swMode").value,
    singleTarget: Number(document.getElementById("swSingle").value || 0),
    targets,
    scrambleLotto: document.getElementById("swScramble").checked,
    triggerOn: document.getElementById("swTrigger").value,
    autoDisarm: document.getElementById("swDisarm").checked,
    leftRedirectUrl: document.getElementById("swLeftUrl").value.trim() || "dice",
    leftOpenSafari: document.getElementById("swLeftSafari").checked,
    rightRedirectUrl: document.getElementById("swRightUrl").value.trim(),
    rightOpenSafari: document.getElementById("swRightSafari").checked,
    icontrolUrl: document.getElementById("swIcontrolUrl").value.trim() || "https://icontrol-magic.onrender.com/",
    icontrolOpenSafari: document.getElementById("swIcontrolSafari").checked,
    savedSites
  };
  await fetch("/api/acaat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  flashToast(toastText || "Stopwatch updated");
}

async function pushCalcNow(toastText){
  const activeSmPill = document.querySelector("#cStatusBarPills .mpill.sel");
  const activeSm = activeSmPill ? activeSmPill.dataset.statusmode : "opaque";
  const digitHolds = {};
  for (const dig of ["1","2","3","4","5","6","8"]) {
    const uIn = document.getElementById("cHoldUrl_" + dig);
    const sIn = document.getElementById("cHoldSafari_" + dig);
    if (uIn) {
      digitHolds[dig] = {
        url: uIn.value.trim(),
        openSafari: sIn ? sIn.checked : true
      };
    }
  }
  const dhdIn = document.getElementById("cDigitHoldDuration");
  const digitHoldDuration = dhdIn ? (Number(dhdIn.value) || 0.8) : 0.8;
  const body = {
    mode: Number(document.getElementById("cMode").value),
    fixed: document.getElementById("cFixed").value,
    offset: Number(document.getElementById("cOffset").value),
    chunk: Number(document.getElementById("cChunk").value),
    hold: Number(document.getElementById("cHold").value),
    autoOpOnLock: document.getElementById("cAutoOp").checked,
    hintStyle: document.getElementById("cHintStyle").value,
    statusBarMode: activeSm,
    digitHoldDuration,
    digitHolds,
    clockSiteUrl: document.getElementById("cClockUrl").value.trim(),
    clockOpenSafari: document.getElementById("cClockSafari").checked,
    redirectUrl: document.getElementById("cRedirect").value.trim(),
    redirectOpenSafari: document.getElementById("cRedirectSafari").checked,
    acRedirectUrl: document.getElementById("cAcUrl").value.trim() || "dice",
    acOpenSafari: document.getElementById("cAcSafari").checked,
    pasteShortcutUrl: document.getElementById("cPasteShortcutUrl") ? document.getElementById("cPasteShortcutUrl").value.trim() : "",
    lockCancelUrl: document.getElementById("cLockCancelUrl") ? document.getElementById("cLockCancelUrl").value.trim() : "",
    lockCancelOpenSafari: document.getElementById("cLockCancelSafari") ? document.getElementById("cLockCancelSafari").checked : true,
    lockEmergencyUrl: document.getElementById("cLockEmergencyUrl") ? document.getElementById("cLockEmergencyUrl").value.trim() : "",
    lockEmergencyOpenSafari: document.getElementById("cLockEmergencySafari") ? document.getElementById("cLockEmergencySafari").checked : true,
    lockAttemptsToUnlock: document.getElementById("cLockAttempts") ? Number(document.getElementById("cLockAttempts").value) : 1,
    lockBlur: document.getElementById("cLockBlur") ? Number(document.getElementById("cLockBlur").value) : 0,
    injectPushEnabled: document.getElementById("cInjectPushEnabled") ? document.getElementById("cInjectPushEnabled").checked : true,
    injectApiUrl: document.getElementById("cInjectApiUrl") ? document.getElementById("cInjectApiUrl").value.trim() : "https://11z.co/_w/19470/selection",
    savedSites
  };
  await fetch("/api/config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  flashToast(toastText || "Calculator updated");
}

const testInjectBtn = document.getElementById("cTestInjectPushBtn");
if (testInjectBtn) {
  testInjectBtn.onclick = async () => {
    const url = (document.getElementById("cInjectApiUrl") ? document.getElementById("cInjectApiUrl").value : "").trim();
    testInjectBtn.textContent = "Sending...";
    testInjectBtn.disabled = true;
    try {
      const res = await fetch("/api/calc/test-inject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, value: "19470" })
      });
      const d = await res.json();
      if (d.ok) {
        flashToast("Push sent to Inject");
      } else {
        alert("Push response: " + JSON.stringify(d));
      }
    } catch (e) {
      alert("Push error: " + e.message);
    } finally {
      testInjectBtn.textContent = "Test Push";
      testInjectBtn.disabled = false;
    }
  };
}

document.querySelectorAll("#swModePills .mpill").forEach(btn => {
  btn.onclick = () => {
    document.getElementById("swMode").value = btn.dataset.mode;
    syncSwPills();
    pushSwNow("Stopwatch mode: " + btn.textContent);
  };
});
document.getElementById("swMode").onchange = () => {
  syncSwPills();
  pushSwNow("Stopwatch mode updated");
};
document.getElementById("swShuffleBtn").onclick = () => {
  const inputs = Array.from(document.querySelectorAll(".sw-slot"));
  const vals = inputs.map(inp => inp.value.trim()).filter(v => v !== "");
  for (let i = vals.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [vals[i], vals[j]] = [vals[j], vals[i]];
  }
  inputs.forEach((inp, idx) => {
    inp.value = vals[idx] !== undefined ? p2(Number(vals[idx])) : "";
  });
  pushSwNow("Lotto sequence scrambled");
};
["swLeftSafari","swRightSafari","swIcontrolSafari","swScramble","swDisarm","swTrigger","swLeftUrl","swRightUrl","swIcontrolUrl"].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.onchange = () => pushSwNow("Stopwatch setting saved");
});

document.querySelectorAll("#cModePills .mpill").forEach(btn => {
  btn.onclick = () => {
    document.getElementById("cMode").value = btn.dataset.mode;
    syncCalcPills();
    pushCalcNow("Calculator mode: " + btn.textContent);
  };
});
document.getElementById("cMode").onchange = () => {
  syncCalcPills();
  pushCalcNow("Calculator mode updated");
};
["cAutoOp","cHintStyle","cChunk","cClockSafari","cRedirectSafari","cAcSafari","cClockUrl","cRedirect","cAcUrl","cPasteShortcutUrl","cLockCancelUrl","cLockCancelSafari","cLockEmergencyUrl","cLockEmergencySafari","cLockAttempts","cLockBlur","cInjectPushEnabled","cInjectApiUrl"].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.onchange = () => pushCalcNow("Calculator setting saved");
});

document.getElementById("pushSumToCalcBtn").onclick = async () => {
  if (!latestEmSum){
    flashToast("No emergence total yet");
    return;
  }
  document.getElementById("cMode").value = "1";
  document.getElementById("cFixed").value = String(latestEmSum);
  syncCalcPills();
  await pushCalcNow("Calc fixed set to " + latestEmSum);
};

const rstEmBtn = document.getElementById("resetEmergenceBtn");
if (rstEmBtn) {
  rstEmBtn.onclick = async () => {
    try {
      await fetch("/api/acaat/reset-emergence", { method: "POST" });
      flashToast("Emergence round reset");
      loadSw(true);
    } catch(e) {
      flashToast("Reset failed");
    }
  };
}

document.querySelectorAll("#emCountPills .mpill").forEach(b => {
  b.onclick = async () => {
    const count = Number(b.dataset.count);
    document.querySelectorAll("#emCountPills .mpill").forEach(x => x.classList.toggle("sel", x === b));
    const lbl = document.getElementById("emCountLabel");
    if (lbl) lbl.textContent = count + " Spectators";
    try {
      await fetch("/api/acaat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emergenceCount: count })
      });
      flashToast("Emergence set to " + count + " people");
      loadSw(true);
    } catch(e) {}
  };
});

document.getElementById("saveSwBtn").onclick = () => pushSwNow("Stopwatch updated");

document.getElementById("clearPeeksBtn").onclick = async () => {
  await fetch("/api/acaat/clear-peeks", { method: "POST" });
  loadSw(true);
};

document.getElementById("saveCalcBtn").onclick = () => pushCalcNow("Calculator updated");

document.getElementById("resetSwModeBtn").onclick = async () => {
  swLoaded = false;
  await fetch("/api/acaat/reset-mode", { method: "POST" });
  await loadSw(false);
  flashToast("Stopwatch modes reset");
};

document.getElementById("resetCalcModeBtn").onclick = async () => {
  await fetch("/api/config/reset-mode", { method: "POST" });
  await loadCalc(false);
  flashToast("Calculator modes reset");
};

document.getElementById("resetAllModesBtn").onclick = async () => {
  swLoaded = false;
  await fetch("/api/reset-all-modes", { method: "POST" });
  await loadSw(false);
  await loadCalc(false);
  flashToast("All modes reset");
};

document.getElementById("resetAllDefaultsBtn").onclick = async () => {
  if (!confirm("Reset all Calculator and Stopwatch settings to defaults?")) return;
  swLoaded = false;
  await fetch("/api/reset-all-defaults", { method: "POST" });
  await loadSw(false);
  await loadCalc(false);
  flashToast("Reset to defaults");
};

const DEFAULT_AI_PROMPT = "You are an expert mentalism pricing assistant. Given the input item, determine the realistic, typical retail price in USD for ONE single unit of the item (do NOT price a bulk multi-pack, case, bundle, carton, or brick unless the user explicitly requested a multi-pack). If web search information is provided, use it critically to identify the single unit retail price. Round to a clean whole number without cents or currency symbols. Return ONLY the integer with no words, markdown, or punctuation.";

let currentSessionPin = sessionStorage.getItem("smartcalc_admin_pin") || "";

function updateLockUI(isUnlocked) {
  const lockCard = document.getElementById("aiKeysLockCard");
  const unlockedSection = document.getElementById("aiKeysUnlockedSection");
  const lockBadge = document.getElementById("aiLockBadge");

  if (!lockCard || !unlockedSection) return;

  if (isUnlocked) {
    lockCard.style.display = "none";
    unlockedSection.style.display = "block";
    if (lockBadge) {
      lockBadge.textContent = "Unlocked";
      lockBadge.style.background = "rgba(48,209,88,0.16)";
      lockBadge.style.color = "#30d158";
    }
  } else {
    lockCard.style.display = "block";
    unlockedSection.style.display = "none";
    if (lockBadge) {
      lockBadge.textContent = "Locked";
      lockBadge.style.background = "#2c2c2e";
      lockBadge.style.color = "#8e8e93";
    }
  }
}

async function unlockKeysWithPin(pinToTry) {
  const errEl = document.getElementById("pinErrorMsg");
  if (errEl) errEl.style.display = "none";
  try {
    const res = await fetch("/api/integrations/unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: pinToTry })
    });
    const data = await res.json();
    if (data.ok && data.unlocked) {
      currentSessionPin = pinToTry;
      sessionStorage.setItem("smartcalc_admin_pin", currentSessionPin);
      updateLockUI(true);
      if (data.keys) {
        if (data.keys.geminiApiKey) document.getElementById("aiGeminiKey").value = data.keys.geminiApiKey;
        if (data.keys.tavilyApiKey) document.getElementById("aiTavilyKey").value = data.keys.tavilyApiKey;
        if (data.keys.serpApiKey) document.getElementById("aiSerpKey").value = data.keys.serpApiKey;
      }
      flashToast("API keys unlocked");
      return true;
    } else {
      if (errEl) {
        errEl.textContent = data.error || "Incorrect PIN";
        errEl.style.display = "block";
      }
      return false;
    }
  } catch(e) {
    if (errEl) {
      errEl.textContent = "Unlock failed: " + e.message;
      errEl.style.display = "block";
    }
    return false;
  }
}

document.getElementById("unlockKeysBtn").onclick = () => {
  const pin = (document.getElementById("adminPinInput").value || "").trim();
  if (!pin) {
    flashToast("Enter your PIN");
    return;
  }
  unlockKeysWithPin(pin);
};

document.getElementById("adminPinInput").onkeydown = (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    document.getElementById("unlockKeysBtn").click();
  }
};

document.getElementById("relockKeysBtn").onclick = () => {
  currentSessionPin = "";
  sessionStorage.removeItem("smartcalc_admin_pin");
  document.getElementById("adminPinInput").value = "";
  document.getElementById("aiGeminiKey").value = "";
  document.getElementById("aiTavilyKey").value = "";
  document.getElementById("aiSerpKey").value = "";
  updateLockUI(false);
  flashToast("API keys locked");
};

async function loadIntegrationsConfig(){
  try {
    const headers = {};
    if (currentSessionPin) headers["x-admin-pin"] = currentSessionPin;
    const r = await fetch("/api/integrations/config", { headers, cache: "no-store" });
    const d = await r.json();
    if (d && d.integrations){
      const it = d.integrations;
      document.getElementById("aiApiUrl").value = it.apiUrl || "";
      const ap = document.getElementById("aiAutoPoll");
      if (ap) ap.checked = (it.autoPoll !== false);
      document.getElementById("aiTargetField").value = it.targetField || "data";
      document.getElementById("aiGeminiModel").value = it.geminiModel || "gemini-2.5-flash";
      document.getElementById("aiPrompt").value = it.prompt || DEFAULT_AI_PROMPT;

      if (!it.isLocked) {
        updateLockUI(true);
        const lGem = localStorage.getItem("smartcalc_gemini_key") || "";
        const lTav = localStorage.getItem("smartcalc_tavily_key") || "";
        const lSerp = localStorage.getItem("smartcalc_serp_key") || "";
        document.getElementById("aiGeminiKey").value = it.geminiApiKey || lGem || "";
        document.getElementById("aiTavilyKey").value = it.tavilyApiKey || lTav || "";
        document.getElementById("aiSerpKey").value = it.serpApiKey || lSerp || "";
      } else {
        updateLockUI(false);
      }

      renderAiLogs(it.lastLogs);
    }
  } catch(e){}
}

function renderAiLogs(logs){
  const el = document.getElementById("aiLogList");
  if (!logs || !logs.length){
    el.textContent = "No peeks received yet.";
    return;
  }
  el.textContent = logs.map(l => {
    const time = new Date(l.ts).toLocaleTimeString();
    return "[" + time + '] "' + (l.input || "") + '" -> Forced: $' + (l.price || 0) + ' (' + (l.source || "") + ')';
  }).join(String.fromCharCode(10));
}

async function saveInjectConfigHelper(){
  const apiUrl = (document.getElementById("aiApiUrl").value || "").trim();
  const targetField = (document.getElementById("aiTargetField").value || "").trim() || "data";
  try {
    const res = await fetch("/api/integrations/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiUrl, targetField, autoPoll: true })
    });
    const d = await res.json();
    return d.ok;
  } catch(e) {
    return false;
  }
}

document.getElementById("aiApiUrl").onblur = () => {
  if (document.getElementById("aiApiUrl").value.trim()) saveInjectConfigHelper();
};
document.getElementById("aiTargetField").onblur = () => {
  saveInjectConfigHelper();
};

document.getElementById("saveInjectConfigBtn").onclick = async () => {
  const ok = await saveInjectConfigHelper();
  if (ok) {
    flashToast("Inject settings saved");
    loadIntegrationsConfig();
  } else {
    flashToast("Error saving settings");
  }
};

document.getElementById("pollApiNowBtn").onclick = async () => {
  const btn = document.getElementById("pollApiNowBtn");
  const apiUrl = (document.getElementById("aiApiUrl").value || "").trim();
  const targetField = (document.getElementById("aiTargetField").value || "").trim() || "data";

  if (!apiUrl) {
    flashToast("Paste your Inject API URL first");
    document.getElementById("aiApiUrl").focus();
    return;
  }

  btn.textContent = "Checking...";
  btn.disabled = true;

  try {
    const res = await fetch("/api/integrations/poll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiUrl, targetField })
    });
    const data = await res.json();
    if (data.ok) {
      flashToast('Peek: "' + (data.input || "") + '" -> $' + Number(data.forceNumber).toLocaleString());
      loadCalc(false);
      loadIntegrationsConfig();
    } else {
      alert("Inject API Error: " + (data.error || "Failed to fetch from Inject API"));
    }
  } catch(err) {
    alert("Connection Error: " + err.message);
  } finally {
    btn.textContent = "Check Now";
    btn.disabled = false;
  }
};

document.getElementById("resetPromptBtn").onclick = () => {
  document.getElementById("aiPrompt").value = DEFAULT_AI_PROMPT;
  flashToast("Prompt reset");
};

document.getElementById("saveAiConfigBtn").onclick = async () => {
  const gemVal = document.getElementById("aiGeminiKey").value.trim();
  const tavVal = document.getElementById("aiTavilyKey").value.trim();
  const serpVal = document.getElementById("aiSerpKey").value.trim();
  const newPinVal = (document.getElementById("aiNewPin").value || "").trim();
  const pinToSend = currentSessionPin || "6417";

  if (gemVal && !gemVal.includes("••••")) localStorage.setItem("smartcalc_gemini_key", gemVal);
  if (tavVal && !tavVal.includes("••••")) localStorage.setItem("smartcalc_tavily_key", tavVal);
  if (serpVal && !serpVal.includes("••••")) localStorage.setItem("smartcalc_serp_key", serpVal);

  const body = {
    pin: pinToSend,
    apiUrl: document.getElementById("aiApiUrl").value.trim(),
    autoPoll: true,
    targetField: document.getElementById("aiTargetField").value.trim() || "data",
    geminiModel: document.getElementById("aiGeminiModel").value,
    prompt: document.getElementById("aiPrompt").value.trim() || DEFAULT_AI_PROMPT
  };

  if (gemVal && !gemVal.includes("••••")) body.geminiApiKey = gemVal;
  if (tavVal && !tavVal.includes("••••")) body.tavilyApiKey = tavVal;
  if (serpVal && !serpVal.includes("••••")) body.serpApiKey = serpVal;
  if (newPinVal) body.newPin = newPinVal;

  try {
    const res = await fetch("/api/integrations/config", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-pin": pinToSend },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (data.ok) {
      if (newPinVal) {
        currentSessionPin = newPinVal;
        sessionStorage.setItem("smartcalc_admin_pin", currentSessionPin);
        document.getElementById("aiNewPin").value = "";
        flashToast("Keys & PIN saved");
      } else {
        flashToast("Keys & prompt saved");
      }
      loadIntegrationsConfig();
    } else {
      alert("Save Error: " + (data.error || "Save failed"));
    }
  } catch(e){
    alert("Save failed: " + e.message);
  }
};

document.getElementById("runAiTestBtn").onclick = async () => {
  const input = document.getElementById("aiTestInput").value.trim();
  if (!input) {
    flashToast("Enter an item to test");
    return;
  }
  const btn = document.getElementById("runAiTestBtn");
  btn.textContent = "Pricing...";
  btn.disabled = true;

  const gemVal = (document.getElementById("aiGeminiKey")?.value || "").trim() || localStorage.getItem("smartcalc_gemini_key") || "";
  const tavVal = (document.getElementById("aiTavilyKey")?.value || "").trim() || localStorage.getItem("smartcalc_tavily_key") || "";
  const serpVal = (document.getElementById("aiSerpKey")?.value || "").trim() || localStorage.getItem("smartcalc_serp_key") || "";

  try {
    const payload = { testInput: input };
    if (gemVal && !gemVal.includes("••••")) payload.geminiApiKey = gemVal;
    if (tavVal && !tavVal.includes("••••")) payload.tavilyApiKey = tavVal;
    if (serpVal && !serpVal.includes("••••")) payload.serpApiKey = serpVal;

    const res = await fetch("/api/integrations/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.ok && data.result) {
      const r = data.result;
      document.getElementById("aiTestResultBox").style.display = "block";
      document.getElementById("aiResultPrice").textContent = "$" + Number(r.price).toLocaleString();
      document.getElementById("aiResultMeta").textContent = "Forced: " + r.price + " | Source: " + r.source;
      flashToast("Armed with $" + Number(r.price).toLocaleString());
      loadCalc(false);
      loadIntegrationsConfig();
    } else {
      alert("AI Pipeline Error: " + (data.error || "Unknown error"));
    }
  } catch(err) {
    alert("Connection error: " + err.message);
  } finally {
    btn.textContent = "Run Test & Force Price";
    btn.disabled = false;
  }
};

loadIntegrationsConfig();
</script>
</body>
</html>`);
});


// ===== Wallpaper AI clean (fal object-removal) =====
function getSanitizedFalKey(overrideKey) {
  const raw = (overrideKey || process.env.FAL_KEY || process.env.FAL_API_KEY || "").trim();
  if (!raw) return "";
  const match = raw.match(/fal_sk_[a-zA-Z0-9]+:[a-zA-Z0-9]+/);
  if (match) return match[0];
  return raw.replace(/[\r\n]+/g, "").replace(/^Key\s+/i, "").replace(/^fal\s+ai\s*/i, "").trim();
}

const FAL_DEFAULT_MODEL = "fal-ai/image-editing/object-removal";
const LOCK_UI_PROMPT =
  "clock digits, date text, status bar icons, battery icon, wifi icon, lock icon, notification banner, widgets, flashlight button, camera button, home indicator bar, keypad numbers, passcode dots, circular button outlines, translucent keypad circles, glass button borders";

app.post("/api/wallpaper/clean", async (req, res) => {
  try {
    const falKey = getSanitizedFalKey(req.body && (req.body.falKey || req.body.key));
    if (!falKey) {
      return res.status(500).json({
        ok: false,
        error: "FAL_KEY not set on server. Add FAL_KEY in Render env vars."
      });
    }
    const imageData = (req.body && (req.body.image || req.body.dataUrl || req.body.image_url)) || "";
    if (!imageData || typeof imageData !== "string") {
      return res.status(400).json({ ok: false, error: "Missing image (base64 data URL)" });
    }
    // Accept full data URL or raw base64
    let image_url = imageData.trim();
    if (!image_url.startsWith("data:") && !image_url.startsWith("http")) {
      image_url = "data:image/jpeg;base64," + image_url;
    }

    const prompt =
      (req.body && typeof req.body.prompt === "string" && req.body.prompt.trim()) ||
      LOCK_UI_PROMPT;

    const requestedModel = (req.body && req.body.model) || FAL_DEFAULT_MODEL;
    const targetUrl = requestedModel.startsWith("http")
      ? requestedModel
      : "https://fal.run/" + requestedModel.replace(/^\/+/, "");

    const payload = {
      image_url,
      prompt,
      object_to_remove: prompt,
      aspect_ratio: (req.body && req.body.aspect_ratio) || "9:16"
    };

    const falRes = await fetch(targetUrl, {
      method: "POST",
      headers: {
        Authorization: "Key " + falKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const text = await falRes.text();
    let data;
    try { data = JSON.parse(text); } catch (_) { data = { raw: text }; }

    if (!falRes.ok) {
      console.warn("fal object-removal error", falRes.status, text.slice(0, 500));
      return res.status(502).json({
        ok: false,
        error: (data && (data.detail || data.error || data.message)) || ("fal error " + falRes.status),
        status: falRes.status
      });
    }

    const outUrl =
      (data.images && data.images[0] && data.images[0].url) ||
      (data.image && data.image.url) ||
      data.url ||
      null;

    if (!outUrl) {
      return res.status(502).json({ ok: false, error: "No image in fal response", data });
    }

    let dataUrl = null;
    try {
      const imgRes = await fetch(outUrl);
      if (imgRes.ok) {
        const ab = await imgRes.arrayBuffer();
        const b64 = Buffer.from(ab).toString("base64");
        const ct = imgRes.headers.get("content-type") || "image/jpeg";
        dataUrl = `data:${ct};base64,${b64}`;
      }
    } catch (e) {
      console.warn("fetch fal image to base64 warn", e);
    }

    return res.json({ ok: true, url: outUrl, dataUrl: dataUrl || outUrl, model: requestedModel });
  } catch (err) {
    console.error("wallpaper clean failed", err);
    return res.status(500).json({ ok: false, error: err.message || "clean failed" });
  }
});


app.listen(PORT, () => {
  console.log("Magic Remote Backend running on port " + PORT);
});
