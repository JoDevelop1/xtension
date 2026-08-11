# Étude technique : `SendInput` et `Event.isTrusted`

Date de la mesure : 11 août 2026  
Environnement : Windows, Google Chrome et Microsoft Edge  
Portée : page locale uniquement, aucune publication et aucune interaction avec un site tiers

## Conclusion mesurée

Une saisie Unicode envoyée par l'API Windows `SendInput` a produit, dans Chrome et Edge, des événements DOM dont `isTrusted` valait `true`.

| Navigateur | Texte injecté | Enregistrements Windows | Événements DOM | Types observés | Résultat |
|---|---:|---:|---:|---|---|
| Chrome | `NativeChrome42` | 28 | 56 | `keydown`, `beforeinput`, `input`, `keyup` | 56/56 avec `isTrusted: true` |
| Edge | `NativeEdge42` | 24 | 48 | `keydown`, `beforeinput`, `input`, `keyup` | 48/48 avec `isTrusted: true` |

Pour chaque caractère, le navigateur a émis cette séquence :

```text
SendInput(KEYEVENTF_UNICODE, key down)
SendInput(KEYEVENTF_UNICODE, key up)
    ↓
Windows distribue l'entrée à la fenêtre au premier plan
    ↓
keydown      isTrusted=true
beforeinput  isTrusted=true  inputType="insertText"
input        isTrusted=true  inputType="insertText"
keyup        isTrusted=true
```

Le test démontre donc qu'il est techniquement possible d'obtenir `event.isTrusted === true` dans le navigateur en passant par l'entrée native Windows. Il ne démontre pas qu'une entrée injectée est impossible à distinguer d'un clavier physique à d'autres niveaux du système.

## Ce que signifie exactement `isTrusted`

`Event.isTrusted` est une propriété en lecture seule attribuée par le navigateur :

- un événement créé par JavaScript avec `new KeyboardEvent(...)` puis `dispatchEvent(...)` n'est pas fiable et expose normalement `isTrusted: false` ;
- quand le navigateur reçoit une entrée depuis la pile native du système, il fabrique lui-même les événements DOM ;
- dans les versions de Chrome et Edge testées, les événements fabriqués à la suite de `SendInput` exposent `isTrusted: true`.

La propriété DOM et le marqueur Windows sont deux informations différentes :

- côté DOM, la mesure donne bien `isTrusted: true` ;
- côté Windows, un hook clavier bas niveau peut examiner le drapeau `LLKHF_INJECTED` dans `KBDLLHOOKSTRUCT.flags` ;
- le JavaScript ordinaire d'une page web n'a pas directement accès à cette structure Win32 ;
- ce test ne prétend rien sur d'éventuels signaux supplémentaires employés par un logiciel natif, une politique d'entreprise ou un service distant.

Références officielles :

- WHATWG DOM, définition de `isTrusted` : <https://dom.spec.whatwg.org/#dom-event-istrusted>
- Microsoft, fonction `SendInput` : <https://learn.microsoft.com/windows/win32/api/winuser/nf-winuser-sendinput>
- Microsoft, structure `KBDLLHOOKSTRUCT` et `LLKHF_INJECTED` : <https://learn.microsoft.com/windows/win32/api/winuser/ns-winuser-kbdllhookstruct>
- W3C Input Events : <https://www.w3.org/TR/input-events-2/>

## Architecture complète du banc d'essai

Le banc d'essai comportait trois pièces indépendantes :

1. une page HTML locale qui recevait la saisie et enregistrait les propriétés des événements ;
2. un petit client du protocole Chrome DevTools pour sélectionner, vider et lire exactement cette page dans Edge ;
3. un injecteur Win32 temporaire qui appelait `SendInput` après avoir vérifié la fenêtre active.

Le serveur local était lancé ainsi depuis la racine du dépôt :

```powershell
python -m http.server 18765 --bind 127.0.0.1
```

La page était disponible uniquement à cette adresse :

```text
http://127.0.0.1:18765/tests/is-trusted-harness.html
```

### 1. Page HTML de mesure

Voici une version autonome de la page utilisée. Elle journalise les événements sans les fabriquer ni modifier leur propriété `isTrusted`.

