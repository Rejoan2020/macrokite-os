"use client";

import Link from "next/link";
import { Pencil, Plus } from "lucide-react";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { useOverlays } from "@/components/providers/OverlayProvider";
import { Countdown, CopyLinkButton, ReminderMenu, shortLink } from "@/components/meetings/MeetingBits";
import { PeopleMenu } from "@/components/ui/PeopleMenu";
import { Button, Card, cx, EmptyNote, IconButton, Page, PageHeader, PersonChip, SectionLabel } from "@/components/ui/primitives";
import { useAction } from "@/lib/client/useAction";
import { firstName, formatDay, formatShortDate, formatTime, parseDate, pluralize, todayISO } from "@/lib/format";
import { actionItems, meetingBuckets } from "@/lib/selectors";

export function MeetingsView() {
  const { data } = useWorkspace();
  const overlays = useOverlays();
  const today = todayISO();
  const { upcoming, past } = meetingBuckets(data.meetings, today);

  return (
    <Page>
      <PageHeader
        title="Meetings"
        actions={
          <Button variant="primary" icon={Plus} onClick={() => overlays.newMeeting()}>
            New meeting
          </Button>
        }
      />

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
  const { lookup, activeUsers, currentUserId } = useWorkspace();
  const overlays = useOverlays();
  const { run, busy } = useAction();
  const date = parseDate(meeting.startsAt).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const attendees = meeting.attendeeIds.map((id) => lookup.users[id]).filter(Boolean);
  const candidates = activeUsers.filter((u) => !meeting.attendeeIds.includes(u._id));
  const setAttendees = (attendeeIds, success) => run({ type: "meeting.update", id: meeting._id, data: { attendeeIds } }, { success });

  return (
    <Card as="article" aria-labelledby={`mt-${meeting._id}`} className="flex flex-col gap-4 px-6 pt-6 pb-4">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-[12px] font-semibold tracking-[0.06em] text-muted uppercase">{date}</span>
          <h2 id={`mt-${meeting._id}`} className="text-[22px] font-medium tracking-[-0.01em] text-strong">
            <Link href={`/meetings/${meeting._id}`} className="hover:underline hover:underline-offset-4">
              {meeting.title}
            </Link>
          </h2>
        </div>
        <div className="flex items-start gap-3">
          <div className="flex flex-col items-end">
            <span className="text-[28px] leading-tight font-semibold tracking-[-0.01em] text-strong tabular-nums">{formatTime(meeting.startsAt)}</span>
            <Countdown startsAt={meeting.startsAt} className="text-[12px]" />
          </div>
          <div className="flex items-center gap-1.5 self-stretch border-l border-line pl-3">
            <ReminderMenu meeting={meeting} />
            <IconButton icon={Pencil} outline label="Edit meeting" onClick={() => overlays.editMeeting(meeting._id)} />
          </div>
        </div>
      </header>

      <section aria-label="Attendees" className="flex flex-col gap-2.5">
        <SectionLabel as="h3">Attendees</SectionLabel>
        <div className="flex flex-wrap items-center gap-2.5">
          {attendees.map((u) => (
            <PersonChip
              key={u._id}
              user={u}
              label={u._id === currentUserId ? `${firstName(u.name)} (you)` : firstName(u.name)}
              onRemove={() => setAttendees(meeting.attendeeIds.filter((id) => id !== u._id), `${u.name} removed`)}
              removeLabel={`Remove ${u.name}`}
            />
          ))}
          <PeopleMenu label="Add attendee" people={candidates} disabled={busy} onPick={(u) => setAttendees([...meeting.attendeeIds, u._id], `${u.name} invited`)} />
        </div>
      </section>

      <section aria-label="Agenda" className="flex flex-col gap-1.5">
        <SectionLabel as="h3">Agenda</SectionLabel>
        {meeting.agenda.length ? (
          <ol className="flex flex-col text-[15px] leading-[1.55] text-strong">
            {meeting.agenda.map((item, i) => (
              <li key={item._id} className={cx(item.covered && "text-muted line-through")}>
                {i + 1}. {item.title}
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-[14px] text-muted">
            No agenda yet.{" "}
            <button type="button" onClick={() => overlays.editMeeting(meeting._id)} className="text-accent hover:text-accent-light">
              Add topics
            </button>
          </p>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
        {meeting.callUrl ? (
          <>
            <a href={meeting.callUrl} target="_blank" rel="noopener noreferrer" className="flex h-12 min-w-0 flex-[1_1_240px] items-center truncate rounded-2xl bg-input px-5 text-[14px] text-secondary hover:text-fg">
              {shortLink(meeting.callUrl)}
            </a>
            <CopyLinkButton url={meeting.callUrl} labelled className="h-12" />
            <Button variant="accent" href={meeting.callUrl} target="_blank" rel="noopener noreferrer" className="h-12 px-7">
              Join
            </Button>
          </>
        ) : (
          <>
            <span className="flex h-12 flex-1 items-center rounded-2xl bg-input px-5 text-[14px] text-faint">No call link yet</span>
            <Button variant="outline" onClick={() => overlays.editMeeting(meeting._id)} className="h-12">
              Add link
            </Button>
          </>
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
