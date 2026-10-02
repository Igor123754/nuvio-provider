// balkanteka-mp4upload.js — samostalan Nuvio plugin.
//
// Radi SAMO lokalno na uredjaju. Ne zove Vercel, ne zove tvoj Stremio
// addon, ni jedan spoljni server osim mp4upload.com samog. Nuvio ovaj
// fajl preuzima direktno sa GitHub-a (raw URL naveden u manifest.json)
// i izvrsava ga u svom JS sandbox-u.
//
// BEZ async/await — neki Nuvio sandbox formati to ne podrzavaju, pa je
// sve u cistom Promise/.then() stilu.

// ---------------------------------------------------------------------
// 1) KATALOG — parovi TMDB ID -> mp4upload URL, prepisani iz tvog
//    postojeceg Stremio addon-a (polja 'tmdb' i 'stream'). Ovo se
//    odrzava RUCNO ovde, odvojeno od Stremio addon-a — plugin ne cita
//    tvoj addon kod niti tvoj Vercel, nosi sopstvenu kopiju podataka.
// ---------------------------------------------------------------------
var CATALOG = {
  movie: {
    // 'TMDB_ID': 'https://www.mp4upload.com/XXXXXXXX',
    // primer (zameni stvarnim mp4upload linkovima iz tvog kataloga):
    // '338474': 'https://www.mp4upload.com/1b1dk44auun9',
  },
  tv: {
    // 'TMDB_ID_SEZONA_EPIZODA': 'https://www.mp4upload.com/XXXXXXXX',
    // primer: '1234_1_5': 'https://www.mp4upload.com/abc123'
  },
};

// ---------------------------------------------------------------------
// 2) RESOLVER — izvlaci direktan .mp4 link iz mp4upload embed stranice.
//    Isti princip koji Kodi vec koristi preko ResolveURL: Referer mora
//    biti tacno embed-xxxxx.html stranica sa koje je link pokrenut.
// ---------------------------------------------------------------------
var UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0';

function toEmbedUrl(inputUrl) {
  var match = inputUrl.match(/mp4upload\.com\/(?:embed-)?([0-9a-zA-Z]+)/);
  if (!match) return null;
  return 'https://www.mp4upload.com/embed-' + match[1] + '.html';
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
      // Trazi "src":"https://xx.mp4upload.com:PORT/d/HASH/video.mp4"
      // (mp4upload ponekad escape-uje kose crte kao \/ u JS stringu)
      var srcMatch = html.match(
        /src\s*:\s*"(https:\\?\/\\?\/[^"]*mp4upload\.com[^"]*\/video\.mp4)"/
      );
      if (!srcMatch) return null;

      return {
        url: srcMatch[1].replace(/\\\//g, '/'),
        headers: { 'User-Agent': UA, Referer: embedUrl },
      };
    });
}

// ---------------------------------------------------------------------
// 3) ULAZNA TACKA — ono sto Nuvio zove
// ---------------------------------------------------------------------
function getStreams(tmdbId, mediaType, season, episode) {
  var key;
  var rawUrl;

  if (mediaType === 'tv') {
    key = tmdbId + '_' + season + '_' + episode;
    rawUrl = CATALOG.tv[key];
  } else {
    rawUrl = CATALOG.movie[tmdbId];
  }

  if (!rawUrl) {
    // Ovaj naslov kod tebe nije na mp4upload-u — prazan niz,
    // Nuvio ce samo preskociti ovaj provider za njega.
    return Promise.resolve([]);
  }

  return extractDirectUrl(rawUrl)
    .then(function (resolved) {
      if (!resolved) return [];
      return [
        {
          name: 'Balkanteka (mp4upload)',
          title: 'Direktan stream',
          url: resolved.url,
          headers: resolved.headers,
        },
      ];
    })
    .catch(function (err) {
      console.error('[balkanteka-mp4upload] greska:', err && err.message);
      return [];
    });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getStreams: getStreams };
} else {
  global.getStreams = getStreams;
}
