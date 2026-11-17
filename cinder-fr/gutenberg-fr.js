// Projet Gutenberg VF via Gutendex. Catalogue libre de droits, résultats en français.
__cinderExport = {
  id: "gutenberg-fr",
  name: "Gutenberg Français",
  version: "1.0.0",
  icon: "library-outline",
  description: "Livres gratuits en français issus du projet Gutenberg (EPUB).",
  contentType: "books",
  contentTypes: ["ebook"],
  capabilities: { search: true, discover: true, download: true, resolve: false, manga: false },

  async _load(url) {
    const res = await cinder.fetch(url, { headers: { Accept: "application/json" }, timeout: 20000 });
    if (res.status !== 200) throw new Error("Gutendex : erreur HTTP " + res.status);
    return JSON.parse(res.data);
  },
  _item(book) {
    // Les ouvrages multilingues sont exclus pour éviter tout contenu non français.
    if (!Array.isArray(book.languages) || book.languages.length !== 1 || book.languages[0] !== "fr") return null;
    const formats = book.formats || {};
    const epub = formats["application/epub+zip"];
    if (!epub || !/^https:\/\//.test(epub)) return null;
    const cover = formats["image/jpeg"];
    return {
      id: "gutenberg-fr-" + book.id,
      title: book.title || "Titre inconnu",
      author: (book.authors || []).map((author) => author.name).join(", ") || "Auteur inconnu",
      cover: cover || undefined,
      description: "Livre en français du domaine public, disponible en EPUB.",
      url: epub,
      format: "epub",
      language: "fr",
      extra: { language: "fr", description: "Livre en français du domaine public, disponible en EPUB." },
    };
  },
  _result(payload) {
    return (payload.results || []).map((book) => this._item(book)).filter(Boolean);
  },
  async search(query, page = 1) {
    const requestedPage = Math.max(1, Number(page) || 1);
    const url = "https://gutendex.com/books/?languages=fr&search=" + encodeURIComponent(query) + "&page=" + requestedPage;
    return this._result(await this._load(url));
  },
  async getDiscoverSections() {
    return [{ id: "populaires", title: "Classiques français", icon: "library-outline" }];
  },
  async getDiscoverItems(sectionId, page = 0) {
    if (sectionId !== "populaires") return [];
    const currentPage = Math.max(0, Number(page) || 0) + 1;
    return this._result(await this._load("https://gutendex.com/books/?languages=fr&sort=popular&page=" + currentPage));
  },
  async resolve(item) {
    return { url: item.url, fileName: (item.title || "Livre").replace(/[\\/:*?\"<>|]+/g, "_") + ".epub" };
  },
};
