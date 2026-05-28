# Soumission Confort — Funnel Final V2

## Context

Le funnel actuel [`/soumission-rapide/questionnaire/`](../soumissionconfort/app/soumission-rapide/questionnaire/page.tsx) capture des infos peu actionables (habitationType, ownershipStatus, insulationStatus, address) et ne distingue pas les leads qualifiés ("je veux changer mon isolation") des leads froids ("juste curieux du coût"). Conséquence : Meta optimise sur des Lead events de qualité variable, les setters voient les deux types dans le même stage GHL.

On refait le funnel pour :
1. **Capturer du signal réel** (symptômes vécus, niveau facture hydro = proxy badness isolation).
2. **Différencier qualifié vs curieux** → routing pixel Meta + stage GHL différencié.
3. **Donner une estimation de coût** sur `/merci` pour les deux paths (valeur ajoutée).
4. **Tracking Meta complet** : PageView → ViewContent → Lead (qualifié only), browser + CAPI dedupé.

---

## Décisions verrouillées

| Sujet | Décision |
|---|---|
| **Q1** | Address (déjà configurée — garde Google Places) |
| **Q2** | Symptômes — multi-select, 7 options avec emojis |
| **Q3** | Facture hydro — single-select, 5 brackets bleu→rouge |
| **Q4** | Intent qualifié vs curieux |
| **Pixel "qualifié"** | `PageView` → `ViewContent` → `Lead` browser+CAPI dedupé. **Lead fire APRÈS verif OTP** (si OTP activé), sinon après submit `/api/leads` retourne `ok`. |
| **Pixel "curieux"** | `PageView` → `ViewContent` seulement. AUCUN Lead. AUCUN CompleteRegistration. |
| **GHL qualifié** | Nouveau stage "new lead hot" entre "new lead" et "call back same day" — **création manuelle dans UI GHL** (PAS via API — voir P0-6 ci-bas) |
| **GHL curieux** | Stage existant "new lead" — même pipeline setter |
| **Page finale** | `/merci` pour les deux paths — design/composants/Tailwind classes **EXACTEMENT préservés**. Bloc estimation injecté. Copy gated par intent. |
| **Sympôtmes** | ⚡ Facture d'Hydro qui monte / 🥶 Maison frette / 🥵 Étouffant l'été / 🧊 Glace sur le toit / 💨 Courants d'air / 🌡️ Pièces inégales / 💧 Humidité ou moisissures |
| **Brackets hydro** | 🟦 <150 $ / 🟩 150–250 $ / 🟨 250–350 $ / 🟧 350–500 $ / 🟥 >500 $ |
| **Branche git** | `feat/soumissionconfort-funnel-v2` |
| **Meta Pixel ID + Token** | **Placeholders `XXXXXX`** — Zack n'a pas encore créé le Pixel soumissionconfort dédié. Tout le wiring fait, garde-fou runtime skip CAPI/fbq tant qu'on a `XXXXXX`. |

---

## 🚨 Findings Codex adversarial review — adressés dans le plan

### P0 Blockers (must-fix avant code)

| # | Issue | Fix dans le plan |
|---|---|---|
| **P0-1** | Browser `Lead` pixel fires AVANT verif OTP (`questionnaire/page.tsx:363`) → counts unverified leads | Déplacer le `fbq('track', 'Lead')` browser dans [`/verifier-telephone/page.tsx`](../soumissionconfort/app/soumission-rapide/verifier-telephone/page.tsx) APRÈS retour `ok` de `/api/verify-otp`. Gate par `intent === 'qualified'`. Si `OTP_ENABLED === false`, fire après retour `ok` de `/api/leads`. |
| **P0-2** | `/merci/page.tsx:71` fire `CompleteRegistration` pour tout le monde — interdit par plan | **Retirer complètement** ce track ou le gater explicitement `if (intent === 'qualified' && !leadAlreadyFired)`. Le plan dit "AUCUN CompleteRegistration" — on retire. |
| **P0-3** | `verifier-telephone/page.tsx:82` clear `soumission-rapide-lead` sessionStorage AVANT redirect `/merci` → estimate disparaît en prod OTP | Stocker les inputs estimate (`symptoms`, `hydroBracket`, `intent`) sous une **clé séparée** `soumission-rapide-estimate-inputs` qui survit au cleanup. Cleanup uniquement après `/merci` render (ou jamais, pas critique). |
| **P0-4** | Server CAPI `Lead` envoyé inconditionnellement dans les 2 branches (`api/leads/route.ts:301, 786`) | Gater **les deux branches** (GHL direct + webhook Make legacy) par `intent === 'qualified'`. Pour OTP-deferred : repousser le call CAPI au moment où le verify-otp endpoint POST le lead final. |
| **P0-5** | Conflit ownership opportunity GHL : tags actuels déclenchent workflows GHL qui créent opportunities. Si on POST aussi `/opportunities` direct → duplicates. | **Décision : garder le modèle tag-driven existant.** On AJOUTE un nouveau tag distinct (ex `Lead Iso Hot` vs `Lead Iso Curieux`) qui déclenche les workflows GHL existants — Zack ajuste ses workflows GHL pour router selon tag vers le bon stage. **PAS d'appel direct `/opportunities` depuis le code.** Le `stageId` env var devient un nice-to-have (audit only), pas un input runtime. |
| **P0-6** | Création stage GHL via API : `PUT /opportunities/pipelines/{id}` REMPLACE tout le tableau de stages → peut orphan opportunities. Repo a déjà un warning dans `scripts/setup-ghl-iso-pipeline-stages.ts:4`. | **Création manuelle UI GHL.** Zack crée le stage "new lead hot" dans Settings → Pipelines via UI. Script `list-ghl-pipelines.ts` reste utile en read-only pour récupérer les stageIds existants. Pas de write API. |

### P1 High

