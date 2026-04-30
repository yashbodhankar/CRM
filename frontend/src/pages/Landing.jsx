import React from 'react';
import { Link } from 'react-router-dom';
import { Check, Sparkles, ShieldCheck, Workflow, BarChart3, Users, PhoneCall, Mail, MapPin } from 'lucide-react';
import logo from '../../Logo.png';

const plans = [
  {
    name: 'Starter',
    price: '₹29',
    period: '/month',
    description: 'For small teams that need a reliable CRM baseline.',
    features: ['Up to 5 users', 'Lead & customer tracking', 'Task and project boards', 'Email support']
  },
  {
    name: 'Growth',
    price: '₹79',
    period: '/month',
    description: 'Best for scaling sales and service operations.',
    features: ['Up to 25 users', 'Advanced analytics', 'Workflow automation', 'Priority support'],
    highlighted: true
  },
  {
    name: 'Enterprise',
    price: '₹199',
    period: '/month',
    description: 'For large organizations with security and control needs.',
    features: ['Unlimited users', 'Role-based governance', 'Dedicated success manager', 'Custom integrations']
  }
];

const reviews = [
  {
    name: 'Alina Verma',
    role: 'Sales Director, NovaGrid',
    quote:
      'CRM Pro gave us full visibility across our pipeline. We cut response time by 42% in just six weeks.'
  },
  {
    name: 'Rahul More',
    role: 'Operations Lead, FieldSync',
    quote:
      'Automation and reminders reduced manual follow-ups dramatically. Our team now focuses on closing, not chasing.'
  },
  {
    name: 'Sana Kapoor',
    role: 'Founder, ClarityConsult',
    quote:
      'The dashboards are clear, the onboarding was smooth, and the support team feels like an extension of our staff.'
  }
];

const featureCards = [
  {
    title: 'Unified Pipeline View',
    description: 'Track leads, deals, customers, projects, and tasks in one connected workspace.',
    icon: BarChart3
  },
  {
    title: 'Role-Aware Security',
    description: 'Fine-grained access controls for admins, managers, employees, leads, and customers.',
    icon: ShieldCheck
  },
  {
    title: 'Smart Automation',
    description: 'Automate reminders, lead progression, and repetitive handoffs with zero-code workflows.',
    icon: Workflow
  },
  {
    title: 'Collaborative Execution',
    description: 'Align sales, delivery, and support teams with shared chat, timelines, and ownership.',
    icon: Users
  }
];

