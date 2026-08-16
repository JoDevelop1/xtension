/**
 * xtension.jodevelop.com
 *
 * Sert la page de présentation (assets statiques) et redirige les
 * téléchargements vers les fichiers attachés à la dernière release GitHub.
 *
 * Les binaires ne sont pas hébergés ici : GitHub Releases est la source de
 * vérité. Le Worker interroge l'API des releases (réponse mise en cache) pour
 * trouver l'asset correspondant, et retombe sur une URL construite à partir de
 * FALLBACK_VERSION si l'API est indisponible ou limitée en débit.
 *
 * Routes de téléchargement :
 *   /dl/XtensionBridgeSetup.exe        -> installateur du connecteur Windows
 *   /dl/xtension-chrome.zip            -> paquet Chrome
 *   /dl/xtension-edge.zip              -> paquet Edge
 *   /dl/xtension-firefox.zip           -> paquet Firefox
 *   /dl/SHA256SUMS.txt                 -> empreintes des paquets navigateurs
 *   /dl/XtensionBridgeSetup.SHA256.txt -> empreinte de l'installateur
 */

const REPO = 'JoDevelop1/xtension';
const RELEASES_API = `https://api.github.com/repos/${REPO}/releases/latest`;
const RELEASES_PAGE = `https://github.com/${REPO}/releases/latest`;
const RELEASE_TTL_SECONDS = 900;

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  'Content-Security-Policy':
    "default-src 'none'; img-src 'self' data:; style-src 'self'; script-src 'self'; font-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
};

/**
 * Chaque alias public décrit comment reconnaître l'asset correspondant dans une
 * release (`match`) et comment reconstruire son nom si l'API est indisponible
 * (`fallback`).
 */
const ALIASES = {
  'XtensionBridgeSetup.exe': {
    match: (name) => name === 'XtensionBridgeSetup.exe',
    fallback: () => 'XtensionBridgeSetup.exe',
  },
  'XtensionBridgeSetup.SHA256.txt': {
    match: (name) => name === 'XtensionBridgeSetup.SHA256.txt',
    fallback: () => 'XtensionBridgeSetup.SHA256.txt',
  },
  'SHA256SUMS.txt': {
    match: (name) => name === 'SHA256SUMS.txt',
    fallback: () => 'SHA256SUMS.txt',
  },
  'xtension-chrome.zip': {
    match: (name) => /^xtension-chrome-v[\d.]+\.zip$/.test(name),
    fallback: (version) => `xtension-chrome-v${version}.zip`,
  },
  'xtension-edge.zip': {
    match: (name) => /^xtension-edge-v[\d.]+\.zip$/.test(name),
    fallback: (version) => `xtension-edge-v${version}.zip`,
  },
  'xtension-firefox.zip': {
    match: (name) => /^xtension-firefox-v[\d.]+\.zip$/.test(name),
    fallback: (version) => `xtension-firefox-v${version}.zip`,
  },
};

/** Récupère la dernière release publiée. Renvoie null si l'API est inutilisable. */
async function fetchLatestRelease(cacheVersion) {
  try {
    const releaseApi = `${RELEASES_API}?site_version=${encodeURIComponent(cacheVersion || 'latest')}`;
    const response = await fetch(releaseApi, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'xtension.jodevelop.com',
      },
      cf: { cacheTtl: RELEASE_TTL_SECONDS, cacheEverything: true },
    });
    if (!response.ok) return null;
    const release = await response.json();
    if (!release || typeof release.tag_name !== 'string') return null;
    return release;
  } catch (error) {
    return null;
  }
}

/** URL de téléchargement construite sans l'API, à partir de la version connue. */
function fallbackUrl(alias, version) {
  const name = ALIASES[alias].fallback(version);
  return `https://github.com/${REPO}/releases/download/v${version}/${name}`;
}

async function resolveDownloadUrl(alias, fallbackVersion) {
  const release = await fetchLatestRelease(fallbackVersion);
  if (release && Array.isArray(release.assets)) {
    const asset = release.assets.find((item) => ALIASES[alias].match(item.name || ''));
    if (asset && asset.browser_download_url) {
      return asset.browser_download_url;
    }
  }
  return fallbackUrl(alias, fallbackVersion);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', {
        status: 405,
        headers: { ...SECURITY_HEADERS, Allow: 'GET, HEAD' },
      });
    }

    // Téléchargements : redirection vers l'asset de la release GitHub.
    if (url.pathname.startsWith('/dl/')) {
      const alias = decodeURIComponent(url.pathname.slice('/dl/'.length));

      if (!Object.prototype.hasOwnProperty.call(ALIASES, alias)) {
        return Response.redirect(RELEASES_PAGE, 302);
      }

      const target = await resolveDownloadUrl(alias, env.FALLBACK_VERSION);
      return new Response(null, {
        status: 302,
        headers: {
          ...SECURITY_HEADERS,
          Location: target,
          'Cache-Control': 'public, max-age=600',
        },
      });
    }

    // Métadonnées de version, utiles pour l'extension et les scripts.
    if (url.pathname === '/version.json') {
      const release = await fetchLatestRelease(env.FALLBACK_VERSION);
      const version = release ? String(release.tag_name).replace(/^v/, '') : env.FALLBACK_VERSION;
      const origin = `https://${url.host}`;

      return new Response(
        JSON.stringify(
          {
            version,
            released_at: release ? release.published_at : null,
            release_page: release ? release.html_url : RELEASES_PAGE,
            connector: `${origin}/dl/XtensionBridgeSetup.exe`,
            chrome: `${origin}/dl/xtension-chrome.zip`,
            edge: `${origin}/dl/xtension-edge.zip`,
            firefox: `${origin}/dl/xtension-firefox.zip`,
            checksums: `${origin}/dl/SHA256SUMS.txt`,
            connector_checksum: `${origin}/dl/XtensionBridgeSetup.SHA256.txt`,
            repository: `https://github.com/${REPO}`,
          },
          null,
          2
        ),
        {
          headers: {
            ...SECURITY_HEADERS,
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'public, max-age=600',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // Le reste : page statique.
    const assetResponse = await env.ASSETS.fetch(request);
    const headers = new Headers(assetResponse.headers);
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      headers.set(name, value);
    }
    return new Response(assetResponse.body, {
      status: assetResponse.status,
      statusText: assetResponse.statusText,
      headers,
    });
  },
};
