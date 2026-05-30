SET NAMES utf8mb4;

INSERT IGNORE INTO blog_categories (id, name, slug) VALUES
(1, 'Career',       'career'),
(2, 'Skills',       'skills'),
(3, 'Technology',   'technology'),
(4, 'Productivity', 'productivity'),
(5, 'AI & Agents',  'ai-agents');

INSERT IGNORE INTO blog_posts
  (id, title, slug, excerpt, content, author, category_id, status, visible, published_at)
VALUES

(1,
'The GitHub Repo That Could Change Your Career',
'github-repo-change-your-career',
'I used to tell junior engineers to study for certifications. I don''t say that anymore. Here''s the advice I gave a co-op student last month: build something and put it on GitHub.',
'I used to tell junior engineers to study for certifications. I don''t say that anymore.

Here''s the advice I gave a co-op student last month that I wish someone had given me: **build something and put it on GitHub.**

Not a course. Not a Coursera badge. A repo with a README that says "clone this, run `docker-compose up`, and you''ll see X working."

## Why This Matters More Than You Think

When a hiring manager looks at your resume, they''re trying to answer one question: *Can this person actually do the work?*

Certifications answer: "This person studied the theory."
A working prototype answers: "This person can build things."

I recently watched two candidates with similar backgrounds interview for a data engineering role. One had an AWS certification. The other had a GitHub repo with a working ELT pipeline — public API data ingested into a local warehouse, dbt transformations, simple dashboard.

Guess who got the offer.

## The Ambition + Cleverness Equation

You don''t need to be an expert to build an impressive prototype. You need ambition and cleverness.

Want to show you understand machine learning? You don''t need a PhD in statistics. Build a project that uses a clustering algorithm — DBSCAN on customer data, K-means on geographic coordinates. The fact that you knew *when* and *how* to apply it matters more than whether you can derive it from first principles.

Gen AI has lowered the barrier to working code. Use it. A co-op who uses gen AI to produce a working Spark job is more employable than one who''s still memorizing PySpark syntax.

## What to Build

Pick something real:

- Ingest data from a public API you find interesting (sports, weather, finance)
- Transform it with dbt or custom Python/SQL
- Load it to a destination (BigQuery, Postgres, Snowflake)
- Add a simple visualization or query interface
- Document it clearly

**Bonus points:** add unit tests, include a `docker-compose` so it''s one-command runnable, write a data quality check.

## The Practical Reality

A GitHub repo breaks the experience paradox. It *is* experience. It shows you can identify a problem, architect a solution, and ship something that works.

The best data engineers I''ve worked with weren''t the ones with the most certifications. They were the ones who couldn''t stop building things.

Start tonight.',
'Jeremy', 1, 'published', 1, '2026-05-15 08:00:00'),

(2,
'Data Engineering''s Durable Skills: What AI Can''t Automate',
'data-engineering-durable-skills',
'The data engineer who survives the next five years isn''t the one who codes the fastest — it''s the one who understands context. Here''s what that means in practice.',
'There''s a version of the future where AI writes all your SQL, builds your pipelines, and documents your data models.

That future is already here. The question isn''t *whether* it will happen — it''s *which parts of your job are safe.*

## What Gen AI Is Actually Good At

Let''s be honest about what can be automated:

- Writing boilerplate ETL code
- Generating unit tests from specifications
- Auto-generating documentation and data dictionaries
- Creating diagrams from schema definitions
- Translating SQL between dialects

If your current job description is "write Python scripts to move data from A to B," you need to think about what else you bring to the table.

## The New Pillars of Data Engineering

The durable skills are the ones that require something AI doesn''t have: **organizational context and human judgment.**

**Security & Compliance**
Knowing *which* data can be stored where, for how long, under what access controls — this requires understanding regulations (GDPR, CCPA, HIPAA), your organization''s risk posture, and the real business implications of a breach. AI can help implement controls, but it can''t make the judgment calls.

**Data Governance**
Who owns what data? What does "customer_id" mean in the sales system versus the support system? Governance is a people problem with a data layer on top. The politics, the org design, the stewardship programs — these require human navigation.

**Metadata Management**
A well-maintained data catalog is worth more than any pipeline. Maintaining one requires people who understand what the metadata *means*, not just what it *says*. Context, lineage, business definitions — this is where domain knowledge is irreplaceable.

**Data Quality & Reference Data Management**
Is a 97% match rate on customer records acceptable? That depends on whether you''re billing customers or sending marketing emails. Data quality decisions are business decisions, and they need someone who understands both.

**Responsible AI / Ethics in Data**
As AI systems consume your data, questions of fairness, explainability, and grounding become data engineering problems. Who ensures training data isn''t biased? Who maintains the feedback loops that keep models grounded? These roles didn''t exist five years ago.

## The Shift in Identity

The data engineer role is evolving from "person who builds pipelines" to "person who ensures data is trustworthy, governed, and safe to use."

That''s not a lesser role. It''s a more important one.

Start building depth in these areas now. The engineers who establish expertise early will be the hardest to replace.',
'Jeremy', 2, 'published', 1, '2026-05-17 08:00:00'),

