const STRATS = [
  "Moving average trend", "Support and resistance", "RSI momentum", "MACD crossover",
  "Bollinger Bands", "Volume and breakout", "Candlestick patterns", "Fibonacci retracement",
  "Chart patterns (triangles, H&S, flags)", "Market structure (HH / HL)"
];

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(500).json({ error: "Server is missing GEMINI_API_KEY" });

  const { image, symbol, tf } = req.body || {};
  if (!image || !symbol) return res.status(400).json({ error: "Missing chart or symbol" });

  const list = STRATS.map((s, i) => `${i + 1}. ${s}`).join("\n");
  const prompt = `Market: ${symbol}. Timeframe: ${tf}.

Analyze this trading chart through each of these ${STRATS.length} strategy lenses, judging each independently:
${list}

For each lens return:
- signal: "BUY", "SELL", or "HOLD"
- confidence: integer 0-100
- reason: at most 15 words
- entry_y, stop_y, target_y: fractions of image height (0 = top edge, 1 = bottom edge), or null for HOLD.
  For BUY, target_y is above entry_y (smaller) and stop_y is below (larger). For SELL, the reverse.

Return ONLY valid JSON, no markdown, in this exact shape:
{"strategies":[{"name":"...","signal":"BUY","confidence":0,"reason":"...","entry_y":0.5,"stop_y":0.6,"target_y":0.4}]}`;

  try {
    const r = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [{ parts: [
            { inline_data: { mime_type: "image/jpeg", data: image } },
            { text: prompt }
          ] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.2 }
        })
      }
    );
    const data = await r.json();
    if (!r.ok) return res.status(502).json({ error: data?.error?.message || "Gemini request failed" });

    const text = (data?.candidates?.[0]?.content?.parts || []).map(p => p.text || "").join("");
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean.slice(clean.indexOf("{"), clean.lastIndexOf("}") + 1));
    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({ error: "Analysis failed: " + err.message });
  }
};
