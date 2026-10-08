import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { Agent, run, tool, webSearchTool, setDefaultOpenAIKey } from "@openai/agents";
import { z } from "zod";

const here = path.dirname(fileURLToPath(import.meta.url));
const MAX_SEARCHES = 10;
const MAX_PAGE_READS = 15;
const MAX_RUNTIME_MS = 4 * 60 * 1000;

loadDotEnv(path.join(here, ".env"));

const apiKey = process.env.OPENAI_API_KEY;
const agentSecret = process.env.AGENT_SECRET;
if (!apiKey || !agentSecret) {
  throw new Error("OPENAI_API_KEY and AGENT_SECRET must be set in agent/.env.");
}
if (!existsSync(path.join(here, "interests.txt"))) {
  throw new Error("agent/interests.txt is required.");
}

setDefaultOpenAIKey(apiKey);

const jobs = new Map();

function loadDotEnv(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!match || process.env[match[1]]) continue;
    let value = match[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[match[1]] = value;
  }
}

function elapsedSeconds(job) {
  return Math.max(0, Math.floor(((job.finishedAt ?? Date.now()) - job.startedAt) / 1000));
}

function safeEqual(left, right) {
  const a = Buffer.from(left ?? "");
  const b = Buffer.from(right ?? "");
  return a.length === b.length && timingSafeEqual(a, b);
}

function cleanPage(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 24000);
}

function hasPastDate(text) {
  const months = "january february march april may june july august september october november december".split(" ");
  const today = new Date("2026-10-07T00:00:00+13:00");
  const words = String(text).toLowerCase();
  const matches = words.matchAll(/(?:\b(\d{1,2})\s+)?\b(january|february|march|april|may|june|july|august|september|october|november|december)\b(?:\s+(\d{1,2}))?(?:,)?\s+(20\d{2})/g);
  for (const match of matches) {
    const month = months.indexOf(match[2]);
    const day = Number(match[1] ?? match[3] ?? 1);
    const year = Number(match[4]);
    if (new Date(year, month, day) < today) return true;
  }
  return false;
}

function verifyResult(job, result) {
  const openedUrls = new Set(job.toolCalls.filter((call) => call.type === "open_page").map((call) => call.url));
  const opportunities = [];
  const ruledOut = Array.isArray(result?.ruledOut) ? [...result.ruledOut] : [];
  for (const item of result?.opportunities ?? []) {
    const evidence = `${item.availability ?? ""} ${item.sourceExcerpt ?? ""}`;
    const explicitOpening = /\b(open|register|registration|application|apply|tickets? available|book now)\b/i.test(evidence);
    const isOpened = openedUrls.has(item.url);
    if (isOpened && explicitOpening && !hasPastDate(evidence)) {
      opportunities.push(item);
      continue;
    }
    ruledOut.push({
      title: item.title,
      reason: !isOpened
        ? "The official page was not read by this job."
        : hasPastDate(evidence)
          ? "The supporting availability evidence contains a date that has already passed."
          : "The official-page excerpt does not clearly prove a current opening.",
      source: item.url,
    });
  }
  return {
    opportunities,
    ruledOut,
    notes: opportunities.length
      ? (result?.notes ?? "Only opportunities that passed the current-date and evidence checks are shown.")
      : "No opportunity passed the current-date and evidence checks. More official sources are needed.",
  };
}

function makeOpenPageTool(job) {
  return tool({
    name: "open_page",
    description: "Read one public web page. Use only for an official organizer, programme, competition, or event source after finding it with web search.",
    parameters: z.object({ url: z.string().min(8).describe("The one official public page to read, beginning with https:// or http://") }),
    async execute({ url }) {
      if (job.controller.signal.aborted) throw new Error("This job was stopped.");
      if (Date.now() >= job.deadline) throw new Error("The four-minute time limit has been reached.");
      if (job.pageReads >= MAX_PAGE_READS) throw new Error("The 15 page-read limit has been reached.");
      const parsed = new URL(url);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        throw new Error("Only public HTTP(S) pages can be opened.");
      }

      job.pageReads += 1;
      job.toolCalls.push({ type: "open_page", url, at: new Date().toISOString() });
      console.log(`[${job.id}] open_page ${url}`);
      try {
        const response = await fetch(url, {
          signal: job.controller.signal,
          headers: { "User-Agent": "AaronOpportunitiesAgent/1.0" },
          redirect: "follow",
        });
        const text = cleanPage(await response.text());
        return JSON.stringify({
          url: response.url,
          status: response.status,
          readable: response.ok && text.length > 0,
          text: text || "No readable text was returned from this page.",
        });
      } catch (error) {
        return JSON.stringify({ url, readable: false, error: error instanceof Error ? error.message : "Could not read page" });
      }
    },
  });
}

const resultSchema = z.object({
  opportunities: z.array(z.object({
    title: z.string(),
    organization: z.string(),
    url: z.string(),
    whyItFits: z.string(),
    ageEligibility: z.string(),
    location: z.string(),
    availability: z.string(),
    sourceExcerpt: z.string(),
  })).max(5),
  ruledOut: z.array(z.object({
    title: z.string(),
    reason: z.string(),
    source: z.string().optional(),
  })),
  notes: z.string(),
});

