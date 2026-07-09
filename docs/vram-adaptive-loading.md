# Chargement adaptatif VRAM / RAM du moteur IA local

> Spécification + plan d'implémentation. À exécuter dans une nouvelle session.
> Fichier principal concerné : `scripts/xtension-ai-bridge.js`.
> Cible de validation : RTX 2080 Ti (11 Go VRAM) + 128 Go RAM, mais l'objectif
> est que **n'importe quel GPU** (petit → gros) fonctionne.

---

## 1. Objectif

Charger **le maximum sur la VRAM**, et faire déborder **de façon maîtrisée
par NOUS vers la RAM/CPU** le reste — au lieu de laisser le pilote NVIDIA le
faire en douce.

Pourquoi c'est important : le pilote NVIDIA (Windows, R535+) a le **« CUDA –
Sysmem Fallback »** activé par défaut. Quand une allocation dépasse la VRAM, il
ne plante pas : il **pagine le surplus dans la RAM via le PCIe**, ce qui rend la
génération **5 à 50× plus lente**, silencieusement. Un offload partiel décidé
par llama.cpp (`-ngl N`, couches entières sur CPU) est **beaucoup plus rapide et
prévisible** que ce paging pilote. Le but est donc de **ne jamais atteindre** le
fallback en mesurant la VRAM et en dimensionnant le chargement.

---

## 2. Ordre de priorité du chargement VRAM (le plus prioritaire d'abord)

C'est l'ordre dans lequel on « remplit » la carte. Ce qui ne rentre pas retombe
sur le CPU/RAM.

1. **Buffer de calcul CUDA** — obligatoire dès qu'au moins une couche est sur
   GPU. Non négociable, à réserver en premier (~0,6–1 Go selon le contexte).
2. **Poids des couches du transformer (le modèle lui-même)** — le chemin chaud :
   traversé à chaque token. On en met **le plus possible** (`-ngl N`).
3. **Cache KV des couches offloadées** — lui aussi chemin chaud (lu à chaque
   token), donc il doit rester **collé aux couches sur GPU**. On le rétrécit
   plutôt que de le sortir : d'abord flash-attention, puis quantization KV, et
   `--no-kv-offload` seulement en dernier recours.
4. **Projecteur / encodeur vision (mmproj)** — chemin **froid** : utilisé 1× par
   image, puis oublié. C'est donc **le premier candidat à mettre sur CPU** quand
   la VRAM serre (`--no-mmproj-offload`), avec un impact vitesse quasi nul.

> ⚠️ Nuance vs l'intuition initiale « modèle, puis modules, puis KV » : le
> **cache KV n'est PAS un module secondaire** — il est chemin chaud et doit
> rester avec les couches. Le vrai « module » sacrifiable en premier, c'est la
> **vision (mmproj)**, pas le KV.

Plus, transversal : une **réserve de sécurité « Reserve1 »** de ~0,8–1,0 Go
jamais allouée, pour le bureau Windows/Chrome (accél. GPU) et les pics.

---

## 3. État actuel (à remplacer)

Dans `scripts/xtension-ai-bridge.js` :

- `selectLocalModelTier()` (~l.97) choisit le modèle **uniquement sur la RAM
  système** (`os.totalmem()`). 128 Go → toujours le **12B** (`minRamGb: 14`),
  quelle que soit la carte.
- Lancement (`ensureLlmServer`, args ~l.898-914) :
  - `-ngl 999` (mode GPU) → **toutes** les couches en VRAM, sans vérification.
  - `-c 4096` (contexte — OK, à garder comme plafond raisonnable).
  - `--mmproj <F16>` → projecteur vision **sur GPU**.
  - **Pas** de `-fa`, **pas** de détection VRAM, **pas** d'offload partiel.
- Aucune utilisation de `nvidia-smi` dans le fichier (vérifié).

Budget réel sur 11 Go : ~7 Go (poids 12B Q4) + ~0,5–1 Go (KV) + ~0,5–1 Go
(calcul) + 0,6–1,5 Go (vision quand image) + 0,5–1,5 Go (bureau). → **au bord ou
au-dessus de 11 Go, surtout avec une image** ⇒ fallback sysmem = lenteur.

---

## 4. Drapeaux `llama-server` disponibles (vérifiés sur le build b9882 installé)

| Besoin | Drapeau |
|---|---|
| Flash-attention | `-fa on` (`--flash-attn [on\|off\|auto]`, défaut `auto`) |
| Offload partiel | `-ngl N` (`--n-gpu-layers`, accepte un **nombre exact** de couches) |
| Quantiser le KV | `-ctk q8_0 -ctv q8_0` (`--cache-type-k/-v`) |
| KV en RAM (dernier recours) | `-nkvo` (`--no-kv-offload`) |
| Vision sur CPU | `--no-mmproj-offload` |
| Placement fin (avancé, optionnel) | `-ot` / `--override-tensor` |

`nvidia-smi --query-gpu=memory.total,memory.free --format=csv,noheader,nounits`
renvoie les Mo total/libre (une ligne par GPU).

---

## 5. Plan d'implémentation — par priorité de réalisation

### P0 — Détection VRAM (fondation) **[à faire en premier]**
- `detectGpuVram()` : lance `nvidia-smi --query-gpu=memory.total,memory.free
  --format=csv,noheader,nounits` (timeout court ~2 s, best-effort). Parser
  `{ totalMb, freeMb }` du **premier** GPU. Logguer via `logBridgeEvent`.
- Cas d'échec (pas de `nvidia-smi`, non-NVIDIA, timeout) → renvoyer `null`
  ⇒ **mode conservateur** (voir P1 : ngl calculé sur une VRAM supposée basse, ou
  repli CPU selon décision produit).

