/**
 * Campaign constants. WHATSAPP_NUMBER is the contact number published on
 * betterinu.com (user-confirmed 2026-08-07) — swap it here if the scholarship
 * runs on a different line; every CTA and the form handoff read from this one
 * constant.
 */
export const WHATSAPP_NUMBER = '918714156256'
export const CONTACT_EMAIL = 'contact@betterinu.com'

export function waLink(text?: string): string {
  const base = `https://wa.me/${WHATSAPP_NUMBER}`
  return text ? `${base}?text=${encodeURIComponent(text)}` : base
}


//mn,mnmnm,nm,n,mnm,nm,nm,n,m
export interface Track {
  id: 'epic' | 'coding'
  name: string
  hook: string
  items: string[]
}

export const TRACKS: Track[] = [
  {
    id: 'epic',
    name: 'EPIC Marketing',
    hook: 'For the ones who can make a phone screen stop mid-scroll.',
    items: ['Digital marketing', 'Graphic design', 'Video editing'],
  },
  {
    id: 'coding',
    name: 'Coding C-Kit',
    hook: 'For the ones who’d rather build the app than just use it.',
    items: ['Python full stack', 'MERN stack'],
  },
]

export function applicationMessage(data: {
  name: string
  phone: string
  /** Optional — the line is dropped entirely when blank. */
  email?: string
  course: string
  place: string
}): string {
  return [
    'Hi Betterinu! I’m applying for the Talent Scholarship 2026.',
    '',
    `Name: ${data.name}`,
    `WhatsApp: ${data.phone}`,
    ...(data.email?.trim() ? [`Email: ${data.email.trim()}`] : []),
    `Course: ${data.course}`,
    `Place: ${data.place}`,
  ].join('\n')
}
