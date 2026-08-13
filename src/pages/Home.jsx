import React, { useEffect, useMemo, useRef, useState } from "react";
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


async function arquivoParaDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;

    reader.readAsDataURL(file);
  });
}

async function imagemOtimizada(file) {
  if (!file.type.startsWith("image/")) {
    return arquivoParaDataURL(file);
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const img = new Image();

      img.onload = () => {
        const limite = 1400;

        let width = img.width;
        let height = img.height;

        if (width > limite || height > limite) {
          if (width > height) {
            height = Math.round((height * limite) / width);
            width = limite;
          } else {
            width = Math.round((width * limite) / height);
            height = limite;
          }
        }

        const canvas = document.createElement("canvas");

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");

        ctx.drawImage(img, 0, 0, width, height);

        resolve(
          canvas.toDataURL("image/jpeg", 0.82)
        );
      };

      img.onerror = reject;
      img.src = reader.result;
    };

    reader.onerror = reject;

    reader.readAsDataURL(file);
  });
}

function ModalConfirmacao({
  titulo,
  texto,
  onCancelar,
  onConfirmar,
}) {
  return (
    <div className="modal-overlay">
      <div className="confirm-modal">
        <div className="confirm-icon">⚠️</div>

        <h2>{titulo}</h2>

        <p>{texto}</p>

        <div className="confirm-actions">
          <button
            className="btn-secondary"
            onClick={onCancelar}
          >
            Cancelar
          </button>

          <button
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

function ItemModal({
  item,
  onClose,
  onSaved,
}) {
  const editando = Boolean(item);

  const [nome, setNome] = useState(item?.nome || "");
  const [quantidade, setQuantidade] = useState(
    item?.quantidade || 0
  );
  const [status, setStatus] = useState(
    item?.status || item?.tipo || "epi"
  );
  const [ca, setCa] = useState(item?.ca || "");
  const [observacoes, setObservacoes] = useState(
    item?.observacoes || ""
  );
  const [imagem, setImagem] = useState(item?.imagem || item?.foto || "");

  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const fotoInputRef = useRef(null);

  async function selecionarFoto(e) {
    const file = e.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setErro("A foto principal precisa ser uma imagem.");
      return;
    }

    try {
      setErro("");

      const dataUrl = await imagemOtimizada(file);

      setImagem(dataUrl);
    } catch {
      setErro("Não foi possível carregar a foto.");
    }

    e.target.value = "";
  }

  

  function alterarQuantidade(valor) {
    setQuantidade((atual) =>
      Math.max(0, Number(atual || 0) + valor)
    );
  }

  async function salvar() {
    if (!nome.trim()) {
      setErro("Digite o nome do item.");
      return;
    }

    setSalvando(true);
    setErro("");

    try {
      const dados = {
  nome: nome.trim(),
  quantidade: Number(quantidade) || 0,
  status,
  tipo: status,
  ca: status === "epi" ? ca.trim() : "",
  observacoes: observacoes.trim(),
  imagem,
  foto: imagem,
};

      if (editando) {
        await api.updateItem(item.id, dados);
      } else {
        await api.createItem(dados);
      }

      onSaved();
      onClose();
    } catch (error) {
      setErro(
        error.message ||
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
              Preencha as informações do item abaixo.
            </p>
          </div>

          <button
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
                <span>Nome do item *</span>

                <input
                  value={nome}
                  onChange={(e) =>
                    setNome(e.target.value)
                  }
                  placeholder="Ex.: Capacete de segurança"
                  autoFocus
                />
              </label>

              <div className="field field-full">
                <span>Categoria do item *</span>

                <div className="category-grid">
                  {CATEGORIAS.map((categoria) => (
                    <button
                      type="button"
                      key={categoria.id}
                      className={`category-option ${
                        status === categoria.id
                          ? "selected"
                          : ""
                      }`}
                      onClick={() =>
                        setStatus(categoria.id)
                      }
                    >
                      <span className="category-icon">
                        {categoria.icone}
                      </span>

                      <span>
                        <strong>
                          {categoria.nome}
                        </strong>

                        <small>
                          {categoria.descricao}
                        </small>
                      </span>

                      <span className="radio-dot" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="field">
                <span>Quantidade</span>

                <div className="quantity-editor">
                  <button
                    type="button"
                    onClick={() =>
                      alterarQuantidade(-1)
                    }
                  >
                    −
                  </button>

                  <input
                    type="number"
                    min="0"
                    value={quantidade}
                    onChange={(e) =>
                      setQuantidade(
                        Math.max(
                          0,
                          Number(e.target.value) || 0
                        )
                      )
                    }
                  />

                  <button
                    type="button"
                    onClick={() =>
                      alterarQuantidade(1)
                    }
                  >
                    +
                  </button>
                </div>
              </div>

              {status === "epi" && (
                <label className="field">
                  <span>CA</span>

                  <input
                    value={ca}
                    onChange={(e) =>
                      setCa(e.target.value)
                    }
                    placeholder="Ex.: 12345"
                  />
                </label>
              )}

              <label className="field field-full">
                <span>Observações</span>

                <textarea
                  value={observacoes}
                  onChange={(e) =>
                    setObservacoes(e.target.value)
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
                imagem ? "has-image" : ""
              }`}
              onClick={() =>
                fotoInputRef.current?.click()
              }
            >
              {imagem ? (
                <>
                  <img
                    src={imagem}
                    alt={nome || "Item"}
                  />

                  <div className="photo-overlay">
                    <span>📷</span>
                    <strong>
                      Alterar foto
                    </strong>
                    <small>
                      Clique para selecionar outra
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
                    A foto também será usada na
                    pesquisa inteligente por imagem.
                  </small>
                </div>
              )}
            </div>

            <input
  ref={fotoInputRef}
  type="file"
  accept="image/*"
  capture="environment"
  hidden
  onChange={selecionarFoto}
/>

            {imagem && (
              <button
                type="button"
                className="remove-photo"
                onClick={() => setImagem("")}
              >
                Remover foto
              </button>
            )}
          </section>

          
        </div>

        <div className="modal-footer">
          <button
            className="btn-secondary"
            onClick={onClose}
            disabled={salvando}
          >
            Cancelar
          </button>

          <button
            className="btn-primary"
            onClick={salvar}
            disabled={salvando}
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

function VisualSearchModal({
  onClose,
  onResults,
}) {
  const inputRef = useRef(null);

  const [imagem, setImagem] = useState("");
  const [carregando, setCarregando] =
    useState(false);
  const [erro, setErro] = useState("");

  async function selecionar(e) {
    const file = e.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setErro("Selecione uma imagem.");
      return;
    }

    try {
      setErro("");

      const dataUrl =
        await imagemOtimizada(file);

      setImagem(dataUrl);
    } catch {
      setErro(
        "Não foi possível carregar a imagem."
      );
    }

    e.target.value = "";
  }

  async function pesquisar() {
    if (!imagem) {
      setErro(
        "Selecione uma foto para pesquisar."
      );
      return;
    }

    setCarregando(true);
    setErro("");

    try {
      const resposta =
        await api.searchByImage(imagem);

      onResults(
        resposta.resultados || []
      );

      onClose();
    } catch (error) {
      setErro(
        error.message ||
          "Erro na pesquisa visual."
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

            <h2>Pesquisar por foto</h2>

            <p>
              Envie uma foto e encontre itens
              visualmente semelhantes.
            </p>
          </div>

          <button
            className="modal-close"
            onClick={onClose}
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
            className={`visual-dropzone ${
              imagem ? "has-image" : ""
            }`}
            onClick={() =>
              inputRef.current?.click()
            }
          >
            {imagem ? (
              <img
                src={imagem}
                alt="Pesquisa"
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
                  Por exemplo: tire uma foto de
                  um capacete para encontrar
                  capacetes cadastrados.
                </small>
              </>
            )}
          </button>

         <input
  ref={inputRef}
  type="file"
  accept="image/*"
  capture="environment"
  hidden
  onChange={selecionar}
/>
        </div>

        <div className="modal-footer">
          <button
            className="btn-secondary"
            onClick={onClose}
            disabled={carregando}
          >
            Cancelar
          </button>

          <button
            className="btn-primary"
            onClick={pesquisar}
            disabled={carregando}
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

function ItemCard({ item, onEditar, onExcluir, onAlterarQuantidade }) {
  const [expandido, setExpandido] = useState(false);
  const [qtdDigito, setQtdDigito] = useState(1);

  const fotoExibicao = item.imagem || item.foto;

  return (
    <div className="item-card">
      <div
        onClick={() => setExpandido(!expandido)}
        style={{
          cursor: "pointer",
          display: "flex",
          justifyContent: "space-between",
          padding: "12px",
        }}
      >
        <div>
          <strong>{item.nome}</strong>

          {item.ca && (
            <span
              style={{
                marginLeft: "10px",
                color: "#666",
              }}
            >
              CA: {item.ca}
            </span>
          )}
        </div>

        <div>
          <span>Qtd: {item.quantidade}</span>{" "}
          {expandido ? "▲" : "▼"}
        </div>
      </div>

      {expandido && (
        <div
          style={{
            padding: "12px",
            borderTop: "1px solid #eee",
          }}
        >
          {fotoExibicao && (
            <img
              src={fotoExibicao}
              alt={item.nome}
              style={{
                maxHeight: "150px",
              }}
            />
          )}

          {item.observacoes && (
            <p>Obs: {item.observacoes}</p>
          )}

          <div
            style={{
              display: "flex",
              gap: "8px",
              margin: "10px 0",
            }}
          >
            <input
              type="number"
              min="1"
              value={qtdDigito}
              onChange={(e) =>
                setQtdDigito(
                  Number(e.target.value) || 1
                )
              }
              style={{
                width: "60px",
                textAlign: "center",
              }}
            />

            <button
              onClick={() =>
                onAlterarQuantidade(
                  item,
                  "subtrair",
                  qtdDigito
                )
              }
            >
              -
            </button>

            <button
              onClick={() =>
                onAlterarQuantidade(
                  item,
                  "somar",
                  qtdDigito
                )
              }
            >
              +
            </button>
          </div>

          <div
            style={{
              display: "flex",
              gap: "8px",
            }}
          >
            <button onClick={() => onEditar(item)}>
              Editar
            </button>

            <button onClick={() => onExcluir(item)}>
              Excluir
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const [items, setItems] = useState([]);
  const [tab, setTab] = useState("epi");
  const [search, setSearch] = useState("");

  const [modal, setModal] = useState(null);

  const [itemParaExcluir, setItemParaExcluir] =
    useState(null);

  const [visualResults, setVisualResults] =
    useState(null);

  const [carregando, setCarregando] =
    useState(false);

  async function load() {
    try {
      setCarregando(true);

      const data = await api.getItems(search);

      setItems(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      load();
    }, 250);

    return () => clearTimeout(timer);
  }, [search]);

  async function alterarQuantidade(item, operacao, valorEscolhido) {
  const valor = Number(valorEscolhido || 1);

  if (!Number.isInteger(valor) || valor <= 0) return;

  const delta = operacao === "somar" ? valor : -valor;

  try {
    const atualizado = await api.updateQty(item.id, delta);

    setItems((anteriores) =>
      anteriores.map((i) =>
        i.id === (atualizado.id || item.id)
          ? {
              ...i,
              quantidade:
                atualizado.quantidade !== undefined
                  ? atualizado.quantidade
                  : i.quantidade + delta,
              imagem: atualizado.imagem || i.imagem,
              foto: atualizado.foto || i.foto,
            }
          : i
      )
    );
  } catch (error) {
    console.error(error);
  }
}

  async function excluirItem() {
    if (!itemParaExcluir) return;

    try {
      await api.deleteItem(
        itemParaExcluir.id
      );

      setItemParaExcluir(null);

      await load();
    } catch (error) {
      console.error(error);
    }
  }

  const itemsExibidos = useMemo(() => {
    if (visualResults !== null) {
      return visualResults;
    }

    return items.filter(
      (item) =>
        (item.status || item.tipo) === tab
    );
  }, [
    items,
    tab,
    visualResults,
  ]);

  const contadores = useMemo(() => {
    return {
      epi: items.filter(
        (i) =>
          (i.status || i.tipo) === "epi"
      ).length,

      material: items.filter(
        (i) =>
          (i.status || i.tipo) ===
          "material"
      ).length,

      uniforme: items.filter(
        (i) =>
          (i.status || i.tipo) ===
          "uniforme"
      ).length,
    };
  }, [items]);

  function limparPesquisaVisual() {
    setVisualResults(null);
  }

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

        <div className="topbar-status">
          <span className="status-dot" />
          Sistema online
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
              Gerencie EPIs, materiais e
              uniformes em um só lugar.
            </p>
          </div>

          <button
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
          <div className="search-box">
            <span>⌕</span>

            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setVisualResults(null);
              }}
              placeholder="Pesquisar por nome, CA ou observação..."
            />

            {search && (
              <button
                onClick={() => setSearch("")}
              >
                ×
              </button>
            )}
          </div>

          <button
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

        {visualResults !== null && (
          <div className="visual-results-banner">
            <div>
              <strong>
                Resultados da pesquisa visual
              </strong>

              <span>
                Foram encontrados{" "}
                {visualResults.length} itens
                semelhantes.
              </span>
            </div>

            <button
              onClick={
                limparPesquisaVisual
              }
            >
              Voltar ao estoque
            </button>
          </div>
        )}

        {visualResults === null && (
          <div className="tabs">
            {CATEGORIAS.map((categoria) => (
              <button
                key={categoria.id}
                className={
                  tab === categoria.id
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setTab(categoria.id)
                }
              >
                <span>
                  {categoria.icone}
                </span>

                {categoria.nome}

                <small>
                  {contadores[
                    categoria.id
                  ]}
                </small>
              </button>
            ))}
          </div>
        )}

        {carregando ? (
          <div className="loading-state">
            <div className="loading-spinner" />
            <strong>
              Carregando estoque...
            </strong>
          </div>
        ) : itemsExibidos.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              📦
            </div>

            <h2>
              Nenhum item encontrado
            </h2>

            <p>
              {visualResults !== null
                ? "Não encontramos itens visualmente semelhantes a essa foto."
                : search
                ? "Tente pesquisar por outro termo."
                : "Comece cadastrando seu primeiro item."}
            </p>

            {visualResults === null &&
              !search && (
                <button
                  className="btn-primary"
                  onClick={() =>
                    setModal({
                      tipo: "item",
                      item: null,
                    })
                  }
                >
                  + Cadastrar primeiro item
                </button>
              )}
          </div>
        ) : (
  <div className="items-grid">
    {itemsExibidos.map((item) => (
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
          setItemParaExcluir(i)
        }
        onAlterarQuantidade={alterarQuantidade}
      />
    ))}
  </div>
)}
      </main>

      {modal?.tipo === "item" && (
        <ItemModal
          item={modal.item}
          onClose={() => setModal(null)}
          onSaved={load}
        />
      )}

      {modal?.tipo === "visual" && (
        <VisualSearchModal
          onClose={() => setModal(null)}
          onResults={(resultados) =>
            setVisualResults(resultados)
          }
        />
      )}

      {itemParaExcluir && (
        <ModalConfirmacao
          titulo="Excluir item?"
          texto={`O item "${itemParaExcluir.nome}" será removido do estoque. Essa ação não pode ser desfeita.`}
          onCancelar={() =>
            setItemParaExcluir(null)
          }
          onConfirmar={excluirItem}
        />
      )}
    </div>
  );
}