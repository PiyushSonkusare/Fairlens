export async function* streamGeminiAnalysis(
  apiKey: string,
  prompt: string,
  onUpdate?: (text: string) => void
) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to connect to Gemini API');
  }

  const reader = response.body?.getReader();
  if (!reader) return;

  const decoder = new TextDecoder();
  let fullText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    // Gemini streaming format is weird, it's a JSON array bit by bit
    // Actually, usually it's chunks of JSON objects
    // Let's try to parse it simply
    const lines = chunk.split('\n');
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        // The stream is wrapped in [...] so we need to handle the brackets or just find the content
        const cleanedLine = line.replace(/^\[/, '').replace(/,$/, '').replace(/\]$/, '');
        if (!cleanedLine.trim()) continue;
        
        const json = JSON.parse(cleanedLine);
        const textPart = json.candidates?.[0]?.content?.parts?.[0]?.text;
        if (textPart) {
          fullText += textPart;
          onUpdate?.(fullText);
          yield textPart;
        }
      } catch (e) {
        // Partial JSON, skip or wait
        // console.warn('Failed to parse chunk', e);
      }
    }
  }
}
