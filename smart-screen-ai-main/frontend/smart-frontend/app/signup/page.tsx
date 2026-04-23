'use client'

import Link from 'next/link'
import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { registerUser } from '../../lib/api'

export default function SignupPage() {
  const router = useRouter()

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('viewer')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSignup(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()

    try {
      setLoading(true)
      setError('')
      setSuccess('')

      await registerUser({
        full_name: fullName,
        email,
        password,
        role,
      })

      setSuccess('Compte créé - en attente validation admin')

      setTimeout(() => {
        router.push('/login')
      }, 1500)
    } catch (err) {
      console.error(err)
      setError("Erreur lors de l'inscription")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0b1020] text-slate-100 px-4">

      <div className="w-full max-w-5xl rounded-[28px] border border-blue-900/30 bg-gradient-to-r from-[#0f172a] via-[#111c44] to-[#0b1020] shadow-[0_20px_60px_rgba(0,0,0,0.45)]">

        {/* HEADER */}
        <div className="border-b border-white/10 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600/20 ring-1 ring-blue-400/30">
              <span className="text-lg font-bold text-blue-300">S</span>
            </div>

            <div>
              <div className="text-lg font-semibold text-white">
                Smart Screen AI
              </div>
              <div className="text-xs text-slate-400">
                Create account
              </div>
            </div>
          </div>
        </div>

        {/* CONTENT */}
        <div className="grid gap-8 px-6 py-10 md:px-10 lg:grid-cols-2">

          {/* LEFT */}
          <div className="flex flex-col justify-center">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">
              Join platform
            </p>

            <h1 className="mt-4 text-4xl font-bold text-white">
              Créer un compte
            </h1>

            <p className="mt-4 text-slate-300">
              Votre compte sera validé par un administrateur avant activation.
            </p>
          </div>

          {/* FORM */}
          <div className="rounded-3xl border border-slate-800 bg-[#111827]/95 p-6">

            <form onSubmit={handleSignup} className="space-y-4">

              <input
                type="text"
                placeholder="Nom complet"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-xl bg-[#0f172a] border border-slate-700 px-4 py-3"
              />

              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl bg-[#0f172a] border border-slate-700 px-4 py-3"
              />

              <input
                type="password"
                placeholder="Mot de passe"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl bg-[#0f172a] border border-slate-700 px-4 py-3"
              />

              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full rounded-xl bg-[#0f172a] border border-slate-700 px-4 py-3"
              >
                <option value="viewer">Viewer</option>
                <option value="technicien">Technicien</option>
                <option value="admin">Admin</option>
              </select>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-blue-600 py-3 text-white hover:bg-blue-700"
              >
                {loading ? 'Création...' : "S'inscrire"}
              </button>

              {error && (
                <div className="text-red-400 text-sm">{error}</div>
              )}

              {success && (
                <div className="text-green-400 text-sm">{success}</div>
              )}
            </form>

            <p className="mt-6 text-sm text-slate-400">
              Déjà un compte ?{' '}
              <Link href="/login" className="text-blue-400">
                Se connecter
              </Link>
            </p>

          </div>
        </div>
      </div>
    </div>
  )
}