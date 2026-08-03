/**
 * Bascule de langue EN/FR.
 *
 * Le HTML de la page est en anglais ; ce fichier contient les traductions
 * françaises. Les chaînes sont des littéraux constants définis ici même —
 * aucune donnée extérieure n'entre dans le DOM, ce qui rend l'affectation
 * de innerHTML sans risque pour les quelques libellés contenant du balisage.
 */

const FR = {
  skip: 'Aller au contenu',

  navFeatures: 'Fonctionnalités',
  navHow: 'Fonctionnement',
  navPrivacy: 'Confidentialité',
  navDownload: 'Téléchargement',

  heroEyebrow: 'Version 0.6.10 · Chrome · Edge · Firefox',
  heroTitle: 'Écrivez mieux sur X/Twitter,<br />avec votre propre compte ChatGPT.',
  heroLead:
    "Xtension ajoute une barre d'outils compacte à la zone de rédaction de X/Twitter : corriger, traduire, reformuler, générer des réponses et créer des images — plus un export PDF soigné de n'importe quel article, tweet ou fil. Les requêtes passent par votre propre session ChatGPT/Codex authentifiée. Aucune clé d'API. Aucun serveur du développeur. Aucun compte à créer.",
  heroCtaDownload: 'Télécharger Xtension',
  heroCtaSource: 'Lire le code source',

  badgeNoKey: "Aucune clé d'API OpenAI",
  badgeNoServer: 'Aucun serveur du développeur',
  badgeSigned: 'Installateur Windows signé',
  badgeAuditable: 'Open source Apache-2.0',

  featuresTitle: 'Tout ce que fait Xtension',
  featuresLead:
    "Deux moitiés indépendantes : un exportateur PDF qui fonctionne entièrement dans votre navigateur, et un ensemble d'outils de rédaction IA qui passent par votre compte ChatGPT/Codex. Chacune s'utilise sans l'autre.",

  groupPdf: 'Export PDF — entièrement local',
  f1Title: 'Export depuis le menu ···',
  f1Body:
    "Une entrée <strong>Télécharger en PDF</strong> est ajoutée au menu <code>···</code> de X/Twitter, sur n'importe quel article, tweet ou fil.",
  f2Title: 'Structure préservée',
  f2Body:
    "Titres, paragraphes, listes et citations conservent leur mise en forme. Les longs fils sont paginés pour qu'un message ne soit jamais coupé en deux.",
  f3Title: 'Détection intelligente des fils',
  f3Body:
    "Les messages successifs du même auteur sont regroupés, et l'export s'arrête avant les réponses des autres comptes.",
  f4Title: 'Images et tweets cités',
  f4Body:
    'Images des médias, avatars, images de carte et vignettes vidéo sont intégrées. Les tweets cités sont inclus avec leur contenu disponible.',
  f5Title: 'Généré dans votre navigateur',
  f5Body:
    "Le PDF est construit localement et enregistré via la boîte de dialogue <strong>Enregistrer sous</strong> habituelle de votre navigateur. Rien n'est téléversé nulle part.",
  f6Title: 'Liens cliquables conservés',
  f6Body:
    "Les liens restent cliquables dans le PDF, l'URL source est ajoutée, et le profil du compte exporté est mis en lien à la fin.",

  groupAi: 'Outils de rédaction IA — via votre compte ChatGPT',
  f7Title: 'Correction',
  f7Body:
    'Corrige la grammaire, l’orthographe et la syntaxe de votre brouillon tout en gardant votre voix. Annulable en un clic.',
  f8Title: 'Traduction',
  f8Body:
    'Traduit votre brouillon dans la langue de sortie que vous choisissez, en préservant le ton et le sens.',
  f9Title: 'Reformulation',
  f9Body:
    "Réécrit votre brouillon pour le rendre plus clair ou plus percutant, dans la limite de caractères d'un message.",
  f10Title: 'Générer',
  f10Body:
    "Transforme une consigne en message fini. Sur un brouillon vide sous un tweet, l'outil rédige plutôt une réponse contextuelle. Le style d'écriture est piloté par une consigne que vous contrôlez.",
  f11Title: 'Suggestions de réponses',
  f11Body:
    'Un panneau propose des réponses prêtes à publier sous plusieurs angles : réaction humaine, impact court, argument concret, accord positif, humour contextuel, angle incisif, contexte utile, question — plus trois consignes personnalisables.',
  f12Title: "Génération d'images",
  f12Body:
    "Décrivez une image et joignez-la à votre message. Formats carré, paysage et portrait (1:1, 16:9, 9:16, 4:3, 3:4, 3:2, 2:3), préréglages de style (photoréaliste, illustration, infographie, 3D), cadrage et ambiance. La première image du message peut servir de référence visuelle.",
  f13Title: 'Annuler / Rétablir',
  f13Body:
    "Chaque modification par l'IA est réversible. Les flèches annuler et rétablir sont directement dans la barre d'outils de rédaction : rien n'est jamais perdu.",
  f14Title: 'Choix du modèle et du raisonnement',
  f14Body:
    "Sélectionnez n'importe quel modèle Codex disponible sur votre compte ChatGPT et réglez l'effort de raisonnement par requête. Par défaut : <code>gpt-5.6-luna</code> avec raisonnement maximal.",
  f15Title: "Cinq langues d'interface",
  f15Body:
    "L'interface de l'extension est disponible en anglais, français, allemand, espagnol et japonais, sélectionnée automatiquement selon la langue de votre navigateur.",


  howTitle: 'Comment ça marche',
  howLead:
    "Une extension de navigateur ne peut pas lancer un processus de bureau, et elle ne peut pas détenir un jeton de rafraîchissement OAuth en sécurité. Les fonctions IA passent donc par un petit connecteur local que vous installez une fois sous Windows.",
  step1Title: "L'extension",
  step1Body:
    "Ne s'exécute que sur <code>x.com</code> et <code>twitter.com</code>. Elle lit le message que vous avez sélectionné ou le brouillon que vous avez tapé, et rien d'autre.",
  step2Title: 'Le connecteur local',
  step2Body:
    "Un petit programme signé qui écoute sur <code>127.0.0.1:47623</code>, joignable uniquement depuis votre propre machine. Il démarre le Codex App Server officiel dans votre session Windows, refuse les approbations d'outils et utilise des fils éphémères en lecture seule.",
  step3Title: 'Votre compte ChatGPT',
  step3Body:
    "Codex réutilise la connexion ChatGPT déjà présente sur votre ordinateur. La requête est envoyée à OpenAI sous votre propre compte, avec le modèle et l'effort de raisonnement que vous avez choisis. Xtension ne demande jamais de clé d'API.",
  flowBrowser: 'Navigateur',
  flowConnector: 'Connecteur local<br />127.0.0.1',
  flowCodex: 'Codex App Server',
  flowOpenAI: 'OpenAI<br />(votre compte)',
  howNote:
    "L'export PDF n'a besoin de rien de tout cela : il fonctionne seul, hors ligne, dès que l'extension est installée.",

  privacyTitle: 'Confidentialité et sécurité',
  privacyDoesTitle: 'Ce que fait Xtension',
  pd1: 'Lit le texte visible du message, article, fil ou brouillon sur lequel vous agissez.',
  pd2: 'Récupère les images publiques de ce contenu depuis <code>pbs.twimg.com</code>.',
  pd3: "Envoie ce contenu au connecteur local uniquement lorsque vous cliquez sur une action IA.",
  pd4: "Enregistre vos réglages dans le stockage d'extension du navigateur, sur votre machine.",
  privacyNotTitle: 'Ce que Xtension ne fait jamais',
  pn1: 'Aucune donnée envoyée à un serveur appartenant au développeur.',
  pn2: "Aucun mot de passe, cookie ou jeton d'authentification X/Twitter lu.",
  pn3: 'Aucun accès à vos messages privés.',
  pn4: "Aucun historique de navigation, aucune analyse d'audience, aucun pistage, aucune publicité.",
  pn5: "Aucune clé d'API OpenAI demandée ni stockée.",

  secTitle: 'Propriétés de sécurité vérifiables',
  sec1: "<strong>Boucle locale uniquement.</strong> Le connecteur écoute sur <code>127.0.0.1</code>. Il n'est joignable ni depuis votre réseau local, ni depuis Internet.",
  sec2: "<strong>Origines restreintes.</strong> Seules les origines d'extension de navigateur sont acceptées par la politique CORS du connecteur, et un jeton partagé peut être exigé en option.",
  sec3: "<strong>Sans droits administrateur.</strong> Le connecteur s'installe dans votre profil utilisateur sous <code>%LOCALAPPDATA%</code>. Il ne s'exécute jamais en tant que SYSTEM.",
  sec4: "<strong>Signé et horodaté.</strong> L'installateur est signé via Microsoft Trusted Signing. Vérifiez-le dans Windows : clic droit → <em>Propriétés</em> → <em>Signatures numériques</em>.",
  sec5: '<strong>Empreintes publiées.</strong> Chaque téléchargement ci-dessous affiche son SHA-256 pour que vous puissiez vérifier le fichier reçu.',
  sec6: "<strong>Aucun code distant.</strong> L'extension embarque tout son code dans le paquet. Elle ne télécharge ni n'évalue jamais de code récupéré à l'exécution.",
  privacyLink: 'Lire la politique de confidentialité complète →',

  dlTitle: 'Téléchargement',
  dlLead:
    "Installez l'extension dans votre navigateur. Puis, seulement si vous voulez les fonctions IA, installez le connecteur sous Windows. Tous les téléchargements ci-dessous sont servis par <strong>GitHub Releases</strong>, depuis le dépôt du projet — rien n'est hébergé ailleurs.",
  dlStep1: "1 · L'extension de navigateur",
  dlChromeMeta: 'Brave · Vivaldi · Opera · v0.6.10',
  dlZip: 'Télécharger le .zip',
  dlZip2: 'Télécharger le .zip',
  dlZip3: 'Télécharger le .zip',
  dlHowSummary: 'Comment installer un paquet .zip',
  dlHow1: 'Décompressez l’archive dans un dossier que vous conservez.',
  dlHow2: 'Ouvrez <code>chrome://extensions</code> (ou <code>edge://extensions</code>).',
  dlHow3: 'Activez le <strong>mode développeur</strong>.',
  dlHow4:
    'Cliquez sur <strong>Charger l’extension non empaquetée</strong> et sélectionnez le dossier décompressé.',
  dlHow5: 'Ouvrez <code>about:debugging#/runtime/this-firefox</code>.',
  dlHow6:
    'Cliquez sur <strong>Charger un module temporaire</strong> et sélectionnez le <code>manifest.json</code> dans le dossier décompressé.',
  dlStep2: '2 · Le connecteur Codex (optionnel, Windows)',
  dlConnectorLead:
    "Nécessaire uniquement pour les fonctions IA. L'export PDF fonctionne sans. S'installe pour l'utilisateur courant, sans droits administrateur, et démarre automatiquement à l'ouverture de session.",
  dlConnectorBtn: 'Télécharger XtensionBridgeSetup.exe',
  dlConnectorBtnSub: 'Windows · 82 Mo · v0.6.10 · depuis GitHub',
  checksumTitle: 'Vérifiez ce que vous avez téléchargé',
  checksumLead:
    'Sous Windows, lancez <code>Get-FileHash &lt;fichier&gt; -Algorithm SHA256</code> dans PowerShell et comparez avec la valeur ci-dessous.',
  thFile: 'Fichier',
  checksumRaw: 'Fichier brut des empreintes',
  versionJson: 'version.json',

  srcTitle: 'Libre et open source',
  srcLead:
    "Une extension qui lit ce que vous écrivez et un programme qui tourne sur votre machine devraient être inspectables. L'intégralité du code est publiée sur GitHub sous licence Apache 2.0 : chacun peut lire exactement ce que fait Xtension, examiner les appels réseau, vérifier que les affirmations de cette page tiennent — et utiliser, modifier ou redistribuer le code.",
  srcBtnSub: 'Parcourir le code, ouvrir un ticket',
  srcLicense:
    "Sous <a href=\"https://github.com/JoDevelop1/xtension/blob/main/LICENSE\" rel=\"noopener\">licence Apache 2.0</a> — libre d'utilisation, de modification et de redistribution, y compris commerciale, avec concession de brevet explicite. L'attribution et une copie de la licence sont requises.",

  footerBy: 'un projet indépendant de JoDevelop',
  footerSupport: 'Assistance',
  footerPrivacy: 'Confidentialité',
  footerSecurity: 'Sécurité',
  footerDisclaimer:
    "Sans affiliation avec X Corp., OpenAI, Microsoft, Google, Mozilla ou Apple. X et Twitter sont des marques de leurs propriétaires respectifs.",
};

