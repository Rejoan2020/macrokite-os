"use client";

import Link from "next/link";
import { Pencil, Plus } from "lucide-react";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { useOverlays } from "@/components/providers/OverlayProvider";
import { Countdown, CopyLinkButton, ReminderMenu, shortLink } from "@/components/meetings/MeetingBits";
import { PeoplePicker, peopleOrder } from "@/components/ui/PeoplePicker";
import { Button, Card, cx, EmptyNote, IconButton, Page, PageHeader, SectionLabel } from "@/components/ui/primitives";
import { useAction } from "@/lib/client/useAction";
import { formatDay, formatShortDate, formatTime, parseDate, pluralize, todayISO } from "@/lib/format";
import { actionItems, meetingBuckets } from "@/lib/selectors";

export function MeetingsView() {
  const { data } = useWorkspace();
  const overlays = useOverlays();
  const today = todayISO();
  const { upcoming, past } = meetingBuckets(data.meetings, today);

  return (
    <Page className="gap-[14px]">
      <PageHeader
        title="Meetings"
        actions={
          <Button variant="primary" icon={Plus} onClick={() => overlays.newMeeting()}>
            New meeting
          </Button>
        }
      />

      {/* The heading sits 24px above the first card; cards are 14px apart. */}
      <div aria-hidden className="h-2.5" />
      {!upcoming.length && !past.length && <EmptyNote>No meetings yet. Schedule one to keep agenda, notes, decisions and action items together.</EmptyNote>}
      {!upcoming.length && past.length > 0 && <EmptyNote>Nothing scheduled. Press New meeting to plan the next one.</EmptyNote>}

      {upcoming.map((m) => (
        <MeetingCard key={m._id} meeting={m} />
      ))}

      {past.length > 0 && (
        <section aria-labelledby="m-past" className="flex flex-col gap-3">
          <SectionLabel id="m-past" className="px-1">
            Past meetings
          </SectionLabel>
          <Card className="overflow-hidden px-2 py-2">
            {past.map((m) => (
              <MeetingRow key={m._id} meeting={m} showProject />
            ))}
          </Card>
        </section>
      )}
    </Page>
  );
}

function MeetingCard({ meeting }) {
  const { activeUsers, currentUserId } = useWorkspace();
  const overlays = useOverlays();
  const { run } = useAction();
  const date = parseDate(meeting.startsAt).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const people = peopleOrder(activeUsers, currentUserId);
  // Attendees are added and removed right on the card, saved as you go.
  const setAttendees = (attendeeIds) => run({ type: "meeting.update", id: meeting._id, data: { attendeeIds } }, { silent: true });

  return (
    <Card as="article" aria-labelledby={`mt-${meeting._id}`} className="px-6 pt-[22px] pb-[18px]">
      <header className="flex items-start justify-between gap-5">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold tracking-[0.06em] text-faint uppercase">{date}</div>
          <h2 id={`mt-${meeting._id}`} className="mt-1.5 text-xl font-medium tracking-[-0.02em] text-strong">
            <Link href={`/meetings/${meeting._id}`} className="hover:underline hover:underline-offset-4">
              {meeting.title}
            </Link>
          </h2>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[26px] leading-[1.1] font-semibold tracking-[-0.04em] text-strong tabular-nums">{formatTime(meeting.startsAt)}</div>
          <Countdown startsAt={meeting.startsAt} className="mt-1 block" />
        </div>
        <div className="flex shrink-0 items-start gap-1.5 self-stretch border-l border-row pl-4">
          <ReminderMenu meeting={meeting} />
          <IconButton icon={Pencil} outline label="Edit meeting" onClick={() => overlays.editMeeting(meeting._id)} className="[&_svg]:size-[15px]" />
        </div>
      </header>

      <section aria-label="Attendees" className="mt-[18px]">
        <SectionLabel as="h3" className="mb-2">
          Attendees
        </SectionLabel>
        <PeoplePicker label="Add attendee" people={people} value={meeting.attendeeIds} onChange={setAttendees} />
      </section>

      <section aria-label="Agenda" className="mt-[18px]">
        <SectionLabel as="h3" className="mb-2">
          Agenda
        </SectionLabel>
        {meeting.agenda.length ? (
          <ol className="text-sm leading-[23px] text-fg">
            {meeting.agenda.map((item, i) => (
              <li key={item._id} className={cx(item.covered && "text-faint line-through")}>
                {i + 1}. {item.title}
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm leading-[23px] text-faint">No agenda added</p>
        )}
      </section>

      <div className="mt-[18px] flex gap-2 border-t border-row pt-4">
        {meeting.callUrl ? (
          <>
            <a
              href={meeting.callUrl}
              target="_blank"
              rel="noopener noreferrer"
              title={meeting.callUrl}
              className="flex h-[52px] min-w-0 flex-1 items-center overflow-hidden rounded-[14px] bg-raised px-[18px] text-sm whitespace-nowrap text-secondary hover:text-fg"
            >
              <span className="truncate">{shortLink(meeting.callUrl)}</span>
            </a>
            <CopyLinkButton url={meeting.callUrl} className="h-[52px] px-[18px]" />
            <a href={meeting.callUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-[52px] shrink-0 items-center rounded-full border border-accent bg-accent px-[26px] text-sm font-medium text-white hover:brightness-[1.08]">
              Join
            </a>
          </>
        ) : (
          <span className="text-xs text-faint">No call link</span>
        )}
      </div>
    </Card>
  );
}

function outcome(meeting, tasks) {
  const items = actionItems(meeting, tasks).length;
  const parts = [meeting.decisions.length && pluralize(meeting.decisions.length, "decision"), items && pluralize(items, "action item")].filter(Boolean);
  return parts.length ? parts.join(" · ") : meeting.endedAt ? "No outcomes recorded" : "Not ended";
}

/** Compact meeting row: past meetings here, and a project's Meetings tab. */
export function MeetingRow({ meeting, showProject }) {
  const { data, lookup } = useWorkspace();
  const today = todayISO();
  const upcoming = !meeting.endedAt && todayISO(new Date(meeting.startsAt)) >= today;
  const when = upcoming ? `${formatDay(meeting.startsAt)} ${formatTime(meeting.startsAt)}` : formatShortDate(meeting.startsAt.slice(0, 10));
  const detail = upcoming ? (meeting.agenda.length ? pluralize(meeting.agenda.length, "topic") : "No agenda yet") : outcome(meeting, data.tasks);
  return (
    <Link href={`/meetings/${meeting._id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl px-4 py-3 hover:bg-hover">
      <span className={cx("w-28 shrink-0 text-[13px] tabular-nums", upcoming ? "font-medium text-accent" : "text-muted")}>{when}</span>
      <span className="min-w-0 flex-[1_1_200px] font-medium text-strong">{meeting.title}</span>
      <span className="text-[13px] text-muted">
        {showProject && lookup.projects[meeting.projectId] && `${lookup.projects[meeting.projectId].name} · `}
        {detail}
      </span>
    </Link>
  );
}
