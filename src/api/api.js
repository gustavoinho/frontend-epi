const API =
  import.meta.env.VITE_API_URL ||
  "https://backend-epi.onrender.com";

const CACHE_KEY = "epi_items_cache_v4";
const QUEUE_KEY = "epi_sync_queue_v4";
const ID_MAP_KEY = "epi_id_map_v4";

let sincronizando = false;
let intervaloSincronizacao = null;

/* =========================================================
   EVENTO
========================================================= */

function avisarAplicacao() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent("estoque-atualizado")
  );
}

/* =========================================================
   INTERNET
========================================================= */

function estaOnline() {
  if (typeof navigator === "undefined") {
    return true;
  }

  return navigator.onLine;
}

/* =========================================================
   CACHE
========================================================= */

function lerCache() {
  try {
    const dados = localStorage.getItem(CACHE_KEY);

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
      JSON.stringify(
        Array.isArray(items)
          ? items
          : []
      )
    );

    avisarAplicacao();
  } catch (error) {
    console.error(
      "Erro ao salvar cache:",
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

    const parsed =
      JSON.parse(dados);

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
  try {
    localStorage.setItem(
      QUEUE_KEY,
      JSON.stringify(
        Array.isArray(fila)
          ? fila
          : []
      )
    );

    avisarAplicacao();
  } catch (error) {
    console.error(
      "Erro ao salvar fila:",
      error
    );

    throw new Error(
      "Não foi possível salvar a fila de sincronização local."
    );
  }
}

function adicionarFila(operacao) {
  const fila = lerFila();

  fila.push({
    ...operacao,

    operationId:
      operacao.operationId ||
      gerarIdOperacao(),

    criadoEm:
      operacao.criadoEm ||
      new Date().toISOString(),

    tentativas:
      Number(
        operacao.tentativas
      ) || 0,
  });

  salvarFila(fila);
}

/* =========================================================
   IDS
========================================================= */

function gerarIdOffline() {
  return `offline-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 12)}`;
}

function gerarIdOperacao() {
  return `sync-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 14)}`;
}

/* =========================================================
   MAPA DE IDS
========================================================= */

function lerMapaIds() {
  try {
    const dados =
      localStorage.getItem(
        ID_MAP_KEY
      );

    if (!dados) {
      return {};
    }

    const mapa =
      JSON.parse(dados);

    return mapa &&
      typeof mapa === "object"
      ? mapa
      : {};
  } catch (error) {
    console.error(
      "Erro ao ler mapa de IDs:",
      error
    );

    return {};
  }
}

function salvarMapaIds(mapa) {
  try {
    localStorage.setItem(
      ID_MAP_KEY,
      JSON.stringify(mapa)
    );
  } catch (error) {
    console.error(
      "Erro ao salvar mapa de IDs:",
      error
    );
  }
}

function idReal(id) {
  const mapa =
    lerMapaIds();

  return mapa[String(id)] || id;
}

/* =========================================================
   DATA
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
      data?.error ||
        data?.message ||
        `Erro HTTP ${res.status}.`
    );
  }

  return data;
}

/* =========================================================
   FETCH COM TIMEOUT
========================================================= */

async function fetchComTimeout(
  url,
  options = {},
  timeout = 20000
) {
  const controller =
    typeof AbortController !==
    "undefined"
      ? new AbortController()
      : null;

  let timer = null;

  if (controller) {
    timer = setTimeout(() => {
      controller.abort();
    }, timeout);
  }

  try {
    return await fetch(
      url,
      {
        ...options,
        ...(controller
          ? {
              signal:
                controller.signal,
            }
          : {}),
      }
    );
  } catch (error) {
    if (
      error?.name ===
      "AbortError"
    ) {
      throw new Error(
        "A conexão com o servidor demorou demais."
      );
    }

    throw error;
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

/* =========================================================
   BUSCAR SERVIDOR
========================================================= */

async function buscarServidor(
  search = ""
) {
  const res =
    await fetchComTimeout(
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
   ATUALIZAR ITEM NO CACHE
========================================================= */

function atualizarItemNoCache(
  itemServidor,
  idAnterior = null
) {
  if (!itemServidor) {
    return;
  }

  const cache =
    lerCache();

  const idAntigo =
    idAnterior ??
    itemServidor.id;

  let encontrou = false;

  const novoCache =
    cache.map((item) => {
      const mesmoIdAntigo =
        String(item.id) ===
        String(idAntigo);

      const mesmoIdNovo =
        String(item.id) ===
        String(itemServidor.id);

      if (
        mesmoIdAntigo ||
        mesmoIdNovo
      ) {
        encontrou = true;

        return {
          ...itemServidor,
        };
      }

      return item;
    });

  if (!encontrou) {
    novoCache.push({
      ...itemServidor,
    });
  }

  salvarCache(novoCache);
}

/* =========================================================
   SUBSTITUIR IDS TEMPORÁRIOS
========================================================= */

function substituirIdNasOperacoes(
  fila,
  idTemporario,
  idNovo
) {
  return fila.map((op) => {
    const novaOperacao = {
      ...op,
    };

    if (
      String(novaOperacao.id) ===
      String(idTemporario)
    ) {
      novaOperacao.id =
        idNovo;
    }

    if (
      novaOperacao.item &&
      String(
        novaOperacao.item.id
      ) ===
        String(idTemporario)
    ) {
      novaOperacao.item = {
        ...novaOperacao.item,
        id: idNovo,
      };
    }

    if (
      novaOperacao.data &&
      String(
        novaOperacao.data.id
      ) ===
        String(idTemporario)
    ) {
      novaOperacao.data = {
        ...novaOperacao.data,
        id: idNovo,
      };
    }

    return novaOperacao;
  });
}

/* =========================================================
   SINCRONIZAÇÃO
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

    while (
      fila.length > 0 &&
      estaOnline()
    ) {
      const operacao =
        fila[0];

      if (
        !operacao.operationId
      ) {
        operacao.operationId =
          gerarIdOperacao();

        fila[0] =
          operacao;

        salvarFila(fila);
      }

      try {
        /* =================================================
           BACKUP
        ================================================= */

        if (
          operacao.tipo ===
          "backupImport"
        ) {
          const res =
            await fetchComTimeout(
              `${API}/backup/import`,
              {
                method: "POST",
                headers: {
                  "Content-Type":
                    "application/json",

                  "X-Sync-Operation-ID":
                    operacao.operationId,
                },

                body:
                  JSON.stringify({
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
           CREATE
        ================================================= */

        if (
          operacao.tipo ===
          "create"
        ) {
          const itemParaEnviar = {
            ...operacao.item,
          };

          const res =
            await fetchComTimeout(
              `${API}/items`,
              {
                method: "POST",

                headers: {
                  "Content-Type":
                    "application/json",

                  "X-Sync-Operation-ID":
                    operacao.operationId,
                },

                body:
                  JSON.stringify(
                    itemParaEnviar
                  ),
              }
            );

          const criado =
            await tratarResposta(
              res
            );

          if (
            !criado ||
            criado.id ===
              undefined ||
            criado.id === null
          ) {
            throw new Error(
              "O servidor não retornou o ID real do item criado."
            );
          }

          const idTemporario =
            operacao.item.id;

          /* Atualiza mapa */

          const mapa =
            lerMapaIds();

          mapa[
            String(idTemporario)
          ] = criado.id;

          salvarMapaIds(
            mapa
          );

          /* Atualiza cache */

          atualizarItemNoCache(
            criado,
            idTemporario
          );

          /*
           * IMPORTANTE:
           * atualiza todas as operações
           * seguintes que ainda utilizam
           * o ID offline.
           */

          fila =
            substituirIdNasOperacoes(
              fila,
              idTemporario,
              criado.id
            );

          /*
           * Remove somente o CREATE
           * que acabou de ser confirmado.
           */

          fila.shift();

          salvarFila(fila);

          continue;
        }

        /* =================================================
           UPDATE
        ================================================= */

        if (
          operacao.tipo ===
          "update"
        ) {
          const id =
            idReal(
              operacao.id
            );

          if (
            String(id).startsWith(
              "offline-"
            )
          ) {
            throw new Error(
              "O item ainda possui ID offline. A criação precisa ser sincronizada primeiro."
            );
          }

          const dados =
            {
              ...operacao.data,
            };

          /*
           * O ID é controlado pela URL.
           * Não precisamos enviar ID temporário
           * no corpo.
           */

          delete dados.id;

          const res =
            await fetchComTimeout(
              `${API}/items/${encodeURIComponent(
                id
              )}`,
              {
                method: "PUT",

                headers: {
                  "Content-Type":
                    "application/json",

                  "X-Sync-Operation-ID":
                    operacao.operationId,
                },

                body:
                  JSON.stringify(
                    dados
                  ),
              }
            );

          const atualizado =
            await tratarResposta(
              res
            );

          atualizarItemNoCache(
            atualizado,
            id
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

          if (
            String(id).startsWith(
              "offline-"
            )
          ) {
            throw new Error(
              "O item ainda possui ID offline. A criação precisa ser sincronizada primeiro."
            );
          }

          const res =
            await fetchComTimeout(
              `${API}/items/${encodeURIComponent(
                id
              )}/qty`,
              {
                method: "PATCH",

                headers: {
                  "Content-Type":
                    "application/json",

                  "X-Sync-Operation-ID":
                    operacao.operationId,
                },

                body:
                  JSON.stringify({
                    delta:
                      Number(
                        operacao.delta
                      ),
                  }),
              }
            );

          const atualizado =
            await tratarResposta(
              res
            );

          atualizarItemNoCache(
            atualizado,
            id
          );

          fila.shift();

          salvarFila(fila);

          continue;
        }

        /* =================================================
           DELETE
        ================================================= */

        if (
          operacao.tipo ===
          "delete"
        ) {
          const id =
            idReal(
              operacao.id
            );

          /*
           * Se ainda é offline,
           * não existe nada no servidor
           * para excluir.
           */

          if (
            String(id).startsWith(
              "offline-"
            )
          ) {
            fila.shift();

            salvarFila(fila);

            continue;
          }

          const res =
            await fetchComTimeout(
              `${API}/items/${encodeURIComponent(
                id
              )}`,
              {
                method: "DELETE",

                headers: {
                  "X-Sync-Operation-ID":
                    operacao.operationId,
                },
              }
            );

          await tratarResposta(
            res
          );

          salvarCache(
            lerCache().filter(
              (item) =>
                String(item.id) !==
                String(id)
            )
          );

          fila.shift();

          salvarFila(fila);

          continue;
        }

        /* =================================================
           OPERAÇÃO DESCONHECIDA
        ================================================= */

        console.error(
          "Operação desconhecida:",
          operacao
        );

        throw new Error(
          `Operação de sincronização desconhecida: ${operacao.tipo}`
        );
      } catch (error) {
        /*
         * NÃO remove a operação.
         *
         * Ela continuará na fila
         * para uma próxima tentativa.
         */

        const filaAtual =
          lerFila();

        if (
          filaAtual.length > 0
        ) {
          filaAtual[0] = {
            ...filaAtual[0],

            tentativas:
              (Number(
                filaAtual[0]
                  .tentativas
              ) || 0) + 1,

            ultimoErro:
              error?.message ||
              "Erro desconhecido",

            ultimaTentativa:
              agora(),
          };

          salvarFila(
            filaAtual
          );
        }

        console.warn(
          "⚠️ Sincronização interrompida:",
          error?.message ||
            error
        );

        break;
      }

      fila =
        lerFila();
    }

    /* =====================================================
       ATUALIZAR CACHE COM SERVIDOR
    ===================================================== */

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
          "Não foi possível atualizar o cache:",
          error?.message ||
            error
        );
      }
    }
  } finally {
    sincronizando =
      false;

    avisarAplicacao();
  }
}

/* =========================================================
   EVENTOS DE CONEXÃO
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

      setTimeout(() => {
        sincronizar();
      }, 500);
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

  intervaloSincronizacao =
    setInterval(() => {
      if (
        estaOnline() &&
        lerFila().length > 0
      ) {
        sincronizar();
      }
    }, 10000);

  setTimeout(() => {
    if (
      estaOnline() &&
      lerFila().length > 0
    ) {
      sincronizar();
    }
  }, 300);
}

/* =========================================================
   API
========================================================= */

export const api = {
  /* =======================================================
     LISTAR ITENS
  ======================================================= */

  async getItems(search = "") {
    let items =
      lerCache();

    const termo =
      String(
        search || ""
      )
        .trim()
        .toLowerCase();

    /*
     * Se o cache estiver vazio,
     * tenta buscar no servidor.
     */

    if (
      items.length === 0 &&
      estaOnline()
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
          if (
            lerFila().length ===
            0
          ) {
            salvarCache(
              servidor
            );

            items =
              servidor;
          }
        }
      } catch (error) {
        console.warn(
          "Servidor indisponível:",
          error?.message ||
            error
        );
      }
    }

    /*
     * Inicia sincronização em
     * segundo plano.
     */

    if (estaOnline()) {
      sincronizar();
    }

    /*
     * Sem pesquisa:
     * retorna todos os itens.
     */

    if (!termo) {
      return items;
    }

    /*
     * Pesquisa local por:
     * - nome
     * - CA
     * - observações
     * - categoria
     */

    return items.filter(
      (item) => {
        const nome =
          String(
            item.nome || ""
          )
            .toLowerCase();

        const ca =
          String(
            item.ca || ""
          )
            .toLowerCase();

        const observacoes =
          String(
            item.observacoes ||
              ""
          )
            .toLowerCase();

        const categoria =
          String(
            item.status ||
              item.tipo ||
              ""
          )
            .toLowerCase();

        return (
          nome.includes(
            termo
          ) ||
          ca.includes(
            termo
          ) ||
          observacoes.includes(
            termo
          ) ||
          categoria.includes(
            termo
          )
        );
      }
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

      status:
        data.status ||
        data.tipo ||
        "epi",

      tipo:
        data.tipo ||
        data.status ||
        "epi",

      updated_at:
        agora(),
    };

    const cache =
      lerCache();

    salvarCache([
      ...cache,
      item,
    ]);

    /*
     * Sempre adiciona à fila.
     *
     * Mesmo online fazemos isso,
     * porque a sincronização será
     * responsável por enviar ao
     * servidor.
     */

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
    const cache =
      lerCache();

    const atual =
      cache.find(
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
      ...data,

      id,

      quantidade:
        Number(
          data.quantidade ??
            atual.quantidade
        ) || 0,

      updated_at:
        agora(),
    };

    salvarCache(
      cache.map(
        (item) =>
          String(item.id) ===
          String(id)
            ? atualizado
            : item
      )
    );

    /*
     * ITEM OFFLINE
     *
     * Se ainda não existe no servidor,
     * atualizamos a própria operação
     * CREATE.
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
          (op) => {
            if (
              op.tipo ===
                "create" &&
              String(
                op.item?.id
              ) ===
                String(id)
            ) {
              return {
                ...op,

                item: {
                  ...atualizado,
                },
              };
            }

            return op;
          }
        );

      salvarFila(
        novaFila
      );
    } else {
      /*
       * ITEM JÁ EXISTENTE NO SERVIDOR
       */

      adicionarFila({
        tipo: "update",

        id,

        data: {
          ...atualizado,
        },
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
    /*
     * Remove imediatamente
     * da interface/cache.
     */

    salvarCache(
      lerCache().filter(
        (item) =>
          String(item.id) !==
          String(id)
      )
    );

    /*
     * ITEM CRIADO OFFLINE
     *
     * Se ainda não chegou ao servidor,
     * simplesmente removemos todas as
     * operações relacionadas a ele.
     */

    if (
      String(id).startsWith(
        "offline-"
      )
    ) {
      const fila =
        lerFila();

      const novaFila =
        fila.filter(
          (op) => {
            if (
              op.tipo ===
                "create" &&
              String(
                op.item?.id
              ) ===
                String(id)
            ) {
              return false;
            }

            if (
              String(
                op.id
              ) ===
                String(id)
            ) {
              return false;
            }

            if (
              String(
                op.data?.id
              ) ===
                String(id)
            ) {
              return false;
            }

            if (
              String(
                op.item?.id
              ) ===
                String(id)
            ) {
              return false;
            }

            return true;
          }
        );

      salvarFila(
        novaFila
      );

      return {
        ok: true,
      };
    }

    /*
     * ITEM EXISTENTE NO SERVIDOR
     */

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
     ALTERAR QUANTIDADE
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

    if (valor === 0) {
      throw new Error(
        "A quantidade precisa ser diferente de zero."
      );
    }

    const cache =
      lerCache();

    const atual =
      cache.find(
        (item) =>
          String(item.id) ===
          String(id)
      );

    if (!atual) {
      throw new Error(
        "Item não encontrado."
      );
    }

    const quantidadeAtual =
      Number(
        atual.quantidade
      ) || 0;

    const novaQuantidade =
      quantidadeAtual +
      valor;

    if (
      novaQuantidade <
      0
    ) {
      throw new Error(
        "Não é possível deixar a quantidade abaixo de zero."
      );
    }

    const atualizado = {
      ...atual,

      quantidade:
        novaQuantidade,

      updated_at:
        agora(),
    };

    /*
     * Atualiza imediatamente
     * na tela.
     */

    salvarCache(
      cache.map(
        (item) =>
          String(item.id) ===
          String(id)
            ? atualizado
            : item
      )
    );

    /*
     * Guarda a operação.
     *
     * Se o item foi criado offline,
     * o ID será substituído pelo
     * ID real quando o CREATE
     * for sincronizado.
     */

    adicionarFila({
      tipo: "qty",

      id,

      delta: valor,

      updated_at:
        atualizado.updated_at,
    });

    if (estaOnline()) {
      sincronizar();
    }

    return atualizado;
  },

  /* =======================================================
     EXPORTAR BACKUP
  ======================================================= */

  async exportBackup() {
    return {
      versao: 1,

      aplicativo:
        "Controle EPI",

      exportadoEm:
        agora(),

      items:
        lerCache(),
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

          quantidade:
            Number(
              item.quantidade
            ) || 0,

          status:
            item.status ||
            item.tipo ||
            "epi",

          tipo:
            item.tipo ||
            item.status ||
            "epi",

          updated_at:
            item.updated_at ||
            agora(),
        })
      );

    /*
     * Mostra imediatamente
     * o backup no dispositivo.
     */

    salvarCache(
      items
    );

    /*
     * Remove operações antigas
     * de backup para evitar duas
     * restaurações seguidas.
     */

    const fila =
      lerFila().filter(
        (op) =>
          op.tipo !==
          "backupImport"
      );

    fila.push({
      tipo:
        "backupImport",

      items,

      operationId:
        gerarIdOperacao(),

      criadoEm:
        agora(),

      tentativas: 0,
    });

    salvarFila(
      fila
    );

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

  /* =======================================================
     ÚLTIMA EDIÇÃO
  ======================================================= */

  getLastEdit() {
    const items =
      lerCache();

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
        Number.isNaN(
          data.getTime()
        )
      ) {
        continue;
      }

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

  /* =======================================================
     SINCRONIZAR MANUALMENTE
  ======================================================= */

  sincronizar,
};

/* =========================================================
   LIMPEZA AO DESCARREGAR A PÁGINA
========================================================= */

if (
  typeof window !==
    "undefined" &&
  intervaloSincronizacao
) {
  window.addEventListener(
    "beforeunload",
    () => {
      clearInterval(
        intervaloSincronizacao
      );
    }
  );
}