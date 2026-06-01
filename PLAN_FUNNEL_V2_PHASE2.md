# Plan — Phase 2 funnel V2 `/analysis` (Backend wiring)

> **Statut** : Phase 1 (visuel) mergée dans PR #20. Phase 2 ouvre une nouvelle branche `feat/analysis-funnel-v2-backend` **depuis** `feat/analysis-funnel-v2` (pas `main`). Les 2 PRs sont mergées ensemble à la fin.

## Context

Phase 1 a livré le wizard V2 (3 questions : symptoms / hydroBracket / intent), le lead form full-page, et le payload backward-compatible vers `/api/leads`. Les 3 champs V2 voyagent déjà dans `userAnswersPayload` mais GHL ne les écrit pas (les clés non mappées sont silencieusement ignorées avec un `console.warn`) et Meta reçoit un `Lead` indistinct pour qualifiés et curieux.

**Phase 2 ferme la boucle, isolément sur le funnel `/analysis`**. Les autres funnels (`/thermopompes`, `/subventions`, `/soumission-rapide`) ne sont **pas touchés** : ils continuent sur le pixel partagé actuel, et leur logique GHL/CAPI reste intacte.

### Schéma visuel — flux Meta du funnel `/analysis` (Phase 2 v2)

**Vocabulaire d'abord** :

| Terme technique | En langage clair |
|---|---|
| **Pixel actuel** (Niku setup) | Le tracker Meta unique en place aujourd'hui, partagé entre tous les funnels. Sert toujours homepage/thermopompes/subventions/soumission-rapide. **Désactivé sur `/analysis*` + `/verifier-telephone`.** |
| **Pixel dédié soumissionconfort** | Le NOUVEAU tracker Meta. Chargé UNIQUEMENT sur le funnel /analysis. C'est lui qui devient ton "compteur de leads isolation" propre dans Meta Ads. |
| **Browser event** (`fbq`) | Le code JS dans le navigateur qui ping Meta directement. Avantage : capture cookies Facebook attribution. Inconvénient : ad blockers le tuent. |
| **CAPI event** (server-side) | Notre serveur Vercel qui ping Meta directement. Avantage : pas d'ad blocker. Inconvénient : pas de cookies attribution. |
| **eventID partagé** | Browser + CAPI envoyés avec le même identifiant unique → Meta dedupe et compte 1 event. |
| **PageView** | Event "le user a vu la page". Auto-envoyé par fbq à chaque chargement. |
| **ViewContent** | Event "le user a vu un contenu spécifique". Manuel. Phase 2 : déclenché au mount du wizard `/analysis`. |
| **Lead** | Event "le user est devenu un lead qualifié pour mon business". Meta optimise les Ads dessus. Précieux. Phase 2 : déclenché APRÈS OTP confirmé, qualifié uniquement. |

---

### Étape 1 — User sur la homepage

```
USER ouvre soumissionconfort.com/
   │
   │  Code : <MetaPixelRouter /> détecte pathname = "/"
   │         → charge le PIXEL ACTUEL (Niku)
   │  Code : fbq('init', 'PIXEL_ACTUEL_ID')
   │  Code : fbq('track', 'PageView')   ← auto au chargement
   │
   ▼
[Pixel actuel] envoie à Meta : PageView (page = "/")
[Pixel dédié]  ← PAS chargé, ne reçoit rien
```

**En clair** : Comme aujourd'hui. Le pixel actuel voit la homepage. Le pixel dédié dort.

---

### Étape 2 — User entre son adresse et clique "Obtenir mon estimation"

```
USER tape son adresse → click "Obtenir mon estimation gratuite"
   │
   │  Code dans navigateToAnalysis() :
   │   - router.push('/analysis?address=...')
   │  (PAS de ViewContent ici — Phase 2 v2 le déplace au mount du wizard)
   │
   ▼
USER navigue vers /analysis
[Pixel actuel] ← rien envoyé (pas de fbq.track manuel ici)
[Pixel dédié]  ← rien envoyé (pas encore chargé)
```

**En clair** : Le click ne déclenche aucun event spécifique. On laisse Next.js naviguer vers `/analysis`.

---

### Étape 3 — User arrive sur /analysis (loading + wizard)

```
USER arrive sur /analysis?address=...
   │
   │  Code : <MetaPixelRouter /> détecte pathname = "/analysis"
   │         → DÉCHARGE le pixel actuel (script change)
   │         → charge le PIXEL DÉDIÉ
   │  Code : fbq('init', 'PIXEL_DEDIE_ID')
   │  Code : fbq('track', 'PageView')   ← auto au chargement
   │
   ▼
[Pixel actuel] ← reçoit RIEN (script remplacé, pas de re-fire)
[Pixel dédié]  ← PageView (page = "/analysis?address=…")

   │  Page : state = 'loading' → fetch /api/roof-analysis → response OK
   │  Page : state = 'questionnaire' → wizard mount
   │
   │  Code (NOUVEAU au mount wizard) :
   │   1. Génère eventID = "X"
   │   2. fbq('track', 'ViewContent', {...}, {eventID: 'X'})
   │        → envoie au [Pixel dédié] (le seul chargé)
   │   3. fetch POST /api/meta/view-content { eventId: 'X' }
   │        → server : metaAPI.trackViewContent vers [Pixel dédié] CAPI
   │
   ▼
[Pixel dédié] reçoit ViewContent [X] 2 fois : browser + CAPI → dedup = 1

USER fait Q1 symptoms → Q2 hydro → Q3 intent (qualifié OU curieux)
   │
   │  (rien envoyé à Meta pendant les questions — pas besoin)
   │
   ▼
USER arrive au lead form
```

**En clair** :
- Dès qu'on arrive sur `/analysis`, Next.js change le pixel chargé : il vire le pixel actuel et met le pixel dédié à la place. Audience pixel actuel = ne voit jamais `/analysis`.
- Au mount du wizard (après le loading), on envoie un ViewContent au pixel dédié. Browser + CAPI tous deux avec le même eventID = Meta compte 1 event "ce user a commencé l'application".

---

### Étape 4 — User soumet le lead form

```
USER click "Découvrir mon estimation maintenant"
   │
   │  Code : Génère un eventID = "Y" (nouveau, différent de X)
   │  Code : stash sessionStorage.pending-lead = {
   │            firstName, lastName, ..., eventId: 'Y',
   │            meta: { intent: 'qualified' OU 'curious', estimatedValue: 1200 }
   │          }
   │  Code : router.push('/verifier-telephone')
   │
   │  ⚠️ PAS de fbq('Lead') ici. Phase 2 le déplace après l'OTP confirmé.
   │
   ▼
USER navigue vers /verifier-telephone (SMS code)
```

**En clair** : On garde l'info dans le navigateur du user (sessionStorage), on l'envoie sur la page OTP. **On n'envoie PAS encore l'event Lead à Meta**. On attend la preuve que le téléphone existe vraiment (sinon on déclarerait des leads bidon).

---

### Étape 5 — User confirme l'OTP par SMS

