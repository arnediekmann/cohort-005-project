// PROTOTYPE: three variants of the Notification Feed, switchable via ?variant=A|B|C.
// Answers "What do the bell and Notification Feed look like in Cadence?".
// Stub data in memory, no Knock, no persistence. Throwaway: lives on branch prototype/notification-feed.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router";
import {
  Archive,
  Bell,
  CheckCheck,
  MessageSquareReply,
  Receipt,
  ReceiptText,
  UsersRound,
  X,
} from "lucide-react";
import { UserRole } from "~/db/schema";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { PrototypeSwitcher } from "~/components/prototype-switcher";

type Kind =
  | "refund-request-decided"
  | "refund-request-raised"
  | "instructor-reply"
  | "all-seats-claimed";

type Notification = {
  id: string;
  kind: Kind;
  title: string;
  body: string;
  href: string;
  cta: string;
  minutesAgo: number;
  read: boolean;
  archived: boolean;
};

const ICONS: Record<Kind, ReactNode> = {
  "refund-request-decided": <ReceiptText className="size-4" />,
  "refund-request-raised": <Receipt className="size-4" />,
  "instructor-reply": <MessageSquareReply className="size-4" />,
  "all-seats-claimed": <UsersRound className="size-4" />,
};

// ponytail: hrefs point at list pages so stub clicks never 404; real build uses the decided deep links.
function stubFeed(role: UserRole | null, isTeamAdmin: boolean): Notification[] {
  const n = (p: Omit<Notification, "read" | "archived">, read = false) => ({
    ...p,
    read,
    archived: false,
  });
  const feed: Notification[] = [];
  if (role === UserRole.Student) {
    feed.push(
      n({
        id: "s1",
        kind: "instructor-reply",
        title: "Your instructor replied to your question",
        body: '"Good catch: the generic constraint should be `extends object`. I\'ll update the lesson." — Advanced TypeScript, Lesson 4',
        href: "/courses",
        cta: "View reply",
        minutesAgo: 12,
      }),
      n({
        id: "s2",
        kind: "refund-request-decided",
        title: "Refund Request approved",
        body: "Your Refund Request for React Fundamentals was approved. The full amount will be returned to you.",
        href: "/settings",
        cta: "See details",
        minutesAgo: 180,
      }),
      n(
        {
          id: "s3",
          kind: "refund-request-decided",
          title: "Refund Request declined",
          body: "Your Refund Request for Node in Production was declined: you've passed the Watch Limit.",
          href: "/settings",
          cta: "See details",
          minutesAgo: 60 * 26,
        },
        true
      ),
      n(
        {
          id: "s4",
          kind: "instructor-reply",
          title: "Your instructor replied to your question",
          body: '"Yes, the starter repo works with Node 22." — Node in Production, Lesson 1',
          href: "/courses",
          cta: "View reply",
          minutesAgo: 60 * 24 * 5,
        },
        true
      )
    );
  }
  if (isTeamAdmin) {
    feed.push(
      n({
        id: "t1",
        kind: "all-seats-claimed",
        title: "All Seats claimed",
        body: "All 10 Seats on your Team Licence for Advanced TypeScript are claimed. Buy another Team Licence to add people.",
        href: "/team",
        cta: "Open team",
        minutesAgo: 45,
      })
    );
  }
  if (role === UserRole.Admin) {
    feed.push(
      n({
        id: "a1",
        kind: "refund-request-raised",
        title: "New Refund Request",
        body: "Priya Shah asked for a refund on React Fundamentals (Individual Purchase, $49).",
        href: "/admin/refunds",
        cta: "Review",
        minutesAgo: 3,
      }),
      n({
        id: "a2",
        kind: "refund-request-raised",
        title: "New Refund Request",
        body: "Acme Ltd asked for a refund on a Team Licence for Advanced TypeScript (10 Seats, $890).",
        href: "/admin/refunds",
        cta: "Review",
        minutesAgo: 95,
      }),
      n(
        {
          id: "a3",
          kind: "refund-request-raised",
          title: "New Refund Request",
          body: "Tom Becker asked for a refund on Node in Production (Individual Purchase, $79).",
          href: "/admin/refunds",
          cta: "Review",
          minutesAgo: 60 * 30,
        },
        true
      )
    );
  }
  // Instructors get no Notifications in v1: their feed shows the empty state.
  return feed;
}

function ago(min: number) {
  if (min < 60) return `${min}m ago`;
  if (min < 60 * 24) return `${Math.floor(min / 60)}h ago`;
  return `${Math.floor(min / 60 / 24)}d ago`;
}