| # | Issue | Fix |
|---|---|---|
| **P1-1** | Fallback `NEXT_PUBLIC_META_PIXEL_ID` (de soumissiontoiture) en prod = pollue le wrong pixel | Fallback autorisé **uniquement** si `NODE_ENV === 'development'`. Sinon skip init si placeholder/missing. |
| **P1-2** | Migration Meta env vars partielle = events vers wrong pixel silently | Migrer TOUTES les refs : `app/layout.tsx`, `app/api/leads/route.ts`, `lib/meta-config.ts`, `app/api/test-meta`, `app/api/test-purchase`, docs, tests. Grep `NEXT_PUBLIC_META_PIXEL_ID` + `META_CONVERSION_ACCESS_TOKEN` pour rien manquer. |
| **P1-3** | `META_TEST_EVENT_CODE` pas passé aux vrais CAPI calls dans `/api/leads` | Passer `META_TEST_EVENT_CODE_SOUMISSIONCONFORT` aux 2 branches `initializeMetaConversionAPI(..., testEventCode)`. |
| **P1-4** | ViewContent CAPI dedup sous-spécifié — pas d'endpoint accepte event_id côté browser pour relay CAPI | Créer endpoint `POST /api/meta/view-content` qui accepte `{ eventId, ...userData }` et call CAPI server-side avec le même `event_id` que le `fbq('track', 'ViewContent', {}, {eventID})` browser. |
| **P1-5** | `computeLeadEventId()` deterministic forever — repeat qualified submissions = same event_id | Acceptable pour cas browser+CAPI dedup de la MÊME submission. Pas un problème immédiat — ajouter un commentaire dans le code pour clarifier l'intent. |
| **P1-6** | `sourceUrl` pour `isolation_soumission_rapide` fallback `/` ; value `0` (pas de pricingData) | `sourceUrl = '/soumission-rapide/questionnaire'` ; `value = midpoint(estimate.min, estimate.max)` pour qualified Lead. |
| **P1-7** | Plan référence `lib/ghl-fields.ts` ; vrai fichier est `lib/ghl-fields-iso.ts` | Corriger toutes les références. Ajouter les nouveaux champs (`symptoms`, `hydro_bracket`, `intent`) via le script existant `scripts/setup-ghl-iso-custom-fields.ts` (si pattern existe), pas en hardcodant. |
| **P1-8** | Multi-select `symptoms` serialization vers GHL TEXT field | Sérialiser en **codes stables** séparés par virgule (ex : `hot_summer,cold_winter,ice_roof`). Pas les labels (changent avec la copy). Avoir une map `code → label FR` côté code pour rebuild. Si GHL field "Multi-Options" disponible, l'utiliser avec exact options match. |

### P2 Medium

| # | Issue | Fix |
|---|---|---|
| **P2-1** | Pas de `.env.example` tracké ; vrai doc = `ENV_VARIABLES.md` | Update `ENV_VARIABLES.md` au lieu de `.env.example`. |
| **P2-2** | "Design preserved" en mots mais nouveaux composants risquent drift | NE PAS importer un `Card` générique. **Copier-coller les classes Tailwind exactes** depuis `/merci/page.tsx` existant pour `EstimateCard`. Aucune class new — réutilise celles déjà dans le fichier. |
| **P2-3** | Copy `/merci` actuel promet "demande transmise" + "3 soumissions" → misleading pour curieux | Gater la copy par `intent` : qualifié garde "Demande transmise" + "3 soumissions" ; curieux voit "On t'a envoyé une idée du prix par courriel — un conseiller peut te contacter si tu changes d'idée." Layout/composants identiques. |
| **P2-4** | Address est step 4 actuellement → step 1 dans V2. Affecte progress, ViewContent timing, validAddress async resolve | Add acceptance test : sélection address puis click Next **avant** que `/api/places/details` resolve → bloquer Next jusqu'à `validAddress === true`. Le ViewContent fire au moment où on quitte step 0 (donc après address valide). |
| **P2-5** | Tests focalisés manquants | Section "Tests" enrichie ci-bas avec 7 acceptance tests explicites. |

---

## Architecture & fichiers critiques

### Fichiers à modifier

| Fichier | Changement |
|---|---|
| [`soumissionconfort/app/soumission-rapide/questionnaire/page.tsx`](../soumissionconfort/app/soumission-rapide/questionnaire/page.tsx) | Remplace `STEP_CONFIG` (lignes 81-86) + options (lignes 28-65). Address devient step 0 (déjà). Multi-select symptoms step 1 avec bouton Suivant. Color radio brackets step 2. Intent step 3. **Retire le `fbq('track', 'Lead')` ligne 363** — déplacé vers verifier-telephone. Stocke `estimate-inputs` sous clé séparée. |
| [`soumissionconfort/app/soumission-rapide/merci/page.tsx`](../soumissionconfort/app/soumission-rapide/merci/page.tsx) | **Retire `CompleteRegistration` track (ligne 71).** Affiche `EstimateCard` (lit `estimate-inputs` sessionStorage). Gate copy par `intent`. Préserve TOUS les Tailwind classes existants. |
| [`soumissionconfort/app/soumission-rapide/verifier-telephone/page.tsx`](../soumissionconfort/app/soumission-rapide/verifier-telephone/page.tsx) | Fire browser `Lead` pixel APRÈS retour ok de verify-otp, conditionné sur `intent === 'qualified'`. Ne PAS clear `estimate-inputs` (ligne 82 cleanup uniquement `pending-lead`, pas `estimate-inputs`). |
| [`soumissionconfort/app/api/leads/route.ts`](../soumissionconfort/app/api/leads/route.ts) | Accepte `intent`, `symptoms[]`, `hydroBracket`. Gate CAPI `Lead` event sur `intent === 'qualified'` dans LES DEUX branches (GHL + webhook). Update `sourceUrl` → `/soumission-rapide/questionnaire`. Pour OTP : push CAPI au verify-otp endpoint. Pass `META_TEST_EVENT_CODE_SOUMISSIONCONFORT`. |
| [`soumissionconfort/app/api/verify-otp/route.ts`](../soumissionconfort/app/api/verify-otp/route.ts) | Après verif OK, fire CAPI Lead (si intent qualified) avec même eventId que celui réutilisé browser. |
| [`soumissionconfort/app/layout.tsx`](../soumissionconfort/app/layout.tsx) | Use `NEXT_PUBLIC_META_PIXEL_ID_SOUMISSIONCONFORT`. Skip init si placeholder OU manquant en prod. Dev-only fallback. |
| [`soumissionconfort/lib/meta-config.ts`](../soumissionconfort/lib/meta-config.ts) | Migre les env vars. Garde-fou : retourne null/skip si placeholder. |
| [`soumissionconfort/lib/ghl-fields-iso.ts`](../soumissionconfort/lib/ghl-fields-iso.ts) | Ajoute mappings `symptoms` (codes joined), `hydro_bracket`, `intent`. Via script setup si pattern existe. |
| [`soumissionconfort/lib/ghl-client.ts`](../soumissionconfort/lib/ghl-client.ts) | Ajoute nouveaux tags `Lead Iso Hot` (qualified) / `Lead Iso Curieux` (curious) selon intent. **PAS de call `/opportunities`** — workflows GHL routent via tag. |
| [`soumissionconfort/app/api/test-meta/route.ts`](../soumissionconfort/app/api/test-meta/route.ts) + [`soumissionconfort/app/api/test-purchase/route.ts`](../soumissionconfort/app/api/test-purchase/route.ts) | Migre vers les nouvelles env vars `_SOUMISSIONCONFORT`. |
| `soumissionconfort/ENV_VARIABLES.md` | Documente nouvelles vars + warning placeholders. |

