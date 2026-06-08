# Soumission Confort — Funnel de génération de leads ISOLATION

## ⚠️ RÈGLE #1 — MODÈLE D'AFFAIRES ACTUEL (lire en premier)

**On génère des leads d'isolation POUR NOUS. On ne vend PAS les leads.**

Flow réel :
1. Le propriétaire remplit l'estimation gratuite (funnel `/`)
2. Le lead tombe dans notre GHL (sub-account ISO « Powerflo eco assistance »)
3. Nos **setters** appellent et qualifient
4. Nos **closers/inspecteurs** vont closer la job sur place
5. L'exécution est **sous-traitée** à une compagnie partenaire

**❌ ANCIEN MODÈLE — MORT, NE JAMAIS REPRODUIRE :**
On NE vend PLUS les leads à des entrepreneurs. La vente à « 3 entrepreneurs » /
« réseau d'entrepreneurs qui reçoivent le lead » est **terminée**.

🚩 **Si tu vois du code ou du copy qui mentionne** « vendre à des entrepreneurs »,
« 3 soumissions d'entrepreneurs », « réseau d'entrepreneurs qui reçoivent vos leads » →
**c'est l'ancien modèle = une erreur. SIGNALE-LE à Zack immédiatement, ne le reproduis pas.**

## ⚠️ RÈGLE #2 — FOCUS UNIQUE : ISOLATION

Le seul vertical actif est **l'isolation**. Tout le reste est **sur pause** :
- **Toiture** → pause (projet séparé `soumissiontoiture/`)
- **Thermopompes** (`/thermopompes`) → sur pause, NE PAS toucher
- **Subventions** (`/subventions`) → pas lancé, on s'en fout, NE PAS toucher

**Ne travaille QUE sur l'isolation**, sauf si Zack dit explicitement
« OK on ouvre [thermopompe/toiture/subvention] ». Sinon → on n'y touche pas.

## Identité

- **Marque publique** (ce que le client voit, capte les leads) : **Soumission Confort**
- Tout ce qui touche l'isolation est sous le nom **Soumission Confort**.
- Domaine prod : **www.soumissionconfort.com** (l'app Vercel `soumission-confort-ai`).
  ⚠️ L'apex nu `soumissionconfort.com` = parking GoDaddy, **PAS** l'app (redirect→www en
  cours, autre session) — ne jamais le linker/tester. Org `nicolas-bedards-projects` /
  `team_fziEOfxreOXkC8LY2Yg1K3Je`.

## Le funnel ACTIF (isolation)

Parcours réel (confirmé par analytics, 7 derniers jours) :

```
/  (home, estimation gratuite)
  → /analysis  (analyse satellite de la superficie)
  → /verifier-telephone  (OTP SMS)
  → /pricing  (estimé affiché)
  → /success  (conversion = lead capté dans GHL)
```

CTA partout : **« Obtenir mon estimation gratuite »**.
Ordre de grandeur (7j) : ~427 visiteurs sur `/`, ~22 conversions (`/success`).

## Où vont les leads (GHL)

Dispatch par `vertical` dans `lib/ghl-client.ts` :
- `isolation` / `isolation_soumission_rapide` / `subvention` → sub-account
  **« Powerflo eco assistance »** (le sub-account ISO : `GHL_LOCATION_ID_ISO`,
  `GHL_API_KEY_ISO`), tag **« Lead Iso »**
- `hvac` / `roofing` → legacy « Powerflow Leads » (`GHL_LOCATION_ID`) — **inactif**

Le lead passe aussi par Meta Conversion API (`lib/meta-conversion-api.ts`).
Validation OTP obligatoire avant écriture CRM si `NEXT_PUBLIC_OTP_ENABLED=true`.

## ⚠️ Pages ORPHELINES / dette technique (déployées mais MORTES)

Héritées du template Toiture lors de la copie. Existent dans le code, **0 trafic,
0 lead, rien ne les lie au funnel actif** :

| Route | Statut | Note |
|---|---|---|
| `/pour-entrepreneurs` + `/api/contractor-leads` | 🚩 Legacy ancien modèle | Recrutait des entrepreneurs. À supprimer (pas urgent, capte 0 lead) |
| `/soumission-rapide` + `/soumission-rapide/[ville]` | Mort | Pas de `middleware.ts` côté Confort → aucune redirection ville. Pages ville jamais câblées |
| `/thermopompes` | Pause | Ne pas toucher |
| `/subventions` | Pas lancé | Ne pas toucher |
| `/urgence-toiture`, `/couvreur-shawinigan` | Résidus Toiture | Hors scope isolation |

**Note middleware :** contrairement à Toiture, Confort **n'a pas** de `middleware.ts`.
Le système de géo-redirection par ville (IP → `/soumission-rapide/[ville]`) n'existe
QUE sur Toiture. Sur Confort il n'a jamais été câblé.

## Stack

Next.js (App Router) + React + Tailwind. Déployé sur Vercel.
`@vercel/analytics` activé (pageviews par route via API web-analytics).
Google Places (autocomplete adresse) + Google Solar (superficie toiture).

## Lire l'analytics (trafic par route)

Le trafic par route vient de l'API Vercel Web Analytics (pas du CLI). Token local :
`~/Library/Application Support/com.vercel.cli/auth.json`. Endpoint :
`vercel.com/api/web-analytics/stats?type=path&filter=%7B%7D&environment=production`
+ `from`/`to` en ISO + `teamId=team_fziEOfxreOXkC8LY2Yg1K3Je` + `projectId`.

## Gotcha — Vérifier le Meta Pixel en navigation SPA

Pour valider le comportement du pixel, tester via la VRAIE navigation client
(clic CTA → `router.push`), PAS juste des full-page loads (`browser_navigate`).
`fbevents.js` auto-fire un PageView sur chaque `history.pushState` — invisible
en full-load ET en audit statique, visible seulement en nav SPA réelle.
Désactivé via `fbq.disablePushState=true` (avant `fbq('init')`). Vérifier en
capturant les requêtes `facebook.com/tr` (param `ev=` et `id=`).

## Gotcha — Whitespace dans les env Meta (incident 2026-06-03)

Toujours trimmer les pixel id/token lus de `process.env` (`(x||'').trim()` —
déjà fait dans `meta-config.ts`, `meta-pixel-router.tsx`, `api/leads`). Un `\n`
final collé dans une var Vercel `NEXT_PUBLIC_*` est **inliné au build** → `fbq`
cible `"<id>\n"` (console `Pixel <id> not found`, 0 `tr`) ET le CAPI POST sur
`/…%0A/events` → **tracking mort SANS erreur visible, les 2 canaux d'un coup**.
- **Diag** : capter `facebook.com/tr` (param `id=`) + console `fbevents` sur le
  VRAI prod ; comparer la valeur prod via `vercel env pull` + `od -c` (le `pull`
  peut trimmer l'affichage — la source de vérité = le bundle live / la console).
- **« Lead » en FR dans Meta = « Prospect ».** Si "aucun Lead", chercher la
  ligne **Prospect** dans Events Manager, pas "Lead".
- **Vérif CAPI sans polluer** : POST synthétique → `graph.facebook.com/v18.0/
  <id>/events` (Bearer token) avec `test_event_code` → `events_received:1` prouve
  pixel id + token valides. Le token CAPI ne peut PAS lire le dataset (`/stats` =
  Missing Permission) → recovery réelle = Events Manager UI.
