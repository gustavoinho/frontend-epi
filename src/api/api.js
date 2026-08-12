const API =
  import.meta.env.VITE_API_URL ||
  "https://backend-epi.onrender.com";

async function tratarResposta(res) {
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || "Ocorreu um erro no servidor.");
  }

  return data;
}

export const api = {
  async getItems(search = "") {
    const res = await fetch(
      `${API}/items?search=${encodeURIComponent(search)}`
    );

    return tratarResposta(res);
  },

  async createItem(data) {
    const res = await fetch(`${API}/items`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    return tratarResposta(res);
  },

  async updateItem(id, data) {
    const res = await fetch(`${API}/items/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    return tratarResposta(res);
  },

  async deleteItem(id) {
    const res = await fetch(`${API}/items/${id}`, {
      method: "DELETE",
    });

    return tratarResposta(res);
  },

  async updateQty(id, delta) {
    const res = await fetch(`${API}/items/${id}/qty`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        delta,
      }),
    });

    return tratarResposta(res);
  },

  async searchByImage(imagem) {
    const res = await fetch(`${API}/items/search-image`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        imagem,
      }),
    });

    return tratarResposta(res);
  },
};