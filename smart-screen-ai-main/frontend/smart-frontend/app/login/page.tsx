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
    <div className="flex min-h-screen items-center justify-center bg-slate-100">
      <div className="w-full max-w-md rounded-2xl border bg-white p-6 shadow-sm">
        <h1 className="mb-2 text-2xl font-bold">Connexion</h1>
        <p className="mb-6 text-sm text-slate-500">
          Accédez au dashboard Smart Screen AI
        </p>

        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border px-4 py-3 outline-none"
          />

          <input
            type="password"
            placeholder="Mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border px-4 py-3 outline-none"
          />

          <button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full rounded-xl bg-slate-900 px-4 py-3 text-white disabled:opacity-50"
          >
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>

          {error && (
            <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}
        </form>

        <p className="mt-4 text-sm text-slate-600">
          Vous n’avez pas de compte ?{' '}
          <Link href="/signup" className="font-medium text-slate-900 underline">
            S'inscrire
          </Link>
        </p>
      </div>
    </div>
  )
}