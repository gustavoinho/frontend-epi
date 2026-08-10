import React, { useState } from "react";

const API_URL = import.meta.env.VITE_API_URL || "https://backend-epi.onrender.com";

export default function Login({ onLogin }) {
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();

    const senhaLimpa = senha.trim();

    if (!senhaLimpa) {
      alert("Digite a senha.");
      return;
    }

    setCarregando(true);

    try {
      console.log("Backend:", API_URL);
      console.log("Enviando login para:", `${API_URL}/login`);

      const response = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          senha: senhaLimpa,
        }),
      });

      const texto = await response.text();

      let data = {};

      try {
        data = JSON.parse(texto);
      } catch {
        console.error("Resposta não-JSON do backend:", texto);
      }

      console.log("Status:", response.status);
      console.log("Resposta:", data);

      if (response.ok && data.ok === true) {
        localStorage.setItem("auth", "true");
        onLogin();
        return;
      }

      if (response.status === 401) {
        alert("Senha incorreta.");
        return;
      }

      alert(
        data.error ||
          `Erro no servidor. Código: ${response.status}`
      );
    } catch (error) {
      console.error("ERRO DE CONEXÃO:", error);

      alert(
        "Não foi possível conectar ao backend.\n\n" +
        "Verifique se o backend do Render está funcionando."
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
          background: "#fff",
          padding: "30px",
          borderRadius: "18px",
          boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
        }}
      >
        <h2
          style={{
            marginTop: 0,
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
          disabled={carregando}
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
            color: "#fff",
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