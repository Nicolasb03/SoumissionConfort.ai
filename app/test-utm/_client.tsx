"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { getCurrentUTMParameters, extractUTMParameters, type UTMParameters } from "@/lib/utm-utils"
import { Code, RefreshCw, ExternalLink } from "lucide-react"

export default function TestUTMClient() {
  const [utmParams, setUtmParams] = useState<UTMParameters>({})
  const [urlParams, setUrlParams] = useState<UTMParameters>({})
  const [storedParams, setStoredParams] = useState<UTMParameters>({})

  const refreshParams = () => {
    // Get current URL params
    const currentUrl = extractUTMParameters()
    setUrlParams(currentUrl)

    // Get stored params
    const stored = getCurrentUTMParameters()
    setStoredParams(stored)

    // Get combined params
    const combined = getCurrentUTMParameters()
    setUtmParams(combined)
  }

  useEffect(() => {
    refreshParams()
  }, [])

  const testUrls = [
    {
      name: "Facebook Campaign",
      url: "?utm_source=facebook&utm_campaign=toiture2024&utm_content=hero-cta&utm_medium=social&utm_term=reparation-toit"
    },
    {
      name: "Google Ads",
      url: "?utm_source=google&utm_campaign=urgence-toiture&utm_content=ad-text&utm_medium=cpc&utm_term=fuite-toit-urgence"
    },
    {
      name: "Email Newsletter",
      url: "?utm_source=newsletter&utm_campaign=winter2024&utm_content=email-banner&utm_medium=email"
    }
  ]

  const simulateWebhook = async () => {
    const testPayload = {
      firstName: "Test",
      lastName: "UTM",
      email: "test@utm.com",
      phone: "514-123-4567",
      roofData: {
        address: "123 Test Street, Montreal, QC",
        roofArea: 1500,
        buildingHeight: 2
      },
      userAnswers: {
        roofAge: "5-15",
        roofMaterial: "asphalt",
        propertyAccess: "easy",
        serviceType: ["completeReplacement"],
        timeline: "soon",
        contactTime: "morning"
      },
      pricingData: {
        lowEstimate: 12000,
        highEstimate: 18000,
        materialType: "Standard",
        complexity: "moderate"
      },
      utmParams: utmParams
    }

    try {
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testPayload),
      })

      const result = await response.json()
      console.log('🧪 Test webhook response:', result)
      alert('Test webhook envoyé ! Vérifiez la console et Make.com pour les résultats.')
    } catch (error) {
      console.error('❌ Test webhook error:', error)
      alert('Erreur lors du test webhook. Vérifiez la console.')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">🧪 Test des Paramètres UTM</h1>
          <p className="text-xl text-gray-600">
            Testez la capture et transmission des paramètres UTM publicitaires
          </p>
        </div>

        {/* Current URL and Parameters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Code className="w-5 h-5" />
              <span>URL Actuelle et Paramètres</span>
            </CardTitle>
            <CardDescription>
              URL: {typeof window !== 'undefined' ? window.location.href : 'Server-side rendering'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <h4 className="font-semibold text-sm text-gray-700 mb-2">URL Actuelle</h4>
                <div className="bg-gray-100 p-3 rounded-lg text-sm">
                  {Object.keys(urlParams).length > 0 ? (
                    Object.entries(urlParams).map(([key, value]) => (
                      <div key={key} className="flex justify-between">
                        <span className="font-mono text-blue-600">{key}:</span>
                        <span className="font-mono">{value}</span>
                      </div>
                    ))
                  ) : (
                    <span className="text-gray-500">Aucun paramètre UTM dans l'URL</span>
                  )}
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-sm text-gray-700 mb-2">SessionStorage</h4>
                <div className="bg-gray-100 p-3 rounded-lg text-sm">
                  {Object.keys(storedParams).length > 0 ? (
                    Object.entries(storedParams).map(([key, value]) => (
                      <div key={key} className="flex justify-between">
                        <span className="font-mono text-green-600">{key}:</span>
                        <span className="font-mono">{value}</span>
                      </div>
                    ))
                  ) : (
                    <span className="text-gray-500">Aucun paramètre stocké</span>
                  )}
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-sm text-gray-700 mb-2">Paramètres Finaux</h4>
                <div className="bg-blue-50 p-3 rounded-lg text-sm border border-blue-200">
                  {Object.keys(utmParams).length > 0 ? (
                    Object.entries(utmParams).map(([key, value]) => (
                      <div key={key} className="flex justify-between">
                        <span className="font-mono text-blue-700">{key}:</span>
                        <span className="font-mono font-semibold">{value}</span>
                      </div>
                    ))
                  ) : (
                    <span className="text-gray-500">Aucun paramètre UTM détecté</span>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 flex space-x-3">
              <Button onClick={refreshParams} variant="outline" size="sm">
                <RefreshCw className="w-4 h-4 mr-2" />
                Actualiser
              </Button>
              <Button onClick={simulateWebhook} className="bg-orange-600 hover:bg-orange-700">
                🧪 Tester le Webhook
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Test URLs */}
        <Card>
          <CardHeader>
            <CardTitle>🔗 URLs de Test</CardTitle>
            <CardDescription>
              Cliquez sur ces liens pour tester différents scénarios UTM
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {testUrls.map((test, index) => (
                <div key={index} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div>
                    <h4 className="font-semibold text-gray-900">{test.name}</h4>
                    <code className="text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded">
                      {test.url}
                    </code>
                  </div>
                  <Button 
                    onClick={() => window.location.href = test.url}
                    variant="outline"
                    size="sm"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Tester
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>📋 Instructions de Test</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
              <li>Cliquez sur un des liens de test ci-dessus pour ajouter des paramètres UTM à l'URL</li>
              <li>Vérifiez que les paramètres sont correctement détectés dans les sections ci-dessus</li>
              <li>Cliquez sur "Tester le Webhook" pour simuler une soumission de lead</li>
              <li>Vérifiez dans Make.com que les paramètres UTM sont bien reçus dans les colonnes T, U, V, W, X</li>
              <li>Testez la persistance en naviguant vers la page d'accueil puis en revenant ici</li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
