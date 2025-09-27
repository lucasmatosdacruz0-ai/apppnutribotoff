
export async function handler(event) {
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const prompt = body.prompt || body.text || body.message;
    if (!prompt) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Falta o campo "prompt" no corpo da requisição' })
      };
    }

    // usa fetch global quando disponível, senão tenta importar node-fetch
    const fetchFn = globalThis.fetch ?? (await import('node-fetch')).default;

    const resp = await fetchFn(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GOOGLE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      }
    );

    const data = await resp.json();

    // extrai o texto em formatos prováveis (fallback para JSON inteiro)
    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      data?.candidates?.[0]?.content ||
      data?.output?.[0]?.content?.[0]?.text ||
      JSON.stringify(data);

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, text, raw: data })
    };
  } catch (err) {
    console.error('Error in function /netlify/functions/gemini', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: String(err) })
    };
  }
}