### Nouveaux fichiers

| Fichier | Rôle |
|---|---|
| `soumissionconfort/scripts/list-ghl-pipelines.ts` | Read-only : `GET /opportunities/pipelines?locationId=...` → print pipelines + stageIds. Pas de write. |
| `soumissionconfort/lib/estimate.ts` | `computeEstimate(hydroBracket, symptomsCount) → { min, max, mid, label }`. Pure function. |
| `soumissionconfort/lib/funnel-config.ts` | Constantes : `SYMPTOMS_OPTIONS` (avec `code` + `label` + `emoji`), `HYDRO_BRACKETS` (`code`, `label`, `colorClass`), `INTENT_OPTIONS`. |
| `soumissionconfort/components/funnel/MultiSelectQuestion.tsx` | Multi-select avec bouton "Suivant" — **utilise les Tailwind classes existantes** du questionnaire. |
| `soumissionconfort/components/funnel/ColorRadioQuestion.tsx` | Single-select coloré pour brackets — Tailwind classes existantes. |
| `soumissionconfort/components/funnel/EstimateCard.tsx` | **Copie-colle** la structure d'une `Card` existante du `/merci` actuel + injecte montants. Aucun nouveau style. |
| `soumissionconfort/app/api/meta/view-content/route.ts` | Endpoint POST qui accepte `{ eventId, ...userData }` et call CAPI `ViewContent` server-side. Dedup browser+CAPI. |

### Variables d'environnement (à documenter dans `ENV_VARIABLES.md`)

```
# GHL (read-only par script list-ghl-pipelines.ts pour identifier les IDs)
GHL_PIPELINE_ID_ISO=<id existant à récupérer via script>
GHL_STAGE_ID_ISO_NEW_LEAD=<id existant — audit only, routing via tag>
GHL_STAGE_ID_ISO_NEW_LEAD_HOT=<créé manuellement par Zack dans UI GHL — audit only>
GHL_LOCATION_ID_ISO=7gpshI6Ger307wy0gSRU  # déjà en place

# ⚠️ PLACEHOLDERS — à remplacer AVANT déploiement prod
NEXT_PUBLIC_META_PIXEL_ID_SOUMISSIONCONFORT=XXXXXX
META_CONVERSION_ACCESS_TOKEN_SOUMISSIONCONFORT=XXXXXX
META_TEST_EVENT_CODE_SOUMISSIONCONFORT=  # optionnel pour Test Events
```

---

## 🔍 État pixel actuel — à clarifier AVANT code

**Constat lecture `layout.tsx:166-195` :** Le pixel ne fire **que si** `process.env.NEXT_PUBLIC_META_PIXEL_ID` est définie. Si non définie → 0 event Meta (même pas PageView).

**2 scénarios possibles côté prod actuel :**

| Scénario | Conséquence |
|---|---|
| **A.** Var pas définie dans Vercel pour `soumissionconfort.ai` | Actuellement aucun event Meta. Migration vers nouvelle var = zéro risque. |
| **B.** Var définie avec ID `2528415734282815` (= soumissiontoiture) | Les 2 sites partagent un pixel. Le pixel toiture reçoit du noise iso. À nettoyer dès qu'on a le bon Pixel ID iso. |

**Étape 0.5 du plan (read-only, à faire avant tout code) :**
1. `vercel env ls --environment production` filtré sur `META_PIXEL` → confirme scénario A ou B.
2. Si scénario B : flag Zack pour qu'il sache que son pixel toiture a du traffic mixte historique.

**Pendant la transition (placeholder XXXXXX) :**
- Aucun event Meta n'ira nulle part depuis soumissionconfort (skip via garde-fou runtime).
- Pixel toiture continue à fonctionner indépendamment (vars séparées).
- Zéro impact sur soumissiontoiture.com.

---

## ⚠️ Meta Pixel — gestion des placeholders

1. **Env vars dédiées soumissionconfort** :
   - `NEXT_PUBLIC_META_PIXEL_ID_SOUMISSIONCONFORT` = `XXXXXX`
   - `META_CONVERSION_ACCESS_TOKEN_SOUMISSIONCONFORT` = `XXXXXX`
   - `META_TEST_EVENT_CODE_SOUMISSIONCONFORT` = vide

2. **Câblage** : `layout.tsx`, `lib/meta-config.ts`, `api/leads/route.ts`, `api/verify-otp/route.ts`, `api/meta/view-content/route.ts`, `api/test-meta`, `api/test-purchase`. Grep avant code pour rien manquer.

3. **Garde-fou runtime** :
   - Si pixelId === `XXXXXX` OR undefined → `console.warn('[Meta] Placeholder pixel ID. Set NEXT_PUBLIC_META_PIXEL_ID_SOUMISSIONCONFORT before prod.')` + skip CAPI calls (`return { ok: true, skipped: true }`).
   - Côté client fbq → ne PAS init si placeholder en prod. Dev-only fallback sur ancien pixel pour dev local optionnel.

4. **Pré-prod checklist** :
   - [ ] Pixel Meta créé Business Manager pour soumissionconfort
   - [ ] Access Token CAPI long-lived généré
   - [ ] Env vars updated dans Vercel
   - [ ] Redeploy
   - [ ] Verify Events Manager Test Events reçoit PageView/ViewContent/Lead

---

## 🗂️ Phase 0 — Persistance du plan (PREMIÈRE chose post-approbation)

**Avant tout code**, je copie le plan actuel aux 2 endroits demandés :

1. **Dans le repo** : `soumissionconfort/PLAN_FUNNEL_V2.md`
   - Sera commité avec la branche `feat/soumissionconfort-funnel-v2-visual`
   - Référençable via lien `[file:line](path)` dans les commits/PRs
