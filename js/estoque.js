const CAMINHO_CSV = "data/cartas.csv";
const WHATSAPP_NUMERO = "553180253809";

let cartas = [];
let pedido = [];

const buscaInput = document.getElementById("busca");
const sugestoesBox = document.getElementById("sugestoes");
const topCartasEl = document.getElementById("top-cartas");
const gridCartasEl = document.getElementById("grid-cartas");
const pedidoListaEl = document.getElementById("pedido");
const pedidoVazioEl = document.getElementById("pedido-vazio");
const pedidoTotalEl = document.getElementById("pedido-total");
const resultadoInfoEl = document.getElementById("resultado-info");
const limparPedidoBtn = document.getElementById("limpar-pedido");

function normalizarPreco(valor) {
  if (valor === undefined || valor === null) return 0;

  return Number(
    String(valor)
      .trim()
      .replace(/\r/g, "")
      .replace(/\s+/g, "")
      .replace(",", ".")
  ) || 0;
}

async function carregarCartas() {
  if (!gridCartasEl) return;

  try {
    const resposta = await fetch(CAMINHO_CSV);
    if (!resposta.ok) {
      throw new Error("Não foi possível carregar o CSV.");
    }

    const texto = await resposta.text();

    const linhas = texto
      .split(/\r?\n/)
      .map((linha) => linha.trim())
      .filter((linha) => linha.length > 0);

    const dados = linhas.slice(1);

    const cartasBase = dados
      .map((linha) => {
        const partes = linha.split(",");
        const nome = (partes[0] || "").trim();
        const preco = normalizarPreco(partes[1]);
        const estoque = Number((partes[2] || "0").trim().replace(/\r/g, "")) || 0;

        return { nome, preco, estoque };
      })
      .filter((carta) => carta.nome);

    cartas = await Promise.all(
      cartasBase.map(async (carta) => {
        const imagem = await buscarImagemCarta(carta.nome);
        return { ...carta, img: imagem };
      })
    );

    mostrarTopCartas();
    mostrarCartas(cartas);
    atualizarInfoResultado(cartas.length);
  } catch (erro) {
    console.error(erro);
    gridCartasEl.innerHTML = `
      <div class="estado-vazio">
        Não foi possível carregar as cartas. Verifique se o arquivo <strong>data/cartas.csv</strong> existe e se o projeto está rodando em um servidor local.
      </div>
    `;
    if (topCartasEl) topCartasEl.innerHTML = "";
  }
}

async function buscarImagemCarta(nome) {
  try {
    const api = await fetch(`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(nome)}`);
    if (!api.ok) return placeholderImagem();

    const data = await api.json();

    if (data.image_uris && data.image_uris.normal) {
      return data.image_uris.normal;
    }

    if (data.card_faces && data.card_faces[0]?.image_uris?.normal) {
      return data.card_faces[0].image_uris.normal;
    }

    return placeholderImagem();
  } catch (erro) {
    return placeholderImagem();
  }
}

function placeholderImagem() {
  return "https://via.placeholder.com/488x680?text=Sem+Imagem";
}