```
USER tape le code 6 chiffres → submit
   │
   │  Code : POST /api/verify-otp → twilio confirme → ok
   │  Code : submitDeferredLead() → POST /api/leads avec le payload complet
   │         { firstName, ..., eventId: 'Y', userAnswers: { intent: '...' } }
   │
   │  SERVER /api/leads fait 2 trucs :
   │  ┌──────────────────────────────────────────────────────────┐
   │  │ A) GHL (toujours, peu importe l'intent) :                │
   │  │    - crée/upsert le contact dans le sub-account Iso       │
   │  │    - écrit les custom fields (symptoms, hydro, intent)    │
   │  │    - applique tag 'Lead Iso Hot' si qualifié              │
   │  │                       OU 'Lead Iso Curieux' si curieux    │
   │  │    - DELETE 'Lead Iso Curieux' si user était déjà         │
   │  │      curieux + se requalifie (override)                   │
   │  │                                                            │
   │  │ B) Meta CAPI (CONDITIONNEL selon intent) :                │
   │  │    SI intent === 'qualified' :                            │
   │  │       metaAPI.trackLead({ eventId: 'Y', value: ... })    │
   │  │       → envoie à [Pixel dédié] : Lead [Y] qualifié        │
   │  │    SI intent === 'curious' :                              │
   │  │       skip — RIEN envoyé à Meta                           │
   │  └──────────────────────────────────────────────────────────┘
   │
   │  Côté CLIENT, après que /api/leads retourne OK :
   │  ┌──────────────────────────────────────────────────────────┐
   │  │ Code dans /verifier-telephone (route group analysis-funnel│
   │  │ → pixel dédié toujours chargé via MetaPixelRouter) :     │
   │  │ SI pending.meta.intent === 'qualified' :                 │
   │  │    fbq('track', 'Lead', { value, currency }, {           │
   │  │       eventID: 'Y'   ← MÊME eventID que CAPI = dedup     │
   │  │    })                                                     │
   │  │    → envoie au [Pixel dédié] (le seul chargé)            │
   │  │ SI intent === 'curious' :                                │
   │  │    skip — RIEN envoyé à Meta                             │
   │  └──────────────────────────────────────────────────────────┘
   │
   ▼
[Pixel dédié]  reçoit Lead [Y] 2 fois : browser + CAPI → Meta dedupe = 1 Lead
[Pixel actuel] reçoit RIEN (pas chargé sur /verifier-telephone)
```

**En clair** :
- **Lead qualifié confirmé OTP** → Meta reçoit l'event Lead 2x sur le pixel dédié (1x du navigateur + 1x de notre serveur), avec le même identifiant Y. Meta voit "c'est le même event, je compte 1 lead". Audience pixel dédié = clean.
- **Lead curieux confirmé OTP** → Meta ne reçoit RIEN comme Lead. GHL reçoit quand même le contact (tag `Lead Iso Curieux`). Tu pourras le travailler en sales follow-up mais Meta n'optimise pas ses ads dessus → tu paies pas pour aller chercher d'autres curieux.

---

### Étape 6 — Redirection vers la page d'estimation

```
USER arrive sur /pricing?leadId=...&d=...
   │
   │  Code : MetaPixelRouter détecte pathname = "/pricing"
   │         → DÉCHARGE le pixel dédié
   │         → charge le pixel actuel
   │  Code : fbq('init', 'PIXEL_ACTUEL_ID')
   │  Code : fbq('track', 'PageView')
   │
   ▼
[Pixel actuel] ← PageView (/pricing)
[Pixel dédié]  ← démonté
[Page] → affiche InsulationResults (même copy pour qualifié et curieux)
```

**En clair** : Le user a vu son estimation. Le pixel dédié dort. Le pixel actuel reprend le contrôle pour le reste du site.

---

### Récap "qui a vu quoi dans Meta" en fin de funnel

| Lead type | Pixel actuel (Niku) voit | Pixel dédié soumissionconfort voit |
|---|---|---|
| **Qualifié** | PageView homepage, PageView /pricing | PageView /analysis, **ViewContent [X]**, PageView /verifier-telephone, **Lead [Y] dedupé** |
| **Curieux** | PageView homepage, PageView /pricing | PageView /analysis, **ViewContent [X]**, PageView /verifier-telephone (PAS de Lead) |

**La grande différence** : le pixel dédié voit **uniquement le funnel /analysis**, et il ne reçoit un Lead **que pour les qualifiés post-OTP**. Audience pixel dédié = 100% propre. Le pixel actuel ne voit jamais le funnel `/analysis` — pas de bruit, ses audiences thermopompes/subventions/soumission-rapide restent intactes.

### Logique du pixel actuel (Niku) vs pixel dédié — résumé (Zack tranché v2)

- **Pixel actuel** (`NEXT_PUBLIC_META_PIXEL_ID`, setup Niku, partagé) :
  - Continue de servir homepage `/`, `/thermopompes`, `/subventions`, `/soumission-rapide`.
  - Sur `/analysis*` et `/verifier-telephone` → **désactivé** (ne se charge pas, ne fire rien). Aucun bruit isolation dans son audience.
- **Pixel dédié soumissionconfort** (`NEXT_PUBLIC_META_PIXEL_ID_SOUMISSIONCONFORT`, NOUVEAU) :
  - Chargé **uniquement** sur `/analysis*` et `/verifier-telephone`.
  - Reçoit : PageView (auto au mount), ViewContent (au mount du wizard), Lead (post-OTP qualifié uniquement, browser + CAPI dedup).
  - Audience clean isolation → utilisable pour optimiser tes campagnes Ads Meta sur les leads qualifiés iso.

### Logique de décision du Lead — résumé

Le pixel **Lead** est envoyé à Meta **uniquement si les 3 conditions sont réunies** (mot-à-mot Zack, validé) :

1. **À la question d'intent** (= Q3 du wizard, ou "Q4" si on compte l'adresse comme Q1) le user a sélectionné **"Je veux faire les travaux"** (`intent = 'qualified'`).
2. Le user a **soumis le form de contact** (prénom + nom + email + téléphone).
3. Le user a **confirmé le code SMS** sur `/verifier-telephone` (OTP_ENABLED=true en prod).

Si **n'importe laquelle** des 3 conditions manque → **aucun Lead envoyé à Meta** (ni browser, ni CAPI, ni au pixel global, ni au pixel dédié). Le contact est quand même créé dans GHL (avec son tag `Lead Iso Curieux` si curieux, ou pas de contact du tout si abandon).

### Sequence d'events Meta cible (mot pour mot Zack)

1. **PageView** → fire automatiquement par le tag du pixel sur chaque navigation (déjà géré par `app/layout.tsx`). **On n'y touche pas.**
2. **ViewContent** → **NOUVEAU** : fire **quand l'utilisateur soumet son adresse depuis le homepage** (dans `navigateToAnalysis()` de [app/page.tsx:81-94](soumissionconfort/app/page.tsx#L81-L94), juste avant `router.push(href)`). Signal Meta : « ce user a commencé l'application ». Browser pixel + CAPI dedup via `eventID`.
3. **Lead** → fire **uniquement si `intent === 'qualified'`** APRÈS confirmation OTP (path OTP_ENABLED=true) **ou** APRÈS retour `/api/leads` OK (path OTP off). Curieux → aucun Lead, ni browser ni CAPI.

### GHL cible

- Écrire les 3 V2 fields (`symptoms`, `hydro_bracket`, `intent`) dans le contact GHL (les IDs existent déjà dans `lib/ghl-fields-iso.ts` lignes 41-43).
- Remplacer le tag statique `Lead Iso` par **`Lead Iso Hot`** (qualifié) ou **`Lead Iso Curieux`** (curieux) sur le contact isolation.
- Si un contact existant a déjà `Lead Iso Curieux` et revient en qualifié → **ajouter `Lead Iso Hot` ET retirer `Lead Iso Curieux`** (override). On garde une seule "vérité" : le statut le plus chaud.

### Cleanup

