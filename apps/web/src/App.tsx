import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { motion, useInView } from 'framer-motion'
import {
  ArrowRight,
  Bell,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Database,
  FileText,
  HardDrive,
  LayoutDashboard,
  Lightbulb,
  Lock,
  Menu,
  MessageSquareText,
  MoreHorizontal,
  Search,
  ShieldCheck,
  ShieldX,
  Star,
  TriangleAlert,
  Upload,
  X,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { type FormEvent, useEffect, useRef, useState } from 'react'
import {
  BrowserRouter,
  Link,
  Navigate,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom'
import {
  appleProvider,
  auth,
  completeOnboarding,
  createAccount,
  firebaseErrorMessage,
  getCurrentOrgId,
  getUserProfile,
  googleProvider,
  resolveRedirectSignIn,
  requestPasswordReset,
  saveOrganizationProfile,
  saveTeamInvites,
  sendWelcomeEmail,
  signInWithPassword,
  signInWithSocialProvider,
  startInvestigation,
  subscribeToOrgCollection,
  subscribeToDocument,
} from './lib/firebase'
import { onAuthStateChanged, signOut, type User } from 'firebase/auth'

const queryClient = new QueryClient()

type Severity = 'Critical' | 'High' | 'Medium' | 'Low'

type RiskItem = {
  id: string
  title: string
  severity: Severity
  status: string
  impact: string
  recommendation: string
}

type Investigation = {
  id: string
  title: string
  status: string
  summary: string
  createdAt: string
}

type InvestigationRecord = {
  question?: string
  status?: string
  summary?: string
  findings?: string[]
  recommendations?: string[]
  evidence?: string[]
}

type DocumentRecord = {
  name?: string
  type?: string
  department?: string
  uploaded?: string
  status?: string
  chunkCount?: number
  access?: string[]
  storagePath?: string
}

const kpis = [
  { label: 'Revenue', value: '₹1.82 Cr', trend: '+11.4%', tone: 'success' },
  { label: 'Production', value: '67,600 units', trend: '-18%', tone: 'critical' },
  { label: 'Inventory Risk', value: '14 open', trend: '+3', tone: 'warning' },
  { label: 'Open Actions', value: '27', trend: '+6', tone: 'info' },
]

const riskList: RiskItem[] = [
  { id: 'R-104', title: 'Motor inventory shortfall at Plant 3', severity: 'Critical', status: 'Open', impact: '520 units short, 8 days remaining', recommendation: 'Prioritize procurement and maintenance sequencing.' },
  { id: 'R-118', title: 'Supplier delay on packagings', severity: 'High', status: 'Investigating', impact: '7-day delay threatens dispatch SLA', recommendation: 'Re-route supply or confirm alternate vendor.' },
  { id: 'R-201', title: 'Production line downtime drift', severity: 'Medium', status: 'Open', impact: '43 hrs downtime in September vs 12 hours prior month', recommendation: 'Review equipment maintenance backlog.' },
]

const opportunityList = [
  { id: 'OP-77', type: 'Revenue', title: 'Product A demand surge', value: '+24% demand', summary: 'High-margin SKUs are understocked in the East region.' },
  { id: 'OP-44', type: 'Cost Saving', title: 'Energy tuning on extruder line', value: '₹8.7L saved', summary: 'Peak-hour scheduling can reduce energy draw without affecting output.' },
  { id: 'OP-56', type: 'Inventory', title: 'Warehouse replenishment plan', value: '4.2 days improvement', summary: 'Cross-docking sequence could cut holding cost.' },
]

const investigationList: Investigation[] = [
  { id: 'INV-1024', title: 'Why did production fall this month?', status: 'Completed', summary: 'Three drivers identified: motor failure, supplier delay, and production line drift.', createdAt: '16 Sept 2026' },
  { id: 'INV-920', title: 'Which SKUs are at margin risk?', status: 'Completed', summary: 'Top-five SKUs identified with excess coverage and rising inbound cost.', createdAt: '12 Sept 2026' },
  { id: 'INV-915', title: 'Are customer orders at risk this quarter?', status: 'Running', summary: 'Reviewing lead times and open commitments by region.', createdAt: '10 Sept 2026' },
]

const actionList = [
  { id: 'ACT-2301', title: 'Create maintenance ticket for line 3 motor', status: 'pending_approval', reason: 'Repeated downtime spikes in the last 10 days', requestedBy: 'Nisha Shah' },
  { id: 'ACT-2208', title: 'Reorder critical packaging materials', status: 'approved', reason: 'Supplier delay and inventory protection', requestedBy: 'Ananya Rao' },
  { id: 'ACT-2160', title: 'Approve procurement of spare motor', status: 'completed', reason: 'Emergency request from maintenance', requestedBy: 'Amit Verma' },
]

const documents = [
  { id: 'DOC-18', name: 'Maintenance Manual', type: 'PDF', department: 'Operations', uploaded: '12 Sept 2026', status: 'Ready', access: 'All org' },
  { id: 'DOC-12', name: 'Supplier Contract', type: 'DOCX', department: 'Procurement', uploaded: '08 Sept 2026', status: 'Ready', access: 'Procurement' },
  { id: 'DOC-08', name: 'Maintenance Report Sept 2026', type: 'CSV', department: 'Plant Ops', uploaded: '03 Sept 2026', status: 'Indexing', access: 'Operations' },
]

const auditLogs = [
  { time: '2026-09-16 11:08', user: 'Pragya K', event: 'approval', resource: 'ACT-2301', action: 'approved', status: 'success' },
  { time: '2026-09-16 10:39', user: 'System', event: 'investigation', resource: 'INV-1024', action: 'completed', status: 'success' },
  { time: '2026-09-16 07:52', user: 'Amit Verma', event: 'upload', resource: 'DOC-18', action: 'indexed', status: 'success' },
]

const notifications = [
  { id: 'N-1', type: 'risk', title: 'Critical motor inventory risk', body: 'Line 3 is 520 units short with 8 days of stock remaining.', read: false, link: '/app/risks/R-104' },
  { id: 'N-2', type: 'approval', title: 'Action awaiting approval', body: 'Maintenance ticket for line 3 motor is ready for review.', read: true, link: '/app/actions/ACT-2301/review' },
  { id: 'N-3', type: 'document', title: 'Supplier contract indexed', body: 'New procurement document was processed and indexed.', read: false, link: '/app/documents/DOC-12' },
]

const chartData = [
  { name: 'Jan', production: 82.4, revenue: 1.5, downtime: 14 },
  { name: 'Feb', production: 79.8, revenue: 1.6, downtime: 19 },
  { name: 'Mar', production: 76.2, revenue: 1.72, downtime: 24 },
  { name: 'Apr', production: 71.8, revenue: 1.68, downtime: 31 },
  { name: 'May', production: 69.4, revenue: 1.76, downtime: 37 },
  { name: 'Jun', production: 67.6, revenue: 1.82, downtime: 43 },
]

const faqs = [
  { q: 'What data can I connect?', a: 'You can connect ERP, CRM, PostgreSQL, spreadsheets, PDFs, supplier records, and operational documents into a single operating picture.' },
  { q: 'Does the AI act without approval?', a: 'No. It can recommend actions, but important changes always require human approval before they are executed.' },
  { q: 'Is my data secure?', a: 'Yes. Access is permission-scoped to your organization and role, with evidence, approval history, and audit logs.' },
  { q: 'Which AI model is used?', a: 'The platform is designed to work with enterprise-safe LLM providers and can be configured to your governance requirements.' },
  { q: 'Who can approve actions?', a: 'Admins and designated managers can approve sensitive actions, while analysts can investigate and prepare recommendations.' },
  { q: 'Can I export audit logs?', a: 'Yes. Audit logs can be exported as CSV or reviewed in-app for compliance, incident review, and operational traceability.' },
]

const featureCards = [
  { title: 'Copilot investigations', description: 'Ask a direct operational question and get a structured investigation with the evidence behind every conclusion.', icon: MessageSquareText },
  { title: 'Risk detection', description: 'Spot production, supplier, and inventory issues earlier with live signal tracking and risk prioritization.', icon: TriangleAlert },
  { title: 'Opportunity finding', description: 'Find where you can recover margin, improve service levels, and reduce waste before it shows up in the ledger.', icon: Lightbulb },
  { title: 'Natural-language analytics', description: 'Turn plain-language prompts into actionable metrics, drilldowns, and operational summaries without SQL.', icon: Database },
  { title: 'Document intelligence', description: 'Index PDFs, SOPs, reports, and contracts so the Copilot can answer with document-backed evidence.', icon: FileText },
  { title: 'Approval workflow', description: 'Create human approval gates for high-impact changes so the AI supports decisions without bypassing controls.', icon: CheckCircle2 },
  { title: 'Audit trail', description: 'Track who reviewed what, when it changed, and why—without losing the context of the original decision.', icon: ShieldCheck },
  { title: 'Data connectors', description: 'Bring ERP, CRM, warehouse, and vendor data together into one view for cross-functional operating teams.', icon: HardDrive },
]

const trustItems = [
  { label: 'Evidence-backed', icon: ShieldCheck },
  { label: 'Permission-aware', icon: Lock },
  { label: 'Auditable', icon: CheckCircle2 },
  { label: 'Human-controlled', icon: Star },
]

function cn(...classes: Array<string | undefined | false | null>) {
  return classes.filter(Boolean).join(' ')
}

function getInitials(value: string) {
  return value.split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'U'
}

function BrandMark({ className = '' }: { className?: string }) {
  return <img src="/ai-operations-logo.png" alt="AI Operations" className={cn('h-10 w-auto max-w-[220px] shrink-0 object-contain', className)} />
}

type HeadlineSize = 'hero' | 'page' | 'section' | 'card'

function Headline({ sans, serif, size = 'section', as = 'h2', className = '' }: { sans: string; serif: string; size?: HeadlineSize; as?: 'h1' | 'h2' | 'h3'; className?: string }) {
  const Tag = as
  const serifText = serif.endsWith('.') ? serif.slice(0, -1) : serif

  return (
    <Tag className={cn('headline', `headline-${size}`, className)}>
      <span className="headline-sans">{sans}</span>
      <span className="headline-serif">{serifText}<span className="headline-period">.</span></span>
    </Tag>
  )
}

function GoogleLogo() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 shrink-0">
      <path fill="#4285F4" d="M21.35 12.27c0-.72-.06-1.42-.18-2.09H12v3.96h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.14c1.84-1.69 2.91-4.18 2.91-7.26Z" />
      <path fill="#34A853" d="M12 21.7c2.63 0 4.84-.87 6.45-2.36l-3.14-2.45c-.87.58-1.98.92-3.31.92-2.54 0-4.69-1.72-5.46-4.03H3.3v2.53A9.74 9.74 0 0 0 12 21.7Z" />
      <path fill="#FBBC05" d="M6.54 13.78A5.85 5.85 0 0 1 6.24 12c0-.62.11-1.22.3-1.78V7.69H3.3A9.74 9.74 0 0 0 2.27 12c0 1.56.37 3.03 1.03 4.31l3.24-2.53Z" />
      <path fill="#EA4335" d="M12 6.19c1.43 0 2.71.49 3.72 1.45l2.79-2.79C16.83 3.3 14.63 2.3 12 2.3a9.74 9.74 0 0 0-8.7 5.39l3.24 2.53C7.31 7.91 9.46 6.19 12 6.19Z" />
    </svg>
  )
}

