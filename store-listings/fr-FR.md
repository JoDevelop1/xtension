# Xtension

## Résumé court

Exportez vos publications X/Twitter en PDF et écrivez mieux avec votre propre compte ChatGPT.

## Description

Xtension ajoute deux ensembles d'outils indépendants à X/Twitter. Chacun fonctionne sans l'autre.

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

Lorsque vous activez les outils de brouillon, une barre d'outils compacte apparaît dans la zone de rédaction de X/Twitter :

- **Correction** — corrige la grammaire, l'orthographe et la syntaxe en gardant votre voix.
- **Traduction** — traduit votre brouillon dans la langue de sortie que vous choisissez.
- **Reformulation** — réécrit votre brouillon pour le rendre plus clair ou plus percutant.
- **Générer** — transforme une consigne en message fini ; sur un brouillon vide sous un tweet, l'outil rédige plutôt une réponse contextuelle.
- **Suggestions de réponses** — des réponses prêtes à publier sous plusieurs angles (réaction humaine, impact court, argument concret, accord positif, humour contextuel, angle incisif, contexte utile, question), plus trois consignes personnalisables.
- **Génération d'images** — décrivez une image et joignez-la à votre message, avec formats carré, paysage et portrait, préréglages de style, cadrage et ambiance.
- **Annuler / Rétablir** — chaque modification par l'IA est réversible depuis la barre d'outils.
- **Choix du modèle** — sélectionnez n'importe quel modèle Codex disponible sur votre compte ChatGPT et réglez l'effort de raisonnement par requête.

Ces fonctions IA nécessitent le **connecteur Codex Xtension**, un petit programme que vous installez séparément sous Windows. Il écoute uniquement sur `127.0.0.1:47623`, n'est joignable que depuis votre propre machine, et démarre le Codex App Server officiel en réutilisant la connexion ChatGPT déjà présente sur votre ordinateur. Xtension ne demande jamais de clé d'API OpenAI et n'envoie jamais vos données à un serveur appartenant au développeur. Le connecteur se télécharge séparément : https://xtension.jodevelop.com

L'interface de l'extension est disponible en anglais, français, allemand, espagnol et japonais.

Permissions utilisées :

- `x.com` / `twitter.com` : ajouter les actions Xtension dans le menu et la zone de rédaction de X/Twitter, et lire uniquement le contenu visible que vous avez sélectionné.
- `pbs.twimg.com` : récupérer les images, avatars, images de carte et vignettes vidéo publiques de X/Twitter liées au contenu sélectionné.
- `localhost:47623` / `127.0.0.1:47623` : connecter les outils IA optionnels au connecteur Codex qui tourne sur votre propre ordinateur. L'extension elle-même ne peut pas exécuter de commandes locales.
- `storage` : enregistrer vos réglages dans le navigateur.

Xtension ne collecte aucune donnée personnelle, n'envoie rien à un serveur appartenant au développeur, ne contient ni analyse d'audience ni pistage, et ne modifie pas votre compte X/Twitter. L'extension ne contient aucun code de capture micro ou audio. L'intégralité du code source est publiée sous licence Apache 2.0 sur https://github.com/JoDevelop1/xtension

Xtension est un projet indépendant. Il n'est affilié ni à X Corp., ni à OpenAI, Microsoft, Google, Mozilla ou Apple.

## Mots-clés

X, Twitter, PDF, export, fil, article, IA, ChatGPT, Codex, rédaction, correction, traduction, réponse