```html
<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>Xtension isTrusted Local Test</title>
  <style>
    body { font: 16px system-ui; margin: 32px; }
    #target { min-height: 120px; padding: 16px; border: 2px solid #555; }
    #log { white-space: pre-wrap; user-select: text; }
  </style>
</head>
<body>
  <h1>Test local de Event.isTrusted</h1>
  <div id="target" contenteditable="true" data-testid="target"></div>
  <pre id="log"></pre>
  <script>
    const target = document.getElementById("target");
    const log = document.getElementById("log");
    const eventNames = [
      "keydown", "beforeinput", "input", "keyup", "paste",
      "compositionstart", "compositionupdate", "compositionend"
    ];

    window.__xtensionEvents = [];

    function record(event) {
      window.__xtensionEvents.push({
        type: event.type,
        isTrusted: event.isTrusted,
        inputType: event.inputType || "",
        data: event.data ?? null,
        key: event.key || "",
        text: target.innerText
      });
      log.textContent = JSON.stringify(window.__xtensionEvents, null, 2);
    }

    for (const eventName of eventNames) {
      target.addEventListener(eventName, record);
    }

    window.__resetXtensionTest = () => {
      target.innerHTML = "";
      window.__xtensionEvents.length = 0;
      log.textContent = "";
      target.focus();
    };

    window.__resetXtensionTest();
  </script>
</body>
</html>
```

### 2. Sélection et lecture de la page Edge avec DevTools

Edge a été démarré avec un port de débogage local :

```powershell
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
$testProfile = Join-Path (Get-Location) 'dist\edge-is-trusted-profile'
& $edge `
  "--user-data-dir=$testProfile" `
  --remote-debugging-port=19333 `
  --remote-allow-origins=* `
  --new-window `
  'http://127.0.0.1:18765/tests/is-trusted-harness.html'
```

Le profil séparé ci-dessus est celui qui a réellement servi à la mesure afin d'obtenir un port DevTools propre. Il n'est pas nécessaire à `SendInput` lui-même : après accord explicite, la même procédure peut cibler une page locale ouverte dans un profil Edge existant, à condition de conserver la sélection par URL exacte et les vérifications de fenêtre et de PID.

La liste des cibles était interrogée localement :

```powershell
$targets = Invoke-RestMethod -Uri 'http://127.0.0.1:19333/json/list'
$target = @($targets | Where-Object {
  $_.type -eq 'page' -and
  $_.url -eq 'http://127.0.0.1:18765/tests/is-trusted-harness.html'
})

if ($target.Count -ne 1) {
  throw "La page de test locale doit être l'unique cible sélectionnée."
}
```

Le client Node suivant communique uniquement avec le WebSocket de cette cible :

```js
const wsUrl = process.argv[2];
const action = process.argv[3] || "read";

if (!wsUrl) throw new Error("A DevTools WebSocket URL is required.");

const socket = new WebSocket(wsUrl);
let nextId = 1;
const pending = new Map();

socket.addEventListener("message", (event) => {
  const message = JSON.parse(String(event.data));
  if (!message.id || !pending.has(message.id)) return;
  const { resolve, reject } = pending.get(message.id);
  pending.delete(message.id);
  if (message.error) reject(new Error(message.error.message));
  else resolve(message.result || {});
});

await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

function command(method, params = {}) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

if (action === "focus") {
  await command("Page.bringToFront");
  await command("Runtime.evaluate", {
    expression: `
      window.__resetXtensionTest();
      document.getElementById("target").focus();
      document.title;
    `,
    returnByValue: true
  });
  console.log("focused");
} else {
  const result = await command("Runtime.evaluate", {
    expression: `JSON.stringify({
      events: window.__xtensionEvents,
      text: document.getElementById("target").innerText
    })`,
    returnByValue: true
  });
  console.log(result.result?.value || "{}");
}

socket.close();
```

Commandes correspondantes :

```powershell
node .\tests\is-trusted-cdp.mjs $target[0].webSocketDebuggerUrl focus
# Appel SendInput ici
node .\tests\is-trusted-cdp.mjs $target[0].webSocketDebuggerUrl read
```

### 3. Injection native Windows utilisée pour la mesure

L'essai a utilisé `KEYEVENTF_UNICODE`. Chaque unité UTF-16 a été envoyée deux fois : pression puis relâchement.

```csharp
using System;
using System.Runtime.InteropServices;

public static class XtensionTrustedInputProbe
{
    private const uint InputKeyboard = 1;
    private const uint KeyEventKeyUp = 0x0002;
    private const uint KeyEventUnicode = 0x0004;

    [StructLayout(LayoutKind.Sequential)]
    public struct INPUT
    {
        public uint type;
        public InputUnion U;
    }

