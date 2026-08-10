import React, { useState } from "react";

export default function Login({ onLogin }) {
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  const API_URL = import.meta.env.VITE_API_URL;

  const handleLogin = async (e) => {
    e.preventDefault();

    setErro("");

    if (!senha.trim()) {
      setErro("Digite a senha.");
      return;
    }

    setCarregando(true);

    try {
      const resposta = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          senha: senha.trim(),
        }),
      });

      const dados = await resposta.json();

      if (!resposta.ok || !dados.ok) {
        setErro("Senha incorreta.");
        setCarregando(false);
        return;
      }

      localStorage.setItem("auth", "true");
      onLogin();

    } catch (error) {
      console.error("Erro no login:", error);
      setErro("Não foi possível conectar ao servidor.");
    }

    setCarregando(false);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f1f5f9",
        padding: "20px",
      }}
    >
      <form
        onSubmit={handleLogin}
        style={{
          width: "100%",
          maxWidth: "380px",
          background: "white",
          padding: "30px",
          borderRadius: "16px",
          boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
        }}
      >
        <h2 style={{ marginBottom: "10px" }}>
          Acesso ao sistema
        </h2>

        <p
          style={{
            color: "#64748b",
            marginBottom: "20px",
          }}
        >
          Gestão de EPI
        </p>

        <input
          type="password"
          placeholder="Digite a senha"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          disabled={carregando}
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "12px",
            border: "1px solid #cbd5e1",
            borderRadius: "8px",
            marginBottom: "12px",
          }}
        />

        <button
          type="submit"
          disabled={carregando}
          style={{
            width: "100%",
            padding: "12px",
            border: "none",
            borderRadius: "8px",
            background: "#2563eb",
            color: "white",
            cursor: "pointer",
          }}
        >
          {carregando ? "Entrando..." : "Entrar"}
        </button>

        {erro && (
          <p
            style={{
              color: "#dc2626",
              marginTop: "15px",
              textAlign: "center",
            }}
          >
            {erro}
          </p>
        )}
      </form>
    </div>
  );
}