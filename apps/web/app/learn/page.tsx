import Link from "next/link";
import { ModuleGrid, type ModuleDef } from "@/components/ModuleGrid";
import { PageHeader, SectionTitle } from "@/components/ui";
import { TRACKS } from "@/features/lessons/meta";
import { LESSON_COMPONENTS } from "@/features/lessons/registry";

export const metadata = { title: "Learning Academy" };

export default function LearnPage() {
  return (
    <>
      <PageHeader title="Learning Academy" kicker="Learn">
        Three professional tracks sharing foundations. Lessons contain derivations, worked examples and exactly-graded concept
        checks; trainers, games and labs apply each stage. A smaller rigorous curriculum beats a large shallow one — every lesson
        listed here is written and live.
      </PageHeader>
      <nav aria-label="Tracks on this page" className="flex flex-wrap gap-2 mb-2">
        {TRACKS.map((t) => <a key={t.id} href={`#${t.id}`} className="rounded-md border border-border px-3 py-1.5 text-sm text-muted hover:text-cyan hover:border-cyan/60">{t.name}</a>)}
      </nav>
      {TRACKS.map((track) => (
        <section key={track.id} id={track.id} className="scroll-mt-24">
          <h2 className="mt-10 text-xl font-semibold text-cyan">{track.name}</h2>
          <p className="text-sm text-muted">{track.description}</p>
          {track.sections.map((s) => {
            const mods: ModuleDef[] = s.items.map((it) => {
              const slug = it.id.replace(/^lesson:/, "");
              const isLesson = it.type === "lesson";
              const live = isLesson ? Boolean(LESSON_COMPONENTS[slug]) : Boolean(it.href);
              return {
                href: isLesson ? `/learn/${slug}` : it.href, title: it.title,
                description: `${it.type[0]!.toUpperCase()}${it.type.slice(1)} · ~${it.minutes} min · ${it.skills.map((x) => x.replace(/_/g, " ")).join(", ")}`,
                difficulty: it.difficulty, status: live ? "operational" : "planned", lesson: isLesson ? it.id : undefined,
                game: it.type === "game" ? it.id.replace("game:", "").replace(/-/g, "_") : undefined,
              };
            });
            return (
              <div key={s.id}>
                <SectionTitle>{s.title}</SectionTitle>
                <p className="text-sm text-muted -mt-2 mb-3">{s.description}</p>
                <ModuleGrid modules={mods} />
              </div>
            );
          })}
        </section>
      ))}
      <p className="mt-10 text-sm text-muted">Not yet written (planned): dedicated lessons on options pricing, Poisson processes, Girsanov in depth, tree ensembles, NUMA and networking. They are listed as planned rather than shown as placeholders. <Link className="text-cyan" href="/progress">See progress →</Link></p>
    </>
  );
}
