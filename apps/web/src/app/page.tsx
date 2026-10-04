import { redirect } from 'next/navigation'
import { type Provider, SignIn } from '@/components/sign-in'
import { Wordmark } from '@/components/ui'
import { currentUser } from '@/lib/auth'
import { env } from '@/lib/env'

export default async function Home() {
  if (await currentUser()) redirect('/dashboard')
  const config = env()
  const providers: Provider[] = [
    ...(config.github ? (['github'] as const) : []),
    ...(config.google ? (['google'] as const) : []),
  ]
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-8 px-6 py-16">
      <div className="flex flex-col gap-3">
        <Wordmark />
        <h1 className="text-2xl font-semibold tracking-tight">
          Traffic for every project you run, on one page.
        </h1>
        <p className="text-sm text-muted">No cookies, no stored IP addresses, no consent banner.</p>
      </div>
      <SignIn providers={providers} demo={config.demoLogin} />
    </main>
  )
}
