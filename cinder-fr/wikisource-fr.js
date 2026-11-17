// Extension Cinder – Wikisource Français
// Catalogue Wikisource Reader / WSIndex (Wikimedia Toolforge), oeuvres en français.
__cinderExport = {
  id: "wikisource-fr",
  name: "Wikisource Français",
  version: "1.0.0",
  icon: "library-outline",
  description: "Livres francophones relus sur Wikisource, avec EPUB gratuits.",
  contentType: "books",
  contentTypes: ["ebook"],
  language: "French",
  capabilities: { search: true, discover: true, download: false, resolve: true, searchDownloads: true, manga: false },
  _BASE: "https://wsindex.toolforge.org/books/",

  async _request(url) {
    const response = await cinder.fetch(url, {
      headers: { Accept: "application/json" },
      timeout: 20000,
    });
    if (!response || response.status !== 200) {
      throw new Error("Le catalogue Wikisource est indisponible (HTTP " + (response ? response.status : "inconnu") + ").");
    }
    const payload = typeof response.data === "string" ? JSON.parse(response.data) : response.data;
    if (!payload || typeof payload !== "object") throw new Error("Réponse Wikisource invalide.");
    return payload;
  },

  _map(book) {
    if (!book || !Array.isArray(book.languages) || !book.languages.includes("fr")) return null;
    const url = String(book.epub_url || "");
    if (!/^https:\/\/(?:ws-export-app\.wmcloud\.org|ws-export\.wmcloud\.org)\//i.test(url)) return null;
    const title = String(book.title || book.title_native_language || "").trim();
    if (!title) return null;
    return {
      id: book.wikidata_qid || book.ws_url || title,
      title,
      author: (book.authors || []).map(person => person.name).filter(Boolean).join(", ") || "Auteur inconnu",
      cover: book.thumbnail_url || undefined,
      description: "Livre en français de Wikisource, exportable en EPUB.",
      url,
      format: "epub",
      language: "fr",
      extra: {
        language: "fr",
        epubUrl: url,
        sourceUrl: book.ws_url,
        description: "Livre en français de Wikisource, exportable en EPUB.",
        year: book.date_of_publication ? book.date_of_publication.slice(0, 4) : undefined,
        tags: book.genre || [],
      },
    };
  },

  _items(data) {
    return (data.results || []).map(book => this._map(book)).filter(Boolean);
  },

  async search(query, page = 1) {
    const text = String(query || "").trim();
    if (!text) return [];
    const number = Math.max(1, Number(page) || 1);
    return this._items(await this._request(
      this._BASE + "?languages=fr&search=" + encodeURIComponent(text) + "&page=" + number
    ));
  },

  async getDiscoverSections() {
    return [
      { id: "populaires", title: "Les plus lus en français", icon: "flame-outline" },
      { id: "alphabetique", title: "Livres français de A à Z", icon: "library-outline" },
    ];
  },

  async getDiscoverItems(sectionId, page = 0) {
    if (!["populaires", "alphabetique"].includes(sectionId)) return [];
    const number = Math.max(0, Number(page) || 0) + 1;
    const order = sectionId === "alphabetique" ? "title" : "-view_count";
    return this._items(await this._request(
      this._BASE + "?languages=fr&sort=" + encodeURIComponent(order) + "&page=" + number
    ));
  },

  async getBookDetails(id) {
    if (!/^Q\d+$/i.test(String(id || ""))) throw new Error("Identifiant Wikisource invalide.");
    const book = await this._request(this._BASE + encodeURIComponent(id) + "/");
    const item = this._map(book);
    if (!item) throw new Error("Cette édition n'est pas disponible en français.");
    return item;
  },

  async resolve(item) {
    const url = String((item && item.extra && item.extra.epubUrl) || (item && item.url) || "");
    if (!/^https:\/\/(?:ws-export-app\.wmcloud\.org|ws-export\.wmcloud\.org)\//i.test(url)) {
      throw new Error("Lien de téléchargement Wikisource invalide.");
    }
    const name = String(item.title || "Wikisource").replace(/[\\/:*?"<>|]/g, "-").slice(0, 100);
    return { url, fileName: name + ".epub" };
  },
};
