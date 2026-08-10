import React, { useState } from "react";
import Login from "./components/Login";
import Home from "./pages/Home";

export default function App() {
  const [auth, setAuth] = useState(localStorage.getItem("auth") === "true");

  if (!auth) {
    return <Login onLogin={() => setAuth(true)} />;
  }

  return <Home />;
}