import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import {
  KnockFeedProvider,
  KnockProvider,
  useKnockFeed,
  useNotificationStore,
  type Selector,
} from "@knocklabs/react";
import {
  Archive,
  Bell,
  MessageSquareReply,
  Receipt,
  ReceiptText,
  UsersRound,
} from "lucide-react";
import type { KnockFeedConfig } from "~/lib/knock-feed.server";
import type { NotificationWorkflow } from "~/lib/notifier.server";
import { cn, formatRelativeTime } from "~/lib/utils";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
} from "~/components/ui/empty";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";

// The Notification Feed: Knock's headless hooks under Cadence's own components.
// No Knock stock components or CSS, so no "Powered by Knock" footer.
export function NotificationBell({ knock }: { knock: KnockFeedConfig | null }) {
  return (
    <KnockProvider
      apiKey={knock?.publicApiKey}
      user={{ id: knock?.userId ?? "" }}
      userToken={knock?.userToken}
      enabled={knock !== null}
    >
      <KnockFeedProvider feedId={knock?.feedChannelId}>
        <Feed />
      </KnockFeedProvider>
    </KnockProvider>
  );
}

// ponytail: titles are per workflow, not per Notification; read a title from
// the template if one ever needs to vary (e.g. approved vs declined).
type WorkflowDisplay = { title: string; icon: ReactNode };
const WORKFLOWS: Record<NotificationWorkflow, WorkflowDisplay> = {
  "refund-request-decided": {
    title: "Refund Request decided",
    icon: <ReceiptText className="size-4" />,
  },
  "refund-request-raised": {
    title: "New Open Refund Request",
    icon: <Receipt className="size-4" />,
  },
  "instructor-reply": {
    title: "Instructor Reply",
    icon: <MessageSquareReply className="size-4" />,
  },
  "all-seats-claimed": {
    title: "All Seats claimed",
    icon: <UsersRound className="size-4" />,
  },
};

// Knock's feed types the workflow key as any string.
const workflowsByKey: Partial<Record<string, WorkflowDisplay>> = WORKFLOWS;

type FeedItem = Parameters<Selector<unknown>>[0]["items"][number];

function blockText(item: FeedItem, name: string) {
  const found = item.blocks.find((b) => b.name === name);
  return found && "rendered" in found ? found.rendered : "";
}

// The body block is HTML rendered by Knock; show it as plain text.
function plainText(html: string) {
  return (
    new DOMParser().parseFromString(html, "text/html").body.textContent ?? ""
  );
}

function Feed() {
  const { feedClient } = useKnockFeed();
  const { items, metadata } = useNotificationStore(feedClient);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const unread = metadata.unread_count;

  useEffect(() => {
    feedClient.fetch();
  }, [feedClient]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Notifications, ${unread} unread`}
          className="relative size-8"
        >
          <Bell />
          {unread > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-4 min-w-4 rounded-full px-1 text-[10px]"
            >
              {unread > 9 ? "9+" : unread}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent side="right" align="start" className="w-96 p-0">
        <div className="flex items-center justify-between border-b px-4 py-2.5">
          <span className="text-sm font-semibold">Notifications</span>
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0 text-xs"
            onClick={() => feedClient.markAllAsRead()}
          >
            Mark all as read
          </Button>
        </div>
        <div className="max-h-[28rem] overflow-y-auto">
          {items.length === 0 && (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Bell />
                </EmptyMedia>
                <EmptyDescription>You're all caught up.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
          {items.map((item) => {
            const workflow = workflowsByKey[item.source.key];
            const isUnread = item.read_at === null;
            const link = blockText(item, "action_url");
            return (
              <div
                key={item.id}
                role="button"
                tabIndex={0}
                onClick={() => {
                  feedClient.markAsRead(item);
                  setOpen(false);
                  if (link) navigate(link);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.click();
                }}
                className={cn(
                  "group relative flex cursor-pointer gap-3 border-b px-4 py-3 last:border-0 hover:bg-accent",
                  isUnread && "bg-primary/5"
                )}
              >
                <div className="mt-0.5 text-muted-foreground">
                  {workflow?.icon ?? <Bell className="size-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    {workflow?.title ?? "Notification"}
                    {isUnread && (
                      <span className="size-1.5 rounded-full bg-primary" />
                    )}
                  </div>
                  <p className="line-clamp-2 text-xs text-muted-foreground">
                    {plainText(blockText(item, "body"))}
                  </p>
                  <p
                    className="mt-1 text-[11px] text-muted-foreground/70"
                    suppressHydrationWarning
                  >
                    {formatRelativeTime(item.inserted_at)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Archive"
                  className="invisible absolute top-2 right-2 size-6 group-hover:visible"
                  onClick={(e) => {
                    e.stopPropagation();
                    feedClient.markAsArchived(item);
                  }}
                >
                  <Archive />
                </Button>
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
