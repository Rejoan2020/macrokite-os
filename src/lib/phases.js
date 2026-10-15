import { PHASE_LABELS, PHASES } from "./constants";

/**
 * Each project has its own ordered phases: [{ _id, name }]. A project's `phase` and its tasks'
 * `phase` hold one of those ids. Projects saved before phases were customizable have none, and use
 * the standard seven, whose ids ("idea", "planning", …) are what their phase fields already hold.
 */

export const MAX_PHASES = 20;

export const DEFAULT_PHASES = PHASES.map((id) => ({ _id: id, name: PHASE_LABELS[id] }));

export const projectPhases = (project) => (project?.phases?.length ? project.phases : DEFAULT_PHASES);

export const phaseIndexIn = (project, phaseId) => projectPhases(project).findIndex((p) => p._id === phaseId);

export const phaseName = (project, phaseId) => projectPhases(project).find((p) => p._id === phaseId)?.name ?? PHASE_LABELS[phaseId] ?? "—";

/** The phase after this one, or null at the last phase. */
export const nextPhaseIn = (project, phaseId) => projectPhases(project)[phaseIndexIn(project, phaseId) + 1] ?? null;

/** "Phase 3 of 5" parts. */
export const phaseStep = (project) => ({ index: phaseIndexIn(project, project.phase), count: projectPhases(project).length });
