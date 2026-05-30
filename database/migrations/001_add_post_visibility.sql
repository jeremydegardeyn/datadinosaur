-- Migration 001: Add visible column to blog_posts
-- Run once on the production DB:
--   mysql -u root -p datadinosaur < database/migrations/001_add_post_visibility.sql

ALTER TABLE blog_posts
  ADD COLUMN visible TINYINT(1) NOT NULL DEFAULT 1
  AFTER status;
