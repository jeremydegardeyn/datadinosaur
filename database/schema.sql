SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- Blog categories
CREATE TABLE IF NOT EXISTS blog_categories (
    id       INT AUTO_INCREMENT PRIMARY KEY,
    name     VARCHAR(100)  NOT NULL,
    slug     VARCHAR(120)  NOT NULL UNIQUE,
    created_at DATETIME    DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Blog posts
CREATE TABLE IF NOT EXISTS blog_posts (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    title          VARCHAR(255)  NOT NULL,
    slug           VARCHAR(280)  NOT NULL UNIQUE,
    excerpt        TEXT,
    summary        TEXT          NULL,
    content        LONGTEXT      NOT NULL,
    author         VARCHAR(100)  DEFAULT 'Jeremy',
    category_id    INT,
    series         VARCHAR(120)  NULL,
    series_order   INT           NULL,
    status         ENUM('draft','published') DEFAULT 'draft',
    visible        TINYINT(1)    NOT NULL DEFAULT 1,
    pinned         TINYINT(1)    NOT NULL DEFAULT 0,
    views          INT           DEFAULT 0,
    created_at     DATETIME      DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    content_updated_at DATETIME  NULL,
    published_at   DATETIME,
    FULLTEXT KEY ft_search (title, excerpt, content),
    KEY idx_series (series, series_order),
    FOREIGN KEY (category_id) REFERENCES blog_categories(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Blog comments
CREATE TABLE IF NOT EXISTS blog_comments (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    post_id      INT           NOT NULL,
    author_name  VARCHAR(100)  NOT NULL,
    author_email VARCHAR(200)  NOT NULL,
    content      TEXT          NOT NULL,
    status       ENUM('pending','approved','spam') DEFAULT 'pending',
    created_at   DATETIME      DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES blog_posts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Contact / consulting inquiries
CREATE TABLE IF NOT EXISTS contact_inquiries (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    name         VARCHAR(150)  NOT NULL,
    email        VARCHAR(200)  NOT NULL,
    company      VARCHAR(200),
    subject      VARCHAR(300)  NOT NULL,
    message      TEXT          NOT NULL,
    inquiry_type VARCHAR(200) DEFAULT 'General Question',
    status       ENUM('new','read','replied') DEFAULT 'new',
    created_at   DATETIME      DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Email subscribers (double opt-in)
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