const STORAGE_KEY = 'xtension-lang';
const nodes = Array.from(document.querySelectorAll('[data-i18n]'));

/** Sauvegarde du texte anglais d'origine, pour pouvoir revenir en arrière. */
const EN = new Map();
for (const node of nodes) {
  EN.set(node, node.innerHTML);
}

function applyLanguage(lang) {
  const french = lang === 'fr';
  for (const node of nodes) {
    const key = node.dataset.i18n;
    if (french) {
      if (Object.prototype.hasOwnProperty.call(FR, key)) {
        node.innerHTML = FR[key];
      }
    } else {
      node.innerHTML = EN.get(node);
    }
  }
  document.documentElement.lang = french ? 'fr' : 'en';
  const label = document.getElementById('lang-label');
  if (label) label.textContent = french ? 'EN' : 'FR';
  document.title = french
    ? 'Xtension — outils de rédaction IA et export PDF pour X/Twitter'
    : 'Xtension — AI writing tools and PDF export for X/Twitter';
}

function initialLanguage() {
  let stored = null;
  try {
    stored = localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    // Stockage indisponible (mode privé strict) : on retombe sur la langue du navigateur.
  }
  if (stored === 'fr' || stored === 'en') return stored;
  return (navigator.language || 'en').toLowerCase().startsWith('fr') ? 'fr' : 'en';
}

let current = initialLanguage();
applyLanguage(current);

const toggle = document.getElementById('lang-toggle');
if (toggle) {
  toggle.addEventListener('click', () => {
    current = current === 'fr' ? 'en' : 'fr';
    applyLanguage(current);
    try {
      localStorage.setItem(STORAGE_KEY, current);
    } catch (error) {
      // Préférence non persistée : sans conséquence pour la navigation en cours.
    }
  });
}
