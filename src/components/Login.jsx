import React, { useState } from "react";

const API_URL = import.meta.env.VITE_API_URL;

export default function Login({ onLogin }) {
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!senha.trim()) {
      alert("Digite a senha.");
      return;
    }

    setCarregando(true);

    try {
      console.log("API:", API_URL);
      console.log("Enviando senha para:", `${API_URL}/login`);

      const response = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          senha: senha.trim(),
        }),
      });

      console.log("Status:", response.status);

      const data = await response.json();

      console.log("Resposta do servidor:", data);

      if (response.ok && data.ok === true) {
        localStorage.setItem("auth", "true");
        onLogin();
      } else {
        alert("Senha incorreta.");
      }
    } catch (error) {
      console.error("ERRO NO LOGIN:", error);
      alert(
        "Não foi possível conectar ao servidor.\n\nVerifique se o backend do Render está funcionando."
      );
    } finally {
      setCarregando(false);
    }
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
          borderRadius: "18px",
          boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
        }}
      >
        <h2
          style={{
            marginTop: 0,
            marginBottom: "10px",
            textAlign: "center",
          }}
        >
          Gestão de EPI
        </h2>

        <p
          style={{
            textAlign: "center",
            color: "#64748b",
            marginBottom: "25px",
          }}
        >
          Digite sua senha para entrar
        </p>

        <input
          type="password"
          placeholder="Digite a senha"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          autoFocus
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "13px",
            border: "1px solid #cbd5e1",
            borderRadius: "10px",
            fontSize: "16px",
            marginBottom: "15px",
          }}
        />

        <button
          type="submit"
          disabled={carregando}
          style={{
            width: "100%",
            padding: "13px",
            border: "none",
            borderRadius: "10px",
            background: carregando ? "#94a3b8" : "#2563eb",
            color: "white",
            fontSize: "16px",
            fontWeight: "bold",
            cursor: carregando ? "not-allowed" : "pointer",
          }}
        >
          {carregando ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}