/* =============================================================
   ADMIN, PARTE 11: datas comemorativas no Calendário
   As datas do ano que rendem conteúdo ou venda (comércio, tech,
   lifestyle e feriados), cada uma com o botão "+ Pauta", que já
   abre o post na agenda com o nome da data. As móveis (Páscoa,
   Carnaval, Dia das Mães, Dia dos Pais, Black Friday) são
   calculadas para cada ano.
   ============================================================= */
const TIPOS_DATA = { feriado: "Feriado", comercio: "Comércio", tech: "Tech", lifestyle: "Lifestyle" };
const DATAS_FIXAS = [
  ["01-01", "Confraternização Universal", "feriado"],
  ["03-08", "Dia Internacional da Mulher", "lifestyle"],
  ["03-15", "Dia do Consumidor", "comercio"],
  ["03-20", "Dia Internacional da Felicidade", "lifestyle"],
  ["04-01", "Dia da Mentira", "lifestyle"],
  ["04-07", "Dia Mundial da Saúde", "lifestyle"],
  ["04-21", "Tiradentes", "feriado"],
  ["04-22", "Dia da Terra", "lifestyle"],
  ["04-23", "Dia Mundial do Livro", "lifestyle"],
  ["05-01", "Dia do Trabalho", "feriado"],
  ["05-04", "Star Wars Day", "tech"],
  ["05-17", "Dia da Internet", "tech"],
  ["05-24", "Dia Nacional do Café", "lifestyle"],
  ["05-25", "Dia do Orgulho Nerd", "tech"],
  ["06-05", "Dia Mundial do Meio Ambiente", "lifestyle"],
  ["06-12", "Dia dos Namorados", "comercio"],
  ["06-24", "São João", "lifestyle"],
  ["06-28", "Dia do Orgulho LGBTQIA+", "lifestyle"],
  ["06-30", "Dia Mundial das Redes Sociais", "tech"],
  ["07-13", "Dia Mundial do Rock", "lifestyle"],
  ["07-17", "Dia Mundial do Emoji", "tech"],
  ["07-20", "Dia do Amigo", "lifestyle"],
  ["07-26", "Dia dos Avós", "comercio"],
  ["08-19", "Dia Mundial da Fotografia", "tech"],
  ["08-29", "Dia do Gamer", "tech"],
  ["09-07", "Independência do Brasil", "feriado"],
  ["09-09", "9.9 (ofertas dos marketplaces)", "comercio"],
  ["09-15", "Dia do Cliente", "comercio"],
  ["09-21", "Dia da Árvore", "lifestyle"],
  ["10-01", "Dia Internacional do Café", "lifestyle"],
  ["10-05", "Dia da Micro e Pequena Empresa", "comercio"],
  ["10-10", "10.10 (ofertas dos marketplaces)", "comercio"],
  ["10-12", "Dia das Crianças", "comercio"],
  ["10-15", "Dia do Professor", "lifestyle"],
  ["10-31", "Halloween", "lifestyle"],
  ["11-02", "Finados", "feriado"],
  ["11-11", "11.11 (ofertas dos marketplaces)", "comercio"],
  ["11-15", "Proclamação da República", "feriado"],
  ["11-20", "Dia da Consciência Negra", "feriado"],
  ["12-12", "12.12 (ofertas dos marketplaces)", "comercio"],
  ["12-25", "Natal", "feriado"],
  ["12-31", "Réveillon", "comercio"]
];
// Domingo de Páscoa (cálculo de Meeus, calendário gregoriano)
function pascoa(ano) {
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(ano, mes - 1, dia);
}
const maisDias = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
// O n-ésimo dia da semana do mês (ex.: 2º domingo de maio)
const enesimo = (ano, mes, diaSemana, n) => { const p = new Date(ano, mes, 1); return new Date(ano, mes, 1 + ((diaSemana - p.getDay() + 7) % 7) + (n - 1) * 7); };
const cacheDatas = {};
function datasDoAno(ano) {
  if (cacheDatas[ano]) return cacheDatas[ano];
  const l = DATAS_FIXAS.map(([md, nome, tipo]) => ({ iso: `${ano}-${md}`, nome, tipo }));
  const px = pascoa(ano), quintaNov = enesimo(ano, 10, 4, 4), bf = maisDias(quintaNov, 1);
  [[maisDias(px, -47), "Carnaval", "feriado"], [maisDias(px, -2), "Sexta-feira Santa", "feriado"], [px, "Páscoa", "comercio"], [maisDias(px, 60), "Corpus Christi", "feriado"],
   [enesimo(ano, 4, 0, 2), "Dia das Mães", "comercio"], [enesimo(ano, 7, 0, 2), "Dia dos Pais", "comercio"],
   [maisDias(new Date(ano, 0, 1), 255), "Dia do Programador", "tech"], [bf, "Black Friday", "comercio"], [maisDias(bf, 3), "Cyber Monday", "comercio"]]
    .forEach(([d, nome, tipo]) => l.push({ iso: isoLocal(d), nome, tipo }));
  l.sort((a, b) => a.iso.localeCompare(b.iso));
  return (cacheDatas[ano] = l);
}
const datasEm = (iso) => datasDoAno(Number(iso.slice(0, 4))).filter((x) => x.iso === iso);
const mostrarDatas = () => { try { return localStorage.getItem("cal-datas") !== "0"; } catch (_) { return true; } };

