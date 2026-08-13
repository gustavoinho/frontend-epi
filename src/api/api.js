const API =
  import.meta.env.VITE_API_URL ||
  "https://backend-epi.onrender.com";

const CACHE_KEY = "epi_items_cache_v2";
const QUEUE_KEY = "epi_sync_queue_v2";
const ID_MAP_KEY = "epi_id_map_v2";

let sincronizando = false;

/* =========================================================
   EVENTO PARA ATUALIZAR A INTERFACE
========================================================= */

function avisarAplicacao() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("estoque-atualizado")
    );
  }
}

/* =========================================================
   INTERNET
========================================================= */

function estaOnline() {
  return (
    typeof navigator !== "undefined" &&
    navigator.onLine
  );
}

/* =========================================================
   CACHE LOCAL
========================================================= */

function lerCache() {
  try {
    const dados =
      localStorage.getItem(CACHE_KEY);

    if (!dados) {
      return [];
    }

    const parsed = JSON.parse(dados);

    return Array.isArray(parsed)
      ? parsed
      : [];
  } catch (error) {
    console.error(
      "Erro ao ler cache:",
      error
    );

    return [];
  }
}

function salvarCache(items) {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify(items)
    );

    avisarAplicacao();
  } catch (error) {
    console.error(
      "Erro ao salvar cache local:",
      error
    );

    throw new Error(
      "Não foi possível salvar os dados localmente. O armazenamento do navegador pode estar cheio."
    );
  }
}

/* =========================================================
   FILA OFFLINE
========================================================= */

function lerFila() {
  try {
    const dados =
      localStorage.getItem(QUEUE_KEY);

    if (!dados) {
      return [];
    }

    const parsed = JSON.parse(dados);

    return Array.isArray(parsed)
      ? parsed
      : [];
  } catch (error) {
    console.error(
      "Erro ao ler fila:",
      error
    );

    return [];
  }
}

function salvarFila(fila) {
  localStorage.setItem(
    QUEUE_KEY,
    JSON.stringify(fila)
  );

  avisarAplicacao();
}

function adicionarFila(operacao) {
  const fila = lerFila();

  fila.push({
    ...operacao,
    criadoEm:
      new Date().toISOString(),
  });

  salvarFila(fila);
}

/* =========================================================
   MAPA DE IDS OFFLINE
========================================================= */

function lerMapaIds() {
  try {
    return JSON.parse(
      localStorage.getItem(
        ID_MAP_KEY
      ) || "{}"
    );
  } catch {
    return {};
  }
}

function salvarMapaIds(mapa) {
  localStorage.setItem(
    ID_MAP_KEY,
    JSON.stringify(mapa)
  );
}

function idReal(id) {
  const mapa = lerMapaIds();

  return mapa[id] || id;
}

/* =========================================================
   ID TEMPORÁRIO
========================================================= */

