// MangaDex FR pour Cinder – titres ayant des chapitres français uniquement.
// Basé sur l'API publique MangaDex v5 et le format des extensions Cinder.
__cinderExport = {
  id: "mangadex-fr",
  name: "MangaDex Français",
  version: "1.0.0",
  icon: "book-outline",
  description: "Mangas disponibles en français, avec chapitres VF uniquement.",
  contentType: "manga",
  contentTypes: ["manga"],
  contentSubtypes: ["manga", "manhwa", "manhua"],
  capabilities: { search: true, discover: true, download: false, resolve: false, manga: true },

  _query(params) {
    return Object.keys(params).flatMap((key) => (Array.isArray(params[key]) ? params[key] : [params[key]]).map((value) => encodeURIComponent(key) + "=" + encodeURIComponent(value))).join("&");
  },
  async _fetch(path, params) {
    const url = "https://api.mangadex.org" + path + (params ? "?" + this._query(params) : "");
    const response = await cinder.fetch(url, {
      headers: { "Accept": "application/json", "User-Agent": "CinderApp/1.0" },
      timeout: 20000,
    });
    if (response.status !== 200) throw new Error("MangaDex : erreur HTTP " + response.status);
    return JSON.parse(response.data);
  },
  _rel(relationships, kind) {
    return (relationships || []).find((entry) => entry.type === kind);
  },
  _title(attributes) {
    const frenchAlternate = (attributes.altTitles || []).find((title) => title.fr)?.fr;
    // Un titre propre peut être dans une autre langue, mais le contenu et les chapitres sont VF.
    return attributes.title?.fr || frenchAlternate || attributes.title?.en ||
      attributes.title?.["ja-ro"] || Object.values(attributes.title || {})[0] || "Titre inconnu";
  },
  _cover(manga) {
    const file = this._rel(manga.relationships, "cover_art")?.attributes?.fileName;
    return file ? "https://uploads.mangadex.org/covers/" + manga.id + "/" + file + ".256.jpg" : undefined;
  },
  _mapManga(manga) {
    const a = manga.attributes || {};
    const description = a.description?.fr || "";
    return {
      id: manga.id,
      title: this._title(a),
      author: this._rel(manga.relationships, "author")?.attributes?.name || "Auteur inconnu",
      cover: this._cover(manga),
      description,
      url: manga.id,
      format: "manga",
      language: "fr",
      extra: {
        description,
        language: "fr",
        status: a.status,
        year: a.year,
        tags: (a.tags || []).map((tag) => tag.attributes?.name?.fr).filter(Boolean),
      },
    };
  },
  _isFrench(manga) {
    const languages = manga.attributes?.availableTranslatedLanguages;
    return Array.isArray(languages) ? languages.includes("fr") : true;
  },
  async _list(params) {
    const data = await this._fetch("/manga", {
      limit: 20,
      "availableTranslatedLanguage[]": "fr",
      "includes[]": ["cover_art", "author"],
      ...params,
    });
    return (data.data || []).filter((manga) => this._isFrench(manga)).map((manga) => this._mapManga(manga));
  },
  async search(query, page = 1) {
    const currentPage = Math.max(1, Number(page) || 1);
    return this._list({ title: query, offset: (currentPage - 1) * 20, "order[relevance]": "desc" });
  },
  async getDiscoverSections() {
    return [
      { id: "populaires", title: "Populaires en français", icon: "flame-outline" },
      { id: "recents", title: "Mises à jour VF", icon: "time-outline" },
    ];
  },
  async getDiscoverItems(sectionId, page = 0) {
    const offset = Math.max(0, Number(page) || 0) * 20;
    if (sectionId === "populaires") {
      return this._list({ offset, "order[followedCount]": "desc" });
    }
    if (sectionId === "recents") {
      return this._list({ offset, "order[latestUploadedChapter]": "desc" });
    }
    return [];
  },
  async getMangaDetails(id) {
    const data = await this._fetch("/manga/" + encodeURIComponent(id), { "includes[]": ["cover_art", "author", "artist"] });
    const manga = data.data;
    if (!this._isFrench(manga)) throw new Error("Ce manga n'a pas de chapitre français répertorié.");
    const item = this._mapManga(manga);
    return {
      ...item,
      artist: this._rel(manga.relationships, "artist")?.attributes?.name,
      status: manga.attributes?.status,
      genres: (manga.attributes?.tags || []).map((tag) => tag.attributes?.name?.fr).filter(Boolean),
    };
  },
  async getChapters(mangaId) {
    const found = new Map();
    const limit = 100;
    let total = 1;
    let offset = 0;
    while (offset < total && offset < 10000) {
      const response = await this._fetch("/manga/" + encodeURIComponent(mangaId) + "/feed", {
        limit,
        offset,
        "translatedLanguage[]": "fr",
        "order[chapter]": "asc",
        "includes[]": "scanlation_group",
      });
      total = Number(response.total || 0);
      for (const chapter of response.data || []) {
        const attrs = chapter.attributes || {};
        if (attrs.translatedLanguage !== "fr" || attrs.externalUrl || Number(attrs.pages || 0) <= 0) continue;
        const key = (attrs.volume || "") + ":" + (attrs.chapter || chapter.id);
        const old = found.get(key);
        if (!old || Number(attrs.pages || 0) > Number(old.attributes?.pages || 0)) found.set(key, chapter);
      }
      offset += limit;
    }
    return [...found.values()].map((chapter) => {
      const attrs = chapter.attributes;
      const num = attrs.chapter || "?";
      const group = this._rel(chapter.relationships, "scanlation_group");
      return {
        id: chapter.id,
        title: attrs.title || "Chapitre " + num,
        chapterNumber: Number.parseFloat(num) || 0,
        dateUploaded: attrs.publishAt,
        scanlator: group?.attributes?.name || "Traduction française",
      };
    }).sort((a, b) => a.chapterNumber - b.chapterNumber);
  },
  async getPages(chapterId) {
    const data = await this._fetch("/at-home/server/" + encodeURIComponent(chapterId));
    const hash = data.chapter?.hash;
    return (data.chapter?.data || []).map((file) => ({ url: data.baseUrl + "/data/" + hash + "/" + file }));
  },
};
__cinderExport.getBookDetails = __cinderExport.getMangaDetails;
