// Extension Cinder – Gallica BnF, recherche EPUB via API OPDS officielle.
// Source : https://api.bnf.fr/fr/api-opds-du-catalogue-de-livres-numeriques-de-gallica
__cinderExport = {
  id: "gallica-fr",
  name: "Gallica BnF Français",
  version: "1.0.0",
  icon: "library-outline",
  description: "Livres du domaine public en français, format EPUB, Bibliothèque nationale de France.",
  contentType: "books",
  contentTypes: ["ebook"],
  language: "French",
  capabilities: { search: true, discover: true, download: false, resolve: true, searchDownloads: true, manga: false },
  _BASE: "https://gallica.bnf.fr",
  _SEARCH: "https://gallica.bnf.fr/services/engine/search/opds",

  _abs(href) {
    const val = String(href || "").trim();
    if (!val) return "";
    try {
      const u = new URL(val, this._BASE);
      if (u.protocol === "http:") u.protocol = "https:";
      return u.toString();
    } catch (_) {
      return "";
    }
  },

  async _fetch(url) {
    const r = await cinder.fetch(url, {
      headers: { Accept: "application/atom+xml, application/xml;q=0.9, text/xml;q=0.8" },
      timeout: 20000,
    });
    if (!r || r.status !== 200) throw new Error("Gallica OPDS indisponible (HTTP " + (r ? r.status : "inconnu") + ").");
    return cinder.parseXML(r.data);
  },

  _map(entry) {
    const title = String(entry.querySelector("title")?.text() || "").trim();
    if (!title) return null;
    const links = entry.querySelectorAll("link");
    let epub = "", cover = "";
    for (const link of links) {
      const type = String(link.attr("type") || "").toLowerCase();
      const rel = String(link.attr("rel") || "").toLowerCase();
      const href = this._abs(link.attr("href"));
      if (!href) continue;
      if (rel.includes("acquisition") && type.includes("epub")) epub = href;
      if (rel.includes("thumbnail")) cover = href;
    }
    if (!epub) return null;
    const id = String(entry.querySelector("id")?.text() || epub).trim();
    const description = String(entry.querySelector("summary")?.text() || "").trim();
    return {
      id, title,
      author: String(entry.querySelector("author > name")?.text() || "Auteur inconnu").trim(),
      cover: cover || undefined,
      description,
      url: epub,
      language: "fr",
      format: "epub",
      extra: { description, language: "fr", epubUrl: epub, source: "gallica.bnf.fr / Bibliothèque nationale de France" },
    };
  },

  _results(xml) {
    const out = [];
    for (const entry of xml.querySelectorAll("entry")) {
      const item = this._map(entry);
      if (item) out.push(item);
    }
    return out;
  },

  _query(terms, page) {
    // dc.language=fre impose la langue française, formatspecific=epub impose l'EPUB.
    const cleaned = String(terms || "").replace(/["\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 180);
    const clause = cleaned ? 'gallica all "' + cleaned + '"' : 'dc.type all "monographie"';
    const query = '(' + clause + ') and (dc.language all "fre") and (dc.formatspecific all "epub")';
    const first = Math.max(0, Number(page) || 0) * 15 + 1;
    return this._SEARCH + "?operation=searchRetrieve&version=1.2&exactSearch=false" +
      "&maximumRecords=15&startRecord=" + first + "&query=" + encodeURIComponent(query);
  },

  async search(query, page = 1) {
    const term = String(query || "").trim();
    if (!term) return [];
    const firstPage = Math.max(1, Number(page) || 1) - 1;
    return this._results(await this._fetch(this._query(term, firstPage)));
  },

  async getDiscoverSections() {
    return [
      { id: "litterature", title: "Littérature française", icon: "book-outline" },
      { id: "histoire", title: "Histoire", icon: "library-outline" },
      { id: "sciences", title: "Sciences", icon: "flask-outline" },
    ];
  },

  async getDiscoverItems(sectionId, page = 0) {
    const terms = { litterature: "littérature", histoire: "histoire", sciences: "sciences" };
    if (!Object.prototype.hasOwnProperty.call(terms, sectionId)) return [];
    return this._results(await this._fetch(this._query(terms[sectionId], page)));
  },

  async resolve(item) {
    const url = String(item && (item.extra?.epubUrl || item.url) || "");
    if (!/^https:\/\/gallica\.bnf\.fr\//i.test(url)) throw new Error("Lien Gallica EPUB invalide.");
    const name = String(item.title || "Gallica").replace(/[\\/:*?"<>|]/g, "-").slice(0, 100);
    return { url, fileName: name + ".epub" };
  },
};
