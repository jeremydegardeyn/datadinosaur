<section class="page-head container">
  <h1>About</h1>
</section>

<section class="container about-section">
  <div class="about-body">
    <div class="about-head">
      <img src="/assets/images/favicon-180.png" alt="" width="72" height="72">
      <div>
        <p class="about-lede">Hi, I'm Jeremy DeGardeyn, the human behind DataDinosaur.</p>
        <p class="about-role"><?= e($config['site']['author_title'] ?? 'Data & AI Architect') ?> ·
          <a href="https://www.linkedin.com/in/jeremy-degardeyn-05288b77/" target="_blank" rel="noopener noreferrer">LinkedIn</a> ·
          <a href="https://github.com/jeremydegardeyn/" target="_blank" rel="noopener noreferrer">GitHub</a></p>
      </div>
    </div>

    <p>I've spent over 20 years in IT and data, most recently as a senior data and AI architect.
      I've been in this field since before "big data" was a buzzword, watched it arrive and reshape
      everything, and now I'm navigating the next shift, into the AI era, learning it the same way
      I've learned everything else: hands-on, one project at a time.</p>

    <p>That's what DataDinosaur is about. I've been around a while and watched this field reinvent
      itself more than once. My take is that the fundamentals of human expertise, judgment, curiosity,
      knowing why something works, don't go away in the AI era. They matter more. This site is where I
      chronicle the journey: the tools I'm learning, the things I build, what clicks, and what takes
      three tries to get right. I'm writing it to think it through myself, and if it helps another
      practitioner make the same shift, even better.</p>

    <?php $about_series = get_all_series(); if ($about_series): ?>
    <p>Most of what I write here comes from things I built and ran, collected into series:</p>
    <ul class="about-series">
      <?php foreach ($about_series as $s): ?>
      <li><a href="/series/<?= e(series_slug($s['name'])) ?>"><?= e($s['name']) ?></a>
        <span class="field-note">(<?= (int)$s['post_count'] ?> posts)</span></li>
      <?php endforeach; ?>
    </ul>
    <?php endif; ?>

    <p>When I'm not building or writing, I'm usually with my two daughters, out hiking, on the yoga
      mat, or playing guitar. Still experimenting, still learning, and enjoying the process of getting
      my hands dirty along the way.</p>

    <p class="about-brainbreaks">When I need to step away from the data-and-AI grind, I build little
      <a href="/brain-breaks">Brain Breaks</a> — small games to keep the mind limber.</p>

    <p>Thanks for following along.</p>

    <div class="about-cta">
      <a href="/start-here" class="btn btn-primary">Start here</a>
      <a href="/services" class="btn btn-outline">Consulting services</a>
      <a href="/contact" class="btn btn-ghost">Get in touch</a>
    </div>
  </div>
</section>
