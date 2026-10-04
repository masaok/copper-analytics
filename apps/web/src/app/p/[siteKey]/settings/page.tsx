import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Shell } from '@/components/shell'
import { buttonClass } from '@/components/ui'
import { rotateApiToken, updateProject } from '@/features/projects/actions'
import { ApiToken } from '@/features/projects/api-token'
import { DeleteProject } from '@/features/projects/delete-project'
import { ProjectForm } from '@/features/projects/project-form'
import { getOwnedProject } from '@/features/projects/queries'
import { Snippet } from '@/features/projects/snippet'
import { snippetFor } from '@/features/projects/snippet-code'
import { requireUser } from '@/lib/auth'
import { liveSource } from '@/lib/buffer'
import { env } from '@/lib/env'

export const metadata: Metadata = { title: 'Project settings' }

export default async function Settings({
  params,
  searchParams,
}: PageProps<'/p/[siteKey]/settings'>) {
  const user = await requireUser()
  const { siteKey } = await params
  const project = await getOwnedProject(user.id, siteKey)
  if (!project) notFound()
  const created = (await searchParams).created === '1'
  const appUrl = env().BETTER_AUTH_URL
  const received = (await liveSource().today(siteKey)).pageviews

  return (
    <Shell user={user}>
      <p className="mb-1 flex gap-4 text-sm text-muted">
        <Link href="/dashboard" className="hover:underline">
          All projects
        </Link>
        <Link href={`/p/${project.siteKey}`} className="hover:underline">
          Dashboard
        </Link>
      </p>
      <h1 className="mb-8 text-xl font-semibold tracking-tight">{project.name}</h1>

      <section className="mb-10 flex flex-col gap-3">
        <h2 className="font-medium">Install</h2>
        <p className="max-w-xl text-sm text-muted">
          {created
            ? 'Your project is ready. Paste this into the <head> of every page you want counted.'
            : 'Paste this into the <head> of every page you want counted.'}
        </p>
        <Snippet code={snippetFor(appUrl, project.siteKey)} />
        <p className="text-sm" data-testid="verify-install">
          {received > 0 ? (
            <span className="text-patina">
              Installed: {received} {received === 1 ? 'pageview' : 'pageviews'} received since the
              last flush.
            </span>
          ) : (
            <span className="text-muted">
              No pageviews received in the last few minutes. Open your site in a browser, then{' '}
              <Link
                href={`/p/${project.siteKey}/settings`}
                className="text-ink underline underline-offset-4"
              >
                check again
              </Link>
              .
            </span>
          )}
        </p>
      </section>

      <section className="mb-10 flex flex-col gap-4">
        <h2 className="font-medium">Details</h2>
        <ProjectForm
          action={updateProject.bind(null, project.siteKey)}
          values={project}
          submitLabel="Save changes"
          showSharing
        />
        {project.isPublic ? (
          <p className="text-sm text-muted">
            Shared at{' '}
            <Link
              href={`/share/${project.siteKey}`}
              className="text-ink underline underline-offset-4"
            >
              {appUrl}/share/{project.siteKey}
            </Link>
          </p>
        ) : null}
      </section>

      <section className="mb-10 flex flex-col gap-3">
        <h2 className="font-medium">Stats API</h2>
        <p className="max-w-xl text-sm text-muted">
          Read this project's numbers from a script. The token is read-only and works for this
          project alone.
        </p>
        <ApiToken
          action={rotateApiToken.bind(null, project.siteKey)}
          hasToken={project.apiTokenHash !== null}
          example={`curl -H "Authorization: Bearer <token>" \\\n  "${appUrl}/api/v1/stats?site=${project.siteKey}&range=7d"`}
        />
      </section>

      <section className="mb-10 flex flex-col gap-3">
        <h2 className="font-medium">Export</h2>
        <p className="max-w-xl text-sm text-muted">Every stored day as a CSV file.</p>
        <div>
          <a href={`/p/${project.siteKey}/export.csv`} className={buttonClass('quiet')}>
            Download CSV
          </a>
        </div>
      </section>

      <section className="flex flex-col gap-3 border-t border-line pt-8">
        <h2 className="font-medium">Delete</h2>
        <p className="max-w-xl text-sm text-muted">
          Removes the project and every number recorded for it.
        </p>
        <div>
          <DeleteProject siteKey={project.siteKey} name={project.name} />
        </div>
      </section>
    </Shell>
  )
}
