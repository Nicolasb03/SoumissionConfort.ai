# Funnel V2 — `/analysis` (Soumission Confort)

> **Status** : reviewé par Codex (P0 blockers adressés). En attente d'approbation Zack avant code.

## Context

Le funnel **`/soumission-rapide`** (3 soumissions direct) n'est pas actif — aucun lead n'y rentre. Le funnel actif est **`/analysis`** (estimation gratuite, lancé depuis le CTA du homepage "Obtenir mon estimation gratuite").

Un premier essai de refonte V2 a été fait sur la mauvaise branche (`feat/soumissionconfort-funnel-v2-visual`) ciblant `/soumission-rapide`. Le code livré était "gang de la marde" selon Zack. On refait propre, sur `/analysis`, en repartant de `main`.

L'objectif (identique au plan V2 original) :
1. **Capturer du signal réel** (symptômes vécus + facture Hydro = proxy isolation).
2. **Différencier qualifié vs curieux** → routing pixel Meta + tag GHL différencié.
3. **Donner une estimation de coût** à la fin (pricing 3-tier existant conservé visuellement).
4. **Tracking Meta complet** : PageView → ViewContent → Lead (qualifié only), browser + CAPI dedupé.

Référence : `PLAN_FUNNEL_V2.md` (701 lignes, sur la branche v2-visual) reste valide sur la philosophie produit. On l'adapte à l'architecture de `/analysis` (state machine single-page) au lieu de `/soumission-rapide` (pages séparées).

## Décisions verrouillées (issues du brief Zack)

| Sujet | Décision |
|---|---|
| Funnel cible | `/analysis` (estimation gratuite, funnel actif) |
| `/soumission-rapide` | Pas touché. La branche `feat/soumissionconfort-funnel-v2-visual` reste sur le remote, non mergée, ignorée. |
| Branche neuve | `feat/analysis-funnel-v2` from `main` |
| Adresse | Collectée sur le homepage, passée en URL param, déclenche `/api/roof-analysis`. **Pas re-demandée dans le wizard.** |
| Questionnaire | **3 questions visibles** : Q1 symptômes / Q2 hydro / Q3 intent. Numérotation "Question 1/3", "2/3", "3/3". |
| Lead form | **Full-page** sur `/analysis` (state `lead-capture`). Remplace le popup `LeadCapturePopup` actuel **uniquement sur `/analysis`** — le popup reste utilisé par `/thermopompes` (cf P1-3 Codex). |
| Estimation finale | **Pricing 3-tier visuel inchangé** (`InsulationResults` + sa route `/pricing?leadId=…&d=…`). Calcul reste piloté par `calculateInsulationPricing`. Voir P0-3 pour la dégradation acceptée Phase 1. |
| Phases | **2 phases séparées** mergées ensemble à la fin. Phase 1 = visuel. Phase 2 = backend (Meta pixel + GHL tags). |
| Meta Pixel ID + Token | Placeholders `XXXXXX` jusqu'à création par Zack. |

## P0 blockers adressés (review Codex)

### P0-1 — Lead capture state machine cassé aujourd'hui

**Findings Codex** : `app/analysis/page.tsx:317-318` ne render `LeadCaptureForm` que si `leadData` existe déjà ; le `LeadCaptureForm` actuel ne calcule pas `pricingData` et redirige vers `/success` au lieu d'appeler `onComplete` ; `/api/leads:89-95` exige `pricingData` pour les isolation leads.

**Conséquence** : `lead-capture` est aujourd'hui un dead path. Le wizard popup actuel gère tout (calcule pricing + POST + route vers `/pricing`). Si on bascule à un full-page lead form sans toucher le reste, on casse le funnel.

**Fix Phase 1** :
1. Le wizard V2 (3 Qs) appelle `onComplete(answers)` avec **seulement les answers** — pas de pricing, pas de lead data.
2. Le state machine `/analysis` :
   - state `questionnaire` → render wizard V2
   - state `lead-capture` → render **nouveau** `LeadCaptureForm` full-page (refonte complète) qui :
     - Affiche le form contact (prénom/nom/email/tél)
     - Sur submit : calcule `pricingData` via `calculateInsulationPricing` (avec mapping V2 → V1 inputs, cf P0-3) + POST `/api/leads` (payload complet incluant `pricingData`) + handle OTP path
   - state `pricing` → `InsulationResults` inchangé
