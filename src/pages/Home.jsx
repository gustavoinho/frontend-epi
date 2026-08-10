import React, { useEffect, useState } from "react";
import { api } from "../api/api";

export default function Home() {
  const [items, setItems] = useState([]);
  const [tab, setTab] = useState("epi");
  const [search, setSearch] = useState("");

  const load = async () => {
    const data = await api.getItems(search);
    setItems(data);
  };

  useEffect(() => {
    load();
  }, [search]);

  const filtered = items.filter(i => i.tipo === tab);

  return (
    <div style={{ padding: 20 }}>
      {/* 🔝 ABAS */}
      <div style={{ display: "flex", gap: 10 }}>
        {["epi", "material", "uniforme"].map(t => (
          <button key={t} onClick={() => setTab(t)}>
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      {/* 🔍 BUSCA GLOBAL */}
      <input
        placeholder="Buscar por nome ou CA..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ marginTop: 10 }}
      />

      {/* 📦 LISTA */}
      {filtered.map(item => (
        <div key={item.id} style={{ border: "1px solid #ccc", marginTop: 10, padding: 10 }}>
          <b>{item.nome}</b> ({item.quantidade})

          {item.ca && <div>CA: {item.ca}</div>}
          {item.observacoes && <div>Obs: {item.observacoes}</div>}

          <div style={{ marginTop: 5 }}>
            <button onClick={async () => {
              await api.updateQty(item.id, 1);
              load();
            }}>➕</button>

            <button onClick={async () => {
              await api.updateQty(item.id, -1);
              load();
            }}>➖</button>

            <button onClick={async () => {
              const nome = prompt("Novo nome", item.nome);
              if (!nome) return;

              await api.updateItem(item.id, { ...item, nome });
              load();
            }}>✏️</button>

            <button onClick={async () => {
              if (confirm("Excluir item?")) {
                await api.deleteItem(item.id);
                load();
              }
            }}>🗑</button>
          </div>
        </div>
      ))}

      {/* ➕ NOVO ITEM */}
      <button
        onClick={async () => {
          const nome = prompt("Nome");
          const quantidade = parseInt(prompt("Quantidade") || "0");
          const tipo = tab;
          let ca = "";

          if (tipo === "epi") {
            ca = prompt("CA") || "";
          }

          const observacoes = prompt("Observações") || "";

          await api.createItem({
            nome,
            quantidade,
            tipo,
            ca,
            observacoes
          });

          load();
        }}
        style={{ marginTop: 20 }}
      >
        + Adicionar
      </button>
    </div>
  );
}