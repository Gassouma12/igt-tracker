// "Got feedback?" — a friendly page reachable from the flashy sidebar CTA on
// every role. No backend: it just guides the user to email the MCVP (with a
// pre-filled template) and attach a screenshot.
import { Camera, Lightbulb, Mail, MessageSquare, Sparkles } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button, Card } from '@/components/ui/primitives'

const FEEDBACK_EMAIL = 'kacem@aiesec.be'
const mailto = `mailto:${FEEDBACK_EMAIL}`
  + '?subject=' + encodeURIComponent('iGT platform feedback')
  + '&body=' + encodeURIComponent(
    "Hi Kacem,\n\nHere's some feedback on the iGT platform:\n\n"
    + '• What happened / what I noticed:\n\n'
    + '• Where (which page):\n\n'
    + "• What I'd expect instead:\n\n"
    + "(Attaching a screenshot below if I have one.)\n\nThanks!",
  )

export default function Feedback() {
  return (
    <div>
      <PageHeader title="Got feedback?" subtitle="Help make this platform better for the whole iGT team" />

      <Card className="mx-auto max-w-2xl">
        <div className="flex items-start gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-accent/15 text-accent">
            <MessageSquare size={24} />
          </span>
          <div>
            <h2 className="font-display text-xl font-bold text-ink">Spotted something? Tell me. 🙌</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-dim">
              This platform is built for you, and it gets better every time you tell me what's off.
              Found a bug, something confusing, or have an idea that would make your iGT sales life
              easier? I'd genuinely love to hear it — no feedback is too small.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <Hint icon={<Lightbulb size={16} />} title="Describe it" body="A quick line on what happened and which page you were on." />
          <Hint icon={<Camera size={16} />} title="Add a screenshot" body="If you can, attach one — it helps me fix things fast." />
          <Hint icon={<Sparkles size={16} />} title="Send it over" body={`Email me at ${FEEDBACK_EMAIL} and I'll take it from there.`} />
        </div>

        <div className="mt-6 flex flex-col items-start gap-3 rounded-2xl border border-accent/30 bg-accent/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-ink">Ready when you are</p>
            <p className="text-xs text-ink-mute">Opens your mail app with a short template pre-filled.</p>
          </div>
          <a href={mailto}>
            <Button><Mail size={16} /> Email {FEEDBACK_EMAIL}</Button>
          </a>
        </div>

        <p className="mt-4 text-center text-xs text-ink-mute">Thank you — it honestly helps a ton. 🙏</p>
      </Card>
    </div>
  )
}

function Hint({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-line bg-bg-elev p-3">
      <p className="flex items-center gap-1.5 text-sm font-medium text-ink"><span className="text-accent">{icon}</span> {title}</p>
      <p className="mt-1 text-xs text-ink-mute">{body}</p>
    </div>
  )
}
