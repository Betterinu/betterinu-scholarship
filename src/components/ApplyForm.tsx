'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { AnimatePresence, motion, type Variants } from 'framer-motion'
import { applicationMessage, waLink } from '@/lib/site'
import { isValidMobile, normalizePhone } from '@/lib/phone'
import { trackEvent } from '@/lib/pixel'
import { ArrowRight, CheckIcon } from './icons'
import FlipFadeText from './FlipFadeText'
import Reveal from './motion/Reveal'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'

type FieldName = 'name' | 'phone' | 'email' | 'course' | 'place'
type Errors = Partial<Record<FieldName, string>>

interface Course {
  id: string
  /** the CRM's course name — this is what the lead and the WhatsApp message carry */
  name: string
  /**
   * Campaign-facing name, when it differs from the CRM's. Set for the Python
   * track, which the scholarship sells as "Coding C-Kit". Display only —
   * `name` is still what gets submitted.
   */
  label?: string
}

/** 'loading' → 'ready' | 'error'. On 'error' the select degrades to a text box. */
type CoursesState = 'loading' | 'ready' | 'error'

const ASSURANCES = [
  '₹0 application fee — and 15% off just for attending the offline round',
  'Your application becomes a WhatsApp chat — ask us anything there, anytime',
  'Offline round details reach you on WhatsApp after you apply',
]

function inputCls(invalid: boolean): string {
  return [
    'tfade h-12 w-full rounded-xl border bg-transparent px-4 text-[15.5px] text-ink',
    'placeholder:text-ink-faint focus:outline-none focus:ring-2',
    invalid
      ? 'border-err focus:border-err focus:ring-err/25'
      : 'border-line-strong focus:border-accent focus:ring-accent/25',
  ].join(' ')
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15 }
  }
}

const itemVariants: Variants = {
  hidden: { opacity: 0, x: -100 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { type: "spring", bounce: 0.2, duration: 1 }
  }
}