- Retirer le seul `fbq("track", "CompleteRegistration", ...)` (dans [app/soumission-rapide/merci/page.tsx:72](soumissionconfort/app/soumission-rapide/merci/page.tsx#L72)). Demande explicite plan source P1-4. Funnel inactif → impact prod nul, mais cleanup propre.

---

## État actuel vérifié

- `feat/analysis-funnel-v2` est checked out, PR #20 ouverte. 3 GHL custom fields créés dans sub-account Iso `7gpshI6Ger307wy0gSRU` ([lib/ghl-fields-iso.ts:41-43](soumissionconfort/lib/ghl-fields-iso.ts#L41-L43)).
- [components/lead-capture-form.tsx:124-137](soumissionconfort/components/lead-capture-form.tsx#L124-L137) fire déjà `fbq('Lead', ...)` browser gated par `intent === 'qualified'` — **à déplacer post-OTP**.
- [app/api/leads/route.ts:269-321](soumissionconfort/app/api/leads/route.ts#L269-L321) (branche GHL) appelle `metaAPI.trackLead()` **sans gate intent** — à gater + à pointer vers le nouveau pixel.
- [app/api/leads/route.ts:747-819](soumissionconfort/app/api/leads/route.ts#L747-L819) (branche legacy Make) — pas exécutée en prod (`GHL_ENABLED=true`). On la gate par cohérence mais pas une priorité.
- [lib/meta-config.ts](soumissionconfort/lib/meta-config.ts) expose `META_CONFIG` partagé. Ajouter `META_CONFIG_SOUMISSIONCONFORT` à côté (cohabitation, pas remplacement).
- [lib/meta-conversion-api.ts:101-119](soumissionconfort/lib/meta-conversion-api.ts#L101-L119) `trackViewContent` existe mais **ne supporte pas `eventId`** → dedup browser/CAPI impossible tel quel. À étendre.
- [app/page.tsx:75-79](soumissionconfort/app/page.tsx#L75-L79) appelle déjà `trackViewContent('Homepage', 'website')` au mount — c'est un autre event (Homepage view), **on le garde**. Le nouveau ViewContent (au submit adresse, `analysis-wizard-v2`) s'ajoute à côté avec un `content_name` distinct.
- [app/page.tsx:81-94](soumissionconfort/app/page.tsx#L81-L94) `navigateToAnalysis()` = le point d'injection ViewContent demandé par Zack.
- [app/soumission-rapide/merci/page.tsx:72](soumissionconfort/app/soumission-rapide/merci/page.tsx#L72) : seule occurrence `CompleteRegistration` (grep confirmé).
- [app/verifier-telephone/page.tsx:99-127](soumissionconfort/app/verifier-telephone/page.tsx#L99-L127) — `submitDeferredLead()` POST `/api/leads`. Le browser Lead fire ici après `submitDeferredLead` OK.
- `GHL_ENABLED=true` en prod (vérifié dans le code et la doc).
- GHL API `DELETE /contacts/{contactId}/tags` confirmé existant (doc officielle). Body `{ tags: [string] }` par cohérence avec ADD (le body schema exact n'est pas documenté côté Remove, à valider en preview avec un curl test).

---

## Phase 2.0 — Setup branche

```
git checkout feat/analysis-funnel-v2
git pull
git checkout -b feat/analysis-funnel-v2-backend
git branch --show-current  # confirmer feat/analysis-funnel-v2-backend
```

Pixel ID + token Meta : **Zack écrit directement dans `.env.local`** (et plus tard dans Vercel) — pas dans le chat. Le code accepte un placeholder `XXXXXX` avec garde-fou (skip silencieux + `console.warn`).

---

## Phase 2.1 — Pixel Meta dédié soumissionconfort, scope = `/analysis` uniquement

### Nouvelles env vars

```bash
NEXT_PUBLIC_META_PIXEL_ID_SOUMISSIONCONFORT=<pixel ID Meta>
META_CONVERSION_ACCESS_TOKEN_SOUMISSIONCONFORT=<token CAPI Meta>
META_TEST_EVENT_CODE_SOUMISSIONCONFORT=  # optionnel pour tests
```

Les vars existantes (`NEXT_PUBLIC_META_PIXEL_ID`, `META_CONVERSION_ACCESS_TOKEN`) **restent** et continuent à servir les autres funnels (homepage PageView, thermopompes, subventions, soumission-rapide).

### Fichier modifié : [lib/meta-config.ts](soumissionconfort/lib/meta-config.ts)

Ajouter à côté du `META_CONFIG` existant :

```ts
export const META_CONFIG_SOUMISSIONCONFORT = {
  PIXEL_ID: process.env.NEXT_PUBLIC_META_PIXEL_ID_SOUMISSIONCONFORT || '',
  ACCESS_TOKEN: process.env.META_CONVERSION_ACCESS_TOKEN_SOUMISSIONCONFORT || '',
  TEST_EVENT_CODE: process.env.META_TEST_EVENT_CODE_SOUMISSIONCONFORT || undefined,
}

export function isSoumissionConfortMetaConfigured(): boolean {
  const id = META_CONFIG_SOUMISSIONCONFORT.PIXEL_ID
  const token = META_CONFIG_SOUMISSIONCONFORT.ACCESS_TOKEN
  if (!id || !token) return false
  // Garde-fou placeholder XXXXXX
  if (/^X+$/i.test(id) || /^X+$/i.test(token)) return false
  return true
}
```

### Décision portée du pixel browser (Zack tranché v2)

**Sur les routes du funnel `/analysis`** (= `/analysis`, `/analysis/*`, `/verifier-telephone`) :
- Le pixel **actuel partagé** (celui setup par Niku, `NEXT_PUBLIC_META_PIXEL_ID`) est **DÉSACTIVÉ** — il ne reçoit aucun event de ce funnel.
- Seul le **pixel dédié soumissionconfort** est chargé et reçoit les events.
- Résultat : audience pixel dédié 100% propre (uniquement isolation /analysis), pixel actuel continue de servir thermopompes/subventions/soumission-rapide comme avant, sans bruit iso.

### Comment désactiver le pixel actuel sur `/analysis*` + `/verifier-telephone`

Le pixel actuel est chargé dans [app/layout.tsx](soumissionconfort/app/layout.tsx) (root, Server Component qui ne peut pas utiliser `usePathname`). On ne peut pas conditionner directement le `<Script>` dans ce layout.

**Solution** : extraire la logique pixel dans un **client component intelligent** qui décide quel pixel charger selon le pathname.

#### Nouveau composant : [components/meta-pixel-router.tsx](soumissionconfort/components/meta-pixel-router.tsx)

```tsx
"use client"
import Script from 'next/script'
import { usePathname } from 'next/navigation'

const PIXEL_PARTAGE = process.env.NEXT_PUBLIC_META_PIXEL_ID
const PIXEL_DEDIE = process.env.NEXT_PUBLIC_META_PIXEL_ID_SOUMISSIONCONFORT

function isAnalysisFunnel(pathname: string): boolean {
  return pathname === '/analysis'
    || pathname.startsWith('/analysis/')
    || pathname === '/verifier-telephone'
}

export function MetaPixelRouter() {
  const pathname = usePathname()
  const inAnalysisFunnel = isAnalysisFunnel(pathname)

  // Décide quel pixel ID charger
  const pixelToLoad = inAnalysisFunnel ? PIXEL_DEDIE : PIXEL_PARTAGE

  // Garde-fou strict (Zack v2 décision 5) :
  // - Si on est dans le funnel /analysis ET le pixel dédié est placeholder XXXXXX
  //   → return null (PAS de fallback vers le pixel actuel — audience pure).
  // - Si on est sur les autres pages ET le pixel actuel est placeholder
  //   → return null aussi (pas de tracking, mais ça n'arrive pas en prod).
  if (!pixelToLoad || /^X+$/i.test(pixelToLoad)) return null

  return (
    <>
      <Script id="meta-pixel" strategy="afterInteractive">
        {`
          !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
          n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
          document,'script','https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '${pixelToLoad}');
          fbq('track', 'PageView');
        `}
      </Script>
      <noscript>
        <img height="1" width="1" style={{ display: 'none' }}
          src={`https://www.facebook.com/tr?id=${pixelToLoad}&ev=PageView&noscript=1`} alt="" />
      </noscript>
    </>
  )
}
```

#### Modification : [app/layout.tsx](soumissionconfort/app/layout.tsx)

Retirer le `<Script>` du pixel actuel (lignes 166-195) et remplacer par :
```tsx
<MetaPixelRouter />
```

**Conséquence** :
- Sur `/`, `/thermopompes`, `/subventions`, `/soumission-rapide` etc. → `MetaPixelRouter` charge le **pixel actuel partagé**. Comportement identique à aujourd'hui.
- Sur `/analysis*` et `/verifier-telephone` → `MetaPixelRouter` charge le **pixel dédié soumissionconfort** UNIQUEMENT. Le pixel actuel ne se charge même pas, ne fire rien.

**Trade-off à comprendre** :
- Quand un user navigue depuis homepage `/` (pixel partagé chargé) vers `/analysis` (pixel dédié chargé) : Next.js fait une nav SPA → le composant `MetaPixelRouter` reste mounté mais son contenu change. Le `<Script>` change de pixel ID → fbq se ré-init avec le nouveau pixel. **Le PageView de `/analysis` part donc uniquement au pixel dédié, pas au pixel partagé. C'est exactement ce qu'on veut.**
- Quand un user clique "Obtenir mon estimation" sur la homepage → l'event ViewContent (que Phase 2 ajoute dans `navigateToAnalysis`) fire **sur la homepage** au moment du click, donc avant que la navigation se termine, donc le `fbq('track','ViewContent',...)` part **au pixel partagé**, PAS au pixel dédié. **Problème** : le pixel dédié manque le ViewContent du submit adresse depuis homepage.

#### Sous-problème : ViewContent depuis homepage doit aller au pixel dédié

Le ViewContent au submit adresse depuis homepage **doit** être attribué au pixel dédié soumissionconfort (pas au pixel actuel partagé). Mais à ce moment, le navigateur n'a chargé que le pixel partagé (puisque l'utilisateur est sur `/` qui n'est pas dans le funnel `/analysis`).

**Options** :

1. **Inversion : déclencher le ViewContent côté serveur uniquement** (pas de `fbq('track', 'ViewContent')` browser depuis homepage). Le `fetch /api/meta/view-content` du serveur envoie le ViewContent au pixel dédié via CAPI. **Inconvénient** : pas d'attribution Facebook cookies (`_fbp`/`_fbc`) côté browser → Meta a moins de signal pour l'attribution. Mais c'est mieux que d'envoyer au mauvais pixel.

2. **Fire le ViewContent browser depuis `/analysis` au mount du wizard** (pas depuis homepage au submit adresse). Le pixel dédié est chargé à ce moment-là, donc browser fbq + CAPI vont tous deux au bon pixel.

**Décision recommandée Option 2** : déplacer le déclencheur ViewContent **du homepage submit adresse → vers le mount du wizard `/analysis`**. C'est très proche de l'intention Zack ("quand il commence à remplir") — l'arrivée sur le wizard = effectivement quand le user commence à interagir avec le funnel. Différence : retard d'environ 1-3 secondes (le temps du `/api/roof-analysis`). Pas critique pour Meta.

**À confirmer avec Zack** : OK pour fire ViewContent au mount `/analysis` (= juste après loading roof-analysis, avant Q1) plutôt qu'au submit adresse homepage ?

**Note** : la décision verrouillée (Zack v2) impose que le pixel actuel soit DÉSACTIVÉ sur `/analysis*` + `/verifier-telephone`. La solution `<MetaPixelRouter />` ci-dessus (avant la sequence visuelle) couvre cette logique : un composant unique qui charge soit l'un soit l'autre selon `usePathname()`. Pas besoin de route group `(analysis-funnel)` pour ça — `<MetaPixelRouter />` est monté dans `app/layout.tsx` une seule fois, il gère lui-même la bascule sur navigation.

---

## Phase 2.2 — ViewContent fire au mount /analysis (après loading roof-analysis)

**Décision Zack v2** : le ViewContent doit aller **au pixel dédié** uniquement, pas au pixel actuel. Mais le pixel dédié n'est pas chargé sur la homepage (`MetaPixelRouter` charge le pixel actuel sur `/`). Si on fire ViewContent au submit homepage, l'event browser part au pixel actuel = pollution. **Donc on déménage le déclencheur du submit adresse → vers le mount du wizard `/analysis`**.

**Conséquence** : `app/page.tsx` ligne 81-94 (`navigateToAnalysis`) ne reçoit pas de nouveau code pour ViewContent. Aucune modification de la homepage (sauf garder l'`trackViewContent('Homepage'…)` mount existant ligne 77).

### Fichier modifié : [components/user-questionnaire-wizard.tsx](soumissionconfort/components/user-questionnaire-wizard.tsx)

Ajout d'un `useEffect` fire-once au mount du wizard (= moment où le wizard apparaît après le loading roof-analysis) :

```tsx
const viewContentFiredRef = useRef(false)
useEffect(() => {
  if (viewContentFiredRef.current) return
  viewContentFiredRef.current = true

  const eventId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `vc-${Date.now()}-${Math.random().toString(36).slice(2)}`

  // Browser pixel ViewContent (vers le pixel dédié, déjà chargé sur /analysis via MetaPixelRouter)
  if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
    window.fbq('track', 'ViewContent', {
      content_name: 'analysis-wizard-v2',
      content_category: 'isolation',
    }, { eventID: eventId })
  }

  // CAPI ViewContent vers le pixel dédié soumissionconfort (dedup via même eventId)
  fetch('/api/meta/view-content', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      eventId,
      sourceUrl: typeof window !== 'undefined' ? window.location.href : undefined,
    }),
    keepalive: true,
  }).catch(err => console.warn('ViewContent CAPI failed', err))
}, [])
```

**Pourquoi le wizard et pas `/analysis/page.tsx`** : le wizard ne se mount que quand `currentStep === 'questionnaire'` (donc après le loading roof-analysis OK). Si on monte le useEffect dans `page.tsx`, le ViewContent fire dès le state 'loading' → trop tôt (l'utilisateur n'a pas encore "commencé l'application"). Le wizard mount = exactement le moment voulu par Zack.

**`keepalive: true`** : conservé même si pas strictement nécessaire ici (le user reste sur la page après le mount, pas de navigation immédiate). Bonne hygiène défense au cas où le user click rapidement quelque chose.

### Nouveau fichier : [app/api/meta/view-content/route.ts](soumissionconfort/app/api/meta/view-content/route.ts)

```ts
import { NextRequest, NextResponse } from 'next/server'
import { MetaConversionAPI } from '@/lib/meta-conversion-api'
import { META_CONFIG_SOUMISSIONCONFORT, isSoumissionConfortMetaConfigured } from '@/lib/meta-config'

export async function POST(request: NextRequest) {
  if (!isSoumissionConfortMetaConfigured()) {
    console.warn('[view-content] Meta CAPI not configured for soumissionconfort (skip)')
    return NextResponse.json({ skipped: true })
  }
  try {
    const { eventId, sourceUrl, address } = await request.json()
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]
      || request.headers.get('x-real-ip') || 'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    const metaAPI = new MetaConversionAPI(
      META_CONFIG_SOUMISSIONCONFORT.PIXEL_ID,
      META_CONFIG_SOUMISSIONCONFORT.ACCESS_TOKEN,
      META_CONFIG_SOUMISSIONCONFORT.TEST_EVENT_CODE,
    )

    await metaAPI.trackViewContent({
      eventId,
      sourceUrl,
      clientIp,
      userAgent,
      contentName: 'analysis-wizard-v2',
      contentType: 'isolation',
      searchString: address,
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[view-content] CAPI error', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
```

### Fichier modifié : [lib/meta-conversion-api.ts](soumissionconfort/lib/meta-conversion-api.ts)

Refactor `trackViewContent` (lignes 101-119) pour accepter une signature object avec `eventId` :

```ts
async trackViewContent(data: {
  contentName?: string
  contentType?: string
  searchString?: string
  eventId?: string
  clientIp?: string
  userAgent?: string
  sourceUrl?: string
}) {
  const userData: any = {}
  if (data.clientIp) userData.client_ip_address = data.clientIp
  if (data.userAgent) userData.client_user_agent = data.userAgent

  const event: MetaConversionEvent = {
    event_name: 'ViewContent',
    event_id: data.eventId,
    event_time: Math.floor(Date.now() / 1000),
    action_source: 'website',
    user_data: userData,
    custom_data: {
      content_type: data.contentType || 'website',
      content_name: data.contentName || 'Homepage',
      currency: 'CAD',
      ...(data.searchString && { search_string: data.searchString }),
    },
    event_source_url: data.sourceUrl
      || (typeof window !== 'undefined' ? window.location.href : undefined),
  }
  return this.sendEvent(event)
}
```

**Backward compat** : l'appelant homepage existant ligne 77 (`trackViewContent('Homepage', 'website')`) appelle via la convenience function exportée ligne 343-349. Refactorer la convenience pour accepter soit la vieille signature `(contentName, contentType)` soit la nouvelle object, ou changer l'appelant homepage pour passer un objet. Plus simple : adapter [app/page.tsx:77](soumissionconfort/app/page.tsx#L77) à la nouvelle signature `trackViewContent({ contentName: 'Homepage', contentType: 'website' })`.

---

## Phase 2.3 — Lead event uniquement APRÈS OTP + intent qualifié

### Fichier modifié : [components/lead-capture-form.tsx](soumissionconfort/components/lead-capture-form.tsx)

**Retirer lignes 124-137** (le `window.fbq('track', 'Lead', ...)` actuel — il fire avant l'OTP).

**Ajouter dans le `leadPayload` stashé** pour que `/verifier-telephone` puisse fire le Lead après OTP. **Important (P0-3)** : `leadPayload.eventId` existe DÉJÀ au top-level (ligne 119 actuelle) — c'est lui qu'on réutilise côté `/verifier-telephone` via `pending.eventId`. Ne PAS le déplacer dans `pending.meta`.

```ts
const leadPayload = {
  // ... existant
  eventId,  // déjà présent ligne 119 — reste top-level pour /verifier-telephone
  meta: {
    intent: v2Answers.intent,
    estimatedValue: pricingData?.ranges?.standard
      ? (pricingData.ranges.standard.totalCost.min + pricingData.ranges.standard.totalCost.max) / 2
      : 0,
  },
}
```

**Path non-OTP (OTP_ENABLED=false)** : fire le Lead browser **APRÈS** `/api/leads` 200 (au lieu d'avant), gated par `qualified` + même `eventId` que CAPI. Localisation : après ligne 177 actuelle (`onComplete(...)`), juste avant.

### Fichier modifié : [app/verifier-telephone/page.tsx](soumissionconfort/app/verifier-telephone/page.tsx)

Dans `confirmOtp()`, après que `submitDeferredLead(data.otpToken)` retourne `{ ok: true }` (ligne 161) et avant `setState("verified")` ligne 183 :

```ts
try {
  const pendingRaw = sessionStorage.getItem("pending-lead")
  if (pendingRaw) {
    const pending = JSON.parse(pendingRaw)
    if (
      pending?.meta?.intent === 'qualified' &&
      typeof window !== 'undefined' &&
      typeof window.fbq === 'function'
    ) {
      const eventId = pending.eventId
        || ('randomUUID' in crypto ? crypto.randomUUID() : `lead-${Date.now()}`)
      window.fbq('track', 'Lead', {
        value: (pending.meta.estimatedValue || 0).toFixed(2),
        currency: 'CAD',
        service_type: 'isolation',
      }, { eventID: eventId })
    }
  }
} catch (err) {
  console.warn('post-OTP Lead pixel failed', err)
}
```

**Note dedup** : `pending.eventId` est exactement celui passé à `/api/leads` ligne 119 (`leadPayload.eventId`) → `metaAPI.trackLead({ eventId: leadData.eventId })` ligne 311 → Meta dedupe le Lead browser ↔ CAPI.

### CAPI Lead — gating intent + pixel dédié

#### Fichier modifié : [app/api/leads/route.ts](soumissionconfort/app/api/leads/route.ts)

Branche GHL, lignes 269-321 : remplacer la sélection statique du pixel par une dispatch par vertical, + gate intent.

```ts
const useSoumissionConfortPixel = vertical === 'isolation'  // pas isolation_soumission_rapide — pas dans le scope V2
const metaPixelId = useSoumissionConfortPixel
  ? process.env.NEXT_PUBLIC_META_PIXEL_ID_SOUMISSIONCONFORT
  : process.env.NEXT_PUBLIC_META_PIXEL_ID
const metaAccessToken = useSoumissionConfortPixel
  ? process.env.META_CONVERSION_ACCESS_TOKEN_SOUMISSIONCONFORT
  : process.env.META_CONVERSION_ACCESS_TOKEN
const metaTestEventCode = useSoumissionConfortPixel
  ? process.env.META_TEST_EVENT_CODE_SOUMISSIONCONFORT
  : process.env.META_TEST_EVENT_CODE

const isPlaceholder = (v?: string) => !!v && /^X+$/i.test(v)
const intentGateOk = !useSoumissionConfortPixel
  || leadData.userAnswers?.intent === 'qualified'
const isTestLead = leadData.isTest === true  // gate replay/debug (Zack v2 décision 7)

if (
  !isTestLead
  && metaPixelId && metaAccessToken
  && !isPlaceholder(metaPixelId) && !isPlaceholder(metaAccessToken)
  && intentGateOk
) {
  const metaAPI = initializeMetaConversionAPI(metaPixelId, metaAccessToken, metaTestEventCode)
  // ... reste inchangé (trackLead existant)
} else if (isTestLead) {
  console.log('[leads] skip Meta CAPI Lead — isTest=true')
} else if (useSoumissionConfortPixel && !intentGateOk) {
  console.log('[leads] skip Meta CAPI Lead — intent !== qualified')
} else if (useSoumissionConfortPixel && (isPlaceholder(metaPixelId) || isPlaceholder(metaAccessToken))) {
  console.warn('[leads] skip Meta CAPI Lead — soumissionconfort pixel/token is placeholder XXXXXX')
}
```

Branche legacy Make (lignes 747-819) : appliquer le même pattern par cohérence (même si pas exécutée en prod).

---

## Phase 2.4 — GHL : tag override + 3 V2 custom fields

### Fichier modifié : [lib/ghl-client.ts](soumissionconfort/lib/ghl-client.ts)

1. Étendre `NormalizedLead` interface (ligne 27-54) avec un champ optionnel :
```ts
tagOverride?: string         // remplace VERTICAL_TAG[vertical] si présent
tagsToRemove?: string[]      // tags à retirer après upsert (best-effort)
```

2. Dans `buildContactPayload` ligne 154, utiliser l'override :
```ts
tags: [lead.tagOverride ?? VERTICAL_TAG[lead.vertical]],
```

3. Dans `postLeadToGHL` (ligne 227), après `created.body?.contact?.id`, ajouter la suppression de tags :
```ts
if (contactId && lead.tagsToRemove && lead.tagsToRemove.length > 0) {
  // GHL DELETE /contacts/{id}/tags — best-effort, on log si fail mais on bloque pas
  const removeRes = await ghlRequest(apiKey, `/contacts/${contactId}/tags`, {
    method: 'DELETE',
    body: JSON.stringify({ tags: lead.tagsToRemove }),
  })
  if (!removeRes.ok) {
    console.warn(`[ghl-client] tag removal failed for ${contactId}:`, removeRes.error)
  }
}
```

**Note** : le body schema `{ tags: [...] }` pour DELETE est inféré par cohérence avec ADD. À valider en preview avec un test contact + curl avant prod. Si le body diffère, ajuster (Phase 2.4.b).

### Fichier modifié : [app/api/leads/route.ts](soumissionconfort/app/api/leads/route.ts)

**Lignes 204-230** (bloc `!isHVAC && !isSubvention && !isSoumissionRapide` = isolation V2) : ajouter les 3 fields V2 au mapping `custom` :

```ts
...(!isHVAC && !isSubvention && !isSoumissionRapide && {
  // ... existant V1 fields conservés (backward compat)
  // V2 fields — wired Phase 2 (IDs déjà dans GHL_FIELDS_ISO lignes 41-43)
  symptoms: Array.isArray(leadData.userAnswers?.symptoms)
    ? leadData.userAnswers.symptoms.join(',')
    : leadData.userAnswers?.symptoms,
  hydro_bracket: leadData.userAnswers?.hydroBracket,
  intent: leadData.userAnswers?.intent,
}),
```

**Avant `postLeadToGHL(ghlPayload)`** (ligne 249) : router le tag + planifier la suppression de l'opposé :

```ts
if (vertical === 'isolation' && leadData.userAnswers?.intent) {
  if (leadData.userAnswers.intent === 'qualified') {
    ghlPayload.tagOverride = 'Lead Iso Hot'
    ghlPayload.tagsToRemove = ['Lead Iso Curieux']  // override : on retire l'ancien statut curieux si présent
  } else if (leadData.userAnswers.intent === 'curious') {
    ghlPayload.tagOverride = 'Lead Iso Curieux'
    // Pas de tagsToRemove ici — si déjà qualifié, on garde Lead Iso Hot (downgrade vers curieux = rare et on préfère ne pas perdre l'info)
  }
}
```

> Edge case : si un contact qualifié revient et clique curieux → on garde `Lead Iso Hot` (pas de removal). Décision arbitraire (assomption : une fois qualifié, toujours qualifié). À discuter si Zack veut le comportement inverse.

### Backward compat fields V1

Les fields V1 (`isolation_actuelle`, `acces_entretoit`, `systeme_de_chauffage`, `problemes_identifies`) **continuent** d'être écrits avec leurs V1 defaults (Phase 1 a câblé `'electricite' / 'partielle' / 'facile'`). Les workflows GHL existants qui dépendent de ces champs ne cassent pas. Les nouveaux V2 fields s'ajoutent à côté.

---

## Traçabilité — chaque réponse du funnel V2 vers GHL (champ-par-champ)

Confirmation explicite : chaque info que le user fournit dans le funnel `/analysis` a un chemin garanti vers GHL en Phase 2.

| Étape | Question / Info | Variable code | Field GHL (sub-account Iso `7gpshI6Ger307wy0gSRU`) | Field ID | Comment écrit |
|---|---|---|---|---|---|
| **Homepage** | Adresse autocomplete | `address` (URL param) | `Ville` + `Code Postal` + `Adresse` (champ contact natif) | `EMvUAfCd1nfK92XOFwWg` (ville), `p6fMlu1tddxVmL4i0FSN` (CP), natif | Déjà câblé Phase 1 (parsing depuis adresse Google Places). Confirmé via `app/api/leads/route.ts:132-149` + 174-177. |
| **Wizard Q1** | Symptômes (multi-select, 1-7 cochés) | `v2Answers.symptoms` (string[]) | `Symptoms` (TEXT, CSV) | `ZPE3HqwuNU2UFMPJoFLP` | **Phase 2** ajout dans `app/api/leads/route.ts` bloc isolation : `symptoms: leadData.userAnswers.symptoms.join(',')` → ex `"hydro_up,cold_winter,drafts"`. |
| **Wizard Q2** | Bracket facture Hydro (1 sélection) | `v2Answers.hydroBracket` | `Hydro Bracket` (TEXT) | `09Yv7GFbSI63gpw2dnMS` | **Phase 2** ajout : `hydro_bracket: leadData.userAnswers.hydroBracket` → ex `"125_200"`. |
| **Wizard Q3** | Intent (qualifié/curieux) | `v2Answers.intent` | `Intent` (TEXT) | `TXLCBATiEunuBmhBfiPk` | **Phase 2** ajout : `intent: leadData.userAnswers.intent` → `"qualified"` ou `"curious"`. |
| **Lead form** | Prénom | `firstName` | `firstName` (champ contact natif GHL) | natif | Déjà câblé Phase 1 (`ghlPayload.firstName`). |
| **Lead form** | Nom | `lastName` | `lastName` (natif) | natif | Déjà câblé Phase 1. |
| **Lead form** | Courriel | `email` | `email` (natif) | natif | Déjà câblé Phase 1. |
| **Lead form** | Téléphone | `phone` | `phone` (natif, format E.164) | natif | Déjà câblé Phase 1 (normalisé par `normalizePhone`). |
| **Système** | Pricing 3-tier généré | `pricingData.ranges.{economique,standard,premium}.totalCost.{min,max}` | `Econo - Prix min/max`, `Standard - Prix min/max`, `Premium - Prix min/max` (6 fields NUMERICAL) | `cWppmyPcMVWcVLwKxMCR`, `Soof0hnOH7S8i6NUE0ce`, `QpUhBlUPZzXONoEKdMIQ`, `YcnckovWf0PTjDrMQQcN`, `sAAdL21LGBrzhkM9F0XQ`, `2UI5mQyBd0XiVTgeUCOM` | Déjà câblé Phase 1. |
| **Système** | Données roof-analysis | `roofData.{roofArea, buildingHeight, pitchComplexity, obstacles, segments, usableArea, accessDifficulty, roofShape}` | `Superficie total`, `Hauteur du batiment`, `Complexite pente`, `Obstacles`, `Nb segments toiture`, `Surface utilisable`, `Difficulte acces`, `Forme du toit` (8 fields) | `jF5Z4GbAd3sU07GDn5sh`, `Pgf8Y8PuZJrHyPC2i2kI`, `9sNa4ZxBmzClRrnqutJD`, `iBXckfYmOfTmBg3DiZL8`, `9BewnDwPRCR4YB9AMdIQ`, `Nruym6OYXwH0N5lC26GG`, `SZ47se1OmmZods3muSJR`, `E2QSWv69HkQJuas2o4bM` | Déjà câblé Phase 1. |
| **Système** | UTM + attribution | `utmParams.{utm_source, utm_campaign, utm_content, utm_medium, fbclid}` + `landingPage` | `UTM Source`, `Campaign Name`, `Ad Name`, `fbclid`, `Landing Page`, `Lead Source` (6 fields) | `PGJTGfRsDp4ZnBmINzVO`, `uzf5PgMaRV67z7IpI9kT`, `PIWz9wyYpNE8YzgN8IrP`, `c3HEuK4wMPoMxQP36Uzl`, `WmUBBdtaVnnrUA1A0jh3`, `ckqcPkIu73xuG1OMkZzh` | Déjà câblé Phase 1. |
| **Système** | Coordonnées GPS | `roofData.coordinates.{lat, lng, province}` | `Latitude`, `Longitude`, `Province` (3 fields TEXT) | `ZMWiwWMjby6YaJwncCj5`, `ws8VSXNw4b51F5dSuhx4`, `7o3FvYluyCMQKB1zjFgV` | Déjà câblé Phase 1. |
| **Système (V1 backward compat)** | Heating system (default 'electricite'), Current insulation (default 'partielle'), Attic access (default 'facile'), Problèmes V1 (mapped from V2 symptoms) | `userAnswers.heatingSystem/currentInsulation/atticAccess/identifiedProblems` | `Systeme de chauffage`, `Isolation actuelle`, `Acces entretoit`, `Problemes identifies` (4 fields TEXT) | `MKyNDO2uDbGxYSbYp7qw`, `9di5URhx4SplO59qhUCh`, `xtFWNuPCvibxk3oc7eDR`, `LWQ1sDv3KlJJxO3XpmDU` | Déjà câblé Phase 1. Conservés Phase 2 pour ne pas casser workflows GHL existants. |
| **Tag GHL** | Statut qualification | dérivé de `userAnswers.intent` | tag contact (pas un custom field) | n/a | **Phase 2** : `Lead Iso Hot` si qualifié OU `Lead Iso Curieux` si curieux, via `tagOverride` dans NormalizedLead. Override curieux→qualifié retire `Lead Iso Curieux`. |
| **Lead ID** | Identifiant unique lead | `leadId` (généré client `LEAD<ts><random>`) | source du contact GHL | n/a | Déjà câblé Phase 1 (`internalLeadId: leadId`). Stocké aussi dans payload pour traçabilité. |

### Vérification visuelle pendant les tests

Pendant le **Test 1** (lead qualifié OTP enabled, cf section "Tests Phase 2"), ouvrir le contact dans l'UI GHL sub-account Iso et vérifier que **chaque ligne du tableau ci-dessus est présente**. Si un field est vide ou absent → flag immédiatement avant merge.

Champ critique de Phase 2 à valider en priorité : `Symptoms`, `Hydro Bracket`, `Intent` (les 3 nouveaux V2). Les autres sont déjà testés Phase 1.

---

## Phase 2.5 — Retirer `CompleteRegistration`

### Fichier modifié : [app/soumission-rapide/merci/page.tsx](soumissionconfort/app/soumission-rapide/merci/page.tsx)

Lignes ~70-78 : supprimer le bloc :
```ts
window.fbq("track", "CompleteRegistration", {
  content_name: "soumission-rapide-isolation",
  currency: "CAD",
})
```

Funnel inactif → impact prod nul. Vérifier qu'il n'y a pas d'appel CAPI `CompleteRegistration` ailleurs (`grep -ri CompleteRegistration soumissionconfort/`).

---

## Phase 2.6 — Documentation env vars

### Fichier modifié : [ENV_VARIABLES.md](soumissionconfort/ENV_VARIABLES.md)

Ajouter une section sous `# META / FACEBOOK` :

```markdown
# Pixel dédié soumissionconfort (funnel /analysis V2)
NEXT_PUBLIC_META_PIXEL_ID_SOUMISSIONCONFORT=<pixel ID>
META_CONVERSION_ACCESS_TOKEN_SOUMISSIONCONFORT=<token CAPI>
META_TEST_EVENT_CODE_SOUMISSIONCONFORT=  # optionnel — tests events Manager
```

Avec commentaire : « Utilisé uniquement par le funnel /analysis. Les autres funnels (/thermopompes, /subventions, /soumission-rapide) continuent sur NEXT_PUBLIC_META_PIXEL_ID. »

---

## Tests Phase 2

### Test 1 — Lead qualifié, OTP enabled (path prod principal)

1. `cd soumissionconfort && npm run dev -- -p 3001`
2. Homepage → entrer adresse → click "Obtenir mon estimation gratuite" → **Network tab** : `POST /api/meta/view-content` 200 ; **Meta Events Manager** (sur le pixel dédié, en test mode) : ViewContent reçu eventId X (browser fbq + CAPI dedupé).
3. Loading → wizard Q1 → Q2 → Q3 intent **qualifié** → lead form → submit → redirect `/verifier-telephone`.
4. Recevoir SMS → entrer code → POST `/api/leads` 200 → **Meta Events Manager** : `Lead` browser + CAPI tous deux reçus, eventId Y identique, service_type=isolation. Dedup OK.
5. **GHL UI sub-account Iso** : nouveau contact avec tag `Lead Iso Hot`, custom fields `Symptoms`, `Hydro Bracket`, `Intent=qualified` remplis + V1 defaults toujours présents.

### Test 2 — Lead curieux, OTP enabled

1-3. Idem mais intent **curieux**.
4. Confirmer OTP → POST `/api/leads` 200. **Meta Events Manager** : `Lead` **PAS reçu** (ni browser ni CAPI). ViewContent toujours là.
5. **GHL** : contact avec tag `Lead Iso Curieux`, `Intent=curious`.

### Test 3 — Override tag : curieux → qualifié

1. Faire 1 lead curieux avec email X → tag `Lead Iso Curieux` posé.
2. Refaire 1 lead qualifié avec **le même email X** (upsert → même contact).
3. **GHL UI** : le contact a maintenant **uniquement `Lead Iso Hot`** (`Lead Iso Curieux` retiré via DELETE).
4. Vérifier dans Vercel logs : `[ghl-client] tag removal failed` **ne doit pas** apparaître.

### Test 4 — Non-régression `/thermopompes`, `/subventions`

1. Lead `/thermopompes` complet → vérifier que Meta Lead CAPI est toujours envoyé **sur l'ancien pixel** (`NEXT_PUBLIC_META_PIXEL_ID`, pas le nouveau). Tag GHL `Lead HVAC` inchangé.
2. Pareil `/subventions`. Aucun appel vers le pixel soumissionconfort.

### Test 5 — Garde-fou placeholder

1. `.env.local` : `NEXT_PUBLIC_META_PIXEL_ID_SOUMISSIONCONFORT=XXXXXX`.
2. Restart dev → lead qualifié → console : `[view-content] skip` + `[leads] skip Meta CAPI Lead — soumissionconfort pixel/token is placeholder`. Pas de call vers `graph.facebook.com`. Pas de crash.

### Test 6 — TypeScript + build

- `cd soumissionconfort && npx tsc --noEmit` clean.
- Kill dev avant : `npm run build` succès (cf gotcha CLAUDE.md global — ne pas build avec dev actif).

### Test 7 — CompleteRegistration grep clean

- `grep -ri "CompleteRegistration" soumissionconfort/` → résultat vide.

---

## Fichiers touchés (récap)

| Fichier | Type | Changement clé |
|---|---|---|
| [lib/meta-config.ts](soumissionconfort/lib/meta-config.ts) | modif | Ajout `META_CONFIG_SOUMISSIONCONFORT` + `isSoumissionConfortMetaConfigured()` |
| [components/meta-pixel-router.tsx](soumissionconfort/components/meta-pixel-router.tsx) | **nouveau** | Composant client qui détecte `usePathname()` et charge soit le pixel actuel soit le pixel dédié selon la route. Charge UN SEUL pixel à la fois. |
| [app/layout.tsx](soumissionconfort/app/layout.tsx) | modif | Retirer le `<Script>` Meta Pixel inline (lignes 166-195). Remplacer par `<MetaPixelRouter />`. |
| [app/verifier-telephone/page.tsx](soumissionconfort/app/verifier-telephone/page.tsx) | modif | Fire Lead post-OTP gated intent qualifié + même eventId que CAPI (cf Phase 2.3) |
| [lib/meta-conversion-api.ts](soumissionconfort/lib/meta-conversion-api.ts) | modif | Refactor `trackViewContent` pour accepter `eventId` + `clientIp/userAgent/sourceUrl` |
| [app/page.tsx](soumissionconfort/app/page.tsx) | modif | Dans `navigateToAnalysis()` : fire browser fbq ViewContent + POST `/api/meta/view-content` avec eventId partagé. Adapter aussi l'appel `trackViewContent('Homepage'…)` à la nouvelle signature. |
| [app/api/meta/view-content/route.ts](soumissionconfort/app/api/meta/view-content/route.ts) | **nouveau** | Endpoint CAPI ViewContent → pixel dédié soumissionconfort |
| [components/lead-capture-form.tsx](soumissionconfort/components/lead-capture-form.tsx) | modif | Retirer fbq Lead client (lignes 124-137). Stash `pending.meta = { intent, estimatedValue }`. Path non-OTP : Lead fire APRÈS `/api/leads` succès, gated `qualified`. |
| [app/verifier-telephone/page.tsx](soumissionconfort/app/verifier-telephone/page.tsx) | modif | Après `submitDeferredLead` OK : fire `fbq('Lead', ...)` gated intent qualifié, même eventId que CAPI |
| [app/api/leads/route.ts](soumissionconfort/app/api/leads/route.ts) | modif | (1) Pixel ID/token = soumissionconfort pour vertical='isolation'. (2) Gate `trackLead` par `intent === 'qualified'` (isolation seul). (3) Ajout `symptoms`, `hydro_bracket`, `intent` au `custom` GHL. (4) `tagOverride` = `Lead Iso Hot`/`Lead Iso Curieux` + `tagsToRemove` pour override curieux→qualifié. |
| [lib/ghl-client.ts](soumissionconfort/lib/ghl-client.ts) | modif | Ajout `tagOverride?` + `tagsToRemove?` à `NormalizedLead`. Use dans `buildContactPayload`. Best-effort DELETE `/contacts/{id}/tags` après upsert si `tagsToRemove`. |
| [app/soumission-rapide/merci/page.tsx](soumissionconfort/app/soumission-rapide/merci/page.tsx) | modif | Retirer `fbq("track", "CompleteRegistration", ...)` |
| [ENV_VARIABLES.md](soumissionconfort/ENV_VARIABLES.md) | modif | Documenter les 3 nouvelles env vars soumissionconfort |

---

## Hors scope Phase 2 (consigné pour suite)

- **Migration autres funnels (`/thermopompes`, `/subventions`, `/soumission-rapide`) vers pixel soumissionconfort** : non touché.
- **Copy CTA différenciée selon intent sur `InsulationResults`** : Zack a tranché « même copy ».
- **Make webhook columns V2** : branche legacy bypassée en prod, non câblée.
- **Suppression V1 defaults dans payload `/api/leads`** : conservés pour backward compat GHL workflows.
- **Pricing 3-tier dégradation V2** : déjà acceptée Phase 1, pas re-touché.
- **Second `<Script>` Pixel browser dédié sur `/analysis*`** : à confirmer avec Zack (cf question ouverte). Si Zack veut « Lead browser ET CAPI tous les deux sur le pixel dédié soumissionconfort » → ajouter un composant `<MetaPixelSoumissionConfort />` monté sur les pages `/analysis*` et `/verifier-telephone`. Si non → ViewContent + Lead browser restent sur le pixel global, seul CAPI part sur le pixel dédié (sub-optimal pour dedup).

---

## Vérifications avant PR Phase 2

- [ ] Tests 1-7 ci-dessus tous OK en local + Vercel preview
- [ ] `npx tsc --noEmit` clean
- [ ] `npm run build` succès
- [ ] PR Phase 2 ouverte vs **`feat/analysis-funnel-v2`** (PAS `main`), body explique le lien avec PR #20
- [ ] Code review Claude + Codex via `/commit-push-pr`
- [ ] **Merge final** : Zack créé manuellement le workflow GHL `Lead Iso Hot` → stage "New Lead Hot". PR Phase 1 + Phase 2 mergées dans `main` ensemble.

---

## Décisions verrouillées avec Zack (finales)

1. **Pixel actuel (Niku)** : désactivé sur `/analysis*` + `/verifier-telephone`. Sert toujours homepage + thermopompes + subventions + soumission-rapide comme aujourd'hui.
2. **Pixel dédié soumissionconfort** : chargé uniquement sur `/analysis*` + `/verifier-telephone` via `<MetaPixelRouter />` (composant client qui détecte `usePathname()`). PageView + ViewContent (wizard mount) + Lead (post-OTP qualifié) tous envoyés à ce pixel uniquement.
3. **Pixel ownership Meta** : le pixel dédié est créé dans le **Business Manager Meta de soumissionconfort** (séparé du Business Manager qui héberge le pixel actuel). Audiences cloisonnées par construction.
4. **Test Event Code** : `META_TEST_EVENT_CODE_SOUMISSIONCONFORT` configuré en `.env.local` + Vercel preview. Permet de tester en Events Manager → Test Events sans polluer le live. Le code est ignoré automatiquement en prod (garde-fou existant dans `lib/meta-conversion-api.ts:293-297`).
5. **Garde-fou placeholder XXXXXX** : **strict, pas de fallback**. Si `NEXT_PUBLIC_META_PIXEL_ID_SOUMISSIONCONFORT` = placeholder → `MetaPixelRouter` retourne `null` sur `/analysis*` + `/verifier-telephone` → aucun pixel browser chargé sur le funnel. CAPI server skip aussi (`isSoumissionConfortMetaConfigured()` = false). Pas de pollution du pixel actuel pendant la transition.
6. **Homepage** : reste sur le pixel actuel (statu quo). Le pixel dédié ne charge qu'à partir de `/analysis`. Audience pixel dédié = users qui ont vraiment cliqué pour commencer l'estimation iso (pas les bounces homepage).
7. **`isTest` gate** : si `leadData.isTest === true` arrive dans `/api/leads`, le Meta CAPI Lead skip silencieusement (`console.log('[leads] skip Meta CAPI Lead — isTest=true')`). Permet replay/debug Make ou Postman sans polluer Meta. Documenter dans le PR.
8. **Override tag GHL** : sens unique. Curieux → qualifié retire `Lead Iso Curieux`. Qualifié → curieux **ne retire pas** `Lead Iso Hot` (une fois qualifié, toujours qualifié).

## P0 fixes intégrés (adversarial review)

- **P0-1** : `keepalive: true` sur le fetch ViewContent CAPI (sinon event perdu au `router.push`).
- **P0-2** : route group `(analysis-funnel)/layout.tsx` pour monter le pixel dédié **une seule fois** (sinon double init + double PageView).
- **P0-3** : `leadPayload.eventId` reste top-level pour que `/verifier-telephone` puisse le réutiliser et déduper browser Lead ↔ CAPI Lead.

## Question à valider en preview (mini-fix éventuel)

- **Body schema `DELETE /contacts/{id}/tags`** : inféré `{ tags: [string] }` par cohérence avec ADD. Doc officielle ne le confirme pas explicitement. À tester en preview avec un curl manuel sur un contact test avant prod. Si schema diffère (ex : `?tag=X` query param), mini-fix à appliquer dans `lib/ghl-client.ts`.

Sources :
- [HighLevel API Remove Tags](https://marketplace.gohighlevel.com/docs/ghl/contacts/remove-tags)
- [HighLevel API Add Tags](https://marketplace.gohighlevel.com/docs/ghl/contacts/add-tags/index.html)
