import type { Metadata } from 'next'
import { Shell } from '@/components/shell'
import { createProject } from '@/features/projects/actions'
import { ProjectForm } from '@/features/projects/project-form'
import { requireUser } from '@/lib/auth'

export const metadata: Metadata = { title: 'New project' }

export default async function NewProject() {
  const user = await requireUser()
  return (
    <Shell user={user}>
      <h1 className="mb-6 text-xl font-semibold tracking-tight">Add a project</h1>
      <ProjectForm action={createProject} submitLabel="Create project" />
    </Shell>
  )
}