// Dentro do quadradinho do dia
function datasDoDia(iso, doMes) {
  if (!mostrarDatas() || !doMes) return "";
  const l = datasEm(iso);
  if (!l.length) return "";
  return `<div class="cal-datas">${l.slice(0, 2).map((x) => `<span class="cal-data d-${x.tipo}" title="${esc(x.nome)}">${esc(x.nome)}</span>`).join("")}${l.length > 2 ? `<span class="cal-data">+${l.length - 2}</span>` : ""}</div>`;
}
// A lista do mês, embaixo do calendário
function datasDoMesHTML(ano, mes) {
  const l = datasDoAno(ano).filter((x) => Number(x.iso.slice(5, 7)) === mes + 1);
  const nome = MESES_LONGOS[mes].toLowerCase();
  return `<div class="cartao cal-datas-mes">
    <div class="barra" style="margin-bottom:8px"><h2 style="margin:0">Datas de ${nome}</h2><span class="espaco"></span>
      <label class="check"><input type="checkbox" data-cal-mostrar ${mostrarDatas() ? "checked" : ""}> Mostrar no calendário</label></div>
    ${l.length ? `<ul class="cal-datas-lista">${l.map((x) => { const d = deISO(x.iso); return `<li>
      <span class="cal-dl-dia"><b>${d.getDate()}</b><small>${DIAS_SEMANA[d.getDay()].slice(0, 3)}</small></span>
      <span class="cal-dl-nome"><b>${esc(x.nome)}</b><small><i class="d-${x.tipo}"></i>${TIPOS_DATA[x.tipo]}</small></span>
      <button type="button" class="btn pequeno" data-pauta="${x.iso}|${esc(x.nome)}">${ic("mais")}Pauta</button></li>`; }).join("")}</ul>` : `<p class="vazio">Nenhuma data marcada neste mês.</p>`}
    <p class="sub" style="margin:10px 0 0">A pauta entra na agenda alguns dias antes da data, pra dar tempo de gravar. Você muda o dia no formulário.</p>
  </div>`;
}
// "+ Pauta": abre o post na agenda já com o nome da data
async function novaPautaDaData(iso, nome) {
  const quando = isoLocal(maisDias(deISO(iso), -3)) < hojeISO() ? hojeISO() : isoLocal(maisDias(deISO(iso), -3));
  await formCalendario(null, quando);
  setTimeout(() => {
    const f = $("#janela form"); if (!f) return;
    if (f.elements.titulo && !f.elements.titulo.value) f.elements.titulo.value = `Pauta: ${nome} (${dataBR(iso).slice(0, 5)})`;
    if (f.elements.tipo) { f.elements.tipo.value = "postar"; f.elements.tipo.dispatchEvent(new Event("change", { bubbles: true })); }
    if (f.elements.titulo) f.elements.titulo.focus();
  }, 60);
}
function ligarDatas(el) {
  $$("[data-pauta]", el).forEach((b) => b.onclick = () => { const [iso, ...nome] = b.dataset.pauta.split("|"); novaPautaDaData(iso, nome.join("|")); });
  const cx = $("[data-cal-mostrar]", el);
  if (cx) cx.onchange = () => { try { localStorage.setItem("cal-datas", cx.checked ? "1" : "0"); } catch (_) {} desenhar(); };
}
