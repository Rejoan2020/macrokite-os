"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { useOverlays } from "@/components/providers/OverlayProvider";
import { AvatarStack, Button, cx, EmptyNote, Page, PageHeader, SectionLabel, Summary } from "@/components/ui/primitives";
import { formatDay, formatShortDate, formatTime, pluralize, todayISO } from "@/lib/format";
import { actionItems, isOpenTask, isThisWeek, meetingBuckets, stillOpenFromLast } from "@/lib/selectors";

export function MeetingsView() {
  const { data } = useWorkspace();
  const overlays = useOverlays();
  const today = todayISO();
  const { upcoming, past } = meetingBuckets(data.meetings, today);
  const dayOf = (m) => todayISO(new Date(m.startsAt));
  const todayCount = upcoming.filter((m) => dayOf(m) === today).length;
  const weekCount = upcoming.filter((m) => isThisWeek(dayOf(m), today)).length;
  const openItems = data.tasks.filter((t) => t.meetingId && isOpenTask(t)).length;
  const next = upcoming.find((m) => dayOf(m) === today);

  return (
    <Page width="md">
      <PageHeader
        title="Meetings"
        summary={
          <Summary
            parts={[
              `${todayCount} today`,
              `${weekCount} this week`,
              openItems > 0 && <span className="text-warning-strong">{pluralize(openItems, "open action item")}</span>,
            ]}
          />
        }
        actions={
          <Button variant="primary" icon={Plus} onClick={() => overlays.newMeeting()}>
            New meeting
          </Button>
        }
      />

      {!upcoming.length && !past.length && <EmptyNote>No meetings yet. Schedule one to keep agenda, notes, decisions and action items together.</EmptyNote>}

      {upcoming.length > 0 && (
        <section aria-labelledby="m-upcoming" className="flex flex-col gap-2.5">
          <SectionLabel id="m-upcoming">Upcoming</SectionLabel>
          {upcoming.map((m) => (
            <UpcomingCard key={m._id} meeting={m} highlight={m === next} />
          ))}
        </section>
      )}

      {past.length > 0 && (
        <section aria-labelledby="m-past" className="flex flex-col gap-2.5">
          <SectionLabel id="m-past">Past</SectionLabel>
          <div className="overflow-hidden rounded-xl border border-line bg-card">
            {past.map((m) => (
              <PastRow key={m._id} meeting={m} />
            ))}
          </div>
        </section>
      )}
    </Page>
  );
}

function UpcomingCard({ meeting, highlight }) {
  const { data, lookup, activeUsers } = useWorkspace();
  const today = todayISO();
  const isToday = todayISO(new Date(meeting.startsAt)) === today;
  const open = stillOpenFromLast(meeting, data).length;
  const attendees = meeting.attendeeIds.map((id) => lookup.users[id]).filter(Boolean);
  const everyone = activeUsers.length > 2 && activeUsers.every((u) => meeting.attendeeIds.includes(u._id));
  const detail = [
    lookup.projects[meeting.projectId]?.name,
    meeting.agenda.length ? pluralize(meeting.agenda.length, "agenda item") : "No agenda yet",
    open > 0 && `${pluralize(open, "open action item")} to review`,
  ];

  return (
    <Link
      href={`/meetings/${meeting._id}`}
      className={cx("flex flex-wrap items-center gap-[18px] rounded-xl border bg-card px-[18px] py-4 transition-colors hover:bg-hover/40", highlight ? "border-decision-line" : "border-line")}
    >
      <div className="flex w-16 shrink-0 flex-col gap-0.5">
        <span className={cx("text-[11px] font-semibold tracking-[0.06em] uppercase", isToday ? "text-accent" : "text-muted")}>{formatDay(meeting.startsAt)}</span>
        <span className="font-mono text-[15px] whitespace-nowrap">{formatTime(meeting.startsAt)}</span>
      </div>
      <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-1">
        <span className="text-[15px] font-semibold">{meeting.title}</span>
        <span className="text-[13px] text-muted">{detail.filter(Boolean).join(" · ")}</span>
      </div>
      {everyone ? <span className="text-xs text-muted">Everyone</span> : <AvatarStack users={attendees} />}
    </Link>
  );
}

function outcome(meeting, tasks) {
  const items = actionItems(meeting, tasks).length;
  const parts = [meeting.decisions.length && pluralize(meeting.decisions.length, "decision"), items && pluralize(items, "action item")].filter(Boolean);
  return parts.length ? parts.join(" · ") : meeting.endedAt ? "No outcomes recorded" : "Not ended";
}

function PastRow({ meeting }) {
  const { data, lookup } = useWorkspace();
  return (
    <Link href={`/meetings/${meeting._id}`} className="flex flex-wrap items-center gap-x-[18px] gap-y-1 border-b border-row px-[18px] py-3.5 last:border-b-0 hover:bg-hover/40">
      <span className="w-16 shrink-0 font-mono text-[13px] text-muted">{formatShortDate(meeting.startsAt.slice(0, 10))}</span>
      <span className="min-w-0 flex-[1_1_220px] font-medium">{meeting.title}</span>
      <span className="text-[13px] text-muted">
        {lookup.projects[meeting.projectId]?.name} · {outcome(meeting, data.tasks)}
      </span>
    </Link>
  );
}

/** Compact row for a project's Meetings tab. */
export function MeetingRow({ meeting }) {
  const { data } = useWorkspace();
  const today = todayISO();
  const upcoming = !meeting.endedAt && todayISO(new Date(meeting.startsAt)) >= today;
  const when = upcoming ? `${formatDay(meeting.startsAt)} ${formatTime(meeting.startsAt).replace(":00 ", "")}` : formatShortDate(meeting.startsAt.slice(0, 10));
  return (
    <Link href={`/meetings/${meeting._id}`} className="flex gap-4 border-b border-row px-[18px] py-3.5 last:border-b-0 hover:bg-hover/40">
      <span className={cx("w-20 shrink-0 font-mono text-[13px]", upcoming ? "text-accent" : "text-muted")}>{when}</span>
      <span className="min-w-0 flex-1">{meeting.title}</span>
      <span className="text-[13px] text-muted">{upcoming ? (meeting.agenda.length ? pluralize(meeting.agenda.length, "topic") : "No agenda yet") : outcome(meeting, data.tasks)}</span>
    </Link>
  );
}
