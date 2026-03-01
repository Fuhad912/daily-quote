const quoteEl = document.getElementById("quoteText");
const toastEl = document.getElementById("toast");
const newQuoteBtn = document.getElementById("newQuoteBtn");
const copyBtn = document.getElementById("copyBtn");
const categoryButtons = Array.from(document.querySelectorAll(".segment-btn"));

let activeCategory = "Motivation";

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

function setQuoteText(text) {
  quoteEl.textContent = text;
}

function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.add("show");
  window.clearTimeout(showToast.timeoutId);
  showToast.timeoutId = window.setTimeout(() => {
    toastEl.classList.remove("show");
  }, 1400);
}

function setLoadingState(isLoading) {
  newQuoteBtn.disabled = isLoading;
  categoryButtons.forEach((btn) => {
    btn.disabled = isLoading;
  });
}

function sanitizeQuote(value) {
  if (!value) return "";
  let text = String(value).trim();

  if ((text.startsWith("\"") && text.endsWith("\"")) || (text.startsWith("'") && text.endsWith("'"))) {
    text = text.slice(1, -1).trim();
  }

  return text;
}

async function fetchQuote(category) {
  const response = await fetch(`/api/quote?category=${encodeURIComponent(category)}`);
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

async function loadQuoteForCategory(category, forceNew = false) {
  activeCategory = category;

  categoryButtons.forEach((button) => {
    const isActive = button.dataset.category === category;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });

  const today = todayLocalYMD();
  const storedDate = localStorage.getItem(keyDate(category));
  const storedText = localStorage.getItem(keyText(category));

  if (!forceNew && storedDate === today && storedText) {
    setQuoteText(storedText);
    return;
  }

  setLoadingState(true);
  setQuoteText("Fetching quote...");

  try {
    const quote = await fetchQuote(category);
    localStorage.setItem(keyDate(category), today);
    localStorage.setItem(keyText(category), quote);
    setQuoteText(quote);
  } catch (error) {
    if (storedText) {
      setQuoteText(storedText);
      showToast("Using saved quote");
    } else {
      setQuoteText("Unable to load a quote right now. Please try again.");
    }
  } finally {
    setLoadingState(false);
  }
}

categoryButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const category = button.dataset.category;
    if (!category || category === activeCategory) return;
    loadQuoteForCategory(category);
  });
});

newQuoteBtn.addEventListener("click", () => {
  loadQuoteForCategory(activeCategory, true);
});

copyBtn.addEventListener("click", async () => {
  const text = quoteEl.textContent ? quoteEl.textContent.trim() : "";
  if (!text || text === "Fetching quote..." || text === "Loading quote...") return;

  try {
    await navigator.clipboard.writeText(text);
    showToast("Copied \u2705");
  } catch (error) {
    showToast("Copy failed");
  }
});

loadQuoteForCategory(activeCategory);

