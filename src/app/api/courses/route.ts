import { NextResponse } from 'next/server'
import { crmFetch, CrmConfigError } from '@/lib/crm'

// The course list changes rarely, so don't hit the CRM on every page load.
export const revalidate = 300

export interface PublicCourse {
  id: string
  /** the CRM's own course name — what the lead and the WhatsApp message carry */
  name: string
  /**
   * What the dropdown shows, when the campaign calls the course something
   * other than the CRM does. Absent means the two agree.
   */
  label?: string
}

/**
 * Only these appear in the apply form. The CRM holds many more courses, but
 * the scholarship is offered on these two.
 *
 * `match` is compared case-insensitively as a substring of the CRM course
 * name, since the real names are live data entered in the admin UI and usually
 * carry a suffix ("Python Full Stack"). Filtering by id would be sturdier, but
 * the ids only exist in the production database.
 *
 * `label` renames the course for this campaign only. The scholarship sells the
 * Python track as "Coding C-Kit", but the lead has to reach the CRM under the
 * name the CRM knows — so the rename stops at the dropdown and `name` is what
 * travels with the application.
 *
 * The order here is the order shown in the dropdown.
 */
const ALLOWED: { match: string; label?: string }[] = [
  { match: 'epic marketing' },
  { match: 'python', label: 'Coding C-Kit' },
]

function allowed(courses: PublicCourse[]): PublicCourse[] {
  const picked: PublicCourse[] = []
  const seen = new Set<string>()
  for (const { match, label } of ALLOWED) {
    for (const c of courses) {
      if (seen.has(c.id)) continue
      if (c.name.toLowerCase().includes(match)) {
        picked.push(label ? { ...c, label } : c)
        seen.add(c.id)
      }
    }
  }
  return picked
}

function isCourse(v: unknown): v is PublicCourse {
  if (typeof v !== 'object' || v === null) return false
  const c = v as Record<string, unknown>
  return typeof c.id === 'string' && typeof c.name === 'string'
}

export async function GET() {
  try {
    const { status, body } = await crmFetch('/api/public/courses', {
      method: 'GET',
      next: { revalidate },
    })

    if (status !== 200) {
      console.error('[courses] CRM responded', status, body)
      return NextResponse.json(
        { error: 'Could not load the course list.' },
        { status: 502 },
      )
    }

    // Re-shape rather than passing the CRM payload straight through, so a
    // change on their side can't quietly start feeding unexpected fields
    // into the form.
    const raw = (body as { data?: unknown })?.data
    const all = Array.isArray(raw)
      ? raw.filter(isCourse).map(({ id, name }) => ({ id, name }))
      : []

    const data = allowed(all)

    // If the allowlist matches nothing the dropdown would be empty and the
    // form unusable, so log what the CRM actually returned — the names there
    // are what ALLOWED needs to match.
    if (all.length > 0 && data.length === 0) {
      console.error(
        '[courses] allowlist matched none of:',
        all.map((c) => c.name).join(', '),
      )
    }

    return NextResponse.json({ data })
  } catch (err) {
    if (err instanceof CrmConfigError) {
      console.error('[courses]', err.message)
      return NextResponse.json({ error: 'Not configured.' }, { status: 503 })
    }
    console.error('[courses]', err)
    return NextResponse.json(
      { error: 'Could not load the course list.' },
      { status: 502 },
    )
  }
}
