# Variables d'Environnement Requises

## 📋 Configuration Complète

Créer un fichier `.env.local` à la racine du projet avec les variables suivantes:

```bash
# ============================================================================
# GOOGLE APIs
# ============================================================================

# Google Solar API (pour l'analyse des toits)
GOOGLE_SOLAR_API_KEY=votre_cle_google_solar_api

# Google Places API (pour l'autocomplete d'adresses)
GOOGLE_PLACES_API_KEY=votre_cle_google_places_api

# Note: Vous pouvez utiliser la même clé pour les deux si elle a accès aux deux APIs


# ============================================================================
# META / FACEBOOK
# ============================================================================

# Meta Pixel ID (pour le tracking)
NEXT_PUBLIC_META_PIXEL_ID=votre_pixel_id

# Meta Conversion API (optionnel, pour le tracking serveur)
META_CONVERSION_API_TOKEN=votre_token_conversion_api
META_PIXEL_ID=votre_pixel_id


# ============================================================================
# CRM / WEBHOOKS
# ============================================================================

# Webhook pour les leads (ex: Make.com, Zapier, etc.)
WEBHOOK_URL=https://votre-webhook-url.com/endpoint


# ============================================================================
# OTP / TWILIO VERIFY
# ============================================================================

# Required when NEXT_PUBLIC_OTP_ENABLED=true. The server signs short-lived
# JWTs proving the OTP step succeeded; /api/leads rejects any submission
# whose token is missing, expired, or bound to a different phone number.
# Generate with: openssl rand -hex 32  (must be 32+ chars)
OTP_SIGNING_SECRET=

# Toggle the OTP-first flow (frontend pages defer /api/leads until OTP succeeds
# on /verifier-telephone). Both sides must agree; leave as 'true' in prod.
NEXT_PUBLIC_OTP_ENABLED=true

# Twilio Verify credentials (required when OTP is enabled)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_VERIFY_SERVICE_SID=


# ============================================================================
# AUTRES
# ============================================================================

# URL de base de l'application (production)
NEXT_PUBLIC_BASE_URL=https://soumissionconfort.com

# Mode de développement
NODE_ENV=development
```

---

## 🔑 Comment Obtenir les Clés

### Google Solar API & Places API

1. **Google Cloud Console**: https://console.cloud.google.com/
2. **Créer un projet** (si pas déjà fait)
3. **Activer les APIs**:
   - Solar API: https://console.cloud.google.com/apis/library/solar.googleapis.com
   - Places API: https://console.cloud.google.com/apis/library/places-backend.googleapis.com
4. **Créer une clé API**:
   - APIs & Services → Credentials
   - Create Credentials → API Key
5. **Restreindre la clé** (recommandé):
   - HTTP referrers: `localhost:3000/*`, `soumissionconfort.com/*`
   - API restrictions: Sélectionner "Solar API" et "Places API"

### Meta Pixel ID

1. **Meta Business Suite**: https://business.facebook.com/
2. **Events Manager** → Pixels
3. **Créer un pixel** (si pas déjà fait)
4. **Copier le Pixel ID** (nombre à 15 chiffres)

### Meta Conversion API Token

1. **Events Manager** → Pixels
2. **Sélectionner votre pixel**
3. **Settings** → Conversions API
4. **Generate Access Token**
5. **Copier le token**

### Webhook URL

Dépend de votre CRM:
- **Make.com**: Créer un scénario → Webhook → Copier l'URL
- **Zapier**: Créer un Zap → Webhooks → Copier l'URL
- **Custom**: Votre propre endpoint

---

## 🚀 Déploiement sur Vercel

### Ajouter les Variables

1. **Vercel Dashboard**: https://vercel.com/dashboard
2. **Sélectionner le projet**
3. **Settings** → Environment Variables
4. **Ajouter chaque variable**:
   - Name: `GOOGLE_PLACES_API_KEY`
   - Value: `votre_cle`
   - Environments: ✅ Production ✅ Preview ✅ Development
5. **Redéployer** l'application

### Variables Publiques (NEXT_PUBLIC_*)

Les variables préfixées par `NEXT_PUBLIC_` sont exposées au client (navigateur).
Utilisez-les uniquement pour des données non-sensibles (ex: Pixel ID).

---

## ✅ Vérification

### Test Local

```bash
# 1. Créer .env.local avec les variables
# 2. Redémarrer le serveur
npm run dev

# 3. Tester l'autocomplete
# Ouvrir http://localhost:3000
# Taper une adresse dans le champ
# Vérifier que les suggestions apparaissent
```

### Test Production

```bash
# 1. Ajouter les variables dans Vercel
# 2. Redéployer
vercel --prod

# 3. Tester sur le site
# Ouvrir https://soumissionconfort.com
# Taper une adresse
# Vérifier les suggestions
```

---

## 🔒 Sécurité

### ⚠️ NE JAMAIS COMMITER

- ❌ `.env.local` (contient les clés secrètes)
- ❌ `.env` (si utilisé)
- ❌ Fichiers avec des tokens/clés

### ✅ À COMMITER

- ✅ `.env.local.example` (sans les vraies valeurs)
- ✅ `ENV_VARIABLES.md` (ce fichier)
- ✅ Documentation

### Vérifier .gitignore

Assurez-vous que `.gitignore` contient:

```
# Environment variables
.env
.env.local
.env.*.local
```

---

## 📝 Checklist de Configuration

- [ ] Fichier `.env.local` créé
- [ ] `GOOGLE_SOLAR_API_KEY` ajoutée
- [ ] `GOOGLE_PLACES_API_KEY` ajoutée
- [ ] Solar API activée dans Google Cloud
- [ ] Places API activée dans Google Cloud
- [ ] Restrictions de clé configurées
- [ ] Variables ajoutées dans Vercel (si production)
- [ ] Serveur redémarré après modification
- [ ] Test de l'autocomplete effectué
- [ ] Meta Pixel configuré (si utilisé)
- [ ] Webhook configuré (si utilisé)

---

**Dernière mise à jour**: 10 décembre 2024
