<?php
$recent_posts = get_recent_posts(3);

// Structured data for homepage
$social_urls = array_map(fn($s) => $s['href'], $config['footer']['social'] ?? []);
$json_ld = json_encode([
    '@context' => 'https://schema.org',
    '@graph'   => [
        [
            '@type'       => 'WebSite',
            'name'        => $config['site']['name'],
            'url'         => $config['site']['base_url'],
            'description' => $config['site']['description'],
            'author'      => ['@type' => 'Person', 'name' => $config['site']['author']],
        ],
        [
            '@type'       => 'Person',
            'name'        => $config['site']['author'],
            'url'         => $config['site']['base_url'],
            'jobTitle'    => 'Data Engineer & Consultant',
            'description' => $config['site']['description'],
            'sameAs'      => $social_urls,
        ],
    ],
], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
?>
<!-- Hero -->
<section class="hero">
  <div class="container">
    <div class="hero-content">
      <h1 class="hero-title">Human Data Expertise<br>for the AI Era</h1>
      <p class="hero-sub">
        Real-world insights for data engineers navigating the shift. Written by a practitioner,
        based on daily experiences. Career advice, technical depth, and consulting when you need it.
      </p>
      <div class="hero-cta">
        <a href="/blog" class="btn btn-primary">Read the Blog</a>
        <a href="/services" class="btn btn-outline">Consulting Services</a>
      </div>
      <?php if (!empty($config['footer']['social'])): ?>
      <div class="hero-social">
        <?php foreach ($config['footer']['social'] as $s): ?>
        <a href="<?= e($s['href']) ?>" class="social-link" target="_blank" rel="noopener noreferrer">
          <?php if (($s['icon'] ?? '') === 'github'): ?>
          <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden="true"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>
          <?php elseif (($s['icon'] ?? '') === 'linkedin'): ?>
          <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden="true"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
          <?php endif; ?>
          <?= e($s['label']) ?>
        </a>
        <?php endforeach; ?>
      </div>
      <?php endif; ?>
    </div>
    <div class="hero-logo">
      <div class="hero-dino-wrap">
        <canvas id="hero-matrix" aria-hidden="true"></canvas>
        <canvas id="hero-chomp-back" aria-hidden="true"></canvas>
        <svg class="hero-dino-svg" viewBox="98 218 596 138"
             xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
             role="img" aria-label="DataDinosaur" style="overflow:visible">
          <style>.st0{fill:#e2e8f0;}.st1{fill:#39B54A;}</style>
          <!-- Dinosaur graphic — head raises and the lower jaw chomps the falling
               numbers 3x, looping. Begins at 4s so the jumping letters settle first.
               The lower jaw is the same logo path masked out of the base and clipped
               onto a neck hinge, so the resting/looping state is the exact logo. -->
          <defs>
            <clipPath id="dino-jaw-clip"><polygon points="253,295 282,257 305,252 302,265 296,277 291,290 287,302 278,306 265,303 256,297"/></clipPath>
            <mask id="dino-jaw-mask">
              <rect x="225" y="214" width="160" height="146" fill="#fff"/>
              <polygon points="255,293 281,259 302,255 300,265 295,277 290,289 286,300 278,304 267,301 258,296" fill="#000"/>
            </mask>
            <!-- Progressive, one-time bites taken out of the top of the last "a"
                 as the dino chomps. fill="freeze" so they stay gone after the
                 first chomp cycle; the bites ramp up to the right into the stem
                 so the bitten edge slopes off with no leftover overhang. -->
            <mask id="dino-eat-mask">
              <rect x="233" y="278" width="64" height="82" fill="#fff"/>
              <!-- Bites vanish on each chomp snap. The keyframed mouth-close lands at
                   cycle keyTimes .29/.38/.47, but the snap reads ~0.25s earlier, so
                   fire at 5.49s / 6.03s / 6.57s to match the visible chomp. Grouped
                   into contiguous left-to-right thirds so every chomp removes a clearly
                   visible chunk (the deep left scoop lands on chomp 1). -->
              <!-- chomp 1 (~5.49s) — left third (deep scoop) -->
              <circle cx="258" cy="300" r="3"   fill="#000" opacity="0"><animate attributeName="opacity" from="0" to="1" begin="5.49s" dur="0.1s" fill="freeze"/></circle>
              <circle cx="264" cy="300" r="3.5" fill="#000" opacity="0"><animate attributeName="opacity" from="0" to="1" begin="5.49s" dur="0.1s" fill="freeze"/></circle>
              <circle cx="265" cy="299" r="2.9" fill="#000" opacity="0"><animate attributeName="opacity" from="0" to="1" begin="5.49s" dur="0.1s" fill="freeze"/></circle>
              <!-- chomp 2 (~6.03s) — middle third -->
              <circle cx="270" cy="298" r="2.9" fill="#000" opacity="0"><animate attributeName="opacity" from="0" to="1" begin="6.03s" dur="0.1s" fill="freeze"/></circle>
              <circle cx="270" cy="299" r="3.3" fill="#000" opacity="0"><animate attributeName="opacity" from="0" to="1" begin="6.03s" dur="0.1s" fill="freeze"/></circle>
              <circle cx="275" cy="296" r="3"   fill="#000" opacity="0"><animate attributeName="opacity" from="0" to="1" begin="6.03s" dur="0.1s" fill="freeze"/></circle>
              <!-- chomp 3 (~6.57s) — right third (shoulder into stem) + an extra centre bite -->
              <circle cx="276" cy="296" r="3.3" fill="#000" opacity="0"><animate attributeName="opacity" from="0" to="1" begin="6.57s" dur="0.1s" fill="freeze"/></circle>
              <circle cx="280" cy="293" r="3.1" fill="#000" opacity="0"><animate attributeName="opacity" from="0" to="1" begin="6.57s" dur="0.1s" fill="freeze"/></circle>
              <circle cx="285" cy="291" r="3.3" fill="#000" opacity="0"><animate attributeName="opacity" from="0" to="1" begin="6.57s" dur="0.1s" fill="freeze"/></circle>
              <circle cx="291" cy="290" r="3.4" fill="#000" opacity="0"><animate attributeName="opacity" from="0" to="1" begin="6.57s" dur="0.1s" fill="freeze"/></circle>
              <!-- the "a" counter, punched as a movable hole so the jump physics can bob it -->
              <path id="a2-counter" class="letter-dot" data-dot-scale="0.45" fill="#000" d="M263.7,318.7c-4.2,0-7.8,3.3-7.8,7.6c0,4.3,3.7,7.7,7.8,7.7c4.2,0,7.8-3.4,7.8-7.7C271.5,322,267.9,318.7,263.7,318.7z"/>
            </mask>
            <!-- Counter holes for the other two "a"s, punched as movable mask shapes so the
                 jump-in physics can bob them (the .letter-dot path) like the i/r tittles. -->
            <mask id="dino-a1-cmask">
              <rect x="138" y="294" width="64" height="62" fill="#fff"/>
              <path id="a1-counter" class="letter-dot" data-dot-scale="0.45" fill="#000" d="M168,318.7c-4.2,0-7.8,3.3-7.8,7.6c0,4.3,3.7,7.7,7.8,7.7c4.2,0,7.8-3.4,7.8-7.7C175.8,322,172.2,318.7,168,318.7z"/>
            </mask>
            <mask id="dino-a3-cmask">
              <rect x="542" y="294" width="64" height="62" fill="#fff"/>
              <path id="a3-counter" class="letter-dot" data-dot-scale="0.45" fill="#000" d="M570.1,318.7c-4.2,0-7.8,3.3-7.8,7.6c0,4.3,3.7,7.7,7.8,7.7c4.2,0,7.8-3.4,7.8-7.7C577.9,322,574.3,318.7,570.1,318.7z"/>
            </mask>
          </defs>
          <g id="hero-dino-graphic">
            <animateTransform attributeName="transform" type="rotate" dur="6s" begin="4s" repeatCount="indefinite"
              keyTimes="0;0.08;0.18;0.50;0.60;1"
              values="0 330 330;0 330 330;-6 330 330;-6 330 330;0 330 330;0 330 330"/>
            <path class="st1" mask="url(#dino-jaw-mask)" d="M314.8,231.6l-19.6-9.4c-5.8-3.2-12-4.5-17.9,0.4c-10.7,8.8-20.7,18.4-29.7,28.8c-4.5,5.3-7.6,11-8.2,18c-0.5,4.8,1,8.6,4.4,11.9c3.5,3.3,7.6,5.5,12.1,7.3c0.5,0.1,21.6-21.4,21.6-21.4s-0.2,23.1,0,23.4c2,2.7,6.1,2.8,8.1,0.2c0.5-0.7,1-1.5,1.4-2.3c4-7.4,7.1-15.3,10.3-23.1c0.9-2.3,1.9-4.7,2.9-7.3c4.9,1.7,9.6,3.3,14.6,4.9l0,6.6c-3.1,1.4-6.2,2.8-9.2,4.1c-2.3,1-4.8,2.5-6.2,4.4c-2.9,3.6-1.7,8.2,2,11.2c0,0-1.5-8,2.8-9.2c3.7-1,5.3,1.7,5.1,3.5c2-0.9,2.8-2.4,2-4.3c-0.4-1.1-0.9-2-1.4-3.1c1.2-0.6,3-1.4,4.9-2.1l-0.3,80.5c30.2-7.9,47.1-36.4,47.1-66.3C361.5,262,337.2,240.6,314.8,231.6z M274.5,242.5c-1,1.7-3.3,2.2-5,1.1c-1.7-1-2.3-3.2-1.3-4.9c1-1.7,3.3-2.2,5-1.1C274.9,238.6,275.4,240.9,274.5,242.5z"/>
            <g id="hero-dino-jaw">
              <animateTransform id="dino-jaw-anim" attributeName="transform" type="rotate" dur="6s" begin="4s" repeatCount="indefinite"
                keyTimes="0;0.20;0.245;0.29;0.335;0.38;0.425;0.47;1"
                values="0 300 258;0 300 258;13 300 258;0 300 258;13 300 258;0 300 258;13 300 258;0 300 258;0 300 258"/>
              <path class="st1" clip-path="url(#dino-jaw-clip)" d="M314.8,231.6l-19.6-9.4c-5.8-3.2-12-4.5-17.9,0.4c-10.7,8.8-20.7,18.4-29.7,28.8c-4.5,5.3-7.6,11-8.2,18c-0.5,4.8,1,8.6,4.4,11.9c3.5,3.3,7.6,5.5,12.1,7.3c0.5,0.1,21.6-21.4,21.6-21.4s-0.2,23.1,0,23.4c2,2.7,6.1,2.8,8.1,0.2c0.5-0.7,1-1.5,1.4-2.3c4-7.4,7.1-15.3,10.3-23.1c0.9-2.3,1.9-4.7,2.9-7.3c4.9,1.7,9.6,3.3,14.6,4.9l0,6.6c-3.1,1.4-6.2,2.8-9.2,4.1c-2.3,1-4.8,2.5-6.2,4.4c-2.9,3.6-1.7,8.2,2,11.2c0,0-1.5-8,2.8-9.2c3.7-1,5.3,1.7,5.1,3.5c2-0.9,2.8-2.4,2-4.3c-0.4-1.1-0.9-2-1.4-3.1c1.2-0.6,3-1.4,4.9-2.1l-0.3,80.5c30.2-7.9,47.1-36.4,47.1-66.3C361.5,262,337.2,240.6,314.8,231.6z"/>
            </g>
          </g>
          <!-- "Data" + "inosaur" text — each letter wrapped for physics -->
          <g id="hero-text">
            <g class="hero-letter"><path class="st0" d="M103.9,354.4l0.4-93c17,6.8,35.3,23,35.3,42.8C139.6,326.8,126.9,348.5,103.9,354.4z"/></g>
            <g class="hero-letter" data-dot="#a1-counter"><path class="st0" mask="url(#dino-a1-cmask)" d="M181.9,350.4c-2.8,2.8-8.6,2.7-12.4,2.7c-16.3,0-26.7-9.5-26.7-26.2c0-15.1,9.5-28.2,25.4-28.2
              c2.2,0,5.3,0.9,7.1,1.9l0.5-4.7l17.5-0.1V352C193.3,352,181.7,350.7,181.9,350.4z"/></g>
            <g class="hero-letter"><path class="st0 dd-t" d="M227.7,303.1l-0.8,49.6l-17.2-0.3l0.6-49.1l-10.8-1.1v-19.7h11l-0.5-11.3l18,1l-0.6,10.3h9.7
              l0.4,20.3L227.7,303.1z"/></g>
            <g class="hero-letter" data-dot="#a2-counter"><path class="st0 dd-a" mask="url(#dino-eat-mask)" d="M277.6,350.4c-2.8,2.8-8.6,2.7-12.4,2.7c-16.3,0-26.7-9.5-26.7-26.2c0-15.1,9.5-28.2,25.4-28.2
              c2.2,0,5.3,0.9,7.1,1.9l0.5-4.7l17.5-0.1V352C289,352,277.4,350.7,277.6,350.4z"/></g>
            <g class="hero-letter">
              <path class="st1" d="M383.9,353.1l-15.2-3l0.1-54.3l18.4,1.1L383.9,353.1z"/>
              <path class="st1 letter-dot" d="M378.3,290.6c-4.4,0-8.1-3.5-8.1-8.1c0-4.4,3.7-8,8.1-8c4.4,0,8.2,3.5,8.2,8C386.5,287.1,382.7,290.6,378.3,290.6z"/>
            </g>
            <g class="hero-letter"><path class="st1" d="M428.7,353.1l-9.7-0.4l-1.8-19.7l-11.4-0.5l-1.9,19.7l-8.1-0.4v-55.8l11.8-5.1l1,3.9
              c4.7,0,16,0.8,18.2,5.2c2.8,5.1,3.2,20.4,3.2,26.5C430,335.4,429.4,344.3,428.7,353.1z"/></g>
            <g class="hero-letter"><path class="st1" d="M463.4,352.4c-15.7,0-25.4-10.8-25.4-26.2c0-15.1,10.9-30.5,27-30.5c15.4,0,27.7,11.1,27.7,27
              C492.6,338.1,479.1,352.4,463.4,352.4z"/></g>
            <g class="hero-letter"><path class="st1" d="M516.3,353.4c-5.6,0-11.5-0.3-17-1.6v-13.4l12.4-0.6v-3.8c-8.7-8.2-12.5-10.5-12.5-23.3
              c0-14.3,11.5-18.5,23.8-18.5c4.9,0,9.9,0.5,14.6,1.6v15.4l-11.6,1c10,7.2,13.7,12.2,13.7,24.9
              C539.6,349.2,528.4,353.4,516.3,353.4z"/></g>
            <g class="hero-letter" data-dot="#a3-counter"><path class="st1" mask="url(#dino-a3-cmask)" d="M584,350.4c-2.8,2.8-8.6,2.7-12.4,2.7c-16.3,0-26.7-9.5-26.7-26.2c0-15.1,9.5-28.2,25.4-28.2
              c2.2,0,5.3,0.9,7.1,1.9l0.5-4.7l17.5-0.1V352C595.4,352,583.8,350.7,584,350.4z"/></g>
            <g class="hero-letter"><path class="st1" d="M625.4,353c-19.6,0-21.4-16-21.4-31.5c0-8.5,0.6-17.1,0.3-25.6l39.5-2.2c1,9.4,2.7,19.4,2.7,29
              C646.4,336.3,642,353,625.4,353z"/></g>
            <g class="hero-letter">
              <path class="st1" d="M668.4,353.1l-14.1-3l-1.1-57.3l16.6,1L668.4,353.1z"/>
              <path class="st1 letter-dot" d="M679.8,309.7c-3.9,0-7.3-3.3-7.3-7.3c0-3.9,3.4-7.2,7.3-7.2c3.7,0,8.2,1.8,8.2,6.1C688.1,305.3,684,309.7,679.8,309.7z"/>
            </g>
          </g>
          <!-- Invisible anchor at the chomp point; JS reads its on-screen position
               to spawn the white "chomp bits" so the spray tracks the real mouth
               regardless of how the SVG is scaled. -->
          <circle id="hero-chomp-origin" cx="264" cy="297" r="0.01" fill="none"/>
        </svg>
        <canvas id="hero-chomp-front" aria-hidden="true"></canvas>
        <p class="hero-tagline-anim" id="hero-tagline">Taking Bytes Out of Big Data</p>
      </div>
    </div>
  </div>
</section>

<!-- Value props -->
<section class="value-props">
  <div class="container">
    <div class="props-grid">
      <div class="prop-card">
        <div class="prop-icon">&#128200;</div>
        <h3>Career Strategy</h3>
        <p>Practical advice on staying relevant and growing your career as gen AI reshapes the data engineering landscape.</p>
      </div>
      <div class="prop-card">
        <div class="prop-icon">&#128736;</div>
        <h3>Technical Depth</h3>
        <p>Governance, metadata management, data quality, responsible AI — the durable skills that matter most right now.</p>
      </div>
      <div class="prop-card">
        <div class="prop-icon">&#128101;</div>
        <h3>1-on-1 Consulting</h3>
        <p>Need expert eyes on your data architecture? Reach out for direct consulting on your specific challenges.</p>
      </div>
    </div>
  </div>
</section>

<!-- Recent blog posts -->
<?php if (!empty($recent_posts)): ?>
<section class="recent-posts">
  <div class="container">
    <div class="section-header">
      <h2>Latest from the Blog</h2>
      <a href="/blog" class="section-link">All posts &rarr;</a>
    </div>
    <div class="post-grid">
      <?php foreach ($recent_posts as $p): ?>
      <?php
        $excerpt = $p['excerpt'] ?: auto_excerpt($p['content'] ?? '', $config['blog']['excerpt_length']);
      ?>
      <article class="post-card">
        <div class="post-card-body">
          <h3 class="post-card-title">
            <a href="/blog/<?= e($p['slug']) ?>"><?= e($p['title']) ?></a>
          </h3>
          <p class="post-card-excerpt"><?= e($excerpt) ?></p>
        </div>
        <div class="post-card-footer">
          <time class="post-meta-date" datetime="<?= e($p['published_at']) ?>">
            <?= date($config['blog']['date_format'], strtotime($p['published_at'])) ?>
          </time>
          <a href="/blog/<?= e($p['slug']) ?>" class="post-read-more">Read &rarr;</a>
        </div>
      </article>
      <?php endforeach; ?>
    </div>
  </div>
</section>
<?php endif; ?>

<script src="/assets/js/hero-animation.js?v=1" defer></script>
<script src="/assets/js/hero-letter-physics.js?v=3" defer></script>
<script src="/assets/js/hero-chomp-bits.js?v=4" defer></script>

<!-- CTA banner -->
<section class="cta-banner">
  <div class="container">
    <h2>Have a data challenge?</h2>
    <p>I offer consulting on data architecture, governance, AI integration, and data quality.
       Let's talk about what you're working on.</p>
    <a href="/contact" class="btn btn-primary">Get in Touch</a>
  </div>
</section>