function AppleLogo() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 shrink-0 fill-current">
      <path d="M17.05 12.54c-.02-2.25 1.84-3.34 1.92-3.39a4.1 4.1 0 0 0-3.24-1.75c-1.37-.14-2.7.82-3.4.82-.7 0-1.78-.8-2.93-.78a4.33 4.33 0 0 0-3.64 2.22c-1.57 2.72-.4 6.73 1.1 8.93.74 1.08 1.61 2.28 2.76 2.23 1.1-.04 1.52-.71 2.85-.71 1.33 0 1.71.71 2.87.69 1.19-.02 1.94-1.09 2.67-2.18a8.9 8.9 0 0 0 1.22-2.52 3.9 3.9 0 0 1-2.18-3.56Zm-2.23-6.59a3.9 3.9 0 0 0 .89-2.8 4.03 4.03 0 0 0-2.6 1.34 3.75 3.75 0 0 0-.92 2.7 3.33 3.33 0 0 0 2.63-1.24Z" />
    </svg>
  )
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/privacy" element={<LegalPage title="Privacy Policy" />} />
          <Route path="/terms" element={<LegalPage title="Terms of Service" />} />

          <Route path="/onboarding/*" element={<OnboardingFlow />} />

          <Route element={<ProtectedAppShell />}>
            <Route path="/app/dashboard" element={<DashboardPage />} />
            <Route path="/app/copilot" element={<CopilotPage />} />
            <Route path="/app/copilot/:investigationId" element={<InvestigationDetailPage />} />
            <Route path="/app/investigations" element={<InvestigationsPage />} />
            <Route path="/app/investigations/:id" element={<InvestigationDetailPage />} />
            <Route path="/app/analytics" element={<AnalyticsPage />} />
            <Route path="/app/risks" element={<RisksPage />} />
            <Route path="/app/risks/:id" element={<RiskDetailPage />} />
            <Route path="/app/opportunities" element={<OpportunitiesPage />} />
            <Route path="/app/opportunities/:id" element={<OpportunityDetailPage />} />
            <Route path="/app/actions" element={<ActionCenterPage />} />
            <Route path="/app/actions/:id/review" element={<ActionReviewPage />} />
            <Route path="/app/actions/:id" element={<ActionDetailPage />} />
            <Route path="/app/documents" element={<DocumentsPage />} />
            <Route path="/app/documents/upload" element={<DocumentUploadPage />} />
            <Route path="/app/documents/:id" element={<DocumentDetailPage />} />
            <Route path="/app/data-sources" element={<DataSourcesPage />} />
            <Route path="/app/data-sources/new" element={<DataSourceWizardPage />} />
            <Route path="/app/data-sources/:id" element={<DataSourceDetailPage />} />
            <Route path="/app/notifications" element={<NotificationsPage />} />
            <Route path="/app/audit-logs" element={<AuditLogsPage />} />
            <Route path="/app/settings" element={<SettingsPage />} />
            <Route path="/app/settings/:section" element={<SettingsPage />} />
            <Route path="/app/profile" element={<ProfilePage />} />
            <Route path="/unauthorized" element={<UnauthorizedPage />} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

function ProtectedAppShell() {
  const location = useLocation()
  const [user, setUser] = useState<User | null>(null)
  const [onboardingComplete, setOnboardingComplete] = useState(false)
  const [authLoading, setAuthLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser)
      if (!nextUser) {
        setOnboardingComplete(false)
        setAuthLoading(false)
        return
      }
      void getUserProfile(nextUser)
        .then((profile) => setOnboardingComplete(profile?.onboardingComplete === true))
        .catch(() => setOnboardingComplete(false))
        .finally(() => setAuthLoading(false))
    })
    return unsubscribe
  }, [])

  if (authLoading) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">Connecting to Firebase...</div>
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }

  if (!onboardingComplete && !location.pathname.startsWith('/onboarding')) {
    return <Navigate to="/onboarding/welcome" replace />
  }

  return <AppShell />
}

function Container({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('mx-auto w-full max-w-7xl px-6 lg:px-8', className)}>{children}</div>
}

