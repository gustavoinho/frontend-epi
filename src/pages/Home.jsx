import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { api } from "../api/api";
import "./Home.css";

const CATEGORIAS = [
  {
    id: "epi",
    nome: "EPI",
    descricao: "Equipamentos de proteção",
    icone: "🦺",
  },
  {
    id: "material",
    nome: "Material",
    descricao: "Materiais e ferramentas",
    icone: "📦",
  },
  {
    id: "uniforme",
    nome: "Uniforme",
    descricao: "Roupas e identificação",
    icone: "👕",
  },
];

/* =========================================================
   ARQUIVO -> DATA URL
========================================================= */

async function arquivoParaDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (
        typeof reader.result !== "string" ||
        !reader.result.startsWith("data:")
      ) {
        reject(
          new Error(
            "Não foi possível converter o arquivo."
          )
        );
        return;
      }

      resolve(reader.result);
    };

    reader.onerror = () =>
      reject(
        new Error(
          "Erro ao ler arquivo."
        )
      );

    reader.readAsDataURL(file);
  });
}

/* =========================================================
   OTIMIZAR IMAGEM
========================================================= */

async function imagemOtimizada(file) {
  if (!file) {
    throw new Error(
      "Arquivo não informado."
    );
  }

  if (
    !file.type ||
    !file.type.startsWith("image/")
  ) {
    return arquivoParaDataURL(file);
  }

  return new Promise(
    (resolve, reject) => {
      const reader =
        new FileReader();

      reader.onload = () => {
        const img =
          new Image();

        img.onload = () => {
          const limite = 1000;

          let width =
            img.naturalWidth ||
            img.width;

          let height =
            img.naturalHeight ||
            img.height;

          if (!width || !height) {
            reject(
              new Error(
                "Não foi possível identificar a imagem."
              )
            );
            return;
          }

          if (
            width > limite ||
            height > limite
          ) {
            if (width > height) {
              height = Math.round(
                (height * limite) /
                  width
              );

              width = limite;
            } else {
              width = Math.round(
                (width * limite) /
                  height
              );

              height = limite;
            }
          }

          const canvas =
            document.createElement(
              "canvas"
            );

          canvas.width = width;
          canvas.height = height;

          const ctx =
            canvas.getContext("2d");

          if (!ctx) {
            reject(
              new Error(
                "Não foi possível processar a imagem."
              )
            );
            return;
          }

          ctx.fillStyle =
            "#ffffff";

          ctx.fillRect(
            0,
            0,
            width,
            height
          );

          ctx.drawImage(
            img,
            0,
            0,
            width,
            height
          );

          const resultado =
            canvas.toDataURL(
              "image/jpeg",
              0.72
            );

          resolve(resultado);
        };

        img.onerror = () =>
          reject(
            new Error(
              "Não foi possível carregar a imagem."
            )
          );

        img.src =
          reader.result;
      };

      reader.onerror = () =>
        reject(
          new Error(
            "Não foi possível ler a imagem."
          )
        );

      reader.readAsDataURL(file);
    }
  );
}

/* =========================================================
   MODAL DE CONFIRMAÇÃO
========================================================= */