(3,
'Goodbye Brittle Dashboards, Hello Conversational BI',
'goodbye-brittle-dashboards-conversational-bi',
'I spent years building OLAP cubes. Carefully maintained conformed dimensions, aggregation tables, multidimensional models. That infrastructure was real work. Today, it''s increasingly obsolete.',
'I spent a significant part of my career building OLAP cubes.

Carefully designed star schemas. Meticulously maintained conformed dimensions. Aggregation tables that shaved milliseconds off query times. That infrastructure was real work.

Today, it''s increasingly obsolete.

## The Problem with Prepared BI

Traditional BI worked like this: a data engineer pre-aggregated answers into a semantic model, and surfaced those models through tools like Tableau or Power BI.

This created a fundamental bottleneck: the rate at which analysts could ask new questions was throttled by the rate at which engineers could update the model. Miss a dimension? Analysts hit a wall. Wrong join in the semantic layer? A month of bad reports before anyone noticed.

And don''t get me started on Tableau''s access control. *Brittle* doesn''t begin to cover it.

## The Metadata-Driven Alternative

What''s replacing this model is fundamentally different. Instead of pre-building answers, you build a rich metadata layer — meaning, relationships, quality, lineage — and let AI navigate it dynamically.

A knowledge graph, essentially. Not a static OLAP cube, but a dynamic graph of entities and relationships that an AI system can traverse in response to natural language questions.

*"Show me customers who churned in Q3 but had high NPS scores in Q2."*

In the old world, that question might require a new join in the semantic model and two weeks of development. In the new world, it''s a conversation.

## GCP Is Leading This Shift

Google Cloud Platform has been aggressive about integrating conversational AI directly into the data stack. BigQuery''s natural language querying, Looker''s AI features, Gemini integrated throughout — these aren''t experiments. They''re production features used by real organizations today.

The move from Tableau to GCP-native BI is also a move from brittle infrastructure to platform-integrated tooling. Access control is handled at the data layer (IAM, column-level security in BigQuery), not bolted on in a BI tool with its own user management nightmare.

## What This Means for Data Engineers

Less time on: building semantic models, managing BI tool infrastructure, writing calculated fields.

More time on: building rich metadata catalogs, defining entity relationships and data lineage, ensuring data quality so AI queries return trustworthy results, managing security at the data layer.

The knowledge graph is only as good as the metadata behind it. That''s where your expertise becomes irreplaceable.',
'Jeremy', 3, 'published', 1, '2026-05-19 08:00:00'),

