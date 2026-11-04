import { requireUser } from '@/lib/auth'
import Docs from '../../docs/page'

export { metadata } from '../../docs/page'

/** The public docs inside the signed-in dashboard, so every sidebar item lives under /dashboard. */
export default async function DashboardDocs() {
  await requireUser()
  return <Docs />
}