function gerarIdOffline() {
  return `offline-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

/* =========================================================
   DATA DE EDIÇÃO
========================================================= */

function agora() {
  return new Date().toISOString();
}

/* =========================================================
   RESPOSTA HTTP
========================================================= */

async function tratarResposta(res) {
  const data =
    await res
      .json()
      .catch(() => ({}));

  if (!res.ok) {
    throw new Error(
      data.error ||
        "Ocorreu um erro no servidor."
    );
  }

  return data;
}

/* =========================================================
   BUSCAR DADOS DO SERVIDOR
========================================================= */

async function buscarServidor(search = "") {
  const res = await fetch(
    `${API}/items?search=${encodeURIComponent(
      search
    )}`,
    {
      method: "GET",
      cache: "no-store",
    }
  );

  return tratarResposta(res);
}

/* =========================================================
   APLICAR OPERAÇÃO LOCAL
========================================================= */

function aplicarOperacaoLocal(
  items,
  operacao
) {
  const copia = [...items];

  if (
    operacao.tipo === "create"
  ) {
    const existe =
      copia.some(
        (item) =>
          item.id ===
          operacao.item.id
      );

    if (!existe) {
      copia.push(
        operacao.item
      );
    }

    return copia;
  }

  if (
    operacao.tipo === "update"
  ) {
    return copia.map(
      (item) =>
        String(item.id) ===
        String(
          operacao.id
        )
          ? {
              ...item,
              ...operacao.data,
              id: item.id,
              updated_at:
                operacao.data
                  .updated_at ||
                item.updated_at ||
                agora(),
            }
          : item
    );
  }

  if (
    operacao.tipo === "qty"
  ) {
    return copia.map(
      (item) => {
        if (
          String(item.id) !==
          String(operacao.id)
        ) {
          return item;
        }

        const atual =
          Number(
            item.quantidade
          ) || 0;

        return {
          ...item,
          quantidade:
            Math.max(
              0,
              atual +
                Number(
                  operacao.delta
                )
            ),
          updated_at:
            operacao.updated_at ||
            agora(),
        };
      }
    );
  }

  if (
    operacao.tipo === "delete"
  ) {
    return copia.filter(
      (item) =>
        String(item.id) !==
        String(operacao.id)
    );
  }

  return copia;
}

/* =========================================================
   SINCRONIZAR COM SERVIDOR
========================================================= */

async function sincronizar() {
  if (
    sincronizando ||
    !estaOnline()
  ) {
    return;
  }

  sincronizando = true;

  try {
    let fila = lerFila();

    if (
      fila.length === 0
    ) {
      sincronizando = false;
      return;
    }

    /*
     * Processa uma operação por vez.
     * Assim, se o usuário:
     *
     * +1
     * +1
     * editar
     *
     * offline, tudo será enviado
     * na ordem correta.
     */

    while (
      fila.length > 0 &&
      estaOnline()
    ) {
      const operacao =
        fila[0];

      try {
        /* =================================================
           BACKUP / IMPORTAÇÃO
        ================================================= */

        if (
          operacao.tipo ===
          "backupImport"
        ) {
          const res =
            await fetch(
              `${API}/backup/import`,
              {
                method: "POST",
                headers: {
                  "Content-Type":
                    "application/json",
                },
                body: JSON.stringify({
                  items:
                    operacao.items,
                }),
              }
            );

          await tratarResposta(
            res
          );

          fila.shift();
          salvarFila(fila);

          continue;
        }

        /* =================================================
           CRIAR
        ================================================= */

        if (
          operacao.tipo ===
          "create"
        ) {
          const res =
            await fetch(
              `${API}/items`,
              {
                method: "POST",
                headers: {
                  "Content-Type":
                    "application/json",
                },
                body: JSON.stringify(
                  operacao.item
                ),
              }
            );

          const criado =
            await tratarResposta(
              res
            );

          /*
           * Guarda relação:
           * offline-xxx -> 123
           */

          const mapa =
            lerMapaIds();

          mapa[
            operacao.item.id
          ] = criado.id;

          salvarMapaIds(
            mapa
          );

          /*
           * Atualiza cache
           * trocando o ID temporário
           * pelo ID real.
           */

          const cache =
            lerCache();

          salvarCache(
            cache.map(
              (item) =>
                item.id ===
                operacao.item.id
                  ? {
                      ...criado,
                    }
                  : item
            )
          );

          /*
           * Atualiza IDs das
           * próximas operações.
           */

          fila =
            fila.map(
              (op, index) => {
                if (
                  index === 0
                ) {
                  return op;
                }

                if (
                  String(
                    op.id
                  ) ===
                  String(
                    operacao
                      .item
                      .id
                  )
                ) {
                  return {
                    ...op,
                    id: criado.id,
                  };
                }

                return op;
              }
            );

          fila.shift();
          salvarFila(fila);

          continue;
        }

        /* =================================================
           EDITAR
        ================================================= */

        if (
          operacao.tipo ===
          "update"
        ) {
          const id =
            idReal(
              operacao.id
            );

          const res =
            await fetch(
              `${API}/items/${id}`,
              {
                method: "PUT",
                headers: {
                  "Content-Type":
                    "application/json",
                },
                body: JSON.stringify(
                  operacao.data
                ),
              }
            );

          const atualizado =
            await tratarResposta(
              res
            );

          salvarCache(
            lerCache().map(
              (item) =>
                String(
                  item.id
                ) ===
                String(id)
                  ? {
                      ...atualizado,
                    }
                  : item
            )
          );

          fila.shift();
          salvarFila(fila);

          continue;
        }

        /* =================================================
           QUANTIDADE
        ================================================= */

        if (
          operacao.tipo ===
          "qty"
        ) {
          const id =
            idReal(
              operacao.id
            );

          const res =
            await fetch(
              `${API}/items/${id}/qty`,
              {
                method: "PATCH",
                headers: {
                  "Content-Type":
                    "application/json",
                },
                body: JSON.stringify({
                  delta:
                    operacao.delta,
                }),
              }
            );

          const atualizado =
            await tratarResposta(
              res
            );

          salvarCache(
            lerCache().map(
              (item) =>
                String(
                  item.id
                ) ===
                String(id)
                  ? {
                      ...atualizado,
                    }
                  : item
            )
          );

          fila.shift();
          salvarFila(fila);

          continue;
        }

        /* =================================================
           EXCLUIR
        ================================================= */

        if (
          operacao.tipo ===
          "delete"
        ) {
          const id =
            idReal(
              operacao.id
            );

          const res =
            await fetch(
              `${API}/items/${id}`,
              {
                method: "DELETE",
              }
            );

          await tratarResposta(
            res
          );

          fila.shift();
          salvarFila(fila);

          continue;
        }

        /*
         * Operação desconhecida.
         * Remove para não travar
         * a fila eternamente.
         */

        fila.shift();
        salvarFila(fila);
      } catch (error) {
        console.warn(
          "⚠️ Sincronização interrompida:",
          error.message
        );

        /*
         * Mantém a operação na fila.
         * Quando voltar a internet
         * tentará novamente.
         */

        break;
      }
    }

    /*
     * Depois de sincronizar,
     * busca a versão oficial
     * do servidor.
     */

    if (
      estaOnline() &&
      lerFila().length === 0
    ) {
      try {
        const servidor =
          await buscarServidor(
            ""
          );

        if (
          Array.isArray(
            servidor
          )
        ) {
          salvarCache(
            servidor
          );
        }
      } catch (error) {
        console.warn(
          "Não foi possível atualizar cache:",
          error.message
        );
      }
    }
  } finally {
    sincronizando = false;

    avisarAplicacao();
  }
}

/* =========================================================
   SINCRONIZAÇÃO AUTOMÁTICA
========================================================= */

if (
  typeof window !==
  "undefined"
) {
  window.addEventListener(
    "online",
    () => {
      console.log(
        "🌐 Internet voltou. Sincronizando..."
      );

      sincronizar();
    }
  );

  window.addEventListener(
    "offline",
    () => {
      console.log(
        "📴 Aplicação offline."
      );

      avisarAplicacao();
    }
  );

  /*
   * Tenta sincronizar
   * periodicamente enquanto
   * estiver online.
   */

  setInterval(() => {
    if (
      estaOnline() &&
      lerFila().length > 0
    ) {
      sincronizar();
    }
  }, 10000);
}

/* =========================================================
   API
========================================================= */

export const api = {
  /* =======================================================
     LISTAR
  ======================================================= */

  async getItems(search = "") {
    /*
     * Primeiro mostra cache local.
     * Isso faz o aplicativo abrir
     * mesmo sem internet.
     */

    let items =
      lerCache();

    /*
     * Se ainda não existe
     * cache e está online,
     * busca imediatamente.
     */

    if (
      items.length === 0 &&
      estaOnline()
    ) {
      try {
        const servidor =
          await buscarServidor(
            search
          );

        if (
          Array.isArray(
            servidor
          )
        ) {
          salvarCache(
            servidor
          );

          items =
            servidor;
        }
      } catch (error) {
        console.warn(
          "Servidor indisponível:",
          error.message
        );
      }
    }

    /*
     * Sincronização acontece
     * em segundo plano.
     */

    if (estaOnline()) {
      sincronizar();
    }

    /*
     * Pesquisa local.
     */

    const termo =
      String(
        search || ""
      )
        .trim()
        .toLowerCase();

    if (!termo) {
      return items;
    }

    return items.filter(
      (item) =>
        String(
          item.nome || ""
        )
          .toLowerCase()
          .includes(termo) ||
        String(
          item.ca || ""
        )
          .toLowerCase()
          .includes(termo) ||
        String(
          item.observacoes ||
            ""
        )
          .toLowerCase()
          .includes(termo) ||
        String(
          item.status ||
            item.tipo ||
            ""
        )
          .toLowerCase()
          .includes(termo)
    );
  },

  /* =======================================================
     CRIAR
  ======================================================= */

  async createItem(data) {
    const id =
      gerarIdOffline();

    const item = {
      ...data,
      id,
      quantidade:
        Number(
          data.quantidade
        ) || 0,
      updated_at: agora(),
    };

    const items =
      lerCache();

    salvarCache([
      ...items,
      item,
    ]);

    adicionarFila({
      tipo: "create",
      item,
    });

    if (estaOnline()) {
      sincronizar();
    }

    return item;
  },

  /* =======================================================
     EDITAR
  ======================================================= */

  async updateItem(
    id,
    data
  ) {
    const atual =
      lerCache().find(
        (item) =>
          String(item.id) ===
          String(id)
      );

    const atualizado = {
      ...(atual || {}),
      ...data,
      id,
      updated_at: agora(),
    };

    salvarCache(
      lerCache().map(
        (item) =>
          String(item.id) ===
          String(id)
            ? atualizado
            : item
      )
    );

    /*
     * Se ainda é um ID offline,
     * não precisa criar uma operação
     * PUT separada. O create original
     * será enviado com os dados atuais.
     */

    if (
      String(id).startsWith(
        "offline-"
      )
    ) {
      const fila =
        lerFila();

      const novaFila =
        fila.map(
          (op) =>
            op.tipo ===
              "create" &&
            String(
              op.item.id
            ) ===
              String(id)
              ? {
                  ...op,
                  item:
                    atualizado,
                }
              : op
        );

      salvarFila(
        novaFila
      );
    } else {
      adicionarFila({
        tipo: "update",
        id,
        data: atualizado,
      });
    }

    if (estaOnline()) {
      sincronizar();
    }

    return atualizado;
  },

  /* =======================================================
     EXCLUIR
  ======================================================= */

  async deleteItem(id) {
    salvarCache(
      lerCache().filter(
        (item) =>
          String(item.id) !==
          String(id)
      )
    );

    /*
     * Se foi criado offline
     * e ainda não chegou ao servidor,
     * simplesmente remove a operação
     * de criação.
     */

    if (
      String(id).startsWith(
        "offline-"
      )
    ) {
      salvarFila(
        lerFila().filter(
          (op) =>
            !(
              op.tipo ===
                "create" &&
              String(
                op.item.id
              ) ===
                String(id)
            )
        )
      );

      return {
        ok: true,
      };
    }

    adicionarFila({
      tipo: "delete",
      id,
    });

    if (estaOnline()) {
      sincronizar();
    }

    return {
      ok: true,
    };
  },

  /* =======================================================
     QUANTIDADE
  ======================================================= */

  async updateQty(
    id,
    delta
  ) {
    const valor =
      Number(delta);

    if (
      !Number.isInteger(
        valor
      )
    ) {
      throw new Error(
        "Quantidade inválida."
      );
    }

    const atual =
      lerCache().find(
        (item) =>
          String(item.id) ===
          String(id)
      );

    if (!atual) {
      throw new Error(
        "Item não encontrado."
      );
    }

    const atualizado = {
      ...atual,
      quantidade:
        Math.max(
          0,
          (Number(
            atual.quantidade
          ) || 0) + valor
        ),
      updated_at: agora(),
    };

    salvarCache(
      lerCache().map(
        (item) =>
          String(item.id) ===
          String(id)
            ? atualizado
            : item
      )
    );

    /*
     * Se for item offline,
     * acumula normalmente.
     */

    adicionarFila({
  tipo: "qty",
  id,
  delta: valor,
});

    if (estaOnline()) {
      sincronizar();
    }

    return atualizado;
  },

  /* =======================================================
     PESQUISA POR FOTO
  ======================================================= */

  async searchByImage(
    imagem
  ) {
    if (!estaOnline()) {
      throw new Error(
        "A pesquisa por foto precisa de conexão com a internet."
      );
    }

    const res =
      await fetch(
        `${API}/items/search-image`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            imagem,
          }),
        }
      );

    return tratarResposta(
      res
    );
  },

  /* =======================================================
     EXPORTAR BACKUP
  ======================================================= */

  async exportBackup() {
    /*
     * O backup é feito do cache
     * local para também incluir
     * alterações que ainda não
     * chegaram ao servidor.
     */

    const items =
      lerCache();

    return {
      versao: 1,
      aplicativo:
        "Controle EPI",
      exportadoEm:
        agora(),
      items,
    };
  },

  /* =======================================================
     IMPORTAR BACKUP
  ======================================================= */

  async importBackup(
    backup
  ) {
    if (
      !backup ||
      !Array.isArray(
        backup.items
      )
    ) {
      throw new Error(
        "Arquivo de backup inválido."
      );
    }

    const items =
      backup.items.map(
        (item) => ({
          ...item,
          updated_at:
            item.updated_at ||
            agora(),
        })
      );

    /*
     * Salva imediatamente
     * no dispositivo.
     */

    salvarCache(items);

    /*
     * Limpa operações antigas,
     * pois o backup passa a ser
     * a nova fonte local.
     */

    salvarFila([
      {
        tipo:
          "backupImport",
        items,
        criadoEm:
          agora(),
      },
    ]);

    if (estaOnline()) {
      sincronizar();
    }

    return items;
  },

  /* =======================================================
     STATUS
  ======================================================= */

  isOnline() {
    return estaOnline();
  },

  getPendingCount() {
    return lerFila().length;
  },

  getLastEdit() {
    const items =
      lerCache();

    if (
      items.length === 0
    ) {
      return null;
    }

    let ultima = null;

    for (
      const item of items
    ) {
      if (
        !item.updated_at
      ) {
        continue;
      }

      const data =
        new Date(
          item.updated_at
        );

      if (
        !ultima ||
        data > ultima
      ) {
        ultima = data;
      }
    }

    return ultima
      ? ultima.toISOString()
      : null;
  },

  sincronizar,
};