function ModalConfirmacao({
  titulo,
  texto,
  onCancelar,
  onConfirmar,
}) {
  return (
    <div className="modal-overlay">
      <div className="confirm-modal">
        <div className="confirm-icon">
          ⚠️
        </div>

        <h2>{titulo}</h2>

        <p>{texto}</p>

        <div className="confirm-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={onCancelar}
          >
            Cancelar
          </button>

          <button
            type="button"
            className="btn-danger"
            onClick={onConfirmar}
          >
            Excluir
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   MODAL DE ITEM
========================================================= */

function ItemModal({
  item,
  onClose,
  onSaved,
}) {
  const editando =
    Boolean(item);

  const [nome, setNome] =
    useState(
      item?.nome || ""
    );

  const [quantidade, setQuantidade] =
    useState(
      Number(
        item?.quantidade
      ) || 0
    );

  const [status, setStatus] =
    useState(
      item?.status ||
        item?.tipo ||
        "epi"
    );

  const [ca, setCa] =
    useState(
      item?.ca || ""
    );

  const [observacoes, setObservacoes] =
    useState(
      item?.observacoes || ""
    );

  const [imagem, setImagem] =
    useState(
      item?.imagem ||
        item?.foto ||
        ""
    );

  const [salvando, setSalvando] =
    useState(false);

  const [erro, setErro] =
    useState("");

  const fotoInputRef =
    useRef(null);

  /* =======================================================
     SELECIONAR FOTO
  ======================================================= */

  async function selecionarFoto(e) {
    const file =
      e.target.files?.[0];

    if (!file) return;

    if (
      !file.type.startsWith(
        "image/"
      )
    ) {
      setErro(
        "A foto principal precisa ser uma imagem."
      );

      e.target.value = "";
      return;
    }

    if (
      file.size >
      15 * 1024 * 1024
    ) {
      setErro(
        "A imagem original é muito grande. Escolha uma foto de até 15 MB."
      );

      e.target.value = "";
      return;
    }

    try {
      setErro("");

      const dataUrl =
        await imagemOtimizada(
          file
        );

      if (
        typeof dataUrl !==
          "string" ||
        !dataUrl.startsWith(
          "data:image/"
        )
      ) {
        throw new Error(
          "Imagem inválida."
        );
      }

      setImagem(dataUrl);
    } catch (error) {
      console.error(
        "Erro ao processar foto:",
        error
      );

      setErro(
        "Não foi possível carregar a foto."
      );
    } finally {
      e.target.value = "";
    }
  }

  /* =======================================================
     QUANTIDADE NO CADASTRO
  ======================================================= */

  function alterarQuantidade(valor) {
    setQuantidade(
      (atual) =>
        Math.max(
          0,
          Number(atual || 0) +
            valor
        )
    );
  }

  /* =======================================================
     SALVAR
  ======================================================= */

  async function salvar() {
    if (!nome.trim()) {
      setErro(
        "Digite o nome do item."
      );
      return;
    }

    setSalvando(true);
    setErro("");

    try {
      const dados = {
        nome: nome.trim(),

        quantidade:
          Number(
            quantidade
          ) || 0,

        status,

        tipo: status,

        ca:
          status === "epi"
            ? ca.trim()
            : "",

        observacoes:
          observacoes.trim(),

        imagem:
          typeof imagem ===
          "string"
            ? imagem
            : "",

        anexos:
          Array.isArray(
            item?.anexos
          )
            ? item.anexos
            : [],
      };

      if (editando) {
        await api.updateItem(
          item.id,
          dados
        );
      } else {
        await api.createItem(
          dados
        );
      }

      await onSaved();

      onClose();
    } catch (error) {
      console.error(
        "Erro ao salvar item:",
        error
      );

      setErro(
        error?.message ||
          "Não foi possível salvar o item."
      );
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="item-modal">
        <div className="modal-header">
          <div>
            <span className="modal-kicker">
              CONTROLE DE ESTOQUE
            </span>

            <h2>
              {editando
                ? "Editar item"
                : "Novo item"}
            </h2>

            <p>
              Preencha as informações
              do item abaixo.
            </p>
          </div>

          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            disabled={salvando}
          >
            ×
          </button>
        </div>

        <div className="modal-body">
          {erro && (
            <div className="form-error">
              <span>!</span>
              {erro}
            </div>
          )}

          <section className="form-section">
            <div className="section-title">
              <span>01</span>
              Informações básicas
            </div>

            <div className="form-grid">
              <label className="field field-full">
                <span>
                  Nome do item *
                </span>

                <input
                  value={nome}
                  onChange={(e) =>
                    setNome(
                      e.target.value
                    )
                  }
                  placeholder="Ex.: Capacete de segurança"
                  autoFocus
                />
              </label>

              <div className="field field-full">
                <span>
                  Categoria do item *
                </span>

                <div className="category-grid">
                  {CATEGORIAS.map(
                    (categoria) => (
                      <button
                        type="button"
                        key={
                          categoria.id
                        }
                        className={`category-option ${
                          status ===
                          categoria.id
                            ? "selected"
                            : ""
                        }`}
                        onClick={() =>
                          setStatus(
                            categoria.id
                          )
                        }
                      >
                        <span className="category-icon">
                          {
                            categoria.icone
                          }
                        </span>

                        <span>
                          <strong>
                            {
                              categoria.nome
                            }
                          </strong>

                          <small>
                            {
                              categoria.descricao
                            }
                          </small>
                        </span>

                        <span className="radio-dot" />
                      </button>
                    )
                  )}
                </div>
              </div>

              <div className="field">
                <span>
                  Quantidade
                </span>

                <div className="quantity-editor">
                  <button
                    type="button"
                    onClick={() =>
                      alterarQuantidade(
                        -1
                      )
                    }
                  >
                    −
                  </button>

                  <input
                    type="number"
                    min="0"
                    value={
                      quantidade
                    }
                    onChange={(e) =>
                      setQuantidade(
                        Math.max(
                          0,
                          Number(
                            e.target
                              .value
                          ) || 0
                        )
                      )
                    }
                  />

                  <button
                    type="button"
                    onClick={() =>
                      alterarQuantidade(
                        1
                      )
                    }
                  >
                    +
                  </button>
                </div>
              </div>

              {status ===
                "epi" && (
                <label className="field">
                  <span>CA</span>

                  <input
                    value={ca}
                    onChange={(e) =>
                      setCa(
                        e.target.value
                      )
                    }
                    placeholder="Ex.: 12345"
                  />
                </label>
              )}

              <label className="field field-full">
                <span>
                  Observações
                </span>

                <textarea
                  value={
                    observacoes
                  }
                  onChange={(e) =>
                    setObservacoes(
                      e.target.value
                    )
                  }
                  placeholder="Informações adicionais sobre o item..."
                  rows={4}
                />
              </label>
            </div>
          </section>

          <section className="form-section">
            <div className="section-title">
              <span>02</span>
              Foto do item
            </div>

            <div
              className={`photo-upload ${
                imagem
                  ? "has-image"
                  : ""
              }`}
              onClick={() =>
                fotoInputRef.current?.click()
              }
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (
                  e.key ===
                    "Enter" ||
                  e.key === " "
                ) {
                  fotoInputRef.current?.click();
                }
              }}
            >
              {imagem ? (
                <>
                  <img
                    src={imagem}
                    alt={
                      nome ||
                      "Item"
                    }
                  />

                  <div className="photo-overlay">
                    <span>📷</span>

                    <strong>
                      Alterar foto
                    </strong>

                    <small>
                      Clique para
                      selecionar
                      outra
                    </small>
                  </div>
                </>
              ) : (
                <div className="upload-placeholder">
                  <div className="upload-icon">
                    📷
                  </div>

                  <strong>
                    Adicionar foto
                  </strong>

                  <small>
                    A foto também
                    será usada na
                    pesquisa
                    inteligente
                    por imagem.
                  </small>
                </div>
              )}
            </div>

            <input
              ref={
                fotoInputRef
              }
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              capture="environment"
              hidden
              onChange={
                selecionarFoto
              }
            />

            {imagem && (
              <button
                type="button"
                className="remove-photo"
                onClick={() =>
                  setImagem("")
                }
              >
                Remover foto
              </button>
            )}
          </section>
        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
            disabled={
              salvando
            }
          >
            Cancelar
          </button>

          <button
            type="button"
            className="btn-primary"
            onClick={salvar}
            disabled={
              salvando
            }
          >
            {salvando ? (
              <>
                <span className="spinner" />
                Salvando...
              </>
            ) : (
              <>
                ✓
                {editando
                  ? "Salvar alterações"
                  : "Cadastrar item"}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   PESQUISA VISUAL
========================================================= */

function VisualSearchModal({
  onClose,
  onResults,
}) {
  const inputRef =
    useRef(null);

  const [imagem, setImagem] =
    useState("");

  const [carregando, setCarregando] =
    useState(false);

  const [erro, setErro] =
    useState("");

  async function selecionar(e) {
    const file =
      e.target.files?.[0];

    if (!file) return;

    if (
      !file.type.startsWith(
        "image/"
      )
    ) {
      setErro(
        "Selecione uma imagem."
      );

      e.target.value = "";
      return;
    }

    if (
      file.size >
      15 * 1024 * 1024
    ) {
      setErro(
        "A imagem é muito grande. Escolha uma foto de até 15 MB."
      );

      e.target.value = "";
      return;
    }

    try {
      setErro("");

      const dataUrl =
        await imagemOtimizada(
          file
        );

      if (
        typeof dataUrl !==
          "string" ||
        !dataUrl.startsWith(
          "data:image/"
        )
      ) {
        throw new Error(
          "Imagem inválida."
        );
      }

      setImagem(dataUrl);
    } catch (error) {
      console.error(
        "Erro ao carregar imagem:",
        error
      );

      setErro(
        error?.message ||
          "Não foi possível carregar a imagem."
      );
    } finally {
      e.target.value = "";
    }
  }

  /* =======================================================
     NORMALIZAR RESULTADOS DA API
  ======================================================= */

  function normalizarResultados(
    resposta
  ) {
    let resultados = [];

    if (
      Array.isArray(
        resposta
      )
    ) {
      resultados =
        resposta;
    } else if (
      Array.isArray(
        resposta?.resultados
      )
    ) {
      resultados =
        resposta.resultados;
    } else if (
      Array.isArray(
        resposta?.results
      )
    ) {
      resultados =
        resposta.results;
    } else if (
      Array.isArray(
        resposta?.items
      )
    ) {
      resultados =
        resposta.items;
    } else if (
      Array.isArray(
        resposta?.data
      )
    ) {
      resultados =
        resposta.data;
    } else if (
      Array.isArray(
        resposta?.data?.items
      )
    ) {
      resultados =
        resposta.data.items;
    } else if (
      Array.isArray(
        resposta?.data?.results
      )
    ) {
      resultados =
        resposta.data.results;
    }

    /*
     * Alguns backends retornam:
     *
     * {
     *   item: {...},
     *   distancia: 0.12
     * }
     *
     * Outros retornam o próprio item.
     *
     * Aqui transformamos os dois formatos
     * em uma lista de itens.
     */

    return resultados
      .map((resultado) => {
        if (
          resultado?.item &&
          typeof resultado.item ===
            "object"
        ) {
          return {
            ...resultado.item,
            similaridade:
              resultado.similaridade ??
              resultado.similarity ??
              resultado.score,
            distancia:
              resultado.distancia ??
              resultado.distance,
          };
        }

        return resultado;
      })
      .filter(
        (item) =>
          item &&
          typeof item ===
            "object" &&
          (item.id ||
            item.nome)
      );
  }

  /* =======================================================
     PESQUISAR
  ======================================================= */

  async function pesquisar() {
    if (!imagem) {
      setErro(
        "Selecione uma foto para pesquisar."
      );
      return;
    }

    if (
      !imagem.startsWith(
        "data:image/"
      )
    ) {
      setErro(
        "A imagem selecionada é inválida."
      );
      return;
    }

    setCarregando(true);
    setErro("");

    try {
      /*
       * Envia a imagem otimizada
       * em Data URL/Base64.
       */

      const resposta =
        await api.searchByImage(
          imagem
        );

      console.log(
        "Resposta da pesquisa visual:",
        resposta
      );

      const resultados =
        normalizarResultados(
          resposta
        );

      console.log(
        "Resultados normalizados:",
        resultados
      );

      onResults(
        resultados
      );

      onClose();
    } catch (error) {
      console.error(
        "Erro na pesquisa visual:",
        error
      );

      setErro(
        error?.message ||
          "Não foi possível realizar a pesquisa por foto."
      );
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="visual-modal">
        <div className="modal-header">
          <div>
            <span className="modal-kicker">
              INTELIGÊNCIA VISUAL
            </span>

            <h2>
              Pesquisar por foto
            </h2>

            <p>
              Envie uma foto e
              encontre itens
              visualmente
              semelhantes.
            </p>
          </div>

          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            disabled={
              carregando
            }
          >
            ×
          </button>
        </div>

        <div className="visual-body">
          {erro && (
            <div className="form-error">
              <span>!</span>
              {erro}
            </div>
          )}

          <button
            type="button"
            className={`visual-dropzone ${
              imagem
                ? "has-image"
                : ""
            }`}
            onClick={() =>
              inputRef.current?.click()
            }
            disabled={
              carregando
            }
          >
            {imagem ? (
              <img
                src={imagem}
                alt="Imagem da pesquisa"
              />
            ) : (
              <>
                <div className="visual-search-icon">
                  🔎
                </div>

                <strong>
                  Escolha uma foto
                </strong>

                <small>
                  Por exemplo: tire
                  uma foto de um
                  capacete para
                  encontrar
                  capacetes
                  cadastrados.
                </small>
              </>
            )}
          </button>

          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            capture="environment"
            hidden
            onChange={selecionar}
          />

          {imagem && (
            <button
              type="button"
              className="remove-photo"
              onClick={() =>
                setImagem("")
              }
              disabled={
                carregando
              }
            >
              Escolher outra foto
            </button>
          )}
        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
            disabled={
              carregando
            }
          >
            Cancelar
          </button>

          <button
            type="button"
            className="btn-primary"
            onClick={pesquisar}
            disabled={
              carregando ||
              !imagem
            }
          >
            {carregando ? (
              <>
                <span className="spinner" />
                Analisando foto...
              </>
            ) : (
              <>
                🔎
                Encontrar item
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   CARD DO ITEM
========================================================= */

function ItemCard({
  item,
  onEditar,
  onExcluir,
  onAlterarQuantidade,
}) {
  const [expandido, setExpandido] =
    useState(false);

  const fotoExibicao =
    item.imagem ||
    item.foto ||
    "";

  const categoria =
    item.status ||
    item.tipo ||
    "epi";

  const categoriaInfo =
    CATEGORIAS.find(
      (c) =>
        c.id === categoria
    );

  const categoriaNome =
    categoriaInfo?.nome ||
    "EPI";

  return (
    <article
      className={`item-card ${
        expandido
          ? "item-card-expanded"
          : "item-card-collapsed"
      }`}
    >
      {/* =====================================================
          CABEÇALHO SEMPRE VISÍVEL
      ===================================================== */}

      <button
        type="button"
        className="item-collapsed-header"
        onClick={() =>
          setExpandido(
            (atual) => !atual
          )
        }
      >
        <div className="collapsed-main">
          <div className="collapsed-title">
            <h3>
              {item.nome}
            </h3>

            {categoria ===
              "epi" &&
              item.ca && (
                <span className="ca-label">
                  CA: {item.ca}
                </span>
              )}
          </div>

          <div className="collapsed-stock">
            <span>
              Quantidade
            </span>

            <strong>
              {Number(
                item.quantidade
              ) || 0}
            </strong>
          </div>
        </div>

        <span
          className={`expand-arrow ${
            expandido
              ? "open"
              : ""
          }`}
        >
          ›
        </span>
      </button>

      {/* =====================================================
          INFORMAÇÕES EXPANDIDAS
      ===================================================== */}

      {expandido && (
        <div className="item-expanded-content">
          {/* FOTO */}

          <div className="item-image">
            {fotoExibicao ? (
              <img
                src={
                  fotoExibicao
                }
                alt={
                  item.nome
                }
                loading="lazy"
              />
            ) : (
              <div className="no-image">
                <span>
                  📦
                </span>

                <small>
                  Sem foto
                </small>
              </div>
            )}

            <span
              className={`item-badge badge-${categoria}`}
            >
              {categoriaNome}
            </span>
          </div>

          {/* INFORMAÇÕES */}

          <div className="item-content">
            <div className="item-title-row">
              <div>
                <h3>
                  {item.nome}
                </h3>

                {categoria ===
                  "epi" &&
                  item.ca && (
                    <span className="ca-label">
                      CA: {item.ca}
                    </span>
                  )}
              </div>

              <button
                type="button"
                className="edit-icon-button"
                title="Editar item"
                onClick={(e) => {
                  e.stopPropagation();
                  onEditar(item);
                }}
              >
                ✎
              </button>
            </div>

            <p className="item-description">
              {item.observacoes ||
                "Nenhuma observação cadastrada."}
            </p>

            {Array.isArray(
              item.anexos
            ) &&
              item.anexos
                .length >
                0 && (
                <span className="attachments-count">
                  📎{" "}
                  {
                    item
                      .anexos
                      .length
                  }{" "}
                  anexo
                  {item
                    .anexos
                    .length !==
                  1
                    ? "s"
                    : ""}
                </span>
              )}

            {/* ESTOQUE */}

            <div className="item-footer">
              <div className="stock">
                <span>
                  Estoque
                </span>

                <strong>
                  {Number(
                    item.quantidade
                  ) || 0}
                </strong>
              </div>

              {/* =================================================
                  BOTÕES PRINCIPAIS + E -
                  AGORA PEDEM O NÚMERO AO CLICAR
              ================================================= */}

              <div
                className="quantity-buttons"
                onClick={(e) =>
                  e.stopPropagation()
                }
              >
                <button
                  type="button"
                  onClick={() =>
                    onAlterarQuantidade(
                      item,
                      "subtrair"
                    )
                  }
                  disabled={
                    Number(
                      item.quantidade
                    ) <= 0
                  }
                  title="Retirar quantidade"
                >
                  −
                </button>

                <span>
                  {Number(
                    item.quantidade
                  ) || 0}
                </span>

                <button
                  type="button"
                  onClick={() =>
                    onAlterarQuantidade(
                      item,
                      "somar"
                    )
                  }
                  title="Adicionar quantidade"
                >
                  +
                </button>
              </div>
            </div>

            {/* EXCLUIR */}

            <button
              type="button"
              className="delete-button"
              onClick={(e) => {
                e.stopPropagation();
                onExcluir(item);
              }}
            >
              🗑 Excluir item
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

/* =========================================================
   HOME
========================================================= */

export default function Home() {
  const [items, setItems] =
    useState([]);

  const [tab, setTab] =
    useState("epi");

  const [search, setSearch] =
    useState("");

  const [modal, setModal] =
    useState(null);

  const [
    itemParaExcluir,
    setItemParaExcluir,
  ] = useState(null);

  const [
    visualResults,
    setVisualResults,
  ] = useState(null);

  const [
    carregando,
    setCarregando,
  ] = useState(false);

  /* =======================================================
     STATUS
  ======================================================= */

  const [online, setOnline] =
    useState(
      typeof navigator !==
        "undefined"
        ? navigator.onLine
        : true
    );

  const [pendentes, setPendentes] =
    useState(0);

  const [
    ultimaEdicao,
    setUltimaEdicao,
  ] = useState(null);

  const importInputRef =
    useRef(null);

  function atualizarStatus() {
    if (
      typeof navigator !==
      "undefined"
    ) {
      setOnline(
        navigator.onLine
      );
    }

    setPendentes(
      api.getPendingCount()
    );

    setUltimaEdicao(
      api.getLastEdit()
    );
  }

  useEffect(() => {
    atualizarStatus();

    window.addEventListener(
      "online",
      atualizarStatus
    );

    window.addEventListener(
      "offline",
      atualizarStatus
    );

    window.addEventListener(
      "estoque-atualizado",
      atualizarStatus
    );

    const intervalo =
      setInterval(
        atualizarStatus,
        1000
      );

    return () => {
      window.removeEventListener(
        "online",
        atualizarStatus
      );

      window.removeEventListener(
        "offline",
        atualizarStatus
      );

      window.removeEventListener(
        "estoque-atualizado",
        atualizarStatus
      );

      clearInterval(
        intervalo
      );
    };
  }, []);

  /* =======================================================
     ÚLTIMA EDIÇÃO
  ======================================================= */

  function formatarUltimaEdicao(
    data
  ) {
    if (!data) {
      return "Nenhuma edição registrada";
    }

    const dataObj =
      new Date(data);

    if (
      Number.isNaN(
        dataObj.getTime()
      )
    ) {
      return "Nenhuma edição registrada";
    }

    return dataObj.toLocaleString(
      "pt-BR",
      {
        weekday: "long",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }
    );
  }

  /* =======================================================
     BACKUP
  ======================================================= */

  async function exportarBackup() {
    try {
      const backup =
        await api.exportBackup();

      const json =
        JSON.stringify(
          backup,
          null,
          2
        );

      const blob =
        new Blob(
          [json],
          {
            type:
              "application/json",
          }
        );

      const url =
        URL.createObjectURL(
          blob
        );

      const link =
        document.createElement(
          "a"
        );

      link.href = url;

      const data =
        new Date()
          .toISOString()
          .slice(0, 10);

      link.download =
        `backup-estoque-${data}.json`;

      document.body.appendChild(
        link
      );

      link.click();

      link.remove();

      URL.revokeObjectURL(
        url
      );
    } catch (error) {
      console.error(
        "Erro ao exportar backup:",
        error
      );

      alert(
        error?.message ||
          "Não foi possível exportar o backup."
      );
    }
  }

  /* =======================================================
     IMPORTAR BACKUP
  ======================================================= */

  async function importarBackup(
    event
  ) {
    const file =
      event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      if (
        !file.name
          .toLowerCase()
          .endsWith(".json")
      ) {
        throw new Error(
          "Selecione um arquivo JSON."
        );
      }

      const texto =
        await file.text();

      const backup =
        JSON.parse(texto);

      if (
        !backup ||
        !Array.isArray(
          backup.items
        )
      ) {
        throw new Error(
          "Esse arquivo não parece ser um backup válido do Controle EPI."
        );
      }

      const confirmar =
        window.confirm(
          `O backup contém ${backup.items.length} item(ns).\n\nA restauração substituirá o estoque atual pelo conteúdo do backup.\n\nDeseja continuar?`
        );

      if (!confirmar) {
        return;
      }

      await api.importBackup(
        backup
      );

      await load();

      atualizarStatus();

      alert(
        "Backup importado com sucesso."
      );
    } catch (error) {
      console.error(
        "Erro ao importar backup:",
        error
      );

      alert(
        error?.message ||
          "Não foi possível importar o backup."
      );
    } finally {
      event.target.value = "";
    }
  }

  /* =======================================================
     CARREGAR
  ======================================================= */

  async function load() {
    try {
      setCarregando(true);

      const data =
        await api.getItems(
          search
        );

      setItems(
        Array.isArray(data)
          ? data
          : []
      );

      atualizarStatus();
    } catch (error) {
      console.error(
        "Erro ao carregar itens:",
        error
      );
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    const timer =
      setTimeout(() => {
        load();
      }, 250);

    return () =>
      clearTimeout(timer);
  }, [search]);

  /* =======================================================
     ALTERAR QUANTIDADE
  ======================================================= */

  async function alterarQuantidade(
    item,
    operacao,
    valorEscolhido
  ) {
    /*
     * Se o valor não foi informado,
     * significa que o usuário clicou
     * diretamente no + ou no -.
     *
     * Nesse caso pedimos o número.
     */

    let valor =
      valorEscolhido;

    if (
      valor === undefined ||
      valor === null
    ) {
      const resposta =
        window.prompt(
          operacao ===
            "somar"
            ? `Quantas unidades você deseja ADICIONAR ao item "${item.nome}"?`
            : `Quantas unidades você deseja RETIRAR do item "${item.nome}"?`,
          "1"
        );

      /*
       * Cancelou o prompt.
       */
      if (
        resposta === null
      ) {
        return;
      }

      const texto =
        resposta.trim();

      if (!texto) {
        alert(
          "Digite uma quantidade válida."
        );
        return;
      }

      valor =
        Number(texto);
    }

    /*
     * Aceitamos somente
     * números inteiros positivos.
     */

    if (
      !Number.isInteger(
        Number(valor)
      ) ||
      Number(valor) <= 0
    ) {
      alert(
        "Digite um número inteiro maior que zero."
      );
      return;
    }

    valor =
      Number(valor);

    /*
     * Impede retirar mais do que
     * existe no estoque.
     */

    if (
      operacao ===
        "subtrair" &&
      valor >
        Number(
          item.quantidade
        )
    ) {
      alert(
        `Não é possível retirar ${valor} unidade(s).\n\nO item "${item.nome}" possui apenas ${Number(
          item.quantidade
        ) || 0} unidade(s) em estoque.`
      );

      return;
    }

    const delta =
      operacao ===
      "somar"
        ? valor
        : -valor;

    try {
      const atualizado =
        await api.updateQty(
          item.id,
          delta
        );

      setItems(
        (anteriores) =>
          anteriores.map(
            (i) =>
              String(i.id) ===
              String(
                atualizado.id ||
                  item.id
              )
                ? {
                    ...i,
                    ...atualizado,
                  }
                : i
          )
      );

      atualizarStatus();
    } catch (error) {
      console.error(
        "Erro ao alterar quantidade:",
        error
      );

      alert(
        error?.message ||
          "Não foi possível alterar a quantidade."
      );
    }
  }

  /* =======================================================
     EXCLUIR
  ======================================================= */

  async function excluirItem() {
    if (
      !itemParaExcluir
    ) {
      return;
    }

    try {
      await api.deleteItem(
        itemParaExcluir.id
      );

      setItemParaExcluir(
        null
      );

      await load();
    } catch (error) {
      console.error(
        "Erro ao excluir:",
        error
      );

      alert(
        error?.message ||
          "Não foi possível excluir o item."
      );
    }
  }

  /* =======================================================
     FILTROS
  ======================================================= */

  const itemsExibidos =
    useMemo(() => {
      if (
        visualResults !==
        null
      ) {
        return visualResults;
      }

      return items.filter(
        (item) =>
          (item.status ||
            item.tipo) ===
          tab
      );
    }, [
      items,
      tab,
      visualResults,
    ]);

  const contadores =
    useMemo(() => {
      return {
        epi: items.filter(
          (i) =>
            (i.status ||
              i.tipo) ===
            "epi"
        ).length,

        material:
          items.filter(
            (i) =>
              (i.status ||
                i.tipo) ===
              "material"
          ).length,

        uniforme:
          items.filter(
            (i) =>
              (i.status ||
                i.tipo) ===
              "uniforme"
          ).length,
      };
    }, [items]);

  function limparPesquisaVisual() {
    setVisualResults(
      null
    );
  }

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon">
            E
          </div>

          <div>
            <strong>
              Controle EPI
            </strong>

            <span>
              Gestão de estoque
            </span>
          </div>
        </div>

        <div className="topbar-status-area">
          <div
            className={`topbar-status ${
              online
                ? "online"
                : "offline"
            }`}
          >
            <span className="status-dot" />

            {online
              ? "Sistema online"
              : "Modo offline"}
          </div>

          {pendentes > 0 && (
            <div className="sync-pending">
              ⟳ {pendentes}{" "}
              alteração
              {pendentes !== 1
                ? "ões"
                : ""}{" "}
              pendente
              {pendentes !== 1
                ? "s"
                : ""}
            </div>
          )}
        </div>
      </header>

      <main className="main-content">
        <div className="page-heading">
          <div>
            <span className="page-kicker">
              ESTOQUE
            </span>

            <h1>
              Controle de materiais
            </h1>

            <p>
              Gerencie EPIs,
              materiais e
              uniformes em um
              só lugar.
            </p>
          </div>

          <button
            type="button"
            className="new-item-button"
            onClick={() =>
              setModal({
                tipo: "item",
                item: null,
              })
            }
          >
            <span>+</span>
            Novo item
          </button>
        </div>

        <div className="toolbar">
          <div className="last-edit-bar">
            <div className="last-edit-info">
              <span className="last-edit-icon">
                🕒
              </span>

              <div>
                <strong>
                  Última edição
                </strong>

                <span>
                  {formatarUltimaEdicao(
                    ultimaEdicao
                  )}
                </span>
              </div>
            </div>

            <div className="backup-actions">
              <button
                type="button"
                className="backup-button"
                onClick={
                  exportarBackup
                }
              >
                ↓ Exportar JSON
              </button>

              <button
                type="button"
                className="backup-button"
                onClick={() =>
                  importInputRef.current?.click()
                }
              >
                ↑ Importar JSON
              </button>

              <input
                ref={
                  importInputRef
                }
                type="file"
                accept=".json,application/json"
                hidden
                onChange={
                  importarBackup
                }
              />
            </div>
          </div>

          <div className="search-box">
            <span>⌕</span>

            <input
              value={search}
              onChange={(e) => {
                setSearch(
                  e.target.value
                );

                setVisualResults(
                  null
                );
              }}
              placeholder="Pesquisar por nome, CA ou observação..."
            />

            {search && (
              <button
                type="button"
                onClick={() =>
                  setSearch("")
                }
              >
                ×
              </button>
            )}
          </div>

          <button
            type="button"
            className="photo-search-button"
            onClick={() =>
              setModal({
                tipo: "visual",
              })
            }
          >
            <span>📷</span>
            Pesquisar por foto
          </button>
        </div>

        {visualResults !==
          null && (
          <div className="visual-results-banner">
            <div>
              <strong>
                Resultados da pesquisa
                visual
              </strong>

              <span>
                Foram encontrados{" "}
                {
                  visualResults.length
                }{" "}
                itens semelhantes.
              </span>
            </div>

            <button
              type="button"
              onClick={
                limparPesquisaVisual
              }
            >
              Voltar ao estoque
            </button>
          </div>
        )}

        {visualResults ===
          null && (
          <div className="tabs">
            {CATEGORIAS.map(
              (categoria) => (
                <button
                  type="button"
                  key={
                    categoria.id
                  }
                  className={
                    tab ===
                    categoria.id
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    setTab(
                      categoria.id
                    )
                  }
                >
                  <span>
                    {
                      categoria.icone
                    }
                  </span>

                  {
                    categoria.nome
                  }

                  <small>
                    {
                      contadores[
                        categoria.id
                      ]
                    }
                  </small>
                </button>
              )
            )}
          </div>
        )}

        {carregando ? (
          <div className="loading-state">
            <div className="loading-spinner" />

            <strong>
              Carregando estoque...
            </strong>
          </div>
        ) : itemsExibidos.length ===
          0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              📦
            </div>

            <h2>
              Nenhum item encontrado
            </h2>

            <p>
              {visualResults !==
              null
                ? "Não encontramos itens visualmente semelhantes a essa foto."
                : search
                ? "Tente pesquisar por outro termo."
                : "Comece cadastrando seu primeiro item."}
            </p>

            {visualResults ===
              null &&
              !search && (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() =>
                    setModal({
                      tipo: "item",
                      item: null,
                    })
                  }
                >
                  + Cadastrar primeiro
                  item
                </button>
              )}
          </div>
        ) : (
          <div className="items-grid">
            {itemsExibidos.map(
              (item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  onEditar={(i) =>
                    setModal({
                      tipo: "item",
                      item: i,
                    })
                  }
                  onExcluir={(i) =>
                    setItemParaExcluir(
                      i
                    )
                  }
                  onAlterarQuantidade={
                    alterarQuantidade
                  }
                />
              )
            )}
          </div>
        )}
      </main>

      {modal?.tipo ===
        "item" && (
        <ItemModal
          item={modal.item}
          onClose={() =>
            setModal(null)
          }
          onSaved={load}
        />
      )}

      {modal?.tipo ===
        "visual" && (
        <VisualSearchModal
          onClose={() =>
            setModal(null)
          }
          onResults={(
            resultados
          ) =>
            setVisualResults(
              resultados
            )
          }
        />
      )}

      {itemParaExcluir && (
        <ModalConfirmacao
          titulo="Excluir item?"
          texto={`O item "${itemParaExcluir.nome}" será removido do estoque. Essa ação não pode ser desfeita.`}
          onCancelar={() =>
            setItemParaExcluir(
              null
            )
          }
          onConfirmar={
            excluirItem
          }
        />
      )}
    </div>
  );
}