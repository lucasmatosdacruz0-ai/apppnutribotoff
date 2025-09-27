import React, { useState } from "react";

export default function App() {
  const [prompt, setPrompt] = useState("");
  const [resposta, setResposta] = useState("");
  const [carregando, setCarregando] = useState(false);

  const enviar = async () => {
    setCarregando(true);
    setResposta("");

    try {
      const resp = await fetch("/.netlify/functions/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt })
      });

      const data = await resp.json();

      if (!resp.ok) {
        setResposta("Erro no servidor: " + (data?.error || JSON.stringify(data)));
      } else if (data?.success) {
        setResposta(data.text || JSON.stringify(data.raw, null, 2));
      } else {
        setResposta(JSON.stringify(data, null, 2));
      }
    } catch (err) {
      console.error(err);
      setResposta("Erro ao conectar com a função serverless.");
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div style={{ padding: 20, fontFamily: "sans-serif" }}>
      <h1>Meu App com Gemini</h1>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Digite sua pergunta..."
        rows={6}
        cols={60}
        style={{ display: "block", marginBottom: 10 }}
      />
      <button onClick={enviar} disabled={carregando} style={{ marginBottom: 10 }}>
        {carregando ? "Enviando..." : "Enviar"}
      </button>
      <pre style={{ whiteSpace: "pre-wrap", background: "#f7f7f7", padding: 10 }}>{resposta}</pre>
    </div>
  );
}