    [StructLayout(LayoutKind.Explicit)]
    public struct InputUnion
    {
        [FieldOffset(0)] public MOUSEINPUT mi;
        [FieldOffset(0)] public KEYBDINPUT ki;
        [FieldOffset(0)] public HARDWAREINPUT hi;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct KEYBDINPUT
    {
        public ushort wVk;
        public ushort wScan;
        public uint dwFlags;
        public uint time;
        public IntPtr dwExtraInfo;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct MOUSEINPUT
    {
        public int dx;
        public int dy;
        public uint mouseData;
        public uint dwFlags;
        public uint time;
        public IntPtr dwExtraInfo;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct HARDWAREINPUT
    {
        public uint uMsg;
        public ushort wParamL;
        public ushort wParamH;
    }

    [DllImport("user32.dll", SetLastError = true)]
    private static extern uint SendInput(uint count, INPUT[] inputs, int size);

    [DllImport("user32.dll")]
    private static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint processId);

    public static uint ForegroundProcessId()
    {
        GetWindowThreadProcessId(GetForegroundWindow(), out uint processId);
        return processId;
    }

    public static uint TypeUnicode(string value)
    {
        var inputs = new INPUT[value.Length * 2];

        for (int i = 0; i < value.Length; i++)
        {
            inputs[i * 2].type = InputKeyboard;
            inputs[i * 2].U.ki.wScan = value[i];
            inputs[i * 2].U.ki.dwFlags = KeyEventUnicode;

            inputs[i * 2 + 1].type = InputKeyboard;
            inputs[i * 2 + 1].U.ki.wScan = value[i];
            inputs[i * 2 + 1].U.ki.dwFlags = KeyEventUnicode | KeyEventKeyUp;
        }

        return SendInput(
            (uint)inputs.Length,
            inputs,
            Marshal.SizeOf<INPUT>()
        );
    }
}
```

Le code C# a été chargé temporairement dans PowerShell avec `Add-Type`. Avant l'appel, trois contrôles ont été effectués :

```powershell
$edgeProcess = Get-Process -Id $edgePid -ErrorAction Stop

if ($edgeProcess.MainWindowTitle -notlike 'Xtension isTrusted Local Test*') {
  throw 'La page locale n’est pas l’onglet Edge actif.'
}

$activated = (New-Object -ComObject WScript.Shell).AppActivate(
  $edgeProcess.MainWindowTitle
)
if (-not $activated) {
  throw 'La fenêtre Edge exacte n’a pas pu être activée.'
}

Start-Sleep -Milliseconds 400

if ([XtensionTrustedInputProbe]::ForegroundProcessId() -ne $edgePid) {
  throw 'La fenêtre vérifiée n’est pas au premier plan : aucune saisie envoyée.'
}

$text = 'NativeEdge42'
$sent = [XtensionTrustedInputProbe]::TypeUnicode($text)
$expected = $text.Length * 2

if ($sent -ne $expected) {
  throw "SendInput n’a envoyé que $sent enregistrements sur $expected."
}
```

Le point déterminant a été l'activation par le titre exact de la fenêtre. Une activation Edge par le seul PID ou par le nom de l'application pouvait sélectionner une autre fenêtre Edge. Le contrôle du PID de la fenêtre réellement au premier plan a empêché toute saisie tant que la cible n'était pas certaine.

## Procédure Chrome

La même page locale a été ouverte dans Chrome. Le champ `contenteditable` a été vidé et focalisé, puis la fenêtre au titre exact `Xtension isTrusted Local Test - Google Chrome` a été vérifiée avant l'appel à `SendInput`.

Après l'injection de `NativeChrome42`, la page a retourné :

```json
{
  "text": "NativeChrome42",
  "eventCount": 56,
  "types": ["keydown", "beforeinput", "input", "keyup"],
  "allTrusted": true,
  "inputTypes": ["insertText"]
}
```

## Résultat brut condensé pour Edge

Après l'injection de `NativeEdge42` :

```json
{
  "text": "NativeEdge42",
  "eventCount": 48,
  "types": ["keydown", "beforeinput", "input", "keyup"],
  "allTrusted": true,
  "inputTypes": ["insertText"]
}
```

Les 12 caractères ont chacun produit quatre événements, soit 48 événements. Aucun événement observé n'avait `isTrusted: false`.

## Limites et enseignements

1. La fenêtre cible doit être au premier plan et le bon contrôle doit posséder le focus. Sans ce contrôle, `SendInput` peut écrire au mauvais endroit.
2. `KEYEVENTF_UNICODE` passe par `VK_PACKET`. Les métadonnées `KeyboardEvent.key` observées sur certains `keyup` n'étaient pas identiques à celles d'un clavier matériel (`Unidentified` dans Chrome et une valeur répétée dans Edge). Cela ne changeait pas `isTrusted`, mais c'est une différence observable dans les détails de l'événement.
3. La mesure concerne Chrome et Edge tels qu'installés le 11 août 2026. Le comportement peut évoluer avec les navigateurs.
4. La mesure porte uniquement sur les propriétés DOM de la page locale. Elle ne valide aucune politique de plateforme et ne constitue pas un test de détection distant.
5. Les modifications de travail actuellement présentes dans `bridge-input/`, le connecteur et l'extension n'ont pas servi à produire cette mesure. Le banc d'essai a utilisé le petit injecteur temporaire reproduit ci-dessus.

## Intégration possible dans l'architecture Xtension

Pour transformer le prototype en fonctionnalité produit, le flux minimal serait :

```text
content script
  ├─ identifie et focalise le champ cible
  ├─ demande l'insertion au background
  ↓
background extension
  ├─ transmet le texte et une requête éphémère au connecteur local
  ↓
connecteur local Windows
  ├─ vérifie que le navigateur et la fenêtre attendus sont au premier plan
  ├─ refuse si le focus n'est pas certain
  ├─ appelle SendInput
  ↓
navigateur
  └─ crée les événements DOM observés avec isTrusted=true
```

Avant une intégration réelle, il faudrait notamment définir :

- comment l'extension prouve au connecteur quelle fenêtre et quel champ sont attendus ;
- comment annuler proprement si l'utilisateur change de fenêtre pendant l'opération ;
- comment traiter les dispositions clavier, caractères accentués, emojis, IME et retours à la ligne ;
- comment éviter qu'une touche Entrée soumette accidentellement un formulaire ;
- comment afficher une confirmation et permettre l'arrêt immédiat ;
- comment tester séparément `input`, `textarea` et les principaux éditeurs `contenteditable`.

Le banc d'essai initial ci-dessus validait la faisabilité de la chaîne Windows `SendInput` → navigateur → événements DOM `isTrusted: true`. La section suivante décrit l'intégration produit réalisée ensuite et sa validation séparée.

## Intégration réalisée dans Xtension 0.6.13, renforcée en 0.6.14

L'intégration produit utilise désormais le flux suivant sous Windows :

```text
content script Xtension
  ├─ vérifie et sélectionne l'éditeur actif
  ├─ pose un marqueur aléatoire éphémère dans le titre de l'onglet
  ├─ transmet le texte, le navigateur et ce marqueur attendu
  ↓
connecteur local Xtension 0.6.14
  ├─ vérifie que XtensionInput.exe est réellement installé
  ├─ sérialise une seule opération à la fois
  ↓
XtensionInput.exe
  ├─ vérifie le processus du navigateur au premier plan
  ├─ exige le marqueur exact dans le titre de la fenêtre native
  ├─ vérifie la fenêtre et le contrôle natif focalisé
  ├─ appelle SendInput avec KEYEVENTF_UNICODE
  └─ refuse l'opération si la cible change
```

Une fois la capacité native annoncée, Xtension ne retombe pas silencieusement sur l'ancienne insertion DOM après un échec : cela évite de recréer des événements non fiables ou de dupliquer un texte partiellement saisi. Les plateformes sans helper Windows conservent le repli de compatibilité existant.

La version 0.6.14 remplace la comparaison directe avec `document.title` : Edge peut afficher dans la barre des tâches un titre de groupe ou d'espace de travail tel que « et 11 pages de plus ». Le marqueur aléatoire permet de reconnaître l'onglet actif dans cette forme de titre sans accepter arbitrairement une autre fenêtre du même navigateur.

### Où vérifier `Event.isTrusted` dans le navigateur

Sur l'onglet X/Twitter à tester :

1. ouvrir les outils de développement avec `F12` ;
2. ouvrir l'onglet **Console** ;
3. exécuter le code ci-dessous avant de cliquer sur l'action Xtension ;
4. regarder la colonne `isTrusted` des événements affichés.

```js
window.__xtensionTrustedProbe?.abort();
window.__xtensionTrustedProbe = new AbortController();

for (const type of ["keydown", "beforeinput", "input", "keyup"]) {
  document.addEventListener(type, (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (!target.isContentEditable && !target.matches("input, textarea")) return;

    console.log("[Xtension isTrusted]", {
      type: event.type,
      isTrusted: event.isTrusted,
      inputType: event.inputType || "",
      data: event.data ?? null,
      key: event.key || ""
    });
  }, { capture: true, signal: window.__xtensionTrustedProbe.signal });
}
```

Pour arrêter l'écoute :

```js
window.__xtensionTrustedProbe.abort();
```

Le résultat attendu pour le texte inséré par le connecteur Windows est `isTrusted: true` sur `keydown`, `beforeinput`, `input` et `keyup`. Le drapeau Win32 `LLKHF_INJECTED` reste une information distincte et n'est pas exposé par cette propriété DOM.
