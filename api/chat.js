export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: "Missing ANTHROPIC_API_KEY" });
    }

    const { messages, systemPrompt } = req.body || {};

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 800,
        system: systemPrompt,
        messages
      })
    });

    const data = await anthropicRes.json();

    if (!anthropicRes.ok) {
      return res.status(200).json({
        reply: `Backend error: ${data?.error?.message || "Anthropic request failed"}`
      });
    }

    const text =
      data?.content
        ?.filter(block => block.type === "text")
        ?.map(block => block.text || "")
        ?.join("") || "No response";

    return res.status(200).json({ reply: text });
  } catch (error) {
    return res.status(200).json({
      reply: `Server error: ${error.message}`
    });
  }
}