function formatarPreco(valor) {
  return Number(valor).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function escaparTexto(texto) {
  return String(texto)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function mostrarTopCartas() {
  if (!topCartasEl) return;

  const top = [...cartas]
    .sort((a, b) => b.preco - a.preco)
    .slice(0, 4);

  if (!top.length) {
    topCartasEl.innerHTML = `<div class="estado-vazio">Nenhuma carta encontrada.</div>`;
    return;
  }

  topCartasEl.innerHTML = top.map((carta) => montarCardCarta(carta)).join("");
}

function mostrarCartas(lista) {
  if (!gridCartasEl) return;

  if (!lista.length) {
    gridCartasEl.innerHTML = `<div class="estado-vazio">Nenhuma carta corresponde à busca.</div>`;
    atualizarInfoResultado(0);
    return;
  }

  gridCartasEl.innerHTML = lista.map((carta) => montarCardCarta(carta)).join("");
  atualizarInfoResultado(lista.length);
}

function montarCardCarta(carta) {
  const nomeSeguro = escaparTexto(carta.nome);

  return `
    <div class="carta">
      <img src="${carta.img}" alt="${nomeSeguro}">
      <h4>${nomeSeguro}</h4>
      <p class="preco">${formatarPreco(carta.preco)}</p>
      <p class="estoque">Estoque: ${carta.estoque}</p>
      <div class="carta-acoes">
        <button type="button" onclick="addPedido('${carta.nome.replace(/'/g, "\\'")}')">
          Adicionar ao pedido
        </button>
      </div>
    </div>
  `;
}

function atualizarInfoResultado(qtd) {
  if (!resultadoInfoEl) return;
  resultadoInfoEl.textContent = `${qtd} ${qtd === 1 ? "resultado" : "resultados"}`;
}

function addPedido(nome) {
  const carta = cartas.find((item) => item.nome === nome);
  if (!carta) return;

  const existente = pedido.find((item) => item.nome === nome);

  if (existente) {
    existente.quantidade += 1;
  } else {
    pedido.push({
      nome: carta.nome,
      preco: carta.preco,
      quantidade: 1
    });
  }

  renderPedido();
}

function removerPedido(nome) {
  pedido = pedido
    .map((item) => {
      if (item.nome === nome) {
        return { ...item, quantidade: item.quantidade - 1 };
      }
      return item;
    })
    .filter((item) => item.quantidade > 0);

  renderPedido();
}

function limparPedido() {
  pedido = [];
  renderPedido();
}

function renderPedido() {
  if (!pedidoListaEl || !pedidoVazioEl || !pedidoTotalEl) return;

  if (!pedido.length) {
    pedidoListaEl.innerHTML = "";
    pedidoVazioEl.style.display = "block";
    pedidoTotalEl.textContent = formatarPreco(0);
    return;
  }

  pedidoVazioEl.style.display = "none";

  pedidoListaEl.innerHTML = pedido.map((item) => {
    const subtotal = item.preco * item.quantidade;

    return `
      <li>
        <div class="pedido-item-info">
          <strong>${escaparTexto(item.nome)}</strong>
          <small>${item.quantidade}x • ${formatarPreco(item.preco)} cada • subtotal ${formatarPreco(subtotal)}</small>
        </div>
        <button type="button" class="pedido-remover" onclick="removerPedido('${item.nome.replace(/'/g, "\\'")}')">
          Remover
        </button>
      </li>
    `;
  }).join("");

  const total = pedido.reduce((acc, item) => acc + (item.preco * item.quantidade), 0);
  pedidoTotalEl.textContent = formatarPreco(total);
}

function enviarPedido() {
  if (!pedido.length) {
    alert("Adicione pelo menos uma carta ao pedido.");
    return;
  }

  let mensagem = "Olá, tenho interesse nas seguintes cartas:\n\n";

  pedido.forEach((item) => {
    mensagem += `- ${item.quantidade}x ${item.nome}\n`;
  });

  const total = pedido.reduce((acc, item) => acc + (item.preco * item.quantidade), 0);
  mensagem += `\nTotal estimado: ${formatarPreco(total)}`;

  const url = `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(mensagem)}`;
  window.open(url, "_blank");
}

function mostrarSugestoes(lista) {
  if (!sugestoesBox) return;

  if (!lista.length) {
    sugestoesBox.innerHTML = "";
    sugestoesBox.classList.remove("show");
    return;
  }

  sugestoesBox.innerHTML = lista.map((carta) => `
    <div class="sugestao" onclick="selecionarCarta('${carta.nome.replace(/'/g, "\\'")}')">
      <img src="${carta.img}" alt="${escaparTexto(carta.nome)}">
      <div class="sugestao-info">
        <span>${escaparTexto(carta.nome)}</span>
        <small>${formatarPreco(carta.preco)}</small>
      </div>
    </div>
  `).join("");

  sugestoesBox.classList.add("show");
}

function selecionarCarta(nome) {
  if (!buscaInput) return;

  buscaInput.value = nome;
  esconderSugestoes();

  const filtrado = cartas.filter((carta) =>
    carta.nome.toLowerCase().includes(nome.toLowerCase())
  );

  mostrarCartas(filtrado);
}

function esconderSugestoes() {
  if (!sugestoesBox) return;
  sugestoesBox.innerHTML = "";
  sugestoesBox.classList.remove("show");
}

function configurarBusca() {
  if (!buscaInput) return;

  buscaInput.addEventListener("input", function () {
    const termo = this.value.trim().toLowerCase();

    if (termo.length === 0) {
      esconderSugestoes();
      mostrarCartas(cartas);
      return;
    }

    const filtrado = cartas.filter((carta) =>
      carta.nome.toLowerCase().includes(termo)
    );

    mostrarCartas(filtrado);
    mostrarSugestoes(filtrado.slice(0, 6));
  });

  buscaInput.addEventListener("focus", function () {
    const termo = this.value.trim().toLowerCase();
    if (!termo) return;

    const filtrado = cartas.filter((carta) =>
      carta.nome.toLowerCase().includes(termo)
    );

    mostrarSugestoes(filtrado.slice(0, 6));
  });

  document.addEventListener("click", function (evento) {
    const clicouNaBusca = buscaInput && buscaInput.contains(evento.target);
    const clicouNasSugestoes = sugestoesBox && sugestoesBox.contains(evento.target);

    if (!clicouNaBusca && !clicouNasSugestoes) {
      esconderSugestoes();
    }
  });
}

if (limparPedidoBtn) {
  limparPedidoBtn.addEventListener("click", limparPedido);
}

configurarBusca();
carregarCartas();