// popup.js
const TARGET_URL = "https://epp.coig.biz/worktime/holidays/add";

const DAYS = ["Nd", "Pn", "Wt", "Śr", "Cz", "Pt", "So"];

let selectedDay = null;

/* ── Buduj siatkę dni ─────────────────────────────────────── */
const grid = document.getElementById("daysGrid");
const todayIdx = new Date().getDay();

DAYS.forEach((name, idx) => {
  const btn = document.createElement("button");
  btn.className = "day-btn" + (idx === todayIdx ? " today" : "");
  btn.textContent = name;
  btn.dataset.idx = idx;
  btn.addEventListener("click", () => selectDay(idx));
  grid.appendChild(btn);
});

function selectDay(idx) {
  selectedDay = idx;
  document.querySelectorAll(".day-btn").forEach((b) => {
    b.classList.toggle("active", Number(b.dataset.idx) === idx);
  });
}

/* ── Wczytaj ustawienia ───────────────────────────────────── */
chrome.storage.sync.get(
  { selectedDay: null, lastNotified: null, notifyTime: "09:00" },
  (data) => {
    document.getElementById("notifyTime").value = data.notifyTime || "09:00";

    if (data.selectedDay !== null && data.selectedDay !== -1) {
      selectDay(data.selectedDay);
      updateStatus(data.selectedDay, data.lastNotified);
    } else if (data.selectedDay === -1) {
      updateStatus(-1, null);
    } else {
      setStatus(false, "Nie skonfigurowano");
    }
  }
);

/* ── Status ───────────────────────────────────────────────── */
function updateStatus(day, lastNotified) {
  if (day === -1) {
    setStatus(false, "Powiadomienia wyłączone");
    return;
  }
  const dayName  = DAYS[day];
  const todayStr = new Date().toDateString();
  const done     = lastNotified === todayStr && new Date().getDay() === day;

  if (done) {
    setStatus(true, `✓ Wysłano dziś (${dayName})`);
    return;
  }

  // Pokaż kiedy następny alarm
  chrome.alarms.get("coig-reminder-alarm", (alarm) => {
    if (alarm) {
      const d = new Date(alarm.scheduledTime);
      const dateStr = d.toLocaleDateString("pl-PL", { weekday: "long", month: "short", day: "numeric" });
      const timeStr = d.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
      setStatus(true, `Następne: ${dateStr}, ${timeStr}`);
    } else {
      setStatus(true, `Aktywne – każdy ${dayName}`);
    }
  });
}

function setStatus(active, text) {
  const dot  = document.getElementById("dot");
  const span = document.getElementById("statusText");
  dot.className  = "dot " + (active ? "active" : "off");
  span.textContent = text;
}

/* ── Zapisz ───────────────────────────────────────────────── */
document.getElementById("saveBtn").addEventListener("click", () => {
  if (selectedDay === null) {
    showToast("Wybierz najpierw dzień!", "#f87171");
    return;
  }
  const notifyTime = document.getElementById("notifyTime").value || "09:00";
  chrome.storage.sync.set({ selectedDay, notifyTime, lastNotified: null }, () => {
    updateStatus(selectedDay, null);
    showToast("Zapisano ✓");
    // Zaplanuj alarm na nowo z dokładną godziną
    chrome.runtime.sendMessage({ action: "reschedule" }).catch(() => {});
  });
});

/* ── Wyłącz ───────────────────────────────────────────────── */
document.getElementById("disableBtn").addEventListener("click", () => {
  chrome.storage.sync.set({ selectedDay: -1, lastNotified: null }, () => {
    selectedDay = null;
    document.querySelectorAll(".day-btn").forEach(b => b.classList.remove("active"));
    setStatus(false, "Powiadomienia wyłączone");
    showToast("Wyłączono", "#f87171");
  });
});

/* ── Otwórz formularz ─────────────────────────────────────── */
document.getElementById("openBtn").addEventListener("click", () => {
  chrome.tabs.create({ url: TARGET_URL });
});

/* ── Toast ─────────────────────────────────────────────────── */
function showToast(msg, color = "#34d399") {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.style.background = color;
  toast.style.color = color === "#34d399" ? "#0a1a12" : "#fff";
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2000);
}
