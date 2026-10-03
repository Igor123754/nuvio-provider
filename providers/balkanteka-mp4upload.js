// balkanteka-mp4upload.js — samostalan Nuvio plugin.
//
// Radi SAMO lokalno na uredjaju. Ne zove Vercel ni tvoj Stremio addon,
// samo mp4upload.com. BEZ async/await (cist Promise/.then() stil).

// ---------------------------------------------------------------------
// 1) KATALOG — TMDB ID -> mp4upload URL. Odrzava se rucno, ovde.
//    Filmovi: 'TMDB_ID': 'https://www.mp4upload.com/XXXX'
//    Serije:  'TMDB_ID_SEZONA_EPIZODA': 'https://www.mp4upload.com/XXXX'
// ---------------------------------------------------------------------
var CATALOG = {
  movie: {
    '378898': 'https://www.mp4upload.com/1b1dk44auun9',
    '269048': 'https://www.mp4upload.com/v65zgc4svhlk',
    '383443': 'https://www.mp4upload.com/zhpo4c3z26n5',
    '692753': 'https://www.mp4upload.com/rxnjpkemi8pa',
  },
  tv: {
  },
};

var UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0';

function toEmbedUrl(inputUrl) {
  var match = inputUrl.match(/mp4upload\.com\/(?:embed-)?([0-9a-zA-Z]+)/);
  if (!match) return null;
  return 'https://www.mp4upload.com/embed-' + match[1] + '.html';
}

// ---------------------------------------------------------------------
// 2) IZVLACENJE LINKA
//    Prvi obrazac je isti kao u ResolveURL mp4upload resolveru:
//        src("https://....")
//    Ostali su rezerva ako sajt promeni zapis.
// ---------------------------------------------------------------------
var SOURCE_PATTERNS = [
  /src\(\s*["']([^"']+)["']/,                                   // player.src("...")  (ResolveURL)
  /src\s*:\s*["']([^"']+)["']/,                                 // src: "..."
  /file\s*:\s*["']([^"']+)["']/,                                // file: "..."
  /(https?:\\?\/\\?\/[^"'\s]*mp4upload\.com[^"'\s]*\.mp4)/      // bilo koji .mp4 na mp4upload domenu
];

function findSource(html) {
  for (var i = 0; i < SOURCE_PATTERNS.length; i++) {
    var m = html.match(SOURCE_PATTERNS[i]);
    if (m && m[1]) {
      var candidate = m[1].replace(/\\\//g, '/');
      // prihvati samo prave http(s) linkove, ne npr. src("") ili relativne putanje
      if (/^https?:\/\//.test(candidate)) return candidate;
    }
  }
  return null;
}

function extractDirectUrl(inputUrl) {
  var embedUrl = toEmbedUrl(inputUrl);
  if (!embedUrl) return Promise.resolve(null);

  return fetch(embedUrl, { headers: { 'User-Agent': UA, Referer: embedUrl } })
    .then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.text();
    })
    .then(function (html) {
      var url = findSource(html);
      if (!url) return null;
      return {
        url: url,
        headers: { 'User-Agent': UA, Referer: embedUrl },
      };
    });
}

// ---------------------------------------------------------------------
// 3) ULAZNA TACKA
// ---------------------------------------------------------------------
function getStreams(tmdbId, mediaType, season, episode) {
  var rawUrl;
  if (mediaType === 'tv') {
    rawUrl = CATALOG.tv[tmdbId + '_' + season + '_' + episode];
  } else {
    rawUrl = CATALOG.movie[tmdbId];
  }

  if (!rawUrl) return Promise.resolve([]);

  return extractDirectUrl(rawUrl)
    .then(function (resolved) {
      if (!resolved) return [];
      return [
        {
          name: 'Домаћи филмови и серије',
          title: 'Direktan stream',
          url: resolved.url,
          headers: resolved.headers,
        },
      ];
    })
    .catch(function () {
      return [];
    });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getStreams: getStreams, findSource: findSource };
} else {
  global.getStreams = getStreams;
}