function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [currentUser, setCurrentUser] = useState<User | null>(auth.currentUser)

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => setCurrentUser(u))
  }, [])

  const isAuthenticated = !!currentUser

  const links = [
    { label: 'Features', href: '#features' },
    { label: 'How it works', href: '#how-it-works' },
    { label: 'Security', href: '#security' },
    { label: 'FAQ', href: '#faq' },
  ]

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white transition-colors">
      <Container className="flex h-20 items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-3" aria-label="AI Operations home">
          <BrandMark className="h-12 max-w-[190px]" />
        </Link>

        <nav className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex">
          {links.map((link) => (
            <a key={link.label} href={link.href} className="transition hover:text-slate-900">{link.label}</a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          {isAuthenticated ? (
            <Link to="/app/dashboard" className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300">Go to Dashboard</Link>
          ) : (
            <>
              <Link to="/login" className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300">Log in</Link>
              <Link to="/signup" className="inline-flex items-center rounded-xl bg-[#1F5FA8] px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_22px_rgba(31,95,168,0.22)] transition hover:bg-[#174C87]">Get Started</Link>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <button type="button" aria-label="Open navigation menu" onClick={() => setMobileOpen((value) => !value)} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm">
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </Container>

      {mobileOpen && (
        <div className="border-t border-slate-200 bg-white md:hidden">
          <Container className="flex flex-col gap-4 py-5">
            {links.map((link) => (
              <a key={link.label} href={link.href} onClick={() => setMobileOpen(false)} className="text-base font-medium text-slate-700">{link.label}</a>
            ))}
            {isAuthenticated ? (
              <Link to="/app/dashboard" onClick={() => setMobileOpen(false)} className="inline-flex items-center justify-center rounded-xl bg-[#1F5FA8] px-4 py-3 text-sm font-semibold text-white">Go to Dashboard</Link>
            ) : (
              <>
                <Link to="/login" onClick={() => setMobileOpen(false)} className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700">Log in</Link>
                <Link to="/signup" onClick={() => setMobileOpen(false)} className="inline-flex items-center justify-center rounded-xl bg-[#1F5FA8] px-4 py-3 text-sm font-semibold text-white">Get Started</Link>
              </>
            )}
          </Container>
        </div>
      )}
    </header>
  )
}

function Hero() {
  return (
    <section className="relative isolate overflow-hidden py-16 md:py-20 lg:py-24">
      <video
        className="pointer-events-none absolute inset-0 z-0 h-full w-full object-cover opacity-100"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        aria-hidden="true"
      >
        <source src="/gemini_generated_video_4abcf73a.mp4" type="video/mp4" />
      </video>
      <Container className="relative z-10 flex min-h-[calc(100vh-5rem)] items-center justify-center py-12 text-center">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }} className="mx-auto max-w-4xl">
          <Headline as="h1" size="hero" sans="Turn data into decisions" serif="and actions." className="mx-auto max-w-4xl" />
          <p className="mx-auto mt-7 max-w-[55ch] text-base leading-[1.7] text-slate-600 sm:text-lg">AI Operations investigates your data, finds risks and opportunities, shows the evidence, and asks you to approve every important action. Clear, practical, and always in your control.</p>

          <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
            <Link to="/signup" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1F5FA8] px-6 py-3.5 text-base font-semibold text-white shadow-[0_16px_30px_rgba(31,95,168,0.2)] transition hover:bg-[#174C87] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2">Get Started Free <ArrowRight className="h-4 w-4" /></Link>
            <a href="#how-it-works" className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3.5 text-base font-semibold text-slate-800 shadow-sm transition hover:border-slate-300">See how it works</a>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-5 text-sm text-slate-600">
            {['Evidence-backed', 'No credit card', 'Set up in minutes'].map((item) => (
              <div key={item} className="inline-flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#E6F3FF] text-[#1F5FA8]">
                  <Check className="h-3.5 w-3.5" />
                </span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </motion.div>

      </Container>
    </section>
  )
}

function TrustStrip() {
  return (
    <section className="py-6 md:py-8">
      <Container>
        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white/70 p-3 shadow-sm sm:grid-cols-2 xl:grid-cols-4">
          {trustItems.map(({ label, icon: Icon }) => (
            <div key={label} className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
              <Icon className="h-4 w-4 text-[#1F5FA8]" />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </Container>
    </section>
  )
}

function ProblemSolution() {
  const steps = [
    'What happened?',
    'Why?',
    'Evidence?',
    'Impact?',
    'What should we do?',
  ]

  return (
    <section id="problem-solution" className="scroll-mt-28 py-20 md:py-28">
      <Container className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#1F5FA8]">Problem → solution</p>
          <Headline sans="Stop guessing" serif="why operations slip." />
        </div>

        <div className="grid gap-4 md:grid-cols-5">
          {steps.map((step, index) => (
            <div key={step} className="relative rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs font-semibold text-[#1F5FA8]">0{index + 1}</span>
                {index < steps.length - 1 && <ChevronRight className="hidden h-4 w-4 text-slate-400 md:block" />}
              </div>
              <p className="mt-3 text-sm font-semibold text-slate-800">{step}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  )
}

function Features() {
  return (
    <section id="features" className="scroll-mt-28 bg-white py-20 md:py-28">
      <Container>
        <div className="mb-10 max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#1F5FA8]">Features</p>
          <Headline sans="Built for the people" serif="who keep operations moving." />
        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {featureCards.map(({ title, description, icon: Icon }) => (
            <motion.div key={title} whileHover={{ y: -4 }} transition={{ duration: 0.2 }} className="group rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm transition hover:border-[#1F5FA8]/40 hover:shadow-[0_12px_24px_rgba(31,95,168,0.08)]">
              <div className="mb-4 inline-flex rounded-xl bg-[#EAF3FF] p-2.5 text-[#1F5FA8]">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
            </motion.div>
          ))}
        </div>
      </Container>
    </section>
  )
}

function HowItWorks() {
  const steps = [
    'Connect data',
    'Ask or auto-detect',
    'AI investigates',
    'Review evidence',
    'Approve & execute',
  ]

  return (
    <section id="how-it-works" className="scroll-mt-28 py-20 md:py-28">
      <Container>
        <div className="mb-12 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#1F5FA8]">How it works</p>
          <Headline sans="From raw signals" serif="to approved action." />
        </div>

        <div className="relative grid gap-5 md:grid-cols-5">
          {steps.map((step, index) => (
            <div key={step} className="relative rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-full bg-[#1F5FA8] text-sm font-semibold text-white">{index + 1}</div>
              <p className="text-sm font-semibold text-slate-800">{step}</p>
              {index < steps.length - 1 && <div className="hidden md:block absolute -right-2 top-1/2 h-px w-4 -translate-y-1/2 bg-slate-200" />}
            </div>
          ))}
        </div>
      </Container>
    </section>
  )
}

function LiveDemo() {
  const demoRef = useRef<HTMLDivElement | null>(null)
  const inView = useInView(demoRef, { once: true, margin: '-10%' })
  const [tickIndex, setTickIndex] = useState(0)

  useEffect(() => {
    if (!inView) return
    const interval = window.setInterval(() => {
      setTickIndex((value) => (value + 1) % 4)
    }, 900)
    return () => window.clearInterval(interval)
  }, [inView])

  const checks = [
    'Understanding request',
    'Checking production data',
    'Comparing trends',
    'Checking maintenance records',
  ]

  return (
    <section className="bg-slate-100 py-20 md:py-28">
      <Container>
        <div ref={demoRef} className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_48px_rgba(15,23,42,0.04)] md:p-8">
          <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#1F5FA8]">Interactive demo</p>
              <Headline sans="Why did production fall" serif="18%." />
            </div>
            <button type="button" onClick={() => setTickIndex(0)} className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300">Replay</button>
          </div>

          <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
            <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              {checks.map((step, index) => (
                <div key={step} className={cn('flex items-center gap-3 rounded-xl border px-3 py-2 text-sm', index <= tickIndex ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-700')}>
                  <span className={cn('flex h-5 w-5 items-center justify-center rounded-full', index <= tickIndex ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500')}>
                    {index <= tickIndex ? <Check className="h-3 w-3" /> : <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />}
                  </span>
                  <span>{step}</span>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-slate-800">Investigation result</span>
                <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold uppercase text-emerald-700">Complete</span>
              </div>
              <div className="mt-4 space-y-3">
                {[
                  'Machine downtime +31 hrs across three shifts',
                  'Component shortage: 520 units remaining with 8 days of cover',
                  'Supplier delay: 7-day lead-time extension on key parts',
                ].map((item) => (
                  <div key={item} className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700">
                    {item}
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium">
                {['Downtime', 'Inventory', 'Supplier'].map((chip) => (
                  <span key={chip} className="rounded-full bg-[#EAF3FF] px-2.5 py-1 text-[#1F5FA8]">{chip}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  )
}

function Security() {
  const items = [
    { title: 'Role-based access', description: 'Your data and actions stay scoped to the right user groups, organizations, and permissions.', icon: Lock },
    { title: 'Approval required', description: 'High-impact actions can be routed to managers or admins before anything changes in production.', icon: CheckCircle2 },
    { title: 'Full audit log', description: 'Every review, recommendation, and approval is tracked so investigations remain transparent and reviewable.', icon: ShieldCheck },
    { title: 'Permission-scoped data', description: 'Users only see the data they are allowed to access, using row-, role-, and org-level protections.', icon: Database },
  ]

  return (
    <section id="security" className="scroll-mt-28 py-20 md:py-28">
      <Container className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#1F5FA8]">Security & control</p>
          <Headline sans="The AI investigates" serif="humans stay in control." />

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {items.map(({ title, description, icon: Icon }) => (
              <div key={title} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-3 inline-flex rounded-xl bg-[#EAF3FF] p-2 text-[#1F5FA8]">
                  <Icon className="h-4 w-4" />
                </div>
                <h3 className="text-base font-semibold text-slate-900">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-slate-900 p-6 text-slate-100 shadow-[0_20px_48px_rgba(15,23,42,0.18)]">
          <div className="mb-6 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-300">Permission matrix</span>
            <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-[10px] font-semibold uppercase text-emerald-300">Validated</span>
          </div>

          <div className="space-y-3">
            {['Admin can approve and execute', 'Manager can review and approve', 'Analyst can investigate and upload', 'Employee can view approved tasks'].map((line) => (
              <div key={line} className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-800 px-3 py-3 text-sm text-slate-100">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                <span>{line}</span>
              </div>
            ))}
          </div>
        </div>
      </Container>
    </section>
  )
}

function FAQ() {
  const [openIndex, setOpenIndex] = useState(0)

  return (
    <section id="faq" className="scroll-mt-28 bg-white py-20 md:py-28">
      <Container className="max-w-4xl">
        <div className="mb-10 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#1F5FA8]">FAQ</p>
          <Headline sans="Questions" serif="answered." />
        </div>

        <div className="space-y-3">
          {faqs.map((item, index) => (
            <div key={item.q} className="rounded-2xl border border-slate-200 bg-slate-50">
              <button type="button" aria-expanded={openIndex === index} onClick={() => setOpenIndex(openIndex === index ? -1 : index)} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-base font-semibold text-slate-800">
                <span>{item.q}</span>
                <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform', openIndex === index && 'rotate-180')} />
              </button>
              {openIndex === index && <p className="px-5 pb-4 text-sm leading-6 text-slate-600">{item.a}</p>}
            </div>
          ))}
        </div>
      </Container>
    </section>
  )
}

function FinalCTA() {
  return (
    <section className="pb-20 md:pb-28">
      <Container>
        <div className="rounded-[28px] bg-gradient-to-r from-[#1F5FA8] to-[#174C87] p-8 text-white shadow-[0_24px_48px_rgba(31,95,168,0.28)] md:p-10">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-100">Ready to act</p>
              <Headline sans="Ready to run" serif="smarter operations." className="text-white" />
            </div>
            <Link to="/signup" className="inline-flex items-center justify-center rounded-xl bg-white px-6 py-3.5 text-base font-semibold text-[#1F5FA8] transition hover:bg-slate-50">Get Started Free</Link>
          </div>
        </div>
      </Container>
    </section>
  )
}

function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <Container className="grid gap-8 py-10 md:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr] md:items-start">
        <div>
          <BrandMark className="h-12 max-w-[190px]" />
        </div>

        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">Product</p>
          <ul className="mt-4 space-y-2 text-sm text-slate-600">
            <li><a href="#features">Features</a></li>
            <li><a href="#how-it-works">How it works</a></li>
            <li><a href="#security">Security</a></li>
          </ul>
        </div>

        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">Company</p>
          <ul className="mt-4 space-y-2 text-sm text-slate-600">
            <li><a href="#faq">FAQ</a></li>
            <li><a href="/signup">Get Started</a></li>
            <li><a href="/login">Log in</a></li>
          </ul>
        </div>

        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">Legal</p>
          <ul className="mt-4 space-y-2 text-sm text-slate-600">
            <li><Link to="/privacy">Privacy Policy</Link></li>
            <li><Link to="/terms">Terms of Service</Link></li>
          </ul>
        </div>
      </Container>

      <div className="border-t border-slate-200">
        <Container className="flex items-center justify-between py-5 text-sm text-slate-500">
          <span>© 2026 AI Operations. All rights reserved.</span>
          <span className="hidden md:inline">Heavy-Duty Intelligence</span>
        </Container>
      </div>
    </footer>
  )
}

function LandingPage() {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-slate-900">
      <Navbar />
      <main>
        <Hero />
        <TrustStrip />
        <ProblemSolution />
        <Features />
        <HowItWorks />
        <LiveDemo />
        <Security />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  )
}

function LoginPage() {
  const [errors, setErrors] = useState({ email: '', password: '' })
  const [formError, setFormError] = useState('')
  const [formNotice, setFormNotice] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    void resolveRedirectSignIn()
      .then(async (result) => {
        if (!result?.user) return
        if (result.isNewUser) {
          await sendWelcomeEmail(result.user).catch(() => undefined)
          setFormNotice('Your account was created. Let’s finish setting up your workspace.')
          navigate('/onboarding/welcome')
          return
        }
        navigate('/app/dashboard')
      })
      .catch((error: unknown) => setFormError(firebaseErrorMessage(error)))
  }, [navigate])

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const email = String(formData.get('email') || '').trim()
    const password = String(formData.get('password') || '')

    const nextErrors = { email: '', password: '' }
    if (!email.includes('@')) nextErrors.email = 'Enter a valid work email.'
    if (password.length < 6) nextErrors.password = 'Your password must be at least 6 characters.'

    setErrors(nextErrors)
    setFormError('')
    setFormNotice('')
    if (nextErrors.email || nextErrors.password) return

    setLoading(true)
    void signInWithPassword(email, password)
      .then(() => navigate('/app/dashboard'))
      .catch((error: unknown) => setFormError(firebaseErrorMessage(error)))
      .finally(() => setLoading(false))
  }

  const handleSocialSignIn = (provider: typeof googleProvider) => {
    setLoading(true)
    setFormError('')
    void signInWithSocialProvider(provider)
      .then(async ({ user, isNewUser }) => {
        if (!user) return
        if (isNewUser) {
          await sendWelcomeEmail(user).catch(() => undefined)
          setFormNotice('Your account was created. Let’s finish setting up your workspace.')
          navigate('/onboarding/welcome')
          return
        }
        navigate('/app/dashboard')
      })
      .catch((error: unknown) => setFormError(firebaseErrorMessage(error)))
      .finally(() => setLoading(false))
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
        <div className="mb-8">
          <BrandMark className="h-16 max-w-[250px]" />
          <p className="mt-4 text-sm text-slate-500">Welcome back</p>
          <Headline sans="Welcome" serif="back." size="page" />
        </div>
        {formError && <p className="mb-5 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">{formError}</p>}
        {formNotice && <p className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700">{formNotice}</p>}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-700">Work email</label>
            <input id="email" name="email" type="email" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none ring-0 transition focus:border-indigo-500" placeholder="name@company.com" />
            {errors.email && <p className="mt-2 text-sm text-red-600">{errors.email}</p>}
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between"><label htmlFor="password" className="text-sm font-medium text-slate-700">Password</label><Link to="/forgot-password" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">Forgot password?</Link></div>
            <input id="password" name="password" type="password" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none transition focus:border-indigo-500" placeholder="••••••••" />
            {errors.password && <p className="mt-2 text-sm text-red-600">{errors.password}</p>}
          </div>
          <button type="submit" disabled={loading} className="w-full rounded-xl bg-[#1F5FA8] px-4 py-3 font-semibold text-white disabled:cursor-wait disabled:opacity-60">{loading ? 'Signing in...' : 'Sign in'}</button>
          <div className="grid gap-3 sm:grid-cols-2">
            <button type="button" disabled={loading} onClick={() => handleSocialSignIn(googleProvider)} className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-medium text-slate-700 disabled:opacity-60"><GoogleLogo /> Google</button>
            <button type="button" disabled={loading} onClick={() => handleSocialSignIn(appleProvider)} className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-medium text-slate-700 disabled:opacity-60"><AppleLogo /> Apple</button>
          </div>
          <p className="text-center text-xs leading-5 text-slate-500">Google or Apple will create a new account and start setup when no matching account exists.</p>
        </form>
        <p className="mt-6 text-center text-sm text-slate-600">Need an account? <Link to="/signup" className="font-medium text-indigo-600">Create one</Link></p>
      </div>
    </div>
  )
}

function SignupPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [formError, setFormError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const strength = password.length >= 12 ? 'Strong' : password.length >= 8 ? 'Medium' : 'Weak'

  const completeSignup = async (user: User) => {
    await sendWelcomeEmail(user).catch(() => undefined)
    navigate('/onboarding/welcome')
  }

  useEffect(() => {
    void resolveRedirectSignIn()
      .then((result) => {
        if (!result?.user) return
        if (result.isNewUser) {
          void sendWelcomeEmail(result.user).catch(() => undefined)
          navigate('/onboarding/welcome')
          return
        }
        navigate('/app/dashboard')
      })
      .catch((error: unknown) => setFormError(firebaseErrorMessage(error)))
  }, [navigate])

  const handleSignup = () => {
    if (!name.trim() || !email.includes('@') || password.length < 6) {
      setFormError('Enter your name, a valid work email, and a password with at least 6 characters.')
      return
    }
    setLoading(true)
    setFormError('')
    void createAccount(email, password, name)
      .then(completeSignup)
      .catch((error: unknown) => setFormError(firebaseErrorMessage(error)))
      .finally(() => setLoading(false))
  }

  const handleSocialSignup = (provider: typeof googleProvider) => {
    setLoading(true)
    setFormError('')
    void signInWithSocialProvider(provider)
      .then(async ({ user, isNewUser }) => {
        if (user && isNewUser) await completeSignup(user)
        else if (user) navigate('/app/dashboard')
      })
      .catch((error: unknown) => setFormError(firebaseErrorMessage(error)))
      .finally(() => setLoading(false))
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
        <BrandMark className="mb-6 h-16 max-w-[250px]" />
        <div className="mb-6">
          <p className="text-sm text-slate-500">Create account</p>
          <Headline sans="Start" serif="here." size="page" />
        </div>
        {formError && <p className="mb-5 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">{formError}</p>}
        <div className="space-y-5">
          <div><label htmlFor="signup-name" className="mb-2 block text-sm font-medium text-slate-700">Full name</label><input id="signup-name" value={name} onChange={(event) => setName(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5" placeholder="Riya Sharma" /></div>
          <div><label htmlFor="signup-email" className="mb-2 block text-sm font-medium text-slate-700">Work email</label><input id="signup-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5" placeholder="name@company.com" /></div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5" placeholder="Create a strong password" />
            <div className="mt-2 flex items-center gap-2">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
                <div className={cn('h-full rounded-full', strength === 'Weak' ? 'w-1/3 bg-red-500' : strength === 'Medium' ? 'w-2/3 bg-amber-500' : 'w-full bg-emerald-500')} />
              </div>
              <span className="text-xs text-slate-500">{strength}</span>
            </div>
          </div>
          <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 text-sm text-slate-600">
            <input type="checkbox" className="mt-1" />
            <span>I agree to the <Link to="/terms" className="text-indigo-600">terms</Link> and <Link to="/privacy" className="text-indigo-600">privacy policy</Link>.</span>
          </label>
          <button type="button" disabled={loading} onClick={handleSignup} className="w-full rounded-xl bg-[#1F5FA8] px-4 py-3 font-semibold text-white disabled:cursor-wait disabled:opacity-60">{loading ? 'Creating account...' : 'Create account'}</button>
          <div className="grid gap-3 sm:grid-cols-2">
            <button type="button" disabled={loading} onClick={() => handleSocialSignup(googleProvider)} className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-medium text-slate-700 disabled:opacity-60"><GoogleLogo /> Google</button>
            <button type="button" disabled={loading} onClick={() => handleSocialSignup(appleProvider)} className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-medium text-slate-700 disabled:opacity-60"><AppleLogo /> Apple</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleReset = () => {
    if (!email.includes('@')) {
      setError('Enter a valid work email address.')
      return
    }
    setError('')
    setMessage('')
    setLoading(true)
    void requestPasswordReset(email)
      .then(() => setMessage('Check your inbox for a password reset link.'))
      .catch((resetError: unknown) => setError(firebaseErrorMessage(resetError)))
      .finally(() => setLoading(false))
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.04)]">
        <BrandMark className="mb-6 h-16 max-w-[250px]" />
        <Headline sans="Reset your" serif="password." size="page" />
        <p className="mt-3 text-sm text-slate-600">We’ll send a reset link to your work email.</p>
        <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-6 w-full rounded-xl border border-slate-200 px-3 py-2.5" placeholder="name@company.com" />
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        {message && <p className="mt-2 text-sm text-emerald-700">{message}</p>}
        <button type="button" disabled={loading} onClick={handleReset} className="mt-6 w-full rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white disabled:opacity-60">{loading ? 'Sending...' : 'Send reset link'}</button>
        <Link to="/login" className="mt-4 block text-center text-sm font-medium text-indigo-600 hover:text-indigo-700">Back to sign in</Link>
      </div>
    </div>
  )
}

function OnboardingFlow() {
  const routes = ['/onboarding/welcome', '/onboarding/organization', '/onboarding/invite', '/onboarding/data', '/onboarding/ai-setup', '/onboarding/complete']
  const location = useLocation()
  const step = routes.indexOf(location.pathname)
  const currentStep = Math.max(step, 0)

  const steps = ['Welcome', 'Organization', 'Invite', 'Data', 'AI Setup', 'Complete']

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-4xl rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_24px_60px_rgba(15,23,42,0.04)]">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500">Step {currentStep + 1} of {steps.length}</p>
            <Headline sans={['Welcome', 'Tell us about', 'Invite', 'Connect', 'Set up', "You're"][currentStep]} serif={['your workspace.', 'your company.', 'your team.', 'your data.', 'your AI.', 'all set.'][currentStep]} size="page" />
          </div>
          <div className="text-sm text-slate-500">AI Operations Copilot</div>
        </div>
        <div className="mb-8 h-1 overflow-hidden rounded-full bg-slate-200" aria-label={`Step ${currentStep + 1} of ${steps.length}`}>
          <div className="h-full rounded-full bg-[#1F5FA8] transition-all" style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }} />
        </div>
        <Routes>
          <Route path="/welcome" element={<OnboardingWelcome />} />
          <Route path="/organization" element={<OrganizationStep />} />
          <Route path="/invite" element={<InviteStep />} />
          <Route path="/data" element={<DataStep />} />
          <Route path="/ai-setup" element={<AiSetupStep />} />
          <Route path="/complete" element={<CompleteStep />} />
          <Route path="*" element={<Navigate to="/onboarding/welcome" replace />} />
        </Routes>
      </div>
    </div>
  )
}

function OnboardingWelcome() {
  const navigate = useNavigate()
  return (
    <div>
      <div className="rounded-2xl bg-indigo-50 p-6">
        <Headline as="h3" sans="Turn business data" serif="into decisions and actions." size="section" />
        <p className="mt-3 text-slate-600">Connect your systems, invite your team, and start asking targeted operational questions with visible evidence and human approval.</p>
      </div>
      <div className="mt-8 flex justify-end">
        <button onClick={() => navigate('/onboarding/organization')} className="rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white">Get Started</button>
      </div>
    </div>
  )
}

function OrganizationStep() {
  const navigate = useNavigate()
  const user = auth.currentUser
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [orgName, setOrgName] = useState('')
  const [industry, setIndustry] = useState('Manufacturing')
  const [size, setSize] = useState('50-200')
  const [country, setCountry] = useState('India')

  useEffect(() => {
    if (user) {
      void getUserProfile(user).then((prof: any) => {
        if (prof?.organization?.name) {
          setOrgName(prof.organization.name)
          if (prof.organization.industry) setIndustry(prof.organization.industry)
          if (prof.organization.size) setSize(prof.organization.size)
          if (prof.organization.country) setCountry(prof.organization.country)
        }
      }).catch(() => undefined)
    }
  }, [user])

  const handleContinue = () => {
    if (!user) return
    const trimmed = orgName.trim()
    if (!trimmed) {
      setError('Please enter your organization or company name.')
      return
    }
    setLoading(true)
    setError('')
    void saveOrganizationProfile(user, {
      name: trimmed,
      industry: industry.trim() || 'Manufacturing',
      size: size.trim() || '50-200',
      country: country.trim() || 'India',
    })
      .then(() => navigate('/onboarding/invite'))
      .catch((saveError: unknown) => setError(firebaseErrorMessage(saveError)))
      .finally(() => setLoading(false))
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">Organization name</label>
          <input
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-indigo-500"
            placeholder="e.g. Acme Operations"
            value={orgName}
            onChange={(e) => {
              setOrgName(e.target.value)
              if (error) setError('')
            }}
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">Industry</label>
          <select
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-indigo-500"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
          >
            <option value="Manufacturing">Manufacturing</option>
            <option value="Logistics & Supply Chain">Logistics & Supply Chain</option>
            <option value="Retail & E-commerce">Retail & E-commerce</option>
            <option value="Energy & Utilities">Energy & Utilities</option>
            <option value="Technology & SaaS">Technology & SaaS</option>
            <option value="Healthcare & Pharma">Healthcare & Pharma</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">Company size</label>
          <select
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-indigo-500"
            value={size}
            onChange={(e) => setSize(e.target.value)}
          >
            <option value="1-10">1-10 employees</option>
            <option value="11-50">11-50 employees</option>
            <option value="50-200">50-200 employees</option>
            <option value="200-1000">200-1000 employees</option>
            <option value="1000+">1000+ employees</option>
          </select>
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">Country</label>
          <input
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-indigo-500"
            placeholder="Country"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
          />
        </div>
      </div>
      {error && <p className="text-sm font-medium text-red-600">{error}</p>}
      <div className="flex justify-between">
        <Link to="/onboarding/welcome" className="rounded-xl border border-slate-200 px-4 py-2.5 font-medium text-slate-700 hover:bg-slate-50 transition">Back</Link>
        <button onClick={handleContinue} disabled={loading} className="rounded-xl bg-indigo-600 px-5 py-2.5 font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60">{loading ? 'Saving...' : 'Continue'}</button>
      </div>
    </div>
  )
}

function InviteStep() {
  const navigate = useNavigate()
  const user = auth.currentUser
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('Manager')
  const [invites, setInvites] = useState<Array<{ email: string; role: string }>>([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (user) {
      void getUserProfile(user).then((prof: any) => {
        if (Array.isArray(prof?.invites) && prof.invites.length > 0) {
          setInvites(prof.invites)
        }
      }).catch(() => undefined)
    }
  }, [user])

  const handleAddInvite = (e?: FormEvent) => {
    if (e) e.preventDefault()
    setError('')
    const trimmed = inviteEmail.trim().toLowerCase()
    if (!trimmed) {
      setError('Please enter a team member email.')
      return
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(trimmed)) {
      setError('Please enter a valid email address (e.g. colleague@company.com).')
      return
    }
    if (invites.some((item) => item.email.toLowerCase() === trimmed)) {
      setError('This email has already been added to the invite list.')
      return
    }
    if (user?.email && user.email.toLowerCase() === trimmed) {
      setError('You are already the workspace administrator. Add a teammate’s email.')
      return
    }

    setInvites((prev) => [...prev, { email: trimmed, role: inviteRole }])
    setInviteEmail('')
    setError('')
  }

  const handleRemoveInvite = (emailToRemove: string) => {
    setInvites((prev) => prev.filter((item) => item.email !== emailToRemove))
  }

  const handleContinue = async () => {
    if (user && invites.length > 0) {
      setSaving(true)
      try {
        await saveTeamInvites(user, invites)
      } catch (err) {
        console.warn('Could not save invites to Firestore:', err)
      } finally {
        setSaving(false)
      }
    }
    navigate('/onboarding/data')
  }

  return (
    <div className="space-y-5">
      <form onSubmit={handleAddInvite} className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_150px_90px]">
          <input
            type="email"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            placeholder="colleague@company.com"
            value={inviteEmail}
            onChange={(e) => {
              setInviteEmail(e.target.value)
              if (error) setError('')
            }}
          />
          <select
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none focus:border-indigo-500"
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value)}
          >
            <option value="Manager">Manager</option>
            <option value="Analyst">Analyst</option>
            <option value="Employee">Employee</option>
          </select>
          <button
            type="submit"
            className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 active:scale-[0.98]"
          >
            Add
          </button>
        </div>
        {error && <p className="mt-2 text-xs font-medium text-red-600">{error}</p>}
      </form>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Team Members ({invites.length})
          </span>
          {user?.email && (
            <span className="text-xs text-slate-500">
              Admin: <span className="font-medium text-slate-700">{user.email}</span>
            </span>
          )}
        </div>

        {invites.length === 0 ? (
          <div className="py-6 text-center text-sm text-slate-400">
            No team members added yet. Type an email above to add members, or click Continue to skip for now.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {invites.map((item) => (
              <div key={item.email} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold uppercase text-indigo-700">
                    {item.email.charAt(0)}
                  </div>
                  <span className="text-sm font-medium text-slate-800">{item.email}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      'rounded-full px-2.5 py-0.5 text-xs font-medium',
                      item.role === 'Manager' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' :
                      item.role === 'Analyst' ? 'bg-sky-50 text-sky-700 border border-sky-100' :
                      'bg-slate-100 text-slate-700 border border-slate-200'
                    )}
                  >
                    {item.role}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveInvite(item.email)}
                    className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-red-600 transition"
                    title="Remove member"
                    aria-label={`Remove ${item.email}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-between">
        <Link to="/onboarding/organization" className="rounded-xl border border-slate-200 px-4 py-2.5 font-medium text-slate-700 hover:bg-slate-50 transition">Back</Link>
        <div className="flex gap-3">
          <button onClick={() => navigate('/onboarding/data')} className="rounded-xl border border-slate-200 px-4 py-2.5 font-medium text-slate-700 hover:bg-slate-50 transition">Skip for now</button>
          <button onClick={handleContinue} disabled={saving} className="rounded-xl bg-indigo-600 px-5 py-2.5 font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60">
            {saving ? 'Saving...' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  )
}

function DataStep() {
  const navigate = useNavigate()
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {['Documents', 'CSV', 'Excel', 'PostgreSQL', 'API', 'ERP', 'CRM'].map((item) => (
          <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-medium text-slate-700">{item}</div>
        ))}
      </div>
      <div className="flex justify-between">
        <Link to="/onboarding/invite" className="rounded-xl border border-slate-200 px-4 py-2.5 font-medium text-slate-700 hover:bg-slate-50 transition">Back</Link>
        <button onClick={() => navigate('/onboarding/ai-setup')} className="rounded-xl bg-indigo-600 px-5 py-2.5 font-semibold text-white shadow-sm hover:bg-indigo-700 transition">Continue</button>
      </div>
    </div>
  )
}

function AiSetupStep() {
  const navigate = useNavigate()
  const [context, setContext] = useState('')
  return (
    <div className="space-y-6">
      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">Business context</label>
        <textarea
          rows={5}
          className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
          placeholder="Describe your company operations, key production lines, metrics, or areas you want the Copilot to monitor..."
          value={context}
          onChange={(e) => setContext(e.target.value)}
        />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {['Production', 'Inventory', 'Maintenance', 'Sales', 'Finance', 'Suppliers'].map((domain) => (
          <label key={domain} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 cursor-pointer hover:bg-slate-100 transition"><input type="checkbox" defaultChecked /> {domain}</label>
        ))}
      </div>
      <div className="flex justify-between">
        <Link to="/onboarding/data" className="rounded-xl border border-slate-200 px-4 py-2.5 font-medium text-slate-700 hover:bg-slate-50 transition">Back</Link>
        <button onClick={() => navigate('/onboarding/complete')} className="rounded-xl bg-indigo-600 px-5 py-2.5 font-semibold text-white shadow-sm hover:bg-indigo-700 transition">Complete setup</button>
      </div>
    </div>
  )
}

function CompleteStep() {
  const navigate = useNavigate()
  const user = auth.currentUser
  const [invitedCount, setInvitedCount] = useState(0)

  useEffect(() => {
    if (user) {
      void getUserProfile(user).then((prof: any) => {
        if (Array.isArray(prof?.invites)) {
          setInvitedCount(prof.invites.length)
        }
      }).catch(() => undefined)
    }
  }, [user])

  const handleComplete = () => {
    if (!user) return
    void completeOnboarding(user).then(() => navigate('/app/dashboard'))
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <InfoCard label="Data sources" value="Ready to connect" />
        <InfoCard label="Documents" value="Knowledge base ready" />
        <InfoCard label="Team" value={invitedCount > 0 ? `${invitedCount} invited` : '1 admin'} />
      </div>
      <div className="flex justify-end">
        <button onClick={handleComplete} className="rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white shadow-sm hover:bg-indigo-700 transition">Open Dashboard</button>
      </div>
    </div>
  )
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="text-sm text-slate-500">{label}</div><div className="mt-2 text-2xl font-semibold text-slate-900">{value}</div></div>
}

function AppShell() {
  const location = useLocation()
  const [darkMode, setDarkMode] = useState(false)
  const activePath = location.pathname
  const user = auth.currentUser

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
    return () => document.documentElement.classList.remove('dark')
  }, [darkMode])

  const nav = [
    { to: '/app/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/app/copilot', label: 'Copilot', icon: MessageSquareText },
    { to: '/app/risks', label: 'Risks', icon: TriangleAlert },
    { to: '/app/actions', label: 'Approvals', icon: CheckCircle2 },
    { to: '/app/settings', label: 'More', icon: MoreHorizontal },
  ]

  return (
    <div className={cn('app-shell flex min-h-screen bg-slate-50 text-slate-900', darkMode && 'dark bg-slate-950 text-slate-100')}>
      <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-white/80 p-5 backdrop-blur-xl lg:flex lg:flex-col">
        <div className="mb-8 flex items-center gap-3 px-2">
          <BrandMark className="h-11 max-w-[190px]" />
        </div>
        <nav className="space-y-2">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => cn('flex items-center gap-3 rounded-xl px-3 py-2.5 font-medium text-sm transition', isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100')}>
              <Icon className="h-4 w-4" /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="font-medium text-slate-700">Operational health</span>
            <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-semibold text-amber-700">Attention</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full w-[68%] rounded-full bg-gradient-to-r from-amber-500 to-rose-500" /></div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 lg:hidden"><LayoutDashboard className="h-4 w-4" /></div>
              <div className="hidden rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 md:flex">
                <Search className="mr-2 h-4 w-4" /> / for search
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setDarkMode((value) => !value)} className="rounded-xl border border-slate-200 p-2 text-slate-600">{darkMode ? 'Light' : 'Dark'}</button>
              <div className="relative">
                <button className="relative rounded-xl border border-slate-200 p-2 text-slate-600"><Bell className="h-4 w-4" /><span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] text-white">3</span></button>
              </div>
              <Link to="/app/profile" className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold text-white">{getInitials(user?.displayName || user?.email || 'User')}</div>
                <div className="hidden text-left text-sm md:block">
                  <div className="font-medium text-slate-900">{user?.displayName || 'Workspace user'}</div>
                  <div className="text-xs text-slate-500">{user?.email || 'Signed in'}</div>
                </div>
              </Link>
              <button type="button" onClick={() => void signOut(auth)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:border-slate-300 hover:text-slate-900">Sign out</button>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 md:p-6">
          <div className="mb-8 flex items-end justify-between">
            <div>
              <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.08em] text-slate-500">Operations intelligence</div>
              <Headline as="h1" size="page" sans={getPageHeader(activePath).sans} serif={getPageHeader(activePath).serif} />
              <p className="mt-4 max-w-[65ch] text-sm leading-6 text-slate-500">{getPageHeader(activePath).description}</p>
            </div>
          </div>
          <OutletRoutes />
        </main>
      </div>
    </div>
  )
}

function OutletRoutes() {
  const location = useLocation()
  const paths = location.pathname

  if (paths === '/app/dashboard') return <DashboardPage />
  if (paths === '/app/copilot') return <CopilotPage />
  if (paths === '/app/risks') return <RisksPage />
  if (paths === '/app/opportunities') return <OpportunitiesPage />
  if (paths === '/app/actions') return <ActionCenterPage />
  if (paths === '/app/documents') return <DocumentsPage />
  if (paths === '/app/data-sources') return <DataSourcesPage />
  if (paths === '/app/notifications') return <NotificationsPage />
  if (paths === '/app/audit-logs') return <AuditLogsPage />
  if (paths === '/app/settings') return <SettingsPage />
  if (paths === '/app/profile') return <ProfilePage />
  if (paths === '/app/investigations') return <InvestigationsPage />
  if (paths === '/app/analytics') return <AnalyticsPage />
  if (paths === '/app/documents/upload') return <DocumentUploadPage />
  if (paths === '/app/data-sources/new') return <DataSourceWizardPage />
  if (paths.startsWith('/app/risks/')) return <RiskDetailPage />
  if (paths.startsWith('/app/actions/')) return <ActionDetailPage />
  if (paths.startsWith('/app/copilot/')) return <InvestigationDetailPage />
  if (paths.startsWith('/app/investigations/')) return <InvestigationDetailPage />
  if (paths.startsWith('/app/opportunities/')) return <OpportunityDetailPage />
  if (paths.startsWith('/app/documents/')) return <DocumentDetailPage />
  if (paths.startsWith('/app/data-sources/')) return <DataSourceDetailPage />
  return <DashboardPage />
}

function getPageHeader(page: string) {
  const map: Record<string, { sans: string; serif: string; description: string }> = {
    '/app/dashboard': { sans: 'Good morning,', serif: "here's your day.", description: 'A clear view of the signals, risks, and decisions that need your attention.' },
    '/app/copilot': { sans: 'Ask anything', serif: 'about operations.', description: 'Investigate a question with evidence from across your connected operations.' },
    '/app/risks': { sans: 'What needs', serif: 'attention.', description: 'Review the operational risks that may affect service, cost, or delivery.' },
    '/app/opportunities': { sans: 'Where you', serif: 'can grow.', description: 'Find practical opportunities to improve margin, output, and customer experience.' },
    '/app/actions': { sans: 'Your decisions,', serif: 'in control.', description: 'Review, approve, and track actions proposed by your operations team.' },
    '/app/documents': { sans: 'Your knowledge,', serif: 'searchable.', description: 'Keep operational documents discoverable and connected to every investigation.' },
    '/app/data-sources': { sans: 'Everything', serif: 'connected.', description: 'Manage the systems and data sources that power your operating picture.' },
    '/app/notifications': { sans: 'Signals worth', serif: 'seeing.', description: 'Stay close to new risks, approvals, and changes across the workspace.' },
    '/app/audit-logs': { sans: 'Every step,', serif: 'on record.', description: 'Trace the decisions, changes, and approvals behind your operations.' },
    '/app/settings': { sans: 'Make it', serif: 'yours.', description: 'Shape your workspace, permissions, and operating preferences.' },
    '/app/profile': { sans: 'Your work,', serif: 'your profile.', description: 'Manage your identity and account details.' },
  }
  return map[page] ?? { sans: 'Your operations', serif: 'in focus.', description: 'A focused view of your operational intelligence workspace.' }
}

function DashboardPage() {
  const [liveRisks, setLiveRisks] = useState<RiskItem[]>([])
  const [liveActions, setLiveActions] = useState<Array<(typeof actionList)[number]>>([])
  const [liveDataConnected, setLiveDataConnected] = useState(false)

  useEffect(() => {
    let unsubscribeRisks: (() => void) | undefined
    let unsubscribeActions: (() => void) | undefined
    let cancelled = false

    void getCurrentOrgId().then((orgId) => {
      if (!orgId || cancelled) return
      unsubscribeRisks = subscribeToOrgCollection<RiskItem>('risks', orgId, (items) => {
        setLiveRisks(items)
        setLiveDataConnected(true)
      }, () => setLiveDataConnected(false))
      unsubscribeActions = subscribeToOrgCollection<(typeof actionList)[number]>('actions', orgId, (items) => {
        setLiveActions(items)
        setLiveDataConnected(true)
      }, () => setLiveDataConnected(false))
    })

    return () => {
      cancelled = true
      unsubscribeRisks?.()
      unsubscribeActions?.()
    }
  }, [])

  const dashboardRisks = liveRisks.length > 0 ? liveRisks : riskList
  const dashboardActions = liveActions.length > 0 ? liveActions : actionList

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>{liveDataConnected ? 'Live workspace data' : 'Showing seeded workspace data'}</span>
        <span className={cn('h-2 w-2 rounded-full', liveDataConnected ? 'bg-emerald-500' : 'bg-amber-500')} aria-label={liveDataConnected ? 'Live data connected' : 'Seeded data'} />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between text-sm text-slate-500"><span>{kpi.label}</span><span className="font-medium text-emerald-500">{kpi.trend}</span></div>
            <div className="mt-3 text-3xl font-semibold text-slate-900">{kpi.value}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">Operational health</h3>
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">Attention required</span>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid stroke="#e2e8f0" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="production" stroke="#4F46E5" strokeWidth={3} />
                <Line type="monotone" dataKey="downtime" stroke="#F59E0B" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center justify-between"><h3 className="text-lg font-semibold text-slate-900">Critical risks</h3><Link to="/app/risks" className="text-sm font-medium text-indigo-600">View all</Link></div>
          <div className="space-y-3">
            {dashboardRisks.map((risk) => (
              <div key={risk.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-800">{risk.title}</span>
                  <span className={cn('rounded-full px-2 py-1 text-[10px] font-semibold', risk.severity === 'Critical' ? 'bg-red-100 text-red-700' : risk.severity === 'High' ? 'bg-orange-100 text-orange-700' : 'bg-amber-100 text-amber-700')}>{risk.severity}</span>
                </div>
                <p className="mt-2 text-sm text-slate-600">{risk.impact}</p>
                <div className="mt-3 flex gap-2">
                  <Link to="/app/copilot" className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white">Investigate</Link>
                  <Link to={`/app/risks/${risk.id}`} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700">View Risk</Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center justify-between"><h3 className="text-lg font-semibold text-slate-900">AI insights</h3><Link to="/app/copilot" className="text-sm font-medium text-indigo-600">View investigation</Link></div>
          <div className="rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-50 p-4">
            <p className="text-sm text-slate-600">The production drop is driven by a motor failure and packaging delay. These factors explain 76% of the variance in output for the period.</p>
            <div className="mt-4 flex gap-3 text-xs text-slate-600">
              <span className="rounded-full bg-white px-2 py-1">Downtime +31 hrs</span>
              <span className="rounded-full bg-white px-2 py-1">Supplier delay +7d</span>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Recent actions</h3>
          <div className="mt-5 space-y-3">
            {dashboardActions.map((action) => (
              <div key={action.id} className="flex items-center justify-between rounded-2xl border border-slate-200 p-3">
                <div>
                  <div className="text-sm font-medium text-slate-800">{action.title}</div>
                  <div className="text-xs text-slate-500">{action.requestedBy}</div>
                </div>
                <span className={cn('rounded-full px-2 py-1 text-[10px] font-semibold capitalize', action.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : action.status === 'completed' ? 'bg-sky-100 text-sky-700' : 'bg-amber-100 text-amber-700')}>{action.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">Ask Copilot</h3>
          <button className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700">+ Quick prompt</button>
        </div>
        <div className="flex gap-3">
          <input className="flex-1 rounded-xl border border-slate-200 px-3 py-2.5" placeholder="Why did production fall this month?" />
          <Link to="/app/copilot" className="rounded-xl bg-indigo-600 px-4 py-2.5 font-semibold text-white">Investigate</Link>
        </div>
      </div>
    </div>
  )
}

function CopilotPage() {
  const navigate = useNavigate()
  const [question, setQuestion] = useState('Why did production fall this month?')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleInvestigate = () => {
    if (question.trim().length < 3) {
      setError('Ask a question with at least three characters.')
      return
    }
    setLoading(true)
    setError('')
    void startInvestigation(question.trim())
      .then((investigationId) => navigate(`/app/copilot/${investigationId}`))
      .catch((requestError: unknown) => setError(firebaseErrorMessage(requestError)))
      .finally(() => setLoading(false))
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Ask the AI copilot</h3>
        <textarea rows={4} value={question} onChange={(event) => setQuestion(event.target.value)} className="mt-4 w-full rounded-2xl border border-slate-200 p-3" />
        <div className="mt-4 flex flex-wrap gap-3">
          {['Why did production fall this month?', 'Which suppliers are delaying?', 'Which SKUs should we prioritize?'].map((suggestion) => (
            <button type="button" key={suggestion} onClick={() => setQuestion(suggestion)} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-700">{suggestion}</button>
          ))}
        </div>
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        <div className="mt-5 flex justify-end"><button type="button" disabled={loading} onClick={handleInvestigate} className="rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white disabled:opacity-60">{loading ? 'Investigating...' : 'Send investigation'}</button></div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {investigationList.map((item) => (
          <Link to={`/app/copilot/${item.id}`} key={item.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between"><span className="text-sm font-medium text-indigo-600">{item.id}</span><span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold text-emerald-700">{item.status}</span></div>
            <h3 className="mt-3 text-lg font-semibold text-slate-900">{item.title}</h3>
            <p className="mt-2 text-sm text-slate-600">{item.summary}</p>
            <div className="mt-4 text-xs text-slate-500">{item.createdAt}</div>
          </Link>
        ))}
      </div>
    </div>
  )
}

function InvestigationDetailPage() {
  const params = useLocation().pathname
  const investigationId = params.split('/').filter(Boolean).pop() || 'INV-1024'
  const [liveInvestigation, setLiveInvestigation] = useState<InvestigationRecord | null>(null)

  useEffect(() => subscribeToDocument<InvestigationRecord>('investigations', investigationId, (item) => setLiveInvestigation(item), () => setLiveInvestigation(null)), [investigationId])

  const fallbackInvestigation = investigationList.find((item) => item.id === investigationId) ?? investigationList[0]
  const question = liveInvestigation?.question ?? fallbackInvestigation.title
  const summary = liveInvestigation?.summary ?? 'Production fell by 18% due to a combination of motor downtime, inventory shortages, and supplier delays. The evidence points to short-term operational disruption rather than systemic sales demand collapse.'
  const findings = liveInvestigation?.findings ?? [
    'Machine M-104 recorded 43 hours of downtime compared to 12 hours prior month.',
    'Motor stock is only 8 days remaining and 520 units short of the target buffer.',
    'Packaging supplier delay is 7 days, creating dispatch risk.',
  ]
  const recommendations = liveInvestigation?.recommendations ?? ['Prioritize maintenance ticket M-104', 'Escalate packaging procurement', 'Rebalance production schedules']

  const steps = [
    { label: 'Understanding the request', status: 'done' },
    { label: 'Collecting evidence', status: 'done' },
    { label: 'Assessing risk and opportunity', status: 'active' },
    { label: 'Drafting recommendation', status: 'pending' },
  ]
  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <div className="font-mono text-sm text-slate-500">Investigation {investigationId}</div>
            <h2 className="text-2xl font-semibold text-slate-900">{question}</h2>
          </div>
          <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold capitalize text-indigo-700">{liveInvestigation?.status ?? 'running'}</span>
        </div>

        <div className="space-y-3">
          {steps.map((step) => (
            <div key={step.label} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm">
              <div className={cn('flex h-6 w-6 items-center justify-center rounded-full', step.status === 'done' ? 'bg-emerald-100 text-emerald-700' : step.status === 'active' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-500')}>
                {step.status === 'done' ? '✓' : step.status === 'active' ? '●' : '○'}
              </div>
              <span className="font-medium text-slate-700">{step.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Summary</h3>
            <p className="mt-3 leading-7 text-slate-600">{summary}</p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Key findings</h3>
            <ol className="mt-4 space-y-3 text-slate-700">
              {findings.map((finding, index) => <li key={finding}>{index + 1}. {finding}</li>)}
            </ol>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Recommendations</h3>
            <ul className="mt-4 space-y-3 text-slate-700">
              {recommendations.map((recommendation) => <li key={recommendation}>• {recommendation}</li>)}
            </ul>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Evidence</h3>
          <div className="mt-4 space-y-3">
            {[{ source: 'Maintenance Report', detail: 'Machine M-104 downtime: 43 hrs', value: 'vs 12 hrs prior month' }, { source: 'Inventory ledger', detail: 'Motor stock remaining: 8 days', value: '520 units short' }, { source: 'Supplier contract', detail: 'Packaging lead time changed to 7 days', value: 'shipment at risk' }].map((item, idx) => (
              <button key={idx} className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-left">
                <div className="text-sm font-medium text-slate-800">{item.source}</div>
                <div className="mt-1 text-sm text-slate-600">{item.detail}</div>
                <div className="mt-2 text-xs text-indigo-600">{item.value}</div>
              </button>
            ))}
          </div>
          <Link to="/app/actions/ACT-2301/review" className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white">Create Action</Link>
        </div>
      </div>
    </div>
  )
}

function InvestigationsPage() {
  return <div className="space-y-4">{investigationList.map((item) => <Link to={`/app/investigations/${item.id}`} key={item.id} className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><h3 className="font-semibold text-slate-900">{item.title}</h3><span className="text-xs text-slate-500">{item.status}</span></div><p className="mt-2 text-sm text-slate-600">{item.summary}</p></Link>)}</div>
}

function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex flex-wrap gap-3">
          <select className="rounded-xl border border-slate-200 px-3 py-2 text-sm"><option>Production</option></select>
          <select className="rounded-xl border border-slate-200 px-3 py-2 text-sm"><option>Last 6 months</option></select>
          <select className="rounded-xl border border-slate-200 px-3 py-2 text-sm"><option>Compare to previous</option></select>
          <button className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">Export CSV</button>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid stroke="#e2e8f0" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="production" fill="#4F46E5" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">AI analysis</h3>
        <p className="mt-3 text-slate-600">Production declined across the last 6 months and is now 18% below the previous period. The most material pressure is machine downtime and a tight inventory position on critical motors.</p>
        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-sm text-slate-500">Natural-language query</div>
          <input className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5" defaultValue="Show declining sales" />
        </div>
      </div>
    </div>
  )
}

function RisksPage() {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-4">
        {['Critical', 'High', 'Medium', 'Low'].map((label, index) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-sm text-slate-500">{label}</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">{[3, 7, 18, 31][index]}</div>
          </div>
        ))}
      </div>
      <div className="space-y-4">
        {riskList.map((risk) => (
          <Link to={`/app/risks/${risk.id}`} key={risk.id} className="block rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between"><div className="flex items-center gap-3"><span className={cn('rounded-full px-2 py-1 text-[10px] font-semibold', risk.severity === 'Critical' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700')}>{risk.severity}</span><span className="text-sm text-slate-500">{risk.id}</span></div><span className="text-sm text-slate-500">{risk.status}</span></div>
            <h3 className="mt-3 text-lg font-semibold text-slate-900">{risk.title}</h3>
            <p className="mt-2 text-sm text-slate-600">{risk.impact}</p>
            <div className="mt-3 text-sm text-indigo-600">{risk.recommendation}</div>
          </Link>
        ))}
      </div>
    </div>
  )
}

function RiskDetailPage() {
  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div><span className="rounded-full bg-red-100 px-2 py-1 text-[10px] font-semibold text-red-700">Critical</span><h2 className="mt-3 text-2xl font-semibold text-slate-900">Motor inventory shortfall at Plant 3</h2></div>
          <button className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700">Open</button>
        </div>
        <p className="mt-4 text-slate-600">Current stock covers only 8 days of operations and the plant is 520 units short of the target safety buffer.</p>
      </div>
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Trend</h3>
        <div className="mt-4 h-52"><ResponsiveContainer width="100%" height="100%"><LineChart data={[{name:'Jul', value: 95},{name:'Aug', value: 72},{name:'Sep', value: 54}]}><CartesianGrid stroke="#e2e8f0" /><XAxis dataKey="name" /><Tooltip /><Line dataKey="value" stroke="#DC2626" strokeWidth={3} /></LineChart></ResponsiveContainer></div>
      </div>
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Recommended actions</h3>
        <ul className="mt-3 space-y-2 text-slate-700"><li>• Create emergency procurement request for 520 motors.</li><li>• Schedule maintenance inspection for M-104 and service the line before next shift.</li></ul>
      </div>
    </div>
  )
}

function OpportunitiesPage() {
  return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{opportunityList.map((item) => <div key={item.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="text-sm text-indigo-600 font-medium">{item.type}</div><h3 className="mt-2 text-lg font-semibold text-slate-900">{item.title}</h3><p className="mt-2 text-sm text-slate-600">{item.summary}</p><div className="mt-4 text-sm font-semibold text-emerald-600">{item.value}</div></div>)}</div>
}

function OpportunityDetailPage() {
  return <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-2xl font-semibold text-slate-900">Product A demand surge</h2><p className="mt-3 text-slate-600">Demand for high-margin Product A is up 24% in the East region while inventory remains thin. A replenishment sequence can preserve margin and prevent stock-outs.</p><p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Estimates are based on current data and are not guaranteed outcomes.</p></div>
}

function ActionCenterPage() {
  return <div className="space-y-4">{actionList.map((action) => <Link to={`/app/actions/${action.id}`} key={action.id} className="block rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div><div className="text-sm font-semibold text-slate-900">{action.title}</div><div className="text-xs text-slate-500">{action.requestedBy}</div></div><span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-semibold capitalize text-amber-700">{action.status}</span></div><p className="mt-3 text-sm text-slate-600">{action.reason}</p></Link>)}</div>
}

function ActionReviewPage() {
  return <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-2xl font-semibold text-slate-900">Create maintenance ticket for line 3 motor</h2><div className="mt-4 grid gap-4 md:grid-cols-2"><div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">Required permission: Approve actions</div><div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">Priority: High</div></div><div className="mt-6 flex gap-3"><button className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white">Approve</button><button className="flex-1 rounded-xl bg-red-600 px-4 py-3 font-semibold text-white">Reject</button></div></div>
}

function ActionDetailPage() {
  return <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-2xl font-semibold text-slate-900">Action detail</h2><p className="mt-3 text-slate-600">Maintenance ticket has been approved and execution is in progress.</p><div className="mt-4 rounded-2xl bg-slate-50 p-4 font-mono text-sm">MT-10482</div></div>
}

function DocumentsPage() {
  const [liveDocuments, setLiveDocuments] = useState<Array<DocumentRecord & { id: string }>>([])

  useEffect(() => {
    let unsubscribe: (() => void) | undefined
    void getCurrentOrgId().then((orgId) => {
      if (orgId) unsubscribe = subscribeToOrgCollection<DocumentRecord>('documents', orgId, setLiveDocuments, () => setLiveDocuments([]))
    })
    return () => unsubscribe?.()
  }, [])

  const items = liveDocuments.length > 0 ? liveDocuments : documents
  return <div className="space-y-4">{items.map((document) => <Link to={`/app/documents/${document.id}`} key={document.id} className="block rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div><div className="font-semibold text-slate-900">{document.name}</div><div className="text-xs text-slate-500">{document.department}</div></div><span className="rounded-full bg-sky-100 px-2 py-1 text-[10px] font-semibold text-sky-700">{document.status}</span></div><div className="mt-3 text-sm text-slate-600">Type: {document.type} · Uploaded: {document.uploaded || 'Available in workspace'}</div></Link>)}</div>
}

function DocumentUploadPage() {
  return <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-2xl font-semibold text-slate-900">Upload document</h2><div className="mt-5 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-8 text-center"><Upload className="mx-auto h-10 w-10 text-slate-400" /><div className="mt-3 text-sm text-slate-600">Drag & drop or browse to upload PDF, DOCX, XLSX, CSV, TXT files</div></div><button className="mt-6 rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white">Upload and process</button></div>
}

function DocumentDetailPage() {
  const documentId = useLocation().pathname.split('/').filter(Boolean).pop() || 'DOC-18'
  const [document, setDocument] = useState<(DocumentRecord & { id: string }) | null>(null)

  useEffect(() => subscribeToDocument<DocumentRecord>('documents', documentId, setDocument, () => setDocument(null)), [documentId])

  const fallback = documents.find((item) => item.id === documentId) ?? documents[0]
  const name = document?.name ?? fallback.name
  const status = document?.status ?? fallback.status
  const type = document?.type ?? fallback.type
  const chunks = document?.chunkCount ?? 18
  const department = document?.department ?? fallback.department

  return <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-4"><div><div className="font-mono text-sm text-slate-500">Document {documentId}</div><h2 className="mt-2 text-2xl font-semibold text-slate-900">{name}</h2></div><span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold capitalize text-emerald-700">{status}</span></div><div className="mt-4 grid gap-4 md:grid-cols-3"><div className="rounded-xl border border-slate-200 bg-slate-50 p-4">Type: {type}</div><div className="rounded-xl border border-slate-200 bg-slate-50 p-4">Chunks: {chunks}</div><div className="rounded-xl border border-slate-200 bg-slate-50 p-4">Department: {department}</div></div><div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">This document is indexed for Copilot retrieval. Its contents can be used as evidence when investigating operational questions.</div></div>
}

function DataSourcesPage() {
  return <div className="space-y-4"><Link to="/app/data-sources/new" className="inline-flex rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white">Add Data Source</Link>{['PostgreSQL', 'CSV', 'ERP', 'CRM'].map((name) => <div key={name} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div className="font-semibold text-slate-900">{name}</div><span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold text-emerald-700">Connected</span></div></div>)}</div>
}

function DataSourceWizardPage() {
  return <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-2xl font-semibold text-slate-900">Add source</h2><div className="mt-5 space-y-4"><input className="w-full rounded-xl border border-slate-200 px-3 py-2.5" placeholder="Source name" /><input className="w-full rounded-xl border border-slate-200 px-3 py-2.5" placeholder="Connection URL" /><button className="rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white">Test connection</button></div></div>
}

function DataSourceDetailPage() {
  return <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-2xl font-semibold text-slate-900">PostgreSQL</h2><p className="mt-3 text-slate-600">Connected to the production warehouse database with validated schema access.</p></div>
}

function NotificationsPage() {
  return <div className="space-y-3">{notifications.map((n) => <div key={n.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><div className="font-medium text-slate-900">{n.title}</div>{!n.read && <span className="h-2.5 w-2.5 rounded-full bg-indigo-600" />}</div><p className="mt-2 text-sm text-slate-600">{n.body}</p></div>)}</div>
}

function AuditLogsPage() {
  return <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex gap-3"><input className="flex-1 rounded-xl border border-slate-200 px-3 py-2.5" placeholder="Filter by event" /><button className="rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white">Export CSV</button></div><div className="overflow-hidden rounded-2xl border border-slate-200"><table className="w-full text-left text-sm"><thead className="bg-slate-50"><tr><th className="p-3">Time</th><th className="p-3">User</th><th className="p-3">Event</th><th className="p-3">Resource</th><th className="p-3">Status</th></tr></thead><tbody>{auditLogs.map((log) => <tr key={log.time} className="border-t border-slate-200"><td className="p-3">{log.time}</td><td className="p-3">{log.user}</td><td className="p-3">{log.event}</td><td className="p-3">{log.resource}</td><td className="p-3 text-emerald-700">{log.status}</td></tr>)}</tbody></table></div></div>
}

function SettingsPage() {
  return <div className="space-y-4"><div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="text-lg font-semibold text-slate-900">Organization</h3><div className="mt-4 grid gap-4 md:grid-cols-2"><div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">Industry: Manufacturing</div><div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">Primary use case: Production monitoring</div></div></div><div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="text-lg font-semibold text-slate-900">AI Configuration</h3><div className="mt-4 space-y-3"><label className="flex items-center gap-3 text-sm text-slate-700"><input type="checkbox" defaultChecked /> Read Data</label><label className="flex items-center gap-3 text-sm text-slate-700"><input type="checkbox" defaultChecked /> Create Tasks</label><label className="flex items-center gap-3 text-sm text-slate-700"><input type="checkbox" defaultChecked /> Send Emails requires approval</label></div></div></div>
}

function ProfilePage() {
  return <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-2xl font-semibold text-slate-900">Profile</h2><div className="mt-5 grid gap-4 md:grid-cols-2"><div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><label className="block text-sm font-medium text-slate-700">Display name</label><input className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5" defaultValue="Aditi S." /></div><div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><label className="block text-sm font-medium text-slate-700">Department</label><input className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5" defaultValue="Operations" /></div></div></div>
}

function UnauthorizedPage() {
  return <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm"><ShieldX className="mx-auto h-10 w-10 text-red-500" /><Headline className="mt-4" sans="Access" serif="not allowed." size="section" /><p className="mt-4 text-slate-600">You don't have permission to access this information.</p></div>
}

function NotFoundPage() {
  return <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6"><div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm"><Headline sans="Page" serif="not found." size="section" /><Link to="/" className="mt-6 inline-flex rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white">Go home</Link></div></div>
}

function LegalPage({ title }: { title: string }) {
  return <div className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm"><Headline as="h1" sans={title} serif="for your peace of mind." size="page" /><p className="mt-6 text-slate-600">This demo legal page is included to complete the public route set for the app. Replace with your final legal language before production deployment.</p></div>
}

export default App