function useFeed(role: UserRole | null, isTeamAdmin: boolean, userId?: number) {
  const [items, setItems] = useState(() => stubFeed(role, isTeamAdmin));
  // DevUI user switch: reset the stub feed, like KnockProvider remounting.
  useEffect(() => setItems(stubFeed(role, isTeamAdmin)), [userId, role, isTeamAdmin]);
  const set = (id: string, patch: Partial<Notification>) =>
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  return {
    items,
    visible: items.filter((x) => !x.archived),
    unread: items.filter((x) => !x.read && !x.archived).length,
    markRead: (id: string) => set(id, { read: true }),
    toggleRead: (id: string) =>
      setItems((xs) => xs.map((x) => (x.id === id ? { ...x, read: !x.read } : x))),
    archive: (id: string) => set(id, { archived: true, read: true }),
    unarchive: (id: string) => set(id, { archived: false }),
    markAllRead: () => setItems((xs) => xs.map((x) => ({ ...x, read: true }))),
  };
}
type Feed = ReturnType<typeof useFeed>;

function CountBadge({ n, className }: { n: number; className?: string }) {
  if (n === 0) return null;
  return (
    <span
      className={cn(
        "flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold leading-none text-white",
        className
      )}
    >
      {n > 9 ? "9+" : n}
    </span>
  );
}

function Empty() {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center text-sm text-muted-foreground">
      <Bell className="size-6 opacity-40" />
      You're all caught up.
    </div>
  );
}

// ─── Variant A: bell in the sidebar header, compact popover ───

