const quoteEl = document.getElementById("quoteText");
const quoteCategoryEl = document.getElementById("quoteCategory");
const greetingEl = document.getElementById("greeting");
const toastEl = document.getElementById("toast");

const newQuoteBtn = document.getElementById("newQuoteBtn");
const copyBtn = document.getElementById("copyBtn");
const saveFavoriteBtn = document.getElementById("saveFavoriteBtn");
const shareImageBtn = document.getElementById("shareImageBtn");
const toggleFavoritesBtn = document.getElementById("toggleFavoritesBtn");
const clearFavoritesBtn = document.getElementById("clearFavoritesBtn");

const favoritesPanelEl = document.getElementById("favoritesPanel");
const favoritesListEl = document.getElementById("favoritesList");
const favoritesEmptyEl = document.getElementById("favoritesEmpty");

const categoryButtons = Array.from(document.querySelectorAll(".segment-btn"));
const themeButtons = Array.from(document.querySelectorAll(".theme-btn"));

const THEME_KEY = "daily_quote_theme";
const FAVORITES_KEY = "daily_quote_favorites";
const MAX_RECENT_QUOTES = 24;
const MAX_FAVORITES = 120;
const MAX_UNIQUE_FETCH_ATTEMPTS = 4;

const BLOCKED_QUOTE_VALUES = new Set([
  "Loading quote...",
  "Fetching quote...",
  "Unable to load a quote right now. Please try again."
]);

let activeCategory = "Motivation";
let favoritesPanelOpen = false;
let quoteSwapTimeoutId = null;

function todayLocalYMD() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function keyDate(category) {
  return `daily_quote_${category}_date`;
}

function keyText(category) {
  return `daily_quote_${category}_text`;
}

function keyRecent(category) {
  return `daily_quote_${category}_recent`;
}

function sanitizeQuote(value) {
  if (!value) return "";
  let text = String(value).trim().replace(/\s+/g, " ");

  if ((text.startsWith("\"") && text.endsWith("\"")) || (text.startsWith("'") && text.endsWith("'"))) {
    text = text.slice(1, -1).trim();
  }

  return text;
}

function canonicalizeQuote(value) {
  return sanitizeQuote(value).toLowerCase();
}

function greetingForHour(hour) {
  if (hour < 12) return "Good morning, Fuhad";
  if (hour < 17) return "Good afternoon, Fuhad";
  return "Good evening, Fuhad";
}

function setGreeting() {
  if (!greetingEl) return;
  const now = new Date();
  const hour = now.getHours();
  const dateText = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric"
  });
  greetingEl.textContent = `${greetingForHour(hour)} \u2022 ${dateText}`;
}

function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.add("show");
  window.clearTimeout(showToast.timeoutId);
  showToast.timeoutId = window.setTimeout(() => {
    toastEl.classList.remove("show");
  }, 1500);
}

function animateQuoteText(text) {
  const nextText = sanitizeQuote(text);
  window.clearTimeout(quoteSwapTimeoutId);
  quoteEl.classList.remove("swap-in");
  quoteEl.classList.add("swap-out");

  quoteSwapTimeoutId = window.setTimeout(() => {
    quoteEl.textContent = nextText;
    quoteEl.classList.remove("swap-out");
    quoteEl.classList.add("swap-in");
    updateSaveButtonState(nextText);
  }, 130);
}

function setCategoryUI(category) {
  activeCategory = category;
  quoteCategoryEl.textContent = category;
  categoryButtons.forEach((button) => {
    const isActive = button.dataset.category === category;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });
}

function setTheme(theme) {
  const validTheme = ["warm", "light", "night"].includes(theme) ? theme : "warm";
  document.body.dataset.theme = validTheme;
  localStorage.setItem(THEME_KEY, validTheme);

  themeButtons.forEach((button) => {
    const isActive = button.dataset.theme === validTheme;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });
}

function setLoadingState(isLoading) {
  newQuoteBtn.disabled = isLoading;
  shareImageBtn.disabled = isLoading;
  categoryButtons.forEach((btn) => {
    btn.disabled = isLoading;
  });

  if (isLoading) {
    saveFavoriteBtn.disabled = true;
  } else {
    updateSaveButtonState();
  }
}

function getCurrentQuoteText() {
  const text = sanitizeQuote(quoteEl.textContent);
  if (!text || BLOCKED_QUOTE_VALUES.has(text)) return "";
  return text;
}

