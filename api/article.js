const fetchUpstream = require('./_fetch.js');
// GET /news/:id -> a full press-release page on the IR site.
// The text is taken from the company's own release on GlobeNewswire, cleaned, and shown in the
// IR site's design with a source card linking to the original. Pages are cached for a day.
const { getList } = require('./_list.js');
const T = {"en": {"home": "Investor Relations", "news": "Press Releases", "back": "← All press releases", "src": "Source", "orig": "Originally published on GlobeNewswire", "view": "View original", "related": "Related news", "copy": "Copy link", "copied": "Link copied", "print": "Print", "prev": "Previous", "next": "Next", "fail": "The full text of this press release is available at its original source. Select the button below to open it in a new window.", "note": "", "disclaimer": "This press release is reproduced from the company’s official distribution through GlobeNewswire. In any conflict, the original release and the company’s SEC filings control.", "nf": "Press release not found", "nfp": "This press release is not available. Return to the list of press releases.", "cats": {"M&A": "M&A", "AI": "AI", "Results": "Results", "Corporate": "Corporate"}, "loc": "en-US", "secnote": "Full text as filed with the SEC (Form 8-K, Exhibit 99.1).", "ftitle": "Read the full press release", "ctLead": "For investor and media inquiries, please contact:", "ctIR": "Investor Relations", "ctMail": "E-mail", "origSec": "Filed with the SEC as Exhibit 99.1 to Form 8-K"}, "zh-Hans": {"home": "投资者关系", "news": "新闻稿", "back": "← 返回新闻列表", "src": "来源", "orig": "原文发布于 GlobeNewswire", "view": "查看原文", "related": "相关新闻", "copy": "复制链接", "copied": "已复制链接", "print": "打印", "prev": "上一篇", "next": "下一篇", "fail": "本篇新闻稿全文请在原发布页面阅读，点击下方按钮将在新窗口打开。", "note": "以下正文为英文原文，如有歧义，以英文原文为准。", "disclaimer": "本新闻稿转载自公司通过 GlobeNewswire 发布的正式版本。如有不一致，以原文及公司向 SEC 提交的文件为准。", "nf": "未找到该新闻稿", "nfp": "该新闻稿暂不可用，请返回新闻列表。", "cats": {"M&A": "并购", "AI": "AI", "Results": "业绩", "Corporate": "公司动态"}, "loc": "zh-CN", "secnote": "正文取自公司向 SEC 提交的文件（8-K 附件 99.1）。", "ftitle": "阅读完整新闻稿", "ctLead": "投资者及媒体垂询，请联系：", "ctIR": "投资者关系部", "ctMail": "邮箱", "origSec": "作为 8-K 附件 99.1 提交至 SEC"}, "zh-Hant": {"home": "投資者關係", "news": "新聞稿", "back": "← 返回新聞列表", "src": "來源", "orig": "原文發佈於 GlobeNewswire", "view": "查看原文", "related": "相關新聞", "copy": "複製鏈接", "copied": "已複製鏈接", "print": "打印", "prev": "上一篇", "next": "下一篇", "fail": "本篇新聞稿全文請在原發布頁面閱讀，點擊下方按鈕將在新窗口打開。", "note": "以下正文為英文原文，如有歧義，以英文原文為準。", "disclaimer": "本新聞稿轉載自公司通過 GlobeNewswire 發佈的正式版本。如有不一致，以原文及公司向 SEC 提交的文件為準。", "nf": "未找到該新聞稿", "nfp": "該新聞稿暫不可用，請返回新聞列表。", "cats": {"M&A": "併購", "AI": "AI", "Results": "業績", "Corporate": "公司動態"}, "loc": "zh-TW", "secnote": "正文取自公司向 SEC 提交的文件（8-K 附件 99.1）。", "ftitle": "閱讀完整新聞稿", "ctLead": "投資者及媒體垂詢，請聯繫：", "ctIR": "投資者關係部", "ctMail": "郵箱", "origSec": "作為 8-K 附件 99.1 提交至 SEC"}, "fr": {"home": "Relations investisseurs", "news": "Communiqués de presse", "back": "← Tous les communiqués", "src": "Source", "orig": "Publié initialement sur GlobeNewswire", "view": "Voir l’original", "related": "Actualités associées", "copy": "Copier le lien", "copied": "Lien copié", "print": "Imprimer", "prev": "Précédent", "next": "Suivant", "fail": "Le texte intégral de ce communiqué est disponible à sa source d’origine. Cliquez sur le bouton ci-dessous pour l’ouvrir dans une nouvelle fenêtre.", "ftitle": "Lire le communiqué complet", "note": "Le texte ci-dessous est la version originale en anglais ; en cas de divergence, la version anglaise prévaut.", "disclaimer": "Ce communiqué est reproduit à partir de la diffusion officielle de la société via GlobeNewswire. En cas de divergence, le communiqué original et les documents déposés auprès de la SEC font foi.", "nf": "Communiqué introuvable", "nfp": "Ce communiqué n’est pas disponible. Retournez à la liste des communiqués.", "cats": {"M&A": "Fusions et acquisitions", "AI": "IA", "Results": "Résultats", "Corporate": "Entreprise"}, "secnote": "Texte intégral tel que déposé auprès de la SEC (formulaire 8-K, pièce 99.1).", "origSec": "Déposé auprès de la SEC en tant que pièce 99.1 du formulaire 8-K", "ctLead": "Pour toute demande des investisseurs et des médias, veuillez contacter :", "ctIR": "Relations investisseurs", "ctMail": "E-mail", "loc": "fr-FR"}, "ru": {"home": "Отношения с инвесторами", "news": "Пресс-релизы", "back": "← Все пресс-релизы", "src": "Источник", "orig": "Первоначально опубликовано на GlobeNewswire", "view": "Открыть оригинал", "related": "Похожие новости", "copy": "Скопировать ссылку", "copied": "Ссылка скопирована", "print": "Печать", "prev": "Предыдущий", "next": "Следующий", "fail": "Полный текст этого пресс-релиза доступен в первоисточнике. Нажмите кнопку ниже, чтобы открыть его в новом окне.", "ftitle": "Читать полный пресс-релиз", "note": "Ниже приведён оригинальный текст на английском языке; в случае расхождений приоритет имеет английская версия.", "disclaimer": "Этот пресс-релиз воспроизведён по официальной публикации компании через GlobeNewswire. В случае расхождений приоритет имеют оригинальный релиз и документы компании, поданные в SEC.", "nf": "Пресс-релиз не найден", "nfp": "Этот пресс-релиз недоступен. Вернитесь к списку пресс-релизов.", "cats": {"M&A": "Слияния и поглощения", "AI": "ИИ", "Results": "Результаты", "Corporate": "Корпоративные"}, "secnote": "Полный текст в редакции, поданной в SEC (форма 8-K, приложение 99.1).", "origSec": "Подано в SEC в качестве приложения 99.1 к форме 8-K", "ctLead": "По вопросам инвесторов и СМИ обращайтесь:", "ctIR": "Отдел по связям с инвесторами", "ctMail": "Эл. почта", "loc": "ru-RU"}, "ar": {"home": "علاقات المستثمرين", "news": "البيانات الصحفية", "back": "← جميع البيانات الصحفية", "src": "المصدر", "orig": "نُشر في الأصل على GlobeNewswire", "view": "عرض الأصل", "related": "أخبار ذات صلة", "copy": "نسخ الرابط", "copied": "تم نسخ الرابط", "print": "طباعة", "prev": "السابق", "next": "التالي", "fail": "النص الكامل لهذا البيان متاح في مصدره الأصلي. انقر على الزر أدناه لفتحه في نافذة جديدة.", "ftitle": "قراءة البيان الصحفي كاملاً", "note": "النص أدناه هو النسخة الإنجليزية الأصلية، ويُعتد بالنسخة الإنجليزية في حال وجود أي اختلاف.", "disclaimer": "هذا البيان الصحفي منقول من النشر الرسمي للشركة عبر GlobeNewswire. وفي حال وجود أي تعارض، يُعتد بالبيان الأصلي وملفات الشركة لدى SEC.", "nf": "لم يتم العثور على البيان الصحفي", "nfp": "هذا البيان الصحفي غير متاح. يرجى العودة إلى قائمة البيانات الصحفية.", "cats": {"M&A": "الاندماج والاستحواذ", "AI": "الذكاء الاصطناعي", "Results": "النتائج", "Corporate": "أخبار الشركة"}, "secnote": "النص الكامل كما قُدِّم إلى SEC (النموذج 8-K، المرفق 99.1).", "origSec": "مقدَّم إلى SEC بوصفه المرفق 99.1 للنموذج 8-K", "ctLead": "لاستفسارات المستثمرين ووسائل الإعلام، يرجى التواصل مع:", "ctIR": "علاقات المستثمرين", "ctMail": "البريد الإلكتروني", "loc": "ar"}, "ja": {"home": "IR情報", "news": "プレスリリース", "back": "← プレスリリース一覧", "src": "出典", "orig": "GlobeNewswireにて初出", "view": "原文を見る", "related": "関連ニュース", "copy": "リンクをコピー", "copied": "リンクをコピーしました", "print": "印刷", "prev": "前へ", "next": "次へ", "fail": "本プレスリリースの全文は配信元でご覧いただけます。下のボタンから新しいウィンドウで開きます。", "ftitle": "プレスリリース全文を読む", "note": "以下は英語の原文です。内容に相違がある場合は英語版が優先します。", "disclaimer": "本プレスリリースは、GlobeNewswireを通じた当社の公式配信を転載したものです。相違がある場合は、原文および当社がSECに提出した書類が優先します。", "nf": "プレスリリースが見つかりません", "nfp": "このプレスリリースはご利用いただけません。一覧に戻ってください。", "cats": {"M&A": "M&A", "AI": "AI", "Results": "決算", "Corporate": "企業情報"}, "secnote": "全文はSECに提出されたもの（様式8-K、添付書類99.1）です。", "origSec": "様式8-Kの添付書類99.1としてSECに提出", "ctLead": "投資家・報道関係のお問い合わせ先：", "ctIR": "IR担当", "ctMail": "メール", "loc": "ja-JP"}, "de": {"home": "Investor Relations", "news": "Pressemitteilungen", "back": "← Alle Pressemitteilungen", "src": "Quelle", "orig": "Ursprünglich veröffentlicht auf GlobeNewswire", "view": "Original ansehen", "related": "Weitere Meldungen", "copy": "Link kopieren", "copied": "Link kopiert", "print": "Drucken", "prev": "Zurück", "next": "Weiter", "fail": "Der vollständige Text dieser Pressemitteilung ist an der Originalquelle verfügbar. Über die Schaltfläche unten öffnen Sie ihn in einem neuen Fenster.", "ftitle": "Vollständige Pressemitteilung lesen", "note": "Der folgende Text ist die englische Originalfassung; bei Abweichungen ist die englische Fassung maßgeblich.", "disclaimer": "Diese Pressemitteilung gibt die offizielle Veröffentlichung des Unternehmens über GlobeNewswire wieder. Bei Abweichungen sind die Originalmitteilung und die SEC-Meldungen des Unternehmens maßgeblich.", "nf": "Pressemitteilung nicht gefunden", "nfp": "Diese Pressemitteilung ist nicht verfügbar. Kehren Sie zur Liste der Pressemitteilungen zurück.", "cats": {"M&A": "M&A", "AI": "KI", "Results": "Ergebnisse", "Corporate": "Unternehmen"}, "secnote": "Volltext gemäß Einreichung bei der SEC (Formular 8-K, Anlage 99.1).", "origSec": "Bei der SEC als Anlage 99.1 zu Formular 8-K eingereicht", "ctLead": "Für Anfragen von Investoren und Medien wenden Sie sich bitte an:", "ctIR": "Investor Relations", "ctMail": "E-Mail", "loc": "de-DE"}, "pt": {"home": "Relações com Investidores", "news": "Comunicados à imprensa", "back": "← Todos os comunicados", "src": "Fonte", "orig": "Publicado originalmente na GlobeNewswire", "view": "Ver original", "related": "Notícias relacionadas", "copy": "Copiar link", "copied": "Link copiado", "print": "Imprimir", "prev": "Anterior", "next": "Próximo", "fail": "O texto completo deste comunicado está disponível na fonte original. Clique no botão abaixo para abri-lo em uma nova janela.", "ftitle": "Ler o comunicado completo", "note": "O texto abaixo é a versão original em inglês; em caso de divergência, prevalece a versão em inglês.", "disclaimer": "Este comunicado reproduz a divulgação oficial da empresa por meio da GlobeNewswire. Em caso de divergência, prevalecem o comunicado original e os documentos arquivados pela empresa na SEC.", "nf": "Comunicado não encontrado", "nfp": "Este comunicado não está disponível. Volte à lista de comunicados.", "cats": {"M&A": "Fusões e aquisições", "AI": "IA", "Results": "Resultados", "Corporate": "Corporativo"}, "secnote": "Texto completo conforme arquivado na SEC (Formulário 8-K, Anexo 99.1).", "origSec": "Arquivado na SEC como Anexo 99.1 do Formulário 8-K", "ctLead": "Para consultas de investidores e da imprensa, entre em contato com:", "ctIR": "Relações com Investidores", "ctMail": "E-mail", "loc": "pt-BR"}, "it": {"home": "Investor Relations", "news": "Comunicati stampa", "back": "← Tutti i comunicati", "src": "Fonte", "orig": "Pubblicato originariamente su GlobeNewswire", "view": "Vedi originale", "related": "Notizie correlate", "copy": "Copia link", "copied": "Link copiato", "print": "Stampa", "prev": "Precedente", "next": "Successivo", "fail": "Il testo completo di questo comunicato è disponibile alla fonte originale. Fai clic sul pulsante qui sotto per aprirlo in una nuova finestra.", "ftitle": "Leggi il comunicato completo", "note": "Il testo seguente è la versione originale in inglese; in caso di discrepanze prevale la versione inglese.", "disclaimer": "Questo comunicato riproduce la diffusione ufficiale della società tramite GlobeNewswire. In caso di discrepanze prevalgono il comunicato originale e i documenti depositati dalla società presso la SEC.", "nf": "Comunicato non trovato", "nfp": "Questo comunicato non è disponibile. Torna all’elenco dei comunicati.", "cats": {"M&A": "M&A", "AI": "IA", "Results": "Risultati", "Corporate": "Società"}, "secnote": "Testo completo come depositato presso la SEC (Modulo 8-K, Allegato 99.1).", "origSec": "Depositato presso la SEC come Allegato 99.1 al Modulo 8-K", "ctLead": "Per richieste di investitori e media, contattare:", "ctIR": "Investor Relations", "ctMail": "E-mail", "loc": "it-IT"}, "ko": {"home": "투자자 정보", "news": "보도자료", "back": "← 전체 보도자료", "src": "출처", "orig": "GlobeNewswire에 최초 게시", "view": "원문 보기", "related": "관련 뉴스", "copy": "링크 복사", "copied": "링크가 복사되었습니다", "print": "인쇄", "prev": "이전", "next": "다음", "fail": "이 보도자료의 전문은 원 출처에서 확인할 수 있습니다. 아래 버튼을 누르면 새 창에서 열립니다.", "ftitle": "보도자료 전문 보기", "note": "아래는 영어 원문입니다. 내용이 다를 경우 영어 원문이 우선합니다.", "disclaimer": "본 보도자료는 GlobeNewswire를 통한 회사의 공식 배포본을 옮긴 것입니다. 내용이 다를 경우 원문 및 회사가 SEC에 제출한 서류가 우선합니다.", "nf": "보도자료를 찾을 수 없습니다", "nfp": "이 보도자료는 제공되지 않습니다. 보도자료 목록으로 돌아가 주세요.", "cats": {"M&A": "인수합병", "AI": "AI", "Results": "실적", "Corporate": "기업 소식"}, "secnote": "전문은 SEC에 제출된 내용(Form 8-K, 첨부 99.1)입니다.", "origSec": "Form 8-K 첨부 99.1로 SEC에 제출", "ctLead": "투자자 및 언론 문의:", "ctIR": "IR 담당", "ctMail": "이메일", "loc": "ko-KR"}};
const LANGS = [['en','English'],['fr','Français'],['ru','Русский'],['zh-Hans','简体中文'],['zh-Hant','繁體中文'],['ar','العربية'],['ja','日本語'],['de','Deutsch'],['pt','Português'],['it','Italiano'],['ko','한국어']];

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function balanced(html, start, tag) {
  const re = new RegExp('<\\/?' + tag + '\\b[^>]*>', 'gi');
  re.lastIndex = start;
  let depth = 1, m;
  while ((m = re.exec(html))) {
    if (m[0][1] === '/') { if (--depth === 0) return html.slice(start, m.index); }
    else if (!/\/>$/.test(m[0])) depth++;
  }
  return html.slice(start);
}
function extractBody(html) {
  const tries = [
    /<(div|section|article)\b[^>]*itemprop=["']articleBody["'][^>]*>/i,
    /<(div)\b[^>]*id=["']main-body-container["'][^>]*>/i,
    /<(div)\b[^>]*class=["'][^"']*\barticle-body\b[^"']*["'][^>]*>/i,
    /<(article)\b[^>]*>/i,
  ];
  for (const re of tries) {
    const m = re.exec(html);
    if (m) {
      const inner = balanced(html, m.index + m[0].length, m[1]);
      if (inner.replace(/<[^>]+>/g, '').trim().length > 200) return inner;
    }
  }
  return '';
}
const { cleanBody } = require('./_html.js');
function clean(h) { return tidy(cleanBody(h)); }
// Remove layout leftovers from SEC exhibits (empty tables/rows/cells/paragraphs) and the old
// investor-relations contact block, which the page replaces with its own contact card.
const txt = (x) => x.replace(/<[^>]+>/g, '').replace(/&nbsp;|&#160;|&#xa0;|\u00a0/gi, ' ').trim();
function tidy(h) {
  for (let k = 0; k < 3; k++) {
    h = h.replace(/<(td|th)>([\s\S]*?)<\/\1>/gi, (m, t, inner) => (txt(inner) ? m : '<' + t + '></' + t + '>'))
         .replace(/<tr>(?:\s|<(td|th)><\/\1>)*<\/tr>/gi, '')
         .replace(/<(thead|tbody)>\s*<\/\1>/gi, '')
         .replace(/<table>([\s\S]*?)<\/table>/gi, (m, inner) => (txt(inner) ? m : ''))
         .replace(/<(p|h2|h3|h4|h5|li|blockquote|strong|b|em|i|u|a)>(\s|&nbsp;|&#160;|\u00a0|<br>)*<\/\1>/gi, '');
  }
  h = h.replace(/<(p|h2|h3|h4|h5)>([\s\S]*?)<\/\1>/gi, (m, t, inner) => {
    const s = txt(inner);
    return s.length < 160 && /^(investor relations contacts?:?|investor (and|&) media contacts?:?|media contacts?:?|contacts?:?|icr,? llc\.?)$|icrinc\.com/i.test(s) ? '' : m;
  });
  return h.replace(/(<br>\s*){3,}/gi, '<br><br>').replace(/\n{3,}/g, '\n\n').trim();
}
function meta(html, prop) {
  const m = new RegExp('<meta[^>]+(?:property|name)=["\']' + prop + '["\'][^>]*content=["\']([^"\']*)["\']', 'i').exec(html);
  return m ? m[1] : '';
}

/* ---------- Official source: the press release filed with the SEC (Form 8-K, Exhibit 99.1) ---------- */
const CIK_NUM = '1473334';
const SEC_H = () => ({ 'User-Agent': process.env.SEC_UA || 'XMax Inc. Investor Relations IR@XMax.com', 'Accept': '*/*' });
const words = (t) => (String(t).toLowerCase().match(/[a-z0-9$.]{4,}/g) || []).filter((w) => !['xmax','announces','announce','with','into','from','that','inc.'].includes(w));
async function fromSec(item, diag) {
  try {
    const r = await fetchUpstream('https://data.sec.gov/submissions/CIK000' + CIK_NUM + '.json', { headers: SEC_H() });
    diag.sec = r.status;
    if (!r.ok) return null;
    const f = (await r.json()).filings.recent;
    const day = (d) => Date.parse(d + 'T00:00:00Z') / 864e5;
    const target = day(item.date);
    const cands = [];
    for (let i = 0; i < f.form.length; i++) {
      if (!/^8-K/.test(f.form[i])) continue;
      const gap = day(f.filingDate[i]) - target;
      if (gap >= -1 && gap <= 5) cands.push({ acc: f.accessionNumber[i].replace(/-/g, ''), gap: Math.abs(gap) });
    }
    cands.sort((a, b) => a.gap - b.gap);
    const want = words(item.title);
    for (const c of cands.slice(0, 4)) {
      const base = 'https://www.sec.gov/Archives/edgar/data/' + CIK_NUM + '/' + c.acc + '/';
      const ix = await fetchUpstream(base + 'index.json', { headers: SEC_H() });
      if (!ix.ok) continue;
      const names = ((await ix.json()).directory || {}).item || [];
      const ex = names.map((x) => x.name).filter((n) => /ex[-_]?99[-_.]?0?1|ex99/i.test(n) && /\.html?$/i.test(n));
      for (const n of ex) {
        const d = await fetchUpstream(base + n, { headers: SEC_H() });
        if (!d.ok) continue;
        const html = await d.text();
        const bm = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html);
        const body = clean(bm ? bm[1] : html);
        const text = body.replace(/<[^>]+>/g, ' ').toLowerCase().slice(0, 3000);
        const matched = want.filter((w) => text.includes(w)).length;
        const hit = want.length ? matched / want.length : 0;
        diag.secMatch = Math.round(hit * 100) / 100;
        if (hit >= 0.5 && matched >= Math.min(3, want.length)) return { body, url: base + n };
      }
    }
  } catch (e) { diag.secError = String(e && e.message || e); }
  return null;
}
const fmtDate = (d, loc) => { try { return new Date(d + 'T12:00:00Z').toLocaleDateString(loc, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }); } catch (e) { return d; } };
const isGnw = (u) => /globenewswire\.com|morningstar\.com\/news\/globe-newswire/i.test(u || '');
const srcName = (x) => (x.source === 'sec' ? 'SEC EDGAR' : isGnw(x.url) ? 'GlobeNewswire' : x.url ? (() => { try { return new URL(x.url).hostname.replace(/^www\./, ''); } catch (e) { return 'XMax Inc.'; } })() : 'XMax Inc.');
const titleOf = (x, lang) => (lang === 'zh-Hans' && x.zh) || (lang === 'zh-Hant' && x.zht) || x.title;

module.exports = async (req, res) => {
  const q = req.query || {};
  const id = (String(q.id || '').toLowerCase().match(/^[a-z0-9-]+/) || [''])[0];
  const lang = T[q.lang] ? q.lang : 'en';
  const L = T[lang];
  // SITE_URL (e.g. https://ir.xmax.com) keeps canonical links on the company domain when requests are proxied
  const base = (process.env.SITE_URL || '').replace(/\/+$/, '') || 'https://' + (req.headers['x-forwarded-host'] || req.headers.host);
  const list = await getList();
  const i = list.findIndex((x) => x.id === id);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  if (i < 0) {
    res.setHeader('Cache-Control', 's-maxage=300');
    return res.status(404).send(page({ L, lang, base, id, notFound: true }));
  }
  const item = list[i];
  let body = '', summary = '', diag = { source: process.env.GNW_FETCH_PAGES === '1' ? 'page' : 'none', status: null, bytes: 0, extracted: 0, rss: item.rss ? item.rss.length : 0 };
  // GlobeNewswire disallows automated access to its web pages, so direct page fetching is OFF by default.
  // Article text comes from the official RSS/newsfeed (GNW_RSS) instead. Only enable GNW_FETCH_PAGES=1
  // if GlobeNewswire has given the company written permission.
  if (process.env.GNW_FETCH_PAGES === '1') try {
    const r = await fetchUpstream(item.url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; XMaxInvestorRelations/1.0; IR@XMax.com)', 'Accept': 'text/html' } });
    diag.status = r.status;
    if (r.ok) {
      const html = await r.text();
      diag.bytes = html.length;
      body = clean(extractBody(html));
      diag.extracted = body.length;
      summary = meta(html, 'og:description') || meta(html, 'description');
    }
  } catch (e) { diag.error = String(e && e.message || e); }
  const len = (h) => h.replace(/<[^>]+>/g, '').trim().length;
  let secUrl = '';
  if (item.body) { body = clean(item.body); diag.source = 'manual'; }
  if (item.source === 'sec' && len(body) <= 200) {   // discovered from an 8-K: read that exhibit directly
    try {
      const d = await fetchUpstream(item.url, { headers: SEC_H() });
      diag.sec = d.status;
      if (d.ok) { const h = await d.text(); const bm = /<body[^>]*>([\s\S]*)<\/body>/i.exec(h); body = clean(bm ? bm[1] : h); diag.source = 'sec'; }
    } catch (e) { diag.secError = String(e && e.message || e); }
  }
  if (len(body) <= 200 && !item.body && item.source !== 'cms') {   // 1st choice: the copy filed with the SEC (never for company-entered news)
    const sec = await fromSec(item, diag);
    if (sec && len(sec.body) > 200) { body = sec.body; secUrl = sec.url; diag.source = 'sec'; }
  }
  if (len(body) <= 200 && item.rss) {               // official RSS feed as a fallback source
    const b2 = clean(item.rss);
    if (len(b2) > len(body)) { body = b2; diag.source = 'rss'; }
  }
  const ok = len(body) > (diag.source === 'manual' ? 0 : 200);   // text entered by the company may be short
  if (q.debug) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(JSON.stringify(Object.assign({ id, url: item.url, ok, rssConfigured: !!process.env.GNW_RSS }, diag), null, 1));
  }
  res.setHeader('Cache-Control', ok ? (diag.source === 'manual' ? 's-maxage=120, stale-while-revalidate=600' : 's-maxage=86400, stale-while-revalidate=604800') : 's-maxage=120');
  res.status(200).send(page({ L, lang, base, id, item, secUrl, body: ok ? body : '', summary, prev: list[i + 1], next: list[i - 1],
    related: list.filter((x) => x.id !== id).sort((a, b) => (b.cat === item.cat) - (a.cat === item.cat)).slice(0, 4) }));
};

function page(o) {
  const { L, lang, base, id, item, secUrl, body, summary, prev, next, related, notFound } = o;
  const canon = base + '/news/' + id;
  const title = notFound ? L.nf : titleOf(item, lang);
  const plain = body ? body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : (summary || '');
  const desc = plain.slice(0, 158);
  const date = item ? fmtDate(item.date, L.loc) : '';
  const lk = (l) => '/news/' + id + (l === 'en' ? '' : '?lang=' + l);
  const ld = item ? JSON.stringify({ '@context': 'https://schema.org', '@type': 'NewsArticle', headline: item.title, datePublished: item.date,
    mainEntityOfPage: canon, isBasedOn: item.url, publisher: { '@type': 'Organization', name: 'XMax Inc.' }, author: { '@type': 'Organization', name: 'XMax Inc.' } }) : '';
  const card = (x, label) => x ? `<a class="pn" href="/news/${x.id}${lang === 'en' ? '' : '?lang=' + lang}"><small>${esc(label)}</small><span>${esc(titleOf(x, lang))}</span></a>` : '<span></span>';
  return `<!DOCTYPE html><html lang="${lang}" dir="${lang === 'ar' ? 'rtl' : 'ltr'}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><meta name="color-scheme" content="dark">
<title>${esc(title)} | XMax Inc. Investor Relations</title>
<meta name="description" content="${esc(desc)}"><link rel="canonical" href="${canon}">
<link rel="alternate" hreflang="en" href="${canon}"><link rel="alternate" hreflang="zh-Hans" href="${canon}?lang=zh-Hans"><link rel="alternate" hreflang="zh-Hant" href="${canon}?lang=zh-Hant">
<meta property="og:type" content="article"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${canon}">
${ld ? '<script type="application/ld+json">' + ld.replace(/</g, '\\u003c') + '</script>' : ''}
<link rel="stylesheet" href="/fonts/fonts.css">
<style>
:root{box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);color-scheme:dark;--bg:#050912;--bg2:#08101f;--surface:#0c1528;--surface2:#111d37;--line:#1c2a4a;--text:#eaf0fb;--muted:#8e9bbd;--accent:#45c8ff;--accent2:#8b7bff}
*,*::before,*::after{box-sizing:inherit}html{background:var(--bg)}
body{margin:0;background:var(--bg);color:var(--text);font:400 16.5px/1.75 "IBM Plex Sans","Noto Sans SC",system-ui,sans-serif;-webkit-font-smoothing:antialiased}
a{color:var(--accent)}.wrap{max-width:1160px;margin:0 auto;padding:0 24px}
header{position:sticky;top:env(safe-area-inset-top,0px);z-index:5;background:color-mix(in srgb,var(--bg) 85%,transparent);backdrop-filter:blur(14px);border-bottom:1px solid var(--line)}
.hd{display:flex;align-items:center;justify-content:space-between;gap:16px;height:64px}
.wm{font:700 22px Sora,sans-serif;letter-spacing:.04em;text-decoration:none;background:linear-gradient(90deg,var(--accent),var(--accent2));-webkit-background-clip:text;background-clip:text;color:transparent}
.wm small{font:500 13px "IBM Plex Sans","Noto Sans SC",sans-serif;color:var(--muted);-webkit-text-fill-color:var(--muted);margin-left:10px;letter-spacing:0}
.lg{display:flex;gap:4px;border:1px solid var(--line);border-radius:10px;padding:3px}.lg a{color:var(--muted);text-decoration:none;font-size:13.5px;padding:5px 10px;border-radius:7px}.lg a.on{background:var(--surface2);color:var(--text)}
.top{position:relative;overflow:hidden;border-bottom:1px solid var(--line);padding:52px 0 40px;isolation:isolate}
.top::before{content:"";position:absolute;inset:-40%;z-index:-1;background:radial-gradient(30% 50% at 15% 40%,color-mix(in srgb,var(--accent) 18%,transparent),transparent 70%),radial-gradient(30% 50% at 85% 60%,color-mix(in srgb,var(--accent2) 20%,transparent),transparent 70%)}
.top::after{content:"";position:absolute;inset:0;z-index:-1;background-image:linear-gradient(var(--line) 1px,transparent 1px),linear-gradient(90deg,var(--line) 1px,transparent 1px);background-size:60px 60px;opacity:.22;-webkit-mask-image:linear-gradient(#000,transparent);mask-image:linear-gradient(#000,transparent)}
.brand img{display:block;height:30px;width:auto}
.lang{position:relative}
.lbtn{display:flex;align-items:center;gap:8px;height:38px;padding:0 14px;border-radius:10px;border:1px solid var(--line);background:var(--surface);color:var(--text);font:500 14px "IBM Plex Sans","Noto Sans SC",sans-serif;cursor:pointer;white-space:nowrap}
.lbtn::after{content:"";width:6px;height:6px;border-right:1.5px solid currentColor;border-bottom:1.5px solid currentColor;transform:rotate(45deg) translateY(-2px)}
.lmenu{position:absolute;top:calc(100% + 8px);right:0;min-width:170px;padding:6px;border:1px solid var(--line);border-radius:14px;background:var(--surface);box-shadow:0 24px 60px -20px #000;display:none;z-index:9;max-height:70vh;overflow:auto}
[dir="rtl"] .lmenu{right:auto;left:0}
.lmenu.open{display:block}
.lmenu a{display:block;text-align:center;color:var(--muted);text-decoration:none;font-size:15px;padding:9px 12px;border-radius:9px}
.lmenu a:hover{background:var(--surface2);color:var(--text)}.lmenu a[aria-current="true"]{color:var(--text);background:var(--surface2);box-shadow:inset 0 0 0 1px var(--line)}
[dir="rtl"] .body ul,[dir="rtl"] .body ol{padding-left:0;padding-right:1.3em}[dir="rtl"] .ct{border-left:1px solid var(--line);border-right:3px solid var(--accent)}
.crumb{font:500 12.5px "JetBrains Mono","Noto Sans SC",monospace;color:var(--muted)}.crumb a{color:var(--muted);text-decoration:none}.crumb a:hover{color:var(--accent)}
.meta{display:flex;gap:10px;align-items:center;margin:22px 0 14px;flex-wrap:wrap}
.tag{font:500 12px "JetBrains Mono","Noto Sans SC",monospace;color:#04101f;background:linear-gradient(90deg,var(--accent),var(--accent2));border-radius:999px;padding:3px 11px}
.dt{font:500 13px "JetBrains Mono","Noto Sans SC",monospace;color:var(--muted)}
h1{font:700 clamp(28px,4vw,44px)/1.2 Sora,"Noto Sans SC",sans-serif;margin:0;max-width:24em;letter-spacing:-.01em}
.en{color:var(--muted);margin:12px 0 0;font-size:15px;max-width:44em}
.src{position:relative;display:flex;align-items:center;gap:18px;flex-wrap:wrap;margin-top:30px;padding:18px 20px;border-radius:16px;background:color-mix(in srgb,var(--surface) 75%,transparent);backdrop-filter:blur(12px);border:1px solid var(--line);box-shadow:0 24px 60px -40px var(--accent)}
.src::before{content:"";position:absolute;inset:-1px;border-radius:inherit;padding:1px;background:linear-gradient(120deg,var(--accent),transparent 35%,transparent 65%,var(--accent2));-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;pointer-events:none}
.ic{width:46px;height:46px;border-radius:12px;display:grid;place-items:center;background:var(--surface2);border:1px solid var(--line);flex:none}
.st{flex:1;min-width:200px}.st small{display:block;font:500 11.5px "JetBrains Mono","Noto Sans SC",monospace;color:var(--accent);letter-spacing:.04em}.st b{font-weight:500}.st span{display:block;color:var(--muted);font-size:13.5px}.st .sec{font-size:12.5px;margin-top:2px}.st .sec a{text-decoration:none}
.btn{display:inline-flex;align-items:center;gap:8px;padding:11px 18px;border-radius:11px;text-decoration:none;font:500 14.5px "IBM Plex Sans","Noto Sans SC",sans-serif;border:1px solid var(--line);color:var(--text);background:var(--surface2);cursor:pointer}
.btn:hover{border-color:var(--accent)}.btn.p{background:linear-gradient(90deg,var(--accent),var(--accent2));color:#04101f;border:0}
.grid{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:56px;padding:48px 24px 64px}@media(max-width:940px){.grid{grid-template-columns:1fr;gap:36px}}
.note{border:1px dashed var(--accent2);color:var(--muted);border-radius:12px;padding:10px 14px;font-size:14px;margin:0 0 24px}
.body{max-width:46em}.body p{margin:0 0 1.1em}.body h2,.body h3,.body h4{font-family:Sora,"Noto Sans SC",sans-serif;margin:1.6em 0 .6em;line-height:1.3}
.body ul,.body ol{padding-left:1.3em}.body li{margin:.3em 0}.body strong,.body b{color:#fff}
.body table{border-collapse:collapse;margin:1.2em 0;font-size:14px;display:block;overflow-x:auto;max-width:100%}.body td,.body th{border:1px solid var(--line);padding:7px 10px;text-align:left}
.body blockquote{margin:1.2em 0;padding-left:16px;border-left:3px solid var(--accent);color:var(--muted)}
.ph{border:1px solid var(--line);border-radius:18px;background:linear-gradient(160deg,var(--surface),var(--bg2));padding:40px 32px;text-align:center;max-width:46em}.ph .ic{margin:0 auto 16px}.ph h2{font:600 22px Sora,"Noto Sans SC",sans-serif;margin:0 0 8px}.ph p{color:var(--muted);margin:0 auto 22px;max-width:30em}
aside .box{border:1px solid var(--line);border-radius:16px;background:var(--surface);padding:20px;position:sticky;top:90px}
aside h3{font:600 15px Sora,"Noto Sans SC",sans-serif;margin:0 0 8px}
aside .r{display:block;padding:12px 0;border-top:1px solid var(--line);text-decoration:none;color:var(--text);font-size:14px;line-height:1.5}aside .r:hover span{color:var(--accent)}aside .r small{display:block;font:500 11.5px "JetBrains Mono","Noto Sans SC",monospace;color:var(--muted)}
.tools{display:flex;gap:8px;margin-top:16px;flex-wrap:wrap}.tools .btn{flex:1;justify-content:center;padding:9px 12px;font-size:13.5px}
.ct{margin-top:36px;padding:22px 24px;border:1px solid var(--line);border-left:3px solid var(--accent);border-radius:14px;background:var(--surface);max-width:46em}.ct p{margin:0;color:var(--text);line-height:1.7}.ct p:first-child{color:var(--muted);margin-bottom:10px}.ct a{text-decoration:none}
.pnr{display:grid;grid-template-columns:1fr 1fr;gap:16px;border-top:1px solid var(--line);padding-top:28px;margin-top:32px}@media(max-width:640px){.pnr{grid-template-columns:1fr}}
.pn{display:block;border:1px solid var(--line);border-radius:14px;padding:16px 18px;text-decoration:none;color:var(--text);background:var(--surface);transition:border-color .2s,transform .2s}.pn:hover{border-color:var(--accent);transform:translateY(-2px)}
.pn small{display:block;font:500 11.5px "JetBrains Mono","Noto Sans SC",monospace;color:var(--accent);margin-bottom:4px}.pn span{font-size:14.5px;line-height:1.45}
.disc{font-size:12.5px;color:var(--muted);border-top:1px solid var(--line);margin-top:28px;padding-top:18px}
footer{border-top:1px solid var(--line);padding:28px 0 48px;color:var(--muted);font-size:13px}
@media print{header,aside,.src .btn,.pnr,.lg{display:none!important}body{background:#fff;color:#000}.body strong{color:#000}}
</style></head><body>
<header><div class="wrap hd"><a class="brand" href="/" aria-label="XMax Investor Relations"><img src="/logo.png" alt="XMax" height="30"></a>
<div class="lang"><button class="lbtn" id="lbtn" type="button" aria-haspopup="true" aria-expanded="false">${esc((LANGS.find((x) => x[0] === lang) || LANGS[0])[1])}</button><div class="lmenu" id="lmenu" role="menu">${LANGS.map((x) => `<a role="menuitem" lang="${x[0]}" data-l="${x[0]}" href="${lk(x[0])}"${x[0] === lang ? ' aria-current="true"' : ''}>${x[1]}</a>`).join('')}</div></div></div></header>
<main>
<div class="top"><div class="wrap">
<div class="crumb"><a href="/">${esc(L.home)}</a> / <a href="/#news">${esc(L.news)}</a>${item ? ' / ' + esc(date) : ''}</div>
${notFound ? `<h1 style="margin-top:22px">${esc(L.nf)}</h1><p class="en">${esc(L.nfp)}</p><p><a class="btn p" href="/#news">${esc(L.back)}</a></p>` : `
<div class="meta"><span class="tag">${esc(L.cats[item.cat] || item.cat || '')}</span><span class="dt">${esc(date)}</span></div>
<h1>${esc(title)}</h1>${lang !== 'en' && title !== item.title ? `<p class="en">${esc(item.title)}</p>` : ''}
<div class="src"><span class="ic"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#45c8ff" stroke-width="1.8" stroke-linejoin="round"><path d="M4 5h13v14H6a2 2 0 0 1-2-2zM17 9h3v8a2 2 0 0 1-2 2"/><path d="M8 9h5M8 13h5M8 17h3"/></svg></span>
<span class="st"><small>${esc(L.src).toUpperCase()}</small><b>${esc(srcName(item))}</b><span>${esc(item.source === 'sec' ? L.origSec : isGnw(item.url) ? L.orig : date)}${item.source === 'sec' || isGnw(item.url) ? ' · ' + esc(date) : ''}</span>${secUrl && item.source !== 'sec' ? `<span class="sec">${esc(L.secnote)} <a href="${esc(secUrl)}" target="_blank" rel="noopener noreferrer">SEC ↗</a></span>` : ''}</span>
${item.url ? `<a class="btn p" href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">${esc(L.view)} ↗</a>` : ''}<button class="btn" id="cp" type="button">${esc(L.copy)}</button></div>`}
</div></div>
${notFound ? '' : `<div class="wrap grid"><article>
${lang !== 'en' && L.note && body ? `<p class="note">${esc(L.note)}</p>` : ''}
${body ? `<div class="body">${body}</div>` : `<div class="ph"><span class="ic"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8b7bff" stroke-width="1.8" stroke-linejoin="round"><path d="M6 2h9l5 5v15H6z"/><path d="M14 2v6h6M9 13h8M9 17h5"/></svg></span><h2>${esc(L.ftitle)}</h2><p>${esc(L.fail)}</p>${item.url ? `<a class="btn p" href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">${esc(L.view)} ↗</a>` : ''}</div>`}
<div class="ct"><p>${esc(L.ctLead)}</p><p>${esc(L.ctIR)}<br>XMax Inc.<br>${esc(L.ctMail)}: <a href="mailto:IR@XMax.com">IR@XMax.com</a> / <a href="mailto:XmaxIR@icrinc.com">XmaxIR@icrinc.com</a></p></div>
<div class="pnr">${card(prev, '← ' + L.prev)}${card(next, L.next + ' →')}</div>
<p class="disc">${esc(L.disclaimer)}</p>
</article>
<aside><div class="box"><h3>${esc(L.related)}</h3>${related.map((x) => `<a class="r" href="/news/${x.id}${lang === 'en' ? '' : '?lang=' + lang}"><small>${esc(fmtDate(x.date, L.loc))}</small><span>${esc(titleOf(x, lang))}</span></a>`).join('')}
<div class="tools"><button class="btn" id="pr" type="button">${esc(L.print)}</button><a class="btn" href="/#news">${esc(L.news)}</a></div></div></aside></div>`}
</main>
<footer><div class="wrap">© ${new Date().getFullYear()} XMax Inc. · NASDAQ: XMAX · <a href="/">${esc(L.home)}</a></div></footer>
<script>
(function(){var p=new URLSearchParams(location.search),ok=${JSON.stringify(LANGS.map((x) => x[0]))};
try{if(!p.get('lang')){var s=localStorage.getItem('xmax-lang');if(s&&s!=='en'&&ok.indexOf(s)>=0){p.set('lang',s);location.replace(location.pathname+'?'+p.toString());return}}}catch(e){}
var b=document.getElementById('lbtn'),m=document.getElementById('lmenu');
b.onclick=function(e){e.stopPropagation();var o=m.classList.toggle('open');b.setAttribute('aria-expanded',o)};
document.addEventListener('click',function(){m.classList.remove('open');b.setAttribute('aria-expanded','false')});
m.querySelectorAll('a').forEach(function(a){a.addEventListener('click',function(){try{localStorage.setItem('xmax-lang',a.dataset.l)}catch(e){}})});
var c=document.getElementById('cp');if(c)c.onclick=function(){var u=location.origin+location.pathname;(navigator.clipboard?navigator.clipboard.writeText(u):Promise.reject()).then(function(){c.textContent=${JSON.stringify(L.copied)}}).catch(function(){prompt('',u)})};
var pr=document.getElementById('pr');if(pr)pr.onclick=function(){print()};})();
</script></body></html>`;
}