function VariantA({ feed, slot }: { feed: Feed; slot: (s: Slots) => ReactNode }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (ref.current?.contains(t) || t.closest("[data-bell]")) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const bell = (
    <button
      data-bell
      onClick={() => setOpen((o) => !o)}
      aria-label={`Notifications, ${feed.unread} unread`}
      className="relative rounded-md p-1.5 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
    >
      <Bell className="size-4" />
      <CountBadge n={feed.unread} className="absolute -right-1 -top-1" />
    </button>
  );

  return (
    <>
      {slot({ headerSlot: bell })}
      {open && (
        <div
          ref={ref}
          className="fixed left-[13.5rem] top-2 z-50 w-96 overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-xl"
        >
          <div className="flex items-center justify-between border-b px-4 py-2.5">
            <span className="text-sm font-semibold">Notifications</span>
            <button
              onClick={feed.markAllRead}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Mark all as read
            </button>
          </div>
          <div className="max-h-[28rem] overflow-y-auto">
            {feed.visible.length === 0 && <Empty />}
            {feed.visible.map((x) => (
              <div
                key={x.id}
                onClick={() => {
                  feed.markRead(x.id);
                  setOpen(false);
                  navigate(x.href);
                }}
                className={cn(
                  "group relative flex cursor-pointer gap-3 border-b px-4 py-3 last:border-0 hover:bg-accent",
                  !x.read && "bg-primary/5"
                )}
              >
                <div className="mt-0.5 text-muted-foreground">{ICONS[x.kind]}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    {x.title}
                    {!x.read && <span className="size-1.5 rounded-full bg-blue-600" />}
                  </div>
                  <p className="line-clamp-2 text-xs text-muted-foreground">{x.body}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground/70">{ago(x.minutesAgo)}</p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    feed.archive(x.id);
                  }}
                  aria-label="Archive"
                  className="invisible absolute right-2 top-2 rounded p-1 text-muted-foreground hover:bg-background group-hover:visible"
                >
                  <Archive className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

// ─── Variant B: sidebar nav item, right-hand drawer with tabs and action buttons ───

function VariantB({ feed, slot }: { feed: Feed; slot: (s: Slots) => ReactNode }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"unread" | "all" | "archived">("unread");
  const navigate = useNavigate();

  const list =
    tab === "unread"
      ? feed.items.filter((x) => !x.read && !x.archived)
      : tab === "all"
        ? feed.visible
        : feed.items.filter((x) => x.archived);
  const today = list.filter((x) => x.minutesAgo < 60 * 24);
  const earlier = list.filter((x) => x.minutesAgo >= 60 * 24);

  const navItem = (
    <button
      onClick={() => setOpen(true)}
      className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
    >
      <Bell className="size-4" />
      Notifications
      <CountBadge n={feed.unread} className="ml-auto" />
    </button>
  );

  const group = (label: string, xs: Notification[]) =>
    xs.length > 0 && (
      <div>
        <div className="px-5 pb-1 pt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        {xs.map((x) => (
          <div key={x.id} className="mx-3 mb-2 rounded-lg border p-3">
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full",
                  x.read ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground"
                )}
              >
                {ICONS[x.kind]}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{x.title}</div>
                <p className="text-sm text-muted-foreground">{x.body}</p>
                <div className="mt-2 flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      feed.markRead(x.id);
                      setOpen(false);
                      navigate(x.href);
                    }}
                  >
                    {x.cta}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => feed.toggleRead(x.id)}>
                    {x.read ? "Mark unread" : "Mark read"}
                  </Button>
                  {x.archived ? (
                    <Button size="sm" variant="ghost" onClick={() => feed.unarchive(x.id)}>
                      Unarchive
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => feed.archive(x.id)}>
                      Archive
                    </Button>
                  )}
                  <span className="ml-auto text-xs text-muted-foreground">{ago(x.minutesAgo)}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );

  return (
    <>
      {slot({ navSlot: navItem })}
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={() => setOpen(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex h-full w-[28rem] flex-col border-l bg-background shadow-2xl"
          >
            <div className="flex items-center justify-between border-b px-5 py-4">
              <span className="text-base font-semibold">Notifications</span>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" onClick={feed.markAllRead}>
                  <CheckCheck className="size-4" /> Mark all as read
                </Button>
                <Button size="icon" variant="ghost" onClick={() => setOpen(false)}>
                  <X className="size-4" />
                </Button>
              </div>
            </div>
            <div className="flex gap-1 border-b px-4 py-2">
              {(["unread", "all", "archived"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={cn(
                    "rounded-md px-3 py-1 text-sm capitalize",
                    tab === t ? "bg-accent font-medium" : "text-muted-foreground hover:bg-accent/50"
                  )}
                >
                  {t}
                  {t === "unread" && feed.unread > 0 && ` (${feed.unread})`}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto pb-20">
              {list.length === 0 && <Empty />}
              {group("Today", today)}
              {group("Earlier", earlier)}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Variant C: full Notification Feed page, list + detail ───

function VariantC({ feed, slot }: { feed: Feed; slot: (s: Slots) => ReactNode }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const navigate = useNavigate();
  const current = feed.visible.find((x) => x.id === selected) ?? null;

  const navItem = (
    <button
      onClick={() => setOpen((o) => !o)}
      className={cn(
        "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        open
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      )}
    >
      <Bell className="size-4" />
      Notifications
      {feed.unread > 0 && (
        <span className="ml-auto text-xs font-semibold text-primary">{feed.unread} new</span>
      )}
    </button>
  );

  return (
    <>
      {slot({ navSlot: navItem })}
      {open && (
        // Stands in for a real /notifications route covering the main area.
        <div className="fixed bottom-0 left-56 right-0 top-0 z-40 flex flex-col bg-background">
          <div className="flex items-center justify-between border-b px-8 py-5">
            <div>
              <h1 className="text-2xl font-bold">Notifications</h1>
              <p className="text-sm text-muted-foreground">
                {feed.unread} unread of {feed.visible.length}
              </p>
            </div>
            <Button variant="outline" onClick={feed.markAllRead}>
              <CheckCheck className="size-4" /> Mark all as read
            </Button>
          </div>
          <div className="flex min-h-0 flex-1">
            <div className="w-96 shrink-0 overflow-y-auto border-r">
              {feed.visible.length === 0 && <Empty />}
              {feed.visible.map((x) => (
                <button
                  key={x.id}
                  onClick={() => {
                    setSelected(x.id);
                    feed.markRead(x.id);
                  }}
                  className={cn(
                    "flex w-full gap-3 border-b px-5 py-3 text-left hover:bg-accent",
                    selected === x.id && "bg-accent"
                  )}
                >
                  <span
                    className={cn(
                      "mt-1.5 size-2 shrink-0 rounded-full",
                      x.read ? "bg-transparent" : "bg-blue-600"
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <div className={cn("truncate text-sm", !x.read && "font-semibold")}>
                      {x.title}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">{x.body}</div>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">{ago(x.minutesAgo)}</span>
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto p-10">
              {current ? (
                <div className="max-w-xl">
                  <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
                    {ICONS[current.kind]} {ago(current.minutesAgo)}
                  </div>
                  <h2 className="mb-3 text-xl font-semibold">{current.title}</h2>
                  <p className="mb-6 text-muted-foreground">{current.body}</p>
                  <div className="flex gap-2">
                    <Button onClick={() => navigate(current.href)}>{current.cta}</Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        feed.archive(current.id);
                        setSelected(null);
                      }}
                    >
                      <Archive className="size-4" /> Archive
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">Select a Notification.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Switcher ───

type Slots = { headerSlot?: ReactNode; navSlot?: ReactNode };

const VARIANTS = [
  { key: "A", name: "Bell popover" },
  { key: "B", name: "Nav item + drawer" },
  { key: "C", name: "Full page" },
];

export function NotificationFeedPrototype({
  currentUser,
  isTeamAdmin,
  render,
}: {
  currentUser: { id: number; role: UserRole } | null;
  isTeamAdmin: boolean;
  render: (slots: Slots) => ReactNode;
}) {
  const [searchParams] = useSearchParams();
  const variant = searchParams.get("variant") ?? "A";
  const feed = useFeed(currentUser?.role ?? null, isTeamAdmin, currentUser?.id);
  const archived = feed.items.filter((x) => x.archived).length;
  const status = `unread ${feed.unread} · shown ${feed.visible.length} · archived ${archived}`;

  if (!currentUser) return <>{render({})}</>;
  return (
    <>
      {variant === "A" && <VariantA feed={feed} slot={render} />}
      {variant === "B" && <VariantB feed={feed} slot={render} />}
      {variant === "C" && <VariantC feed={feed} slot={render} />}
      <PrototypeSwitcher variants={VARIANTS} status={status} />
    </>
  );
}