function parseJSONFromStorage(key, fallbackValue) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallbackValue;
    const value = JSON.parse(raw);
    return value ?? fallbackValue;
  } catch (error) {
    return fallbackValue;
  }
}

function getRecentQuotes(category) {
  const value = parseJSONFromStorage(keyRecent(category), []);
  if (!Array.isArray(value)) return [];
  return value.map((item) => sanitizeQuote(item)).filter(Boolean);
}

function isQuoteInRecent(category, quote) {
  const canonical = canonicalizeQuote(quote);
  if (!canonical) return false;
  return getRecentQuotes(category).some((item) => canonicalizeQuote(item) === canonical);
}

function pushRecentQuote(category, quote) {
  const cleanQuote = sanitizeQuote(quote);
  if (!cleanQuote) return;

  const canonical = canonicalizeQuote(cleanQuote);
  const existing = getRecentQuotes(category).filter((item) => canonicalizeQuote(item) !== canonical);
  const updated = [...existing, cleanQuote].slice(-MAX_RECENT_QUOTES);
  localStorage.setItem(keyRecent(category), JSON.stringify(updated));
}

function getFavorites() {
  const value = parseJSONFromStorage(FAVORITES_KEY, []);
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => ({
      id: String(item.id || ""),
      text: sanitizeQuote(item.text),
      category: sanitizeQuote(item.category) || "Motivation",
      date: sanitizeQuote(item.date) || todayLocalYMD()
    }))
    .filter((item) => item.id && item.text);
}

function setFavorites(favorites) {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites.slice(0, MAX_FAVORITES)));
}

function formatCategoryKey(category) {
  return category.toLowerCase().replace(/\s+/g, "_");
}

function isQuoteSavedInFavorites(quote, category) {
  const clean = sanitizeQuote(quote);
  if (!clean) return false;
  const canonical = canonicalizeQuote(clean);

  return getFavorites().some((item) => {
    return item.category === category && canonicalizeQuote(item.text) === canonical;
  });
}

function updateSaveButtonState(quoteCandidate = quoteEl.textContent) {
  const quote = sanitizeQuote(quoteCandidate);
  const hasSavableQuote = quote && !BLOCKED_QUOTE_VALUES.has(quote);

  if (!hasSavableQuote) {
    saveFavoriteBtn.classList.remove("is-saved");
    saveFavoriteBtn.textContent = "Save";
    if (!newQuoteBtn.disabled) {
      saveFavoriteBtn.disabled = true;
    }
    return;
  }

  const saved = isQuoteSavedInFavorites(quote, activeCategory);
  saveFavoriteBtn.classList.toggle("is-saved", saved);
  saveFavoriteBtn.textContent = saved ? "Saved \u2605" : "Save";
  if (!newQuoteBtn.disabled) {
    saveFavoriteBtn.disabled = false;
  }
}

function renderFavorites() {
  const favorites = getFavorites();
  favoritesListEl.innerHTML = "";

  toggleFavoritesBtn.textContent = `Favorites (${favorites.length})`;
  favoritesEmptyEl.style.display = favorites.length ? "none" : "block";

  favorites.forEach((item) => {
    const listItem = document.createElement("li");
    listItem.className = "favorite-item";
    listItem.dataset.id = item.id;

    const textEl = document.createElement("p");
    textEl.className = "favorite-text";
    textEl.textContent = item.text;

    const metaEl = document.createElement("div");
    metaEl.className = "favorite-meta";
    metaEl.textContent = `${item.category} | ${item.date}`;

    const actionsEl = document.createElement("div");
    actionsEl.className = "favorite-actions";

    const copyActionBtn = document.createElement("button");
    copyActionBtn.type = "button";
    copyActionBtn.className = "btn btn-small";
    copyActionBtn.dataset.action = "copy";
    copyActionBtn.textContent = "Copy";

    const removeActionBtn = document.createElement("button");
    removeActionBtn.type = "button";
    removeActionBtn.className = "btn btn-small";
    removeActionBtn.dataset.action = "remove";
    removeActionBtn.textContent = "Remove";

    actionsEl.append(copyActionBtn, removeActionBtn);
    listItem.append(textEl, metaEl, actionsEl);
    favoritesListEl.appendChild(listItem);
  });

  updateSaveButtonState();
}

