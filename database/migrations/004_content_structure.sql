-- Migration 004: series assignments, category rebalance, unpin the May post.
-- Requires 003. Matches posts by slug and categories by name, so it does not
-- depend on production ids. Safe to re-run.
--   docker exec -i datadinosaur-db-1 mysql -u root -p"$MYSQL_ROOT_PASSWORD" datadinosaur \
--     < database/migrations/004_content_structure.sql
--
-- `updated_at = updated_at` on every statement keeps the ON UPDATE timestamp
-- from claiming these posts were edited today.

SET NAMES utf8mb4;

-- ---------------------------------------------------------------------------
-- 1) Series (reading order)
-- ---------------------------------------------------------------------------
UPDATE blog_posts SET series = 'AI gateway', series_order = 1, updated_at = updated_at WHERE slug = 'build-the-gateway-buy-the-model-ai-governance-for-regulated-industries-on-gcp';
UPDATE blog_posts SET series = 'AI gateway', series_order = 2, updated_at = updated_at WHERE slug = 'stacking-governance-layers-without-losing-track-of-them';
UPDATE blog_posts SET series = 'AI gateway', series_order = 3, updated_at = updated_at WHERE slug = 'choosing-an-ai-gateway-operating-model';
UPDATE blog_posts SET series = 'AI gateway', series_order = 4, updated_at = updated_at WHERE slug = 'one-registry-one-gateway-two-clouds-testing-ai-agent-containment-across-aws-and-google-cloud';

UPDATE blog_posts SET series = 'FinChat build log', series_order = 1, updated_at = updated_at WHERE slug = 'one-source-of-truth-for-ai-agent-grounding-okf-in-practice';
UPDATE blog_posts SET series = 'FinChat build log', series_order = 2, updated_at = updated_at WHERE slug = 'ontologies-for-mere-mortals-one-that-actually-runs';
UPDATE blog_posts SET series = 'FinChat build log', series_order = 3, updated_at = updated_at WHERE slug = 'routing-ai-guardrail-violations-to-servicenow';
UPDATE blog_posts SET series = 'FinChat build log', series_order = 4, updated_at = updated_at WHERE slug = 'policy-as-code-without-a-cluster-adding-opa-to-finchat';
UPDATE blog_posts SET series = 'FinChat build log', series_order = 5, updated_at = updated_at WHERE slug = 'multi-turn-context-safety-alerting-catching-what-a-per-message-filter-cannot';
UPDATE blog_posts SET series = 'FinChat build log', series_order = 6, updated_at = updated_at WHERE slug = 'which-parts-of-your-eval-framework-you-can-stop-maintaining';

UPDATE blog_posts SET series = 'RAG in practice', series_order = 1, updated_at = updated_at WHERE slug = 'i-built-a-rag-chat-widget-for-my-blog-heres-how-it-works';
UPDATE blog_posts SET series = 'RAG in practice', series_order = 2, updated_at = updated_at WHERE slug = 'your-rag-problem-might-be-a-data-issue-not-retrieval-issue';
UPDATE blog_posts SET series = 'RAG in practice', series_order = 3, updated_at = updated_at WHERE slug = 'is-your-rag-pipeline-actually-secure-a-10-question-gut-check';

-- ---------------------------------------------------------------------------
-- 2) Categories: AI & Agents 23 / Career 9 / Technology 9 / Skills 3 /
--    Productivity 1  ->  four balanced categories. Existing rows are renamed
--    (so their ids and /blog?cat= links keep working); Skills and Productivity
--    are left in place but empty, and empty categories are hidden publicly.
-- ---------------------------------------------------------------------------
INSERT INTO blog_categories (name, slug)
SELECT 'AI Governance & Gateways', 'ai-governance-gateways' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM blog_categories WHERE slug = 'ai-governance-gateways');

UPDATE blog_categories SET name = 'Agents & Evals', slug = 'agents-evals'   WHERE name = 'AI & Agents';
UPDATE blog_categories SET name = 'Data Platform',  slug = 'data-platform'  WHERE name = 'Technology';
UPDATE blog_categories SET name = 'Career & Craft', slug = 'career-craft'   WHERE name = 'Career';

