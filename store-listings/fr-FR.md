# Xtension

## Résumé court

Générez des réponses IA sur vos réseaux avec votre compte ChatGPT, plus l'export PDF sur X.

## Description

Xtension ajoute des outils de réponse IA, déclenchés par l'utilisateur, à X/Twitter, Reddit, Facebook, Instagram, Threads, LinkedIn, Bluesky et YouTube. X/Twitter conserve en plus l'export PDF local, ImageGen et les indicateurs Abonné / Non abonné directement dans la timeline.

**1. Export PDF — entièrement local**

Ouvrez le menu `...` d'un article, d'un tweet ou d'un fil X et choisissez **Télécharger en PDF**. L'extension détecte le contenu pertinent, extrait le texte, la structure, les tweets cités et les images, puis génère le PDF dans votre navigateur. Pour les fils, Xtension regroupe les messages successifs du même auteur et s'arrête avant les réponses des autres comptes. Votre navigateur ouvre sa boîte de dialogue **Enregistrer sous** habituelle : vous choisissez le nom du fichier et le dossier. Aucun service externe n'intervient.

- Export PDF direct depuis le menu d'un article, tweet ou fil X/Twitter.
- Conservation de la structure des articles : titres, paragraphes, listes et citations.
- Détection des fils du même auteur sans capturer toutes les réponses.
- Inclusion des tweets cités avec leur contenu disponible.
- Intégration des images des médias, avatars, images de carte et vignettes vidéo.
- Liens conservés cliquables et URL source ajoutée.
- Génération locale, hors ligne, sans service externe.

**2. Outils de rédaction IA — via votre propre compte ChatGPT**

Lorsque vous activez les outils de brouillon, une barre d'outils compacte apparaît près des champs de réponse pris en charge :

- **Correction** — corrige la grammaire, l'orthographe et la syntaxe en gardant votre voix.
- **Traduction** — traduit votre brouillon dans la langue de sortie que vous choisissez.
- **Reformulation** — réécrit votre brouillon pour le rendre plus clair ou plus percutant.
- **Générer** — transforme une consigne en post ou réponse adapté à la plateforme visible.
- **Suggestions de réponses** — trois réponses contextuelles générées indépendamment à partir de consignes personnalisables.
- **Génération d'images sur X/Twitter** — décrivez une image et joignez-la à votre message, avec formats carré, paysage et portrait, préréglages de style, cadrage et ambiance.
- **Annuler / Rétablir** — chaque modification par l'IA est réversible depuis la barre d'outils.
- **Choix du modèle** — sélectionnez n'importe quel modèle Codex disponible sur votre compte ChatGPT et réglez l'effort de raisonnement par requête.

Ces fonctions IA nécessitent le **connecteur Codex Xtension**, un petit programme que vous installez séparément sous Windows. Il écoute uniquement sur `127.0.0.1:47623`, n'est joignable que depuis votre propre machine, et démarre le Codex App Server officiel en réutilisant la connexion ChatGPT déjà présente sur votre ordinateur. Xtension ne demande jamais de clé d'API OpenAI et n'envoie jamais vos données à un serveur appartenant au développeur. Le connecteur se télécharge séparément : https://xtension.jodevelop.com

L'interface de l'extension est disponible en anglais, français, allemand, espagnol et japonais.

Permissions utilisées :

- `x.com` / `twitter.com` : ajouter les actions Xtension dans le menu et la zone de rédaction de X/Twitter, et lire uniquement le contenu visible que vous avez sélectionné.
- Reddit, Facebook, Instagram, Threads, LinkedIn, Bluesky et YouTube : ajouter la barre IA près des champs de post ou commentaire reconnus et lire le post visible voisin lorsque vous utilisez l'aide à la réponse. Les routes de messages privés sont exclues.
- `pbs.twimg.com` : récupérer les images, avatars, images de carte et vignettes vidéo publiques de X/Twitter liées au contenu sélectionné.
- `localhost:47623` / `127.0.0.1:47623` : connecter les outils IA optionnels au connecteur Codex qui tourne sur votre propre ordinateur. L'extension elle-même ne peut pas exécuter de commandes locales.
- `storage` : enregistrer vos réglages dans le navigateur.

Xtension ne collecte aucune donnée personnelle, n'envoie rien à un serveur appartenant au développeur et ne contient ni analyse d'audience ni pistage. Le texte généré est inséré comme brouillon et l'extension ne clique jamais sur le bouton final de publication. Elle ne contient aucun code de capture micro ou audio. L'intégralité du code source est publiée sous licence Apache 2.0 sur https://github.com/JoDevelop1/xtension

Xtension est un projet indépendant. Il n'est affilié ni à X Corp., ni à OpenAI, Microsoft, Google, Mozilla ou Apple.

## Mots-clés

X, Twitter, Reddit, Facebook, Instagram, Threads, LinkedIn, Bluesky, YouTube, PDF, IA, ChatGPT, Codex, rédaction, traduction, réponse