### P1 — Budget + offload calculé (cœur)
- Déterminer le **nombre de couches** du modèle. Deux options :
  1. **Robuste** : lire `<arch>.block_count` dans les métadonnées GGUF (header
     du fichier `.gguf`). Écrire un mini-lecteur (magic `GGUF`, version,
     tensor_count, kv_count, puis paires clé/valeur ; chercher la clé finissant
     par `.block_count`).
  2. **Pragmatique (v1)** : table par tier (à confirmer sur les fichiers réels ;
     ex. 12B ≈ 48, E4B ≈ 30-35, 4B ≈ 34) + `+2` pour embeddings/sortie.
- `perLayerBytes ≈ tailleFichierModèle / (blockCount + 2)`.
- `budget = freeMb - RESERVE(≈1024) - computeBuffer(≈768, ↑ si ctx plus grand)`.
- `ngl = clamp(floor(budgetPourPoids / perLayerBytes), 0, blockCount + 1)`.
  - Si `ngl >= blockCount+1` → tout tient → passer `-ngl 999`.
  - Sinon → offload partiel `-ngl <ngl>` (le reste des couches sur CPU/RAM).
- Remplacer le `-ngl gpu ? 999 : 0` en dur par ce calcul (mode GPU seulement ;
  mode CPU reste `-ngl 0` + GPU masqué, inchangé).

### P2 — Rétrécir le KV avant de sacrifier des couches
- Ajouter **`-fa on`** systématiquement en mode GPU (réduit le KV + accélère ;
  aujourd'hui non passé donc `auto` — le forcer garantit le gain).
- Si le KV ne tient toujours pas dans le budget après flash-attn :
  `-ctk q8_0 -ctv q8_0` (≈ ÷2 du KV, perte de qualité négligeable).
- **`-nkvo` uniquement en tout dernier recours** (KV lu à chaque token ⇒ lent) ;
  préférer réduire `ngl`.

### P3 — Vision (mmproj) sur CPU quand ça serre
- Si `freeMb` < seuil (à régler, p.ex. VRAM totale ≤ 12 Go **ou** budget vision
  insuffisant) → ajouter **`--no-mmproj-offload`**. Le LLM reste 100 % GPU
  (rapide), seule l'image est encodée sur CPU (rare, ~1× par génération).
- Sur gros GPU (VRAM large) → laisser le mmproj sur GPU (défaut actuel).

### P4 — Choix du modèle tenant compte de la VRAM **[TRANCHÉ — SANS OBJET]**
Décision produit (2026-07-09) : le **multi-tier a été retiré**. Le projet ne garde
qu'**un seul modèle** (Gemma 4 12B Q4_K_M) pour alléger le payload de l'installeur.
Il n'y a donc plus de choix de modèle à faire : seul le **chargement** s'adapte
(offload partiel calculé, stratégie (a) de fait). `selectLocalModelTier` et le
tableau `localModelTiers` (E4B / 4B) ont été supprimés de
`scripts/xtension-ai-bridge.js`.

### P5 — Observabilité (`/health`, `/status`) + logs
- Exposer dans la réponse `/status` : `vramTotalMb`, `vramFreeMb`, `nglUsed`,
  `layersTotal`, `kvOnGpu`, `kvType`, `mmprojOnGpu`, `flashAttn`, et la
  **marge estimée**. Logguer la décision complète au démarrage
  (`logBridgeEvent("llm_vram_plan", {...})`).
- Objectif : pouvoir diagnostiquer sans deviner.

### P6 — Recalcul au changement de mode / relance
- Quand l'utilisateur (dé)active le GPU (endpoint `/config`) ou au redémarrage,
  **recalculer** le plan et relancer `llama-server` avec les bons args
  (`stopLlmServer` existe déjà).

---

## 6. Contraintes à respecter (ne pas casser)

- **Mode CPU inchangé** : `-ngl 0` + `CUDA_VISIBLE_DEVICES=""` (rien en VRAM).
  Tout le nouveau code est sous `if (gpu)`.
- **Best-effort partout** : si la détection échoue, le bridge doit **toujours
  démarrer** (repli conservateur, jamais de crash). Reprendre le pattern des
  `child.on("error", ...)` existants.
- **Pas de nouveau réglage visible** dans l'UI (la case « GPU » suffit) — tout
  est automatique et transparent, conformément à la ligne directrice du projet.
- Surchargeable par variables d'env pour debug (ex. `XTENSION_LLM_GPU_LAYERS`
  existe déjà et doit **primer** sur le calcul auto).

---

## 7. Validation (par l'utilisateur, sur la 2080 Ti)

1. Démarrer en mode GPU, lire `/status` → vérifier `nglUsed`, `vramFreeMb`,
   `mmprojOnGpu`.
2. `nvidia-smi` pendant une génération **texte** → doit rester sous ~10 Go avec
   marge.
3. Génération **avec image** → ne doit **plus** faire déborder (vérifier que la
   VRAM ne sature pas / que la latence ne s'effondre pas).
4. Comparer la vitesse avant/après (le forçage `-fa on` + non-débordement doit
   accélérer).
5. (Optionnel) Simuler un petit GPU via `CUDA_VISIBLE_DEVICES` / une VRAM réduite
   ou en forçant `XTENSION_LLM_GPU_LAYERS` bas → vérifier que ça reste
   fonctionnel (offload partiel).

---

## 8. Ordre de réalisation résumé

**P0 (détection) → P2 (`-fa on`, gain immédiat) → P1 (offload calculé) → P3
(vision CPU) → P5 (logs/status) → P6 (relance) → P4 (décision modèle, à valider
avec l'utilisateur).**

> P2 peut être livré tout de suite (faible risque, gros gain) même avant P1.
