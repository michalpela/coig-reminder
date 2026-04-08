// background.js – service worker wtyczki COIG Reminder

const TARGET_URL = "https://epp.coig.biz/worktime/holidays/add";
const ALARM_NAME = "coig-reminder-alarm";

// Treści dla każdego typu tygodnia
const WEEK_TYPES = {
  standard: {
    days: "środę i czwartek",
    short: "Śr + Cz",
    next: "friday",
  },
  friday: {
    days: "czwartek i piątek",
    short: "Cz + Pt",
    next: "standard",
  },
};

function oppositeType(t) {
  return t === "standard" ? "friday" : "standard";
}

/* ── Inicjalizacja i restart przeglądarki ───────────────────── */
chrome.runtime.onInstalled.addListener(() => reschedule());
chrome.runtime.onStartup.addListener(() => reschedule());

/* ── Wiadomość z popup.js (po kliknięciu "Zapisz") ─────────── */
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === "reschedule") reschedule();
  if (msg.action === "checkNow") checkAndNotify();
});

/* ── Główna funkcja: zaplanuj alarm na dokładny czas ─────────── */
function reschedule() {
  chrome.storage.sync.get(
    { selectedDay: null, notifyTime: "09:00" },
    (data) => {
      chrome.alarms.clear(ALARM_NAME, () => {
        if (data.selectedDay === null || data.selectedDay === -1) return;

        const when = nextOccurrence(data.selectedDay, data.notifyTime);
        chrome.alarms.create(ALARM_NAME, { when });
        console.log("[COIG] Alarm zaplanowany na:", new Date(when).toString());
      });
    }
  );
}

/**
 * Zwraca timestamp (ms) następnego wystąpienia danego dnia tygodnia i godziny.
 */
function nextOccurrence(targetDay, timeStr) {
  const [hh, mm] = (timeStr || "09:00").split(":").map(Number);
  const now = new Date();

  for (let offset = 0; offset <= 7; offset++) {
    const candidate = new Date(now);
    candidate.setDate(now.getDate() + offset);
    candidate.setHours(hh, mm, 0, 0);

    if (candidate.getDay() === targetDay && candidate.getTime() > Date.now() + 60_000) {
      return candidate.getTime();
    }
  }

  // Fallback: za tydzień o podanej godzinie
  const fallback = new Date(now);
  const daysUntil = (targetDay - now.getDay() + 7) % 7 || 7;
  fallback.setDate(now.getDate() + daysUntil);
  fallback.setHours(hh, mm, 0, 0);
  return fallback.getTime();
}

/* ── Alarm odpala się dokładnie o właściwej porze ───────────── */
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== ALARM_NAME) return;
  checkAndNotify();
  reschedule();
});

/* ── Sprawdź i wyślij powiadomienie ─────────────────────────── */
function checkAndNotify() {
  chrome.storage.sync.get(
    { selectedDay: null, lastNotified: null, notifyTime: "09:00", nextWeekType: "standard" },
    (data) => {
      if (data.selectedDay === null || data.selectedDay === -1) return;

      const now = new Date();
      const todayDay = now.getDay();
      const todayDate = now.toDateString();

      if (todayDay !== data.selectedDay) return;
      if (data.lastNotified === todayDate) return;   // już wysłane dziś

      const weekType = data.nextWeekType || "standard";
      sendNotification(todayDate, weekType);
    }
  );
}

function sendNotification(todayDate, weekType) {
  const wt = WEEK_TYPES[weekType] || WEEK_TYPES.standard;
  const nextType = oppositeType(weekType);
  const nextWt = WEEK_TYPES[nextType];

  chrome.notifications.create("coig-reminder", {
    type: "basic",
    iconUrl: "icons/icon128.png",
    title: "📋 Czas na wniosek o pracę!",
    message: `Wypełnij wniosek na ${wt.days}. \nNastępny tydzień: ${nextWt.short}.`,
    priority: 2,
    requireInteraction: true,
    buttons: [{ title: "Otwórz formularz" }]
  });

  // Zapisz: powiadomiono dziś + przełącz typ na następny tydzień
  chrome.storage.sync.set({
    lastNotified: todayDate,
    nextWeekType: nextType,
  });
}

/* ── Kliknięcie w powiadomienie ─────────────────────────────── */
chrome.notifications.onClicked.addListener((id) => {
  if (id === "coig-reminder") openTarget();
});

chrome.notifications.onButtonClicked.addListener((id, btnIdx) => {
  if (id === "coig-reminder" && btnIdx === 0) openTarget();
});

function openTarget() {
  chrome.tabs.create({ url: TARGET_URL });
  chrome.notifications.clear("coig-reminder");
}
