"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  CheckCircle, 
  Star, 
  Users, 
  TrendingUp, 
  Shield, 
  Clock,
  DollarSign,
  Award,
  Phone,
  Mail,
  MapPin,
  Zap
} from "lucide-react"

export default function PourEntrepreneursPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    companyName: "",
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    rbqNumber: "",
    serviceArea: "",
    yearsExperience: "",
    message: ""
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    
    try {
      const response = await fetch('/api/contractor-leads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })
      
      if (!response.ok) {
        throw new Error('Failed to submit')
      }
      
      setIsSubmitted(true)
      
      // Redirect to success page after 2 seconds
      setTimeout(() => {
        router.push('/success?type=contractor')
      }, 2000)
      
    } catch (error) {
      console.error('Error submitting contractor lead:', error)
      alert('Une erreur est survenue. Veuillez réessayer.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const isFormValid = formData.companyName && formData.firstName && formData.lastName && 
                      formData.email && formData.phone && formData.rbqNumber

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-[#fffff6] flex items-center justify-center px-4">
        <div className="text-center max-w-2xl">
          <div className="w-20 h-20 bg-[#b9e15c]/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-12 h-12 text-[#002042]" />
          </div>
          <h1 className="text-4xl font-heading font-bold text-[#10002c] mb-4">Merci de votre intérêt!</h1>
          <p className="text-xl text-[#375371]">
            Notre équipe examinera votre demande et vous contactera sous peu.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#fffff6]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#fffff6] border-b border-[#e8e8e0]">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between max-w-7xl">
          <a href="/" className="flex items-center gap-3">
            <img src="/images/logo-icon.svg" alt="" className="h-7 md:h-[48px] w-auto" />
            <div className="font-heading font-bold text-[#002042] leading-[0.9] tracking-[-0.04em] text-[18px] md:text-[26px] whitespace-nowrap">
              <p>Soumission</p>
              <p>Confort</p>
            </div>
          </a>
          <nav className="hidden md:flex items-center space-x-8">
            <a href="/" className="text-[#375371] hover:text-[#002042] font-medium transition-colors">
              Accueil
            </a>
            <a href="#avantages" className="text-[#375371] hover:text-[#002042] font-medium transition-colors">
              Avantages
            </a>
            <a href="#formulaire" className="text-[#375371] hover:text-[#002042] font-medium transition-colors">
              Rejoignez-nous
            </a>
          </nav>
        </div>
      </header>

      {/* Hero Section with Lead Form */}
      <section className="relative bg-[#fffff6] overflow-hidden py-12 md:py-20">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-start">

            {/* Left Side - Value Proposition */}
            <div className="text-[#10002c]">
              <Badge className="bg-[#b9e15c] text-[#002042] border-[#002042] px-4 py-2 text-sm font-medium rounded-full mb-6">
                Réseau #1 au Québec
              </Badge>

              <h1 className="text-4xl sm:text-5xl md:text-6xl font-heading font-bold mb-6 leading-tight text-[#10002c]">
                Développez votre entreprise avec{' '}
                <span className="text-[#002042]">Soumission Confort</span>
              </h1>

              <p className="text-xl text-[#375371] font-serif-body mb-8">
                Rejoignez notre réseau d'entrepreneurs certifiés et recevez des leads qualifiés pour vos projets d'isolation.
              </p>

              {/* Key Benefits */}
              <div className="space-y-4 mb-8">
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 bg-[#b9e15c]/30 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <CheckCircle className="w-5 h-5 text-[#002042]" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-[#10002c]">Leads qualifiés</h3>
                    <p className="text-[#375371]">Recevez uniquement des clients prêts à démarrer leurs projets</p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 bg-[#aedee5]/40 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <TrendingUp className="w-5 h-5 text-[#002042]" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-[#10002c]">Augmentez votre chiffre d'affaires</h3>
                    <p className="text-[#375371]">Accédez à un flux constant de nouveaux projets</p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 bg-[#b9e15c]/30 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <Zap className="w-5 h-5 text-[#002042]" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-[#10002c]">Aucun frais fixe</h3>
                    <p className="text-[#375371]">Payez uniquement pour les leads que vous acceptez</p>
                  </div>
                </div>
              </div>

              {/* Social Proof */}
              <div className="flex flex-wrap items-center gap-6 pt-6 border-t border-[#e8e8e0]">
                <div className="flex items-center space-x-2">
                  <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                  <span className="font-bold text-lg text-[#10002c]">4.9/5</span>
                  <span className="text-[#375371] text-sm">(150+ entrepreneurs)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Users className="w-5 h-5 text-[#002042]" />
                  <span className="font-semibold text-[#375371]">800+ projets complétés</span>
                </div>
              </div>
            </div>

            {/* Right Side - Lead Form */}
            <div id="formulaire" className="lg:sticky lg:top-24">
              <Card className="bg-white border border-[#f2f2f7] rounded-[20px] shadow-md overflow-hidden">
                <div className="bg-[#002042] text-white p-6 text-center">
                  <h2 className="text-2xl md:text-3xl font-heading font-bold mb-2">
                    Rejoignez notre réseau
                  </h2>
                  <p className="text-[#aedee5]">
                    Commencez à recevoir des leads dès aujourd'hui
                  </p>
                </div>
                
                <CardContent className="p-6 md:p-8">
                  <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Company Name */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Nom de l'entreprise *
                      </label>
                      <input
                        type="text"
                        name="companyName"
                        value={formData.companyName}
                        onChange={handleInputChange}
                        required
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                        placeholder="Votre entreprise"
                      />
                    </div>

                    {/* Name Fields */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Prénom *
                        </label>
                        <input
                          type="text"
                          name="firstName"
                          value={formData.firstName}
                          onChange={handleInputChange}
                          required
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                          placeholder="Jean"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Nom *
                        </label>
                        <input
                          type="text"
                          name="lastName"
                          value={formData.lastName}
                          onChange={handleInputChange}
                          required
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                          placeholder="Tremblay"
                        />
                      </div>
                    </div>

                    {/* Email */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Email professionnel *
                      </label>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        required
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                        placeholder="contact@entreprise.com"
                      />
                    </div>

                    {/* Phone */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Téléphone *
                      </label>
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        required
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                        placeholder="514-555-0123"
                      />
                    </div>

                    {/* RBQ Number */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Numéro RBQ *
                      </label>
                      <input
                        type="text"
                        name="rbqNumber"
                        value={formData.rbqNumber}
                        onChange={handleInputChange}
                        required
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                        placeholder="1234-5678-90"
                      />
                    </div>

                    {/* Service Area */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Région desservie
                      </label>
                      <input
                        type="text"
                        name="serviceArea"
                        value={formData.serviceArea}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                        placeholder="Ex: Montréal, Laval, Rive-Sud"
                      />
                    </div>

                    {/* Years Experience */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Années d'expérience
                      </label>
                      <select
                        name="yearsExperience"
                        value={formData.yearsExperience}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                      >
                        <option value="">Sélectionnez</option>
                        <option value="0-2">0-2 ans</option>
                        <option value="3-5">3-5 ans</option>
                        <option value="6-10">6-10 ans</option>
                        <option value="10+">10+ ans</option>
                      </select>
                    </div>

                    {/* Message */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Message (optionnel)
                      </label>
                      <textarea
                        name="message"
                        value={formData.message}
                        onChange={handleInputChange}
                        rows={3}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all resize-none"
                        placeholder="Parlez-nous de votre entreprise..."
                      />
                    </div>

                    {/* Submit Button */}
                    <Button
                      type="submit"
                      disabled={!isFormValid || isSubmitting}
                      className="w-full bg-[#b9e15c] border-2 border-[#002042] text-[#002042] font-serif-body font-bold py-4 px-8 rounded-full shadow-[-2px_4px_0_0_#002042] hover:shadow-[-1px_2px_0_0_#002042] hover:translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-y-0 text-lg"
                    >
                      {isSubmitting ? (
                        <span className="flex items-center justify-center">
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                          Envoi en cours...
                        </span>
                      ) : (
                        'Rejoindre le réseau'
                      )}
                    </Button>

                    {/* Trust Indicators */}
                    <div className="flex items-center justify-center space-x-4 pt-2 text-sm text-gray-500">
                      <div className="flex items-center space-x-1">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <span>Gratuit</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Shield className="w-4 h-4 text-green-600" />
                        <span>Sécurisé</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Clock className="w-4 h-4 text-green-600" />
                        <span>Réponse rapide</span>
                      </div>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section id="avantages" className="py-16 md:py-24 bg-white">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Pourquoi rejoindre Soumission Confort?
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Nous vous connectons avec des clients qualifiés qui recherchent activement des services d'isolation
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Benefit 1 */}
            <Card className="border-2 border-gray-100 hover:border-teal-200 hover:shadow-xl transition-all duration-300">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 bg-teal-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Users className="w-8 h-8 text-teal-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">
                  Leads Qualifiés
                </h3>
                <p className="text-gray-600">
                  Tous nos leads sont pré-qualifiés et prêts à recevoir des soumissions. Concentrez-vous sur ce que vous faites de mieux.
                </p>
              </CardContent>
            </Card>

            {/* Benefit 2 */}
            <Card className="border-2 border-gray-100 hover:border-blue-200 hover:shadow-xl transition-all duration-300">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <DollarSign className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">
                  Tarification Transparente
                </h3>
                <p className="text-gray-600">
                  Aucun frais caché. Payez uniquement pour les leads que vous acceptez. Modèle simple et équitable.
                </p>
              </CardContent>
            </Card>

            {/* Benefit 3 */}
            <Card className="border-2 border-gray-100 hover:border-purple-200 hover:shadow-xl transition-all duration-300">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Award className="w-8 h-8 text-purple-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">
                  Support Dédié
                </h3>
                <p className="text-gray-600">
                  Notre équipe est là pour vous aider à réussir. Support technique et commercial disponible.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-16 md:py-24 bg-[#fffff6]">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Comment ça fonctionne?
            </h2>
            <p className="text-xl text-gray-600">
              Un processus simple en 4 étapes
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-8">
            {/* Step 1 */}
            <div className="text-center">
              <div className="w-16 h-16 bg-teal-600 text-white rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
                1
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Inscription</h3>
              <p className="text-gray-600 text-sm">
                Remplissez le formulaire et notre équipe validera votre profil
              </p>
            </div>

            {/* Step 2 */}
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
                2
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Recevez des leads</h3>
              <p className="text-gray-600 text-sm">
                Accédez aux projets correspondant à votre zone de service
              </p>
            </div>

            {/* Step 3 */}
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-600 text-white rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
                3
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Contactez le client</h3>
              <p className="text-gray-600 text-sm">
                Présentez votre soumission et décrochez le contrat
              </p>
            </div>

            {/* Step 4 */}
            <div className="text-center">
              <div className="w-16 h-16 bg-green-600 text-white rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
                4
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Réalisez le projet</h3>
              <p className="text-gray-600 text-sm">
                Complétez le travail et recevez votre paiement
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 md:py-24 bg-[#002042] text-white">
        <div className="container mx-auto px-4 max-w-4xl text-center">
          <h2 className="text-3xl md:text-5xl font-heading font-bold mb-6">
            Prêt à développer votre entreprise?
          </h2>
          <p className="text-xl md:text-2xl text-[#aedee5] mb-8">
            Rejoignez les 150+ entrepreneurs qui font confiance à Soumission Confort
          </p>
          <a href="#formulaire">
            <Button className="bg-[#b9e15c] border-2 border-[#002042] text-[#002042] font-serif-body font-bold py-4 px-8 rounded-full shadow-[-2px_4px_0_0_#aedee5] text-lg">
              Rejoindre maintenant
            </Button>
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <h3 className="text-lg font-bold mb-4">Contact</h3>
              <div className="space-y-2 text-gray-400">
                <div className="flex items-center space-x-2">
                  <Mail className="w-4 h-4" />
                  <span>pro@soumissionconfort.com</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Phone className="w-4 h-4" />
                  <span>1-800-CONFORT</span>
                </div>
              </div>
            </div>
            <div>
              <h3 className="text-lg font-bold mb-4">Liens rapides</h3>
              <ul className="space-y-2 text-gray-400">
                <li><a href="/" className="hover:text-white transition-colors">Accueil</a></li>
                <li><a href="#avantages" className="hover:text-white transition-colors">Avantages</a></li>
                <li><a href="#formulaire" className="hover:text-white transition-colors">Rejoignez-nous</a></li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-bold mb-4">Horaires</h3>
              <p className="text-gray-400">
                Lundi - Vendredi<br />
                9h00 - 17h00
              </p>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2025 Soumission Confort. Tous droits réservés.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
