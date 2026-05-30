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
    content        LONGTEXT      NOT NULL,
    author         VARCHAR(100)  DEFAULT 'Jeremy',
    category_id    INT,
    featured_image VARCHAR(255),
    status         ENUM('draft','published') DEFAULT 'draft',
    views          INT           DEFAULT 0,
    created_at     DATETIME      DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    published_at   DATETIME,
    FULLTEXT KEY ft_search (title, excerpt, content),
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