3. Render condition de `lead-capture` change : `roofData && userAnswers` (pas `leadData`).
4. Le nouveau `LeadCaptureForm` retourne via `onComplete(pricingData, leadData, leadId)` pour avancer le state machine vers `pricing` (chemin non-OTP).

### P0-2 — OTP return path doit utiliser le pattern existant `/pricing?leadId=…&d=…`

**Findings Codex** : Mon plan disait "OTP → retour `/analysis` step pricing". Mais `/verifier-telephone:17-32, :183-184` redirige vers `otp-verify.redirectTo` (par défaut `/success`). Le flow actuel marche parce que [`/analysis/page.tsx:182-187`](soumissionconfort/app/analysis/page.tsx#L182-L187) override `redirectTo` à `/pricing?leadId=…&d=…` avec les données encodées en base64.

**Fix Phase 1** : Réutiliser EXACTEMENT le pattern existant `/pricing?leadId=${leadId}&d=${urlData}`. Le nouveau `LeadCaptureForm` :
- En path OTP : stash `pending-lead` + override `otp-verify.redirectTo` vers `/pricing?leadId=…&d=…` + `router.push('/verifier-telephone')`.
- En path non-OTP : `setCurrentStep('pricing')` avec `pricingData` via `onComplete`.

**Note** : `urlData` actuel encode `roofArea`, `pitch`, `heatingSystem`, `currentInsulation`, `atticAccess`, `identifiedProblems`. On garde ces clés en V1 → V2 mapping (cf P0-3) pour que `/pricing` continue de fonctionner sans modification.

### P0-3 — Pricing 3-tier dégrade si on supprime les V1 answers

**Findings Codex** : [`lib/insulation-calculator.ts:75-84, :145-153, :164-177, :231-261`](soumissionconfort/lib/insulation-calculator.ts) utilise `currentInsulation`, `atticAccess`, `heatingSystem`, `identifiedProblems` pour personnaliser cost/savings. Si on les retire, le calcul retombe sur fallback (Math.max + multiplicateurs hardcodés). Le pricing 3-tier devient générique.

**Décision Phase 1 — mapping V2 → V1 avec defaults conservateurs** :

```ts
// Dans le nouveau LeadCaptureForm, avant calcul pricing :
const v1AnswersForPricing = {
  // V1 defaults conservateurs — pas idéal mais marche sans casser
  heatingSystem: 'electricite',      // majorité Quebec
  currentInsulation: 'partielle',    // assomption moyenne
  atticAccess: 'facile',             // assomption moyenne
  // V2 → V1 partial mapping
  identifiedProblems: mapV2SymptomsToV1(v2Answers.symptoms),
}

function mapV2SymptomsToV1(v2Symptoms: string[]) {
  const map: Record<string, string> = {
    humidity_mold: 'moisissure',
    drafts: 'courants-air',
    hydro_up: 'factures-elevees',
    uneven_temp: 'temperature-inegale',
    ice_roof: 'glace',
    cold_winter: 'temperature-inegale',  // mapping approximatif
    hot_summer: 'temperature-inegale',   // mapping approximatif
  }
  const v1 = v2Symptoms.map(s => map[s]).filter(Boolean)
  return v1.length ? v1 : ['aucun']
}
```

**Limitation acceptée Phase 1** : pricing devient moins précis sur les axes `heatingSystem` / `currentInsulation` / `atticAccess`. Documenter dans le PR description. **Phase 3 (post-merge V2) potentielle** : étendre `calculateInsulationPricing` pour accepter `symptoms` + `hydroBracket` comme inputs réels et raffiner le calcul. Pas dans le scope V2.

### P0-4 — Payload `/api/leads` + GHL custom fields + Make webhook

**Findings Codex** : 
- [`app/api/leads/route.ts:204-230`](soumissionconfort/app/api/leads/route.ts#L204-L230) GHL custom fields use `currentInsulation`, `atticAccess`, etc.
- [`:476-492`](soumissionconfort/app/api/leads/route.ts#L476-L492) legacy webhook project details use same keys.
- [`:650-656`](soumissionconfort/app/api/leads/route.ts#L650-L656) Make columns use old labels.
- [`WEBHOOK_PAYLOAD_STRUCTURE.md:81-100`](soumissionconfort/WEBHOOK_PAYLOAD_STRUCTURE.md#L81-L100) contract documents old fields.

**Fix Phase 1 — backward-compatible payload** :

Le nouveau `LeadCaptureForm` construit un payload qui inclut **les anciens champs avec defaults conservateurs** ET **les nouveaux champs V2 en passthrough** :

```ts
const leadPayload = {
  firstName, lastName, email, phone, leadId,
  roofData,
  userAnswers: {
    // V1 fields (defaults pour ne pas casser GHL/Make)
    heatingSystem: 'electricite',
    currentInsulation: 'partielle',
    atticAccess: 'facile',
    identifiedProblems: mapV2SymptomsToV1(v2.symptoms),
    // V2 fields (nouveau, passthrough Phase 1)
    symptoms: v2.symptoms,           // string[]
    hydroBracket: v2.hydroBracket,   // 'lt_125' | '125_200' | '200_300' | 'gt_300'
    intent: v2.intent,               // 'qualified' | 'curious'
  },
  pricingData,
  utmParams,
  eventId,
}
```

**Phase 1 = aucune modif `/api/leads`, `lib/ghl-fields-iso.ts`, `lib/ghl-client.ts`, Make webhook column mapping**. Les nouveaux champs sont dans le payload mais ignorés silencieusement par les consumers existants. Make reçoit les colonnes attendues (les V1 defaults). GHL custom fields V1 sont remplis avec les defaults.

**Phase 2** : on câble explicitement `symptoms`/`hydroBracket`/`intent` dans GHL (nouveaux fields ou reuse `problemes_identifies` TEXT), Make (nouvelles colonnes), webhook contract.

## P1 — Items à fixer dans le plan

### P1-1 — Phase 1 contradiction "aucun backend"

**Fix** : Phase 1 = aucune modif `app/api/leads/route.ts`, `lib/ghl-fields-iso.ts`, `lib/ghl-client.ts`, `lib/meta-config.ts`. Seuls fichiers backend touchés Phase 1 : **aucun**. Les nouveaux champs V2 voyagent dans le payload mais sont passthrough (pas câblés). Le wizard + lead form + state machine `/analysis` = scope Phase 1 only.

### P1-2 — Nouveaux GHL fields n'existent pas

Phase 2 only. Plusieurs options à trancher avec Zack avant Phase 2 :
- (a) Créer 3 nouveaux fields GHL (`symptoms`, `hydro_bracket`, `intent`) via le script de generation `setup-ghl-iso-custom-fields.ts` si pattern existe.
- (b) Reuse `problemes_identifies` (TEXT) pour `symptoms` CSV, créer 2 fields pour `hydro_bracket` + `intent`.
- (c) Créer 1 super-field `funnel_v2_metadata` JSON qui contient tout.

Recommandation Phase 2 : option (a) — fields dédiés = visibilité claire dans GHL UI pour les setters.

### P1-3 — Ne PAS supprimer `LeadCapturePopup` globalement

Utilisé par [`app/thermopompes/page.tsx:12, :1118-1123`](soumissionconfort/app/thermopompes/page.tsx). **On modifie uniquement `app/analysis/page.tsx`** pour ne plus le rendre. Le composant reste dans `components/`.

### P1-4 — Meta Lead pixel fire trop tôt (Phase 2)

**Findings Codex** : Browser Lead fire dans le wizard ([`user-questionnaire-wizard.tsx:199-211`](soumissionconfort/components/user-questionnaire-wizard.tsx#L199-L211)) AVANT l'OTP. Server CAPI fire dans les 2 branches ([`api/leads/route.ts:269-314, :747-819`](soumissionconfort/app/api/leads/route.ts)).

**Fix Phase 2** :
- Retirer le `window.fbq('track', 'Lead', ...)` du wizard.
- Browser Lead fire dans `/verifier-telephone` APRÈS retour OK de `/api/verify-otp`, gated par `intent === 'qualified'`.
- Si OTP off : fire dans le `LeadCaptureForm` APRÈS retour OK de `/api/leads`, gated par `intent === 'qualified'`.
- Server CAPI : gate les 2 branches `/api/leads` par `intent === 'qualified'`.
- Retirer le `CompleteRegistration` event (grep le repo, probablement sur `/success` ou similaire).

### P1-5 — Auto-advance race condition

[`user-questionnaire-wizard.tsx:102-109`](soumissionconfort/components/user-questionnaire-wizard.tsx#L102-L109) utilise `setTimeout(setCurrentStep, 250)` sans cleanup. Si le user double-click ou unmount avant 250ms → bug.

**Fix Phase 1** : ajouter click guard (`isAdvancing` state) + `useEffect` cleanup du timeout. Pattern :
```ts
const [isAdvancing, setIsAdvancing] = useState(false)
const advanceTimeoutRef = useRef<NodeJS.Timeout | null>(null)
useEffect(() => () => { if (advanceTimeoutRef.current) clearTimeout(advanceTimeoutRef.current) }, [])
const selectAndAdvance = (field, value) => {
  if (isAdvancing) return
  setIsAdvancing(true)
  setAnswers(prev => ({ ...prev, [field]: value }))
  advanceTimeoutRef.current = setTimeout(() => {
    setCurrentStep(s => s + 1)
    setIsAdvancing(false)
  }, 250)
}
```

### P1-6 — `/analysis` sans address ne redirige pas aujourd'hui

[`app/analysis/page.tsx:52-55`](soumissionconfort/app/analysis/page.tsx#L52-L55) : si pas d'adresse, le effect return early et `currentStep` reste à `"loading"`. Le spinner tourne indéfiniment.

**Fix Phase 1** : ajouter au début du `useEffect` :
```ts
if (typeof window === 'undefined') return
if (!address) {
  router.push('/')
  return
}
```

### P1-7 — Analytics events stales

Renommer dans Phase 1 :
- `'Lead Capture Popup Opened'` → `'Lead Form Shown'` (vu que c'est plus un popup)
- `'Questionnaire Step Completed'` continue avec les nouvelles step keys (`'symptoms'`, `'hydroBracket'`, `'intent'`)
- Ajouter `'Lead Form Submitted'` quand le user soumet le full-page form

## P2 — Nice to have

### P2-1 — Bouton "Précédent" Q1

Reste disabled sur Q1 (comportement actuel `user-questionnaire-wizard.tsx:507-510`). Si Zack veut un retour homepage explicite : ajout d'un Link "← Retour à l'accueil" séparé.

### P2-2 — Photo background Q1 — **À CLARIFIER avec Zack**

Codex confirme : le wizard actuel n'a pas de photo background. Les screenshots `q1-reframed.png` et `q1-after-refresh.png` montrent un fond de grenier/isolation. Cet asset n'existe pas dans `public/images/` aujourd'hui.

**Question Zack** : tu as une image en tête à ajouter ? Si oui, source/asset à fournir. Sinon, on garde le fond crème `#fffff6` actuel.

### P2-3 — A11y / focus management lead form

Popup actuel a Dialog focus management automatique ([`lead-capture-popup.tsx:68-69`](soumissionconfort/components/lead-capture-popup.tsx#L68-L69)). Le nouveau full-page form n'en aura pas. Ajout Phase 1 : `useEffect` focus sur premier input au mount du state `lead-capture`.

### P2-4 — sessionStorage keys collision multi-funnels

`/analysis`, `/thermopompes`, `/subventions`, `/soumission-rapide` partagent `pending-lead` / `otp-verify`. Si user navigue entre funnels → état leaked. **Hors scope V2** (existant pre-V2), mais à flagger pour cleanup futur.

### P2-5 — Single PR avec feature flag vs 2 PRs

Codex suggère feature flag. Zack a opté pour 2 PRs mergées ensemble. **Garder 2 PRs** (Phase 1 visuel + Phase 2 backend). Si pendant Phase 1 on découvre que les changements backend Phase 2 sont coupled trop fort, on revisitera.

## Architecture cible — `/analysis` après V2

```
Homepage
   ↓ CTA "Obtenir mon estimation gratuite" (URL: /analysis?address=...)
/analysis state "loading"
   ↓ /api/roof-analysis (inchangé) → set roofData + redirect missing → /
/analysis state "questionnaire" — wizard V2 NOUVEAU
   ├─ Q1/3 Symptômes (multi-select, 7 options emoji) — bouton Suivant
   ├─ Q2/3 Facture Hydro (4 brackets coloré seuils <125/125-200/200-300/>300) — auto-advance
   └─ Q3/3 Intent (qualifié / curieux) — auto-advance
   ↓ onComplete(v2Answers) — answers only, pas de lead/pricing
/analysis state "lead-capture" — full-page form NOUVEAU
   ↓ submit prénom/nom/email/tél
   ↓ calcule pricingData via calculateInsulationPricing(mapV2ToV1Inputs(...))
   ↓ POST /api/leads (payload backward-compatible : V1 defaults + V2 passthrough)
   ↓ if OTP_ENABLED:
        - stash pending-lead + override otp-verify.redirectTo = /pricing?leadId=…&d=…
        - router.push('/verifier-telephone')
      else:
        - setPricingData(pricingData) + setCurrentStep('pricing')
/analysis state "pricing" — InsulationResults INCHANGÉ
   └─ Pricing 3-tier (économique/standard/premium)
```

## Phase 0 — Setup branche + persistance plan

1. Vérifier qu'on est sur `main` et up-to-date : `git fetch && git checkout main && git pull`.
2. Créer la branche : `git checkout -b feat/analysis-funnel-v2`.
3. **Copier ce plan dans le repo** :
   - Source : `/Users/zackdumont/.claude/plans/bon-dans-le-repo-streamed-corbato.md`
   - Destination : `soumissionconfort/PLAN_FUNNEL_V2_ANALYSIS.md`
   - Commit dédié : `chore: add V2 funnel /analysis plan as repo reference`
4. Confirmer `git branch --show-current` = `feat/analysis-funnel-v2`.

Le plan commité sert de référence durable : dans la prochaine session, on peut le relire depuis le repo avec `cat soumissionconfort/PLAN_FUNNEL_V2_ANALYSIS.md` ou via Github.

## Phase 1 — Visuel MVP (branche `feat/analysis-funnel-v2`)

**Scope** : refonte wizard + lead form + state machine `/analysis`. **Zéro modif backend** (`/api/leads`, GHL libs, Meta libs intactes). Payload backward-compatible.

### Fichiers à modifier

| Fichier | Changement |
|---|---|
| [components/user-questionnaire-wizard.tsx](soumissionconfort/components/user-questionnaire-wizard.tsx) | Remplacer les 4 étapes actuelles (heating/insulation/attic/problems) par 3 nouvelles (symptoms/hydroBracket/intent). **Retirer entièrement** la logique de lead capture (popup, `handleLeadSubmit`, calcul pricing). Le wizard appelle `onComplete(v2Answers)` avec answers seulement. Ajout click-guard + cleanup timeout (P1-5). Renommer step tracking analytics (P1-7). |
| [components/lead-capture-form.tsx](soumissionconfort/components/lead-capture-form.tsx) | **Refonte complète**. Nouveau contrat : `props = { roofData, v2Answers, onComplete: (pricingData, leadData, leadId) => void }`. Form full-page (matche `lead-form-qualified.png`). Submit handler : `mapV2ToV1Inputs` → `calculateInsulationPricing` → POST `/api/leads` (payload backward-compatible) → OTP path (pricing URL pattern) OU `onComplete(...)`. Focus management on mount (P2-3). |
| [app/analysis/page.tsx](soumissionconfort/app/analysis/page.tsx) | State machine update : `questionnaire` → `lead-capture` → `pricing`. Render condition `lead-capture` change : `roofData && userAnswers` (pas `leadData`). `handleQuestionnaireComplete(v2Answers)` set `userAnswers = v2Answers` + advance state. `handleLeadCaptureComplete(pricingData, leadData, leadId)` set state + advance pricing. Redirect `/` si `!address` (P1-6). |

### Fichiers à créer

| Fichier | Rôle |
|---|---|
| [lib/funnel-config.ts](soumissionconfort/lib/funnel-config.ts) | Constantes V2 : `SYMPTOMS_OPTIONS`, `HYDRO_BRACKETS`, `INTENT_OPTIONS` + helper `mapV2SymptomsToV1`. |

### Constantes (`lib/funnel-config.ts`)

```ts
export const SYMPTOMS_OPTIONS = [
  { code: 'hydro_up',      label: "Ma facture d'Hydro monte chaque année", emoji: '⚡' },
  { code: 'cold_winter',   label: "Ma maison est froide en hiver",          emoji: '🥶' },
  { code: 'hot_summer',    label: "C'est étouffant l'été, surtout en haut", emoji: '🥵' },
  { code: 'ice_roof',      label: "J'ai de la glace ou des glaçons sur le toit", emoji: '🧊' },
  { code: 'drafts',        label: "Je sens des courants d'air",              emoji: '💨' },
  { code: 'uneven_temp',   label: "Un étage est chaud, l'autre est froid",   emoji: '🌡️' },
  { code: 'humidity_mold', label: "J'ai de l'humidité ou de la moisissure",  emoji: '💧' },
] as const

export const HYDRO_BRACKETS = [
  { code: 'lt_125',  label: 'Moins de 125 $ / mois',       emoji: '💰',     colorClass: 'border-green-500 bg-green-50' },
  { code: '125_200', label: 'Entre 125 $ et 200 $ / mois', emoji: '💰💰',   colorClass: 'border-yellow-500 bg-yellow-50' },
  { code: '200_300', label: 'Entre 200 $ et 300 $ / mois', emoji: '💰💰💰', colorClass: 'border-orange-500 bg-orange-50' },
  { code: 'gt_300',  label: 'Plus de 300 $ / mois',         emoji: '🔥',     colorClass: 'border-red-500 bg-red-50' },
] as const

export const INTENT_OPTIONS = [
  { code: 'qualified', label: 'Je veux faire les travaux',   sub: 'Je suis prêt à recevoir un inspecteur qualifié', emoji: '🔨' },
  { code: 'curious',   label: 'Je suis juste curieux du coût', sub: 'Juste pour savoir, pas pressé',                emoji: '💭' },
] as const

export function mapV2SymptomsToV1(v2Symptoms: string[]): string[] {
  const map: Record<string, string> = {
    humidity_mold: 'moisissure',
    drafts: 'courants-air',
    hydro_up: 'factures-elevees',
    uneven_temp: 'temperature-inegale',
    ice_roof: 'glace',
    cold_winter: 'temperature-inegale',
    hot_summer: 'temperature-inegale',
  }
  const v1 = v2Symptoms.map(s => map[s]).filter(Boolean)
  return v1.length ? Array.from(new Set(v1)) : ['aucun']
}
```

### Visuel de référence (screenshots May 28)

| Question | Screenshot | Détail clé |
|---|---|---|
| Q1 (symptômes) | `q2-symptoms.png` | Card blanche, options pleine largeur avec emoji à gauche, sélection = bordure verte + fond vert pâle. CTA "Sélectionne au moins un" disabled tant qu'aucune coche. |
| Q2 (hydro) | `q3-hydro-4brackets.png` (style) + nouveaux seuils <125/125-200/200-300/>300 | 4 options coloré progressif vert→jaune→orange→rouge. Auto-advance sur sélection. Sub-label "Pas sûr du montant exact? Donne ton meilleur estimé…". |
| Q3 (intent) | `q4-intent.png` | 2 grosses options avec emoji + label bold + sub-label italic. Auto-advance. |
| Lead form | `lead-form-qualified.png` | Layout 2 colonnes prénom/nom, courriel pleine largeur, tel pleine largeur. CTA "Obtenir mon estimation" lime. Badges trust + section "Que se passe-t-il ensuite ?" 3 colonnes. |

**Design intégral conservé — ON NE RÉINVENTE RIEN** :
- Badge "Question X/3 😊" avec smile (cyan #aedee5).
- Progress bar dégradé : `linear-gradient(7.67deg, #aedee5 0%, #b9e15c 99.27%)`.
- Fond crème global `#fffff6`.
- Logo header, navbar, fonts (`font-heading`, `font-serif-body`), `rounded-[20px]`, shadows, borders cyan.
- Bouton "Précédent" coin gauche bas avec ArrowLeft (disabled sur Q1).
- États sélectionnés : bordure verte `#86a735` + fond vert pâle `#ecf8cf`.
- Aucune nouvelle classe Tailwind inventée. Copier les classes du wizard actuel.

**Photo background Q1** : à clarifier (P2-2) — pas implémenté actuellement, asset à fournir par Zack.

### Tests Phase 1 (preview Vercel + manuels)

1. Homepage → CTA → adresse autocomplete → `/analysis?address=...`.
2. Loading spinner → roof-analysis OK → wizard Q1 symptômes.
3. Cocher 2-3 symptômes → bouton "Suivant" activé → click → Q2 hydro.
4. Click sur un bracket hydro → auto-advance vers Q3 intent (vérifier pas de double-click bug).
5. Click sur intent qualifié → state machine avance vers `lead-capture` (form full-page).
6. Remplir form → submit → si OTP_ENABLED → redirect `/verifier-telephone` → après OTP OK → arrive sur `/pricing?leadId=…&d=…` qui affiche `InsulationResults`.
7. Si OTP off → state `pricing` direct dans `/analysis`, affiche `InsulationResults`.
8. Refaire en sélectionnant intent "curieux" → tout marche pareil (Phase 1, pas de différenciation).
9. Bouton "Précédent" : Q1 disabled, Q2/Q3 reviennent en arrière sans perdre les réponses précédentes.
10. Naviguer direct sur `/analysis` sans address → redirect `/`.
11. `npx tsc --noEmit` clean.
12. `npm run build` succès.
13. Grep `LeadCapturePopup` : confirmer que `/thermopompes` continue de l'utiliser (régression check).

### Vérifications avant PR Phase 1

- [ ] Funnel complet du homepage à `InsulationResults` (avec et sans OTP).
- [ ] Aucune régression sur `/thermopompes` (popup intact).
- [ ] Aucune régression sur `/subventions`, `/soumission-rapide`.
- [ ] `/api/leads` reçoit le payload backward-compatible (vérifier via Vercel logs en preview).
- [ ] GHL reçoit les V1 fields avec defaults (vérifier dans GHL UI pour 1 lead test).
- [ ] Make scenario reçoit les colonnes attendues.
- [ ] `npx tsc --noEmit`, `npm run build` OK.

## Phase 2 — Backend wiring (branche `feat/analysis-funnel-v2-backend`)

Lancée après validation visuelle Phase 1. Les 2 PRs mergées ensemble à la fin.

### Scope Phase 2

1. **Meta Pixel dédié soumissionconfort**
   - Nouvelles env vars : `NEXT_PUBLIC_META_PIXEL_ID_SOUMISSIONCONFORT`, `META_CONVERSION_ACCESS_TOKEN_SOUMISSIONCONFORT`, `META_TEST_EVENT_CODE_SOUMISSIONCONFORT`.
   - Garde-fou runtime : si placeholder `XXXXXX` → skip CAPI + warn console.
   - Migrer `app/layout.tsx`, `lib/meta-config.ts`, `app/api/leads/route.ts`, `app/api/test-meta`, `app/api/test-purchase`.
   - Documenter dans `ENV_VARIABLES.md`.

2. **Gating qualifié/curieux côté pixel (cf P1-4)**
   - Retirer browser `Lead` du wizard.
   - Browser `Lead` fire APRÈS OTP confirmé (ou après `/api/leads` ok si OTP off), gated par `intent === 'qualified'`.
   - Server CAPI `Lead` : gate les 2 branches `/api/leads` par `intent === 'qualified'`.
   - `PageView` + `ViewContent` pour tous. Nouvel endpoint `POST /api/meta/view-content` pour dedup CAPI.
   - Retirer `CompleteRegistration` track (grep le repo).

3. **GHL routing par tag**
   - Nouveaux tags : `Lead Iso Hot` (qualifié) / `Lead Iso Curieux` (curieux) selon `intent`.
   - Zack crée le stage "new lead hot" **manuellement dans l'UI GHL**.
   - Workflows GHL ajustés par Zack pour router selon tag.
   - **Pas d'appel direct `/opportunities`**.

4. **Custom fields GHL — décision à prendre (cf P1-2)**
   - Recommandation : option (a) — fields dédiés `symptoms`, `hydro_bracket`, `intent` via script gen.

5. **Estimation gating dans la page finale**
   - Sur `InsulationResults` ou `/pricing` : gater une ligne de copy selon intent. Qualifié = "On contacte 3 entrepreneurs". Curieux = "Voici ton estim, contacte-nous quand tu veux".

### Tests Phase 2

1. Lead qualifié → Events Manager : PageView + ViewContent + Lead reçus. EventID dedupé browser/CAPI.
2. Lead curieux → PageView + ViewContent seulement. Pas de Lead.
3. GHL : tags appliqués correctement, workflow GHL route vers bon stage.
4. Custom fields GHL remplis avec V2 values (pas V1 defaults).
5. OTP enabled : Lead pixel fire APRÈS OTP confirmé.
6. `CompleteRegistration` complètement retiré.

## Critical files (référence rapide)

- [components/user-questionnaire-wizard.tsx](soumissionconfort/components/user-questionnaire-wizard.tsx) — wizard à refondre (544 → ~350 lignes attendues, sans popup)
- [components/lead-capture-form.tsx](soumissionconfort/components/lead-capture-form.tsx) — refonte complète (176 lignes actuelles)
- [components/lead-capture-popup.tsx](soumissionconfort/components/lead-capture-popup.tsx) — **ne pas supprimer** (utilisé par /thermopompes)
- [components/insulation-results.tsx](soumissionconfort/components/insulation-results.tsx) — **pas toucher**
- [app/analysis/page.tsx](soumissionconfort/app/analysis/page.tsx) — state machine (339 lignes)
- [app/api/leads/route.ts](soumissionconfort/app/api/leads/route.ts) — Phase 1 = pas touché ; Phase 2 = gating intent + nouveaux fields
- [lib/insulation-calculator.ts](soumissionconfort/lib/insulation-calculator.ts) — **pas toucher Phase 1** (mapping V2→V1 dans LeadCaptureForm)
- [lib/ghl-fields-iso.ts](soumissionconfort/lib/ghl-fields-iso.ts) — Phase 2
- [lib/ghl-client.ts](soumissionconfort/lib/ghl-client.ts) — Phase 2
- [lib/meta-config.ts](soumissionconfort/lib/meta-config.ts) — Phase 2

## Verification end-to-end

**Phase 1 (visuel) — preview Vercel** :
- [ ] Funnel complet homepage → pricing en ≤4 clicks après roof-analysis (Q1 → Q2 → Q3 → lead form → estimation).
- [ ] Design identique aux screenshots de référence.
- [ ] Multi-select Q1 : bouton "Suivant" disabled tant qu'aucune coche.
- [ ] Auto-advance Q2 et Q3 avec click guard (pas de double-fire).
- [ ] Bouton "Précédent" garde les réponses précédentes ; disabled sur Q1.
- [ ] Address manquante dans URL → redirect homepage.
- [ ] Pricing 3-tier `InsulationResults` s'affiche correctement (avec valeurs basées sur V1 defaults + V2 mapping symptoms).
- [ ] `/thermopompes`, `/subventions`, `/soumission-rapide` : aucune régression.
- [ ] `npx tsc --noEmit` et `npm run build` clean.
- [ ] Plan commité au repo (`PLAN_FUNNEL_V2_ANALYSIS.md`).

**Phase 2 (backend)** :
- [ ] Test Events Manager Meta : Lead seulement pour qualifié, PageView + ViewContent pour tous.
- [ ] GHL : tags + custom fields V2 + stage routing par workflow.
- [ ] `CompleteRegistration` retiré.
- [ ] OTP enabled : Lead pixel fire APRÈS OTP.

**Merge final** :
- [ ] PR Phase 1 + PR Phase 2 review Claude + Codex (`/commit-push-pr`).
- [ ] Pixel Meta soumissionconfort créé, env vars updated Vercel.
- [ ] Stage "new lead hot" créé manuellement GHL.
- [ ] Merge des 2 PRs main → deploy prod → vérifier 1 lead réel (qualifié + curieux).

## Questions ouvertes pour Zack

1. **P2-2 — Photo background Q1** : tu veux une image en fond du wizard ? Si oui, source de l'asset ? (Le wizard actuel n'en a pas, les screenshots ne sont pas représentatifs du code actuel.)
2. **P1-2 — GHL custom fields Phase 2** : tu préfères (a) créer 3 nouveaux fields dédiés `symptoms` / `hydro_bracket` / `intent`, (b) reuser `problemes_identifies` TEXT pour symptoms + créer 2 fields, ou (c) un super-field JSON ?
3. **P0-3 — Pricing dégradation acceptée Phase 1** : le pricing 3-tier va devenir générique sur les axes chauffage/isolation/accès car ces champs sont supprimés du wizard. Acceptable pour Phase 1, ou tu veux Phase 1.5 qui étend `calculateInsulationPricing` pour utiliser symptoms+hydro comme inputs réels avant le merge prod ?