function Landing() {
  return (
    <div className="min-h-screen bg-[#04111f] text-slate-100">
      <div className="pointer-events-none fixed inset-0 -z-0 overflow-hidden">
        <div className="absolute -left-24 top-10 h-80 w-80 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="absolute right-0 top-1/3 h-96 w-96 rounded-full bg-teal-400/10 blur-3xl" />
        <div className="absolute left-1/3 bottom-0 h-80 w-80 rounded-full bg-orange-300/10 blur-3xl" />
      </div>

      <header className="sticky top-0 z-20 border-b border-slate-700/50 bg-[#04111f]/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <img src={logo} alt="CRM Pro logo" className="h-10 w-10 rounded-xl ring-2 ring-cyan-400/40" />
            <div>
              <p className="text-base font-semibold tracking-wide">CRM Pro</p>
              <p className="text-xs text-slate-400">Customer growth command center</p>
            </div>
          </div>
          <nav className="hidden items-center gap-6 text-sm text-slate-300 md:flex">
            <a href="#features" className="hover:text-cyan-300">Features</a>
            <a href="#pricing" className="hover:text-cyan-300">Pricing</a>
            <a href="#reviews" className="hover:text-cyan-300">Reviews</a>
            <a href="#contact" className="hover:text-cyan-300">Contact</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-200 hover:border-cyan-300 hover:text-cyan-200"
            >
              Sign In
            </Link>
            <a
              href="#pricing"
              className="rounded-lg bg-gradient-to-r from-cyan-400 to-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:opacity-90"
            >
              View Plans
            </a>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        <section className="mx-auto grid max-w-7xl gap-12 px-4 pb-20 pt-16 sm:px-6 lg:grid-cols-2 lg:px-8 lg:pt-24">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-400/10 px-4 py-1 text-xs text-cyan-200">
              <Sparkles className="h-4 w-4" />
              Built for teams that move fast
            </div>
            <h1 className="text-4xl font-bold leading-tight text-white sm:text-5xl">
              Turn scattered customer data into predictable revenue.
            </h1>
            <p className="mt-5 max-w-xl text-base text-slate-300 sm:text-lg">
              CRM Pro brings sales, delivery, and support into one platform. Capture leads, close deals, automate follow-ups, and monitor performance with real-time analytics.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to="/login"
                className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-200"
              >
                Launch Workspace
              </Link>
              <a
                href="#contact"
                className="rounded-xl border border-slate-500 px-5 py-3 text-sm font-semibold text-slate-200 hover:border-cyan-300"
              >
                Talk to Sales
              </a>
            </div>
            <div className="mt-8 grid max-w-md grid-cols-3 gap-4 text-center">
              <div className="rounded-xl border border-slate-700 bg-slate-900/50 px-3 py-4">
                <p className="text-2xl font-bold text-cyan-300">1200+</p>
                <p className="text-xs text-slate-400">Active Teams</p>
              </div>
              <div className="rounded-xl border border-slate-700 bg-slate-900/50 px-3 py-4">
                <p className="text-2xl font-bold text-emerald-300">98.9%</p>
                <p className="text-xs text-slate-400">Uptime SLA</p>
              </div>
              <div className="rounded-xl border border-slate-700 bg-slate-900/50 px-3 py-4">
                <p className="text-2xl font-bold text-amber-300">34%</p>
                <p className="text-xs text-slate-400">Avg. Win Boost</p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-700/70 bg-slate-900/60 p-5 shadow-2xl backdrop-blur">
            <p className="mb-4 text-sm font-semibold text-cyan-300">Why CRM Pro</p>
            <div className="space-y-4">
              {[
                'Live pipeline + team activity timeline',
                'In-app notifications with optional email alerts',
                'Role-based workspaces for every stakeholder',
                'Cloud-ready deployment and local Docker setup'
              ].map((item) => (
                <div key={item} className="flex items-start gap-3 rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-3">
                  <Check className="mt-0.5 h-4 w-4 text-emerald-300" />
                  <p className="text-sm text-slate-200">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
          <div className="mb-8 text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-cyan-300">Platform Capabilities</p>
            <h2 className="mt-2 text-3xl font-bold text-white">Everything your CRM should do, without the clutter.</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {featureCards.map(({ title, description, icon: Icon }) => (
              <article key={title} className="rounded-2xl border border-slate-700/70 bg-slate-900/55 p-5 transition-transform hover:-translate-y-1">
                <Icon className="h-6 w-6 text-cyan-300" />
                <h3 className="mt-4 text-lg font-semibold text-slate-100">{title}</h3>
                <p className="mt-2 text-sm text-slate-300">{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="pricing" className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
          <div className="mb-8 text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-emerald-300">Pricing Packages</p>
            <h2 className="mt-2 text-3xl font-bold text-white">Simple plans for every stage of growth.</h2>
          </div>
          <div className="grid gap-5 lg:grid-cols-3">
            {plans.map((plan) => (
              <article
                key={plan.name}
                className={`rounded-2xl border p-6 ${
                  plan.highlighted
                    ? 'border-emerald-300 bg-gradient-to-b from-emerald-300/15 to-slate-900/70 shadow-lg shadow-emerald-500/10'
                    : 'border-slate-700 bg-slate-900/60'
                }`}
              >
                <p className="text-sm font-semibold text-cyan-200">{plan.name}</p>
                <div className="mt-3 flex items-end gap-1">
                  <span className="text-4xl font-bold text-white">{plan.price}</span>
                  <span className="pb-1 text-sm text-slate-400">{plan.period}</span>
                </div>
                <p className="mt-3 text-sm text-slate-300">{plan.description}</p>
                <ul className="mt-6 space-y-2 text-sm">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-slate-200">
                      <Check className="mt-0.5 h-4 w-4 text-emerald-300" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <a
                  href="#contact"
                  className={`mt-6 inline-block rounded-lg px-4 py-2 text-sm font-semibold ${
                    plan.highlighted ? 'bg-emerald-300 text-slate-950' : 'bg-slate-100 text-slate-900'
                  }`}
                >
                  Choose {plan.name}
                </a>
              </article>
            ))}
          </div>
        </section>

        <section id="reviews" className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
          <div className="mb-8 text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-amber-300">Customer Reviews</p>
            <h2 className="mt-2 text-3xl font-bold text-white">Trusted by high-performing teams.</h2>
          </div>
          <div className="grid gap-5 lg:grid-cols-3">
            {reviews.map((review) => (
              <blockquote key={review.name} className="rounded-2xl border border-slate-700 bg-slate-900/60 p-5">
                <p className="text-sm leading-6 text-slate-200">"{review.quote}"</p>
                <footer className="mt-4 border-t border-slate-700 pt-4 text-sm">
                  <p className="font-semibold text-white">{review.name}</p>
                  <p className="text-slate-400">{review.role}</p>
                </footer>
              </blockquote>
            ))}
          </div>
        </section>

        <section id="contact" className="mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
          <div className="grid gap-6 rounded-3xl border border-slate-700 bg-slate-900/70 p-6 md:grid-cols-2 md:p-8">
            <div>
              <p className="text-sm font-semibold uppercase tracking-widest text-cyan-300">Contact Sales</p>
              <h2 className="mt-2 text-3xl font-bold text-white">Let us design your CRM rollout plan.</h2>
              <p className="mt-3 text-slate-300">
                Share your current process and team size. We will recommend the right package, setup path, and migration checklist.
              </p>
              <div className="mt-6 space-y-3 text-sm text-slate-200">
                <p className="flex items-center gap-2"><PhoneCall className="h-4 w-4 text-emerald-300" /> +91 9420056041</p>
                <p className="flex items-center gap-2"><Mail className="h-4 w-4 text-emerald-300" /> sales@crmpro.app</p>
                <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-emerald-300" /> Pune, Maharashtra, India</p>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-700 bg-slate-950/50 p-5">
              <h3 className="text-lg font-semibold text-white">Fast Inquiry</h3>
              <p className="mt-1 text-sm text-slate-400">Email us these details for a quick callback.</p>
              <ul className="mt-4 space-y-2 text-sm text-slate-200">
                <li>1. Company name and website</li>
                <li>2. Team size and roles</li>
                <li>3. Current CRM or spreadsheet setup</li>
                <li>4. Key challenges and goals</li>
                <li>5. Preferred go-live timeline</li>
              </ul>
              <a
                href="mailto:sales@crmpro.app?subject=CRM%20Pro%20Sales%20Inquiry"
                className="mt-6 inline-flex rounded-lg bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-200"
              >
                Email Sales Team
              </a>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default Landing;
