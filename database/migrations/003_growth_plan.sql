-- Migration 003: SEO dates, post summaries, series, and email subscribers.
-- Additive only: new columns + one new table. No existing column is changed.
-- Run once on the production DB:
--   docker exec -i datadinosaur-db-1 mysql -u root -p"$MYSQL_ROOT_PASSWORD" datadinosaur \
--     < database/migrations/003_growth_plan.sql

-- 1) content_updated_at: the date the post's words last changed.
--    blog_posts.updated_at has ON UPDATE CURRENT_TIMESTAMP, so the view counter
--    and pin/visibility toggles moved it on every page view. That made every
--    post claim it was modified today in JSON-LD and the sitemap. This column
--    is only set when title/excerpt/summary/content change.
--    Backfill: we cannot recover the real last-edit dates, so start from the
--    publish date. The next real edit moves it forward.
ALTER TABLE blog_posts
  ADD COLUMN content_updated_at DATETIME NULL AFTER updated_at,
  ADD COLUMN summary            TEXT     NULL AFTER excerpt,
  ADD COLUMN series             VARCHAR(120) NULL AFTER category_id,
  ADD COLUMN series_order       INT      NULL AFTER series,
  ADD KEY idx_series (series, series_order);

UPDATE blog_posts
   SET content_updated_at = COALESCE(published_at, created_at),
       updated_at         = updated_at;

-- 2) Email subscribers (self-hosted double opt-in list).
CREATE TABLE IF NOT EXISTS subscribers (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    email         VARCHAR(200) NOT NULL UNIQUE,
    token         CHAR(32)     NOT NULL UNIQUE,
    status        ENUM('pending','confirmed','unsubscribed') NOT NULL DEFAULT 'pending',
    source        VARCHAR(120) NULL,
    created_at    DATETIME     DEFAULT CURRENT_TIMESTAMP,
    confirmed_at  DATETIME     NULL,
    unsubscribed_at DATETIME   NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