function setFavoritesPanelOpen(nextOpen) {
  favoritesPanelOpen = Boolean(nextOpen);
  favoritesPanelEl.classList.toggle("open", favoritesPanelOpen);
  favoritesPanelEl.setAttribute("aria-hidden", String(!favoritesPanelOpen));
  toggleFavoritesBtn.setAttribute("aria-expanded", String(favoritesPanelOpen));
}

function saveCurrentToFavorites() {
  const quote = getCurrentQuoteText();
  if (!quote) {
    showToast("No quote to save");
    return;
  }

  const favorites = getFavorites();
  const alreadySaved = favorites.some((item) => {
    return canonicalizeQuote(item.text) === canonicalizeQuote(quote) && item.category === activeCategory;
  });

  if (alreadySaved) {
    updateSaveButtonState(quote);
    showToast("Already in favorites");
    return;
  }

  const favorite = {
    id: `${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
    text: quote,
    category: activeCategory,
    date: todayLocalYMD()
  };

  setFavorites([favorite, ...favorites]);
  renderFavorites();
  updateSaveButtonState(quote);
  showToast("Saved");
}

async function fetchQuote(category, excludeQuotes = []) {
  const params = new URLSearchParams();
  params.set("category", category);

  const cleanedExcludes = excludeQuotes.map((item) => sanitizeQuote(item)).filter(Boolean).slice(-8);
  if (cleanedExcludes.length) {
    params.set("exclude", JSON.stringify(cleanedExcludes));
  }

  const response = await fetch(`/api/quote?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Quote request failed (${response.status})`);
  }

  const payload = await response.json();
  const quote = sanitizeQuote(payload.quote);
  if (!quote) {
    throw new Error("Invalid quote payload");
  }

  return quote;
}

async function fetchUniqueQuote(category) {
  const recentQuotes = getRecentQuotes(category);
  let lastQuote = "";
  let excludeQuotes = recentQuotes.slice(-8);

  for (let attempt = 0; attempt < MAX_UNIQUE_FETCH_ATTEMPTS; attempt += 1) {
    const quote = await fetchQuote(category, excludeQuotes);
    lastQuote = quote;

    if (!isQuoteInRecent(category, quote)) {
      return quote;
    }

    excludeQuotes = [...excludeQuotes, quote].slice(-8);
  }

  return lastQuote;
}

async function loadQuoteForCategory(category, options = {}) {
  const { forceNew = false } = options;
  setCategoryUI(category);

  const today = todayLocalYMD();
  const storedDate = localStorage.getItem(keyDate(category));
  const storedText = localStorage.getItem(keyText(category));

  if (!forceNew && storedDate === today && storedText) {
    pushRecentQuote(category, storedText);
    animateQuoteText(storedText);
    return;
  }

  setLoadingState(true);
  animateQuoteText("Fetching quote...");

  try {
    const quote = await fetchUniqueQuote(category);
    localStorage.setItem(keyDate(category), today);
    localStorage.setItem(keyText(category), quote);
    pushRecentQuote(category, quote);
    animateQuoteText(quote);
  } catch (error) {
    if (storedText) {
      pushRecentQuote(category, storedText);
      animateQuoteText(storedText);
      showToast("Using saved quote");
    } else {
      animateQuoteText("Unable to load a quote right now. Please try again.");
    }
  } finally {
    setLoadingState(false);
  }
}

function wrapCanvasText(ctx, text, maxWidth) {
  const words = text.split(/\s+/);
  const lines = [];
  let current = "";

  words.forEach((word) => {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  });

  if (current) lines.push(current);
  return lines;
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function makeQuoteImageBlob(quoteText, category) {
  const size = 1080;
  const padding = 96;
  const cardX = 88;
  const cardY = 88;
  const cardWidth = size - cardX * 2;
  const cardHeight = size - cardY * 2;
  const dateLabel = todayLocalYMD();

  const style = getComputedStyle(document.body);
  const bg = style.getPropertyValue("--bg").trim() || "#F4F3EE";
  const card = style.getPropertyValue("--card").trim() || "#FFFFFF";
  const text = style.getPropertyValue("--text").trim() || "#1F1F1F";
  const muted = style.getPropertyValue("--muted").trim() || "#6B6B6B";
  const border = style.getPropertyValue("--border").trim() || "rgba(0,0,0,0.08)";
  const accent = style.getPropertyValue("--accent").trim() || "#C15F3C";

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("Canvas unavailable"));

  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, bg);
  gradient.addColorStop(1, card);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  drawRoundedRect(ctx, cardX, cardY, cardWidth, cardHeight, 34);
  ctx.fillStyle = card;
  ctx.fill();
  ctx.strokeStyle = border;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = accent;
  ctx.font = "600 32px Inter, sans-serif";
  ctx.fillText(category.toUpperCase(), cardX + padding, cardY + padding);

  ctx.fillStyle = muted;
  ctx.font = "500 26px Inter, sans-serif";
  ctx.fillText(dateLabel, cardX + padding, cardY + padding + 44);

  ctx.fillStyle = text;
  ctx.font = "700 66px Lora, serif";
  const maxTextWidth = cardWidth - padding * 2;
  const lines = wrapCanvasText(ctx, quoteText, maxTextWidth).slice(0, 8);
  const lineHeight = 86;
  const quoteStartY = cardY + padding + 156;

  lines.forEach((line, index) => {
    ctx.fillText(line, cardX + padding, quoteStartY + index * lineHeight);
  });

  ctx.fillStyle = muted;
  ctx.font = "500 26px Inter, sans-serif";
  ctx.fillText("Fuhad Daily Quote  |  Made by Fuhad", cardX + padding, cardY + cardHeight - 72);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Failed to generate image"));
      } else {
        resolve(blob);
      }
    }, "image/png");
  });
}

async function shareCurrentQuoteImage() {
  const quote = getCurrentQuoteText();
  if (!quote) {
    showToast("No quote to share");
    return;
  }

  shareImageBtn.disabled = true;
  try {
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }

    const imageBlob = await makeQuoteImageBlob(quote, activeCategory);
    const fileName = `daily-quote-${formatCategoryKey(activeCategory)}-${todayLocalYMD()}.png`;

    if (typeof File !== "undefined") {
      const imageFile = new File([imageBlob], fileName, { type: "image/png" });
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [imageFile] })) {
        await navigator.share({
          files: [imageFile],
          title: "Fuhad Daily Quote",
          text: quote
        });
        showToast("Shared");
        return;
      }
    }

    const objectUrl = URL.createObjectURL(imageBlob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
    showToast("Image downloaded");
  } catch (error) {
    showToast("Share failed");
  } finally {
    shareImageBtn.disabled = false;
  }
}

categoryButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const category = button.dataset.category;
    if (!category || category === activeCategory) return;
    loadQuoteForCategory(category);
  });
});

themeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const theme = button.dataset.theme;
    if (!theme) return;
    setTheme(theme);
  });
});

newQuoteBtn.addEventListener("click", () => {
  loadQuoteForCategory(activeCategory, { forceNew: true });
});

copyBtn.addEventListener("click", async () => {
  const text = getCurrentQuoteText();
  if (!text) return;

  try {
    await navigator.clipboard.writeText(text);
    showToast("Copied \u2705");
  } catch (error) {
    showToast("Copy failed");
  }
});

saveFavoriteBtn.addEventListener("click", () => {
  saveCurrentToFavorites();
});

shareImageBtn.addEventListener("click", () => {
  shareCurrentQuoteImage();
});

toggleFavoritesBtn.addEventListener("click", () => {
  setFavoritesPanelOpen(!favoritesPanelOpen);
});

clearFavoritesBtn.addEventListener("click", () => {
  const favorites = getFavorites();
  if (!favorites.length) {
    showToast("No favorites to clear");
    return;
  }

  localStorage.removeItem(FAVORITES_KEY);
  renderFavorites();
  showToast("Favorites cleared");
});

favoritesListEl.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const action = target.dataset.action;
  if (!action) return;

  const listItem = target.closest(".favorite-item");
  if (!listItem) return;
  const id = listItem.dataset.id;
  if (!id) return;

  if (action === "remove") {
    const favorites = getFavorites().filter((item) => item.id !== id);
    setFavorites(favorites);
    renderFavorites();
    showToast("Removed");
    return;
  }

  if (action === "copy") {
    const favorite = getFavorites().find((item) => item.id === id);
    if (!favorite) return;

    try {
      await navigator.clipboard.writeText(favorite.text);
      showToast("Copied \u2705");
    } catch (error) {
      showToast("Copy failed");
    }
  }
});

function init() {
  const savedTheme = localStorage.getItem(THEME_KEY) || "warm";
  setGreeting();
  setTheme(savedTheme);
  renderFavorites();
  setFavoritesPanelOpen(false);
  updateSaveButtonState();
  loadQuoteForCategory(activeCategory);
}

init();
