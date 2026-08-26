// Pont « monde principal » (world: MAIN) pour Xtension.
//
// POURQUOI CE FICHIER EXISTE
// L'éditeur de réponse de X est Draft.js (contentEditable contrôlé par React).
// La seule façon d'y écrire du texte qui reste PLEINEMENT ÉDITABLE (Backspace,
// frappe, sélection) est de mettre à jour son EditorState via le onChange React :
// document.execCommand("insertText") affiche bien le texte dans le DOM mais NE
// met JAMAIS à jour le ContentState interne de Draft -> le modèle reste vide,
// donc le texte est figé (rien à effacer côté modèle). Vérifié en direct.
//
// Or les internals React (la fibre __reactFiber$… et les props onChange /
// editorState) ne sont PAS visibles depuis un content-script classique (monde
// isolé). Ce script tourne donc dans le MONDE PRINCIPAL (manifest world: MAIN),
// où il voit la fibre React, et applique le texte via onChange.
//
// COMMUNICATION avec le content-script (monde isolé), via le DOM partagé :
//   1. Le content-script pose l'attribut data-xtension-draft-text="<texte>" sur
//      l'éditeur cible, puis dispatch l'événement DOM "xtension-draft-apply".
//   2. Ce script (écouteur, monde principal) lit l'attribut, met à jour Draft,
//      et pose data-xtension-draft-done="1" (ou "0") sur l'éditeur.
// Les événements DOM et attributs traversent la frontière des mondes de façon
// fiable (DOM partagé), contrairement aux objets JS / au detail des CustomEvent.
(() => {
  "use strict";

  const FOLLOWING_MAP_ATTRIBUTE = "data-xtension-following-map";
  const FOLLOWING_MAP_EVENT = "xtension-following-map";
  const relationshipByHandle = new Map();
  const relationshipPriorityByHandle = new Map();
  let followingMapPublishQueued = false;

  // Les reponses GraphQL de X contiennent deja la relation entre le compte
  // connecte et les auteurs presents dans la timeline. On ne conserve que le
  // pseudonyme et les booleens de relation, jamais le contenu des publications.
  // Le content-script peut ainsi afficher l'etat sans provoquer le hover card
  // (et donc sans requete supplementaire par auteur).
  function normalizeHandle(value) {
    return String(value || "")
      .trim()
      .replace(/^@+/, "")
      .toLowerCase();
  }

  function readRelationshipBoolean(candidates) {
    for (const [candidate, priority] of candidates) {
      if (typeof candidate === "boolean") {
        return { value: candidate, priority };
      }
    }
    return null;
  }

  function readFollowingState(value) {
    // X peut encore fournir un champ legacy perime a cote de la perspective
    // courante. La priorite doit survivre a la traversee recursive du payload.
    const candidates = [
      [value?.relationship_perspectives?.following, 30],
      [value?.result?.relationship_perspectives?.following, 30],
      [value?.legacy?.following, 20],
      [value?.result?.legacy?.following, 20],
      [value?.following, 10]
    ];
    return readRelationshipBoolean(candidates);
  }

  function readFollowedByState(value) {
    const candidates = [
      [value?.relationship_perspectives?.followed_by, 30],
      [value?.relationship_perspectives?.followedBy, 30],
      [value?.result?.relationship_perspectives?.followed_by, 30],
      [value?.result?.relationship_perspectives?.followedBy, 30],
      [value?.legacy?.followed_by, 20],
      [value?.legacy?.followedBy, 20],
      [value?.result?.legacy?.followed_by, 20],
      [value?.result?.legacy?.followedBy, 20],
      [value?.followed_by, 10],
      [value?.followedBy, 10]
    ];
    return readRelationshipBoolean(candidates);
  }

  function readRelationshipHandle(value) {
    const candidates = [
      value?.core?.screen_name,
      value?.legacy?.screen_name,
      value?.result?.core?.screen_name,
      value?.result?.legacy?.screen_name,
      value?.screen_name
    ];
    return normalizeHandle(candidates.find((candidate) => typeof candidate === "string"));
  }

  function collectFollowingRelationships(payload) {
    if (!payload || typeof payload !== "object") {
      return false;
    }

    const stack = [payload];
    const visited = new WeakSet();
    let changed = false;
    let inspected = 0;

    // Une timeline peut etre volumineuse. Cette limite laisse une marge large
    // tout en evitant qu'une reponse inattendue monopolise le thread principal.
    while (stack.length && inspected < 180000) {
      const value = stack.pop();
      if (!value || typeof value !== "object" || visited.has(value)) {
        continue;
      }
      visited.add(value);
      inspected += 1;

      const handle = readRelationshipHandle(value);
      const following = readFollowingState(value);
      const followedBy = readFollowedByState(value);
      const previous = handle ? relationshipByHandle.get(handle) : null;
      const previousPriority = handle ? relationshipPriorityByHandle.get(handle) : null;
      const useFollowing = following
        && following.priority >= (previousPriority?.following ?? -1);
      const useFollowedBy = followedBy
        && followedBy.priority >= (previousPriority?.followedBy ?? -1);
      const next = {
        following: useFollowing ? following.value : previous?.following,
        followedBy: useFollowedBy ? followedBy.value : previous?.followedBy
      };
      const nextPriority = {
        following: useFollowing ? following.priority : previousPriority?.following,
        followedBy: useFollowedBy ? followedBy.priority : previousPriority?.followedBy
      };
      if (
        handle
        && (typeof next.following === "boolean" || typeof next.followedBy === "boolean")
        && (previous?.following !== next.following || previous?.followedBy !== next.followedBy)
      ) {
        relationshipByHandle.set(handle, next);
        changed = true;
      }
      if (
        handle
        && (previousPriority?.following !== nextPriority.following
          || previousPriority?.followedBy !== nextPriority.followedBy)
      ) {
        relationshipPriorityByHandle.set(handle, nextPriority);
      }

      if (Array.isArray(value)) {
        for (let index = value.length - 1; index >= 0; index -= 1) {
          if (value[index] && typeof value[index] === "object") {
            stack.push(value[index]);
          }
        }
      } else {
        for (const child of Object.values(value)) {
          if (child && typeof child === "object") {
            stack.push(child);
          }
        }
      }
    }

    if (changed) {
      scheduleFollowingMapPublish();
    }
    return changed;
  }

  function scheduleFollowingMapPublish() {
    if (followingMapPublishQueued) {
      return;
    }
    followingMapPublishQueued = true;
    queueMicrotask(() => {
      followingMapPublishQueued = false;
      try {
        const entries = Array.from(relationshipByHandle.entries()).slice(-1000);
        document.documentElement?.setAttribute?.(FOLLOWING_MAP_ATTRIBUTE, JSON.stringify(Object.fromEntries(entries)));
        document.dispatchEvent(new Event(FOLLOWING_MAP_EVENT));
      } catch (error) {
        // best-effort : l'enrichissement de la timeline ne doit jamais affecter X.
      }
    });
  }

  function isRelationshipResponseUrl(value) {
    try {
      const url = new URL(String(value?.url || value || ""), window.location.href);
      return /(^|\.)((x|twitter)\.com)$/i.test(url.hostname)
        && /\/(?:i\/api\/)?graphql\//i.test(url.pathname);
    } catch (error) {
      return false;
    }
  }

  function inspectFetchResponse(response, requestedUrl) {
    if (!response?.ok || !isRelationshipResponseUrl(response.url || requestedUrl)) {
      return;
    }
    const contentType = String(response.headers?.get?.("content-type") || "");
    if (contentType && !/json/i.test(contentType)) {
      return;
    }
    response.clone().json().then(collectFollowingRelationships).catch(() => {});
  }

  function installRelationshipFetchObserver() {
    const originalFetch = window.fetch;
    if (typeof originalFetch !== "function" || originalFetch.__xtensionFollowingObserver) {
      return;
    }

    const observedFetch = new Proxy(originalFetch, {
      apply(target, thisArgument, args) {
        const requestedUrl = args[0];
        return Reflect.apply(target, thisArgument, args).then((response) => {
          inspectFetchResponse(response, requestedUrl);
          return response;
        });
      }
    });
    Object.defineProperty(observedFetch, "__xtensionFollowingObserver", { value: true });
    window.fetch = observedFetch;
  }

  function installRelationshipXhrObserver() {
    const prototype = window.XMLHttpRequest?.prototype;
    if (!prototype || prototype.open?.__xtensionFollowingObserver) {
      return;
    }
    const originalOpen = prototype.open;
    const originalSend = prototype.send;

    function observedOpen(method, url, ...rest) {
      this.__xtensionFollowingUrl = url;
      return Reflect.apply(originalOpen, this, [method, url, ...rest]);
    }
    Object.defineProperty(observedOpen, "__xtensionFollowingObserver", { value: true });
    prototype.open = observedOpen;
    prototype.send = function observedSend(...args) {
      if (isRelationshipResponseUrl(this.__xtensionFollowingUrl)) {
        this.addEventListener("load", () => {
          try {
            if (this.status < 200 || this.status >= 300) {
              return;
            }
            const payload = this.responseType === "json"
              ? this.response
              : JSON.parse(String(this.responseText || ""));
            collectFollowingRelationships(payload);
          } catch (error) {
            // best-effort
          }
        }, { once: true });
      }
      return Reflect.apply(originalSend, this, args);
    };
  }

  installRelationshipFetchObserver();
  installRelationshipXhrObserver();

  // Remonte la fibre React depuis l'élément éditeur jusqu'aux props du composant
  // DraftEditor (celui qui porte editorState + onChange).
  function findDraftProps(element) {
    const key = Object.keys(element).find(
      (name) => name.indexOf("__reactFiber$") === 0 || name.indexOf("__reactInternalInstance$") === 0
    );
    let fiber = key ? element[key] : null;
    while (fiber) {
      const props = fiber.memoizedProps;
      if (
        props
        && props.editorState
        && typeof props.onChange === "function"
        && typeof props.editorState.getCurrentContent === "function"
      ) {
        return props;
      }
      fiber = fiber.return;
    }
    return null;
  }

  // Remplace tout le contenu de l'éditeur par `text`, dans le modèle Draft.
  function applyDraftText(editor, text) {
    const props = findDraftProps(editor);
    if (!props) {
      return false;
    }
    const editorState = props.editorState;
    const EditorState = editorState.constructor;
    const ContentState = editorState.getCurrentContent().constructor;
    if (
      !EditorState || typeof EditorState.createWithContent !== "function"
      || !ContentState || typeof ContentState.createFromText !== "function"
    ) {
      return false;
    }
    const content = ContentState.createFromText(text == null ? "" : String(text));
    let nextState = EditorState.createWithContent(content);
    if (typeof EditorState.moveFocusToEnd === "function") {
      nextState = EditorState.moveFocusToEnd(nextState);
    }
    props.onChange(nextState);
    return true;
  }

  document.addEventListener(
    "xtension-draft-apply",
    () => {
      const editors = document.querySelectorAll("[data-xtension-draft-text]");
      editors.forEach((editor) => {
        const text = editor.getAttribute("data-xtension-draft-text");
        // On consomme l'attribut immédiatement (évite toute ré-application).
        editor.removeAttribute("data-xtension-draft-text");
        let ok = false;
        try {
          ok = applyDraftText(editor, text);
        } catch (error) {
          ok = false;
        }
        try {
          editor.setAttribute("data-xtension-draft-done", ok ? "1" : "0");
        } catch (error) {
          // best-effort
        }
      });
    },
    false
  );

  // Marque la présence du pont pour que le content-script sache qu'il peut
  // l'utiliser (et retomber sur execCommand sinon, ex. Firefox sans world MAIN).
  try {
    document.documentElement.setAttribute("data-xtension-mainworld", "1");
  } catch (error) {
    // best-effort
  }
})();