(4,
'Gen AI Did the Boring Stuff So You Don''t Have To',
'gen-ai-boring-stuff-data-engineers',
'Code comments, unit tests, documentation, diagrams — the stuff that chronically didn''t get done. Gen AI changed that completely, and the impact on data teams is bigger than most realize.',
'Let me describe a common scene from data engineering circa 2019.

You''ve just finished a complex transformation pipeline. It works. It''s been tested in dev, promoted to staging, ready for prod. You submit the PR.

Someone comments: "Missing unit tests."
Someone else: "No documentation for the new tables."
A third: "Can you add a data flow diagram?"

You groan. You know they''re right. But you''re already onto the next thing, and these artifacts are going to take another half day.

So you write a quick README, skip the unit tests ("I''ll add them later"), and move on.

We all did this. The result was technical debt, onboarding nightmares, and pipelines that only their authors understood.

## Gen AI Changed This Completely

Today, when I finish a data pipeline, I ask gen AI to:

1. **Write unit tests** based on the transformation logic
2. **Generate inline code comments** explaining the non-obvious parts
3. **Create a data dictionary** for any new tables or fields
4. **Produce a data flow diagram** from the DDL and transformation logic
5. **Draft a README** that explains what the pipeline does, how to run it, and what depends on it

This takes about ten minutes. The output is 80% good on first pass, and with a quick review and a few edits, it''s production quality.

The artifacts that used to be skipped are now just part of the workflow.

## The Organizational Impact

When documentation is consistent and current, onboarding new engineers gets faster. When unit tests are present, refactoring is less scary. When diagrams are maintained, architecture reviews are more productive.

The chronic under-investment in documentation that has plagued data teams for years is being solved — not by cultural change, but by making it cheap to do right.

## What You Should Be Doing Right Now

- **Code comments**: Paste a complex function, ask for inline comments on the non-obvious logic
- **Unit tests**: Describe the expected input/output, let gen AI draft the test cases
- **Documentation**: Ask for a README pre-filled with your project''s details
- **Diagrams**: Paste your schema, ask for a Mermaid.js or PlantUML diagram

The time you save on the boring stuff is time you can spend on the interesting stuff.

And the interesting stuff is where you build expertise that''s harder to automate.',
'Jeremy', 4, 'published', 1, '2026-05-21 08:00:00'),

(5,
'The Dawn of Agentic Data Workflows',
'dawn-of-agentic-data-workflows',
'Around 2021, if you wanted AI in a data workflow, you picked a vertical. Coding assistance. Data validation. Each was isolated. That constraint is gone now — and it changes everything.',
'Around 2021, if you wanted to use AI in a data workflow, you picked a vertical.

Coding assistance. Data validation. Anomaly detection. Each was a standalone capability, useful within its lane, but fundamentally isolated. The AI did one thing in one place and handed off to a human for the next step.

That constraint is gone.

## What Changed With Agents

The shift to agentic AI is about connecting capabilities across what used to be hard boundaries.

An agent doesn''t just write code. It writes code, runs it, inspects the output, adjusts its approach based on what it observed, and iterates until it achieves a goal. It can use tools — query a database, call an API, read a file, search documentation, send an alert — and reason about which tool to use when.

More importantly, agents can operate *across verticals*. Where a traditional AI tool might help you write a SQL query, an agent might:

1. Inspect the data catalog to understand available tables
2. Write and execute a query
3. Evaluate the result quality
4. Flag anomalies based on historical patterns
5. Update a data quality score in the governance system
6. Notify the relevant data steward

That''s a workflow that previously required a human coordinating five different systems.

## What This Means for Data Pipelines

**Self-healing pipelines.** An agent monitoring a pipeline can detect a failure, diagnose the root cause, attempt a fix, test the fix, and restart — all before a human is paged. Not for all failure modes, but for the common ones.

**Adaptive data quality.** Rather than static quality rules, agents can observe patterns, propose new rules based on what they see, and escalate anomalies with context rather than just alerts.

**Automated lineage documentation.** Every time data moves, an agent can update the metadata catalog with lineage. The catalog stays current without manual effort.

**Cross-system reasoning.** Need to know why a KPI dropped? An agent can query the data warehouse, check pipeline logs, inspect recent schema changes, review data quality scores, and synthesize a root cause analysis — across systems that never talked to each other before.

## The Human''s Role in Agentic Workflows

This doesn''t eliminate the data engineer''s role. It changes it.

You become the person who designs the agentic workflow (goals, tools, guardrails), reviews the agent''s decisions in novel situations, maintains the context the agent reasons about, and handles the edge cases where human judgment is genuinely required.

The engineers who will be most valuable aren''t those who can write pipelines — it''s those who can design, orchestrate, and govern agentic systems.

We''re early in this. But the direction is clear. Start learning to work *with* agents, not just tools.',
'Jeremy', 5, 'published', 1, '2026-05-23 08:00:00');
