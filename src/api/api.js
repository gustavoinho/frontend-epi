const API =
  import.meta.env.VITE_API_URL ||
  "https://backend-epi.onrender.com";

const CACHE_KEY = "epi_items_cache_v3";
const QUEUE_KEY = "epi_sync_queue_v3";
const ID_MAP_KEY = "epi_id_map_v3";

let sincronizando = false;
let intervaloSincronizacao = null;

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
  if (
    typeof navigator === "undefined"
  ) {
    return true;
  }

  return navigator.onLine;
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

    const parsed =
      JSON.parse(dados);

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
      localStorage.getItem(
        QUEUE_KEY
      );

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
      JSON.stringify(fila)
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

/* =========================================================
   IDS / OPERAÇÕES
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

  return mapa[id] || id;
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
      data.error ||
        "Ocorreu um erro no servidor."
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
    timer = setTimeout(
      () => {
        controller.abort();
      },
      timeout
    );
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
   APLICAR OPERAÇÃO LOCAL
========================================================= */

function aplicarOperacaoLocal(
  items,
  operacao
) {
  const copia = [
    ...items,
  ];

  if (
    operacao.tipo ===
    "create"
  ) {
    const existe =
      copia.some(
        (item) =>
          String(item.id) ===
          String(
            operacao.item.id
          )
      );

    if (!existe) {
      copia.push(
        operacao.item
      );
    }

    return copia;
  }

  if (
    operacao.tipo ===
    "update"
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
                  ?.updated_at ||
                item.updated_at ||
                agora(),
            }
          : item
    );
  }

  if (
    operacao.tipo ===
    "qty"
  ) {
    return copia.map(
      (item) => {
        if (
          String(item.id) !==
          String(
            operacao.id
          )
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
    operacao.tipo ===
    "delete"
  ) {
    return copia.filter(
      (item) =>
        String(item.id) !==
        String(
          operacao.id
        )
    );
  }

  return copia;
}

/* =========================================================
   ATUALIZAR IDS DAS OPERAÇÕES DA FILA
========================================================= */

function substituirIdNasOperacoes(
  fila,
  idTemporario,
  idNovo
) {
  return fila.map(
    (op) => {
      const novaOperacao =
        {
          ...op,
        };

      if (
        String(
          novaOperacao.id
        ) ===
        String(
          idTemporario
        )
      ) {
        novaOperacao.id =
          idNovo;
      }

      if (
        novaOperacao.item &&
        String(
          novaOperacao
            .item.id
        ) ===
        String(
          idTemporario
        )
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
        String(
          idTemporario
        )
      ) {
        novaOperacao.data = {
          ...novaOperacao.data,
          id: idNovo,
        };
      }

      return novaOperacao;
    }
  );
}

/* =========================================================
   ATUALIZAR CACHE COM ITEM DO SERVIDOR
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

  const idParaSubstituir =
    idAnterior ??
    itemServidor.id;

  let encontrou = false;

  const novoCache =
    cache.map(
      (item) => {
        if (
          String(item.id) ===
          String(
            idParaSubstituir
          ) ||
          String(item.id) ===
          String(
            itemServidor.id
          )
        ) {
          encontrou = true;

          return {
            ...itemServidor,
          };
        }

        return item;
      }
    );

  if (!encontrou) {
    novoCache.push({
      ...itemServidor,
    });
  }

  salvarCache(
    novoCache
  );
}

/* =========================================================
   SINCRONIZAR
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
    let fila =
      lerFila();

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
           BACKUP / IMPORTAÇÃO
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
           CRIAR
        ================================================= */

        if (
          operacao.tipo ===
          "create"
        ) {
          const itemParaEnviar =
            {
              ...operacao.item,
            };

          /*
           * O ID offline é usado apenas
           * pelo frontend.
           *
           * O backend gera o ID real
           * do PostgreSQL.
           */

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
            criado.id ===
              null
          ) {
            throw new Error(
              "O servidor não retornou o ID real do item criado."
            );
          }

          const idTemporario =
            operacao.item.id;

          const mapa =
            lerMapaIds();

          mapa[
            idTemporario
          ] = criado.id;

          salvarMapaIds(
            mapa
          );

          /*
           * Substitui o item temporário
           * pelo item oficial do banco.
           */

          atualizarItemNoCache(
            criado,
            idTemporario
          );

          /*
           * Atualiza as próximas
           * operações que ainda usam
           * o ID offline.
           */

          fila =
            substituirIdNasOperacoes(
              fila,
              idTemporario,
              criado.id
            );

          /*
           * Remove SOMENTE a operação
           * que o backend confirmou.
           */

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
                    operacao.data
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
                      operacao.delta,
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

          if (
            String(id).startsWith(
              "offline-"
            )
          ) {
            /*
             * Isso normalmente significa
             * que o item foi criado offline
             * e a criação ainda está na fila.
             *
             * Não deve chegar aqui se a
             * exclusão offline foi registrada
             * corretamente.
             */

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

          /*
           * O servidor confirmou a exclusão.
           * Agora podemos remover qualquer
           * referência local ao item.
           */

          salvarCache(
            lerCache().filter(
              (item) =>
                String(
                  item.id
                ) !==
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
          "Operação de sincronização desconhecida:",
          operacao
        );

        /*
         * Não removemos automaticamente
         * uma operação desconhecida.
         *
         * Isso evita perda silenciosa
         * de dados.
         */

        throw new Error(
          `Operação de sincronização desconhecida: ${operacao.tipo}`
        );
      } catch (error) {
        /*
         * A operação continua na fila.
         *
         * Isso é fundamental:
         * não removemos a operação quando
         * a requisição falha.
         */

        fila =
          lerFila();

        if (
          fila.length > 0
        ) {
          fila[0] = {
            ...fila[0],
            tentativas:
              (Number(
                fila[0]
                  .tentativas
              ) || 0) + 1,
            ultimoErro:
              error?.message ||
              "Erro desconhecido",
            ultimaTentativa:
              agora(),
          };

          salvarFila(
            fila
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

    /*
     * Depois de sincronizar TODAS as
     * operações pendentes, busca a
     * versão oficial do servidor.
     */

    if (
      estaOnline() &&
      lerFila().length ===
        0
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
          "Não foi possível atualizar o cache oficial:",
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

      /*
       * Pequeno atraso para dar
       * tempo à conexão voltar
       * completamente.
       */

      setTimeout(
        () => {
          sincronizar();
        },
        500
      );
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
   * Também tenta sincronizar
   * periodicamente.
   *
   * Isso cobre casos em que o
   * evento "online" não seja
   * disparado corretamente.
   */

  intervaloSincronizacao =
    setInterval(
      () => {
        if (
          estaOnline() &&
          lerFila()
            .length > 0
        ) {
          sincronizar();
        }
      },
      10000
    );

  /*
   * Importante:
   * se o aplicativo for aberto
   * já estando online, a fila
   * também será processada.
   */

  setTimeout(
    () => {
      if (
        estaOnline() &&
        lerFila().length > 0
      ) {
        sincronizar();
      }
    },
    300
  );
}

/* =========================================================
   API
========================================================= */

export const api = {
  /* =======================================================
     LISTAR
  ======================================================= */

  async getItems(search = "") {
    let items =
      lerCache();

    /*
     * Se não houver cache e houver
     * conexão, tenta buscar o servidor.
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
          /*
           * Só substituímos o cache
           * se não existirem operações
           * pendentes.
           */

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
     * Sincroniza em segundo plano.
     */

    if (estaOnline()) {
      sincronizar();
    }

    /*
     * Se a busca for vazia,
     * retorna o cache completo.
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

    /*
     * Pesquisa local.
     */

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
      updated_at:
        agora(),
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
      updated_at:
        agora(),
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
     * Item criado offline:
     *
     * Não criamos uma operação
     * PUT separada.
     *
     * Atualizamos a própria
     * operação CREATE.
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
              op.item?.id
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
    /*
     * Remove imediatamente do
     * cache visual.
     */

    salvarCache(
      lerCache().filter(
        (item) =>
          String(item.id) !==
          String(id)
      )
    );

    /*
     * Se o item ainda possui ID
     * temporário, ele nunca chegou
     * ao PostgreSQL.
     *
     * Portanto:
     *
     * CREATE
     * UPDATE
     * QTY
     * DELETE
     *
     * podem ser descartados,
     * pois o estado final desejado
     * é "item inexistente".
     */

    if (
      String(id).startsWith(
        "offline-"
      )
    ) {
      const fila =
        lerFila();

      salvarFila(
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

            return true;
          }
        )
      );

      return {
        ok: true,
      };
    }

    /*
     * Item existente no servidor:
     * cria operação DELETE.
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
      updated_at:
        agora(),
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
     * Mesmo para item offline,
     * guardamos a operação.
     *
     * Ela será convertida para
     * ID real quando o CREATE
     * for confirmado.
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
     * Mostra imediatamente
     * o backup localmente.
     */

    salvarCache(
      items
    );

    /*
     * O backup também entra
     * na fila persistente.
     */

    salvarFila([
      {
        tipo:
          "backupImport",
        items,
        operationId:
          gerarIdOperacao(),
        criadoEm:
          agora(),
        tentativas: 0,
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
      items.length ===
      0
    ) {
      return null;
    }

    let ultima =
      null;

    for (
      const item of
      items
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

  sincronizar,
};