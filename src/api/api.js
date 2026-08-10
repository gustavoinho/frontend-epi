const API = "https://SEU-BACKEND.onrender.com"; // 🔥 troca aqui

export const api = {
  async getItems(search = "") {
    const res = await fetch(`${API}/items?search=${search}`);
    return res.json();
  },

  async createItem(data) {
    const res = await fetch(`${API}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  async updateItem(id, data) {
    const res = await fetch(`${API}/items/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  async deleteItem(id) {
    await fetch(`${API}/items/${id}`, { method: "DELETE" });
  },

  async updateQty(id, delta) {
    const res = await fetch(`${API}/items/${id}/qty`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ delta })
    });
    return res.json();
  }
};