/** Flat primary navigation. No nesting anywhere. */
export const NAV = [
  { href: "/", label: "Dashboard", short: "Home", icon: "◈" },
  { href: "/learn", label: "Learning Academy", short: "Learn", icon: "▤" },
  { href: "/mental-math", label: "Mental Mathematics", short: "Math", icon: "∑" },
  { href: "/probability", label: "Probability & Statistics", short: "Prob", icon: "℘" },
  { href: "/market-games", label: "Market Games", short: "Markets", icon: "⇅" },
  { href: "/cognitive", label: "Cognitive Training", short: "Cognitive", icon: "◎" },
  { href: "/coding", label: "Coding Laboratory", short: "Code", icon: "⌘" },
  { href: "/research", label: "Quantitative Research", short: "Research", icon: "∿" },
  { href: "/assessments", label: "Assessments", short: "Assess", icon: "◷" },
  { href: "/progress", label: "Progress & Analytics", short: "Progress", icon: "▲" },
] as const;

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
