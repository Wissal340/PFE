'use client'

import Link from 'next/link'
import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { loginUser, setToken } from '../../lib/api'

export default function LoginPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()

    try {
      setLoading(true)
      setError('')

      const data = await loginUser({ email, password })

      if (!data?.access_token) {
        setError('Réponse login invalide')
        return
      }

      setToken(data.access_token)
      window.dispatchEvent(new Event('storage'))
      router.push('/')
      router.refresh()
    } catch (err) {
      console.error(err)
      setError('Email ou mot de passe incorrect')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0b1020] text-slate-100 px-4">

      {/* Container */}
      <div className="w-full max-w-5xl overflow-hidden rounded-[28px] border border-blue-900/30 bg-gradient-to-r from-[#0f172a] via-[#111c44] to-[#0b1020] shadow-[0_20px_60px_rgba(0,0,0,0.45)]">

        {/* Header */}
        <div className="border-b border-white/10 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600/20 ring-1 ring-blue-400/30">
              <span className="text-lg font-bold text-blue-300">S</span>
            </div>

            <div>
              <div className="text-lg font-semibold text-slate-50">
                Smart Screen AI
              </div>
              <div className="text-xs text-slate-400">
                Secure access
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="grid gap-8 px-6 py-10 md:px-10 lg:grid-cols-2">

          {/* Left side */}
          <div className="flex flex-col justify-center">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">
              Welcome back
            </p>

            <h1 className="mt-4 text-4xl font-bold text-white">
              Connexion à votre dashboard
            </h1>

            <p className="mt-4 text-slate-300">
              Accédez à la supervision de vos écrans, aux alertes temps réel
              et à la gestion intelligente de vos contenus.
            </p>

            <div className="mt-6 space-y-3 text-sm text-slate-400">
              <div className="rounded-2xl border border-slate-800 bg-[#0f172a] p-3">
                Monitoring temps réel des devices
              </div>
              <div className="rounded-2xl border border-slate-800 bg-[#0f172a] p-3">
                Gestion des playlists intelligentes
              </div>
              <div className="rounded-2xl border border-slate-800 bg-[#0f172a] p-3">
                Alertes et analyse automatique
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="rounded-3xl border border-slate-800 bg-[#111827]/95 p-6 shadow-[0_10px_40px_rgba(0,0,0,0.35)]">

            <h2 className="text-xl font-semibold text-white">
              Se connecter
            </h2>

            <p className="mt-1 text-sm text-slate-400">
              Entrez vos identifiants
            </p>

            <form onSubmit={handleLogin} className="mt-6 space-y-4">

              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl bg-[#0f172a] border border-slate-700 px-4 py-3 text-slate-100 placeholder:text-slate-500"
              />

              <input
                type="password"
                placeholder="Mot de passe"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl bg-[#0f172a] border border-slate-700 px-4 py-3 text-slate-100 placeholder:text-slate-500"
              />

              <button
                type="submit"
                disabled={loading || !email || !password}
                className="w-full rounded-xl bg-blue-600 px-4 py-3 text-white transition hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Connexion...' : 'Se connecter'}
              </button>

              {error && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                  {error}
                </div>
              )}
            </form>

            <p className="mt-6 text-sm text-slate-400">
              Pas encore de compte ?{' '}
              <Link
                href="/signup"
                className="font-medium text-blue-400 hover:underline"
              >
                S'inscrire
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}