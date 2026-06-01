# Guide d'Implémentation - Calculateur d'Efficacité de Chauffage

Ce guide fournit les étapes concrètes pour implémenter le calculateur d'efficacité de chauffage dans SoumissionConfort.ai.

---

## 📋 Table des Matières

1. [Prérequis](#prérequis)
2. [Structure des Fichiers](#structure-des-fichiers)
3. [Étapes d'Implémentation](#étapes-dimplémentation)
4. [Exemples de Code](#exemples-de-code)
5. [Tests](#tests)
6. [Déploiement](#déploiement)

---

## Prérequis

- Node.js 18+
- Next.js 15.2.4
- Accès au repo SoumissionConfort.ai
- Connaissance de React, TypeScript, Tailwind CSS

---

## Structure des Fichiers

Créer la structure suivante dans le projet:

```
/app
  /efficacite-de-chauffage/
    page.tsx                    ← Page principale du calculateur
    
/app/api
  /heating-calculation/
    route.ts                    ← API endpoint pour calcul BTU
  /heating-recommendations/
    route.ts                    ← API endpoint pour recommandations

/lib
  heating-calculator.ts         ← Logique de calcul (voir heating-calculator.example.ts)
  climate-zones.ts              ← Données des zones climatiques
  heating-devices.ts            ← Base de données d'appareils

/components/heating
  room-input-form.tsx           ← Formulaire d'ajout de pièces
  house-summary.tsx             ← Résumé de la maison
  btu-display.tsx               ← Affichage des BTU calculés
  device-comparison.tsx         ← Comparaison des 3 options
  heating-results.tsx           ← Page de résultats complète
  heating-questionnaire.tsx     ← Questionnaire initial
```

---

## Étapes d'Implémentation

### Phase 1: Configuration de Base (Jour 1-2)

#### Étape 1.1: Créer la page principale

```bash
# Créer le dossier
mkdir -p app/efficacite-de-chauffage

# Créer la page
touch app/efficacite-de-chauffage/page.tsx
```

**Contenu de `page.tsx`:**

```typescript
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Calculator, Home, Zap } from "lucide-react"

export default function HeatingCalculatorPage() {
  const router = useRouter()
  const [address, setAddress] = useState("")

  const handleStart = () => {
    if (address) {
      router.push(`/efficacite-de-chauffage/questionnaire?address=${encodeURIComponent(address)}`)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50">
      {/* Header */}
      <header className="border-b bg-white/95 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <img 
              src="/images/logosoumissionconfort-1.png" 
              alt="Soumission Confort AI" 
              className="h-[120px] w-auto" 
            />
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-orange-100 rounded-full mb-6">
            <Calculator className="w-10 h-10 text-orange-600" />
          </div>
          
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Calculateur d'Efficacité de Chauffage
          </h1>
          
          <p className="text-xl text-gray-600 mb-8">
            Déterminez vos besoins en chauffage et obtenez des recommandations d'experts
          </p>

          {/* Address Input */}
          <Card className="max-w-2xl mx-auto shadow-xl">
            <CardContent className="p-8">
              <div className="flex flex-col md:flex-row gap-4">
                <Input
                  type="text"
                  placeholder="Entrez votre adresse complète"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="flex-1 text-lg"
                  onKeyPress={(e) => e.key === 'Enter' && handleStart()}
                />
                <Button 
                  onClick={handleStart}
                  size="lg"
                  className="bg-orange-600 hover:bg-orange-700"
                  disabled={!address}
                >
                  Commencer
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto mt-16">
          <Card>
            <CardHeader>
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mb-4">
                <Calculator className="w-6 h-6 text-orange-600" />
              </div>
              <CardTitle>Calcul Précis</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Calcul des BTU nécessaires basé sur 15+ facteurs incluant l'isolation, 
                les fenêtres, et la zone climatique
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mb-4">
                <Home className="w-6 h-6 text-orange-600" />
              </div>
              <CardTitle>Recommandations</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Obtenez 3 options (économique, standard, premium) avec nombre 
                d'appareils et coûts détaillés
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mb-4">
                <Zap className="w-6 h-6 text-orange-600" />
              </div>
              <CardTitle>Économies</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Estimez vos économies annuelles et la période de retour sur 
                investissement pour chaque option
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
```

#### Étape 1.2: Créer la bibliothèque de calcul

```bash
# Copier le fichier exemple
cp lib/heating-calculator.example.ts lib/heating-calculator.ts
```

#### Étape 1.3: Créer l'API de calcul

```bash
mkdir -p app/api/heating-calculation
touch app/api/heating-calculation/route.ts
```

**Contenu de `route.ts`:**

```typescript
import { NextResponse } from "next/server"
import { calculateHouseBTU, getClimateZoneFromCity } from "@/lib/heating-calculator"
import type { HouseData } from "@/lib/heating-calculator"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { houseData }: { houseData: HouseData } = body

    if (!houseData || !houseData.rooms || houseData.rooms.length === 0) {
      return NextResponse.json(
        { error: "Données de maison invalides" },
        { status: 400 }
      )
    }

    // Déterminer la zone climatique si pas fournie
    if (!houseData.climateZone) {
      houseData.climateZone = getClimateZoneFromCity(houseData.city)
    }

    // Calculer les BTU
    const result = calculateHouseBTU(houseData)

    return NextResponse.json({
      success: true,
      calculation: result,
      climateZone: houseData.climateZone
    })

  } catch (error) {
    console.error("[HEATING_CALCULATION]", error)
    return NextResponse.json(
      { error: "Erreur lors du calcul" },
      { status: 500 }
    )
  }
}
```

---

### Phase 2: Questionnaire et Saisie de Pièces (Jour 3-5)

#### Étape 2.1: Créer le questionnaire initial

```bash
mkdir -p components/heating
touch components/heating/heating-questionnaire.tsx
```

**Contenu minimal:**

```typescript
"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"

interface QuestionnaireProps {
  address: string
  onComplete: (data: any) => void
}

export function HeatingQuestionnaire({ address, onComplete }: QuestionnaireProps) {
  const [step, setStep] = useState(0)
  const [data, setData] = useState({
    houseAge: "",
    constructionType: "",
    totalFloors: "",
    basementType: "",
    atticType: ""
  })

  const questions = [
    {
      title: "Âge de la maison",
      field: "houseAge",
      type: "input",
      inputType: "number",
      placeholder: "Ex: 25"
    },
    {
      title: "Type de construction",
      field: "constructionType",
      type: "radio",
      options: [
        { value: "wood", label: "Bois" },
        { value: "brick", label: "Brique" },
        { value: "concrete", label: "Béton" },
        { value: "mixed", label: "Mixte" }
      ]
    },
    {
      title: "Nombre d'étages",
      field: "totalFloors",
      type: "radio",
      options: [
        { value: "1", label: "1 étage (plain-pied)" },
        { value: "2", label: "2 étages" },
        { value: "3", label: "3 étages ou plus" }
      ]
    },
    {
      title: "Type de sous-sol",
      field: "basementType",
      type: "radio",
      options: [
        { value: "none", label: "Aucun" },
        { value: "unfinished", label: "Non-aménagé" },
        { value: "finished", label: "Aménagé" }
      ]
    }
  ]

  const currentQuestion = questions[step]
  const canContinue = data[currentQuestion.field as keyof typeof data]

  const handleNext = () => {
    if (step < questions.length - 1) {
      setStep(step + 1)
    } else {
      onComplete(data)
    }
  }

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>{currentQuestion.title}</CardTitle>
        <p className="text-sm text-gray-500">
          Question {step + 1} sur {questions.length}
        </p>
      </CardHeader>
      <CardContent>
        {currentQuestion.type === "input" ? (
          <Input
            type={currentQuestion.inputType}
            placeholder={currentQuestion.placeholder}
            value={data[currentQuestion.field as keyof typeof data]}
            onChange={(e) => setData({ ...data, [currentQuestion.field]: e.target.value })}
          />
        ) : (
          <RadioGroup
            value={data[currentQuestion.field as keyof typeof data]}
            onValueChange={(value) => setData({ ...data, [currentQuestion.field]: value })}
          >
            {currentQuestion.options?.map((option) => (
              <div key={option.value} className="flex items-center space-x-2 p-3 border rounded hover:bg-gray-50">
                <RadioGroupItem value={option.value} id={option.value} />
                <Label htmlFor={option.value} className="flex-1 cursor-pointer">
                  {option.label}
                </Label>
              </div>
            ))}
          </RadioGroup>
        )}

        <div className="flex justify-between mt-6">
          <Button
            variant="outline"
            onClick={() => setStep(Math.max(0, step - 1))}
            disabled={step === 0}
          >
            Précédent
          </Button>
          <Button
            onClick={handleNext}
            disabled={!canContinue}
          >
            {step === questions.length - 1 ? "Continuer" : "Suivant"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
```

#### Étape 2.2: Créer le formulaire de saisie de pièces

```bash
touch components/heating/room-input-form.tsx
```

**Structure suggérée:**
- Formulaire pour ajouter une pièce à la fois
- Champs: nom, longueur, largeur, hauteur, étage
- Sélection de fenêtres et exposition
- Bouton "Ajouter une autre pièce"
- Liste des pièces ajoutées avec possibilité de modifier/supprimer

---

### Phase 3: Résultats et Recommandations (Jour 6-8)

#### Étape 3.1: Créer l'affichage des résultats BTU

```bash
touch components/heating/btu-display.tsx
```

**Fonctionnalités:**
- Afficher BTU total
- Graphique par pièce
- Graphique par étage
- Moyenne BTU/pi²

#### Étape 3.2: Créer le comparateur d'appareils

```bash
touch components/heating/device-comparison.tsx
```

**Afficher 3 colonnes:**
1. Option Économique (plinthes)
2. Option Standard (mini-splits)
3. Option Premium (thermopompe centrale)

Chaque colonne montre:
- Type d'appareil
- Nombre d'unités
- Coût total
- Coût d'installation
- Coût annuel d'opération
- Économies vs système actuel
- Période de retour sur investissement

#### Étape 3.3: Créer l'API de recommandations

```bash
mkdir -p app/api/heating-recommendations
touch app/api/heating-recommendations/route.ts
```

---

### Phase 4: Intégration et Polish (Jour 9-10)

#### Étape 4.1: Intégrer la capture de leads

Réutiliser `LeadCapturePopup` existant:

```typescript
import { LeadCapturePopup } from "@/components/lead-capture-popup"

// Dans votre composant de résultats
const [showLeadCapture, setShowLeadCapture] = useState(false)

const handleGetQuotes = () => {
  setShowLeadCapture(true)
}

const handleLeadSubmit = async (leadData: LeadData) => {
  // Envoyer les données à l'API
  await fetch('/api/leads', {
    method: 'POST',
    body: JSON.stringify({
      ...leadData,
      leadType: 'heating',
      houseData,
      btuCalculation,
      recommendations
    })
  })
}
```

#### Étape 4.2: Ajouter Analytics

```typescript
import { track } from '@vercel/analytics'

// Tracker les événements clés
track('Heating_Calculator_Started', { address })
track('Questionnaire_Completed', { houseAge, floors })
track('Rooms_Added', { count: rooms.length, totalArea })
track('BTU_Calculated', { totalBTU, avgBTUPerSqFt })
track('Recommendations_Viewed', { budget })
track('Lead_Captured', { leadId })
```

#### Étape 4.3: Optimiser l'UX

- Ajouter des tooltips explicatifs
- Ajouter des animations de transition
- Optimiser pour mobile
- Ajouter un mode "sauvegarde" (localStorage)
- Permettre de modifier les données avant calcul final

---

## Exemples de Code

### Exemple: Composant de Pièce

```typescript
interface RoomCardProps {
  room: RoomData
  onEdit: () => void
  onDelete: () => void
}

function RoomCard({ room, onEdit, onDelete }: RoomCardProps) {
  const area = room.length * room.width
  
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">{room.name}</CardTitle>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onEdit}>
            Modifier
          </Button>
          <Button variant="ghost" size="sm" onClick={onDelete}>
            Supprimer
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Dimensions:</span>
            <p className="font-medium">{room.length}' × {room.width}'</p>
          </div>
          <div>
            <span className="text-gray-500">Superficie:</span>
            <p className="font-medium">{area} pi²</p>
          </div>
          <div>
            <span className="text-gray-500">Étage:</span>
            <p className="font-medium">
              {room.floor === 0 ? 'Sous-sol' : 
               room.floor === 1 ? 'RDC' : 
               `Étage ${room.floor}`}
            </p>
          </div>
          <div>
            <span className="text-gray-500">Fenêtres:</span>
            <p className="font-medium">
              {room.hasWindows ? `${room.windowCount} ${room.windowSize}` : 'Aucune'}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
```

### Exemple: Affichage BTU

```typescript
function BTUDisplay({ calculation }: { calculation: BTUCalculationResult }) {
  return (
    <div className="space-y-6">
      {/* Total */}
      <Card className="bg-gradient-to-br from-orange-50 to-red-50">
        <CardContent className="p-8 text-center">
          <h3 className="text-lg text-gray-600 mb-2">BTU Total Nécessaire</h3>
          <p className="text-5xl font-bold text-orange-600">
            {formatBTU(calculation.totalBTU)}
          </p>
          <p className="text-gray-500 mt-2">
            Pour {formatArea(calculation.totalArea)}
          </p>
        </CardContent>
      </Card>

      {/* Par Étage */}
      <Card>
        <CardHeader>
          <CardTitle>Répartition par Étage</CardTitle>
        </CardHeader>
        <CardContent>
          {calculation.byFloor.map(floor => (
            <div key={floor.floor} className="flex justify-between items-center py-3 border-b last:border-0">
              <div>
                <p className="font-medium">
                  {floor.floor === 0 ? 'Sous-sol' : 
                   floor.floor === 1 ? 'Rez-de-chaussée' : 
                   `Étage ${floor.floor}`}
                </p>
                <p className="text-sm text-gray-500">
                  {floor.rooms} pièce{floor.rooms > 1 ? 's' : ''} • {formatArea(floor.area)}
                </p>
              </div>
              <p className="text-lg font-semibold text-orange-600">
                {formatBTU(floor.btu)}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
```

---

## Tests

### Tests Unitaires

```typescript
// __tests__/heating-calculator.test.ts

import { calculateRoomBTU, calculateHouseBTU } from '@/lib/heating-calculator'

describe('Heating Calculator', () => {
  test('calcule BTU pour une pièce simple', () => {
    const room = {
      id: '1',
      name: 'Salon',
      length: 15,
      width: 20,
      height: 8,
      floor: 1,
      hasWindows: true,
      windowCount: 2,
      windowSize: 'medium' as const,
      exposureDirection: 'south' as const,
      insulationQuality: 'good' as const
    }
    
    const result = calculateRoomBTU(room, 'montreal', 20, 'wood')
    
    expect(result.area).toBe(300)
    expect(result.btuRequired).toBeGreaterThan(0)
    expect(result.btuPerSqFt).toBeGreaterThan(40)
  })
  
  test('calcule BTU pour une maison complète', () => {
    const houseData = {
      address: '123 Rue Test, Montréal, QC',
      city: 'Montréal',
      province: 'QC',
      climateZone: 'montreal',
      rooms: [
        // ... rooms data
      ],
      totalFloors: 2,
      houseAge: 20,
      constructionType: 'wood' as const,
      basementType: 'finished' as const,
      atticType: 'none' as const
    }
    
    const result = calculateHouseBTU(houseData)
    
    expect(result.totalBTU).toBeGreaterThan(0)
    expect(result.roomResults).toHaveLength(houseData.rooms.length)
  })
})
```

### Tests d'Intégration

```bash
# Tester l'API
curl -X POST http://localhost:3000/api/heating-calculation \
  -H "Content-Type: application/json" \
  -d '{"houseData": {...}}'
```

---

## Déploiement

### Checklist Pré-Déploiement

- [ ] Tous les tests passent
- [ ] Code review complété
- [ ] Documentation à jour
- [ ] Variables d'environnement configurées
- [ ] Analytics configuré
- [ ] SEO optimisé (meta tags, sitemap)
- [ ] Performance testée (Lighthouse)
- [ ] Mobile responsive vérifié
- [ ] Accessibilité (WCAG) vérifiée

### Commandes de Déploiement

```bash
# Build local
npm run build

# Tester le build
npm run start

# Déployer sur Vercel
vercel --prod
```

### Post-Déploiement

1. Vérifier que la page est accessible: `https://soumissionconfort.com/efficacite-de-chauffage`
2. Tester le flow complet
3. Vérifier les analytics
4. Monitorer les erreurs (Sentry/Vercel)
5. Collecter feedback utilisateurs

---

## Améliorations Futures

### Phase 2
- [ ] Visualisation 3D de la maison
- [ ] Intégration Google Maps pour orientation automatique
- [ ] Export PDF des résultats
- [ ] Comparaison de scénarios multiples

### Phase 3
- [ ] Intégration programmes de subventions
- [ ] Calculateur de retour sur investissement avancé
- [ ] Recommandations d'isolation complémentaires
- [ ] Mode expert avec paramètres avancés

---

## Support et Ressources

### Documentation
- [Next.js Docs](https://nextjs.org/docs)
- [Radix UI](https://www.radix-ui.com/)
- [Tailwind CSS](https://tailwindcss.com/)

### Calculs de Chauffage
- [Guide ASHRAE](https://www.ashrae.org/)
- [Hydro-Québec - Efficacité énergétique](https://www.hydroquebec.com/residentiel/mieux-consommer/)
- [Rénoclimat](https://www.transitionenergetique.gouv.qc.ca/residentiel/programmes/renoclimat)

### Contact
- Email: support@soumissionconfort.com
- Documentation interne: `/docs`

---

**Dernière mise à jour:** 9 décembre 2024
