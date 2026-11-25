import { NextResponse, type NextRequest } from 'next/server'
import { crmFetch, CrmConfigError } from '@/lib/crm'
import { isValidMobile, normalizePhone } from '@/lib/phone'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

export async function POST(req: NextRequest) {
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const input = (raw ?? {}) as Record<string, unknown>

  // Rebuild the payload field by field instead of forwarding what we were
  // given. The CRM's lead schema also accepts assignedTo, status and
  // referralId — without this, anyone could POST here and assign leads to
  // staff or mark them converted.
  const payload = {
    name: str(input.name),
    phone: normalizePhone(str(input.phone)),
    // Optional. Sent as '' when blank; the CRM stores that as null.
    email: str(input.email),
    interestedCourseId: str(input.interestedCourseId),
    location: str(input.location),
  }

  if (
    payload.name.length < 2 ||
    !isValidMobile(payload.phone) ||
    !UUID.test(payload.interestedCourseId) ||
    payload.location.length < 2 ||
    (payload.email !== '' && !EMAIL.test(payload.email))
  ) {
    return NextResponse.json({ error: 'Please check your details.' }, { status: 400 })
  }

  // Pass the visitor's IP through so the CRM records the applicant rather
  // than this server. Omit the header entirely when we have nothing — an
  // empty one would just be discarded on the far side.
  const forwardedFor =
    req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip')

  try {
    const { status, body } = await crmFetch('/api/public/leads', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: forwardedFor ? { 'x-forwarded-for': forwardedFor } : {},
      cache: 'no-store',
    })

    if (status === 201 || status === 200) {
      return NextResponse.json({ ok: true }, { status: 201 })
    }

    // Don't leak the CRM's internal error text to the browser.
    console.error('[apply] CRM responded', status, body)
    return NextResponse.json(
      { error: 'We could not save your application. Please try again.' },
      { status: 502 },
    )
  } catch (err) {
    if (err instanceof CrmConfigError) {
      console.error('[apply]', err.message)
      return NextResponse.json({ error: 'Not configured.' }, { status: 503 })
    }
    console.error('[apply]', err)
    return NextResponse.json(
      { error: 'We could not save your application. Please try again.' },
      { status: 502 },
    )
  }
}
