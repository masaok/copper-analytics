'use client'

import { useTransition } from 'react'
import { Button } from '@/components/ui'
import { deleteProject } from './actions'

export function DeleteProject({ siteKey, name }: { siteKey: string; name: string }) {
  const [pending, start] = useTransition()
  return (
    <Button
      variant="danger"
      disabled={pending}
      onClick={() => {
        if (window.confirm(`Delete ${name} and all of its traffic data? This cannot be undone.`)) {
          start(() => deleteProject(siteKey))
        }
      }}
    >
      Delete project
    </Button>
  )
}
