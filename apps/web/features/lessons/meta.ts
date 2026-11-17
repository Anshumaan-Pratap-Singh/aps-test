import curriculum from "@contracts/curriculum.json";

export interface CurriculumItem { id: string; type: "lesson" | "trainer" | "game" | "lab"; title: string; difficulty: number; minutes: number; href?: string; skills: string[] }
export interface CurriculumSection { id: string; title: string; description: string; items: CurriculumItem[] }
export interface CurriculumTrack { id: string; name: string; description: string; sections: CurriculumSection[] }

export const TRACKS = (curriculum as { tracks: CurriculumTrack[] }).tracks;

export interface LessonMeta { id: string; slug: string; title: string; track: string; section: string; difficulty: number; minutes: number; skills: string[] }

export const LESSON_INDEX: Record<string, LessonMeta> = {};
for (const tr of TRACKS) for (const s of tr.sections) for (const it of s.items) {
  if (it.type !== "lesson") continue;
  const slug = it.id.replace("lesson:", "");
  LESSON_INDEX[it.id] = { id: it.id, slug, title: it.title, track: tr.id, section: s.title, difficulty: it.difficulty, minutes: it.minutes, skills: it.skills };
}

export const SKILLS_BY_LESSON: Record<string, string[]> = Object.fromEntries(Object.values(LESSON_INDEX).map((l) => [l.id, l.skills]));
