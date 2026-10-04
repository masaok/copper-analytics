import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Shell } from '@/components/shell'
import { updateProject } from '@/features/projects/actions'
import { DeleteProject } from '@/features/projects/delete-project'
import { ProjectForm } from '@/features/projects/project-form'
import { getOwnedProject } from '@/features/projects/queries'
import { Snippet } from '@/features/projects/snippet'
import { snippetFor } from '@/features/projects/snippet-code'
import { requireUser } from '@/lib/auth'
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

  return (
    <Shell user={user}>
      <p className="mb-1 text-sm text-muted">
        <Link href="/dashboard" className="hover:underline">
          All projects
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