2. **Dans Obsidian** : `Powerflow/Projects/Soumission-Confort-Funnel-V2.md`
   - Hub central des projets Zack
   - Permet d'ajouter notes/réflexions à côté du plan

**Source du plan original** : `/Users/zackdumont/.claude/plans/on-va-avoir-une-joyful-russell.md` (reste à cet emplacement aussi, comme backup).

Au début de chaque session future, si Zack dit "reprends le plan funnel V2" → je lis depuis `soumissionconfort/PLAN_FUNNEL_V2.md` (source of truth post-merge) ou `Powerflow/Projects/Soumission-Confort-Funnel-V2.md` (hub).

---

## 📦 SPLIT EN 2 PHASES (décisions finales)

| Phase | Branche | Scope | Quand merge prod |
|---|---|---|---|
| **Phase 1** — Visuel MVP | `feat/soumissionconfort-funnel-v2-visual` | UI/UX + copywriting + estimation + 1 petit gate frontend curieux. **Zéro backend wiring.** | Reste preview Vercel — pas merge tant que Phase 2 pas ready |
| **Phase 2** — Backend wiring | `feat/soumissionconfort-pixel-ghl-backend` | Codex P0-1 à P0-6, migration env vars Meta, ViewContent CAPI, GHL via Playwright, retire CompleteRegistration | Attend que Zack ait créé le vrai Pixel Meta soumissionconfort + access token CAPI. Merge ensemble avec Phase 1. |

**Avant les phases** : `vercel env ls --environment production` (read-only) pour clarifier l'état pixel actuel.

---

## 🎨 PHASE 1 — Visuel MVP (branche `feat/soumissionconfort-funnel-v2-visual`)

**Objectif :** déployer le nouveau funnel visuel sur preview Vercel pour validation Zack. **Aucun changement backend wiring** — la prod actuelle continue à fonctionner exactement comme avant si on merge.

### Phase 1.0 — Setup
- `git checkout -b feat/soumissionconfort-funnel-v2-visual`
- Confirmer `git branch --show-current` = bonne branche.

### Phase 1.1 — Constantes + types
1. Crée `soumissionconfort/lib/funnel-config.ts` avec `SYMPTOMS_OPTIONS`, `HYDRO_BRACKETS`, `INTENT_OPTIONS` (voir section Copywriting EXACT pour les labels précis).
2. Crée `soumissionconfort/lib/estimate.ts` avec `computeEstimate(hydroCode, symptomsCount)` (pure function, voir Phase 4 ci-bas).
3. Tailwind safelist : ajouter `bg-blue-50 border-blue-400 hover:bg-blue-100` + variantes vert/jaune/orange/rouge si pas déjà utilisées ailleurs (vérifier purge config).

### Phase 1.2 — Nouveaux composants frontend (design existant respecté)
1. `components/funnel/MultiSelectQuestion.tsx` — multi-select avec bouton "Suivant" sticky. **Copie les classes Tailwind exactes** déjà utilisées dans `questionnaire/page.tsx` pour les boutons d'options.
2. `components/funnel/ColorRadioQuestion.tsx` — single-select avec `colorClass` du bracket. Même pattern de classes que MultiSelect.
3. `components/funnel/EstimateCard.tsx` — **copie-colle la structure d'une Card existante** du `/merci/page.tsx` (chercher avec Read avant). Inject les montants + disclaimer. Aucune nouvelle classe Tailwind.

### Phase 1.3 — Refactor `questionnaire/page.tsx`
1. Remplace `HABITATION_OPTIONS`, `OWNERSHIP_OPTIONS`, `INSULATION_STATUS_OPTIONS`, `PROBLEMS_OPTIONS` (lignes 28-65) par import depuis `lib/funnel-config.ts`.
2. Réécrit `STEP_CONFIG` (lignes 81-86) avec 4 étapes :
   - Step 0 : `address` (garde implémentation Google Places — lignes 192-232)
   - Step 1 : `symptoms` (utilise `<MultiSelectQuestion>`)
   - Step 2 : `hydroBracket` (utilise `<ColorRadioQuestion>`, auto-advance)
   - Step 3 : `intent` (single-select binaire, auto-advance vers lead form)
3. Update typing `selections` state : `Record<string, string | string[]>` ou type discriminé.
4. **Petit gate frontend pour curieux (P1 Phase 1 ajout)** : avant `fbq('track', 'Lead', ...)` ligne 363, wrap dans `if (intent === 'qualified') { ... }`. **Aucun autre changement pixel.**
5. Update copywriting selon section "Copywriting EXACT" (mot pour mot).
6. Avant submit, stocke `soumission-rapide-estimate-inputs` sessionStorage (clé séparée) avec `{ hydroBracket, symptoms, intent }`.

### Phase 1.4 — Refactor `merci/page.tsx`
1. **Préserve TOUT le design existant** — composants, classes Tailwind, structure DOM.
2. **NE PAS retirer `CompleteRegistration`** en Phase 1 (laisser comme avant, fix en Phase 2).
3. Lit `soumission-rapide-estimate-inputs` sessionStorage.
4. Inject `<EstimateCard />` au-dessus de la section "3 entrepreneurs" existante.
5. Gate copy par `intent` selon section Copywriting EXACT :
   - Hero title/subtitle (qualifié vs curieux)
   - Section "3 entrepreneurs" : affichée pour qualifié, remplacée par CTA "Recevoir 3 soumissions" pour curieux
   - Section "Prochaines étapes" : copy gated

### Phase 1.5 — `/api/leads/route.ts` minimal change
1. Accepte les nouveaux champs dans le payload : `intent`, `symptoms: string[]`, `hydroBracket: string`.
2. Pass-through dans `userAnswers` (déjà supporté par schema actuel — vérifier que le type accepte).
3. **AUCUN autre changement backend.** Le CAPI Lead continue à fire pour tout le monde (sera gated en Phase 2). Le GHL tag actuel continue (sera changé en Phase 2). Le pixel ID actuel continue.

