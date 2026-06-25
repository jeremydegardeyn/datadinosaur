<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title><?= e($page_title) ?></title>
<meta name="description" content="<?= e($meta_desc) ?>">
<?php if ($seo_noindex): ?>
<meta name="robots" content="noindex, nofollow">
<?php else: ?>
<link rel="canonical" href="<?= e($canonical_url) ?>">
<?php endif; ?>

<!-- Open Graph -->
<meta property="og:site_name"   content="<?= e($config['site']['name']) ?>">
<meta property="og:type"        content="<?= e($og_type) ?>">
<meta property="og:title"       content="<?= e($og_title) ?>">
<meta property="og:description" content="<?= e($meta_desc) ?>">
<meta property="og:url"         content="<?= e($canonical_url) ?>">
<meta property="og:image"       content="<?= e($og_image) ?>">
<meta property="og:image:width"  content="1200">
<meta property="og:image:height" content="630">

<!-- Twitter Card -->
<meta name="twitter:card"        content="summary_large_image">
<meta name="twitter:title"       content="<?= e($og_title) ?>">
<meta name="twitter:description" content="<?= e($meta_desc) ?>">
<meta name="twitter:image"       content="<?= e($og_image) ?>">

<?php if ($json_ld): ?>
<script type="application/ld+json"><?= $json_ld ?></script>
<?php endif; ?>

<link rel="icon" type="image/svg+xml" href="/assets/images/favicon.svg">
<link rel="icon" type="image/png" sizes="32x32" href="/assets/images/favicon-32.png">
<link rel="apple-touch-icon" sizes="180x180" href="/assets/images/favicon-180.png">
<link rel="stylesheet" href="/assets/css/main.css?v=9">
<?php if (($config['ads']['enabled'] ?? false) && !empty($config['ads']['header_ad_code'])): ?>
<?= $config['ads']['header_ad_code'] ?>
<?php endif; ?>
<?php if (($config['analytics']['enabled'] ?? false) && !empty($config['analytics']['goatcounter_code'])): ?>
<script data-goatcounter="https://<?= e($config['analytics']['goatcounter_code']) ?>.goatcounter.com/count"
        async src="//gc.zgo.at/count.js"></script>
<?php endif; ?>
</head>
<body class="<?= e($body_class) ?>">

<header class="site-header">
  <div class="container header-inner">
    <a href="/" class="site-logo">
      <img src="/assets/images/data_dinosaur_header.svg" alt="DataDinosaur" height="36">
      <span class="site-tagline">Human Expertise for the AI Era</span>
    </a>

    <button class="nav-toggle" id="navToggle" aria-label="Toggle navigation">
      <span></span><span></span><span></span>
    </button>

    <nav class="site-nav" id="siteNav">
      <?php foreach ($config['nav'] as $item): ?>
      <a href="<?= e($item['href']) ?>"
         class="nav-link<?= ($raw_path === $item['href'] ? ' active' : '') ?>">
        <?= e($item['label']) ?>
      </a>
      <?php endforeach; ?>

      <?php if (is_admin()): ?>
      <a href="/admin" class="nav-link admin-link">Admin</a>
      <a href="/api/auth?action=logout" class="nav-link nav-link-muted">Logout</a>
      <?php endif; ?>
    </nav>
  </div>
</header>

<!-- Login modal (shown when ?login=1) -->
<?php if (isset($_GET['login']) || isset($_GET['login_error'])): ?>
<div class="modal-overlay" id="loginModal">
  <div class="modal">
    <h2>Admin Login</h2>
    <?php if (isset($_GET['login_error'])): ?>
    <p class="error-msg">Invalid credentials.</p>
    <?php endif; ?>
    <form method="POST" action="/api/auth" class="login-form">
      <input type="hidden" name="csrf_token" value="<?= e(csrf_token()) ?>">
      <input type="hidden" name="action" value="login">
      <label>Username
        <input type="text" name="username" autocomplete="username" required>
      </label>
      <label>Password
        <input type="password" name="password" autocomplete="current-password" required>
      </label>
      <button type="submit" class="btn btn-primary">Login</button>
      <a href="/" class="btn btn-ghost">Cancel</a>
    </form>
  </div>
</div>
<?php endif; ?>

<main class="site-main">