-- Any of the three that didn't exist under the old name gets created.
INSERT INTO blog_categories (name, slug) SELECT 'Agents & Evals', 'agents-evals' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM blog_categories WHERE slug = 'agents-evals');
INSERT INTO blog_categories (name, slug) SELECT 'Data Platform', 'data-platform' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM blog_categories WHERE slug = 'data-platform');
INSERT INTO blog_categories (name, slug) SELECT 'Career & Craft', 'career-craft' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM blog_categories WHERE slug = 'career-craft');

SET @gov    = (SELECT id FROM blog_categories WHERE slug = 'ai-governance-gateways');
SET @agents = (SELECT id FROM blog_categories WHERE slug = 'agents-evals');
SET @data   = (SELECT id FROM blog_categories WHERE slug = 'data-platform');
SET @career = (SELECT id FROM blog_categories WHERE slug = 'career-craft');

UPDATE blog_posts SET category_id = @gov, updated_at = updated_at WHERE slug IN (
  'one-registry-one-gateway-two-clouds-testing-ai-agent-containment-across-aws-and-google-cloud',
  'choosing-an-ai-gateway-operating-model',
  'stacking-governance-layers-without-losing-track-of-them',
  'policy-as-code-without-a-cluster-adding-opa-to-finchat',
  'routing-ai-guardrail-violations-to-servicenow',
  'your-ai-risk-register-has-four-bullets-finos-has-46',
  'sr-26-2-punted-on-ai-heres-what-actually-regulates-your-models',
  'build-the-gateway-buy-the-model-ai-governance-for-regulated-industries-on-gcp',
  'is-your-rag-pipeline-actually-secure-a-10-question-gut-check',
  'lets-explain-explainability'
);

UPDATE blog_posts SET category_id = @agents, updated_at = updated_at WHERE slug IN (
  'which-parts-of-your-eval-framework-you-can-stop-maintaining',
  'multi-turn-context-safety-alerting-catching-what-a-per-message-filter-cannot',
  'thinking-of-an-agent-as-a-colleague',
  'ontologies-for-mere-mortals-one-that-actually-runs',
  'one-source-of-truth-for-ai-agent-grounding-okf-in-practice',
  'i-built-an-mcp-server-but-i-didnt-need-to',
  'make-agent-evals-part-of-your-observability',
  'same-ai-different-grounding-agentic-tooling-by-persona',
  'i-built-a-rag-chat-widget-for-my-blog-heres-how-it-works',
  'dawn-of-agentic-data-workflows'
);

UPDATE blog_posts SET category_id = @data, updated_at = updated_at WHERE slug IN (
  'alternative-to-buying-capacity-to-fix-dataflow-stockouts',
  'bigquery-omni-reads-your-s3-data-in-place-just-dont-treat-it-like-a-pipeline',
  'i-made-snowflake-query-gcs-data-without-copying-a-single-byte',
  'your-rag-problem-might-be-a-data-issue-not-retrieval-issue',
  'apache-beam-streaming-windowing-quiz',
  'data-management-pillar-overview',
  'cloud-run-is-fine-when-you-actually-need-kubernetes',
  'managing-data-products-in-google-clouds-knowledge-catalog',
  'finally-found-a-way-to-make-a-monolithic-beam-pipeline-modular',
  'genbi-three-shifts-that-could-change-how-you-think-about-bi-implementation',
  'stop-your-gcp-bill-before-it-stops-you',
  'goodbye-brittle-dashboards-conversational-bi'
);

UPDATE blog_posts SET category_id = @career, updated_at = updated_at WHERE slug IN (
  'ask-the-ai-to-interview-you',
  'you-dont-really-understand-it-until-youve-taught-it',
  'your-brain-is-the-one-model-only-you-can-train',
  'what-you-already-know-you-just-havent-written-it-down',
  'how-to-actually-influence-change-when-you-dont-have-the-authority-to-mandate-it',
  'how-do-you-know-when-youve-created-value',
  'what-im-actually-looking-for-when-i-interview-a-data-qaqe-engineer',
  'how-to-handle-ambiguity',
  'how-a-hobby-makes-you-a-better-engineer',
  'eight-seconds-of-silence',
  'gen-ai-boring-stuff-data-engineers',
  'data-engineering-durable-skills',
  'github-repo-change-your-career'
);

-- ---------------------------------------------------------------------------
-- 3) Front door: the new /start-here page replaces the pinned May post.
-- ---------------------------------------------------------------------------
UPDATE blog_posts SET pinned = 0, updated_at = updated_at WHERE slug = 'data-engineering-durable-skills';