### Phase 1.6 — Vérification + preview
1. `cd soumissionconfort && npx tsc --noEmit` → 0 erreur.
2. `npm run dev` → tester localement le funnel complet end-to-end.
3. Vérifie visuellement chaque step + `/merci` qualifié + `/merci` curieux.
4. Vérifie le gate frontend curieux : DevTools Network → submit en curieux → confirme que `fbq('Lead')` browser NE FIRE PAS (CAPI continue, c'est OK pour Phase 1).
5. Vérifie estimate calcul : 5 brackets × 2 niveaux symptoms (≤3 vs ≥4).
6. Vérifie design preservation `/merci` : diff visuel avant/après, layout intact.

### Phase 1.7 — Commit + PR + review parallèle
1. `/commit-push-pr` → push branche + crée PR.
2. Reviews Claude + Codex en parallèle.
3. Fix feedback.
4. **Donne à Zack** : URL preview Vercel (auto-générée par PR) + URL local.
5. **PAS de merge tant que Zack valide pas + Phase 2 ready.**

---

## 🔌 PHASE 2 — Backend wiring intelligent (branche `feat/soumissionconfort-pixel-ghl-backend`)

**Pré-requis :** Zack a créé le Pixel Meta soumissionconfort + généré l'access token CAPI long-lived. Sinon, Phase 2 utilise placeholders `XXXXXX` mais l'activation prod attend.

**Objectif :** brancher tout le wiring backend selon les fixes Codex P0-1 à P0-6 + P1 + P2.

### Phase 2.1 — GHL discovery + setup via Playwright (je fais TOUT moi-même)

**Important :** Zack n'a rien à faire dans l'UI GHL. Je fais tout via Playwright MCP + API GHL.

1. **Discovery (read-only API GHL)** : crée `scripts/list-ghl-pipelines.ts` → `GET /opportunities/pipelines?locationId=$GHL_LOCATION_ID_ISO` → print pipelines + stages (id + name + position). Identifie le pipeline setter + stageIds "new lead" + "call back same day".

2. **Création stage "new lead hot" via Playwright MCP** : je login dans l'UI GHL (sub-account ISO), navigate vers Settings → Pipelines, sélectionne le pipeline setter, drag-drop crée le nouveau stage entre "new lead" et "call back same day". Screenshot pour validation. Récupère le nouveau stageId via re-run du script discovery API.

3. **Création 3 custom fields via API GHL** :
   - `POST /locations/{locationId}/customFields` × 3 :
     - `symptoms` (dataType: TEXT — codes joined par virgule)
     - `hydro_bracket` (dataType: TEXT)
     - `intent` (dataType: TEXT, ou DROPDOWN si supporté avec options `qualified`/`curious`)
   - Capture les fieldIds → ajoute à `lib/ghl-fields-iso.ts`.

4. **Création 2 workflows GHL via Playwright MCP** :
   - Login GHL UI → Automations → Workflows → New Workflow.
   - **Workflow 1** : "Route Lead Iso Hot to stage"
     - Trigger : "Contact Tag Added" + tag `Lead Iso Hot`
     - Action : Update Opportunity → Pipeline `[setter]`, Stage `new lead hot`
   - **Workflow 2** : "Route Lead Iso Curieux to stage"
     - Trigger : "Contact Tag Added" + tag `Lead Iso Curieux`
     - Action : Update Opportunity → Pipeline `[setter]`, Stage `new lead`
   - Active les 2 workflows. Screenshot pour validation.

5. **Update `ENV_VARIABLES.md`** avec tous les nouveaux IDs (audit only).

**Délivrable Phase 2.1** : message à Zack avec screenshots Playwright (nouveau stage visible + 2 workflows actifs) + résumé "GHL configuré, prêt à recevoir les nouveaux tags".

### Phase 2.2 — Migration Meta env vars + garde-fous

1. Ajoute dans Vercel (env vars) :
   - `NEXT_PUBLIC_META_PIXEL_ID_SOUMISSIONCONFORT` = `XXXXXX` (ou vraie valeur si Zack l'a)
   - `META_CONVERSION_ACCESS_TOKEN_SOUMISSIONCONFORT` = `XXXXXX` (ou vraie valeur)
   - `META_TEST_EVENT_CODE_SOUMISSIONCONFORT` = optionnel
2. Crée `lib/meta-config.ts` qui exporte `getMetaConfig()` :
   - Lit les nouvelles env vars
   - Retourne `{ pixelId, accessToken, testEventCode, isPlaceholder: pixelId === 'XXXXXX' }`
   - Si `isPlaceholder` ou undefined en prod → log warn + retourne config "skip mode"
   - En dev : fallback sur ancien `NEXT_PUBLIC_META_PIXEL_ID` autorisé pour tests locaux
3. Update `app/layout.tsx` ligne 166 : utilise `getMetaConfig().pixelId` au lieu de `process.env.NEXT_PUBLIC_META_PIXEL_ID`. Skip init si placeholder.
4. Update `app/api/leads/route.ts`, `app/api/test-meta/route.ts`, `app/api/test-purchase/route.ts` pour utiliser `getMetaConfig()`. **Grep avant** pour ne rien manquer : `grep -r "NEXT_PUBLIC_META_PIXEL_ID\|META_CONVERSION_ACCESS_TOKEN" soumissionconfort/`.
5. Port `lib/meta-conversion-api.ts` depuis `soumissiontoiture/lib/` (copy-paste, adapter import path) vers `soumissionconfort/lib/`.

### Phase 2.3 — ViewContent CAPI dedupé
1. Crée endpoint `app/api/meta/view-content/route.ts` :
   - POST accepte `{ eventId, userData: { fbp?, fbc?, userAgent? } }` + IP du request
   - Call `MetaConversionAPI.sendEvent('ViewContent', { eventId, userData })` avec eventId fourni
2. Dans `questionnaire/page.tsx` :
   - Au mount : genère `viewContentEventId = crypto.randomUUID()` + stocke sessionStorage.
   - Sur transition Step 0 → Step 1 : `fbq('track', 'ViewContent', {...}, { eventID: viewContentEventId })` ET `fetch('/api/meta/view-content', { method: 'POST', body: JSON.stringify({ eventId: viewContentEventId, userData }) })`.
   - Dedup automatique côté Meta (même event_id).

### Phase 2.4 — Lead gating + OTP timing
1. Dans `questionnaire/page.tsx` ligne 363 : **retire complètement** le `fbq('track', 'Lead')` browser. Le pixel Lead browser doit fire ailleurs.
2. Dans `verifier-telephone/page.tsx`, après retour ok de verify-otp :
   - Lit `intent` depuis `soumission-rapide-estimate-inputs` sessionStorage
   - Si `intent === 'qualified'` : `fbq('track', 'Lead', {...}, { eventID: computeLeadEventId(...) })`
   - Si `intent === 'curious'` : ne fire rien
3. Ligne 82 verifier-telephone : modifie le cleanup pour **ne PAS clear** `soumission-rapide-estimate-inputs` (seulement `pending-lead`).
4. Dans `api/verify-otp/route.ts` : après verif OK + write to CRM, call CAPI `Lead` server-side avec même eventId, gated par `intent === 'qualified'`.
5. Dans `api/leads/route.ts` lignes 301 + 786 : wrap CAPI Lead calls dans `if (intent === 'qualified' && !OTP_REQUIRED)`. Si OTP_REQUIRED, le CAPI Lead fire au verify-otp endpoint pas ici.

### Phase 2.5 — Retire CompleteRegistration
1. `merci/page.tsx` ligne 71 : **supprime** le `fbq('track', 'CompleteRegistration')`. Aucun event CompleteRegistration ne fire jamais.

### Phase 2.6 — sourceUrl + value fix
1. Dans `lib/meta-config.ts` ou helper dédié : map `leadType: 'isolation_soumission_rapide'` → `sourceUrl: 'https://soumissionconfort.ai/soumission-rapide/questionnaire'`.
2. Pour Lead event : calcule `value = computeEstimate(hydroBracket, symptoms.length).mid`, currency `CAD`.
3. Pass ces 2 valeurs aux `MetaConversionAPI.sendEvent('Lead', { value, currency, sourceUrl })` calls.

### Phase 2.7 — GHL routing (tag-driven)
1. Modifie `lib/ghl-client.ts` `postLeadToGHL()` :
   - Accepte `intent` en input.
   - Choisit tag : `Lead Iso Hot` si qualified, `Lead Iso Curieux` si curious.
   - **Aucun appel `/opportunities` direct.** Les workflows GHL créés en Phase 2.1 font le routing vers stage selon tag.
2. Met à jour `lib/ghl-fields-iso.ts` avec les 3 nouveaux fieldIds (récupérés en Phase 2.1) :
   - `symptoms_field_id` → mapping vers payload `symptoms` (codes joined `,`)
   - `hydro_bracket_field_id` → mapping vers `hydroBracket`
   - `intent_field_id` → mapping vers `intent`
3. Dans `api/leads/route.ts` : passe `intent`, `symptoms`, `hydroBracket` au payload + call `postLeadToGHL` avec ces données.
4. Étend table Supabase pour stocker `symptoms[]` + `hydro_bracket` + `intent` dans `userAnswers` JSONB (audit trail). Pas de nouvelle colonne nécessaire si schema actuel le supporte.

### Phase 2.8 — Tests focalisés + verification

**TypeScript & build :**
- [ ] `cd soumissionconfort && npx tsc --noEmit` → 0 erreur
- [ ] `npm run build` → succès

**Acceptance tests :**

| # | Test | Attendu |
|---|---|---|
| T1 | Funnel qualifié OTP-enabled : submit puis verify-otp ok | `fbq('Lead')` fire **uniquement** après verify-otp ok. CAPI Lead aussi à ce moment, dedupé via eventId. Tag `Lead Iso Hot` dans GHL → workflow route vers stage "new lead hot". |
| T2 | Funnel curieux OTP-enabled : submit puis verify-otp ok | AUCUN `fbq('Lead')` ne fire jamais. AUCUN CAPI Lead. Tag `Lead Iso Curieux` → workflow route vers stage "new lead". |
| T3 | Funnel OTP-disabled (dev local) : submit qualifié | `fbq('Lead')` fire après ok `/api/leads`. CAPI Lead fire avec même eventId. |
| T4 | ViewContent fire avec dedup | Browser fire ViewContent avec eventID. Server `/api/meta/view-content` fire CAPI avec même event_id. Meta Events Manager montre 1 event dédupliqué. |
| T5 | Estimate survives OTP redirect | Sur `/merci` après OTP flow, `EstimateCard` affiche bonne valeur (lit `estimate-inputs` séparée). |
| T6 | `/merci` ne fire JAMAIS `CompleteRegistration` | Meta Pixel Helper extension confirme aucun CompleteRegistration. |
| T7 | Placeholder pixel ID → skip propre | En env `NEXT_PUBLIC_META_PIXEL_ID_SOUMISSIONCONFORT=XXXXXX` : aucun script Meta loaded côté browser, aucun call CAPI server-side. Console warn affiché. |
| T8 | Vrai pixel ID swap | Remplace placeholder par vrai ID + token → events fire correctement dans le bon pixel. |
| T9 | GHL tag → stage routing | Submit qualifié → contact créé avec tag `Lead Iso Hot` → workflow Phase 2.1 déplace opportunity vers stage "new lead hot" (verify dans UI GHL). |
| T10 | Multi-stage / brackets / symptoms code stability | Custom fields GHL contiennent les codes (`hydro_high,cold_winter` etc), pas les labels. |
| T11 | Address step 0 race condition | User clique Next avant `/api/places/details` resolve → Next bloqué jusqu'à `validAddress === true`. |
| T12 | sourceUrl + value | CAPI Lead event a `event_source_url: 'https://soumissionconfort.ai/soumission-rapide/questionnaire'` + `value: <midpoint estimate>`. |

### Phase 2.9 — Review & merge final (Phase 1 + Phase 2)
1. Commit + push branche Phase 2.
2. `/commit-push-pr` → Review Claude + Codex parallèle.
3. Fix feedback.
4. **Lien preview Vercel Phase 2** à Zack (combine visuel + backend complet).
5. Zack valide manuellement :
   - Funnel qualifié end-to-end (submit → OTP → /merci → vérifie GHL stage + Meta events)
   - Funnel curieux end-to-end (submit → OTP → /merci → vérifie GHL stage + 0 Meta Lead)
6. Si placeholders pas remplacés : merge OK mais Zack remplace les 2 env vars Vercel après merge → redeploy.
7. Merge Phase 2 → cascade merge Phase 1 (déjà rebased sur Phase 2 si nécessaire, OU merge Phase 1 d'abord puis Phase 2).
8. **Décision merge order** à valider avec Zack au moment du merge.

---

## Functions/utilities à RÉUTILISER

- `computeLeadEventId()` — `api/leads/route.ts:316` (dedup browser+CAPI)
- `trackStepEvent()`, `trackQuestionnaireStart()`, `trackQuestionnaireComplete()` — `questionnaire/page.tsx:94-139` (GTM helpers)
- `getSupabaseAdmin()` — déjà câblé
- `postLeadToGHL()` + `isGHLEnabled()` — `lib/ghl-client.ts` (extend, ne pas dupliquer)
- Google Places autocomplete — `questionnaire/page.tsx:192-232` (NE PAS toucher)
- `MetaConversionAPI` class — `soumissiontoiture/lib/meta-conversion-api.ts` — **PORT** vers `soumissionconfort/lib/meta-conversion-api.ts` (sub-brand isolation), OU créer shared package si refactor justifié — éviter premature abstraction, on copy d'abord.
- Pattern `scripts/setup-ghl-iso-*` — réutiliser pour custom fields

---

## Hors scope

- RLS sécurité `pf-call-corpus` — branche séparée.
- Refactor des autres funnels (`thermopompes`, `subventions`).
- A/B test couleurs ou wordings.
- Shared meta-conversion-api package — copy-paste d'abord, abstract plus tard si pattern stable.

---

## ✍️ Copywriting EXACT (mot pour mot, casual québécois, tutoiement)

> ⚠️ Toutes les chaînes ci-bas sont des **propositions concrètes** — Zack peut ajuster ligne par ligne avant code. Aucune interpolation libre lors de l'implémentation : ce qui est ici = ce qui apparaît à l'écran.

---

### Page `/soumission-rapide/questionnaire` — Header global (existant, on garde)

Pas de changement au header/progress bar/badges existants.

---

### Step 0 — Adresse (Q1, on garde implémentation existante)

**Titre :**
> Où se trouve ta propriété?

**Sous-titre :**
> On a besoin de ton adresse pour matcher avec des entrepreneurs dans ta région.

**Placeholder champ :**
> Ex : 123 rue Principale, Alma, QC

**Note petit format :**
> 🔒 Ton adresse reste confidentielle — on la partage uniquement avec les entrepreneurs si tu décides d'avoir des soumissions.

**Bouton (apparaît une fois adresse validée) :**
> Continuer →

---

### Step 1 — Symptômes (Q2, multi-select, bouton "Suivant")

**Titre :**
> Quels symptômes tu vis en ce moment dans ta maison?

**Sous-titre :**
> Sélectionne tout ce qui s'applique — un mauvais isolant cause souvent plusieurs problèmes en même temps.

**Options (code + label exact + emoji) :**

| Code | Affichage |
|---|---|
| `hydro_high` | ⚡ &nbsp; Ma facture d'Hydro monte chaque année |
| `cold_winter` | 🥶 &nbsp; Ma maison est frette en hiver |
| `hot_summer` | 🥵 &nbsp; C'est étouffant l'été, surtout en haut |
| `ice_roof` | 🧊 &nbsp; J'ai de la glace ou des glaçons sur le toit |
| `drafts` | 💨 &nbsp; Je sens des courants d'air (fenêtres, prises) |
| `uneven_temp` | 🌡️ &nbsp; Un étage est chaud, l'autre est froid |
| `humidity` | 💧 &nbsp; J'ai de l'humidité ou des moisissures |

**Note petit format (sous les options) :**
> Tu peux en cocher autant que tu veux.

**Bouton "Suivant" (sticky en bas) :**
- État disabled (0 sélection) : `Sélectionne au moins un symptôme`
- État enabled (≥1 sélection) : `Continuer →`

---

### Step 2 — Facture d'Hydro (Q3, single-select coloré, auto-advance)

**Titre :**
> Combien tu payes en moyenne pour l'Hydro par mois?

**Sous-titre :**
> Prends la moyenne sur l'année (l'hiver coûte plus cher, l'été moins).

**Options (code + label + couleur) :**

| Code | Label affiché | Couleur background |
|---|---|---|
| `under_150` | 💰 &nbsp; Moins de 150 $ / mois | Bleu pâle |
| `150_250` | 💰💰 &nbsp; Entre 150 $ et 250 $ / mois | Vert pâle |
| `250_350` | 💰💰💰 &nbsp; Entre 250 $ et 350 $ / mois | Jaune pâle |
| `350_500` | 💰💰💰💰 &nbsp; Entre 350 $ et 500 $ / mois | Orange |
| `over_500` | 🔥 &nbsp; Plus de 500 $ / mois | Rouge |

**Note petit format (sous les options) :**
> Pas sûr du montant exact? Donne ton meilleur estimé — on s'en sert juste pour personnaliser ton estimation.

---

### Step 3 — Intent (Q4, single-select binaire, auto-advance vers lead form)

**Titre :**
> Une dernière question :

**Sous-titre :**
> Tu cherches à changer ton isolation, ou tu veux juste avoir une idée du coût?

**Options (code + label) :**

| Code | Label affiché |
|---|---|
| `qualified` | 🔨 &nbsp; **Je veux faire faire les travaux** *(je suis prêt à recevoir des soumissions)* |
| `curious` | 💭 &nbsp; **Je suis juste curieux du coût** *(juste pour savoir, pas pressé)* |

**Note petit format (sous les options) :**
> Les deux te donnent une estimation. La différence : si tu veux faire faire les travaux, on te match avec 3 entrepreneurs.

---

### Lead form (apparaît après Step 3)

**Titre :**
- Si `intent === 'qualified'` :
  > Parfait! Comment on te rejoint pour finaliser ta soumission?
- Si `intent === 'curious'` :
  > Cool! On t'envoie ton estimation. À quelle adresse?

**Champs (labels + placeholders) :**

| Champ | Label | Placeholder |
|---|---|---|
| firstName | Prénom | Ex : Marc |
| lastName | Nom de famille | Ex : Tremblay |
| email | Courriel | ton@courriel.com |
| phone | Téléphone | (514) 555-1234 |

**Note RGPD/consentement (sous les champs) :**
> En continuant, tu acceptes qu'on te contacte par téléphone, courriel ou texto.

**Bouton submit :**
- Si `intent === 'qualified'` : `Recevoir mes 3 soumissions →`
- Si `intent === 'curious'` : `Voir mon estimation →`

**Pendant le submit (loading) :**
> ⏳ On prépare ton dossier...

---

### Page `/soumission-rapide/verifier-telephone` (OTP — si OTP_ENABLED=true)

**Titre :**
> On t'a envoyé un code par texto

**Sous-titre :**
> Vérifie ton téléphone et entre le code à 6 chiffres pour confirmer ton numéro.

**Placeholder champ OTP :**
> 123456

**Bouton :**
- État normal : `Vérifier →`
- Loading : `⏳ Vérification...`

**Lien renvoi code :**
> Renvoyer le code

**Erreur code invalide :**
> Code incorrect. Essaye encore.

---

### Page `/soumission-rapide/merci` (estimation + confirmation)

**🚨 Design preserved — TOUTES les classes Tailwind/composants existants sont conservés. Seules les chaînes ci-bas changent + un bloc EstimateCard ajouté.**

#### Section 1 — Hero / Confirmation (gate par intent)

**Si `intent === 'qualified'` :**

Titre (h1) :
> 🎉 C'est confirmé! Ta demande est partie.

Sous-titre :
> On t'a matché avec 3 entrepreneurs spécialistes en isolation dans ta région. Ils vont te contacter dans les 24-48 prochaines heures pour te donner leur soumission.

**Si `intent === 'curious'` :**

Titre (h1) :
> 📊 Voici ton estimation personnalisée

Sous-titre :
> Basée sur tes réponses, voici un range réaliste de ce que pourrait te coûter une amélioration d'isolation. Un conseiller peut te rejoindre si tu veux pousser plus loin — sinon, prends le temps qu'il te faut.

---

#### Section 2 — `<EstimateCard />` (NOUVEAU bloc — design calqué sur Card existante du fichier)

**Titre du bloc :**
> 💵 Ton estimation indicative

**Range principal (gros chiffre) :**
> Entre **{min} $** et **{max} $**

*(Format CAD avec séparateur d'espace, ex : `5 500 $`)*

**Sous-texte :**
> Pour optimiser l'isolation de ta maison.

**Disclaimer (italique, petit) :**
> Cette estimation est basée sur la facture d'Hydro et les symptômes que tu nous as partagés. Le prix final dépend de la superficie réelle, du type de travaux (entretoit, murs, sous-sol) et de l'état actuel. Les entrepreneurs te donneront un devis précis après visite.

---

#### Section 3 — Section "3 entrepreneurs" (EXISTANTE — on garde mais on gate)

**Si `intent === 'qualified'` :**

Titre (h2 existant) :
> Tes 3 entrepreneurs matchés

*(Garde la mise en page existante avec les 3 cartes d'entrepreneurs.)*

**Si `intent === 'curious'` :**

On **cache** la section "3 entrepreneurs" (display none).

À la place, on affiche :

Titre (h2) :
> Tu changes d'idée?

Texte :
> Si tu veux recevoir 3 soumissions gratuites d'entrepreneurs spécialistes dans ta région, clique ici et on te match en moins de 24h.

CTA bouton :
> Recevoir 3 soumissions →

*(Le CTA renvoie à `/soumission-rapide/questionnaire?intent=qualified` pour pre-skip à l'intent step.)*

---

#### Section 4 — Footer / Prochaines étapes (gate par intent)

**Si `intent === 'qualified'` :**

> **Prochaines étapes :**
> 1. ⏰ Un entrepreneur va te contacter sous 24-48h
> 2. 🏠 Visite à domicile gratuite (sans engagement)
> 3. 📝 Soumission écrite avec prix et délais
> 4. ✅ Tu choisis l'offre qui te convient

**Si `intent === 'curious'` :**

> **Pour aller plus loin :**
> - 📧 Tu vas recevoir un courriel avec ton estimation et des conseils d'isolation
> - 🤔 Pas d'engagement, prends le temps que tu veux
> - 📞 Un conseiller peut te rappeler si tu veux poser des questions

---

#### Section 5 — CTA secondaires (existants — on garde)

Pas de changement aux liens de navigation footer/header existants.

---

### Messages d'erreur génériques

| Contexte | Message |
|---|---|
| Network error submit | Oups, on a eu un problème de connexion. Essaye encore? |
| Email invalide | Vérifie ton courriel — on dirait qu'il manque un caractère. |
| Téléphone invalide | Le numéro de téléphone semble pas valide. Vérifie le format. |
| Champ requis vide | Ce champ est requis pour continuer. |
| Pixel placeholder warning (console) | `[Meta] Placeholder pixel ID. Set NEXT_PUBLIC_META_PIXEL_ID_SOUMISSIONCONFORT before prod.` |

---

### Tags GHL exact (pas du copywriting client-facing mais opérationnel)

| Intent | Tag GHL |
|---|---|
| `qualified` | `Lead Iso Hot` |
| `curious` | `Lead Iso Curieux` |

*(Zack doit setup les workflows GHL pour router ces tags vers les bons stages.)*

---

### Custom fields GHL (codes stables passés en text)

| Field | Valeur exemple |
|---|---|
| `symptoms` | `hydro_high,cold_winter,ice_roof` (codes joined virgule) |
| `hydro_bracket` | `over_500` |
| `intent` | `qualified` |

---

## Validation copywriting avec Zack

Avant le code, Zack peut ajuster :
- N'importe quel label, titre, sous-titre, CTA → édit direct dans cette section du plan.
- Le ton (plus formel? plus relax? plus court?).
- Les emojis (garder, retirer, remplacer).
- Le format des montants (`5 500 $` vs `5,500$` vs `5500 $`).

Tout ce qui est listé ici = source of truth lors de l'implémentation. Aucune liberté créative sur le copy hors de ce qui est écrit.

---

## Open questions (résolues — pour audit)

1. ~~**OTP_ENABLED** : true ou false?~~ ✅ **OTP_ENABLED = true en prod** (confirmé Zack). Lead pixel fire après verify-otp.
2. ~~**GHL workflows** : qui setup?~~ ✅ **Moi via Playwright MCP** (confirmé Zack). Zack ne touche pas l'UI GHL.
3. ~~**Pixel actuel prod**~~ ⚠️ À CONFIRMER avant code : `vercel env ls` pour voir si `NEXT_PUBLIC_META_PIXEL_ID` est défini pour soumissionconfort (scénario A ou B — voir section "État pixel actuel").
4. **MetaConversionAPI** : on copy depuis `soumissiontoiture/lib/meta-conversion-api.ts` vers `soumissionconfort/lib/`. Pas d'abstraction shared pour l'instant (premature). Si pattern stable post-merge, on refactore.
