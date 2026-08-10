import React, { useState } from "react";

const SENHA = "1234"; // muda aqui depois

export default function Login({ onLogin }) {
  const [senha, setSenha] = useState("");

  const handleLogin = () => {
    if (senha === SENHA) {
      localStorage.setItem("auth", "true");
      onLogin();
    } else {
      alert("Senha incorreta");
    }
  };

  return (
    <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div>
        <h2>Acesso ao sistema</h2>
        <input
          type="password"
          placeholder="Digite a senha"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
        />
        <button onClick={handleLogin}>Entrar</button>
      </div>
    </div>
  );
}