const FALLBACK_QUOTES = {
  "Motivation": [
    "Start before you feel ready.",
    "Discipline builds the life motivation only imagines.",
    "Small progress today beats perfect plans tomorrow.",
    "Do the hard part first, then breathe.",
    "Consistency is confidence in motion."
  ],
  "Islamic Reminder": [
    "Guard your salah, and your day will find its center.",
    "Sincerity turns small deeds into heavy scales.",
    "Do not delay repentance; your next moment is not promised.",
    "Trust Allah, then honor time with focused effort.",
    "Lower the gaze, protect the heart, and keep your tongue clean."
  ],
  "Study Discipline": [
    "Set a 45-minute focus block and finish one concrete task.",
    "Review your notes the same day; memory fades faster than effort.",
    "Study the hardest topic first while your mind is fresh.",
    "Track hours and outputs, not feelings.",
    "Close extra tabs; single-tasking wins deep work."
  ]
};

const PROMPTS = {
  "Motivation": [
    "Write one short, punchy motivational line.",
    "Maximum 20 words.",
    "No cringe, no cliches, no hashtags.",
    "Return only the quote text."
  ].join(" "),
  "Islamic Reminder": [
    "Write one short Islamic reminder.",
    "Do not fabricate hadith.",
    "Do not attribute to Prophet or any scholar.",
    "No verse numbers.",
    "Keep it a general reminder about salah, sincerity, time, tawakkul, avoiding sin, or self-accountability.",
    "Return only the quote text."
  ].join(" "),
  "Study Discipline": [
    "Write one short quote about study discipline.",
    "Make it practical, focused, and not generic.",
    "Return only the quote text."
  ].join(" ")
};

function normalizeCategory(category) {
  if (!category || typeof category !== "string") return "Motivation";
  if (category in PROMPTS) return category;
  return "Motivation";
}

function pickFallback(category) {
  const list = FALLBACK_QUOTES[category] || FALLBACK_QUOTES["Motivation"];
  return list[Math.floor(Math.random() * list.length)];
}

function sanitizeQuote(text) {
  if (!text) return "";
  let quote = String(text).trim().replace(/\s+/g, " ");
  if ((quote.startsWith("\"") && quote.endsWith("\"")) || (quote.startsWith("'") && quote.endsWith("'"))) {
    quote = quote.slice(1, -1).trim();
  }
  return quote;
}

export default async function handler(req, res) {
  const category = normalizeCategory(req.query.category);
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return res.status(200).json({ quote: pickFallback(category) });
  }

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "llama3-8b-8192",
        temperature: 0.8,
        messages: [
          {
            role: "system",
            content: "You produce exactly one quote line and follow user instructions strictly."
          },
          {
            role: "user",
            content: PROMPTS[category]
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`Groq request failed (${response.status})`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    const quote = sanitizeQuote(content);

    if (!quote) {
      throw new Error("Empty quote from Groq");
    }

    return res.status(200).json({ quote });
  } catch (error) {
    return res.status(200).json({ quote: pickFallback(category) });
  }
}