function makeAgent(job, interests) {
  return new Agent({
    name: "Auckland opportunities researcher",
    model: "gpt-4.1-mini",
    tools: [
      webSearchTool({ searchContextSize: "low", userLocation: { type: "approximate", city: "Auckland", country: "NZ" } }),
      makeOpenPageTool(job),
    ],
    outputType: resultSchema,
    instructions: `You research current opportunities for this student:\n${interests}\n\nToday is 7 October 2026 in Auckland, New Zealand. Find up to five suitable current competitions, programmes, or events. You must do web search first. For every item you might accept, use open_page on an official organizer page after search. Verify from that official page: age limits or school-year eligibility, location or online availability for Auckland, New Zealand, and a clear statement that applications or registration are open now. Include an item only if you actually checked that official page and the page provides all three kinds of evidence. A historical page, an annual event with no 2026 date, a future event with no current registration proof, or a past deadline must go in ruledOut.\n\nFor each accepted item, sourceExcerpt must be a short exact excerpt (at most 35 words) that supports the age eligibility and current availability. Do not claim a registration is open unless the opened page explicitly says so. Never assume school, experience, eligibility, dates, or that a recurring event is running this year. If a page cannot be read, search for and read a different official source before accepting or rejecting the item. Return fewer than five when the evidence is insufficient. Explain rejected leads in ruledOut. Use no more than ${MAX_SEARCHES} web searches and ${MAX_PAGE_READS} open_page calls. Do not use open_page before web search. Focus on New Zealand and Auckland where possible. Return only the required structured result.`,
  });
}

async function runJob(job) {
  const interests = readFileSync(path.join(here, "interests.txt"), "utf8").trim();
  const timer = setTimeout(() => job.controller.abort(new Error("Time limit reached")), MAX_RUNTIME_MS);
  try {
    const agent = makeAgent(job, interests);
    const streamed = await run(agent, "Research opportunities now.", {
      stream: true,
      maxTurns: 32,
      signal: job.controller.signal,
    });

    for await (const event of streamed) {
      if (event.type !== "run_item_stream_event" || event.name !== "tool_called") continue;
      const raw = event.item?.rawItem;
      const name = raw?.name ?? event.item?.type ?? "tool";
      const argumentsText = raw?.arguments ?? "";
      if (name === "web_search" || String(name).includes("web_search")) {
        job.searches += 1;
        job.toolCalls.push({ type: "web_search", at: new Date().toISOString() });
        console.log(`[${job.id}] web_search (${job.searches}/${MAX_SEARCHES})`);
        if (job.searches > MAX_SEARCHES) {
          job.controller.abort(new Error("The 10-search limit was exceeded."));
        }
      } else {
        console.log(`[${job.id}] tool ${name}${argumentsText ? ` ${argumentsText.slice(0, 300)}` : ""}`);
      }
    }

    if (job.controller.signal.aborted) {
      job.status = "cancelled";
      job.error = "The job was stopped before it completed.";
    } else {
      job.status = "done";
      job.result = verifyResult(job, streamed.finalOutput);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "The search failed.";
    job.status = job.controller.signal.aborted ? "cancelled" : "error";
    job.error = job.status === "cancelled" ? "The job was stopped before it completed." : message;
  } finally {
    clearTimeout(timer);
    job.finishedAt = Date.now();
  }
}

function jobResponse(job) {
  const body = {
    id: job.id,
    status: job.status,
    progress: {
      searches: job.searches,
      pageReads: job.pageReads,
      elapsedSeconds: elapsedSeconds(job),
      toolCalls: job.toolCalls,
    },
  };
  if (job.status === "done") body.results = job.result;
  if (job.status === "error" || job.status === "cancelled") body.error = job.error;
  return body;
}

function sendJson(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

const server = createServer((request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  if (request.method === "GET" && url.pathname === "/") {
    response.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("agent is running");
    return;
  }

  if (request.method === "POST" && url.pathname === "/jobs") {
    if (!safeEqual(request.headers.agent_secret, agentSecret)) {
      sendJson(response, 401, { error: "Unauthorized" });
      return;
    }
    const id = randomUUID();
    const job = {
      id,
      status: "running",
      startedAt: Date.now(),
      deadline: Date.now() + MAX_RUNTIME_MS,
      searches: 0,
      pageReads: 0,
      toolCalls: [],
      controller: new AbortController(),
      result: null,
      error: null,
      finishedAt: null,
    };
    jobs.set(id, job);
    void runJob(job);
    sendJson(response, 202, { id, status: job.status });
    return;
  }

  const match = url.pathname.match(/^\/jobs\/([0-9a-f-]+)(?:\/(cancel))?$/i);
  if (match) {
    const job = jobs.get(match[1]);
    if (!job) {
      sendJson(response, 404, { error: "Job not found" });
      return;
    }
    if (request.method === "GET" && !match[2]) {
      sendJson(response, 200, jobResponse(job));
      return;
    }
    if (request.method === "POST" && match[2] === "cancel") {
      if (job.status === "running") {
        job.controller.abort(new Error("Cancelled by request"));
        job.status = "cancelled";
        job.error = "The job was stopped before it completed.";
        job.finishedAt = Date.now();
      }
      sendJson(response, 200, jobResponse(job));
      return;
    }
  }

  sendJson(response, 404, { error: "Not found" });
});

const port = Number(process.env.PORT || 8080);
server.listen(port, () => console.log(`Agent listening at http://localhost:${port}`));
