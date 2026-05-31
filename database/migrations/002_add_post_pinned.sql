-- Migration 002: Add pinned column to blog_posts
-- Run once on the production DB:
--   mysql -u root -p datadinosaur < database/migrations/002_add_post_pinned.sql

ALTER TABLE blog_posts
  ADD COLUMN pinned TINYINT(1) NOT NULL DEFAULT 0
  AFTER visible;
