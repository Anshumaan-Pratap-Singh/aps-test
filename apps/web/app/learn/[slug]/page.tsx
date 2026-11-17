import Link from "next/link";
import { notFound } from "next/navigation";
import { Difficulty, PageHeader } from "@/components/ui";
import { CompleteLesson } from "@/features/lessons/kit";
import { LESSON_INDEX, TRACKS } from "@/features/lessons/meta";
import { lessonBySlug } from "@/features/lessons/registry";

export function generateStaticParams() {
  return Object.values(LESSON_INDEX).map((l) => ({ slug: l.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return { title: lessonBySlug(slug)?.title ?? "Lesson" };
}

export default async function LessonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const lesson = lessonBySlug(slug);
  if (!lesson) notFound();
  const track = TRACKS.find((t) => t.id === lesson.track);
  const related = track?.sections.find((s) => s.title === lesson.section)?.items.filter((i) => i.type !== "lesson" && i.href) ?? [];
  const { Component } = lesson;
  return (
    <article className="max-w-3xl">
      <PageHeader title={lesson.title} kicker={`${track?.name ?? ""} · ${lesson.section}`}>
        <span className="flex items-center gap-3"><Difficulty level={lesson.difficulty} /> ~{lesson.minutes} min · <Link href="/learn" className="text-blue hover:text-cyan">← Academy</Link></span>
      </PageHeader>
      <div className="prose-aps"><Component /></div>
      {related.length > 0 && (
        <div className="mt-8 rounded-lg border border-border bg-surface p-4">
          <h2 className="text-sm font-semibold mb-2">Apply it</h2>
          <ul className="text-sm space-y-1">{related.map((r) => <li key={r.id}><Link className="text-cyan" href={r.href!}>{r.title} →</Link></li>)}</ul>
        </div>
      )}
      <CompleteLesson lesson={lesson.id} />
    </article>
  );
}
