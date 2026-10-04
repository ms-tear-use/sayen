import { useState } from 'react'
import Button from '../components/Button'
import ErrorMessage from '../components/ErrorMessage'
import Input from '../components/Input'
import { useAuth } from '../features/auth/hooks'
import { friendlyError } from '../lib/errors'

export default function Login() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')

    try {
      await login(email, password)
    } catch (submitError) {
      setError(friendlyError(submitError, "That email or password doesn't look right."))
      setSubmitting(false)
    }
  }

  return (
    <main className="login">
      <h1>sayen</h1>
      <p className="tagline">a little space to share.</p>

      <form className="stack-form" onSubmit={handleSubmit}>
        <Input
          id="email"
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <Input
          id="password"
          label="Password"
          type="password"
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        <ErrorMessage message={error} />
        <Button type="submit" disabled={submitting}>
          {submitting ? 'logging in...' : 'log in'}
        </Button>
      </form>
    </main>
  )
}