export default function ApplyForm() {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [courseId, setCourseId] = useState('')
  /** Only used when the course list failed to load. */
  const [courseText, setCourseText] = useState('')
  const [place, setPlace] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const [sentUrl, setSentUrl] = useState<string | null>(null)

  const [courses, setCourses] = useState<Course[]>([])
  const [coursesState, setCoursesState] = useState<CoursesState>('loading')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const nameRef = useRef<HTMLInputElement>(null)
  const phoneRef = useRef<HTMLInputElement>(null)
  const emailRef = useRef<HTMLInputElement>(null)
  const courseRef = useRef<HTMLButtonElement>(null)
  const courseTextRef = useRef<HTMLInputElement>(null)
  const placeRef = useRef<HTMLInputElement>(null)

  const coursesFailed = coursesState === 'error'

  useEffect(() => {
    const ac = new AbortController()
    fetch('/api/courses', { signal: ac.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((json: { data?: Course[] }) => {
        const list = Array.isArray(json.data) ? json.data : []
        // An empty list is as unusable as a failed one — fall back either way.
        if (list.length === 0) {
          setCoursesState('error')
          return
        }
        setCourses(list)
        setCoursesState('ready')
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setCoursesState('error')
      })
    return () => ac.abort()
  }, [])

  function validate(): Errors {
    const errs: Errors = {}
    if (name.trim().length < 2) errs.name = 'Enter your name — it’s what we’ll call you on WhatsApp.'
    if (!isValidMobile(normalizePhone(phone)))
      errs.phone = 'Enter the 10-digit mobile number you use on WhatsApp.'
    // Optional, but if they typed something it has to be a real address —
    // silently storing a typo helps nobody.
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim()))
      errs.email = 'That email doesn’t look right — or leave it blank.'
    if (coursesFailed) {
      if (courseText.trim().length < 2) errs.course = 'Tell us which course you’re applying for.'
    } else if (!courseId) {
      errs.course = 'Pick the course you’re applying for.'
    }
    if (place.trim().length < 2) errs.place = 'Tell us your town or city.'
    return errs
  }

  function focusCourse() {
    if (coursesFailed) courseTextRef.current?.focus()
    else courseRef.current?.focus()
  }

  function reset() {
    setSentUrl(null)
    setName('')
    setPhone('')
    setEmail('')
    setCourseId('')
    setCourseText('')
    setPlace('')
    setErrors({})
    setSubmitError(null)
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (isSubmitting) return

    const errs = validate()
    setErrors(errs)
    setSubmitError(null)
    if (errs.name) return nameRef.current?.focus()
    if (errs.phone) return phoneRef.current?.focus()
    if (errs.email) return emailRef.current?.focus()
    if (errs.course) return focusCourse()
    if (errs.place) return placeRef.current?.focus()

    const cleanPhone = normalizePhone(phone)
    const cleanName = name.trim()
    const cleanEmail = email.trim()
    const cleanPlace = place.trim()
    const courseName = coursesFailed
      ? courseText.trim()
      : (courses.find((c) => c.id === courseId)?.name ?? '')

    // When the course list didn't load we have no CRM course id to send, so
    // the lead can't be recorded. Rather than block the application, fall
    // through to WhatsApp — the same behaviour the form had before the CRM
    // existed. This path should be rare; the console note makes it findable.
    if (!coursesFailed) {
      setIsSubmitting(true)
      try {
        const res = await fetch('/api/apply', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            name: cleanName,
            phone: cleanPhone,
            email: cleanEmail,
            interestedCourseId: courseId,
            location: cleanPlace,
          }),
        })
        if (!res.ok) {
          setSubmitError('We couldn’t save your application. Please try again in a moment.')
          return
        }
      } catch {
        setSubmitError('Check your connection and try again.')
        return
      } finally {
        setIsSubmitting(false)
      }
    } else {
      console.warn('[apply] course list unavailable — sending to WhatsApp without a CRM record')
    }

    // The conversion. Fired on both paths: when the course list is down the
    // lead has no CRM record, but the person still applied — a funnel that
    // silently drops those applications would understate the campaign.
    //
    // Nothing the applicant typed is sent. The course name only goes out on
    // the path where it came from the CRM's own list, so it is one of a known
    // set of strings; on the fallback path it is whatever was typed into a
    // free-text box, which is no place to guess about — people put phone
    // numbers in unexpected fields. `place` is free text on every path, so it
    // stays here. The CRM already holds all of it.
    trackEvent('Lead', {
      ...(coursesFailed ? {} : { content_name: courseName }),
      content_category: 'scholarship-application',
      crm_recorded: !coursesFailed,
    })
    // Same submission, Meta's other standard name for it — some campaign
    // optimisations key off CompleteRegistration rather than Lead, so both fire.
    trackEvent('CompleteRegistration', {
      ...(coursesFailed ? {} : { content_name: courseName }),
      content_category: 'scholarship-application',
      status: !coursesFailed,
    })

    const url = waLink(
      applicationMessage({
        name: cleanName,
        phone: cleanPhone,
        email: cleanEmail,
        course: courseName,
        place: cleanPlace,
      }),
    )
    window.open(url, '_blank', 'noopener,noreferrer')
    setSentUrl(url)
  }

  return (
    <section id="apply" className="mx-auto w-full max-w-6xl scroll-mt-20 px-6 py-16 md:py-20">
      <motion.div
        className="grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-16"
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        // Shares the same viewport config as whileInView, so this fires exactly
        // once — the moment someone scrolls to the offer worth converting on.
        onViewportEnter={() => trackEvent('ViewContent', { content_category: 'scholarship-application' })}
        viewport={{ once: true, margin: '-10% 0px' }}
      >
        <motion.div variants={itemVariants}>
          <FlipFadeText
            text="APPLY IN TWO MINUTES."
            className="uppercase font-display text-[2rem] font-black tracking-tight md:text-[2.6rem]"
          />
          <p className="mt-3 max-w-[46ch] text-lg text-ink-soft">
            Five fields. Your application opens as a WhatsApp message press send there and it’s
            with us.
          </p>
          <Reveal className="mt-8" stagger="li">
            <ul className="space-y-4">
              {ASSURANCES.map((a) => (
                <li key={a} className="flex items-start gap-3 text-[15.5px] leading-relaxed">
                  <span className="tfade mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border border-line text-accent">
                    <CheckIcon className="h-3.5 w-3.5" />
                  </span>
                  {a}
                </li>
              ))}
            </ul>
          </Reveal>
          <noscript>
            <p className="mt-8 rounded-xl border border-line p-4 text-[15px] leading-relaxed">
              JavaScript is off in your browser, so this form won’t submit — apply by messaging us
              directly on{' '}
              <a className="font-semibold text-accent underline" href={waLink()}>
                WhatsApp
              </a>
              .
            </p>
          </noscript>
        </motion.div>

      {/* The one genuine mount/unmount on the page: the form is replaced by its
          own confirmation, and the swap needs explaining. `mode="wait"` lets
          the outgoing panel leave before the incoming one arrives, so the two
          never overlap in a card that has to keep its own height. */}
      <motion.div variants={itemVariants}>
        <AnimatePresence mode="wait" initial={false}>
          {sentUrl ? (
          <motion.div
            key="sent"
            role="status"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="tfade flex flex-col items-start justify-center rounded-2xl border border-line bg-card p-7 md:p-9"
          >
            <motion.span
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.12, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="grid h-12 w-12 place-items-center rounded-full bg-cta text-cta-ink"
            >
              <CheckIcon className="h-6 w-6" />
            </motion.span>
            <h3 className="mt-5 font-display text-2xl font-semibold">
              Application ready in WhatsApp
            </h3>
            <p className="mt-3 max-w-[44ch] text-[15.5px] leading-relaxed text-ink-soft">
              Press <strong className="font-semibold text-ink">Send</strong> in the WhatsApp chat
              that just opened and you’re in. Nothing else to do — the offline round details will
              come to you in that same chat.
            </p>
            <p className="mt-5 text-[14px] text-ink-soft">
              WhatsApp didn’t open?{' '}
              <a
                className="font-semibold text-accent underline"
                href={sentUrl}
                data-cta="apply-whatsapp-fallback"
                target="_blank"
                rel="noopener noreferrer"
              >
                Tap here to open it
              </a>
              .
            </p>
            <button
              type="button"
              onClick={reset}
              className="mt-7 text-sm font-medium text-ink-faint underline-offset-2 hover:text-ink hover:underline"
            >
              Submit another application
            </button>
          </motion.div>
        ) : (
          <motion.form
            key="form"
            noValidate
            onSubmit={onSubmit}
            initial={false}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.3, ease: 'easeIn' }}
            className="tfade rounded-2xl border border-line bg-card p-6 md:p-8"
          >
            <div className="space-y-5">
              <div>
                <label htmlFor="f-name" className="mb-2 block text-sm font-medium">
                  Full name
                </label>
                <input
                  ref={nameRef}
                  id="f-name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  aria-invalid={!!errors.name}
                  aria-describedby={errors.name ? 'f-name-err' : undefined}
                  className={inputCls(!!errors.name)}
                />
                {errors.name && (
                  <p id="f-name-err" className="mt-1.5 text-[13px] font-medium text-err">
                    {errors.name}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="f-phone" className="mb-2 block text-sm font-medium">
                  WhatsApp number
                </label>
                <input
                  ref={phoneRef}
                  id="f-phone"
                  name="phone"
                  type="tel"
                  inputMode="numeric"
                  // `tel-national` fills the bare 10 digits this field asks for;
                  // plain `tel` fills +91… which reads as wrong against the
                  // placeholder. normalizePhone() copes with either.
                  autoComplete="tel-national"
                  placeholder="10-digit number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  aria-invalid={!!errors.phone}
                  aria-describedby={errors.phone ? 'f-phone-err' : undefined}
                  className={inputCls(!!errors.phone)}
                />
                {errors.phone && (
                  <p id="f-phone-err" className="mt-1.5 text-[13px] font-medium text-err">
                    {errors.phone}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="f-email" className="mb-2 block text-sm font-medium">
                  Email <span className="font-normal text-ink-faint">(optional)</span>
                </label>
                <input
                  ref={emailRef}
                  id="f-email"
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? 'f-email-err' : undefined}
                  className={inputCls(!!errors.email)}
                />
                {errors.email && (
                  <p id="f-email-err" className="mt-1.5 text-[13px] font-medium text-err">
                    {errors.email}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="f-course" className="mb-2 block text-sm font-medium">
                  Course
                </label>
                {coursesFailed ? (
                  <input
                    ref={courseTextRef}
                    id="f-course"
                    name="course"
                    type="text"
                    // Not a profile field — keep it out of the address group the
                    // browser builds from the inputs around it.
                    autoComplete="off"
                    placeholder="Which course?"
                    value={courseText}
                    onChange={(e) => setCourseText(e.target.value)}
                    aria-invalid={!!errors.course}
                    aria-describedby={errors.course ? 'f-course-err' : undefined}
                    className={inputCls(!!errors.course)}
                  />
                ) : (
                  // Inside a <form> Radix mirrors the value into a hidden native
                  // <select>. Name it and opt it out so the browser doesn't try
                  // to classify an unlabelled control sitting in the middle of
                  // the autofill group.
                  <Select
                    value={courseId}
                    onValueChange={setCourseId}
                    name="course"
                    autoComplete="off"
                  >
                    <SelectTrigger
                      ref={courseRef}
                      id="f-course"
                      invalid={!!errors.course}
                      disabled={coursesState === 'loading'}
                      aria-describedby={errors.course ? 'f-course-err' : undefined}
                    >
                      <SelectValue
                        placeholder={
                          coursesState === 'loading' ? 'Loading courses…' : 'Choose a course'
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {courses.map((c) => (
                        // The campaign name when there is one, the CRM's
                        // otherwise. Radix mirrors this text into the closed
                        // trigger, so the rename covers the whole control.
                        <SelectItem key={c.id} value={c.id}>
                          {c.label ?? c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {errors.course && (
                  <p id="f-course-err" className="mt-1.5 text-[13px] font-medium text-err">
                    {errors.course}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="f-place" className="mb-2 block text-sm font-medium">
                  Where are you from?
                </label>
                <input
                  ref={placeRef}
                  id="f-place"
                  name="city"
                  type="text"
                  autoComplete="address-level2"
                  placeholder="Your town or city"
                  value={place}
                  onChange={(e) => setPlace(e.target.value)}
                  aria-invalid={!!errors.place}
                  aria-describedby={errors.place ? 'f-place-err' : undefined}
                  className={inputCls(!!errors.place)}
                />
                {errors.place && (
                  <p id="f-place-err" className="mt-1.5 text-[13px] font-medium text-err">
                    {errors.place}
                  </p>
                )}
              </div>
            </div>
            {submitError && (
              <p
                role="alert"
                className="mt-5 rounded-xl border border-err/40 bg-err/5 px-4 py-3 text-[14px] font-medium text-err"
              >
                {submitError}
              </p>
            )}
            <motion.button
              type="submit"
              disabled={isSubmitting}
              whileHover={isSubmitting ? undefined : { y: -2 }}
              whileTap={isSubmitting ? undefined : { scale: 0.985 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="group mt-7 inline-flex h-[52px] w-full items-center justify-center gap-2.5 rounded-full bg-cta text-[16.5px] font-semibold text-cta-ink disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? 'Sending…' : 'Submit application'}
              {!isSubmitting && (
                <ArrowRight className="h-[18px] w-[18px] transition-transform group-hover:translate-x-0.5" />
              )}
            </motion.button>
            <p className="mt-3.5 text-center text-[13px] leading-relaxed text-ink-faint">
              Opens WhatsApp with your application pre-filled — press Send there and you’re done.
            </p>
          </motion.form>
        )}
        </AnimatePresence>
      </motion.div>
      </motion.div>
    </section>
  )
}
