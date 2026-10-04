"use client";

import { useState } from "react";
import content from "../content.json";

const topics = [
  { id: "introduction", size: "large", label: "01 / Introduction", title: "Aaron Yu", summary: "Student, saxophonist, gamer, and French learner.", detail: "I am Aaron, a student based in Auckland. This is a small collection of the things I am learning, making, and paying attention to." },
  { id: "studies", size: "tall", label: "02 / Studies in school", title: "School", summary: "Auckland Grammar School", detail: `I am in ${content.year}, class ${content.class}, at ${content.school}. I enjoy learning new things and seeing where they connect.`, items: ["School life and projects - More coming!"] },
  { id: "music", size: "wide", label: "03 / Music", title: "Saxophone", summary: "Three ensembles, one instrument.", detail: "I play saxophone in Concert Band, Symphony Orchestra, and Big Band. Rehearsals are where I learn how to listen closely and make something together.", items: ["Performances and recordings - Coming soon."] },
  { id: "games", size: "small", label: "04 / Games", title: "Play", summary: "Minecraft, Brawl Stars, friends.", detail: "In my free time, I play Minecraft, Brawl Stars, and other games with friends.", links: content.games },
  { id: "french", size: "small", label: "05 / French", title: "Bonjour", summary: "French at B1 level.", detail: "I study French at school at a B1 level and am building my confidence with vocabulary and conversation.", items: ["French learning resources - More coming!"] },
  { id: "kumon", size: "small", label: "06 / Kumon", title: "Kumon", summary: "Maths and work.", detail: `${content.kumon.level}. ${content.kumon.status}.`, items: [`Kumon location - ${content.kumon.location}`] },
  { id: "opportunities", size: "wide", label: "07 / Opportunities", title: "Watching", summary: "Things I might apply for.", detail: "A changing watchlist of opportunities in music, learning, and school projects.", items: [...content.opportunities.map((item) => `${item.type}: ${item.title} - ${item.status}`), "Individual opportunity links - Coming soon."] },
  { id: "weekly", size: "tall", label: "08 / Weekly", title: "Notes", summary: "A small weekly newsletter.", detail: "Notes about what I am learning, playing, making, and thinking about.", items: content.weekly.map((item) => `${item.number} - ${item.title}`) },
  { id: "footer", size: "footer", label: "09 / Footer", title: "Keep in touch", summary: "Find me online.", detail: "Links, contact details, and more ways to find me online.", links: content.contact }
];

export default function Home() {
  const [expanded, setExpanded] = useState(null);
  const [warm, setWarm] = useState(false);

  return (
    <main className={`site-shell ${warm ? "warm" : ""}`}>
      <header className="compact-header">
        <a className="wordmark" href="#top" aria-label="Aaron Yu home">AY<span>.</span></a>
        <p>Personal corner of the internet · Auckland</p>
        <button className="warm-toggle" type="button" onClick={() => setWarm((current) => !current)} aria-pressed={warm}>
          <span aria-hidden="true">{warm ? "Sun" : "Moon"}</span> {warm ? "Cool mode" : "Warm mode"}
        </button>
      </header>

      <section className="topic-grid" id="top" aria-label="Aaron Yu topics">
        {topics.map((topic) => {
          const isExpanded = expanded === topic.id;
          return (
            <article className={`topic-card card-${topic.id} card-${topic.size} ${isExpanded ? "is-expanded" : ""}`} key={topic.id}>
              <button className="card-toggle" type="button" onClick={() => setExpanded((current) => current === topic.id ? null : topic.id)} aria-expanded={isExpanded}>
                <span className="card-label">{topic.label}</span>
                <span className="card-title">{topic.title}</span>
                <span className="card-summary">{topic.summary}</span>
                <span className="card-hint">{isExpanded ? "Close x" : "Open +"}</span>
              </button>
              <span className="card-detail">
                {topic.detail}
                {topic.items && <span className="card-list">{topic.items.map((item) => <span key={item}>{item}</span>)}</span>}
                {topic.links && <span className="card-list">{topic.links.map((link) => link.url ? <a href={link.url} target={link.url.startsWith("http") ? "_blank" : undefined} rel={link.url.startsWith("http") ? "noreferrer" : undefined} key={link.name}>{link.name}: {link.label}</a> : <span key={link.name}>{link.name}: {link.note}</span>)}</span>}
              </span>
            </article>
          );
        })}
      </section>
    </main>
  );
}
