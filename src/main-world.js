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
